'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { api as request, loadErrorMessage, usesServer } from '@/lib/apiClient';
import { newId } from '@/lib/id';
import { readJson, removeJson, writeJson } from '@/lib/storage';
import type { EntryInput, Goal, GoalEntry, GoalInput } from './model';

type GoalsApi = {
    load(): Promise<{ goals: Goal[]; entries: GoalEntry[] }>;
    createGoal(input: GoalInput): Promise<Goal>;
    updateGoal(id: string, input: Partial<GoalInput>): Promise<Goal>;
    deleteGoal(id: string): Promise<void>;
    addEntry(goalId: string, input: EntryInput): Promise<GoalEntry>;
    deleteEntry(id: string): Promise<void>;
};

const KEY = 'cosmic.goals';
const VERSION = 1;
type Stored = { version: number; goals: Goal[]; entries: GoalEntry[] };

const now = () => new Date().toISOString();
function read(): Stored {
    const data = readJson<Stored>(KEY);
    if (data?.version === VERSION && Array.isArray(data.goals) && Array.isArray(data.entries)) return data;
    return { version: VERSION, goals: [], entries: [] };
}

const write = (data: Stored) => writeJson(KEY, data);

function clean(input: Partial<GoalInput>): Partial<GoalInput> {
    const out: Partial<GoalInput> = { ...input };
    if (input.name !== undefined) out.name = input.name.trim();
    if ('description' in input) out.description = input.description?.trim() || undefined;
    if ('unit' in input) out.unit = input.unit?.trim() || undefined;
    if ('target' in input) out.target = Number.isFinite(input.target) ? input.target : undefined;
    return out;
}

const localGoalsApi: GoalsApi = {
    async load() {
        const { goals, entries } = read();
        return { goals, entries };
    },
    async createGoal(input) {
        const data = read();
        const stamp = now();
        const goal: Goal = {
            ...(clean(input) as GoalInput),
            id: newId(),
            order: data.goals.reduce((max, g) => Math.max(max, g.order), 0) + 1,
            createdAt: stamp,
            updatedAt: stamp,
        };
        data.goals.push(goal);
        write(data);
        return goal;
    },
    async updateGoal(id, input) {
        const data = read();
        const goal = data.goals.find((g) => g.id === id);
        if (!goal) throw new Error('Goal not found');
        Object.assign(goal, clean(input), { updatedAt: now() });
        write(data);
        return goal;
    },
    async deleteGoal(id) {
        const data = read();
        data.goals = data.goals.filter((g) => g.id !== id);
        data.entries = data.entries.filter((e) => e.goalId !== id);
        write(data);
    },
    async addEntry(goalId, input) {
        const data = read();
        const entry: GoalEntry = {
            id: newId(),
            goalId,
            date: input.date,
            value: input.value,
            note: input.note?.trim() || undefined,
            createdAt: now(),
        };
        data.entries.push(entry);
        write(data);
        return entry;
    },
    async deleteEntry(id) {
        const data = read();
        data.entries = data.entries.filter((e) => e.id !== id);
        write(data);
    },
};

const httpGoalsApi: GoalsApi = {
    load: () => request<{ goals: Goal[]; entries: GoalEntry[] }>('/api/goals'),
    createGoal: (input) => request<Goal>('/api/goals', { method: 'POST', body: input }),
    updateGoal: (id, input) =>
        request<Goal>(`/api/goals/${encodeURIComponent(id)}`, {
            method: 'PATCH',
            // JSON drops `undefined`, so a removed target is sent as `null`.
            body: 'target' in input && input.target === undefined ? { ...input, target: null } : input,
        }),
    deleteGoal: (id) => request<void>(`/api/goals/${encodeURIComponent(id)}`, { method: 'DELETE' }),
    addEntry: (goalId, input) =>
        request<GoalEntry>(`/api/goals/${encodeURIComponent(goalId)}/entries`, { method: 'POST', body: input }),
    deleteEntry: (id) => request<void>(`/api/goals/entries/${encodeURIComponent(id)}`, { method: 'DELETE' }),
};

async function importFromBrowser() {
    const local = read();
    if (!local.goals.length) return;
    await request('/api/goals/import', { method: 'POST', body: { goals: local.goals, entries: local.entries } });
    if (writeJson(`${KEY}.imported`, local)) removeJson(KEY);
}

export const goalsSynced = usesServer;
const api: GoalsApi = usesServer ? httpGoalsApi : localGoalsApi;

type State = { goals: Goal[]; entries: GoalEntry[]; loaded: boolean; error: string | null };
const initial: State = { goals: [], entries: [], loaded: false, error: null };
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
        .then(({ goals, entries }) => set({ goals, entries, loaded: true, error: null }))
        .catch((err) => {
            set({ loaded: true, error: loadErrorMessage(err, 'goals') });
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
        set({ goals: before.goals, entries: before.entries, error: "That change didn't save. Try again." });
        return undefined;
    }
}

export async function createGoal(input: GoalInput): Promise<Goal | undefined> {
    if (!input.name.trim()) return undefined;
    const goal = await change(
        (s) => s,
        () => api.createGoal(input),
    );
    if (goal) set({ goals: [...state.goals, goal] });
    return goal;
}

export function updateGoal(goal: Goal, input: Partial<GoalInput>) {
    return change(
        (s) => ({ goals: s.goals.map((g) => (g.id === goal.id ? { ...g, ...clean(input) } : g)) }),
        () => api.updateGoal(goal.id, input),
    );
}

export function deleteGoal(goal: Goal) {
    return change(
        (s) => ({
            goals: s.goals.filter((g) => g.id !== goal.id),
            entries: s.entries.filter((e) => e.goalId !== goal.id),
        }),
        () => api.deleteGoal(goal.id),
    );
}

export async function addEntry(goal: Goal, input: EntryInput): Promise<GoalEntry | undefined> {
    if (!Number.isFinite(input.value)) return undefined;
    const entry = await change(
        (s) => s,
        () => api.addEntry(goal.id, input),
    );
    if (entry) set({ entries: [...state.entries, entry] });
    return entry;
}

export function deleteEntry(entry: GoalEntry) {
    return change(
        (s) => ({ entries: s.entries.filter((e) => e.id !== entry.id) }),
        () => api.deleteEntry(entry.id),
    );
}

export function dismissGoalsError() {
    set({ error: null });
}

const subscribe = (l: () => void) => {
    listeners.add(l);
    return () => listeners.delete(l);
};

export function useGoals(): State {
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
