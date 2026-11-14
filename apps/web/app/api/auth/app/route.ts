import { NextResponse, type NextRequest } from 'next/server';
import { redeemHandoff, setSession } from '@/lib/server/session';

export async function GET(request: NextRequest) {
    const { origin, searchParams } = request.nextUrl;
    const session = redeemHandoff(searchParams.get('code'));
    if (!session) return NextResponse.redirect(`${origin}/?auth=failed`);
    await setSession(session);
    return NextResponse.redirect(`${origin}/?auth=ok`);
}
