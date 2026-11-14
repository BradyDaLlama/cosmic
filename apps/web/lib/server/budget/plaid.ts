import { PlaidClient, PlaidEnvironment, PlaidError } from 'plaid';

export class PlaidNotConfigured extends Error {
    constructor(detail: string) {
        super(`${detail} (see apps/web/.env.example).`);
    }
}

type PlaidEnv = 'sandbox' | 'production';

function plaidEnv(): PlaidEnv {
    const env = (process.env.PLAID_ENV || 'sandbox').trim().toLowerCase();
    if (env !== 'sandbox' && env !== 'production')
        throw new PlaidNotConfigured('PLAID_ENV must be sandbox or production');
    return env;
}

const globalForPlaid = globalThis as typeof globalThis & { __cosmicPlaid?: { key: string; client: PlaidClient } };

export function plaid(): PlaidClient {
    const clientId = process.env.PLAID_CLIENT_ID?.trim();
    const secret = process.env.PLAID_SECRET?.trim();
    if (!clientId || !secret) throw new PlaidNotConfigured('PLAID_CLIENT_ID and PLAID_SECRET must be set');
    const env = plaidEnv();
    const key = `${env}:${clientId}`;
    if (globalForPlaid.__cosmicPlaid?.key !== key) {
        globalForPlaid.__cosmicPlaid = {
            key,
            client: new PlaidClient({
                environment: env === 'production' ? PlaidEnvironment.Production : PlaidEnvironment.Sandbox,
                clientId,
                secret,
                timeoutInSeconds: 30,
                maxRetries: 2,
            }),
        };
    }
    return globalForPlaid.__cosmicPlaid.client;
}

export function plaidErrorCode(err: unknown): string | undefined {
    if (!(err instanceof PlaidError)) return undefined;
    const body = err.body as { error_code?: unknown } | undefined;
    return typeof body?.error_code === 'string' ? body.error_code : undefined;
}

export const PLAID_CODE = /^[A-Z][A-Z0-9_]{1,80}$/;

export const RECONNECT_CODES = new Set([
    'ITEM_LOGIN_REQUIRED',
    'PENDING_EXPIRATION',
    'PENDING_DISCONNECT',
    'ACCESS_NOT_GRANTED',
    'NO_ACCOUNTS',
    'INSUFFICIENT_CREDENTIALS',
    'INVALID_CREDENTIALS',
    'INVALID_MFA',
    'ITEM_LOCKED',
    'USER_SETUP_REQUIRED',
    'MFA_NOT_SUPPORTED',
    'USER_PERMISSION_REVOKED',
    'USER_ACCOUNT_REVOKED',
]);
