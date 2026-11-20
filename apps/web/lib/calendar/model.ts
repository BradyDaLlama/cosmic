import { formatClock } from '@/lib/dates';
export type CalendarEvent = {
    id: string;
    calendarId: string;
    calendarName: string;
    color?: string;
    title: string;
    location?: string;
    allDay: boolean;
    start: string;
    end: string;
    htmlLink?: string;
};

export type EventsResponse = { events: CalendarEvent[] };

export type CalendarInfo = { id: string; name: string; color?: string; primary: boolean; writable: boolean };

/** Timed events carry ISO date-times; all-day events carry dates, with `end` the day after the last day. */
export type NewEvent = { calendarId: string; title: string; allDay: boolean; start: string; end: string };

export function dayRange(date: string): { start: Date; end: Date } {
    const [y, m, d] = date.split('-').map(Number);
    return { start: new Date(y, m - 1, d), end: new Date(y, m - 1, d + 1) };
}

const startMs = (e: CalendarEvent) => (e.allDay ? dayRange(e.start).start : new Date(e.start)).getTime();
const endMs = (e: CalendarEvent) => (e.allDay ? dayRange(e.end).start : new Date(e.end)).getTime();

export function remaining(events: CalendarEvent[], now: number) {
    const timed = events.filter((e) => !e.allDay && endMs(e) > now).sort((a, b) => startMs(a) - startMs(b));
    const allDay = events.filter((e) => e.allDay);
    return { timed, allDay };
}

export const isHappening = (e: CalendarEvent, now: number) => !e.allDay && startMs(e) <= now && endMs(e) > now;

export function firstFreeWindow(
    events: CalendarEvent[],
    now: number,
    { minMinutes = 60, untilHour = 21 } = {},
): { start: number; end: number } | null {
    const limit = new Date(now);
    limit.setHours(untilHour, 0, 0, 0);
    if (now >= limit.getTime()) return null;
    const busy = events
        .filter((e) => !e.allDay)
        .map((e) => [startMs(e), endMs(e)] as const)
        .filter(([, end]) => end > now)
        .sort((a, b) => a[0] - b[0]);
    let cursor = Math.ceil(now / 900_000) * 900_000;
    for (const [start, end] of [...busy, [limit.getTime(), limit.getTime()] as const]) {
        if (start - cursor >= minMinutes * 60_000) return { start: cursor, end: Math.min(start, limit.getTime()) };
        cursor = Math.max(cursor, end);
        if (cursor >= limit.getTime()) break;
    }
    return null;
}

export function briefing(events: CalendarEvent[], now: number): string {
    const { timed } = remaining(events, now);
    const current = timed.find((e) => isHappening(e, now));
    const upcoming = timed.filter((e) => !isHappening(e, now));
    const parts: string[] = [];

    if (current) parts.push(`Now: ${current.title}, until ${formatClock(current.end)}.`);
    if (upcoming.length) {
        const next = upcoming[0];
        const count = upcoming.length === 1 ? '1 more event' : `${upcoming.length} more events`;
        parts.push(`${count} today. Next is ${next.title} at ${formatClock(next.start)}.`);
    } else if (!current) {
        parts.push('Nothing else on your calendar today.');
    }

    const free = firstFreeWindow(events, now);
    if (free && upcoming.length) {
        parts.push(`You're free from ${formatClock(free.start)} to ${formatClock(free.end)}.`);
    }
    return parts.join(' ');
}
