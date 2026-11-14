'use client';

import { useCallback, useState } from 'react';
import { api, loadErrorMessage } from '@/lib/apiClient';
import { useOnBudgetChange } from '@/lib/budget/client';
import type { BudgetsResponse } from '@/lib/budget/model';
import { useToday } from '@/lib/tasks';
import { BankConnections } from './BankConnections';
import { BudgetsSection } from './BudgetsSection';
import { CategoriesSection } from './CategoriesSection';
import { InboxSection } from './InboxSection';
import { TransactionsSection } from './TransactionsSection';

export function BudgetScreen() {
    const today = useToday();
    const [data, setData] = useState<BudgetsResponse | null>(null);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(() => {
        if (!today) return;
        api<BudgetsResponse>(`/api/budget/budgets?date=${today}`)
            .then((res) => {
                setData(res);
                setError(null);
            })
            .catch((err) => setError(loadErrorMessage(err, 'budgets')));
    }, [today]);
    useOnBudgetChange(load);

    const usage = data?.usage ?? {};
    return (
        <>
            <BudgetsSection data={data} error={error} />
            <InboxSection usage={usage} />
            <TransactionsSection />
            <CategoriesSection usage={usage} />
            <BankConnections />
        </>
    );
}
