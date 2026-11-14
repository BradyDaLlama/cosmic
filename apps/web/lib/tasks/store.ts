import { errorMessages, toTasksError, type TasksApi, type TasksErrorCode } from './api';
import { demoTasksApi } from './demo';
import { readJson, writeJson } from '@/lib/storage';
import { httpTasksApi } from './http';
import { applyPatch, type NewTask, type Task, type TaskList, type TaskPatch } from './model';

export const tasksBackend: 'demo' | 'google' = process.env.NEXT_PUBLIC_TASKS_BACKEND === 'http' ? 'google' : 'demo';
const api: TasksApi = tasksBackend === 'google' ? httpTasksApi : demoTasksApi;

export const SNAPSHOT_KEY = `cosmic.tasks.cache.${tasksBackend}`;
const STALE_MS = 30_000;
const POLL_MS = 2 * 60_000;
const UNDO_MS = 5_000;

type QueryStatus = 'loading' | 'ready' | 'error';

export type Entry = {
    data?: unknown;
    status: QueryStatus;
    error?: TasksErrorCode;
    fetchedAt?: number;
    fromSnapshot?: boolean;
};

type Notice = { code: TasksErrorCode; message: string; retry?: () => void };

type TasksState = {
    entries: Readonly<Record<string, Entry>>;
    pending: ReadonlySet<string>;
    hidden: ReadonlySet<string>;
    online: boolean;
    authorized: boolean;
    notice: Notice | null;
    undoable: Task | null;
};

const initial: TasksState = {
    entries: {},
    pending: new Set(),
    hidden: new Set(),
    online: true,
    authorized: true,
    notice: null,
    undoable: null,
};

let state = initial;
const listeners = new Set<() => void>();

function set(next: Partial<TasksState>) {
    state = { ...state, ...next };
    listeners.forEach((l) => l());
}

export const tasksStore = {
    getState: () => state,
    getServerState: () => initial,
    subscribe(listener: () => void) {
        listeners.add(listener);
        return () => listeners.delete(listener);
    },
};

type Snapshot = Record<string, { data: unknown; fetchedAt: number }>;

const readSnapshot = () => readJson<Snapshot>(SNAPSHOT_KEY) ?? {};

const writeSnapshot = (key: string, data: unknown, fetchedAt: number) =>
    writeJson(SNAPSHOT_KEY, { ...readSnapshot(), [key]: { data, fetchedAt } });

const fetchers = new Map<string, () => Promise<unknown>>();
const refCounts = new Map<string, number>();
const inflight = new Map<string, Promise<void>>();
let started = false;

function setEntry(key: string, entry: Entry) {
    set({ entries: { ...state.entries, [key]: entry } });
}

function noteError(code: TasksErrorCode) {
    if (code === 'offline') set({ online: false });
    if (code === 'unauthorized') set({ authorized: false });
}

export function refresh(key: string): Promise<void> {
    const fetcher = fetchers.get(key);
    if (!fetcher) return Promise.resolve();
    const running = inflight.get(key);
    if (running) return running;

    const prev = state.entries[key];
    if (!prev?.data) setEntry(key, { ...prev, status: 'loading' });

    const run = fetcher()
        .then((data) => {
            const fetchedAt = Date.now();
            setEntry(key, { data, status: 'ready', fetchedAt });
            set({ online: true, authorized: true });
            writeSnapshot(key, data, fetchedAt);
        })
        .catch((err) => {
            const { code } = toTasksError(err);
            noteError(code);
            setEntry(key, { ...state.entries[key], status: 'error', error: code });
        })
        .finally(() => inflight.delete(key));
    inflight.set(key, run);
    return run;
}

function refreshAll() {
    for (const [key, count] of refCounts) if (count > 0) void refresh(key);
}

function refreshTaskQueries() {
    for (const [key, count] of refCounts) if (count > 0 && key !== 'lists') void refresh(key);
}

