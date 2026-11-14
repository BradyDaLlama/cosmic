import type { BankConnection, BudgetAccount, BudgetTransaction } from '@/lib/budget/model';
import type { Filter } from 'mongodb';
import type { Session } from '../session';
import { HttpError, invalid, isDate, newId, notFound } from '../userRoute';
import { budgetDb, type AccountDoc, type ConnectionDoc, type TransactionDoc } from './db';
import { hasGmail } from './gmail';
import { syncConnection } from './sync';

const toConnection = (d: ConnectionDoc): BankConnection => ({
    id: d._id,
    status: d.status,
    errors: d.errors,
    lastSyncedAt: d.lastSyncedAt?.toISOString(),
});

const toAccount = (d: AccountDoc): BudgetAccount => ({
    id: d._id,
    connectionId: d.connectionId,
    institution: d.institution,
    name: d.name,
    balance: d.balance,
    balanceAt: d.balanceAt?.toISOString(),
    currency: d.currency,
    hidden: d.hidden,
});

export const toTransaction = (d: TransactionDoc): BudgetTransaction => ({
    id: d._id,
    accountId: d.accountId,
    date: d.date,
    amount: d.amount,
    merchant: d.merchant,
    categoryId: d.categoryId,
    pending: d.pending,
});

export async function connect(email: string, session: Session) {
    if (!hasGmail(session)) throw new HttpError(403, 'needs_gmail', 'Cosmic needs Gmail access to read Chase alerts.');
    const connections = await budgetDb.connections();
    const existing = await connections.findOne({ email, source: 'gmail-chase' });
    const doc: ConnectionDoc = existing ?? {
        _id: newId(),
        email,
        source: 'gmail-chase',
        status: 'ok',
        errors: [],
        createdAt: new Date(),
    };
    if (!existing) await connections.insertOne(doc);
    const sync = await syncConnection(doc, session);
    return { connection: toConnection(doc), sync };
}

/** Stops reading alerts; Gmail access itself is removed by signing out or in Google account settings. */
export async function removeConnection(email: string, id: string, deleteData: boolean): Promise<void> {
    const [connections, accounts, transactions] = await Promise.all([
        budgetDb.connections(),
        budgetDb.accounts(),
        budgetDb.transactions(),
    ]);
    const { deletedCount } = await connections.deleteOne({ _id: id, email });
    if (!deletedCount) throw notFound();
    if (deleteData) {
        await transactions.deleteMany({ email, connectionId: id });
        await accounts.deleteMany({ email, connectionId: id });
    } else {
        await accounts.updateMany({ email, connectionId: id }, { $unset: { connectionId: '', externalId: '' } });
        await transactions.updateMany({ email, connectionId: id }, { $unset: { connectionId: '', externalId: '' } });
    }
}

export async function listAccounts(email: string) {
    const [connections, accounts] = await Promise.all([budgetDb.connections(), budgetDb.accounts()]);
    const [c, a] = await Promise.all([
        connections.find({ email }).sort({ createdAt: 1 }).toArray(),
        accounts.find({ email }).sort({ institution: 1, name: 1 }).toArray(),
    ]);
    return { connections: c.map(toConnection), accounts: a.map(toAccount) };
}

export async function listTransactions(email: string, url: URL) {
    const p = url.searchParams;
    const limit = Math.min(Math.max(Number(p.get('limit')) || 50, 1), 200);
    const offset = Math.min(Math.max(Number(p.get('offset')) || 0, 0), 100_000);
    const filter: Filter<TransactionDoc> = { email };

    const q = p.get('q')?.trim();
    if (q) filter.merchant = { $regex: q.slice(0, 80).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
    const accountId = p.get('accountId');
    if (accountId) filter.accountId = accountId;
    const categoryId = p.get('categoryId');
    if (categoryId === 'none') filter.categoryId = { $exists: false };
    else if (categoryId) filter.categoryId = categoryId;
    const budgetId = p.get('budgetId');
    if (budgetId) {
        const budget = await (await budgetDb.budgets()).findOne({ _id: budgetId, email });
        if (!budget) throw notFound();
        filter.categoryId = { $in: budget.categoryIds };
    }
    const from = p.get('from');
    const to = p.get('to');
    if ((from && !isDate(from)) || (to && !isDate(to))) throw invalid('from and to must be YYYY-MM-DD.');
    if (from || to) filter.date = { ...(from && { $gte: from }), ...(to && { $lte: to }) };
    const flow = p.get('flow');
    if (flow === 'out') filter.amount = { $lt: 0 };
    else if (flow === 'in') filter.amount = { $gt: 0 };

    const rows = await (
        await budgetDb.transactions()
    )
        .find(filter)
        .sort({ date: -1, createdAt: -1 })
        .skip(offset)
        .limit(limit + 1)
        .toArray();
    return { transactions: rows.slice(0, limit).map(toTransaction), hasMore: rows.length > limit };
}
