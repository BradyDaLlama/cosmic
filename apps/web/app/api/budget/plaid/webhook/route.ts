import { after, NextResponse } from 'next/server';
import { handlePlaidWebhook, verifyPlaidWebhook } from '@/lib/server/budget/webhook';

export const maxDuration = 60;

export async function POST(request: Request) {
    const raw = await request.text();
    if (!(await verifyPlaidWebhook(request.headers.get('plaid-verification'), raw)))
        return NextResponse.json({ error: 'unverified' }, { status: 401 });
    try {
        const work = await handlePlaidWebhook(JSON.parse(raw));
        if (work) after(() => work().catch((err) => console.error('[budget] webhook sync failed', err)));
    } catch (err) {
        console.error('[budget] webhook failed', err);
        return NextResponse.json({ error: 'failed' }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
}
