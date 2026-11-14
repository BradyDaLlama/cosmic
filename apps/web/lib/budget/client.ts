'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/apiClient';
import type { CategoriesResponse } from './model';

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

export const dollars = (n: number, cents = !Number.isInteger(n)) =>
    new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: cents ? 2 : 0,
        maximumFractionDigits: cents ? 2 : 0,
    }).format(n);
