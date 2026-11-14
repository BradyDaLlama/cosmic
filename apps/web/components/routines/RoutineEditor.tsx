'use client';

import { useEffect, useRef, useState } from 'react';
import {
    Button,
    ColorPicker,
    Dialog,
    IconButton,
    IconPicker,
    iconNames,
    Input,
    type ColorSwatch,
    type IconName,
} from '@bradydallama/ui';
import { HabitBadge } from '@/components/habits/HabitBadge';
import { SortableList } from '@/components/SortableList';
import { HABIT_COLORS, habitColor, habitPresets, type HabitColor } from '@/lib/habits/model';
import { useHabits } from '@/lib/habits/store';
import { newId } from '@/lib/id';
import { MAX_STEPS, MAX_WAIT_MINUTES, type Routine, type RoutineStep } from '@/lib/routines/model';
import { createRoutine, deleteRoutine, updateRoutine } from '@/lib/routines/store';

const SWATCHES: ColorSwatch[] = habitPresets.map((c) => ({ value: c, ...HABIT_COLORS[c] }));

type RoutineEditorProps = {
    routine: Routine | null;
    open: boolean;
    onClose: () => void;
    onSaved?: (routine: Routine) => void;
    onDeleted?: () => void;
};

export function RoutineEditor({ routine, open, onClose, onSaved, onDeleted }: RoutineEditorProps) {
    const { habits } = useHabits();
    const [name, setName] = useState('');
    const [color, setColor] = useState<HabitColor>('lavender');
    const [icon, setIcon] = useState<IconName>('star-4');
    const [habitId, setHabitId] = useState<string | undefined>();
    const [steps, setSteps] = useState<RoutineStep[]>([]);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const nameRef = useRef<HTMLInputElement>(null);
    const [focusStep, setFocusStep] = useState<string | null>(null);

    useEffect(() => {
        if (!open) return;
        setName(routine?.name ?? '');
        setColor(routine?.color ?? 'lavender');
        setIcon(routine?.icon ?? 'star-4');
        setHabitId(routine?.habitId);
        setSteps(routine?.steps ?? [{ id: newId(), kind: 'task', title: '' }]);
        setConfirmDelete(false);
        if (!routine) requestAnimationFrame(() => nameRef.current?.focus());
    }, [open, routine]);

    useEffect(() => {
        if (!focusStep) return;
        requestAnimationFrame(() => document.getElementById(`step-${focusStep}`)?.focus());
        setFocusStep(null);
    }, [focusStep]);

    const cleanSteps = steps.filter((s) => s.kind === 'wait' || s.title.trim());
    const validWaits = steps.every((s) => s.kind === 'task' || (s.minutes >= 1 && s.minutes <= MAX_WAIT_MINUTES));
    const canSave = name.trim() !== '' && validWaits && cleanSteps.some((s) => s.kind === 'task');

    const update = (id: string, patch: Partial<RoutineStep>) =>
        setSteps((list) => list.map((s) => (s.id === id ? ({ ...s, ...patch } as RoutineStep) : s)));
    const add = (step: RoutineStep) => {
        setSteps((list) => [...list, step]);
        setFocusStep(step.id);
    };

    const save = async () => {
        const input = {
            name: name.trim(),
            color,
            icon,
            habitId,
            steps: cleanSteps.map((s) => (s.kind === 'task' ? { ...s, title: s.title.trim() } : s)),
        };
        if (routine) {
            void updateRoutine(routine, input);
            onClose();
        } else {
            const created = await createRoutine(input);
            onClose();
            if (created) onSaved?.(created);
        }
    };

    const preview = habitColor(color);

    return (
        <Dialog open={open} onClose={onClose} variant="sheet" title={routine ? 'Edit routine' : 'New routine'}>
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
                        placeholder="Evening skincare"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="flex-1"
                    />
                </div>

                <fieldset className="flex flex-col gap-2">
                    <legend className="bd-field-label pb-2">Steps</legend>
                    <SortableList
                        items={steps}
                        getKey={(s) => s.id}
                        onReorder={setSteps}
                        label={(_, i) => `step ${i + 1}`}
                        renderItem={(step, i, handle) => (
                            <div className="flex items-center gap-1">
                                {handle}
                                {step.kind === 'task' ? (
                                    <Input
                                        id={`step-${step.id}`}
                                        aria-label={`Step ${i + 1}`}
                                        placeholder="Cleanser"
                                        value={step.title}
                                        onChange={(e) => update(step.id, { title: e.target.value })}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && i === steps.length - 1 && step.title.trim()) {
                                                e.preventDefault();
                                                add({ id: newId(), kind: 'task', title: '' });
                                            }
                                        }}
                                        className="min-w-0 flex-1"
                                    />
                                ) : (
                                    <label className="flex min-w-0 flex-1 items-center gap-2 text-sm">
                                        <span className="shrink-0">Wait</span>
                                        <Input
                                            id={`step-${step.id}`}
                                            aria-label={`Step ${i + 1}: minutes to wait`}
                                            type="number"
                                            inputMode="numeric"
                                            min={1}
                                            max={MAX_WAIT_MINUTES}
                                            step={1}
                                            value={String(step.minutes)}
                                            onChange={(e) =>
                                                update(step.id, { minutes: Math.round(Number(e.target.value)) })
                                            }
                                            className="w-20"
                                        />
                                        <span className="shrink-0">minutes</span>
                                    </label>
                                )}
                                <IconButton
                                    icon="mark-x"
                                    label={`Remove step ${i + 1}`}
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setSteps((list) => list.filter((s) => s.id !== step.id))}
                                />
                            </div>
                        )}
                    />
                    <div className="flex gap-2">
                        <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            disabled={steps.length >= MAX_STEPS}
                            onClick={() => add({ id: newId(), kind: 'task', title: '' })}
                        >
                            + Step
                        </Button>
                        <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            icon="timer"
                            disabled={steps.length >= MAX_STEPS}
                            onClick={() => add({ id: newId(), kind: 'wait', minutes: 5 })}
                        >
                            + Wait
                        </Button>
                    </div>
                    <p className="text-xs opacity-70">
                        A wait starts its timer once every step above it is done; the steps below it unlock when it
                        ends.
                    </p>
                </fieldset>

                <fieldset className="flex flex-col gap-2">
                    <legend className="bd-field-label pb-2">Marks a habit done</legend>
                    <div className="flex flex-wrap gap-2">
                        <Button
                            type="button"
                            size="sm"
                            variant={!habitId ? 'primary' : 'ghost'}
                            aria-pressed={!habitId}
                            onClick={() => setHabitId(undefined)}
                        >
                            None
                        </Button>
                        {habits.map((h) => (
                            <Button
                                key={h.id}
                                type="button"
                                size="sm"
                                variant={habitId === h.id ? 'primary' : 'ghost'}
                                aria-pressed={habitId === h.id}
                                onClick={() => setHabitId(h.id)}
                            >
                                {h.name}
                            </Button>
                        ))}
                    </div>
                    {habits.length === 0 && <p className="text-xs opacity-70">Add a habit to link it here.</p>}
                </fieldset>

                <ColorPicker label="Color" swatches={SWATCHES} tools value={preview.fill} onChange={setColor} />

                <IconPicker
                    label="Icon"
                    icons={iconNames}
                    value={icon}
                    onChange={setIcon}
                    accent={preview.fill}
                    accentInk={preview.ink}
                    maxHeight="10rem"
                />

                <div className="flex items-center justify-between gap-2 pt-1">
                    {routine ? (
                        confirmDelete ? (
                            <span className="flex items-center gap-2">
                                <Button
                                    type="button"
                                    variant="danger"
                                    onClick={() => {
                                        void deleteRoutine(routine);
                                        onClose();
                                        onDeleted?.();
                                    }}
                                >
                                    Delete routine
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
                            {routine ? 'Save' : 'Add routine'}
                        </Button>
                    )}
                </div>
            </form>
        </Dialog>
    );
}
