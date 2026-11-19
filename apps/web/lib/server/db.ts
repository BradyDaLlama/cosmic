/** One client per process, kept on `globalThis` so dev reloads and reused serverless instances don't exhaust Atlas's connection limit. */
import { MongoClient, type Db } from 'mongodb';

type Cached = { client: MongoClient; ready: Promise<Db>; indexed?: Promise<void> };
const globalForMongo = globalThis as typeof globalThis & { __cosmicMongo?: Cached };

export class DatabaseNotConfigured extends Error {
    constructor() {
        super('MONGODB_URI is not set (see apps/web/.env.example).');
    }
}

function connect(): Cached {
    const uri = process.env.MONGODB_URI;
    if (!uri) throw new DatabaseNotConfigured();
    const client = new MongoClient(uri, {
        appName: 'cosmic',
        maxPoolSize: 5,
        serverSelectionTimeoutMS: 8_000,
    });
    const ready = client.connect().then((c) => c.db(process.env.MONGODB_DB || 'cosmic'));
    ready.catch(() => {
        if (globalForMongo.__cosmicMongo?.client === client) globalForMongo.__cosmicMongo = undefined;
    });
    return { client, ready };
}

export async function getDb(): Promise<Db> {
    globalForMongo.__cosmicMongo ??= connect();
    const cached = globalForMongo.__cosmicMongo;
    const db = await cached.ready;
    cached.indexed ??= ensureIndexes(db).catch((err) => {
        cached.indexed = undefined;
        throw err;
    });
    await cached.indexed;
    return db;
}

export type SettingsDoc = {
    _id: string;
    hiddenCalendars: string[];
    defaultTaskList?: string;
    updatedAt: Date;
};

export async function settingsCollection() {
    return (await getDb()).collection<SettingsDoc>('settings');
}

export type HabitDoc = {
    _id: string;
    email: string;
    name: string;
    description?: string;
    icon: string;
    color: string;
    period: 'daily' | 'weekly' | 'monthly';
    order: number;
    createdAt: string;
    updatedAt: string;
};

export type CheckinDoc = {
    _id: string;
    email: string;
    habitId: string;
    periodKey: string;
    doneAt: string;
};

export type GoalDoc = {
    _id: string;
    email: string;
    name: string;
    description?: string;
    unit?: string;
    icon: string;
    color: string;
    target?: number;
    better: 'higher' | 'lower';
    order: number;
    createdAt: string;
    updatedAt: string;
};

export type GoalEntryDoc = {
    _id: string;
    email: string;
    goalId: string;
    date: string;
    value: number;
    note?: string;
    createdAt: string;
};

export type RoutineDoc = {
    _id: string;
    email: string;
    name: string;
    icon: string;
    color: string;
    steps: ({ id: string; kind: 'task'; title: string } | { id: string; kind: 'wait'; minutes: number })[];
    habitId?: string;
    order: number;
    createdAt: string;
    updatedAt: string;
};

export type RoutineRunDoc = {
    _id: string;
    email: string;
    routineId: string;
    date: string;
    done: string[];
    waits: Record<string, string>;
    skipped: string[];
    completedAt?: string;
    updatedAt: string;
};

export type NoteDoc = {
    _id: string;
    email: string;
    type: 'list' | 'text';
    name: string;
    icon: string;
    color: string;
    text?: string;
    items: { id: string; text: string; done: boolean }[];
    createdOn: string;
    archivedAt?: string;
    order: number;
    createdAt: string;
    updatedAt: string;
};

export const collections = {
    routines: async () => (await getDb()).collection<RoutineDoc>('routines'),
    routineRuns: async () => (await getDb()).collection<RoutineRunDoc>('routine_runs'),
    habits: async () => (await getDb()).collection<HabitDoc>('habits'),
    checkins: async () => (await getDb()).collection<CheckinDoc>('checkins'),
    goals: async () => (await getDb()).collection<GoalDoc>('goals'),
    goalEntries: async () => (await getDb()).collection<GoalEntryDoc>('goal_entries'),
    notes: async () => (await getDb()).collection<NoteDoc>('notes'),
};

async function ensureIndexes(db: Db): Promise<void> {
    await Promise.all([
        db.collection('habits').createIndex({ email: 1, order: 1 }),
        db.collection('checkins').createIndex({ email: 1, habitId: 1 }),
        db.collection('goals').createIndex({ email: 1, order: 1 }),
        db.collection('goal_entries').createIndex({ email: 1, goalId: 1, date: 1 }),
        db.collection('routines').createIndex({ email: 1, order: 1 }),
        db.collection('routine_runs').createIndex({ email: 1, date: 1 }),
        db.collection('notes').createIndex({ email: 1, order: 1 }),
    ]);
}
