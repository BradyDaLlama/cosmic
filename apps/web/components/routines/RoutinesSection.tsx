'use client';

import { useEffect, useState } from 'react';
import { Button, Card, Icon, Pill, useLongPress } from '@bradydallama/ui';
import { HabitBadge, HabitCheck } from '@/components/habits/HabitBadge';
import { habitColor } from '@/lib/habits/model';
import { useHabits } from '@/lib/habits/store';
import {
    emptyRun,
    formatCountdown,
    progress,
    stepStates,
    waitLabel,
    type Routine,
    type RoutineRun,
    type StepState,
} from '@/lib/routines/model';
import {
    dismissRoutinesError,
    routinesSynced,
    skipWait,
    startOver,
    tick,
    toggleStep,
    useRoutines,
} from '@/lib/routines/store';
import { useToday } from '@/lib/tasks';

import { RoutineEditor } from './RoutineEditor';

export function RoutinesSection() {
    const today = useToday();
    const { routines, runs, loaded, error } = useRoutines(today);
    const [openId, setOpenId] = useState<string | null>(null);
    const [editing, setEditing] = useState<Routine | 'new' | null>(null);
    const now = useSecondClock(Object.values(runs).some((r) => !r.completedAt && Object.keys(r.waits).length > 0));
    const sorted = [...routines].sort((a, b) => a.order - b.order);
    const open = sorted.find((r) => r.id === openId) ?? null;
    const ready = loaded && today;

    useEffect(() => {
        if (now) tick(now);
    }, [now]);

    return (
        <section className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
                <h2 className="flex items-center gap-2 text-md text-bubble">
                    Routines
                    {!routinesSynced && (
                        <Pill tone="outline" className="text-xs" title="Saved in this browser in demo mode">
                            this device
                        </Pill>
                    )}
                </h2>
                {ready && routines.length > 0 && (
                    <button
                        type="button"
                        onClick={() => setEditing('new')}
                        className="text-xs text-bubble underline underline-offset-4"
                    >
                        + New routine
                    </button>
                )}
            </div>

            {ready && !error && routines.length === 0 && (
                <Card className="flex flex-col items-start gap-3">
                    <p className="text-sm opacity-80">
                        Save a checklist you repeat, like a workout or a skincare routine, with timed waits between
                        steps.
                    </p>
                    <Button icon="star-4" onClick={() => setEditing('new')}>
                        Add a routine
                    </Button>
                </Card>
            )}

            {ready && sorted.length > 0 && (
                <ul className="flex flex-wrap gap-2" aria-label="Routines">
                    {sorted.map((routine) => (
                        <li key={routine.id}>
                            <RoutinePill
                                routine={routine}
                                run={runs[routine.id]}
                                now={now ?? Date.now()}
                                open={routine.id === openId}
                                onToggle={() => setOpenId((id) => (id === routine.id ? null : routine.id))}
                                onEdit={() => setEditing(routine)}
                            />
                        </li>
                    ))}
                </ul>
            )}

            {open && today && (
                <RoutinePanel routine={open} run={runs[open.id] ?? emptyRun(open.id, today)} now={now ?? Date.now()} />
            )}

            {error && (
                <p role="alert" className="flex items-center justify-between gap-2 text-xs text-bubble">
                    <span className="opacity-80">{error}</span>
                    <button type="button" className="underline underline-offset-4" onClick={dismissRoutinesError}>
                        Dismiss
                    </button>
                </p>
            )}

            <RoutineEditor
                routine={editing === 'new' ? null : editing}
                open={editing !== null}
                onClose={() => setEditing(null)}
                onSaved={(routine) => setOpenId(routine.id)}
                onDeleted={() => setOpenId(null)}
            />
        </section>
    );
}

function useSecondClock(active: boolean): number | null {
    const [now, setNow] = useState<number | null>(null);
    useEffect(() => {
        setNow(Date.now());
        const id = setInterval(() => setNow(Date.now()), active ? 1000 : 30_000);
        return () => clearInterval(id);
    }, [active]);
    return now;
}

function RoutinePill({
    routine,
    run,
    now,
    open,
    onToggle,
    onEdit,
}: {
    routine: Routine;
    run?: RoutineRun;
    now: number;
    open: boolean;
    onToggle: () => void;
    onEdit: () => void;
}) {
    const { fill } = habitColor(routine.color);
    const { handlers, pressing } = useLongPress({ onTap: onToggle, onLongPress: onEdit });
    const p = run ? progress(routine, run, now) : { done: 0, total: routine.steps.length };
    const status = run?.completedAt ? 'done' : p.done > 0 ? `${p.done}/${p.total}` : null;
    return (
        <button
            type="button"
            aria-expanded={open}
            aria-keyshortcuts="Shift+F10"
            title="Tap to open. Hold to edit."
            {...handlers}
            className="flex items-center gap-2 rounded-full py-1 pr-3 pl-1 text-sm"
            style={{
                ...handlers.style,
                scale: pressing ? '0.92' : '1',
                transition: pressing ? 'scale 500ms ease-in' : 'scale 150ms ease-out',
                background: 'var(--color-bubble)',
                color: 'var(--color-text)',
                border: 'var(--border-outline) solid var(--color-bg)',
                outline: `var(--border-outline) solid ${fill}`,
            }}
        >
            <HabitBadge icon={routine.icon} color={routine.color} />
            <span>{routine.name}</span>
            {status === 'done' ? (
                <Icon name="mark-check" size="xs" label="Done today" />
            ) : (
                status && <span className="text-xs opacity-60">{status}</span>
            )}
        </button>
    );
}

