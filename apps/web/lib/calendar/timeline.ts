import { dayRange, type CalendarEvent } from './model';

export type Placed = {
    event: CalendarEvent;
    /** Minutes after midnight, clipped to the day. */
    start: number;
    end: number;
    /** How many layers deep this event sits on top of earlier ones it overlaps. */
    indent: number;
    /** Position among events that started together at the same depth, which share its width. */
    column: number;
    columns: number;
};

const MIN_MINUTES = 15;
/** Overlapping events that start this close together sit side by side instead of stacking. */
const SIDE_BY_SIDE_MINUTES = 30;

type Row = { start: number; indent: number; members: Placed[] };

/**
 * Lays timed events out for one day the way Google Calendar does. Overlapping events that start
 * within half an hour of each other split the width. An event that starts later than that is
 * drawn on top of the ones it overlaps (later events come later in the list, so they paint over
 * earlier ones), indented one step further than the deepest of them, so
 * the earlier event's title stays visible above it and its left edge peeks out beside it.
 */
export function placeEvents(events: CalendarEvent[], date: string): Placed[] {
    const { start: dayStart, end: dayEnd } = dayRange(date);
    const toMinutes = (ms: number) => (Math.min(Math.max(ms, +dayStart), +dayEnd) - +dayStart) / 60_000;
    const spans: Placed[] = events
        .filter((e) => !e.allDay)
        .map((event) => {
            const start = toMinutes(Date.parse(event.start));
            const end = Math.max(toMinutes(Date.parse(event.end)), start + MIN_MINUTES);
            return { event, start, end, indent: 0, column: 0, columns: 1 };
        })
        .filter((p) => p.start < 24 * 60 && Date.parse(p.event.end) > +dayStart)
        .sort((a, b) => a.start - b.start || b.end - a.end);

    const placed: Placed[] = [];
    const rows: Row[] = [];
    for (const p of spans) {
        const under = placed.filter((q) => q.end > p.start);
        const row = [...rows]
            .reverse()
            .find((r) => p.start - r.start < SIDE_BY_SIDE_MINUTES && r.members.some((m) => m.end > p.start));
        if (row) {
            p.indent = row.indent;
            p.column = row.members.length;
            row.members.push(p);
        } else {
            p.indent = under.length ? Math.max(...under.map((q) => q.indent)) + 1 : 0;
            rows.push({ start: p.start, indent: p.indent, members: [p] });
        }
        placed.push(p);
    }
    for (const row of rows) for (const p of row.members) p.columns = row.members.length;
    return placed;
}

/** The hours to draw: a usual waking day, stretched to fit any event and the current time. */
export function hourBounds(placed: Placed[], nowMinutes: number | null, { from = 8, to = 21 } = {}) {
    let first = from;
    let last = to;
    for (const p of placed) {
        first = Math.min(first, Math.floor(p.start / 60));
        last = Math.max(last, Math.ceil(p.end / 60));
    }
    if (nowMinutes !== null) {
        first = Math.min(first, Math.floor(nowMinutes / 60));
        last = Math.max(last, Math.ceil(nowMinutes / 60));
    }
    return { first: Math.max(0, first), last: Math.min(24, Math.max(last, first + 1)) };
}
