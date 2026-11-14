import type { CalendarEvent, CalendarInfo } from '@/lib/calendar/model';
import { CALENDAR_EVENTS_SCOPE, CALENDAR_LIST_SCOPE, googleFetch } from './google';
import type { Session } from './session';

const CALENDAR_URL = 'https://www.googleapis.com/calendar/v3';

type GCalendar = {
    id: string;
    summary: string;
    summaryOverride?: string;
    backgroundColor?: string;
    selected?: boolean;
    hidden?: boolean;
    primary?: boolean;
};

type GEventTime = { date?: string; dateTime?: string };
type GEvent = {
    id: string;
    status?: 'confirmed' | 'tentative' | 'cancelled';
    summary?: string;
    location?: string;
    start: GEventTime;
    end: GEventTime;
    htmlLink?: string;
    eventType?: string;
    attendees?: { self?: boolean; responseStatus?: string }[];
};

type Page<T> = { items?: T[]; nextPageToken?: string };

const q = encodeURIComponent;

export const hasCalendar = (session: Session) => !!session.scopes?.includes(CALENDAR_EVENTS_SCOPE);

async function calendars(session: Session): Promise<GCalendar[]> {
    if (!session.scopes?.includes(CALENDAR_LIST_SCOPE)) {
        return [{ id: 'primary', summary: 'Calendar', primary: true }];
    }
    const items: GCalendar[] = [];
    let pageToken: string | undefined;
    do {
        const page = await googleFetch<Page<GCalendar>>(
            session,
            `${CALENDAR_URL}/users/me/calendarList?minAccessRole=reader&maxResults=250${pageToken ? `&pageToken=${q(pageToken)}` : ''}`,
        );
        items.push(...(page.items ?? []));
        pageToken = page.nextPageToken;
    } while (pageToken);
    return items.filter((c) => c.primary || (c.selected && !c.hidden));
}

function keep(e: GEvent): boolean {
    if (e.status === 'cancelled') return false;
    if (e.eventType === 'workingLocation') return false;
    if (e.attendees?.find((a) => a.self)?.responseStatus === 'declined') return false;
    return !!(e.start.date || e.start.dateTime);
}

function toEvent(e: GEvent, calendar: GCalendar): CalendarEvent {
    const allDay = !!e.start.date;
    return {
        id: e.id,
        calendarId: calendar.id,
        calendarName: calendar.summaryOverride ?? calendar.summary,
        color: calendar.backgroundColor,
        title: e.summary?.trim() || '(No title)',
        location: e.location?.trim() || undefined,
        allDay,
        start: (allDay ? e.start.date : e.start.dateTime)!,
        end: (allDay ? e.end.date : e.end.dateTime) ?? (allDay ? e.start.date : e.start.dateTime)!,
        htmlLink: e.htmlLink,
    };
}

export async function listCalendars(session: Session): Promise<CalendarInfo[]> {
    const list = await calendars(session);
    return list
        .map((c) => ({
            id: c.id,
            name: c.summaryOverride ?? c.summary,
            color: c.backgroundColor,
            primary: !!c.primary,
        }))
        .sort((a, b) => Number(b.primary) - Number(a.primary) || a.name.localeCompare(b.name));
}

export async function events(session: Session, start: Date, end: Date): Promise<CalendarEvent[]> {
    const list = await calendars(session);
    const params = new URLSearchParams({
        timeMin: start.toISOString(),
        timeMax: end.toISOString(),
        singleEvents: 'true',
        orderBy: 'startTime',
        maxResults: '250',
    });
    const perCalendar = await Promise.all(
        list.map(async (calendar) => {
            const page = await googleFetch<Page<GEvent>>(
                session,
                `${CALENDAR_URL}/calendars/${q(calendar.id)}/events?${params}`,
            );
            return (page.items ?? []).filter(keep).map((e) => toEvent(e, calendar));
        }),
    );
    return perCalendar.flat();
}
