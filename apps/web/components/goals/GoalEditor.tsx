'use client';

import { useEffect, useRef, useState } from 'react';
import {
    Button,
    ColorPicker,
    Dialog,
    IconPicker,
    Input,
    Switch,
    type ColorSwatch,
    type IconName,
} from '@bradydallama/ui';
import { HabitBadge } from '@/components/habits/HabitBadge';
import type { Better, Goal } from '@/lib/goals/model';
import { createGoal, deleteGoal, updateGoal } from '@/lib/goals/store';
import { HABIT_COLORS, HABIT_ICONS, habitColor, habitPresets, type HabitColor } from '@/lib/habits/model';

const SWATCHES: ColorSwatch[] = habitPresets.map((c) => ({ value: c, ...HABIT_COLORS[c] }));

type GoalEditorProps = {
    goal: Goal | null;
    open: boolean;
    onClose: () => void;
    onCreated?: (goal: Goal) => void;
};

export function GoalEditor({ goal, open, onClose, onCreated }: GoalEditorProps) {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [unit, setUnit] = useState('');
    const [color, setColor] = useState<HabitColor>('sky');
    const [icon, setIcon] = useState<IconName>('medal-1');
    const [hasTarget, setHasTarget] = useState(false);
    const [target, setTarget] = useState('');
    const [better, setBetter] = useState<Better>('higher');
    const [confirmDelete, setConfirmDelete] = useState(false);
    const nameRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!open) return;
        setName(goal?.name ?? '');
        setDescription(goal?.description ?? '');
        setUnit(goal?.unit ?? '');
        setColor(goal?.color ?? 'sky');
        setIcon(goal?.icon ?? 'medal-1');
        setHasTarget(goal?.target !== undefined);
        setTarget(goal?.target !== undefined ? String(goal.target) : '');
        setBetter(goal?.better ?? 'higher');
        setConfirmDelete(false);
        if (!goal) requestAnimationFrame(() => nameRef.current?.focus());
    }, [open, goal]);

    const targetNumber = Number(target);
    const targetValid = !hasTarget || (target.trim() !== '' && Number.isFinite(targetNumber));
    const canSave = name.trim() !== '' && targetValid;

    const save = async () => {
        const input = {
            name,
            description,
            unit,
            color,
            icon,
            better,
            target: hasTarget ? targetNumber : undefined,
        };
        if (goal) {
            void updateGoal(goal, input);
            onClose();
        } else {
            const created = await createGoal(input);
            onClose();
            if (created) onCreated?.(created);
        }
    };

    const preview = habitColor(color);

    return (
        <Dialog open={open} onClose={onClose} variant="sheet" title={goal ? 'Edit goal' : 'New goal'}>
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
                        ref={nameRef}
                        label="Name"
                        placeholder="Bench press"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="flex-1"
                    />
                </div>

                <div className="flex gap-2">
                    <Input
                        label="Unit"
                        placeholder="lb"
                        value={unit}
                        onChange={(e) => setUnit(e.target.value)}
                        className="w-24"
                    />
                    <Input
                        label="Description"
                        placeholder="Optional"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        className="min-w-0 flex-1"
                    />
                </div>

                <div className="flex flex-col gap-2">
                    <Switch
                        label="Working toward a target"
                        checked={hasTarget}
                        onChange={(e) => setHasTarget(e.target.checked)}
                    />
                    {hasTarget ? (
                        <>
                            <Input
                                label={unit ? `Target (${unit})` : 'Target'}
                                type="number"
                                inputMode="decimal"
                                step="any"
                                value={target}
                                onChange={(e) => setTarget(e.target.value)}
                            />
                            <p className="text-xs opacity-70">
                                Progress runs from your first entry to the target, up or down.
                            </p>
                        </>
                    ) : (
                        <fieldset className="flex flex-col gap-2">
                            <legend className="bd-field-label pb-2">Progress means</legend>
                            <div className="flex gap-2">
                                {(['higher', 'lower'] as const).map((b) => (
                                    <Button
                                        key={b}
                                        type="button"
                                        size="sm"
                                        variant={better === b ? 'primary' : 'ghost'}
                                        aria-pressed={better === b}
                                        onClick={() => setBetter(b)}
                                    >
                                        {b === 'higher' ? 'Going up' : 'Going down'}
                                    </Button>
                                ))}
                            </div>
                        </fieldset>
                    )}
                </div>

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

                <div className="flex items-center justify-between gap-2 pt-1">
                    {goal ? (
                        confirmDelete ? (
                            <span className="flex items-center gap-2">
                                <Button
                                    type="button"
                                    variant="danger"
                                    onClick={() => {
                                        void deleteGoal(goal);
                                        onClose();
                                    }}
                                >
                                    Delete goal and entries
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
                            {goal ? 'Save' : 'Add goal'}
                        </Button>
                    )}
                </div>
            </form>
        </Dialog>
    );
}
