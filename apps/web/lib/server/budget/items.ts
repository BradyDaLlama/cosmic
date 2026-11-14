import { createHash } from 'node:crypto';
import type { BankItem, BudgetAccount, BudgetTransaction } from '@/lib/budget/model';
import type { Filter } from 'mongodb';
import { invalid, isDate, isString, newId, notFound } from '../userRoute';
import { budgetDb, type AccountDoc, type BankItemDoc, type TransactionDoc } from './db';
import { plaid } from './plaid';
import { sourceFor } from './source';
import { saveAccounts, syncItem } from './sync';
import { decryptToken, encryptToken } from './tokenCrypto';

const DAYS_REQUESTED = 730;

const toItem = (d: BankItemDoc): BankItem => ({
    id: d._id,
    source: d.source,
    institution: d.institution,
    status: d.status,
    errorCode: d.errorCode,
    lastSyncedAt: d.lastSyncedAt?.toISOString(),
});

const toAccount = (d: AccountDoc): BudgetAccount => ({
    id: d._id,
    itemId: d.itemId,
    name: d.name,
    mask: d.mask,
    type: d.type,
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
    plaidCategory: d.plaidCategory,
    categoryId: d.categoryId,
    categorizedBy: d.categorizedBy,
    note: d.note,
    pending: d.pending,
});

async function ownItem(email: string, id: unknown): Promise<BankItemDoc> {
    if (!isString(id, 64) || !id) throw invalid('itemId is required.');
    const item = await (await budgetDb.items()).findOne({ _id: id, email });
    if (!item) throw notFound();
    return item;
}

export async function createLinkToken(email: string, body: { itemId?: unknown }) {
    const update = body.itemId !== undefined ? await ownItem(email, body.itemId) : undefined;
    const webhook = process.env.PLAID_WEBHOOK_URL?.trim();
    const redirectUri = process.env.PLAID_REDIRECT_URI?.trim();
    const res = await plaid().link.createToken({
        client_name: 'Cosmic',
        language: 'en',
        country_codes: ['US'],
        // A stable id that isn't the email itself, so Plaid doesn't receive it.
        user: { client_user_id: createHash('sha256').update(`cosmic:${email}`).digest('hex').slice(0, 32) },
        ...(update
            ? { access_token: decryptToken(update.accessToken, update.plaidItemId) }
            : { products: ['transactions'], transactions: { days_requested: DAYS_REQUESTED } }),
        ...(webhook && { webhook }),
        ...(redirectUri && { redirect_uri: redirectUri }),
    });
    return { linkToken: res.link_token, expiration: res.expiration };
}

export async function exchangePublicToken(email: string, body: { publicToken?: unknown }) {
    if (!isString(body.publicToken, 200) || !body.publicToken) throw invalid('publicToken is required.');
    const client = plaid();
    const { access_token, item_id } = await client.item.exchangePublicToken({ public_token: body.publicToken });

    const { item: plaidItem } = await client.item.get({ access_token });
    let institution = plaidItem.institution_name ?? undefined;
    if (!institution && plaidItem.institution_id) {
        const res = await client.institutions
            .getById({ institution_id: plaidItem.institution_id, country_codes: ['US'] })
            .catch(() => undefined);
        institution = res?.institution.name;
    }

    const items = await budgetDb.items();
    const doc: BankItemDoc = {
        _id: newId(),
        email,
        source: 'plaid',
        plaidItemId: item_id,
        institution: institution ?? 'Bank',
        institutionId: plaidItem.institution_id ?? undefined,
        accessToken: encryptToken(access_token, item_id),
        status: 'ok',
        createdAt: new Date(),
    };
    await items.insertOne(doc);

    await saveAccounts(doc, await sourceFor(doc).accounts(doc));
    const sync = await syncItem(doc).catch((err) => {
        console.error('[budget] first sync failed', doc._id, err);
        return undefined;
    });
    return { item: toItem(doc), sync };
}

export async function removeItem(email: string, id: string, deleteData: boolean): Promise<void> {
    const item = await ownItem(email, id);
    await sourceFor(item).remove(item);
    const [items, accounts, transactions] = await Promise.all([
        budgetDb.items(),
        budgetDb.accounts(),
        budgetDb.transactions(),
    ]);
    await items.deleteOne({ _id: item._id, email });
    if (deleteData) {
        await transactions.deleteMany({ email, itemId: item._id });
        await accounts.deleteMany({ email, itemId: item._id });
    } else {
        await accounts.updateMany({ email, itemId: item._id }, { $unset: { itemId: '' } });
        await transactions.updateMany({ email, itemId: item._id }, { $unset: { itemId: '' } });
    }
}

export async function listAccounts(email: string) {
    const [items, accounts] = await Promise.all([budgetDb.items(), budgetDb.accounts()]);
    const [i, a] = await Promise.all([
        items
            .find({ email }, { projection: { accessToken: 0, cursor: 0 } })
            .sort({ createdAt: 1 })
            .toArray(),
        accounts.find({ email }).sort({ name: 1 }).toArray(),
    ]);
    return { items: (i as BankItemDoc[]).map(toItem), accounts: a.map(toAccount) };
}

export async function listTransactions(email: string, url: URL) {
    const p = url.searchParams;
    const limit = Math.min(Math.max(Number(p.get('limit')) || 50, 1), 200);
    const offset = Math.min(Math.max(Number(p.get('offset')) || 0, 0), 100_000);
    const filter: Filter<TransactionDoc> = { email };
    const and: Filter<TransactionDoc>[] = [];

    const q = p.get('q')?.trim();
    if (q) filter.merchant = { $regex: q.slice(0, 80).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
    const accountId = p.get('accountId');
    if (accountId) filter.accountId = accountId;
    const categoryId = p.get('categoryId');
    if (categoryId === 'none') filter.categoryId = { $exists: false };
    else if (categoryId) filter.categoryId = categoryId;
    const plaidCode = p.get('plaid');
    if (plaidCode) and.push({ $or: [{ 'plaidCategory.primary': plaidCode }, { 'plaidCategory.detailed': plaidCode }] });
    const budgetId = p.get('budgetId');
    if (budgetId) {
        const budget = await (await budgetDb.budgets()).findOne({ _id: budgetId, email });
        if (!budget) throw notFound();
        const codes = budget.plaidCategories;
        and.push({
            $or: [
                { categoryId: { $in: budget.categoryIds ?? [] } },
                { 'plaidCategory.primary': { $in: codes } },
                { 'plaidCategory.detailed': { $in: codes } },
            ],
        });
    }
    const from = p.get('from');
    const to = p.get('to');
    if ((from && !isDate(from)) || (to && !isDate(to))) throw invalid('from and to must be YYYY-MM-DD.');
    if (from || to) filter.date = { ...(from && { $gte: from }), ...(to && { $lte: to }) };
    const flow = p.get('flow');
    if (flow === 'out') filter.amount = { $lt: 0 };
    else if (flow === 'in') filter.amount = { $gt: 0 };
    if (and.length) filter.$and = and;

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
