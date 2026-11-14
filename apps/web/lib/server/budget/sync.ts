import type { AnyBulkWriteOperation } from 'mongodb';
import type { SyncResult } from '@/lib/budget/model';
import { TasksError } from '@/lib/tasks/api';
import type { Session } from '../session';
import { newId } from '../userRoute';
import { parseChaseAlert } from './chase';
import { budgetDb, type ConnectionDoc, type TransactionDoc } from './db';
import { chaseAlerts, hasGmail } from './gmail';

const DAY_MS = 86_400_000;
const FIRST_SYNC_DAYS = 60;
const OVERLAP_DAYS = 1;
const MIN_SYNC_GAP_MS = 30_000;
export const STALE_AFTER_MS = 10 * 60_000;
/** Chase writes alert times in Eastern time; used when an alert has no date of its own. */
const ALERT_TIME_ZONE = 'America/New_York';

type ConnectionResult = SyncResult['connections'][number];

const localDate = (at: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: ALERT_TIME_ZONE }).format(at);

export async function categorize(email: string, ids: string[]): Promise<void> {
    if (!ids.length) return;
    const [rulesCol, txCol] = await Promise.all([budgetDb.rules(), budgetDb.transactions()]);
    const rules = (await rulesCol.find({ email }).toArray()).sort(
        (a, b) => b.merchantContains.length - a.merchantContains.length,
    );
    const txs = await txCol
        .find({ email, _id: { $in: ids } })
        .project<Pick<TransactionDoc, '_id' | 'merchant' | 'categoryId'>>({ merchant: 1, categoryId: 1 })
        .toArray();

    const ops: AnyBulkWriteOperation<TransactionDoc>[] = [];
    for (const t of txs) {
        const merchant = t.merchant.toLowerCase();
        const categoryId = rules.find((r) => merchant.includes(r.merchantContains.toLowerCase()))?.categoryId;
        if (categoryId === t.categoryId) continue;
        ops.push({
            updateOne: {
                filter: { _id: t._id, email },
                update: categoryId ? { $set: { categoryId } } : { $unset: { categoryId: '' } },
            },
        });
    }
    if (ops.length) await txCol.bulkWrite(ops, { ordered: false });
}

async function accountFor(connection: ConnectionDoc, account: { name: string; last4?: string } | undefined) {
    const externalId = `chase:${account?.last4 ?? 'card'}`;
    const name = account?.last4 ? `${account.name} ...${account.last4}` : 'Chase';
    const doc = await (
        await budgetDb.accounts()
    ).findOneAndUpdate(
        { email: connection.email, connectionId: connection._id, externalId },
        {
            $set: { name, institution: 'Chase' },
            $setOnInsert: { _id: newId(), email: connection.email, hidden: false },
        },
        { upsert: true, returnDocument: 'after' },
    );
    return doc!._id;
}

export async function syncConnection(connection: ConnectionDoc, session: Session): Promise<ConnectionResult> {
    const result: ConnectionResult = { connectionId: connection._id, added: 0, skipped: false, errors: [] };
    const connections = await budgetDb.connections();
    const fail = async (message: string) => {
        await connections.updateOne(
            { _id: connection._id, email: connection.email },
            { $set: { status: 'error', errors: [message] } },
        );
        return { ...result, errors: [message] };
    };
    if (!hasGmail(session)) return fail('Cosmic needs Gmail access. Sign in with Google again and allow it.');

    const now = Date.now();
    const from = connection.lastSyncedAt
        ? connection.lastSyncedAt.getTime() - OVERLAP_DAYS * DAY_MS
        : now - FIRST_SYNC_DAYS * DAY_MS;
    let emails;
    try {
        emails = await chaseAlerts(session, new Date(from));
    } catch (err) {
        if (!(err instanceof TasksError)) throw err;
        return fail(
            err.code === 'unauthorized'
                ? 'Gmail access was removed. Sign in with Google again and allow it.'
                : "Couldn't read Gmail. Try again shortly.",
        );
    }

    const col = await budgetDb.transactions();
    const stamp = new Date();
    const ops: AnyBulkWriteOperation<TransactionDoc>[] = [];
    for (const e of emails) {
        const alert = parseChaseAlert(e.subject, e.text);
        if (!alert) continue;
        const accountId = await accountFor(connection, alert.account);
        ops.push({
            updateOne: {
                filter: { email: connection.email, connectionId: connection._id, externalId: e.id },
                update: {
                    $set: {
                        accountId,
                        date: alert.date ?? localDate(e.receivedAt),
                        amount: alert.amount || 0,
                        merchant: alert.merchant,
                        pending: false,
                        updatedAt: stamp,
                    },
                    $setOnInsert: { _id: newId(), email: connection.email, createdAt: stamp },
                },
                upsert: true,
            },
        });
    }
    const written = ops.length ? await col.bulkWrite(ops, { ordered: false }) : undefined;
    const touched = await col
        .find({ email: connection.email, connectionId: connection._id, updatedAt: stamp }, { projection: { _id: 1 } })
        .toArray();
    await categorize(
        connection.email,
        touched.map((t) => t._id),
    );

    await connections.updateOne(
        { _id: connection._id, email: connection.email },
        { $set: { status: 'ok', errors: [], lastSyncedAt: new Date(now) } },
    );
    return { ...result, added: written?.upsertedCount ?? 0 };
}

/** Skips connections checked within the last 30 seconds, or within `STALE_AFTER_MS` when `onlyStale`. */
export async function syncAll(
    email: string,
    session: Session,
    opts: { connectionId?: string; onlyStale?: boolean } = {},
): Promise<SyncResult> {
    const list = await (
        await budgetDb.connections()
    )
        .find({ email, ...(opts.connectionId && { _id: opts.connectionId }) })
        .toArray();
    const results: ConnectionResult[] = [];
    for (const connection of list) {
        const age = connection.lastSyncedAt ? Date.now() - connection.lastSyncedAt.getTime() : Infinity;
        if (age < (opts.onlyStale ? STALE_AFTER_MS : MIN_SYNC_GAP_MS)) {
            results.push({ connectionId: connection._id, added: 0, errors: [], skipped: true });
            continue;
        }
        try {
            results.push(await syncConnection(connection, session));
        } catch (err) {
            console.error('[budget] sync failed', connection._id, err);
            results.push({ connectionId: connection._id, added: 0, errors: ['Sync failed.'], skipped: false });
        }
    }
    return { connections: results };
}
