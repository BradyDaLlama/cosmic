'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { api as request, loadErrorMessage, usesServer } from '@/lib/apiClient';
import { periodKey } from '@/lib/habits/model';
import { newId } from '@/lib/id';
import { readJson, writeJson } from '@/lib/storage';
import { currentHabits, setHabitDone } from '@/lib/habits/store';
import {
    emptyRun,
    finish,
    settleWaits,
    skipWait as skipWaitStep,
    toggleTask,
    type Routine,
    type RoutineInput,
    type RoutineRun,
} from './model';

type RoutinesApi = {
    load(date: string): Promise<{ routines: Routine[]; runs: RoutineRun[] }>;
    createRoutine(input: RoutineInput): Promise<Routine>;
    updateRoutine(id: string, input: Partial<RoutineInput>): Promise<Routine>;
    deleteRoutine(id: string): Promise<void>;
    saveRun(run: RoutineRun): Promise<void>;
    resetRun(routineId: string, date: string): Promise<void>;
};

const KEY = 'cosmic.routines';
type Stored = { version: 1; routines: Routine[]; runs: RoutineRun[] };
function read(): Stored {
    const data = readJson<Stored>(KEY);
    return data?.version === 1 ? data : { version: 1, routines: [], runs: [] };
}
const write = (data: Stored) => writeJson(KEY, data);

const localApi: RoutinesApi = {
    async load(date) {
        const d = read();
        return { routines: d.routines, runs: d.runs.filter((r) => r.date === date) };
    },
    async createRoutine(input) {
        const d = read();
        const stamp = new Date().toISOString();
        const routine: Routine = {
            ...input,
            name: input.name.trim(),
            id: newId(),
            order: d.routines.reduce((m, r) => Math.max(m, r.order), 0) + 1,
            createdAt: stamp,
            updatedAt: stamp,
        };
        d.routines.push(routine);
        write(d);
        return routine;
    },
    async updateRoutine(id, input) {
        const d = read();
        const r = d.routines.find((x) => x.id === id);
        if (!r) throw new Error('not found');
        Object.assign(r, input, { updatedAt: new Date().toISOString() });
        if (!input.habitId && 'habitId' in input) delete r.habitId;
        write(d);
        return r;
    },
    async deleteRoutine(id) {
        const d = read();
        d.routines = d.routines.filter((r) => r.id !== id);
        d.runs = d.runs.filter((r) => r.routineId !== id);
        write(d);
    },
    async saveRun(run) {
        const d = read();
        d.runs = [...d.runs.filter((r) => !(r.routineId === run.routineId && r.date === run.date)), run];
        write(d);
    },
    async resetRun(routineId, date) {
        const d = read();
        d.runs = d.runs.filter((r) => !(r.routineId === routineId && r.date === date));
        write(d);
    },
};

const enc = encodeURIComponent;
const httpApi: RoutinesApi = {
    load: (date) => request(`/api/routines?date=${enc(date)}`),
    createRoutine: (input) => request('/api/routines', { method: 'POST', body: input }),
    updateRoutine: (id, input) =>
        request(`/api/routines/${enc(id)}`, {
            method: 'PATCH',
            // JSON drops `undefined`, so an unlinked habit is sent as `null`.
            body: 'habitId' in input && !input.habitId ? { ...input, habitId: null } : input,
        }),
    deleteRoutine: (id) => request(`/api/routines/${enc(id)}`, { method: 'DELETE' }),
    saveRun: (run) =>
        request(`/api/routines/${enc(run.routineId)}/runs/${enc(run.date)}`, { method: 'PUT', body: run }),
    resetRun: (id, date) => request(`/api/routines/${enc(id)}/runs/${enc(date)}`, { method: 'DELETE' }),
};

const api = usesServer ? httpApi : localApi;
export const routinesSynced = usesServer;

type State = {
    routines: Routine[];
    runs: Record<string, RoutineRun>;
    date: string | null;
    loaded: boolean;
    error: string | null;
};
const initial: State = { routines: [], runs: {}, date: null, loaded: false, error: null };
let state = initial;
const listeners = new Set<() => void>();
let loadingFor: string | null = null;

