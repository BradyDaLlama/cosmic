/**
 * No session here: the Item is found by Plaid's item_id and its own email is used.
 * Verification (plaid.com/docs/api/webhooks/webhook-verification): ES256 JWT signed by the key
 * for its `kid`, `iat` under 5 minutes old, `request_body_sha256` matching the raw body.
 */
import { createHash, createPublicKey, timingSafeEqual, verify, type KeyObject } from 'node:crypto';
import { budgetDb } from './db';
import { plaid, RECONNECT_CODES } from './plaid';
import { syncItem } from './sync';

const MAX_AGE_SECONDS = 5 * 60;

const globalForKeys = globalThis as typeof globalThis & {
    __cosmicPlaidKeys?: Map<string, { key: KeyObject; expiredAt: number | null }>;
};
const keyCache = (globalForKeys.__cosmicPlaidKeys ??= new Map());

async function verificationKey(kid: string): Promise<KeyObject | undefined> {
    let cached = keyCache.get(kid);
    if (!cached) {
        const { key } = await plaid().webhook.getVerificationKey({ key_id: kid });
        cached = {
            key: createPublicKey({ key: { kty: key.kty, crv: key.crv, x: key.x, y: key.y }, format: 'jwk' }),
            expiredAt: key.expired_at,
        };
        keyCache.set(kid, cached);
    }
    if (cached.expiredAt !== null && cached.expiredAt * 1000 < Date.now()) return undefined;
    return cached.key;
}

const decodePart = (part: string) => JSON.parse(Buffer.from(part, 'base64url').toString('utf8'));

export async function verifyPlaidWebhook(jwt: string | null, rawBody: string): Promise<boolean> {
    if (!jwt) return false;
    const parts = jwt.split('.');
    if (parts.length !== 3) return false;
    const [h, p, s] = parts;
    try {
        const header = decodePart(h) as { alg?: string; kid?: string };
        if (header.alg !== 'ES256' || !header.kid) return false;
        const key = await verificationKey(header.kid);
        if (!key) return false;
        const signed = verify(
            'sha256',
            Buffer.from(`${h}.${p}`),
            { key, dsaEncoding: 'ieee-p1363' },
            Buffer.from(s, 'base64url'),
        );
        if (!signed) return false;

        const claims = decodePart(p) as { iat?: number; request_body_sha256?: string };
        if (typeof claims.iat !== 'number' || Date.now() / 1000 - claims.iat > MAX_AGE_SECONDS) return false;
        const expected = Buffer.from(String(claims.request_body_sha256 ?? ''), 'utf8');
        const actual = Buffer.from(createHash('sha256').update(rawBody, 'utf8').digest('hex'), 'utf8');
        return expected.length === actual.length && timingSafeEqual(expected, actual);
    } catch {
        return false;
    }
}

type Webhook = {
    webhook_type?: string;
    webhook_code?: string;
    item_id?: string;
    error?: { error_code?: string } | null;
};

export async function handlePlaidWebhook(hook: Webhook): Promise<(() => Promise<void>) | undefined> {
    if (!hook.item_id) return undefined;
    const items = await budgetDb.items();
    const item = await items.findOne({ plaidItemId: hook.item_id });
    if (!item) return undefined;
    const flag = (code: string) =>
        items.updateOne({ _id: item._id, email: item.email }, { $set: { status: 'needs_reconnect', errorCode: code } });

    const { webhook_type: type, webhook_code: code } = hook;
    if (type === 'TRANSACTIONS' && code === 'SYNC_UPDATES_AVAILABLE') {
        return async () => {
            await syncItem(item);
        };
    }
    if (type === 'ITEM') {
        switch (code) {
            case 'ERROR': {
                const errorCode = hook.error?.error_code ?? 'ITEM_ERROR';
                if (RECONNECT_CODES.has(errorCode)) await flag(errorCode);
                break;
            }
            case 'PENDING_EXPIRATION':
            case 'PENDING_DISCONNECT':
            case 'USER_PERMISSION_REVOKED':
            case 'USER_ACCOUNT_REVOKED':
                await flag(code);
                break;
            case 'LOGIN_REPAIRED':
                await items.updateOne(
                    { _id: item._id, email: item.email },
                    { $set: { status: 'ok' }, $unset: { errorCode: '' } },
                );
                break;
        }
    }
    return undefined;
}
