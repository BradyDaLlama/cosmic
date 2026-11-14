'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button, Card, Input } from '@bradydallama/ui';
import { api } from '@/lib/apiClient';
import { dollars, useCategories, useOnBudgetChange } from '@/lib/budget/client';
import { toISODate } from '@/lib/dates';
import type { BudgetAccount, BudgetTransaction, TransactionsResponse } from '@/lib/budget/model';

const PAGE = 50;

const RANGES = {
    all: { label: 'Any time', range: () => ({}) },
    month: {
        label: 'This month',
        range: () => {
            const d = new Date();
            return { from: toISODate(new Date(d.getFullYear(), d.getMonth(), 1)) };
        },
    },
    lastMonth: {
        label: 'Last month',
        range: () => {
            const d = new Date();
            return {
                from: toISODate(new Date(d.getFullYear(), d.getMonth() - 1, 1)),
                to: toISODate(new Date(d.getFullYear(), d.getMonth(), 0)),
            };
        },
    },
    d30: { label: 'Last 30 days', range: () => ({ from: toISODate(new Date(Date.now() - 29 * 86_400_000)) }) },
    d90: { label: 'Last 90 days', range: () => ({ from: toISODate(new Date(Date.now() - 89 * 86_400_000)) }) },
    year: { label: 'This year', range: () => ({ from: `${new Date().getFullYear()}-01-01` }) },
} as const;
type RangeKey = keyof typeof RANGES;

const selectClass = 'rounded-full border-2 border-current bg-transparent px-3 py-1 text-xs [&>option]:text-black';

export function TransactionsSection() {
    const { categories } = useCategories();
    const [accounts, setAccounts] = useState<BudgetAccount[]>([]);
    const [q, setQ] = useState('');
    const [debounced, setDebounced] = useState('');
    const [accountId, setAccountId] = useState('');
    const [categoryId, setCategoryId] = useState('');
    const [range, setRange] = useState<RangeKey>('d30');
    const [flow, setFlow] = useState('');
    const [rows, setRows] = useState<BudgetTransaction[]>([]);
    const [hasMore, setHasMore] = useState(false);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const id = setTimeout(() => setDebounced(q.trim()), 300);
        return () => clearTimeout(id);
    }, [q]);

    const query = useCallback(
        (offset: number) => {
            const p = new URLSearchParams({ limit: String(PAGE), offset: String(offset) });
            if (debounced) p.set('q', debounced);
            if (accountId) p.set('accountId', accountId);
            if (categoryId) p.set('categoryId', categoryId);
            if (flow) p.set('flow', flow);
            const { from, to } = RANGES[range].range() as { from?: string; to?: string };
            if (from) p.set('from', from);
            if (to) p.set('to', to);
            return api<TransactionsResponse>(`/api/budget/transactions?${p}`);
        },
        [debounced, accountId, categoryId, flow, range],
    );

    const load = useCallback(() => {
        setLoading(true);
        query(0)
            .then((res) => {
                setRows(res.transactions);
                setHasMore(res.hasMore);
            })
            .catch(() => setRows([]))
            .finally(() => setLoading(false));
    }, [query]);
    useOnBudgetChange(load);

    const loadAccounts = useCallback(() => {
        api<{ accounts: BudgetAccount[] }>('/api/budget/accounts')
            .then((res) => setAccounts(res.accounts))
            .catch(() => setAccounts([]));
    }, []);
    useOnBudgetChange(loadAccounts);

    const more = () => {
        setLoading(true);
        query(rows.length)
            .then((res) => {
                setRows((prev) => [...prev, ...res.transactions]);
                setHasMore(res.hasMore);
            })
            .finally(() => setLoading(false));
    };

    const accountName = (id: string) => {
        const a = accounts.find((x) => x.id === id);
        return a?.name ?? '';
    };
    const categoryName = (id?: string) => categories.find((c) => c.id === id)?.name;
    const total = rows.reduce((sum, t) => sum + t.amount, 0);
    const filtered = !!(debounced || accountId || categoryId || flow);

    return (
        <section className="flex flex-col gap-2">
            <h2 className="text-md text-bubble">Transactions</h2>
            <Input
                label="Search"
                placeholder="Merchant"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="w-full"
            />
            <div className="flex flex-wrap gap-2">
                <select
                    aria-label="When"
                    className={selectClass}
                    value={range}
                    onChange={(e) => setRange(e.target.value as RangeKey)}
                >
                    {(Object.keys(RANGES) as RangeKey[]).map((k) => (
                        <option key={k} value={k}>
                            {RANGES[k].label}
                        </option>
                    ))}
                </select>
                <select
                    aria-label="Money in or out"
                    className={selectClass}
                    value={flow}
                    onChange={(e) => setFlow(e.target.value)}
                >
                    <option value="">In and out</option>
                    <option value="out">Spent</option>
                    <option value="in">Received</option>
                </select>
                <select
                    aria-label="Your category"
                    className={selectClass}
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                >
                    <option value="">Any of your categories</option>
                    <option value="none">Not filed</option>
                    {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                            {c.name}
                        </option>
                    ))}
                </select>
                {accounts.length > 1 && (
                    <select
                        aria-label="Account"
                        className={selectClass}
                        value={accountId}
                        onChange={(e) => setAccountId(e.target.value)}
                    >
                        <option value="">All accounts</option>
                        {accounts.map((a) => (
                            <option key={a.id} value={a.id}>
                                {a.name}
                            </option>
                        ))}
                    </select>
                )}
            </div>

            {rows.length > 0 && (
                <p className="text-xs opacity-80">
                    {rows.length}
                    {hasMore ? '+' : ''} shown, net {dollars(total, true)}
                    {filtered ? ' for these filters' : ''}
                </p>
            )}

            <Card className="flex flex-col gap-2">
                {rows.length === 0 && <p className="text-sm">{loading ? 'Loading...' : 'Nothing matches.'}</p>}
                <ul className="flex flex-col gap-2">
                    {rows.map((t) => (
                        <li key={t.id} className="flex justify-between gap-3 text-sm">
                            <span className="flex min-w-0 flex-col">
                                <span className="truncate">
                                    {t.merchant}
                                    {t.pending && <span className="text-xs"> (pending)</span>}
                                </span>
                                <span className="truncate text-xs opacity-70">
                                    {[t.date, accountName(t.accountId), categoryName(t.categoryId)]
                                        .filter(Boolean)
                                        .join(', ')}
                                </span>
                            </span>
                            <span className={t.amount > 0 ? 'text-secondary' : ''}>{dollars(t.amount, true)}</span>
                        </li>
                    ))}
                </ul>
                {hasMore && (
                    <Button type="button" size="sm" variant="ghost" disabled={loading} onClick={more}>
                        {loading ? 'Loading...' : 'Show more'}
                    </Button>
                )}
            </Card>
        </section>
    );
}