function set(next: Partial<State>) {
    state = { ...state, ...next };
    listeners.forEach((l) => l());
}

function load(date: string) {
    if (loadingFor === date) return;
    loadingFor = date;
    api.load(date)
        .then(({ routines, runs }) =>
            set({
                routines,
                runs: Object.fromEntries(runs.map((r) => [r.routineId, r])),
                date,
                loaded: true,
                error: null,
            }),
        )
        .catch((err) => {
            set({ loaded: true, date, error: loadErrorMessage(err, 'routines') });
            loadingFor = null;
        });
}

const runFor = (routine: Routine, date: string) => state.runs[routine.id] ?? emptyRun(routine.id, date);

async function commit(routine: Routine, next: RoutineRun) {
    const before = state.runs[routine.id];
    set({ runs: { ...state.runs, [routine.id]: next }, error: null });
    if (next.completedAt && !before?.completedAt && routine.habitId) {
        const habit = currentHabits().find((h) => h.id === routine.habitId);
        if (habit) void setHabitDone(habit, periodKey(habit.period, next.date), true);
    }
    try {
        await api.saveRun(next);
    } catch {
        set({
            runs: { ...state.runs, [routine.id]: before ?? emptyRun(routine.id, next.date) },
            error: "That didn't save. Try again.",
        });
    }
}

export function toggleStep(routine: Routine, stepId: string) {
    if (!state.date) return;
    return commit(routine, toggleTask(routine, runFor(routine, state.date), stepId, Date.now()));
}

export function skipWait(routine: Routine, stepId: string) {
    if (!state.date) return;
    return commit(routine, skipWaitStep(routine, runFor(routine, state.date), stepId, Date.now()));
}

export async function startOver(routine: Routine) {
    if (!state.date) return;
    const before = state.runs[routine.id];
    const runs = { ...state.runs };
    delete runs[routine.id];
    set({ runs });
    try {
        await api.resetRun(routine.id, state.date);
    } catch {
        if (before) set({ runs: { ...state.runs, [routine.id]: before }, error: "That didn't save. Try again." });
    }
}

export function tick(now: number) {
    for (const routine of state.routines) {
        const run = state.runs[routine.id];
        if (!run || run.completedAt) continue;
        const next = finish(routine, settleWaits(routine, run, now), now);
        const changed =
            JSON.stringify(next.waits) !== JSON.stringify(run.waits) || next.completedAt !== run.completedAt;
        if (changed) void commit(routine, next);
    }
}

export async function createRoutine(input: RoutineInput): Promise<Routine | undefined> {
    try {
        const routine = await api.createRoutine(input);
        set({ routines: [...state.routines, routine], error: null });
        return routine;
    } catch {
        set({ error: "That routine didn't save. Try again." });
        return undefined;
    }
}

export async function updateRoutine(routine: Routine, input: Partial<RoutineInput>) {
    const before = state.routines;
    set({ routines: before.map((r) => (r.id === routine.id ? { ...r, ...input } : r)), error: null });
    try {
        const saved = await api.updateRoutine(routine.id, input);
        set({ routines: state.routines.map((r) => (r.id === saved.id ? saved : r)) });
    } catch {
        set({ routines: before, error: "That change didn't save. Try again." });
    }
}

export async function deleteRoutine(routine: Routine) {
    const before = state;
    const runs = { ...state.runs };
    delete runs[routine.id];
    set({ routines: state.routines.filter((r) => r.id !== routine.id), runs });
    try {
        await api.deleteRoutine(routine.id);
    } catch {
        set({ routines: before.routines, runs: before.runs, error: "That didn't delete. Try again." });
    }
}

export function dismissRoutinesError() {
    set({ error: null });
}

const subscribe = (l: () => void) => {
    listeners.add(l);
    return () => listeners.delete(l);
};

export function useRoutines(today: string | null): State {
    const snapshot = useSyncExternalStore(
        subscribe,
        () => state,
        () => initial,
    );
    useEffect(() => {
        if (today) load(today);
    }, [today]);
    return snapshot;
}
