import { NextResponse } from 'next/server';
import type { EventsResponse, NewEvent } from '@/lib/calendar/model';
import { createEvent, events, hasCalendar } from '@/lib/server/calendar';
import { body, errorResponse, isDate } from '@/lib/server/respond';
import { getSession, type Session } from '@/lib/server/session';
import { TasksError } from '@/lib/tasks/api';

const MAX_RANGE_MS = 1000 * 60 * 60 * 24 * 62;
const MAX_TITLE = 1024;

async function withCalendar(request: Request, handler: (session: Session) => Promise<Response>) {
    const session = await getSession(request);
    if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    if (!hasCalendar(session)) return NextResponse.json({ error: 'reconnect' }, { status: 403 });
    try {
        return await handler(session);
    } catch (err) {
        if (err instanceof TasksError && err.code === 'unauthorized') {
            return NextResponse.json({ error: 'reconnect' }, { status: 403 });
        }
        return errorResponse(err);
    }
}

const isRange = (start: number, end: number) =>
    !isNaN(start) && !isNaN(end) && end > start && end - start <= MAX_RANGE_MS;

export async function GET(request: Request) {
    return withCalendar(request, async (session) => {
        const params = new URL(request.url).searchParams;
        const start = new Date(params.get('start') ?? '');
        const end = new Date(params.get('end') ?? '');
        if (!isRange(+start, +end)) {
            throw new TasksError('invalid', 'start and end must be ISO times, end after start.');
        }
        const result: EventsResponse = { events: await events(session, start, end) };
        return NextResponse.json(result);
    });
}

function parseNewEvent(input: Partial<NewEvent>): NewEvent {
    const title = typeof input.title === 'string' ? input.title.trim() : '';
    const { calendarId, allDay, start, end } = input;
    if (!title || title.length > MAX_TITLE) throw new TasksError('invalid', 'A title is required.');
    if (typeof calendarId !== 'string' || !calendarId) throw new TasksError('invalid', 'Choose a calendar.');
    if (typeof allDay !== 'boolean' || typeof start !== 'string' || typeof end !== 'string') {
        throw new TasksError('invalid', 'allDay, start and end are required.');
    }
    const valid = allDay
        ? isDate(start) && isDate(end) && isRange(Date.parse(start), Date.parse(end))
        : isRange(Date.parse(start), Date.parse(end));
    if (!valid) throw new TasksError('invalid', 'The event must end after it starts.');
    return { calendarId, title, allDay, start, end };
}

export async function POST(request: Request) {
    return withCalendar(request, async (session) => {
        const input = parseNewEvent(await body<Partial<NewEvent>>(request));
        return NextResponse.json({ event: await createEvent(session, input) }, { status: 201 });
    });
}
