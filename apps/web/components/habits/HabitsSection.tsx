'use client';

import { useState } from 'react';
import { Button, Card, Icon, Pill, useLongPress } from '@bradydallama/ui';
import {
    groupByPeriod,
    habitColor,
    history,
    isDone,
    periodKey,
    periodNoun,
    statusLine,
    streak,
    type CheckIn,
    type Habit,
} from '@/lib/habits/model';
import { dismissHabitsError, setHabitDone, useHabits, habitsSynced } from '@/lib/habits/store';
import { useToday } from '@/lib/tasks';
import { HabitBadge, HabitCheckMark } from './HabitBadge';
import { HabitEditor } from './HabitEditor';
import { HabitTracker } from './HabitTracker';

export function HabitsSection() {
    const today = useToday();
    const { habits, checkins, loaded, error } = useHabits();
    const [editing, setEditing] = useState<Habit | 'new' | null>(null);
    const [trackingId, setTrackingId] = useState<string | null>(null);
    const tracking = habits.find((h) => h.id === trackingId) ?? null;
    const ready = loaded && today;

    return (
        <section className="flex flex-col gap-1">
            <div className="flex items-center justify-between gap-2">
                <h2 className="flex items-center gap-2 text-md text-bubble">
                    Habits
                    {!habitsSynced && (
                        <Pill
                            tone="outline"
                            className="text-xs"
                            title="Habits are saved in this browser until the database is set up"
                        >
                            this device
                        </Pill>
                    )}
                </h2>
                {ready && habits.length > 0 && (
                    <button
                        type="button"
                        onClick={() => setEditing('new')}
                        className="text-xs text-bubble underline underline-offset-4"
                    >
                        + New habit
                    </button>
                )}
            </div>

            {/* 30px = 12px padding + half the 36px row, so corner circles sit concentric with the corners. */}
            <Card className="flex flex-col gap-1 rounded-[30px] p-3">
                {!ready && (
                    <ul aria-hidden className="flex flex-col gap-2 py-1">
                        {[0, 1].map((i) => (
                            <li key={i} className="flex h-10 items-center gap-3">
                                <span className="size-9 rounded-full bg-current opacity-15" />
                                <span className="h-3 flex-1 rounded-full bg-current opacity-15" />
                            </li>
                        ))}
                    </ul>
                )}

                {ready && !error && habits.length === 0 && (
                    <div className="flex flex-col items-start gap-3 py-1">
                        <p className="text-sm opacity-80">
                            Track yes-or-no habits you want to keep up every day, week or month.
                        </p>
                        <Button icon="star-4" onClick={() => setEditing('new')}>
                            Add a habit
                        </Button>
                    </div>
                )}

                {ready &&
                    groupByPeriod(habits).map((group, gi) => (
                        <div key={group.period} className={gi > 0 ? 'pt-2' : ''}>
                            {groupByPeriod(habits).length > 1 && (
                                <h3 className="pb-1 text-xs opacity-70">{periodNoun[group.period].label}</h3>
                            )}
                            <ul className="flex flex-col gap-1">
                                {group.habits.map((habit) => (
                                    <HabitRow
                                        key={habit.id}
                                        habit={habit}
                                        checkins={checkins}
                                        today={today}
                                        onOpen={() => setTrackingId(habit.id)}
                                    />
                                ))}
                            </ul>
                        </div>
                    ))}

                {error && (
                    <p role="alert" className="flex items-center justify-between gap-2 pt-1 text-xs">
                        <span className="opacity-80">{error}</span>
                        <button type="button" className="underline underline-offset-4" onClick={dismissHabitsError}>
                            Dismiss
                        </button>
                    </p>
                )}
            </Card>

            {today && (
                <HabitTracker
                    habit={tracking}
                    checkins={checkins}
                    today={today}
                    onClose={() => setTrackingId(null)}
                    onEdit={(habit) => {
                        setTrackingId(null);
                        setEditing(habit);
                    }}
                />
            )}

            {today && (
                <HabitEditor
                    habit={editing === 'new' ? null : editing}
                    open={editing !== null}
                    today={today}
                    onClose={() => setEditing(null)}
                />
            )}
        </section>
    );
}

const HISTORY_LENGTH = 7;

function HabitRow({
    habit,
    checkins,
    today,
    onOpen,
}: {
    habit: Habit;
    checkins: CheckIn[];
    today: string;
    onOpen: () => void;
}) {
    const done = isDone(habit, checkins, today);
    const { fill } = habitColor(habit.color);
    const noun = periodNoun[habit.period];
    const current = streak(habit, checkins, today);
    const dots = history(habit, checkins, today, HISTORY_LENGTH);
    const toggle = () => void setHabitDone(habit, periodKey(habit.period, today), !done);
    const { handlers, pressing } = useLongPress({ onTap: toggle, onLongPress: onOpen });

    return (
        <li className="flex min-h-9 items-stretch gap-3">
            <button
                type="button"
                role="checkbox"
                aria-checked={done}
                aria-label={`${habit.name}, ${statusLine(habit, checkins, today)}`}
                aria-description={`Tap to mark ${done ? 'not done' : 'done'} ${noun.now}. Hold for history.`}
                aria-keyshortcuts="Shift+F10"
                title="Tap to check off. Hold for history."
                {...handlers}
                className="flex min-w-0 flex-1 items-stretch gap-3 rounded-2xl text-left"
                style={{
                    ...handlers.style,
                    scale: pressing ? '0.97' : '1',
                    transition: pressing ? 'scale 500ms ease-in' : 'scale 150ms ease-out',
                }}
            >
                <span className="grid w-9 shrink-0 place-items-center self-stretch">
                    <HabitBadge icon={habit.icon} color={habit.color} />
                </span>
                <span className="flex min-w-0 flex-1 flex-col justify-center gap-1">
                    <span className="truncate">{habit.name}</span>
                    <span aria-hidden className="flex items-center gap-2">
                        {dots.map((d, i) => (
                            <span
                                key={d.key}
                                className={`block rounded-full ${i === dots.length - 1 ? 'size-2' : 'size-1.5'}`}
                                style={{
                                    background: d.done ? fill : 'currentColor',
                                    opacity: d.done ? 1 : 0.2,
                                    outline: d.done ? 'var(--border-outline) solid var(--color-bg)' : undefined,
                                }}
                            />
                        ))}
                    </span>
                </span>
                {current > 0 && (
                    <span
                        className="flex shrink-0 items-center gap-0.5 self-center text-xs"
                        title={`${current} ${current === 1 ? noun.unit : noun.units} in a row`}
                    >
                        <Icon name="flame-1" size="xs" />
                        {current}
                    </span>
                )}
                <span className="grid w-9 shrink-0 place-items-center self-stretch">
                    <HabitCheckMark done={done} color={habit.color} />
                </span>
            </button>
        </li>
    );
}
