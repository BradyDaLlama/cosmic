'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/apiClient';
import { addDays, formatClock, todayISO, toISODate } from '@/lib/dates';
import type { CategoriesResponse, SyncResult } from './model';

const BUDGET_CHANGED = 'cosmic:budget-changed';

export function notifyBudgetChanged() {
    window.dispatchEvent(new Event(BUDGET_CHANGED));
}

export function useOnBudgetChange(load: () => void) {
    useEffect(() => {
        load();
        window.addEventListener(BUDGET_CHANGED, load);
        return () => window.removeEventListener(BUDGET_CHANGED, load);
    }, [load]);
}

let staleSync: Promise<void> | null = null;

/** Once per page load; the server only syncs connections it considers stale. */
export function syncIfStale(): Promise<void> {
    staleSync ??= api<SyncResult>('/api/budget/sync', { method: 'POST', body: { onlyStale: true } })
        .then((r) => {
            if (r.connections.some((c) => !c.skipped)) notifyBudgetChanged();
        })
        .catch(() => undefined);
    return staleSync;
}

export function useCategories() {
    const [data, setData] = useState<CategoriesResponse>({ categories: [], rules: [] });
    const [loaded, setLoaded] = useState(false);
    const load = useCallback(() => {
        api<CategoriesResponse>('/api/budget/categories')
            .then((res) => {
                setData(res);
                setLoaded(true);
            })
            .catch(() => setLoaded(true));
    }, []);
    useOnBudgetChange(load);
    return { ...data, loaded };
}

/** "today 6:12 AM", "yesterday 6:12 AM", or "Tue, Nov 12". */
export function formatAsOf(iso: string): string {
    const at = new Date(iso);
    const day = toISODate(at);
    const today = todayISO();
    if (day === today) return `today ${formatClock(at)}`;
    if (day === addDays(today, -1)) return `yesterday ${formatClock(at)}`;
    return at.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

export const dollars = (n: number, cents = !Number.isInteger(n)) =>
    new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: cents ? 2 : 0,
        maximumFractionDigits: cents ? 2 : 0,
    }).format(n);
