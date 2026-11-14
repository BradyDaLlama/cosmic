import type { Db } from 'mongodb';
import { getDb } from '../db';

export type ConnectionDoc = {
    _id: string;
    email: string;
    source: 'gmail-chase';
    status: 'ok' | 'error';
    errors: string[];
    lastSyncedAt?: Date;
    createdAt: Date;
};

export type AccountDoc = {
    _id: string;
    email: string;
    connectionId?: string;
    externalId?: string;
    institution?: string;
    name: string;
    balance?: number;
    balanceAt?: Date;
    currency?: string;
    hidden: boolean;
};

export type TransactionDoc = {
    _id: string;
    email: string;
    accountId: string;
    connectionId?: string;
    externalId?: string;
    date: string;
    amount: number;
    merchant: string;
    categoryId?: string;
    pending: boolean;
    createdAt: Date;
    updatedAt: Date;
};

export type CategoryDoc = {
    _id: string;
    email: string;
    name: string;
    icon: string;
    color: string;
    kind: 'spending' | 'income' | 'ignore';
    order: number;
};

export type BudgetDoc = {
    _id: string;
    email: string;
    name: string;
    icon: string;
    color: string;
    period: 'weekly' | 'monthly';
    amount: number;
    categoryIds: string[];
    order: number;
    createdAt: Date;
    updatedAt: Date;
};

export type RuleDoc = { _id: string; email: string; merchantContains: string; categoryId: string; createdAt: Date };

const globalForBudget = globalThis as typeof globalThis & { __cosmicBudgetIndexes?: Promise<void> };

async function openBudgetDb(): Promise<Db> {
    const db = await getDb();
    globalForBudget.__cosmicBudgetIndexes ??= ensureIndexes(db).catch((err) => {
        globalForBudget.__cosmicBudgetIndexes = undefined;
        throw err;
    });
    await globalForBudget.__cosmicBudgetIndexes;
    return db;
}

export const budgetDb = {
    connections: async () => (await openBudgetDb()).collection<ConnectionDoc>('bankConnections'),
    accounts: async () => (await openBudgetDb()).collection<AccountDoc>('accounts'),
    transactions: async () => (await openBudgetDb()).collection<TransactionDoc>('transactions'),
    categories: async () => (await openBudgetDb()).collection<CategoryDoc>('categories'),
    budgets: async () => (await openBudgetDb()).collection<BudgetDoc>('budgets'),
    rules: async () => (await openBudgetDb()).collection<RuleDoc>('rules'),
};

const uniqueWhere = (field: string) => ({
    unique: true,
    partialFilterExpression: { [field]: { $type: 'string' } },
});

async function ensureIndexes(db: Db): Promise<void> {
    await Promise.all([
        db.collection('bankConnections').createIndex({ email: 1 }),
        db.collection('accounts').createIndex({ email: 1, connectionId: 1 }),
        db.collection('accounts').createIndex({ email: 1, connectionId: 1, externalId: 1 }, uniqueWhere('externalId')),
        db.collection('transactions').createIndex({ email: 1, date: -1 }),
        db
            .collection('transactions')
            .createIndex({ email: 1, connectionId: 1, externalId: 1 }, uniqueWhere('externalId')),
        db.collection('transactions').createIndex({ email: 1, categoryId: 1 }),
        db.collection('transactions').createIndex({ email: 1, accountId: 1, date: -1 }),
        db.collection('categories').createIndex({ email: 1, order: 1 }),
        db.collection('budgets').createIndex({ email: 1, order: 1 }),
        db.collection('rules').createIndex({ email: 1 }),
    ]);
}
