'use client';

import { useState } from 'react';
import { Button, Card, Icon, Pill, stagger } from '@bradydallama/ui';
import { connectGoogle } from '@/lib/native';
import { isHappening, remaining, type CalendarEvent } from '@/lib/calendar/model';
import { useDayEvents, useNow } from '@/lib/calendar/useDayEvents';
import { formatClock } from '@/lib/dates';
import { useToday } from '@/lib/tasks';
import {
    changeIcon,
    changeLabel,
    weatherChanges,
    whenLabel,
    type WeatherChange,
    type WeatherResponse,
} from '@/lib/weather/model';
import { useWeather } from '@/lib/weather/useWeather';
import { useSettings } from '@/lib/settings/useSettings';
import { CalendarsSheet } from './CalendarsSheet';

const STAGGER_FROM = 2;

export function UpNext() {
    const now = useNow();
    const today = useToday();
    const { events, status, fetchedAt } = useDayEvents(today);
    const { data: weather } = useWeather();
    const { canEdit, settings } = useSettings();
    const [choosing, setChoosing] = useState(false);
    const hiddenCount = settings.hiddenCalendars.length;

    return (
        <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
                <h2 className="text-md text-bubble">Up next</h2>
                <span className="flex items-center gap-2">
                    {status === 'offline' && fetchedAt && (
                        <span className="text-xs text-bubble opacity-70">offline, from {formatClock(fetchedAt)}</span>
                    )}
                    {canEdit && status !== 'signed_out' && status !== 'reconnect' && (
                        <button
                            type="button"
                            onClick={() => setChoosing(true)}
                            aria-haspopup="dialog"
                            className="flex items-center gap-1 text-xs text-bubble underline underline-offset-4"
                        >
                            <Icon name="gear-1" size="xs" />
                            Calendars{hiddenCount > 0 ? ` (${hiddenCount} hidden)` : ''}
                        </button>
                    )}
                </span>
            </div>
            <CalendarsSheet open={choosing} onClose={() => setChoosing(false)} />
            <Body events={events} status={status} now={now} weather={weather} />
        </section>
    );
}

function Body({
    events,
    status,
    now,
    weather,
}: {
    events?: CalendarEvent[];
    status: string;
    now: number | null;
    weather: WeatherResponse | null;
}) {
    if (status === 'signed_out' || status === 'reconnect') {
        return (
            <Card className="flex flex-col items-start gap-3">
                <p className="text-sm">
                    {status === 'reconnect'
                        ? 'Reconnect Google to let Cosmic see your calendar.'
                        : 'Connect Google to see your calendar.'}
                </p>
                <Button icon="link" onClick={connectGoogle}>
                    {status === 'reconnect' ? 'Reconnect Google' : 'Connect Google'}
                </Button>
            </Card>
        );
    }
    if (!events || !now) {
        if (status === 'error' || status === 'offline') {
            return <Card className="text-sm opacity-80">Couldn't load your calendar.</Card>;
        }
        return (
            <Card aria-hidden className="flex items-center gap-3">
                <span className="h-7 w-20 rounded-full bg-current opacity-15" />
                <span className="h-3 flex-1 rounded-full bg-current opacity-15" />
            </Card>
        );
    }

    const { timed, allDay } = remaining(events, now);
    const changes = weather ? weatherChanges(weather.slots, now) : [];
    const items: Item[] = [
        ...timed.map((event): Item => ({ kind: 'event', at: Date.parse(event.start), event })),
        ...changes.map((change): Item => ({ kind: 'weather', at: change.at, change })),
    ].sort((a, b) => a.at - b.at);

    return (
        <>
            {allDay.length > 0 && (
                <ul className="flex flex-wrap gap-2" aria-label="All-day events">
                    {allDay.map((e) => (
                        <li key={`${e.calendarId}:${e.id}`}>
                            <Pill tone="bubble" className="text-xs">
                                <Dot color={e.color} />
                                {e.title}
                            </Pill>
                        </li>
                    ))}
                </ul>
            )}
            {timed.length === 0 && <Card className="text-sm opacity-80">Nothing else on your calendar today.</Card>}
            {items.length > 0 && (
                <ul className="flex flex-col gap-3">
                    {items.map((item, i) =>
                        item.kind === 'event' ? (
                            <li key={`${item.event.calendarId}:${item.event.id}`}>
                                <EventCard event={item.event} now={now} index={i} />
                            </li>
                        ) : (
                            <li key={`weather:${item.at}`}>
                                <WeatherChangePill change={item.change} now={now} />
                            </li>
                        ),
                    )}
                </ul>
            )}
        </>
    );
}

type Item =
    { kind: 'event'; at: number; event: CalendarEvent } | { kind: 'weather'; at: number; change: WeatherChange };

function WeatherChangePill({ change, now }: { change: WeatherChange; now: number }) {
    return (
        <Pill tone="primary" icon={changeIcon(change)} className="bd-in-fade text-sm">
            {changeLabel(change)} around {whenLabel(change.at, now)}
        </Pill>
    );
}

function EventCard({ event, now, index }: { event: CalendarEvent; now: number; index: number }) {
    const happening = isHappening(event, now);
    const content = (
        <Card interactive className="bd-in-fade flex items-center gap-3" style={stagger(index + STAGGER_FROM)}>
            <Pill tone={happening ? 'primary' : 'outline'} className="shrink-0">
                {happening ? 'Now' : formatClock(event.start)}
            </Pill>
            <div className="flex min-w-0 flex-1 flex-col">
                <span className="flex items-center gap-2 truncate">
                    <Dot color={event.color} />
                    <span className="truncate">{event.title}</span>
                </span>
                {event.location ? (
                    <span className="flex items-center gap-1 truncate text-xs opacity-70">
                        <Icon name="location" size="xs" /> {event.location}
                    </span>
                ) : (
                    <span className="text-xs opacity-70">
                        {happening
                            ? `Until ${formatClock(event.end)}`
                            : `${formatClock(event.start)} to ${formatClock(event.end)}`}
                    </span>
                )}
            </div>
        </Card>
    );
    if (!event.htmlLink) return content;
    return (
        <a
            href={event.htmlLink}
            target="_blank"
            rel="noreferrer"
            aria-label={`${event.title}, open in Google Calendar`}
        >
            {content}
        </a>
    );
}

function Dot({ color }: { color?: string }) {
    if (!color) return null;
    return <span aria-hidden className="inline-block size-2 shrink-0 rounded-full" style={{ background: color }} />;
}
