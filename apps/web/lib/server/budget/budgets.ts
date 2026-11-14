import type { Budget, BudgetPeriod, BudgetPeriodResult, BudgetsResponse, BudgetStatus } from '@/lib/budget/model';
import { BUDGET_PERIODS } from '@/lib/budget/model';
import { budgetState, elapsedShare, periodRange, previousRange, type Range } from '@/lib/budget/periods';
import { invalid, isDate, isNumber, isString, newId, notFound, oneOf, requiredText } from '../userRoute';
import { budgetDb, type BudgetDoc, type TransactionDoc } from './db';
import { toTransaction } from './connections';

const HISTORY = 6;

const toBudget = (d: BudgetDoc): Budget => ({
    id: d._id,
    name: d.name,
    icon: d.icon,
    color: d.color,
    period: d.period,
    amount: d.amount,
    categoryIds: d.categoryIds,
    order: d.order,
});

type Fields = Pick<BudgetDoc, 'name' | 'icon' | 'color' | 'period' | 'amount' | 'categoryIds'>;

function fields(body: Record<string, unknown>, partial: boolean): Partial<Fields> {
    const out: Partial<Fields> = {};
    if (!partial || 'name' in body) out.name = requiredText(body.name, 'name', 60);
    if (!partial || 'icon' in body) {
        if (!isString(body.icon, 40) || !body.icon) throw invalid('icon is required.');
        out.icon = body.icon;
    }
    if (!partial || 'color' in body) {
        if (!isString(body.color, 32) || !body.color) throw invalid('color is required.');
        out.color = body.color;
    }
    if (!partial || 'period' in body) out.period = oneOf<BudgetPeriod>(body.period, BUDGET_PERIODS, 'period');
    if (!partial || 'amount' in body) {
        if (!isNumber(body.amount) || body.amount <= 0 || body.amount > 10_000_000)
            throw invalid('amount must be a positive number.');
        out.amount = Math.round(body.amount * 100) / 100;
    }
    if (!partial || 'categoryIds' in body) {
        const ids = body.categoryIds;
        if (!Array.isArray(ids) || ids.length > 200 || !ids.every((c) => isString(c, 64) && c))
            throw invalid('categoryIds must be a list.');
        if (!ids.length) throw invalid('Pick at least one category.');
        out.categoryIds = [...new Set(ids as string[])];
    }
    return out;
}

const within = (r: Range, d: string) => d >= r.start && d <= r.end;

const round = (n: number) => Math.round(n * 100) / 100;
const cents = (n: number) => Math.max(0, round(n));

export async function listBudgets(email: string, date: unknown): Promise<BudgetsResponse> {
    if (!isDate(date)) throw invalid('date must be YYYY-MM-DD.');
    const [budgetsCol, txCol, accountsCol] = await Promise.all([
        budgetDb.budgets(),
        budgetDb.transactions(),
        budgetDb.accounts(),
    ]);
    const [docs, hidden, first, connections] = await Promise.all([
        budgetsCol.find({ email }).sort({ order: 1 }).toArray(),
        accountsCol.distinct('_id', { email, hidden: true }),
        txCol
            .find({ email }, { projection: { date: 1 } })
            .sort({ date: 1 })
            .limit(1)
            .next(),
        budgetDb.connections().then((c) => c.find({ email }, { projection: { lastSyncedAt: 1 } }).toArray()),
    ]);
    const dataFrom = first?.date ?? date;

    const ranges = docs.map((b) => {
        const current = periodRange(b.period, date);
        const history: Range[] = [];
        for (let r = previousRange(b.period, current); history.length < HISTORY && r.end >= dataFrom;) {
            history.push(r);
            r = previousRange(b.period, r);
        }
        return { current, history };
    });
    const from = [date, ...ranges.map((r) => (r.history.at(-1) ?? r.current).start)].sort()[0];
    const to = [date, ...ranges.map((r) => r.current.end)].sort().at(-1)!;

    const txs = await txCol
        .find({ email, date: { $gte: from, $lte: to }, accountId: { $nin: hidden } })
        .sort({ date: -1, createdAt: -1 })
        .toArray();

    const budgets: BudgetStatus[] = docs.map((b, i) => {
        const { current, history } = ranges[i];
        const ids = new Set(b.categoryIds);
        let spent = 0;
        const past = history.map(() => 0);
        const inPeriod: TransactionDoc[] = [];
        for (const t of txs) {
            if (!t.categoryId || !ids.has(t.categoryId)) continue;
            if (within(current, t.date)) {
                spent -= t.amount;
                inPeriod.push(t);
                continue;
            }
            const h = history.findIndex((r) => within(r, t.date));
            if (h >= 0) past[h] -= t.amount;
        }
        const elapsed = elapsedShare(current, date);
        const results: BudgetPeriodResult[] = history.map((r, h) => ({
            ...r,
            spent: cents(past[h]),
            unspent: round(b.amount - cents(past[h])),
        }));
        return {
            ...toBudget(b),
            start: current.start,
            end: current.end,
            spent: cents(spent),
            previousSpent: results[0]?.spent ?? 0,
            history: results,
            unspentTotal: round(results.reduce((sum, r) => sum + Math.max(0, r.unspent), 0)),
            elapsed,
            state: budgetState(cents(spent), b.amount, elapsed),
            transactions: inPeriod.slice(0, 100).map(toTransaction),
        };
    });
    const dates = connections.map((c) => c.lastSyncedAt?.getTime()).filter((t): t is number => !!t);
    return { budgets, dataAsOf: dates.length ? new Date(Math.min(...dates)).toISOString() : undefined };
}

export async function createBudget(email: string, body: Record<string, unknown>): Promise<Budget> {
    const col = await budgetDb.budgets();
    const last = await col.find({ email }).sort({ order: -1 }).limit(1).next();
    const now = new Date();
    const doc: BudgetDoc = {
        ...(fields(body, false) as Fields),
        _id: newId(),
        email,
        order: (last?.order ?? 0) + 1,
        createdAt: now,
        updatedAt: now,
    };
    await col.insertOne(doc);
    return toBudget(doc);
}

export async function updateBudget(email: string, id: string, body: Record<string, unknown>): Promise<Budget> {
    const doc = await (
        await budgetDb.budgets()
    ).findOneAndUpdate(
        { _id: id, email },
        { $set: { ...fields(body, true), updatedAt: new Date() } },
        { returnDocument: 'after' },
    );
    if (!doc) throw notFound();
    return toBudget(doc);
}

export async function deleteBudget(email: string, id: string): Promise<void> {
    const { deletedCount } = await (await budgetDb.budgets()).deleteOne({ _id: id, email });
    if (!deletedCount) throw notFound();
}
