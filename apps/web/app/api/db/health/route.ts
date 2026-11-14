import { NextResponse } from 'next/server';
import { DatabaseNotConfigured, getDb } from '@/lib/server/db';
import { getSession } from '@/lib/server/session';

export async function GET(request: Request) {
    if (!(await getSession(request))) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    const started = Date.now();
    try {
        const db = await getDb();
        await db.command({ ping: 1 });
        const collections = (await db.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name);
        return NextResponse.json({ ok: true, database: db.databaseName, collections, ms: Date.now() - started });
    } catch (err) {
        if (err instanceof DatabaseNotConfigured) {
            return NextResponse.json({ ok: false, error: 'MONGODB_URI is not set' }, { status: 503 });
        }
        const message = err instanceof Error ? err.name : 'Error';
        console.error('[db/health]', err);
        return NextResponse.json({ ok: false, error: message }, { status: 502 });
    }
}