function start() {
    if (started || typeof window === 'undefined') return;
    started = true;

    const snap = readSnapshot();
    const entries: Record<string, Entry> = {};
    for (const [key, { data, fetchedAt }] of Object.entries(snap)) {
        entries[key] = { data, fetchedAt, status: 'ready', fromSnapshot: true };
    }
    set({ entries, online: navigator.onLine });

    const visible = () => document.visibilityState === 'visible';
    window.addEventListener('focus', refreshAll);
    document.addEventListener('visibilitychange', () => visible() && refreshAll());
    window.addEventListener('online', () => {
        set({ online: true });
        refreshAll();
    });
    window.addEventListener('offline', () => set({ online: false }));
    window.addEventListener('pagehide', flushDeletes);
    setInterval(() => visible() && refreshAll(), POLL_MS);
}

export function watch(key: string, fetcher: () => Promise<unknown>) {
    start();
    fetchers.set(key, fetcher);
    refCounts.set(key, (refCounts.get(key) ?? 0) + 1);
    const entry = state.entries[key];
    if (!entry?.fetchedAt || entry.fromSnapshot || Date.now() - entry.fetchedAt > STALE_MS) void refresh(key);
    return () => {
        refCounts.set(key, (refCounts.get(key) ?? 1) - 1);
    };
}

export const queries = {
    lists: () => ({ key: 'lists', fetch: () => api.lists() }),
    list: (listId: string) => ({ key: `list:${listId}`, fetch: () => api.tasks(listId) }),
    due: (until: string) => ({ key: `due:${until}`, fetch: () => api.due(until) }),
};

function upsertTask(task: Task, replaceId = task.id) {
    const entries = { ...state.entries };
    for (const [key, entry] of Object.entries(entries)) {
        if (!Array.isArray(entry.data) || key === 'lists') continue;
        const tasks = (entry.data as Task[]).filter((t) => t.id !== replaceId && t.id !== task.id);
        const belongs = key.startsWith('list:')
            ? key === `list:${task.listId}`
            : !!task.due && task.due <= key.slice('due:'.length);
        entries[key] = { ...entry, data: belongs ? [...tasks, task] : tasks };
    }
    set({ entries });
}

function dropTasks(match: (t: Task) => boolean) {
    const entries = { ...state.entries };
    for (const [key, entry] of Object.entries(entries)) {
        if (!Array.isArray(entry.data) || key === 'lists') continue;
        entries[key] = { ...entry, data: (entry.data as Task[]).filter((t) => !match(t)) };
    }
    set({ entries });
}

function findCachedTask(id: string): Task | undefined {
    for (const [key, entry] of Object.entries(state.entries)) {
        if (key === 'lists' || !Array.isArray(entry.data)) continue;
        const hit = (entry.data as Task[]).find((t) => t.id === id);
        if (hit) return hit;
    }
}

function setLists(update: (lists: TaskList[]) => TaskList[]) {
    const entry = state.entries.lists;
    if (!entry?.data) return;
    setEntry('lists', { ...entry, data: update(entry.data as TaskList[]) });
}

function withPending(ids: string[], on: boolean) {
    const pending = new Set(state.pending);
    ids.forEach((id) => (on ? pending.add(id) : pending.delete(id)));
    set({ pending });
}

function canWrite(): boolean {
    if (!state.authorized) {
        set({ notice: { code: 'unauthorized', message: errorMessages.unauthorized } });
        return false;
    }
    if (!state.online || (typeof navigator !== 'undefined' && !navigator.onLine)) {
        set({ online: false, notice: { code: 'offline', message: errorMessages.offline } });
        return false;
    }
    return true;
}

async function mutate<T>(opts: {
    ids?: string[];
    optimistic?: () => void;
    run: () => Promise<T>;
    onSuccess?: (result: T) => void;
    retry: () => void;
    lists?: boolean;
}): Promise<T | undefined> {
    if (!canWrite()) return undefined;
    const before = state.entries;
    const ids = opts.ids ?? [];
    opts.optimistic?.();
    withPending(ids, true);
    try {
        const result = await opts.run();
        opts.onSuccess?.(result);
        set({ notice: null, online: true });
        return result;
    } catch (err) {
        const { code, message } = toTasksError(err);
        noteError(code);
        set({
            entries: before,
            notice: {
                code,
                message: code === 'google' && message !== 'google' ? message : errorMessages[code],
                retry: opts.retry,
            },
        });
        return undefined;
    } finally {
        withPending(ids, false);
        if (opts.lists) void refresh('lists');
        refreshTaskQueries();
    }
}

let tempCount = 0;

