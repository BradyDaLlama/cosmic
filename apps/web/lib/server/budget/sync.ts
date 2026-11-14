/** The cursor is saved last, so a failure anywhere means the next sync replays the same changes. */
import type { AnyBulkWriteOperation } from 'mongodb';
import type { SyncResult } from '@/lib/budget/model';
import { newId } from '../userRoute';
import { budgetDb, type BankItemDoc, type TransactionDoc } from './db';
import { plaidErrorCode, RECONNECT_CODES } from './plaid';
import { sourceFor, type SourceAccount, type SourceTransaction } from './source';

type ItemResult = SyncResult['items'][number];

export async function saveAccounts(item: BankItemDoc, accounts: SourceAccount[]): Promise<Map<string, string>> {
    const col = await budgetDb.accounts();
    const now = new Date();
    if (accounts.length) {
        await col.bulkWrite(
            accounts.map((a) => ({
                updateOne: {
                    filter: { email: item.email, plaidAccountId: a.externalId },
                    update: {
                        $set: {
                            itemId: item._id,
                            name: a.name,
                            type: a.type,
                            ...(a.mask && { mask: a.mask }),
                            ...(a.currency && { currency: a.currency }),
                            ...(a.balance !== undefined && { balance: a.balance, balanceAt: now }),
                        },
                        $setOnInsert: { _id: newId(), email: item.email, hidden: false },
                    },
                    upsert: true,
                },
            })),
            { ordered: false },
        );
    }
    const saved = await col
        .find({ email: item.email, itemId: item._id }, { projection: { plaidAccountId: 1 } })
        .toArray();
    return new Map(saved.filter((a) => a.plaidAccountId).map((a) => [a.plaidAccountId!, a._id]));
}

export async function categorize(email: string, ids: string[]): Promise<void> {
    if (!ids.length) return;
    const [categoriesCol, rulesCol, txCol] = await Promise.all([
        budgetDb.categories(),
        budgetDb.rules(),
        budgetDb.transactions(),
    ]);
    const [categories, rules] = await Promise.all([
        categoriesCol.find({ email }).sort({ order: 1 }).toArray(),
        rulesCol.find({ email }).toArray(),
    ]);
    const byLength = [...rules].sort((a, b) => b.merchantContains.length - a.merchantContains.length);
    const txs = await txCol
        .find({ email, _id: { $in: ids }, categorizedBy: { $ne: 'you' } })
        .project<Pick<TransactionDoc, '_id' | 'merchant' | 'plaidCategory' | 'categoryId' | 'categorizedBy'>>({
            merchant: 1,
            plaidCategory: 1,
            categoryId: 1,
            categorizedBy: 1,
        })
        .toArray();

    const ops: AnyBulkWriteOperation<TransactionDoc>[] = [];
    for (const t of txs) {
        const merchant = t.merchant.toLowerCase();
        const rule = byLength.find((r) => merchant.includes(r.merchantContains.toLowerCase()));
        const pfc = t.plaidCategory;
        const byPlaid =
            pfc &&
            (categories.find((c) => c.plaidMatches.includes(pfc.detailed)) ??
                categories.find((c) => c.plaidMatches.includes(pfc.primary)));
        const next = rule
            ? { categoryId: rule.categoryId, categorizedBy: 'rule' as const }
            : byPlaid
              ? { categoryId: byPlaid._id, categorizedBy: 'plaid' as const }
              : undefined;
        if (next?.categoryId === t.categoryId && next?.categorizedBy === t.categorizedBy) continue;
        ops.push({
            updateOne: {
                filter: { _id: t._id, email },
                update: next ? { $set: next } : { $unset: { categoryId: '', categorizedBy: '' } },
            },
        });
    }
    if (ops.length) await txCol.bulkWrite(ops, { ordered: false });
}

