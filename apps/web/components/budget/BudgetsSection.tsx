'use client';

import { useState } from 'react';
import { Button, Card, Icon, ProgressBar, type IconName } from '@bradydallama/ui';
import { HabitBadge } from '@/components/habits/HabitBadge';
import { dollars, formatAsOf, notifyBudgetChanged, useCategories } from '@/lib/budget/client';
import type { Budget, BudgetsResponse, BudgetStatus } from '@/lib/budget/model';
import { BudgetEditor } from './BudgetEditor';

const noun = (b: Budget) => (b.period === 'weekly' ? 'week' : 'month');

export function BudgetsSection({ data, error }: { data: BudgetsResponse | null; error: string | null }) {
    const [editing, setEditing] = useState<Budget | 'new' | null>(null);
    const [openId, setOpenId] = useState<string | null>(null);

    const { categories } = useCategories();
    const categoryName = (id: string) => categories.find((c) => c.id === id)?.name;

    const budgets = data?.budgets ?? [];

    return (
        <section className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
                <h2 className="text-md text-bubble">Budgets</h2>
                {budgets.length > 0 && (
                    <Button type="button" size="sm" variant="ghost" onClick={() => setEditing('new')}>
                        New budget
                    </Button>
                )}
            </div>

            {data?.dataAsOf && <p className="text-xs opacity-70">Chase alerts checked {formatAsOf(data.dataAsOf)}</p>}

            {error && (
                <p role="alert" className="text-xs">
                    {error}
                </p>
            )}

            {data && budgets.length === 0 && (
                <Card className="flex flex-col items-start gap-3">
                    <p className="text-sm">
                        Set a weekly or monthly limit for the kinds of spending you care about, like eating out.
                    </p>
                    <Button type="button" onClick={() => setEditing('new')}>
                        New budget
                    </Button>
                </Card>
            )}

            {budgets.map((b) => (
                <BudgetCard
                    key={b.id}
                    budget={b}
                    open={openId === b.id}
                    onToggle={() => setOpenId(openId === b.id ? null : b.id)}
                    onEdit={() => setEditing(b)}
                    categoryName={categoryName}
                />
            ))}

            <BudgetEditor
                open={editing !== null}
                budget={editing === 'new' ? null : editing}
                onClose={() => setEditing(null)}
                onSaved={notifyBudgetChanged}
            />
        </section>
    );
}

function BudgetState({ budget: b }: { budget: BudgetStatus }) {
    if (b.state === 'over')
        return (
            <span className="flex items-center gap-1 text-xs">
                <Icon name="flame-1" size="xs" />
                {dollars(Math.round((b.spent - b.amount) * 100) / 100)} over
            </span>
        );
    if (b.state === 'ahead')
        return (
            <span className="flex items-center gap-1 text-xs">
                <Icon name="timer" size="xs" />
                Ahead of pace, {dollars(b.amount - b.spent)} left
            </span>
        );
    return <span className="text-xs opacity-80">{dollars(b.amount - b.spent)} left</span>;
}

function BudgetCard({
    budget: b,
    open,
    onToggle,
    onEdit,
    categoryName,
}: {
    budget: BudgetStatus;
    open: boolean;
    onToggle: () => void;
    onEdit: () => void;
    categoryName: (id: string) => string | undefined;
}) {
    const counts = b.categoryIds.map(categoryName).filter((n): n is string => !!n);
    return (
        <Card className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
                <HabitBadge icon={b.icon as IconName} color={b.color} />
                <button
                    type="button"
                    className="flex min-w-0 flex-1 flex-col items-start text-left"
                    aria-expanded={open}
                    onClick={onToggle}
                >
                    <span className="truncate">{b.name}</span>
                    <span className="text-xs">
                        {dollars(b.spent)} of {dollars(b.amount)} this {noun(b)}
                    </span>
                </button>
                <button type="button" className="text-xs underline-offset-2 hover:underline" onClick={onEdit}>
                    Edit
                </button>
            </div>
            <ProgressBar value={b.amount ? b.spent / b.amount : 0} label={`${b.name}: spent`} />
            <div className="flex items-center justify-between gap-2">
                <BudgetState budget={b} />
                <span className="text-xs opacity-70">
                    Last {noun(b)} {dollars(b.previousSpent)}
                </span>
            </div>

            {open && (
                <div className="flex flex-col gap-2 pt-1">
                    <p className="text-xs opacity-70">{counts.join(', ')}</p>
                    <BudgetHistory budget={b} />
                    {b.transactions.length === 0 ? (
                        <p className="text-xs">Nothing spent this {noun(b)} yet.</p>
                    ) : (
                        <ul className="flex flex-col gap-1">
                            {b.transactions.map((t) => (
                                <li key={t.id} className="flex justify-between gap-3 text-sm">
                                    <span className="flex min-w-0 flex-col">
                                        <span className="truncate">
                                            {t.merchant}
                                            {t.pending && <span className="text-xs"> (pending)</span>}
                                        </span>
                                        <span className="text-xs opacity-70">{t.date}</span>
                                    </span>
                                    <span>{dollars(-t.amount)}</span>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}
        </Card>
    );
}

function BudgetHistory({ budget: b }: { budget: BudgetStatus }) {
    if (!b.history.length) return null;
    const unit = b.period === 'weekly' ? 'weeks' : 'months';
    return (
        <div className="flex flex-col gap-1">
            <span className="bd-field-label">
                Unspent in the last {b.history.length} {b.history.length === 1 ? noun(b) : unit}:{' '}
                {dollars(b.unspentTotal)}
            </span>
            <ul className="flex flex-col gap-1">
                {b.history.map((h) => (
                    <li key={h.start} className="flex justify-between gap-3 text-xs">
                        <span className="opacity-70">{periodName(b, h.start)}</span>
                        <span>
                            {dollars(h.spent)} spent,{' '}
                            {h.unspent >= 0 ? `${dollars(h.unspent)} left` : `${dollars(-h.unspent)} over`}
                        </span>
                    </li>
                ))}
            </ul>
        </div>
    );
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function periodName(b: Budget, start: string) {
    const [, m, d] = start.split('-').map(Number);
    return b.period === 'monthly' ? MONTHS[m - 1] : `Week of ${MONTHS[m - 1]} ${d}`;
}