export function createTask(input: NewTask): Promise<Task | undefined> {
    const title = input.title.trim();
    if (!title) return Promise.resolve(undefined);
    const tempId = `temp-${++tempCount}`;
    const previous = input.previousId ? findCachedTask(input.previousId) : undefined;
    const temp: Task = {
        id: tempId,
        listId: input.listId,
        title,
        notes: input.notes,
        due: input.due,
        parentId: input.parentId,
        done: false,
        // Sorts right after `previous`, or first, until the real position arrives.
        position: previous ? `${previous.position}~` : '',
        updatedAt: new Date().toISOString(),
    };
    return mutate({
        ids: [tempId],
        optimistic: () => upsertTask(temp),
        run: () => api.create({ ...input, title }),
        onSuccess: (task) => upsertTask(task, tempId),
        retry: () => void createTask(input),
    });
}

export function updateTask(task: Task, patch: TaskPatch): Promise<Task | undefined> {
    return mutate({
        ids: [task.id],
        optimistic: () => upsertTask(applyPatch(task, patch)),
        run: () => api.update(task, patch),
        onSuccess: (saved) => upsertTask(saved),
        retry: () => void updateTask(task, patch),
    });
}

// Google is only told about a delete once the undo window passes.

const deleteTimers = new Map<string, { task: Task; timer: ReturnType<typeof setTimeout> }>();

function setHidden(id: string, on: boolean) {
    const hidden = new Set(state.hidden);
    if (on) hidden.add(id);
    else hidden.delete(id);
    set({ hidden });
}

export function deleteTask(task: Task) {
    if (!canWrite()) return;
    setHidden(task.id, true);
    set({ undoable: task });
    const timer = setTimeout(() => commitDelete(task.id), UNDO_MS);
    deleteTimers.set(task.id, { task, timer });
}

export function undoDelete(id: string) {
    const pendingDelete = deleteTimers.get(id);
    if (!pendingDelete) return;
    clearTimeout(pendingDelete.timer);
    deleteTimers.delete(id);
    setHidden(id, false);
    if (state.undoable?.id === id) set({ undoable: null });
}

function commitDelete(id: string) {
    const pendingDelete = deleteTimers.get(id);
    if (!pendingDelete) return;
    deleteTimers.delete(id);
    const { task } = pendingDelete;
    if (state.undoable?.id === id) set({ undoable: null });
    void mutate({
        ids: [id],
        run: () => api.remove(task),
        onSuccess: () => dropTasks((t) => t.id === id || t.parentId === id),
        retry: () => deleteTask(task),
    }).finally(() => setHidden(id, false));
}

function flushDeletes() {
    for (const id of [...deleteTimers.keys()]) {
        clearTimeout(deleteTimers.get(id)!.timer);
        commitDelete(id);
    }
}

export function createList(title: string): Promise<TaskList | undefined> {
    const trimmed = title.trim();
    if (!trimmed) return Promise.resolve(undefined);
    return mutate({
        run: () => api.createList(trimmed),
        onSuccess: (list) => setLists((ls) => [...ls, list]),
        retry: () => void createList(title),
        lists: true,
    });
}

export function renameList(list: TaskList, title: string): Promise<TaskList | undefined> {
    const trimmed = title.trim();
    if (!trimmed || trimmed === list.title) return Promise.resolve(list);
    return mutate({
        optimistic: () => setLists((ls) => ls.map((l) => (l.id === list.id ? { ...l, title: trimmed } : l))),
        run: () => api.renameList(list.id, trimmed),
        retry: () => void renameList(list, title),
        lists: true,
    });
}

export function deleteList(list: TaskList): Promise<void | undefined> {
    return mutate({
        optimistic: () => {
            setLists((ls) => ls.filter((l) => l.id !== list.id));
            dropTasks((t) => t.listId === list.id);
        },
        run: () => api.deleteList(list.id),
        retry: () => void deleteList(list),
        lists: true,
    });
}

export function clearCompleted(listId: string): Promise<void | undefined> {
    return mutate({
        optimistic: () => dropTasks((t) => t.listId === listId && t.done),
        run: () => api.clearCompleted(listId),
        retry: () => void clearCompleted(listId),
    });
}

export function dismissNotice() {
    set({ notice: null });
}
