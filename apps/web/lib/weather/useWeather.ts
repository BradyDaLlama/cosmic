'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { readJson, writeJson } from '@/lib/storage';
import type { WeatherResponse } from './model';

type WeatherStatus = 'idle' | 'needs_location' | 'locating' | 'loading' | 'ready' | 'denied' | 'error';

type State = { status: WeatherStatus; data: WeatherResponse | null };
type Coords = { lat: number; lon: number };

const COORDS_KEY = 'cosmic.weather.coords';
const CACHE_KEY = 'cosmic.weather.cache';
const STALE_MS = 30 * 60_000;

let state: State = { status: 'idle', data: null };
const initial: State = state;
const listeners = new Set<() => void>();
let started = false;
let inflight: Promise<void> | null = null;

function set(next: Partial<State>) {
    state = { ...state, ...next };
    listeners.forEach((l) => l());
}

async function load(coords: Coords) {
    if (inflight) return inflight;
    if (!state.data) set({ status: 'loading' });
    inflight = (async () => {
        try {
            const res = await fetch(`/api/weather?lat=${coords.lat}&lon=${coords.lon}`);
            if (!res.ok) throw new Error(String(res.status));
            const data = (await res.json()) as WeatherResponse;
            set({ status: 'ready', data });
            writeJson(CACHE_KEY, data);
        } catch {
            set({ status: state.data ? 'ready' : 'error' });
        } finally {
            inflight = null;
        }
    })();
    return inflight;
}

function locate(): Promise<void> {
    return new Promise((resolve) => {
        if (!('geolocation' in navigator)) {
            set({ status: state.data ? 'ready' : 'denied' });
            return resolve();
        }
        if (!state.data) set({ status: 'locating' });
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const coords = {
                    lat: Math.round(pos.coords.latitude * 100) / 100,
                    lon: Math.round(pos.coords.longitude * 100) / 100,
                };
                writeJson(COORDS_KEY, coords);
                void load(coords).then(resolve);
            },
            () => {
                const saved = readJson<Coords>(COORDS_KEY);
                if (saved) void load(saved).then(resolve);
                else {
                    set({ status: 'denied' });
                    resolve();
                }
            },
            { enableHighAccuracy: false, maximumAge: STALE_MS, timeout: 15_000 },
        );
    });
}

async function permission(): Promise<PermissionState | 'unknown'> {
    try {
        return (await navigator.permissions.query({ name: 'geolocation' })).state;
    } catch {
        return 'unknown';
    }
}

async function refresh() {
    const saved = readJson<Coords>(COORDS_KEY);
    const perm = await permission();
    if (perm === 'granted') return locate();
    if (saved) return load(saved);
    set({ status: perm === 'denied' ? 'denied' : 'needs_location' });
}

function start() {
    if (started) return;
    started = true;
    const cached = readJson<WeatherResponse>(CACHE_KEY);
    if (cached?.slots?.length) set({ status: 'ready', data: cached });
    if (!cached || Date.now() - cached.fetchedAt > STALE_MS) void refresh();
    const maybeRefresh = () => {
        if (document.visibilityState !== 'visible') return;
        if (!state.data || Date.now() - state.data.fetchedAt > STALE_MS) void refresh();
    };
    window.addEventListener('focus', maybeRefresh);
    document.addEventListener('visibilitychange', maybeRefresh);
    setInterval(maybeRefresh, 5 * 60_000);
}

const subscribe = (l: () => void) => {
    listeners.add(l);
    return () => listeners.delete(l);
};

export function useWeather(): State & { requestLocation: () => Promise<void> } {
    const snapshot = useSyncExternalStore(
        subscribe,
        () => state,
        () => initial,
    );
    useEffect(() => start(), []);
    return { ...snapshot, requestLocation: locate };
}