async function saveTransactions(
    item: BankItemDoc,
    accountIds: Map<string, string>,
    added: SourceTransaction[],
    modified: SourceTransaction[],
    removed: string[],
): Promise<string[]> {
    const col = await budgetDb.transactions();
    const now = new Date();

    const replaced = added.map((t) => t.replacesExternalId).filter((id): id is string => !!id);
    const carried = new Map(
        (replaced.length
            ? await col
                  .find({ email: item.email, plaidTransactionId: { $in: replaced } })
                  .project<Pick<TransactionDoc, 'plaidTransactionId' | 'categoryId' | 'categorizedBy' | 'note'>>({
                      plaidTransactionId: 1,
                      categoryId: 1,
                      categorizedBy: 1,
                      note: 1,
                  })
                  .toArray()
            : []
        ).map((t) => [t.plaidTransactionId!, t]),
    );

    const ops: AnyBulkWriteOperation<TransactionDoc>[] = [];
    for (const t of [...added, ...modified]) {
        const accountId = accountIds.get(t.externalAccountId);
        if (!accountId) continue;
        const prior = t.replacesExternalId ? carried.get(t.replacesExternalId) : undefined;
        const keep =
            prior?.categorizedBy === 'you' ? { categoryId: prior.categoryId, categorizedBy: 'you' as const } : {};
        ops.push({
            updateOne: {
                filter: { email: item.email, plaidTransactionId: t.externalId },
                update: {
                    $set: {
                        accountId,
                        itemId: item._id,
                        date: t.date,
                        amount: t.amount,
                        merchant: t.merchant,
                        pending: t.pending,
                        updatedAt: now,
                        ...(t.plaidCategory && { plaidCategory: t.plaidCategory }),
                    },
                    $setOnInsert: {
                        _id: newId(),
                        email: item.email,
                        createdAt: now,
                        ...keep,
                        ...(prior?.note && { note: prior.note }),
                    },
                },
                upsert: true,
            },
        });
    }
    if (ops.length) await col.bulkWrite(ops, { ordered: false });
    if (removed.length) await col.deleteMany({ email: item.email, plaidTransactionId: { $in: removed } });

    const touched = [...added, ...modified].map((t) => t.externalId);
    if (!touched.length) return [];
    const rows = await col
        .find({ email: item.email, plaidTransactionId: { $in: touched } }, { projection: { _id: 1 } })
        .toArray();
    return rows.map((r) => r._id);
}

export async function syncItem(item: BankItemDoc): Promise<ItemResult> {
    const result: ItemResult = { itemId: item._id, institution: item.institution, added: 0, modified: 0, removed: 0 };
    const items = await budgetDb.items();
    let changes;
    try {
        changes = await sourceFor(item).pull(item);
    } catch (err) {
        const code = plaidErrorCode(err);
        if (code && RECONNECT_CODES.has(code)) {
            await items.updateOne(
                { _id: item._id, email: item.email },
                { $set: { status: 'needs_reconnect', errorCode: code } },
            );
            return { ...result, error: code };
        }
        throw err;
    }

    const accountIds = await saveAccounts(item, changes.accounts);
    const touched = await saveTransactions(item, accountIds, changes.added, changes.modified, changes.removed);
    await categorize(item.email, touched);

    // Only advance from the cursor this sync started at, so a slower overlapping sync can't move it backwards.
    if (changes.cursor) {
        const from = item.cursor ? { cursor: item.cursor } : { cursor: { $exists: false } };
        await items.updateOne({ _id: item._id, email: item.email, ...from }, { $set: { cursor: changes.cursor } });
    }
    await items.updateOne(
        { _id: item._id, email: item.email },
        { $set: { status: 'ok', lastSyncedAt: new Date() }, $unset: { errorCode: '' } },
    );

    return {
        ...result,
        added: changes.added.length,
        modified: changes.modified.length,
        removed: changes.removed.length,
        updateStatus: changes.updateStatus,
    };
}

export async function syncAll(email: string, itemId?: string): Promise<SyncResult> {
    const items = await (await budgetDb.items()).find({ email, ...(itemId && { _id: itemId }) }).toArray();
    const results: ItemResult[] = [];
    for (const item of items) {
        try {
            results.push(await syncItem(item));
        } catch (err) {
            console.error('[budget] sync failed', item._id, plaidErrorCode(err) ?? err);
            results.push({
                itemId: item._id,
                institution: item.institution,
                added: 0,
                modified: 0,
                removed: 0,
                error: plaidErrorCode(err) ?? 'sync_failed',
            });
        }
    }
    return { items: results };
}
