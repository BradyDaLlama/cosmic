'use client';

import { useMemo } from 'react';
import { Bubble } from '@bradydallama/ui';
import { AnimatedText } from '@bradydallama/ui/motion';
import { BubbleText, useReveal } from '@/components/today/BubbleText';
import { Pngtuber } from '@/components/today/Pngtuber';
import { WeatherPill } from '@/components/weather/WeatherPill';
import { briefingFacts, useAiBriefing } from '@/lib/ai/useAiBriefing';
import { briefing } from '@/lib/calendar/model';
import { useDayEvents, useNow } from '@/lib/calendar/useDayEvents';
import { addDays } from '@/lib/dates';
import { useHabits } from '@/lib/habits/store';
import { UPCOMING_DAYS, useDueTasks, useToday } from '@/lib/tasks';
import { weatherSentence } from '@/lib/weather/model';
import { useWeather } from '@/lib/weather/useWeather';

const NAME = 'Brady';

const WEATHER_PENDING = new Set(['idle', 'loading', 'locating']);

function greeting(now: number) {
    const hour = new Date(now).getHours();
    if (hour < 5) return 'Good night';
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
}

export function TodayHeader() {
    const now = useNow();
    const today = useToday();
    const { events, status } = useDayEvents(today);
    const { data: weather, status: weatherStatus } = useWeather();
    const due = useDueTasks(today ? addDays(today, UPCOMING_DAYS) : null);
    const habits = useHabits();

    const facts = useMemo(() => {
        const tasks = due.data ?? (due.status === 'loading' ? undefined : []);
        const weatherSettled = weather || !WEATHER_PENDING.has(weatherStatus);
        if (!now || !today || !events || !tasks || !habits.loaded || !weatherSettled) return null;
        return briefingFacts({
            name: NAME,
            now,
            today,
            events,
            tasks,
            habits: habits.habits,
            checkins: habits.checkins,
            weather,
        });
    }, [now, today, events, due.data, due.status, habits, weather, weatherStatus]);
    const ai = useAiBriefing(facts, now);

    const date = now
        ? new Date(now).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })
        : ' ';
    const hello = now ? `${greeting(now)}, ${NAME}` : `Hello, ${NAME}`;

    let summary = 'Getting your day ready…';
    if (now && events) summary = briefing(events, now);
    else if (status === 'signed_out' || status === 'reconnect') summary = 'Connect Google to see your day here.';
    else if (status === 'offline') summary = "You're offline, so your calendar can't load.";
    else if (status === 'error') summary = "Your calendar didn't load. It'll try again shortly.";
    const rain = now && weather ? weatherSentence(weather, now) : null;
    if (rain) summary = `${summary} ${rain}`;
    if (ai.text) summary = ai.text;
    else if (ai.waiting && (status === 'loading' || status === 'ready')) summary = 'Getting your day ready…';

    const reveal = useReveal(summary);

    return (
        <>
            <header className="flex flex-col gap-1">
                <div className="flex items-center justify-between gap-3">
                    <p className="text-xs text-bubble">{date}</p>
                    <WeatherPill />
                </div>
                <h1 className="text-xl text-bubble">
                    <AnimatedText key={hello}>{hello}</AnimatedText>
                </h1>
            </header>

            <div className="flex flex-col items-center justify-center gap-1">
                <Pngtuber talking={reveal.revealing || ai.streaming} className="size-38 self-center" />
                <div className="min-w-0 flex items-center justify-center">
                    <Bubble tail="top-left" className="text-sm">
                        <BubbleText text={reveal.text} count={reveal.count} run={reveal.run} />
                    </Bubble>
                </div>
            </div>
        </>
    );
}
