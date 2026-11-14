'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, Icon, ProgressRing, stagger, type IconName } from '@bradydallama/ui';
import { api } from '@/lib/apiClient';
import { dollars, syncIfStale, useOnBudgetChange } from '@/lib/budget/client';
import type { BudgetsResponse, BudgetStatus } from '@/lib/budget/model';
import { useToday } from '@/lib/tasks';

function summary(b: BudgetStatus) {
    const unit = b.period === 'weekly' ? 'week' : 'month';
    const over = b.state === 'over';
    const icon = over ? 'flame-1' : b.state === 'ahead' ? 'timer' : null;
    return (
        <span
            className="flex max-w-full items-center gap-1 text-xs"
            title={b.state === 'ahead' ? 'Ahead of pace' : undefined}
        >
            {icon && <Icon name={icon} size="xs" className="shrink-0" />}
            <span className="text-pretty text-center">
                {b.name}, {dollars(Math.abs(b.amount - b.spent), false)} {over ? 'over' : 'left'} this {unit}
                {b.state === 'ahead' && <span className="sr-only">, ahead of pace</span>}
            </span>
        </span>
    );
}

export function BudgetTiles({ staggerFrom = 0 }: { staggerFrom?: number }) {
    const today = useToday();
    const [budgets, setBudgets] = useState<BudgetStatus[]>([]);

    const load = useCallback(() => {
        if (!today) return;
        api<BudgetsResponse>(`/api/budget/budgets?date=${today}`)
            .then((res) => setBudgets(res.budgets))
            .catch(() => setBudgets([]));
    }, [today]);
    useOnBudgetChange(load);
    useEffect(() => {
        if (budgets.length) void syncIfStale();
    }, [budgets.length]);

    if (!budgets.length) return null;

    return (
        <section className="flex flex-col gap-1">
            <div className="flex items-center justify-between gap-2">
                <h2 className="text-md text-bubble">Budgets</h2>
                <Link href="/budget" className="text-xs text-bubble underline underline-offset-4">
                    Budget page
                </Link>
            </div>
            <div className="flex flex-wrap justify-center gap-3">
                {budgets.map((b, i) => (
                    <Link key={b.id} href="/budget" className="contents">
                        <Card
                            className="bd-in-fade flex w-[calc(50%-0.375rem)] flex-col items-center gap-2"
                            style={stagger(staggerFrom + i)}
                        >
                            <ProgressRing
                                value={b.amount ? b.spent / b.amount : 0}
                                label={`${b.name}: ${dollars(b.spent, false)} of ${dollars(b.amount, false)} this ${b.period === 'weekly' ? 'week' : 'month'}`}
                            >
                                <Icon name={b.icon as IconName} size="sm" className="text-secondary" />
                                <span className="text-sm">{dollars(b.spent, false)}</span>
                            </ProgressRing>
                            {summary(b)}
                        </Card>
                    </Link>
                ))}
            </div>
        </section>
    );
}
