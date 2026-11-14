'use client';

import { useState } from 'react';
import { Button, Card, type IconName } from '@bradydallama/ui';
import { HabitBadge } from '@/components/habits/HabitBadge';
import { api } from '@/lib/apiClient';
import { notifyBudgetChanged, useCategories } from '@/lib/budget/client';
import type { Category } from '@/lib/budget/model';
import { CategoryEditor } from './CategoryEditor';

const KIND_LABEL = { spending: 'spending', income: 'income', ignore: 'ignored' } as const;

export function CategoriesSection() {
    const { categories, rules, loaded } = useCategories();
    const [editing, setEditing] = useState<Category | 'new' | null>(null);
    const [busy, setBusy] = useState<string | null>(null);

    const removeRule = async (id: string) => {
        setBusy(id);
        try {
            await api(`/api/budget/rules/${id}`, { method: 'DELETE' });
            notifyBudgetChanged();
        } finally {
            setBusy(null);
        }
    };

    if (!loaded) return null;

    return (
        <section className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
                <h2 className="text-md text-bubble">Categories</h2>
                <Button type="button" size="sm" variant="ghost" onClick={() => setEditing('new')}>
                    New category
                </Button>
            </div>

            {categories.length === 0 ? (
                <p className="text-xs opacity-80">
                    Budgets count your categories. Make one, then file merchants into it from the inbox.
                </p>
            ) : (
                <Card className="flex flex-col gap-3">
                    {categories.map((c) => {
                        const own = rules.filter((r) => r.categoryId === c.id);
                        return (
                            <div key={c.id} className="flex flex-col gap-1">
                                <div className="flex items-center gap-3">
                                    <HabitBadge icon={c.icon as IconName} color={c.color} />
                                    <span className="flex min-w-0 flex-1 flex-col">
                                        <span className="truncate">{c.name}</span>
                                        <span className="truncate text-xs opacity-70">{KIND_LABEL[c.kind]}</span>
                                    </span>
                                    <button
                                        type="button"
                                        className="text-xs underline-offset-2 hover:underline"
                                        onClick={() => setEditing(c)}
                                    >
                                        Edit
                                    </button>
                                </div>
                                {own.length > 0 && (
                                    <ul className="flex flex-wrap gap-1 pl-11">
                                        {own.map((r) => (
                                            <li key={r.id}>
                                                <button
                                                    type="button"
                                                    disabled={busy === r.id}
                                                    className="rounded-full border px-2 py-0.5 text-xs"
                                                    title={`Delete the rule for ${r.merchantContains}`}
                                                    aria-label={`Delete the rule for ${r.merchantContains}`}
                                                    onClick={() => void removeRule(r.id)}
                                                >
                                                    {r.merchantContains} x
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        );
                    })}
                </Card>
            )}

            <CategoryEditor
                open={editing !== null}
                category={editing === 'new' ? null : editing}
                onClose={() => setEditing(null)}
            />
        </section>
    );
}
