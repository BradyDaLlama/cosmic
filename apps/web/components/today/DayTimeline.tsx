'use client';

import type { MouseEvent } from 'react';
import { Card, readableInk } from '@bradydallama/ui';
import type { CalendarEvent } from '@/lib/calendar/model';
import { hourBounds, placeEvents, type Placed } from '@/lib/calendar/timeline';
import { formatClock } from '@/lib/dates';

const HOUR_PX = 56;
const SNAP_MINUTES = 30;
/** Blocks shorter than this show the title only. */
const ROOMY_MINUTES = 45;
/** Past events fade toward the card but stay opaque, so stacked blocks don't show through. */
/** Each layer of stacked events starts this much further right, up to the cap. */
const INDENT_PCT = 10;
const MAX_INDENT_PCT = 40;
const PAST_WASH = 'linear-gradient(rgb(243 242 255 / 0.45), rgb(243 242 255 / 0.45))';

const hourLabel = (hour: number) => formatClock(new Date(2000, 0, 1, hour)).replace(':00', '');

/**
 * The day on an hour scale. Events fill their real slots, overlapping ones stack like Google Calendar, and
 * tapping an open stretch asks for a new event starting there (snapped to the half hour).
 */
export function DayTimeline({
    events,
    date,
    now,
    onPick,
}: {
    events: CalendarEvent[];
    date: string;
    now: number;
    onPick?: (startMinutes: number) => void;
}) {
    const placed = placeEvents(events, date);
    const midnight = new Date(now);
    midnight.setHours(0, 0, 0, 0);
    const nowMinutes = (now - +midnight) / 60_000;
    const { first, last } = hourBounds(placed, nowMinutes);
    const top = (minutes: number) => ((minutes - first * 60) / 60) * HOUR_PX;
    const hours = Array.from({ length: last - first }, (_, i) => first + i);

    const pick = (hour: number) => (e: MouseEvent<HTMLButtonElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();
        // Keyboard clicks report no pointer position, so they start on the hour.
        const half = e.detail > 0 && e.clientY - rect.top >= rect.height / 2 ? SNAP_MINUTES : 0;
        onPick?.(hour * 60 + half);
    };

    return (
        <Card className="bd-in-fade !px-2 !py-3">
            <div className="relative" style={{ height: (last - first) * HOUR_PX }}>
                {hours.map((hour) => (
                    <div
                        key={hour}
                        className="absolute inset-x-0 flex"
                        style={{ top: top(hour * 60), height: HOUR_PX }}
                    >
                        <span className="w-14 shrink-0 -translate-y-2 pr-2 text-right text-xs whitespace-nowrap opacity-60">
                            {hour > first ? hourLabel(hour) : ''}
                        </span>
                        {onPick ? (
                            <button
                                type="button"
                                onClick={pick(hour)}
                                aria-label={`Add an event at ${hourLabel(hour)}`}
                                className="flex-1 rounded-md border-t border-current/15 hover:bg-current/5 focus-visible:bg-current/10"
                            />
                        ) : (
                            <span className="flex-1 border-t border-current/15" />
                        )}
                    </div>
                ))}

                <ol aria-label="Today's events" className="pointer-events-none absolute inset-y-0 right-0 left-14">
                    {placed.map((p) => {
                        const indent = Math.min(p.indent * INDENT_PCT, MAX_INDENT_PCT);
                        const share = (100 - indent) / p.columns;
                        return (
                            <li
                                key={`${p.event.calendarId}:${p.event.id}`}
                                className="pointer-events-auto absolute p-px"
                                style={{
                                    top: top(p.start),
                                    height: ((p.end - p.start) / 60) * HOUR_PX,
                                    left: `${indent + p.column * share}%`,
                                    width: `${share}%`,
                                }}
                            >
                                <Block placed={p} past={Date.parse(p.event.end) <= now} />
                            </li>
                        );
                    })}
                </ol>

                {nowMinutes >= first * 60 && nowMinutes <= last * 60 && (
                    <div
                        aria-label={`Now, ${formatClock(now)}`}
                        role="img"
                        className="pointer-events-none absolute right-0 left-13 flex items-center"
                        style={{ top: top(nowMinutes) - 4 }}
                    >
                        <span className="size-2 shrink-0 rounded-full bg-primary-100" />
                        <span className="h-0.5 flex-1 bg-primary-100" />
                    </div>
                )}
            </div>
        </Card>
    );
}

function Block({ placed, past }: { placed: Placed; past: boolean }) {
    const { event } = placed;
    const fill = event.color ?? 'var(--color-bg)';
    const ink = event.color ? readableInk(event.color) : 'var(--color-bubble)';
    const roomy = placed.end - placed.start >= ROOMY_MINUTES;
    const className = `flex h-full flex-col overflow-hidden rounded-lg border-2 border-bg px-2 py-0.5 text-xs leading-tight ${placed.indent > 0 || placed.column > 0 ? 'ring-2 ring-bubble' : ''}`;
    const label = `${event.title}, ${formatClock(event.start)} to ${formatClock(event.end)}`;
    const content = (
        <>
            <span className="truncate font-semibold">{event.title}</span>
            {roomy && (
                <span className="truncate opacity-80">
                    {formatClock(event.start)} to {formatClock(event.end)}
                    {event.location ? `, ${event.location}` : ''}
                </span>
            )}
        </>
    );
    const style = { background: past ? `${PAST_WASH}, ${fill}` : fill, color: ink };
    if (!event.htmlLink) {
        return (
            <div className={className} style={style} title={label}>
                {content}
            </div>
        );
    }
    return (
        <a
            href={event.htmlLink}
            target="_blank"
            rel="noreferrer"
            aria-label={`${label}, open in Google Calendar`}
            className={className}
            style={style}
        >
            {content}
        </a>
    );
}
