'use client';

import { useEffect, useRef, useState } from 'react';
import { Button, Dialog, Input, Switch } from '@bradydallama/ui';
import { api, ApiError } from '@/lib/apiClient';
import type { CalendarInfo, NewEvent } from '@/lib/calendar/model';
import { createEvent, DEMO_CALENDARS } from '@/lib/calendar/useDayEvents';
import { addDays, fromISODate, pad2 } from '@/lib/dates';
import { tasksBackend } from '@/lib/tasks';

/** Where a new event starts: a day, and optionally minutes after midnight. */
export type EventDraft = { date: string; startMinutes?: number };

const DEFAULT_MINUTES = 60;
const DAY_MINUTES = 24 * 60;

const toClock = (minutes: number) => `${pad2(Math.floor(minutes / 60))}:${pad2(minutes % 60)}`;
const fromClock = (clock: string) => {
    const [h, m] = clock.split(':').map(Number);
    return isNaN(h) || isNaN(m) ? null : h * 60 + m;
};

/** The next half hour from now, kept inside the day. */
function nextHalfHour() {
    const now = new Date();
    return Math.min(Math.ceil((now.getHours() * 60 + now.getMinutes() + 1) / 30) * 30, DAY_MINUTES - DEFAULT_MINUTES);
}

function localISO(date: string, minutes: number) {
    const day = fromISODate(date);
    day.setMinutes(minutes);
    return day.toISOString();
}

function problemFor(err: unknown) {
    if (err instanceof ApiError) {
        if (err.status === 0) return "You're offline, so the event wasn't added.";
        if (err.status === 403) return 'Reconnect Google to add events.';
        if (err.status === 404) return "That calendar isn't available anymore.";
    }
    return "Google Calendar didn't take the event. Try again.";
}

export function EventEditor({ draft, onClose }: { draft: EventDraft | null; onClose: () => void }) {
    const open = !!draft;
    const [title, setTitle] = useState('');
    const [date, setDate] = useState('');
    const [allDay, setAllDay] = useState(false);
    const [start, setStart] = useState('09:00');
    const [end, setEnd] = useState('10:00');
    const [calendars, setCalendars] = useState<CalendarInfo[] | null>(null);
    const [calendarId, setCalendarId] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [problem, setProblem] = useState<string | null>(null);
    const titleRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!draft) return;
        const from = draft.startMinutes ?? nextHalfHour();
        setTitle('');
        setDate(draft.date);
        setAllDay(false);
        setStart(toClock(from));
        setEnd(toClock(Math.min(from + DEFAULT_MINUTES, DAY_MINUTES - 1)));
        setProblem(null);
        setSaving(false);
        requestAnimationFrame(() => titleRef.current?.focus());
    }, [draft]);

    useEffect(() => {
        if (!open || calendars) return;
        const pick = (list: CalendarInfo[]) => {
            const writable = list.filter((c) => c.writable);
            setCalendars(writable);
            setCalendarId((id) => id ?? (writable.find((c) => c.primary) ?? writable[0])?.id ?? null);
        };
        if (tasksBackend === 'demo') return pick(DEMO_CALENDARS);
        api<{ calendars: CalendarInfo[] }>('/api/calendar/calendars')
            .then((r) => pick(r.calendars))
            .catch((err) => setProblem(problemFor(err)));
    }, [open, calendars]);

    const startMin = fromClock(start);
    const endMin = fromClock(end);
    const timesOk = allDay || (startMin !== null && endMin !== null && endMin > startMin);
    const canSave = !saving && title.trim() !== '' && !!date && !!calendarId && timesOk;

    /** Moving the start keeps the event's length, like Google Calendar does. */
    const changeStart = (value: string) => {
        const next = fromClock(value);
        if (next !== null && startMin !== null && endMin !== null && endMin > startMin) {
            setEnd(toClock(Math.min(next + (endMin - startMin), DAY_MINUTES - 1)));
        }
        setStart(value);
    };

    const save = async () => {
        if (!canSave) return;
        const input: NewEvent = allDay
            ? { calendarId: calendarId!, title: title.trim(), allDay, start: date, end: addDays(date, 1) }
            : {
                  calendarId: calendarId!,
                  title: title.trim(),
                  allDay,
                  start: localISO(date, startMin!),
                  end: localISO(date, endMin!),
              };
        setSaving(true);
        setProblem(null);
        try {
            await createEvent(input);
            onClose();
        } catch (err) {
            setProblem(problemFor(err));
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onClose={onClose} variant="sheet" title="New event">
            <form
                className="flex flex-col gap-4"
                onSubmit={(e) => {
                    e.preventDefault();
                    void save();
                }}
            >
                <Input
                    ref={titleRef}
                    label="Title"
                    placeholder="Coffee with Alex"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                />
                <Input label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                <Switch label="All day" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} />
                {!allDay && (
                    <div className="flex flex-col gap-1">
                        <div className="flex gap-2">
                            <Input
                                label="Starts"
                                type="time"
                                step={300}
                                value={start}
                                onChange={(e) => changeStart(e.target.value)}
                                className="min-w-0 flex-1"
                            />
                            <Input
                                label="Ends"
                                type="time"
                                step={300}
                                value={end}
                                onChange={(e) => setEnd(e.target.value)}
                                className="min-w-0 flex-1"
                            />
                        </div>
                        {!timesOk && <p className="text-xs">The event needs to end after it starts.</p>}
                    </div>
                )}

                <fieldset className="flex flex-col gap-2">
                    <legend className="bd-field-label pb-2">Calendar</legend>
                    {!calendars && !problem && <p className="text-sm opacity-70">Loading your calendars…</p>}
                    {calendars?.length === 0 && (
                        <p className="text-sm opacity-80">None of your calendars accept new events.</p>
                    )}
                    {calendars && calendars.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                            {calendars.map((c) => (
                                <Button
                                    key={c.id}
                                    type="button"
                                    size="sm"
                                    variant={calendarId === c.id ? 'primary' : 'ghost'}
                                    aria-pressed={calendarId === c.id}
                                    onClick={() => setCalendarId(c.id)}
                                >
                                    <span className="flex items-center gap-2">
                                        {c.color && (
                                            <span
                                                aria-hidden
                                                className="size-2.5 shrink-0 rounded-full"
                                                style={{ background: c.color }}
                                            />
                                        )}
                                        {c.name}
                                    </span>
                                </Button>
                            ))}
                        </div>
                    )}
                </fieldset>

                {problem && (
                    <p role="alert" className="text-sm">
                        {problem}
                    </p>
                )}

                <div className="flex justify-end pt-1">
                    <Button type="submit" disabled={!canSave}>
                        {saving ? 'Adding…' : 'Add event'}
                    </Button>
                </div>
            </form>
        </Dialog>
    );
}
