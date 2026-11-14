import { TasksError, type TasksApi } from './api';
import { newId } from '@/lib/id';
import { readJson, writeJson } from '@/lib/storage';
import { addDays, todayISO } from '@/lib/dates';
import { applyPatch, type Task, type TaskList } from './model';

const KEY = 'cosmic.demo.google';
const VERSION = 1;
const LATENCY_MS = 250;

type Db = { version: number; lists: TaskList[]; tasks: Task[] };

const stamp = () => new Date().toISOString();
const pos = (n: number) => String(n).padStart(20, '0');
const clone = <T>(v: T): T => (v === undefined ? v : JSON.parse(JSON.stringify(v)));
const delay = () => new Promise((r) => setTimeout(r, LATENCY_MS));

function seed(): Db {
    const now = stamp();
    const today = todayISO();
    const mine: TaskList = { id: newId(), title: 'My Tasks', updatedAt: now };
    const errands: TaskList = { id: newId(), title: 'Errands', updatedAt: now };
    const db: Db = { version: VERSION, lists: [mine, errands], tasks: [] };

    const add = (listId: string, title: string, extra: Partial<Task> = {}) => {
        const siblings = db.tasks.filter((t) => t.listId === listId && !t.parentId);
        const task: Task = {
            id: newId(),
            listId,
            title,
            done: false,
            position: pos(siblings.length),
            updatedAt: now,
            ...extra,
        };
        db.tasks.push(task);
        return task;
    };

    add(mine.id, 'Renew library books', { due: addDays(today, -1) });
    add(mine.id, 'Book dentist appointment', { due: today });
    const trip = add(mine.id, 'Plan weekend trip', { due: addDays(today, 3) });
    add(mine.id, 'Look at cabins', { parentId: trip.id, position: pos(0) });
    add(mine.id, 'Ask Sam about dates', { parentId: trip.id, position: pos(1) });
    add(mine.id, 'Read “Piranesi”');
    add(mine.id, 'Water the plants', { due: today, done: true, completedAt: now });
    add(errands.id, 'Pick up dry cleaning', { due: today });
    add(errands.id, 'Groceries', { notes: 'Oat milk, eggs, spinach', due: addDays(today, 1) });
    add(errands.id, 'Return package');
    return db;
}

function read(): Db {
    const stored = readJson<Db>(KEY);
    if (stored?.version === VERSION && Array.isArray(stored.lists) && Array.isArray(stored.tasks)) return stored;
    const db = seed();
    write(db);
    return db;
}

const write = (db: Db) => writeJson(KEY, db);

async function op<T>(fn: (db: Db) => T, { write: writes = true } = {}): Promise<T> {
    if (writes && !navigator.onLine) {
        await delay();
        throw new TasksError('offline');
    }
    const db = read();
    const result = fn(db);
    if (writes) write(db);
    await delay();
    return clone(result);
}

function findList(db: Db, id: string) {
    const list = db.lists.find((l) => l.id === id);
    if (!list) throw new TasksError('not_found');
    return list;
}

function findTask(db: Db, id: string) {
    const task = db.tasks.find((t) => t.id === id);
    if (!task) throw new TasksError('not_found');
    return task;
}

function insertAt(db: Db, task: Task, previousId?: string) {
    const siblings = db.tasks
        .filter((t) => t.listId === task.listId && (t.parentId ?? null) === (task.parentId ?? null) && !t.done)
        .sort((a, b) => a.position.localeCompare(b.position));
    const index = previousId ? siblings.findIndex((t) => t.id === previousId) + 1 : 0;
    siblings.splice(index, 0, task);
    siblings.forEach((t, i) => (t.position = pos(i)));
    db.tasks.push(task);
}

export const demoTasksApi: TasksApi = {
    lists: () => op((db) => db.lists, { write: false }),

    createList: (title) =>
        op((db) => {
            const list: TaskList = { id: newId(), title: title.trim(), updatedAt: stamp() };
            db.lists.push(list);
            return list;
        }),

    renameList: (id, title) =>
        op((db) => {
            const list = findList(db, id);
            list.title = title.trim() || list.title;
            list.updatedAt = stamp();
            return list;
        }),

    deleteList: (id) =>
        op((db) => {
            findList(db, id);
            if (db.lists[0]?.id === id) throw new TasksError('google', "The default list can't be deleted.");
            db.lists = db.lists.filter((l) => l.id !== id);
            db.tasks = db.tasks.filter((t) => t.listId !== id);
        }),

    clearCompleted: (listId) =>
        op((db) => {
            findList(db, listId);
            db.tasks = db.tasks.filter((t) => t.listId !== listId || !t.done);
        }),

    tasks: (listId) =>
        op(
            (db) => {
                findList(db, listId);
                return db.tasks.filter((t) => t.listId === listId);
            },
            { write: false },
        ),

    due: (until) => op((db) => db.tasks.filter((t) => t.due && t.due <= until), { write: false }),

    create: (input) =>
        op((db) => {
            findList(db, input.listId);
            const task: Task = {
                id: newId(),
                listId: input.listId,
                title: input.title.trim(),
                notes: input.notes?.trim() || undefined,
                due: input.due,
                parentId: input.parentId,
                done: false,
                position: pos(0),
                updatedAt: stamp(),
            };
            insertAt(db, task, input.previousId);
            return task;
        }),

    update: (ref, patch) =>
        op((db) => {
            const task = findTask(db, ref.id);
            Object.assign(task, applyPatch(task, patch));
            return task;
        }),

    remove: (ref) =>
        op((db) => {
            findTask(db, ref.id);
            db.tasks = db.tasks.filter((t) => t.id !== ref.id && t.parentId !== ref.id);
        }),
};
