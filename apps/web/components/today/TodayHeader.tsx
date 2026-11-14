'use client';

import { useEffect, useState } from 'react';
import { Bubble } from '@bradydallama/ui';
import { AnimatedText } from '@bradydallama/ui/motion';
import { Pngtuber } from '@/components/today/Pngtuber';
import { WeatherPill } from '@/components/weather/WeatherPill';
import { briefing } from '@/lib/calendar/model';
import { useDayEvents, useNow } from '@/lib/calendar/useDayEvents';
import { useToday } from '@/lib/tasks';
import { weatherSentence } from '@/lib/weather/model';
import { useWeather } from '@/lib/weather/useWeather';

const NAME = 'Brady';

const TYPE_MS = 28;

function greeting(now: number) {
    const hour = new Date(now).getHours();
    if (hour < 5) return 'Good night';
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
}

function useTypewriter(text: string) {
    const [shown, setShown] = useState({ text, count: 0 });
    if (shown.text !== text) setShown({ text, count: 0 });
    const count = shown.text === text ? shown.count : 0;

    useEffect(() => {
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            setShown({ text, count: text.length });
            return;
        }
        const id = window.setInterval(() => {
            setShown((s) => {
                if (s.text !== text || s.count >= text.length) {
                    window.clearInterval(id);
                    return s;
                }
                return { text, count: s.count + 1 };
            });
        }, TYPE_MS);
        return () => window.clearInterval(id);
    }, [text]);

    return { typed: text.slice(0, count), typing: count < text.length };
}

export function TodayHeader() {
    const now = useNow();
    const today = useToday();
    const { events, status } = useDayEvents(today);
    const { data: weather } = useWeather();

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

    const { typed, typing } = useTypewriter(summary);

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
                <Pngtuber talking={typing} className="size-38 self-center" />
                <div className="min-w-0 flex items-center justify-center">
                    <Bubble tail="top-left" className="text-sm">
                        <span className="sr-only">{summary}</span>
                        <span aria-hidden className="grid">
                            <span className="invisible col-start-1 row-start-1">{summary}</span>
                            <span className="col-start-1 row-start-1">{typed}</span>
                        </span>
                    </Bubble>
                </div>
            </div>
        </>
    );
}
