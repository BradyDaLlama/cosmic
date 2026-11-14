import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';

const SESSION_COOKIE = 'cosmic_session';
export const STATE_COOKIE = 'cosmic_oauth_state';
const MAX_AGE = 60 * 60 * 24 * 180;

export type Session = {
    email: string;
    refreshToken: string;
    scopes?: string[];
};

function key(): Buffer {
    const secret = process.env.SESSION_SECRET;
    if (!secret || secret.length < 32) {
        throw new Error('SESSION_SECRET must be set to at least 32 characters (see apps/web/.env.example).');
    }
    return createHash('sha256').update(secret).digest();
}

function seal(value: unknown): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key(), iv);
    const body = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
    return Buffer.concat([iv, cipher.getAuthTag(), body]).toString('base64url');
}

function open<T>(value: string | undefined): Partial<T> | null {
    if (!value) return null;
    try {
        const raw = Buffer.from(value, 'base64url');
        const decipher = createDecipheriv('aes-256-gcm', key(), raw.subarray(0, 12));
        decipher.setAuthTag(raw.subarray(12, 28));
        return JSON.parse(Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString('utf8'));
    } catch {
        return null;
    }
}

function unseal(value: string | undefined): Session | null {
    const session = open<Session>(value);
    return session?.email && session.refreshToken ? (session as Session) : null;
}

export const APP_SCHEME = 'cosmic';
export const APP_STATE_PREFIX = 'app.';
const HANDOFF_MS = 2 * 60_000;
type Handoff = { handoff: Session; expiresAt: number };

// The app signs in through Chrome, which can't share its cookies with the app, so the session crosses over in a
// short-lived sealed code instead.
export const createHandoff = (session: Session) => seal({ handoff: session, expiresAt: Date.now() + HANDOFF_MS });

export function redeemHandoff(code: string | null): Session | null {
    const sealed = open<Handoff>(code ?? undefined);
    const session = sealed?.handoff;
    if (!session?.email || !session.refreshToken || !sealed?.expiresAt || sealed.expiresAt < Date.now()) return null;
    return session;
}

const cookieOptions = () => ({
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
});

export async function getSession(request?: Request): Promise<Session | null> {
    const header = request?.headers.get('authorization');
    if (header?.startsWith('Bearer ')) return unseal(header.slice(7));
    const jar = await cookies();
    return unseal(jar.get(SESSION_COOKIE)?.value);
}

export async function setSession(session: Session) {
    const jar = await cookies();
    jar.set(SESSION_COOKIE, seal(session), { ...cookieOptions(), maxAge: MAX_AGE });
}

export async function clearSession() {
    const jar = await cookies();
    jar.set(SESSION_COOKIE, '', { ...cookieOptions(), maxAge: 0 });
}

export function isAllowed(email: string): boolean {
    const allowed = (process.env.ALLOWED_EMAILS ?? '')
        .split(',')
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean);
    return allowed.includes(email.toLowerCase());
}
