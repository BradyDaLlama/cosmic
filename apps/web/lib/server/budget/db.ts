import type { Db } from 'mongodb';
import type { AccountType } from '@/lib/budget/model';
import { getDb } from '../db';

export type BankItemDoc = {
    _id: string;
    email: string;
    source: 'plaid';
    plaidItemId: string;
    institution: string;
    institutionId?: string;
    accessToken: string;
    cursor?: string;
    status: 'ok' | 'needs_reconnect';
    errorCode?: string;
    lastSyncedAt?: Date;
    createdAt: Date;
};

export type AccountDoc = {
    _id: string;
    email: string;
    itemId?: string;
    plaidAccountId?: string;
    name: string;
    mask?: string;
    type: AccountType;
    balance?: number;
    balanceAt?: Date;
    currency?: string;
    hidden: boolean;
};

export type TransactionDoc = {
    _id: string;
    email: string;
    accountId: string;
    itemId?: string;
    plaidTransactionId?: string;
    date: string;
    amount: number;
    merchant: string;
    plaidCategory?: { primary: string; detailed: string };
    categoryId?: string;
    categorizedBy?: 'plaid' | 'rule' | 'you';
    note?: string;
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
    plaidMatches: string[];
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
    plaidCategories: string[];
    categoryIds?: string[];
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
    items: async () => (await openBudgetDb()).collection<BankItemDoc>('plaidItems'),
    accounts: async () => (await openBudgetDb()).collection<AccountDoc>('accounts'),
    transactions: async () => (await openBudgetDb()).collection<TransactionDoc>('transactions'),
    categories: async () => (await openBudgetDb()).collection<CategoryDoc>('categories'),
    budgets: async () => (await openBudgetDb()).collection<BudgetDoc>('budgets'),
    rules: async () => (await openBudgetDb()).collection<RuleDoc>('rules'),
};

const uniqueWhere = (field: string) => ({ unique: true, partialFilterExpression: { [field]: { $type: 'string' } } });

async function ensureIndexes(db: Db): Promise<void> {
    await Promise.all([
        db.collection('plaidItems').createIndex({ email: 1 }),
        db.collection('plaidItems').createIndex({ plaidItemId: 1 }, uniqueWhere('plaidItemId')),
        db.collection('accounts').createIndex({ email: 1, itemId: 1 }),
        db.collection('accounts').createIndex({ plaidAccountId: 1 }, uniqueWhere('plaidAccountId')),
        db.collection('transactions').createIndex({ email: 1, date: -1 }),
        db.collection('transactions').createIndex({ plaidTransactionId: 1 }, uniqueWhere('plaidTransactionId')),
        db.collection('transactions').createIndex({ email: 1, categoryId: 1 }),
        db.collection('transactions').createIndex({ email: 1, accountId: 1, date: -1 }),
        db.collection('categories').createIndex({ email: 1, order: 1 }),
        db.collection('budgets').createIndex({ email: 1, order: 1 }),
        db.collection('transactions').createIndex({ email: 1, 'plaidCategory.detailed': 1, date: -1 }),
        db.collection('rules').createIndex({ email: 1 }),
    ]);
}