function RoutinePanel({ routine, run, now }: { routine: Routine; run: RoutineRun; now: number }) {
    const { habits } = useHabits();
    const states = stepStates(routine, run, now);
    const p = progress(routine, run, now);
    const habit = habits.find((h) => h.id === routine.habitId);
    const started = run.done.length > 0 || run.skipped.length > 0 || Object.keys(run.waits).length > 0;

    return (
        <Card className="flex flex-col gap-1">
            <div className="flex items-center justify-between gap-2 pb-1">
                <span className="text-xs opacity-70">
                    {run.completedAt
                        ? `Done today${habit ? `, and ${habit.name} is marked done.` : '.'}`
                        : `${p.done} of ${p.total} done.${habit ? ` Finishing marks ${habit.name} done.` : ''}`}
                </span>
            </div>

            {routine.steps.length === 0 && (
                <p className="text-sm opacity-70">No steps yet. Edit the routine to add some.</p>
            )}

            <ol className="flex flex-col">
                {routine.steps.map((step, i) =>
                    step.kind === 'task' ? (
                        <li key={step.id} className="flex min-h-10 items-center gap-3">
                            <HabitCheck
                                done={states[i].status === 'done'}
                                color={routine.color}
                                disabled={states[i].status === 'locked'}
                                label={
                                    states[i].status === 'done' ? `Uncheck ${step.title}` : `Check off ${step.title}`
                                }
                                onToggle={() => void toggleStep(routine, step.id)}
                            />
                            <span
                                className={`min-w-0 flex-1 ${states[i].status === 'done' ? 'line-through opacity-60' : ''} ${states[i].status === 'locked' ? 'opacity-40' : ''}`}
                            >
                                {step.title}
                            </span>
                        </li>
                    ) : (
                        <WaitRow
                            key={step.id}
                            minutes={step.minutes}
                            state={states[i]}
                            color={routine.color}
                            onSkip={() => void skipWait(routine, step.id)}
                        />
                    ),
                )}
            </ol>

            <div className="flex items-center justify-between gap-2 pt-2">
                <span className="text-xs opacity-60">Hold a routine to edit it.</span>
                {started && (
                    <Button type="button" size="sm" variant="ghost" onClick={() => void startOver(routine)}>
                        Start over
                    </Button>
                )}
            </div>
        </Card>
    );
}

function WaitRow({
    minutes,
    state,
    color,
    onSkip,
}: {
    minutes: number;
    state: StepState;
    color: string;
    onSkip: () => void;
}) {
    const { fill } = habitColor(color);
    const running = state.kind === 'wait' && state.status === 'running';
    const total = minutes * 60_000;
    const left = running ? state.remainingMs : 0;
    let text = `${waitLabel(minutes)}, starts when the steps above are done`;
    if (state.status === 'running') text = `${formatCountdown(left)} left`;
    else if (state.status === 'done') text = `Waited ${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`;
    else if (state.status === 'skipped') text = `Skipped the ${minutes}-minute wait`;
    else if (state.status === 'locked') text = waitLabel(minutes);

    return (
        <li
            className={`flex min-h-10 items-center gap-3 ${state.status === 'locked' ? 'opacity-40' : ''}`}
            aria-live={running ? 'polite' : undefined}
        >
            <span className="grid size-7 shrink-0 place-items-center">
                <Icon name="timer" size="sm" />
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span
                    className={`text-sm tabular-nums ${state.status === 'done' || state.status === 'skipped' ? 'opacity-60' : ''}`}
                >
                    {text}
                </span>
                {running && (
                    <span aria-hidden className="block h-1.5 overflow-hidden rounded-full bg-current/15">
                        <span
                            className="block h-full rounded-full transition-[width] duration-1000 ease-linear"
                            style={{ width: `${(1 - left / total) * 100}%`, background: fill }}
                        />
                    </span>
                )}
            </span>
            {running && (
                <button type="button" onClick={onSkip} className="shrink-0 text-xs underline underline-offset-4">
                    Skip
                </button>
            )}
        </li>
    );
}
