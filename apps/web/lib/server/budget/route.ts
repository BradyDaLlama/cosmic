import { PlaidError } from 'plaid';
import { HttpError, withUser } from '../userRoute';
import { PlaidNotConfigured, plaidErrorCode } from './plaid';
import { TokenKeyNotConfigured } from './tokenCrypto';

export function withBudget(request: Request, handler: (email: string) => Promise<unknown>): Promise<Response> {
    return withUser(request, async (email) => {
        try {
            return await handler(email);
        } catch (err) {
            if (err instanceof PlaidNotConfigured || err instanceof TokenKeyNotConfigured)
                throw new HttpError(503, 'no_plaid', err.message);
            if (err instanceof PlaidError) {
                const code = plaidErrorCode(err) ?? 'PLAID_ERROR';
                // Never log the request, which carries the secret.
                console.error('[budget] plaid', err.statusCode, code, err.requestId);
                throw new HttpError(502, 'plaid', code);
            }
            throw err;
        }
    });
}
