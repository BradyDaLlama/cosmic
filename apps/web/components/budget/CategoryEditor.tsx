'use client';

import { useEffect, useRef, useState } from 'react';
import { Button, ColorPicker, Dialog, IconPicker, Input, type IconName } from '@bradydallama/ui';
import { HabitBadge } from '@/components/habits/HabitBadge';
import { api } from '@/lib/apiClient';
import { notifyBudgetChanged } from '@/lib/budget/client';
import { CATEGORY_KINDS, type Category, type CategoryInput, type CategoryKind } from '@/lib/budget/model';
import { habitColor } from '@/lib/habits/model';
import { BUDGET_ICONS, SWATCHES } from './look';
import { PlaidCategoryPicker } from './PlaidCategoryPicker';

const KIND: Record<CategoryKind, { label: string; hint: string }> = {
    spending: { label: 'Spending', hint: 'Purchases. Budgets can count it.' },
    income: { label: 'Income', hint: 'Money coming in.' },
    ignore: {
        label: 'Ignore',
        hint: 'Transfers and card payments. Never counted in any budget, so nothing is counted twice.',
    },
};

type Props = {
    category: Category | null;
    open: boolean;
    usage: Record<string, number>;
    onClose: () => void;
    onSaved?: (category: Category) => void;
};

export function CategoryEditor({ category, open, usage, onClose, onSaved }: Props) {
    const [name, setName] = useState('');
    const [kind, setKind] = useState<CategoryKind>('spending');
    const [color, setColor] = useState('peach');
    const [icon, setIcon] = useState<IconName>('pricetag');
    const [matches, setMatches] = useState<Set<string>>(new Set());
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const nameRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!open) return;
        setName(category?.name ?? '');
        setKind(category?.kind ?? 'spending');
        setColor(category?.color ?? 'peach');
        setIcon((category?.icon as IconName) ?? 'pricetag');
        setMatches(new Set(category?.plaidMatches ?? []));
        setConfirmDelete(false);
        setError(null);
        if (!category) requestAnimationFrame(() => nameRef.current?.focus());
    }, [open, category]);

    const save = async () => {
        const input: CategoryInput = { name: name.trim(), kind, color, icon, plaidMatches: [...matches] };
        setSaving(true);
        setError(null);
        try {
            const saved = category
                ? await api<Category>(`/api/budget/categories/${category.id}`, { method: 'PATCH', body: input })
                : await api<Category>('/api/budget/categories', { method: 'POST', body: input });
            notifyBudgetChanged();
            onSaved?.(saved);
            onClose();
        } catch {
            setError('The category could not be saved. Try again.');
        } finally {
            setSaving(false);
        }
    };

    const remove = async () => {
        if (!category) return;
        setSaving(true);
        try {
            await api(`/api/budget/categories/${category.id}`, { method: 'DELETE' });
            notifyBudgetChanged();
            onClose();
        } catch {
            setError('The category could not be deleted. Try again.');
        } finally {
            setSaving(false);
        }
    };

    const preview = habitColor(color);

    return (
        <Dialog open={open} onClose={onClose} variant="sheet" title={category ? 'Edit category' : 'New category'}>
            <form
                className="flex flex-col gap-4"
                onSubmit={(e) => {
                    e.preventDefault();
                    if (name.trim() && !saving) void save();
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

                <fieldset className="flex flex-col gap-2">
                    <legend className="bd-field-label pb-2">Kind</legend>
                    <div className="flex gap-2">
                        {CATEGORY_KINDS.map((k) => (
                            <Button
                                key={k}
                                type="button"
                                size="sm"
                                variant={kind === k ? 'primary' : 'ghost'}
                                aria-pressed={kind === k}
                                onClick={() => setKind(k)}
                            >
                                {KIND[k].label}
                            </Button>
                        ))}
                    </div>
                    <p className="text-xs opacity-70">{KIND[kind].hint}</p>
                </fieldset>

                <fieldset className="flex flex-col gap-2">
                    <legend className="bd-field-label pb-2">Also file these Plaid categories here</legend>
                    {open && (
                        <PlaidCategoryPicker
                            key={category?.id ?? 'new'}
                            selected={matches}
                            onChange={setMatches}
                            usage={usage}
                            hint="Optional. Rules you make from the inbox file by merchant name instead."
                        />
                    )}
                </fieldset>

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
                    {category ? (
                        confirmDelete ? (
                            <span className="flex items-center gap-2">
                                <Button type="button" variant="danger" disabled={saving} onClick={() => void remove()}>
                                    Delete category and its rules
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
                        <Button type="submit" disabled={!name.trim() || saving}>
                            {category ? 'Save' : 'Add category'}
                        </Button>
                    )}
                </div>
            </form>
        </Dialog>
    );
}
