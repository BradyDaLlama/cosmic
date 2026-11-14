import { timingSafeEqual } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { exchangeCode } from '@/lib/server/google';
import { APP_SCHEME, APP_STATE_PREFIX, createHandoff, isAllowed, setSession, STATE_COOKIE } from '@/lib/server/session';

const sameString = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

export async function GET(request: NextRequest) {
    const { origin, searchParams } = request.nextUrl;
    const state = searchParams.get('state');
    const app = state?.startsWith(APP_STATE_PREFIX);
    const back = (auth: string, handoff?: string) => {
        const res = NextResponse.redirect(
            app
                ? `${APP_SCHEME}://auth?${new URLSearchParams(handoff ? { auth, code: handoff } : { auth })}`
                : `${origin}/?auth=${auth}`,
        );
        res.cookies.set(STATE_COOKIE, '', { path: '/api/auth', maxAge: 0 });
        return res;
    };

    if (searchParams.get('error')) return back('cancelled');
    const code = searchParams.get('code');
    const expected = request.cookies.get(STATE_COOKIE)?.value;
    if (!code || !state || !expected || !sameString(state, expected)) return back('failed');

    try {
        const { email, refreshToken, scopes } = await exchangeCode(code, origin);
        if (!isAllowed(email)) return back('not_allowed');
        if (app) return back('ok', createHandoff({ email, refreshToken, scopes }));
        await setSession({ email, refreshToken, scopes });
        return back('ok');
    } catch (err) {
        console.error('[auth] sign-in failed', err);
        return back('failed');
    }
}
