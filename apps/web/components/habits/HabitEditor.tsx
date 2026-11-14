'use client';

import { useEffect, useRef, useState } from 'react';
import { Button, ColorPicker, Dialog, IconPicker, Input, type ColorSwatch } from '@bradydallama/ui';
import {
    HABIT_COLORS,
    HABIT_ICONS,
    habitColor,
    habitPresets,
    history,
    periodLabel,
    periodNoun,
    streak,
    type Habit,
    type HabitColor,
    type HabitPeriod,
} from '@/lib/habits/model';
import { createHabit, deleteHabit, updateHabit, useHabits } from '@/lib/habits/store';
import type { IconName } from '@bradydallama/ui';
import { HabitBadge } from './HabitBadge';

type HabitEditorProps = {
    habit: Habit | null;
    open: boolean;
    today: string;
    onClose: () => void;
};

const PERIODS: HabitPeriod[] = ['daily', 'weekly', 'monthly'];

const SWATCHES: ColorSwatch[] = habitPresets.map((c) => ({ value: c, ...HABIT_COLORS[c] }));
export function HabitEditor({ habit, open, today, onClose }: HabitEditorProps) {
    const { checkins } = useHabits();
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [period, setPeriod] = useState<HabitPeriod>('daily');
    const [color, setColor] = useState<HabitColor>('peach');
    const [icon, setIcon] = useState<IconName>('heart');
    const [confirmDelete, setConfirmDelete] = useState(false);
    const nameRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!open) return;
        setName(habit?.name ?? '');
        setDescription(habit?.description ?? '');
        setPeriod(habit?.period ?? 'daily');
        setColor(habit?.color ?? 'peach');
        setIcon(habit?.icon ?? 'heart');
        setConfirmDelete(false);
        // The native dialog moves focus after autoFocus would run.
        if (!habit) requestAnimationFrame(() => nameRef.current?.focus());
    }, [open, habit]);

    const save = async () => {
        const input = { name, description, period, color, icon };
        if (habit) void updateHabit(habit, input);
        else await createHabit(input);
        onClose();
    };

    const preview = habitColor(color);

    return (
        <Dialog open={open} onClose={onClose} variant="sheet" title={habit ? 'Edit habit' : 'New habit'}>
            <form
                className="flex flex-col gap-4"
                onSubmit={(e) => {
                    e.preventDefault();
                    if (name.trim()) void save();
                }}
            >
                <div className="flex items-end gap-3">
                    <span className="mb-1.5">
                        <HabitBadge icon={icon} color={color} size="md" />
                    </span>
                    <Input
                        label="Name"
                        placeholder="Work out"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        ref={nameRef}
                        className="flex-1"
                    />
                </div>

                <Input
                    label="Description"
                    placeholder="Optional"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                />

                <fieldset className="flex flex-col gap-2">
                    <legend className="bd-field-label pb-2">Resets</legend>
                    <div className="flex gap-2">
                        {PERIODS.map((p) => (
                            <Button
                                key={p}
                                type="button"
                                size="sm"
                                variant={period === p ? 'primary' : 'ghost'}
                                aria-pressed={period === p}
                                onClick={() => setPeriod(p)}
                            >
                                {periodNoun[p].label}
                            </Button>
                        ))}
                    </div>
                    {habit && habit.period !== period && (
                        <p className="text-xs opacity-70">
                            Changing this starts a fresh streak; past check-ins stay saved.
                        </p>
                    )}
                </fieldset>

                <ColorPicker label="Color" swatches={SWATCHES} tools value={preview.fill} onChange={setColor} />

                <IconPicker
                    label="Icon"
                    icons={HABIT_ICONS}
                    value={icon}
                    onChange={setIcon}
                    accent={preview.fill}
                    accentInk={preview.ink}
                    maxHeight="10rem"
                />

                {habit && <HabitHistory habit={habit} checkins={checkins} today={today} />}

                <div className="flex items-center justify-between gap-2 pt-1">
                    {habit ? (
                        confirmDelete ? (
                            <span className="flex items-center gap-2">
                                <Button
                                    type="button"
                                    variant="danger"
                                    onClick={() => {
                                        void deleteHabit(habit);
                                        onClose();
                                    }}
                                >
                                    Delete habit and history
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
                        <Button type="submit" disabled={!name.trim()}>
                            {habit ? 'Save' : 'Add habit'}
                        </Button>
                    )}
                </div>
            </form>
        </Dialog>
    );
}

function HabitHistory({
    habit,
    checkins,
    today,
}: {
    habit: Habit;
    checkins: Parameters<typeof history>[1];
    today: string;
}) {
    const color = habitColor(habit.color);
    const dots = history(habit, checkins, today, 7);
    const n = streak(habit, checkins, today);
    const noun = periodNoun[habit.period];
    return (
        <div className="flex flex-col gap-2">
            <span className="bd-field-label">
                Last 7 {noun.units}
                {n > 0 && `, ${n} ${n === 1 ? noun.unit : noun.units} streak`}
            </span>
            <ol className="flex justify-between gap-1">
                {dots.map((d) => (
                    <li key={d.key} className="flex flex-col items-center gap-1 text-xs">
                        <span
                            aria-label={`${periodLabel(d.key)}: ${d.done ? 'done' : 'not done'}`}
                            className="block size-6 rounded-full border-2"
                            style={{
                                borderColor: d.done ? color.fill : 'currentColor',
                                background: d.done ? color.fill : 'transparent',
                                opacity: d.done ? 1 : 0.35,
                            }}
                        />
                        <span className="opacity-70">{periodLabel(d.key)}</span>
                    </li>
                ))}
            </ol>
        </div>
    );
}
