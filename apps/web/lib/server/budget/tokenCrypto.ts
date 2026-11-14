/**
 * Bank tokens at rest, under PLAID_TOKEN_KEY (32 bytes, base64 or hex). Bound to the Item id as
 * associated data, so a token copied onto another row won't decrypt. Format: `v1.<base64url(iv|tag|ciphertext)>`.
 */
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

export class TokenKeyNotConfigured extends Error {
    constructor(detail = 'is not set') {
        super(`PLAID_TOKEN_KEY ${detail} (see apps/web/.env.example).`);
    }
}

function key(): Buffer {
    const raw = process.env.PLAID_TOKEN_KEY?.trim();
    if (!raw) throw new TokenKeyNotConfigured();
    const bytes = /^[0-9a-f]{64}$/i.test(raw) ? Buffer.from(raw, 'hex') : Buffer.from(raw, 'base64');
    if (bytes.length !== 32) throw new TokenKeyNotConfigured('must be 32 bytes, base64 or hex');
    return bytes;
}

export function encryptToken(token: string, boundTo: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key(), iv);
    cipher.setAAD(Buffer.from(boundTo, 'utf8'));
    const body = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
    return `v1.${Buffer.concat([iv, cipher.getAuthTag(), body]).toString('base64url')}`;
}

export function decryptToken(sealed: string, boundTo: string): string {
    if (!sealed.startsWith('v1.')) throw new Error('Unknown access token format.');
    const raw = Buffer.from(sealed.slice(3), 'base64url');
    const decipher = createDecipheriv('aes-256-gcm', key(), raw.subarray(0, 12));
    decipher.setAAD(Buffer.from(boundTo, 'utf8'));
    decipher.setAuthTag(raw.subarray(12, 28));
    return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString('utf8');
}
