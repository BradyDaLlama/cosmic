'use client';

import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { todayISO } from '@/lib/dates';
import type { Task, TaskList } from './model';
import { queries, refresh, tasksStore, watch, type Entry } from './store';

export function useTasksState() {
    return useSyncExternalStore(tasksStore.subscribe, tasksStore.getState, tasksStore.getServerState);
}

export type Query<T> = {
    data: T | undefined;
    status: Entry['status'];
    error: Entry['error'];
    fetchedAt: number | undefined;
    fromSnapshot: boolean;
    refresh: () => Promise<void>;
};

function useQuery<T>(q: { key: string; fetch: () => Promise<T> } | null): Query<T> {
    const state = useTasksState();
    const key = q?.key ?? null;

    // `q` is rebuilt every render; its key identifies it.
    const fetcher = q?.fetch;
    useEffect(() => {
        if (!key || !fetcher) return;
        return watch(key, fetcher);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [key]);

    const entry = key ? state.entries[key] : undefined;
    return {
        data: entry?.data as T | undefined,
        status: entry?.status ?? 'loading',
        error: entry?.error,
        fetchedAt: entry?.fetchedAt,
        fromSnapshot: !!entry?.fromSnapshot,
        refresh: () => (key ? refresh(key) : Promise.resolve()),
    };
}

function useVisible(tasks: Task[] | undefined): Task[] | undefined {
    const { hidden } = useTasksState();
    return useMemo(
        () => tasks?.filter((t) => !hidden.has(t.id) && !(t.parentId && hidden.has(t.parentId))),
        [tasks, hidden],
    );
}

export function useTaskLists(): Query<TaskList[]> {
    return useQuery(queries.lists());
}

export function useListTasks(listId: string | undefined): Query<Task[]> {
    const query = useQuery(listId ? queries.list(listId) : null);
    return { ...query, data: useVisible(query.data) };
}

export function useDueTasks(until: string | null): Query<Task[]> {
    const query = useQuery(until ? queries.due(until) : null);
    return { ...query, data: useVisible(query.data) };
}

export function useToday(): string | null {
    const [today, setToday] = useState<string | null>(null);
    useEffect(() => {
        const tick = () => setToday(todayISO());
        tick();
        const id = setInterval(tick, 60_000);
        return () => clearInterval(id);
    }, []);
    return today;
}
