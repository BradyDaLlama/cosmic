'use client';

import { useState } from 'react';
import { Button, Card, Pill, ProgressBar } from '@bradydallama/ui';
import { HabitBadge } from '@/components/habits/HabitBadge';
import {
    dailySeries,
    entriesFor,
    formatChange,
    formatDate,
    formatValue,
    summarize,
    type Goal,
    type GoalEntry,
} from '@/lib/goals/model';
import { dismissGoalsError, useGoals, goalsSynced } from '@/lib/goals/store';
import { habitColor } from '@/lib/habits/model';
import { useToday } from '@/lib/tasks';
import { GoalEditor } from './GoalEditor';
import { Sparkline } from './GoalChart';
import { GoalSheet } from './GoalSheet';

export function GoalsSection() {
    const today = useToday();
    const { goals, entries, loaded, error } = useGoals();
    const [openId, setOpenId] = useState<string | null>(null);
    const [logFirst, setLogFirst] = useState(false);
    const [editing, setEditing] = useState<Goal | 'new' | null>(null);
    const open = goals.find((g) => g.id === openId) ?? null;
    const ready = loaded && today;
    const sorted = [...goals].sort((a, b) => a.order - b.order);

    return (
        <section className="flex flex-col gap-1">
            <div className="flex items-center justify-between gap-2">
                <h2 className="flex items-center gap-2 text-md text-bubble">
                    Goals
                    {!goalsSynced && (
                        <Pill
                            tone="outline"
                            className="text-xs"
                            title="Goals are saved in this browser until the database is set up"
                        >
                            this device
                        </Pill>
                    )}
                </h2>
                {ready && goals.length > 0 && (
                    <button
                        type="button"
                        onClick={() => setEditing('new')}
                        className="text-xs text-bubble underline underline-offset-4"
                    >
                        + New goal
                    </button>
                )}
            </div>

            {!ready && (
                <Card aria-hidden className="flex h-16 items-center gap-3">
                    <span className="size-8 rounded-full bg-current opacity-15" />
                    <span className="h-3 flex-1 rounded-full bg-current opacity-15" />
                </Card>
            )}

            {ready && !error && goals.length === 0 && (
                <Button icon="star-4" onClick={() => setEditing('new')} className="self-start">
                    Add a goal
                </Button>
            )}

            {ready && sorted.length > 0 && (
                <ul className="flex flex-col gap-3">
                    {sorted.map((goal) => (
                        <li key={goal.id}>
                            <GoalCard
                                goal={goal}
                                entries={entries}
                                onOpen={() => {
                                    setLogFirst(false);
                                    setOpenId(goal.id);
                                }}
                                onLog={() => {
                                    setLogFirst(true);
                                    setOpenId(goal.id);
                                }}
                            />
                        </li>
                    ))}
                </ul>
            )}

            {error && (
                <p role="alert" className="flex items-center justify-between gap-2 pt-1 text-xs text-bubble">
                    <span className="opacity-80">{error}</span>
                    <button type="button" className="underline underline-offset-4" onClick={dismissGoalsError}>
                        Dismiss
                    </button>
                </p>
            )}

            {today && (
                <GoalSheet
                    goal={open}
                    entries={entries}
                    today={today}
                    logFirst={logFirst}
                    onClose={() => setOpenId(null)}
                    onEdit={(goal) => {
                        setOpenId(null);
                        setEditing(goal);
                    }}
                />
            )}
            <GoalEditor
                goal={editing === 'new' ? null : editing}
                open={editing !== null}
                onClose={() => setEditing(null)}
                onCreated={(goal) => {
                    setLogFirst(true);
                    setOpenId(goal.id);
                }}
            />
        </section>
    );
}

function GoalCard({
    goal,
    entries,
    onOpen,
    onLog,
}: {
    goal: Goal;
    entries: GoalEntry[];
    onOpen: () => void;
    onLog: () => void;
}) {
    const summary = summarize(goal, entries);
    const series = dailySeries(entriesFor(goal, entries), summary.better);
    const { fill } = habitColor(goal.color);
    const { latest, first } = summary;

    let detail = 'No entries yet';
    if (latest && first && latest !== first)
        detail = `${formatChange(summary.change!, goal.unit)} since ${formatDate(first.date)}`;
    else if (latest) detail = `Logged ${formatDate(latest.date)}`;

    return (
        <Card className="flex flex-col gap-2 rounded-full p-3">
            <div className="flex items-center gap-3">
                <button
                    type="button"
                    onClick={onOpen}
                    aria-haspopup="dialog"
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                >
                    <span className="grid w-9 shrink-0 place-items-center self-stretch">
                        <HabitBadge icon={goal.icon} color={goal.color} />
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate">{goal.name}</span>
                        <span className="truncate text-xxs opacity-70">{detail}</span>
                    </span>
                    {goal.target === undefined && <Sparkline points={series.slice(-12)} color={fill} />}
                    {latest && <span className="shrink-0 text-md">{formatValue(latest.value, goal.unit)}</span>}
                </button>
                <Button
                    size="sm"
                    variant="secondary"
                    onClick={onLog}
                    aria-label={`Log ${goal.name}`}
                    className="shrink-0"
                >
                    + Log
                </Button>
            </div>
            {goal.target !== undefined && (
                <div className="flex flex-col gap-1">
                    <ProgressBar value={summary.progress ?? 0} label={`${goal.name} progress`} />
                    <span className="text-xs opacity-70">
                        {summary.reached
                            ? `Reached ${formatValue(goal.target, goal.unit)}`
                            : latest
                              ? `${Math.round((summary.progress ?? 0) * 100)}% of the way to ${formatValue(goal.target, goal.unit)}`
                              : `Target ${formatValue(goal.target, goal.unit)}`}
                    </span>
                </div>
            )}
        </Card>
    );
}
