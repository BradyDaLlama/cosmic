'use client';

import { useMemo, useState } from 'react';
import { Checkbox } from '@bradydallama/ui';
import { PLAID_CATEGORIES, plaidCategoryLabel, type PlaidCategoryGroup } from '@/lib/budget/categories';

type Props = {
    selected: Set<string>;
    onChange: (next: Set<string>) => void;
    usage: Record<string, number>;
    hint?: string;
};

export function PlaidCategoryPicker({ selected, onChange, usage, hint }: Props) {
    const [expanded, setExpanded] = useState<Set<string>>(
        () =>
            new Set(
                PLAID_CATEGORIES.filter(
                    (g) => !selected.has(g.primary) && g.detailed.some((d) => selected.has(d.code)),
                ).map((g) => g.primary),
            ),
    );

    const groups = useMemo(
        () => [...PLAID_CATEGORIES].sort((a, b) => (usage[b.primary] ?? 0) - (usage[a.primary] ?? 0)),
        [usage],
    );

    const toggle = (code: string, on: boolean, group?: PlaidCategoryGroup) => {
        const next = new Set(selected);
        if (on) next.add(code);
        else next.delete(code);
        if (group && code === group.primary) group.detailed.forEach((d) => next.delete(d.code));
        onChange(next);
    };

    const count = (code: string) => (usage[code] ? ` (${usage[code]})` : '');

    return (
        <div className="flex flex-col gap-2">
            {selected.size > 0 ? (
                <p className="text-xs opacity-80">{[...selected].map(plaidCategoryLabel).join(', ')}</p>
            ) : (
                hint && <p className="text-xs opacity-70">{hint}</p>
            )}
            <ul className="flex max-h-72 flex-col gap-1 overflow-y-auto pr-1">
                {groups.map((g) => {
                    const whole = selected.has(g.primary);
                    const isOpen = expanded.has(g.primary);
                    const some = !whole && g.detailed.some((d) => selected.has(d.code));
                    return (
                        <li key={g.primary} className="flex flex-col gap-1">
                            <div className="flex items-center justify-between gap-2">
                                <Checkbox
                                    label={`${g.label}${count(g.primary)}${some ? ', some' : ''}`}
                                    checked={whole}
                                    onChange={(e) => toggle(g.primary, e.target.checked, g)}
                                />
                                <button
                                    type="button"
                                    className="text-xs underline-offset-2 hover:underline"
                                    aria-expanded={isOpen}
                                    onClick={() => {
                                        const next = new Set(expanded);
                                        if (isOpen) next.delete(g.primary);
                                        else next.add(g.primary);
                                        setExpanded(next);
                                    }}
                                >
                                    {isOpen ? 'Hide' : `${g.detailed.length} kinds`}
                                </button>
                            </div>
                            {isOpen && (
                                <ul className="flex flex-col gap-1 pl-7">
                                    {g.detailed.map((d) => (
                                        <li key={d.code}>
                                            <Checkbox
                                                label={`${d.label}${count(d.code)}`}
                                                checked={whole || selected.has(d.code)}
                                                disabled={whole}
                                                onChange={(e) => toggle(d.code, e.target.checked)}
                                            />
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}
