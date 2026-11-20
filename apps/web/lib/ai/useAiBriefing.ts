'use client';

import { useEffect, useRef, useState } from 'react';
import { usesServer } from '@/lib/apiClient';
import { firstFreeWindow, remaining, isHappening, type CalendarEvent } from '@/lib/calendar/model';
import { formatClock, toISODate } from '@/lib/dates';
import { isDone, type CheckIn, type Habit } from '@/lib/habits/model';
import { readJson, writeJson } from '@/lib/storage';
import { readText } from '@/lib/streams';
import { dueGroups, type Task } from '@/lib/tasks';
import { conditionLabel, weatherSentence, type WeatherResponse } from '@/lib/weather/model';
import { briefingKey, type BriefingFacts } from './briefing';

const CACHE_KEY = 'cosmic.ai.briefing';
const OFF_KEY = 'cosmic.ai.off';
const OFF_MS = 15 * 60_000;
const SETTLE_MS = 400;
const GRACE_MS = 2500;

type Inputs = {
    name: string;
    now: number;
    today: string;
    events: CalendarEvent[];
    tasks: Task[];
    habits: Habit[];
    checkins: CheckIn[];
    weather: WeatherResponse | null;
};

export function briefingFacts({ name, now, today, events, tasks, habits, checkins, weather }: Inputs): BriefingFacts {
    const { timed, allDay } = remaining(events, now);
    const span = (e: CalendarEvent) => `${formatClock(e.start)} to ${formatClock(e.end)}`;
    const free = firstFreeWindow(events, now);
    const due = dueGroups(tasks, today);

    return {
        name,
        now: new Date(now).toLocaleString(undefined, { weekday: 'long', hour: 'numeric', minute: '2-digit' }),
        events: [
            ...timed.map((e) => ({
                title: e.title,
                when: span(e),
                location: e.location,
                status: isHappening(e, now) ? ('now' as const) : ('later' as const),
            })),
            ...allDay.map((e) => ({ title: e.title, when: 'all day', status: 'all day' as const })),
        ],
        free: free ? `${formatClock(free.start)} to ${formatClock(free.end)}` : undefined,
        tasks: [
            ...due.overdue.map((t) => ({ title: t.title, overdue: true })),
            ...due.today.filter((t) => !t.done).map((t) => ({ title: t.title, overdue: false })),
        ],
        habits: habits.filter((h) => !isDone(h, checkins, today)).map((h) => ({ name: h.name, period: h.period })),
        weather: weather ? weatherFact(weather, now, today) : undefined,
    };
}

function weatherFact(weather: WeatherResponse, now: number, today: string): string {
    const temps = weather.slots.filter((s) => toISODate(new Date(s.start)) === today).map((s) => s.temp);
    const parts = [`${Math.round(weather.now.temp)}°, ${conditionLabel[weather.now.condition].toLowerCase()}.`];
    if (temps.length && new Date(now).getHours() < 12)
        parts.push(`High ${Math.round(Math.max(...temps))}°, low ${Math.round(Math.min(...temps))}°.`);
    const sentence = weatherSentence(weather, now);
    if (sentence) parts.push(sentence);
    return parts.join(' ');
}

type Briefing = { key: string; text: string; done: boolean };

type Result = { text: string | null; waiting: boolean; streaming: boolean };

const isOff = () => (readJson<number>(OFF_KEY) ?? 0) > Date.now();

const finish = (text: string) => text.trim().replace(/["'”’]+$/, '');

/** `waiting` briefly holds the bubble on open, so the plain briefing isn't shown and then replaced. */
export function useAiBriefing(facts: BriefingFacts | null, now: number | null): Result {
    const key = usesServer && facts && now ? briefingKey(facts, new Date(now)) : null;
    const factsRef = useRef(facts);
    factsRef.current = facts;

    const [latest, setLatest] = useState<Briefing | null>(null);
    const [graceOver, setGraceOver] = useState(false);

    useEffect(() => {
        const id = window.setTimeout(() => setGraceOver(true), GRACE_MS);
        return () => window.clearTimeout(id);
    }, []);

    useEffect(() => {
        if (!key) return;
        const cached = readJson<Briefing>(CACHE_KEY);
        if (cached?.key === key) {
            setLatest({ ...cached, done: true });
            return;
        }
        if (isOff()) return;

        const abort = new AbortController();
        const timer = window.setTimeout(async () => {
            let text = '';
            try {
                const res = await fetch('/api/ai/briefing', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify(factsRef.current),
                    signal: abort.signal,
                });
                if (!res.ok || !res.body) {
                    const body = (await res.json().catch(() => ({}))) as { error?: string };
                    if (res.status === 503 && body.error === 'ai_disabled') writeJson(OFF_KEY, Date.now() + OFF_MS);
                    return;
                }
                for await (const piece of readText(res.body)) {
                    text += piece;
                    setLatest({ key, text, done: false });
                }
                const done = { key, text: finish(text), done: true };
                writeJson(CACHE_KEY, done);
                setLatest(done);
            } catch {
                if (!abort.signal.aborted) setLatest((l) => (l?.key === key && !l.done ? null : l));
            }
        }, SETTLE_MS);

        return () => {
            abort.abort();
            window.clearTimeout(timer);
        };
    }, [key]);

    if (!usesServer) return { text: null, waiting: false, streaming: false };
    if (key && latest?.key === key) return { text: latest.text, waiting: false, streaming: !latest.done };
    const stored = key ? readJson<Briefing>(CACHE_KEY) : null;
    if (stored && stored.key === key) return { text: stored.text, waiting: false, streaming: false };
    if (latest?.done) return { text: latest.text, waiting: false, streaming: false };
    return { text: null, waiting: !graceOver && !isOff(), streaming: false };
}
