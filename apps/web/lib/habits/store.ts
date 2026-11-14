'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { api as request, loadErrorMessage, usesServer } from '@/lib/apiClient';
import { newId } from '@/lib/id';
import { readJson, removeJson, writeJson } from '@/lib/storage';
import { emitAppEvent } from '@/lib/events';
import type { CheckIn, Habit, HabitInput } from './model';

type HabitsApi = {
    load(): Promise<{ habits: Habit[]; checkins: CheckIn[] }>;
    createHabit(input: HabitInput): Promise<Habit>;
    updateHabit(id: string, input: Partial<HabitInput>): Promise<Habit>;
    deleteHabit(id: string): Promise<void>;
    setDone(habitId: string, periodKey: string, done: boolean): Promise<void>;
};

const KEY = 'cosmic.habits';
const VERSION = 1;
type Stored = { version: number; habits: Habit[]; checkins: CheckIn[] };

const now = () => new Date().toISOString();
function read(): Stored {
    const data = readJson<Stored>(KEY);
    if (data?.version === VERSION && Array.isArray(data.habits) && Array.isArray(data.checkins)) return data;
    return { version: VERSION, habits: [], checkins: [] };
}

const write = (data: Stored) => writeJson(KEY, data);

const clean = (input: Partial<HabitInput>): Partial<HabitInput> => {
    const out: Partial<HabitInput> = { ...input };
    if (input.name !== undefined) out.name = input.name.trim();
    if (input.description !== undefined) out.description = input.description.trim() || undefined;
    return out;
};

const localHabitsApi: HabitsApi = {
    async load() {
        const { habits, checkins } = read();
        return { habits, checkins };
    },
    async createHabit(input) {
        const data = read();
        const stamp = now();
        const habit: Habit = {
            ...(clean(input) as HabitInput),
            id: newId(),
            order: data.habits.reduce((max, h) => Math.max(max, h.order), 0) + 1,
            createdAt: stamp,
            updatedAt: stamp,
        };
        data.habits.push(habit);
        write(data);
        return habit;
    },
    async updateHabit(id, input) {
        const data = read();
        const habit = data.habits.find((h) => h.id === id);
        if (!habit) throw new Error('Habit not found');
        Object.assign(habit, clean(input), { updatedAt: now() });
        write(data);
        return habit;
    },
    async deleteHabit(id) {
        const data = read();
        data.habits = data.habits.filter((h) => h.id !== id);
        data.checkins = data.checkins.filter((c) => c.habitId !== id);
        write(data);
    },
    async setDone(habitId, periodKey, done) {
        const data = read();
        data.checkins = data.checkins.filter((c) => !(c.habitId === habitId && c.periodKey === periodKey));
        if (done) data.checkins.push({ habitId, periodKey, doneAt: now() });
        write(data);
    },
};

const httpHabitsApi: HabitsApi = {
    load: () => request<{ habits: Habit[]; checkins: CheckIn[] }>('/api/habits'),
    createHabit: (input) => request<Habit>('/api/habits', { method: 'POST', body: input }),
    updateHabit: (id, input) =>
        request<Habit>(`/api/habits/${encodeURIComponent(id)}`, { method: 'PATCH', body: input }),
    deleteHabit: (id) => request<void>(`/api/habits/${encodeURIComponent(id)}`, { method: 'DELETE' }),
    setDone: (habitId, periodKey, done) =>
        request<void>(`/api/habits/${encodeURIComponent(habitId)}/done`, {
            method: 'POST',
            body: { periodKey, done },
        }),
};

async function importFromBrowser() {
    const local = read();
    if (!local.habits.length) return;
    await request('/api/habits/import', { method: 'POST', body: { habits: local.habits, checkins: local.checkins } });
    if (writeJson(`${KEY}.imported`, local)) removeJson(KEY);
}

export const habitsSynced = usesServer;
const api: HabitsApi = usesServer ? httpHabitsApi : localHabitsApi;

type State = {
    habits: Habit[];
    checkins: CheckIn[];
    loaded: boolean;
    error: string | null;
};

const initial: State = { habits: [], checkins: [], loaded: false, error: null };
let state = initial;
const listeners = new Set<() => void>();
let loading: Promise<void> | null = null;

function set(next: Partial<State>) {
    state = { ...state, ...next };
    listeners.forEach((l) => l());
}

function load() {
    loading ??= (usesServer ? importFromBrowser() : Promise.resolve())
        .then(() => api.load())
        .then(({ habits, checkins }) => set({ habits, checkins, loaded: true, error: null }))
        .catch((err) => {
            set({ loaded: true, error: loadErrorMessage(err, 'habits') });
            loading = null;
        });
    return loading;
}

async function change<T>(optimistic: (s: State) => Partial<State>, save: () => Promise<T>): Promise<T | undefined> {
    const before = state;
    set({ ...optimistic(state), error: null });
    try {
        return await save();
    } catch {
        set({ habits: before.habits, checkins: before.checkins, error: "That change didn't save. Try again." });
        return undefined;
    }
}

export async function createHabit(input: HabitInput): Promise<Habit | undefined> {
    if (!input.name.trim()) return undefined;
    const habit = await change(
        (s) => s,
        () => api.createHabit(input),
    );
    if (habit) set({ habits: [...state.habits, habit] });
    return habit;
}

export function updateHabit(habit: Habit, input: Partial<HabitInput>) {
    return change(
        (s) => ({ habits: s.habits.map((h) => (h.id === habit.id ? { ...h, ...clean(input) } : h)) }),
        () => api.updateHabit(habit.id, input),
    );
}

export function deleteHabit(habit: Habit) {
    return change(
        (s) => ({
            habits: s.habits.filter((h) => h.id !== habit.id),
            checkins: s.checkins.filter((c) => c.habitId !== habit.id),
        }),
        () => api.deleteHabit(habit.id),
    );
}

export function setHabitDone(habit: Habit, periodKey: string, done: boolean) {
    if (done) emitAppEvent('habit:done', { habitId: habit.id, name: habit.name, periodKey });
    return change(
        (s) => ({
            checkins: [
                ...s.checkins.filter((c) => !(c.habitId === habit.id && c.periodKey === periodKey)),
                ...(done ? [{ habitId: habit.id, periodKey, doneAt: now() }] : []),
            ],
        }),
        () => api.setDone(habit.id, periodKey, done),
    );
}

export const currentHabits = (): Habit[] => state.habits;

export function dismissHabitsError() {
    set({ error: null });
}

const subscribe = (l: () => void) => {
    listeners.add(l);
    return () => listeners.delete(l);
};

export function useHabits(): State {
    const snapshot = useSyncExternalStore(
        subscribe,
        () => state,
        () => initial,
    );
    useEffect(() => {
        void load();
        const onStorage = (e: StorageEvent) => {
            if (e.key !== KEY) return;
            loading = null;
            void load();
        };
        window.addEventListener('storage', onStorage);
        return () => window.removeEventListener('storage', onStorage);
    }, []);
    return snapshot;
}
