'use client';

import { useEffect, useRef, useState } from 'react';
import { Button, Checkbox, ColorPicker, Dialog, IconPicker, Input, type IconName } from '@bradydallama/ui';
import { HabitBadge } from '@/components/habits/HabitBadge';
import { api } from '@/lib/apiClient';
import { useCategories } from '@/lib/budget/client';
import { BUDGET_PERIODS, type Budget, type BudgetInput, type BudgetPeriod } from '@/lib/budget/model';
import { habitColor } from '@/lib/habits/model';
import { BUDGET_ICONS, SWATCHES } from './look';

const PERIOD_LABEL: Record<BudgetPeriod, string> = { weekly: 'Weekly', monthly: 'Monthly' };

type Props = {
    budget: Budget | null;
    open: boolean;
    onClose: () => void;
    onSaved: () => void;
};

export function BudgetEditor({ budget, open, onClose, onSaved }: Props) {
    const { categories } = useCategories();
    const [name, setName] = useState('');
    const [amount, setAmount] = useState('');
    const [period, setPeriod] = useState<BudgetPeriod>('weekly');
    const [color, setColor] = useState('peach');
    const [icon, setIcon] = useState<IconName>('coins');
    const [mine, setMine] = useState<Set<string>>(new Set());
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const nameRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!open) return;
        setName(budget?.name ?? '');
        setAmount(budget ? String(budget.amount) : '');
        setPeriod(budget?.period ?? 'weekly');
        setColor(budget?.color ?? 'peach');
        setIcon((budget?.icon as IconName) ?? 'coins');
        setMine(new Set(budget?.categoryIds ?? []));
        setConfirmDelete(false);
        setError(null);
        if (!budget) requestAnimationFrame(() => nameRef.current?.focus());
    }, [open, budget]);

    const spendingCategories = categories.filter((c) => c.kind !== 'ignore');
    const value = Number(amount);
    const canSave = !!name.trim() && Number.isFinite(value) && value > 0 && mine.size > 0 && !saving;

    const save = async () => {
        const input: BudgetInput = {
            name: name.trim(),
            amount: value,
            period,
            color,
            icon,
            categoryIds: [...mine],
        };
        setSaving(true);
        setError(null);
        try {
            if (budget) await api(`/api/budget/budgets/${budget.id}`, { method: 'PATCH', body: input });
            else await api('/api/budget/budgets', { method: 'POST', body: input });
            onSaved();
            onClose();
        } catch {
            setError('The budget could not be saved. Try again.');
        } finally {
            setSaving(false);
        }
    };

    const remove = async () => {
        if (!budget) return;
        setSaving(true);
        try {
            await api(`/api/budget/budgets/${budget.id}`, { method: 'DELETE' });
            onSaved();
            onClose();
        } catch {
            setError('The budget could not be deleted. Try again.');
        } finally {
            setSaving(false);
        }
    };

    const preview = habitColor(color);

    return (
        <Dialog open={open} onClose={onClose} variant="sheet" title={budget ? 'Edit budget' : 'New budget'}>
            <form
                className="flex flex-col gap-4"
                onSubmit={(e) => {
                    e.preventDefault();
                    if (canSave) void save();
                }}
            >
                <div className="flex items-end gap-3">
                    <span className="mb-1.5">
                        <HabitBadge icon={icon} color={color} size="md" />
                    </span>
                    <Input
                        label="Name"
                        placeholder="Eating out"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        ref={nameRef}
                        className="flex-1"
                    />
                </div>

                <div className="flex items-end gap-3">
                    <Input
                        label="Amount"
                        placeholder="150"
                        inputMode="decimal"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
                        className="flex-1"
                    />
                    <fieldset className="flex flex-col">
                        <legend className="bd-field-label pb-2">Resets</legend>
                        <div className="flex gap-2">
                            {BUDGET_PERIODS.map((p) => (
                                <Button
                                    key={p}
                                    type="button"
                                    size="sm"
                                    variant={period === p ? 'primary' : 'ghost'}
                                    aria-pressed={period === p}
                                    onClick={() => setPeriod(p)}
                                >
                                    {PERIOD_LABEL[p]}
                                </Button>
                            ))}
                        </div>
                    </fieldset>
                </div>

                {spendingCategories.length === 0 ? (
                    <p className="text-xs opacity-80">
                        Budgets count your categories. Make one under Categories first.
                    </p>
                ) : (
                    <fieldset className="flex flex-col gap-1">
                        <legend className="bd-field-label pb-2">Counts these categories</legend>
                        {spendingCategories.map((c) => (
                            <Checkbox
                                key={c.id}
                                label={c.name}
                                checked={mine.has(c.id)}
                                onChange={(e) => {
                                    const next = new Set(mine);
                                    if (e.target.checked) next.add(c.id);
                                    else next.delete(c.id);
                                    setMine(next);
                                }}
                            />
                        ))}
                    </fieldset>
                )}

                <ColorPicker label="Color" swatches={SWATCHES} tools value={preview.fill} onChange={setColor} />

                <IconPicker
                    label="Icon"
                    icons={BUDGET_ICONS}
                    value={icon}
                    onChange={setIcon}
                    accent={preview.fill}
                    accentInk={preview.ink}
                    maxHeight="10rem"
                />

                {error && (
                    <p role="alert" className="text-xs">
                        {error}
                    </p>
                )}

                <div className="flex items-center justify-between gap-2 pt-1">
                    {budget ? (
                        confirmDelete ? (
                            <span className="flex items-center gap-2">
                                <Button type="button" variant="danger" disabled={saving} onClick={() => void remove()}>
                                    Delete budget
                                </Button>
                                <Button type="button" variant="ghost" onClick={() => setConfirmDelete(false)}>
                                    Cancel
                                </Button>
                            </span>
                        ) : (
                            <Button
                                type="button"
                                variant="secondary"
                                icon="mark-x"
                                onClick={() => setConfirmDelete(true)}
                            >
                                Delete
                            </Button>
                        )
                    ) : (
                        <span />
                    )}
                    {!confirmDelete && (
                        <Button type="submit" disabled={!canSave}>
                            {budget ? 'Save' : 'Add budget'}
                        </Button>
                    )}
                </div>
            </form>
        </Dialog>
    );
}
