import { NextResponse } from 'next/server';
import type { EventsResponse } from '@/lib/calendar/model';
import { events, hasCalendar } from '@/lib/server/calendar';
import { errorResponse } from '@/lib/server/respond';
import { getSession } from '@/lib/server/session';
import { TasksError } from '@/lib/tasks/api';

const MAX_RANGE_MS = 1000 * 60 * 60 * 24 * 62;

export async function GET(request: Request) {
    const session = await getSession(request);
    if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    if (!hasCalendar(session)) return NextResponse.json({ error: 'reconnect' }, { status: 403 });

    const params = new URL(request.url).searchParams;
    const start = new Date(params.get('start') ?? '');
    const end = new Date(params.get('end') ?? '');
    if (isNaN(+start) || isNaN(+end) || end <= start || +end - +start > MAX_RANGE_MS) {
        return errorResponse(new TasksError('invalid', 'start and end must be ISO times, end after start.'));
    }

    try {
        const body: EventsResponse = { events: await events(session, start, end) };
        return NextResponse.json(body);
    } catch (err) {
        if (err instanceof TasksError && err.code === 'unauthorized') {
            return NextResponse.json({ error: 'reconnect' }, { status: 403 });
        }
        return errorResponse(err);
    }
}
