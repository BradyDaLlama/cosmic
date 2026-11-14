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

function seal(session: Session): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key(), iv);
    const body = Buffer.concat([cipher.update(JSON.stringify(session), 'utf8'), cipher.final()]);
    return Buffer.concat([iv, cipher.getAuthTag(), body]).toString('base64url');
}

function unseal(value: string | undefined): Session | null {
    if (!value) return null;
    try {
        const raw = Buffer.from(value, 'base64url');
        const decipher = createDecipheriv('aes-256-gcm', key(), raw.subarray(0, 12));
        decipher.setAuthTag(raw.subarray(12, 28));
        const json = Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString('utf8');
        const session = JSON.parse(json) as Session;
        return session.email && session.refreshToken ? session : null;
    } catch {
        return null;
    }
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
