'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { api, usesServer } from '@/lib/apiClient';

export type Settings = { hiddenCalendars: string[]; defaultTaskList: string | null };

type State = { settings: Settings; loaded: boolean; error: string | null };

const DEFAULTS: Settings = { hiddenCalendars: [], defaultTaskList: null };
const initial: State = { settings: DEFAULTS, loaded: false, error: null };
let state = initial;
const listeners = new Set<() => void>();
let loading: Promise<void> | null = null;

function set(next: Partial<State>) {
    state = { ...state, ...next };
    listeners.forEach((l) => l());
}

function load() {
    if (!usesServer) {
        if (!state.loaded) set({ loaded: true });
        return Promise.resolve();
    }
    loading ??= api<Settings>('/api/settings')
        .then((settings) => set({ settings, loaded: true, error: null }))
        .catch(() => {
            set({ loaded: true });
            loading = null;
        });
    return loading;
}

async function updateSettings(patch: Partial<Settings>): Promise<void> {
    if (!usesServer) return;
    const before = state.settings;
    set({ settings: { ...before, ...patch }, error: null });
    try {
        const saved = await api<Settings>('/api/settings', { method: 'PATCH', body: patch });
        set({ settings: saved });
    } catch {
        set({ settings: before, error: "That setting didn't save. Try again." });
    }
}

export function setCalendarHidden(id: string, hidden: boolean) {
    const current = new Set(state.settings.hiddenCalendars);
    if (hidden) current.add(id);
    else current.delete(id);
    return updateSettings({ hiddenCalendars: [...current] });
}

const subscribe = (l: () => void) => {
    listeners.add(l);
    return () => listeners.delete(l);
};

export function useSettings(): State & { canEdit: boolean } {
    const snapshot = useSyncExternalStore(
        subscribe,
        () => state,
        () => initial,
    );
    useEffect(() => {
        void load();
    }, []);
    return { ...snapshot, canEdit: usesServer };
}
