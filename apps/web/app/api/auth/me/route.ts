import { NextResponse } from 'next/server';
import { getSession } from '@/lib/server/session';

export async function GET(request: Request) {
    const session = await getSession(request);
    return NextResponse.json(session ? { email: session.email } : { email: null });
}
