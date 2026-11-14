'use client';

import { useCallback, useState } from 'react';
import { Button, Card, Input } from '@bradydallama/ui';
import { api } from '@/lib/apiClient';
import { dollars, notifyBudgetChanged, useCategories, useOnBudgetChange } from '@/lib/budget/client';
import type { Category } from '@/lib/budget/model';
import { CategoryEditor } from './CategoryEditor';

type InboxRow = { merchant: string; count: number; spent: number; lastDate: string };

export function InboxSection({ usage }: { usage: Record<string, number> }) {
    const [rows, setRows] = useState<InboxRow[] | null>(null);
    const [filing, setFiling] = useState<string | null>(null);
    const [newFor, setNewFor] = useState<string | null>(null);

    const load = useCallback(() => {
        api<{ merchants: InboxRow[] }>('/api/budget/inbox')
            .then((res) => setRows(res.merchants))
            .catch(() => setRows(null));
    }, []);
    useOnBudgetChange(load);

    if (!rows?.length) return null;

    return (
        <section className="flex flex-col gap-2">
            <h2 className="text-md text-bubble">Needs a category</h2>
            <p className="text-xs opacity-80">
                Plaid could not tell what these are. Filing a merchant makes a rule for all of its purchases.
            </p>
            <Card className="flex flex-col gap-2">
                {rows.map((r) => (
                    <div key={r.merchant} className="flex flex-col gap-2">
                        <button
                            type="button"
                            className="flex justify-between gap-3 text-left text-sm"
                            aria-expanded={filing === r.merchant}
                            onClick={() => setFiling(filing === r.merchant ? null : r.merchant)}
                        >
                            <span className="flex min-w-0 flex-col">
                                <span className="truncate">{r.merchant}</span>
                                <span className="text-xs opacity-70">
                                    {r.count} {r.count === 1 ? 'purchase' : 'purchases'}, last {r.lastDate}
                                </span>
                            </span>
                            <span>{dollars(r.spent)}</span>
                        </button>
                        {filing === r.merchant && (
                            <FileMerchant
                                merchant={r.merchant}
                                onNewCategory={() => setNewFor(r.merchant)}
                                onDone={() => setFiling(null)}
                            />
                        )}
                    </div>
                ))}
            </Card>
            <CategoryEditor
                open={newFor !== null}
                category={null}
                usage={usage}
                onClose={() => setNewFor(null)}
                onSaved={(c: Category) => {
                    if (newFor) void makeRule(newFor, c.id);
                }}
            />
        </section>
    );
}

async function makeRule(merchantContains: string, categoryId: string) {
    await api('/api/budget/rules', { method: 'POST', body: { merchantContains, categoryId } });
    notifyBudgetChanged();
}

function FileMerchant({
    merchant,
    onNewCategory,
    onDone,
}: {
    merchant: string;
    onNewCategory: () => void;
    onDone: () => void;
}) {
    const { categories } = useCategories();
    const [text, setText] = useState(merchant);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const file = async (categoryId: string) => {
        setSaving(true);
        setError(null);
        try {
            await makeRule(text.trim(), categoryId);
            onDone();
        } catch {
            setError('That rule could not be saved. Try again.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="flex flex-col gap-2 pb-2">
            <Input
                label="Merchant name contains"
                value={text}
                onChange={(e) => setText(e.target.value)}
                className="w-full"
            />
            <div className="flex flex-wrap gap-2">
                {categories.map((c) => (
                    <Button
                        key={c.id}
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={saving || text.trim().length < 2}
                        onClick={() => void file(c.id)}
                    >
                        {c.name}
                    </Button>
                ))}
                <Button type="button" size="sm" variant="secondary" disabled={saving} onClick={onNewCategory}>
                    New category
                </Button>
            </div>
            {error && (
                <p role="alert" className="text-xs">
                    {error}
                </p>
            )}
        </div>
    );
}
