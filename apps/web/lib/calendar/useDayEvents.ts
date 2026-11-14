'use client';

import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { API_URL } from '@/lib/apiClient';
import { readJson, writeJson } from '@/lib/storage';
import { useSettings } from '@/lib/settings/useSettings';
import { tasksBackend } from '@/lib/tasks';
import { dayRange, type CalendarEvent, type EventsResponse } from './model';

type EventsStatus = 'loading' | 'ready' | 'signed_out' | 'reconnect' | 'offline' | 'error';

type Entry = { events?: CalendarEvent[]; status: EventsStatus; fetchedAt?: number };

const SNAPSHOT_KEY = 'cosmic.calendar.cache';
const STALE_MS = 60_000;
const POLL_MS = 5 * 60_000;

let entries: Record<string, Entry> = {};
const listeners = new Set<() => void>();
const inflight = new Map<string, Promise<void>>();
const watched = new Map<string, number>();
let started = false;

function setEntry(date: string, entry: Entry) {
    entries = { ...entries, [date]: entry };
    listeners.forEach((l) => l());
}

type Snapshot = Record<string, { events: CalendarEvent[]; fetchedAt: number }>;

const readSnapshot = () => readJson<Snapshot>(SNAPSHOT_KEY) ?? {};

const writeSnapshot = (date: string, events: CalendarEvent[], fetchedAt: number) =>
    writeJson(SNAPSHOT_KEY, { [date]: { events, fetchedAt } });

function demoEvents(date: string): CalendarEvent[] {
    const { start } = dayRange(date);
    const at = (h: number, m: number) => new Date(start.getFullYear(), start.getMonth(), start.getDate(), h, m);
    const make = (id: string, title: string, location: string, h: number, m: number, minutes: number) => ({
        id,
        calendarId: 'demo',
        calendarName: 'Demo',
        color: undefined,
        title,
        location,
        allDay: false,
        start: at(h, m).toISOString(),
        end: new Date(+at(h, m) + minutes * 60_000).toISOString(),
    });
    return [
        make('demo-1', 'Standup', 'Zoom', 9, 30, 30),
        make('demo-2', 'Lunch with Sam', 'Noodle Bar', 12, 0, 60),
        make('demo-3', 'Climbing', 'Boulder Gym', 18, 0, 90),
    ];
}

async function load(date: string): Promise<void> {
    const prev = entries[date];
    if (tasksBackend === 'demo') {
        setEntry(date, { events: demoEvents(date), status: 'ready', fetchedAt: Date.now() });
        return;
    }
    if (!prev?.events) setEntry(date, { ...prev, status: 'loading' });
    const { start, end } = dayRange(date);
    try {
        const res = await fetch(
            `${API_URL}/api/calendar/events?start=${encodeURIComponent(start.toISOString())}&end=${encodeURIComponent(end.toISOString())}`,
            { credentials: 'include' },
        );
        const body = await res.json().catch(() => ({}));
        if (res.status === 401) return setEntry(date, { status: 'signed_out' });
        if (res.status === 403 && body.error === 'reconnect') return setEntry(date, { status: 'reconnect' });
        if (!res.ok) return setEntry(date, { ...entries[date], status: 'error' });
        const fetchedAt = Date.now();
        setEntry(date, { events: (body as EventsResponse).events, status: 'ready', fetchedAt });
        writeSnapshot(date, (body as EventsResponse).events, fetchedAt);
    } catch {
        setEntry(date, { ...entries[date], status: 'offline' });
    }
}

function refresh(date: string) {
    const running = inflight.get(date);
    if (running) return running;
    const run = load(date).finally(() => inflight.delete(date));
    inflight.set(date, run);
    return run;
}

function refreshWatched() {
    for (const [date, count] of watched) if (count > 0) void refresh(date);
}

function start() {
    if (started) return;
    started = true;
    const snap = readSnapshot();
    for (const [date, { events, fetchedAt }] of Object.entries(snap)) {
        entries = { ...entries, [date]: { events, fetchedAt, status: 'loading' } };
    }
    const visible = () => document.visibilityState === 'visible';
    window.addEventListener('focus', refreshWatched);
    window.addEventListener('online', refreshWatched);
    document.addEventListener('visibilitychange', () => visible() && refreshWatched());
    setInterval(() => visible() && refreshWatched(), POLL_MS);
}

const subscribe = (l: () => void) => {
    listeners.add(l);
    return () => listeners.delete(l);
};
const getSnapshot = () => entries;
const empty: Record<string, Entry> = {};
const getServerSnapshot = () => empty;

export function useDayEvents(date: string | null): Entry {
    const all = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
    useEffect(() => {
        if (!date) return;
        start();
        watched.set(date, (watched.get(date) ?? 0) + 1);
        const entry = entries[date];
        if (!entry?.fetchedAt || entry.status !== 'ready' || Date.now() - entry.fetchedAt > STALE_MS)
            void refresh(date);
        return () => {
            watched.set(date, (watched.get(date) ?? 1) - 1);
        };
    }, [date]);
    const entry = (date && all[date]) || LOADING;
    const { settings } = useSettings();
    const hidden = settings.hiddenCalendars;
    return useMemo(() => {
        if (!entry.events || !hidden.length) return entry;
        const skip = new Set(hidden);
        return { ...entry, events: entry.events.filter((e) => !skip.has(e.calendarId)) };
    }, [entry, hidden]);
}

const LOADING: Entry = { status: 'loading' };

export function useNow(): number | null {
    const now = useSyncExternalStore(subscribeClock, getClock, () => null);
    return now;
}

let clock = 0;
const clockListeners = new Set<() => void>();
let clockTimer: ReturnType<typeof setInterval> | undefined;
function subscribeClock(l: () => void) {
    clockListeners.add(l);
    if (!clockTimer) {
        clock = Date.now();
        clockTimer = setInterval(() => {
            clock = Date.now();
            clockListeners.forEach((fn) => fn());
        }, 30_000);
    }
    return () => {
        clockListeners.delete(l);
        if (!clockListeners.size && clockTimer) {
            clearInterval(clockTimer);
            clockTimer = undefined;
        }
    };
}
const getClock = () => clock || Date.now();
