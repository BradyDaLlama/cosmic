import { NextResponse } from 'next/server';
import { DatabaseNotConfigured, settingsCollection, type SettingsDoc } from '@/lib/server/db';
import { getSession } from '@/lib/server/session';

type Settings = { hiddenCalendars: string[]; defaultTaskList: string | null };

const DEFAULTS: Settings = { hiddenCalendars: [], defaultTaskList: null };

const toSettings = (doc: SettingsDoc | null): Settings => ({
    hiddenCalendars: doc?.hiddenCalendars ?? DEFAULTS.hiddenCalendars,
    defaultTaskList: doc?.defaultTaskList ?? DEFAULTS.defaultTaskList,
});

function failure(err: unknown) {
    if (err instanceof DatabaseNotConfigured) return NextResponse.json({ error: 'no_database' }, { status: 503 });
    console.error('[settings]', err);
    return NextResponse.json({ error: 'database' }, { status: 502 });
}

export async function GET(request: Request) {
    const session = await getSession(request);
    if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    try {
        const settings = await settingsCollection();
        return NextResponse.json(toSettings(await settings.findOne({ _id: session.email.toLowerCase() })));
    } catch (err) {
        return failure(err);
    }
}

export async function PATCH(request: Request) {
    const session = await getSession(request);
    if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

    const body = (await request.json().catch(() => null)) as Partial<Settings> | null;
    const update: Partial<Omit<SettingsDoc, '_id'>> = {};
    if (body && 'hiddenCalendars' in body) {
        const ids = body.hiddenCalendars;
        if (!Array.isArray(ids) || !ids.every((id) => typeof id === 'string') || ids.length > 500) {
            return NextResponse.json({ error: 'invalid' }, { status: 400 });
        }
        update.hiddenCalendars = [...new Set(ids)];
    }
    let clearDefault = false;
    if (body && 'defaultTaskList' in body) {
        if (body.defaultTaskList === null) clearDefault = true;
        else if (typeof body.defaultTaskList === 'string' && body.defaultTaskList) {
            update.defaultTaskList = body.defaultTaskList;
        } else return NextResponse.json({ error: 'invalid' }, { status: 400 });
    }
    if (!Object.keys(update).length && !clearDefault) return NextResponse.json({ error: 'invalid' }, { status: 400 });

    try {
        const settings = await settingsCollection();
        const doc = await settings.findOneAndUpdate(
            { _id: session.email.toLowerCase() },
            {
                $set: { ...update, updatedAt: new Date() },
                ...(clearDefault ? { $unset: { defaultTaskList: '' as const } } : {}),
                $setOnInsert: update.hiddenCalendars ? {} : { hiddenCalendars: [] },
            },
            { upsert: true, returnDocument: 'after' },
        );
        return NextResponse.json(toSettings(doc));
    } catch (err) {
        return failure(err);
    }
}
