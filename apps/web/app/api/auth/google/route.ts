import { randomBytes } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { authorizationUrl } from '@/lib/server/google';
import { APP_STATE_PREFIX, STATE_COOKIE } from '@/lib/server/session';

export async function GET(request: NextRequest) {
    const app = request.nextUrl.searchParams.has('app');
    const state = `${app ? APP_STATE_PREFIX : ''}${randomBytes(24).toString('base64url')}`;
    const response = NextResponse.redirect(authorizationUrl(request.nextUrl.origin, state));
    response.cookies.set(STATE_COOKIE, state, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/api/auth',
        maxAge: 600,
    });
    return response;
}
