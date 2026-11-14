import { NextResponse } from 'next/server';
import { hasCalendar, listCalendars } from '@/lib/server/calendar';
import { errorResponse } from '@/lib/server/respond';
import { getSession } from '@/lib/server/session';
import { TasksError } from '@/lib/tasks/api';

export async function GET(request: Request) {
    const session = await getSession(request);
    if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    if (!hasCalendar(session)) return NextResponse.json({ error: 'reconnect' }, { status: 403 });
    try {
        return NextResponse.json({ calendars: await listCalendars(session) });
    } catch (err) {
        if (err instanceof TasksError && err.code === 'unauthorized') {
            return NextResponse.json({ error: 'reconnect' }, { status: 403 });
        }
        return errorResponse(err);
    }
}
