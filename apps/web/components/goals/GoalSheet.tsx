'use client';

import { useEffect, useRef, useState } from 'react';
import { Button, Dialog, IconButton, Input, ProgressBar } from '@bradydallama/ui';
import { HabitBadge } from '@/components/habits/HabitBadge';
import {
    dailySeries,
    entriesFor,
    formatChange,
    formatDate,
    formatValue,
    inRange,
    RANGES,
    summarize,
    type Goal,
    type GoalEntry,
    type Range,
} from '@/lib/goals/model';
import { addEntry, deleteEntry } from '@/lib/goals/store';
import { habitColor } from '@/lib/habits/model';
import { LineChart } from './GoalChart';

type GoalSheetProps = {
    goal: Goal | null;
    entries: GoalEntry[];
    today: string;
    logFirst: boolean;
    onClose: () => void;
    onEdit: (goal: Goal) => void;
};

export function GoalSheet({ goal, entries, today, logFirst, onClose, onEdit }: GoalSheetProps) {
    return (
        <Dialog open={!!goal} onClose={onClose} variant="sheet" title={goal?.name ?? 'Goal'}>
            {goal && <Body goal={goal} entries={entries} today={today} logFirst={logFirst} onEdit={onEdit} />}
        </Dialog>
    );
}

function Body({
    goal,
    entries,
    today,
    logFirst,
    onEdit,
}: {
    goal: Goal;
    entries: GoalEntry[];
    today: string;
    logFirst: boolean;
    onEdit: (goal: Goal) => void;
}) {
    const [range, setRange] = useState<Range>('3m');
    const sorted = entriesFor(goal, entries);
    const summary = summarize(goal, entries);
    const series = dailySeries(sorted, summary.better);
    const shown = inRange(series, range, today);
    const { fill } = habitColor(goal.color);
    const inWindow = shown.length >= 2 ? shown.at(-1)!.value - shown[0].value : undefined;

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
                <HabitBadge icon={goal.icon} color={goal.color} size="md" />
                <div className="flex min-w-0 flex-col">
                    <span className="text-sm opacity-80">
                        {goal.target !== undefined
                            ? `Target ${formatValue(goal.target, goal.unit)}`
                            : `${summary.better === 'higher' ? 'Higher' : 'Lower'} is better`}
                    </span>
                    {goal.description && <span className="text-xs opacity-70">{goal.description}</span>}
                </div>
            </div>

            <LogForm goal={goal} today={today} autoFocus={logFirst} />

            {sorted.length > 0 && (
                <>
                    <dl className="grid grid-cols-3 gap-2 text-center">
                        <Stat
                            label="Latest"
                            value={formatValue(summary.latest!.value, goal.unit)}
                            sub={formatDate(summary.latest!.date)}
                        />
                        <Stat
                            label={summary.better === 'higher' ? 'Best' : 'Lowest'}
                            value={formatValue(summary.best!, goal.unit)}
                        />
                        <Stat
                            label="Change"
                            value={inWindow !== undefined ? formatChange(inWindow, goal.unit) : '–'}
                            sub={
                                RANGES.find((r) => r.id === range)!.id === 'all'
                                    ? 'all time'
                                    : `in ${RANGES.find((r) => r.id === range)!.label}`
                            }
                        />
                    </dl>

                    {goal.target !== undefined && (
                        <div className="flex flex-col gap-1">
                            <ProgressBar value={summary.progress ?? 0} label={`${goal.name} progress`} />
                            <span className="text-xs opacity-70">
                                {summary.reached
                                    ? `Reached ${formatValue(goal.target, goal.unit)}`
                                    : `${Math.round((summary.progress ?? 0) * 100)}% of the way from ${formatValue(summary.first!.value, goal.unit)} to ${formatValue(goal.target, goal.unit)}`}
                            </span>
                        </div>
                    )}

                    <div className="flex gap-1" role="group" aria-label="Chart range">
                        {RANGES.map((r) => (
                            <Button
                                key={r.id}
                                type="button"
                                size="sm"
                                variant={range === r.id ? 'primary' : 'ghost'}
                                aria-pressed={range === r.id}
                                onClick={() => setRange(r.id)}
                            >
                                {r.label}
                            </Button>
                        ))}
                    </div>

                    <LineChart
                        points={shown}
                        color={fill}
                        unit={goal.unit}
                        label={`${goal.name}: ${shown.length} ${shown.length === 1 ? 'day' : 'days'} logged in this range, latest ${formatValue(summary.latest!.value, goal.unit)}`}
                    />

                    <EntryList goal={goal} entries={sorted} />
                </>
            )}

            <div className="flex justify-end">
                <Button type="button" variant="secondary" icon="gear-1" onClick={() => onEdit(goal)}>
                    Edit goal
                </Button>
            </div>
        </div>
    );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
    return (
        <div className="flex flex-col items-center gap-0.5 rounded-2xl border-2 border-current/20 px-1 py-2">
            <dt className="text-xs opacity-80">{label}</dt>
            <dd className="text-md leading-tight">{value}</dd>
            {sub && <dd className="text-xs opacity-60">{sub}</dd>}
        </div>
    );
}

function LogForm({ goal, today, autoFocus }: { goal: Goal; today: string; autoFocus: boolean }) {
    const [value, setValue] = useState('');
    const [date, setDate] = useState(today);
    const [note, setNote] = useState('');
    const valueRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        setValue('');
        setNote('');
        setDate(today);
        // The native dialog moves focus after autoFocus would run.
        if (autoFocus) requestAnimationFrame(() => valueRef.current?.focus());
    }, [goal.id, today, autoFocus]);

    const number = Number(value);
    const valid = value.trim() !== '' && Number.isFinite(number) && date <= today;

    return (
        <form
            className="flex flex-col gap-2"
            onSubmit={(e) => {
                e.preventDefault();
                if (!valid) return;
                void addEntry(goal, { value: number, date, note });
                setValue('');
                setNote('');
            }}
        >
            <div className="flex items-end gap-2">
                <Input
                    ref={valueRef}
                    label={goal.unit ? `Value (${goal.unit})` : 'Value'}
                    inputMode="decimal"
                    type="number"
                    step="any"
                    placeholder="0"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    className="min-w-0 flex-1"
                />
                <Input
                    label="Date"
                    type="date"
                    max={today}
                    value={date}
                    onChange={(e) => setDate(e.target.value || today)}
                    className="min-w-0 flex-1"
                />
            </div>
            <div className="flex items-end gap-2">
                <Input
                    label="Note"
                    placeholder="Optional"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    className="min-w-0 flex-1"
                />
                <Button type="submit" disabled={!valid}>
                    Log
                </Button>
            </div>
        </form>
    );
}

function EntryList({ goal, entries }: { goal: Goal; entries: GoalEntry[] }) {
    const [showAll, setShowAll] = useState(false);
    const newest = [...entries].reverse();
    const shown = showAll ? newest : newest.slice(0, 8);
    return (
        <div className="flex flex-col gap-1">
            <span className="bd-field-label">Entries ({entries.length})</span>
            <ul className="flex flex-col">
                {shown.map((e) => (
                    <li key={e.id} className="flex min-h-9 items-center gap-3 text-sm">
                        <span className="w-24 shrink-0 opacity-70">{formatDate(e.date, true)}</span>
                        <span className="shrink-0">{formatValue(e.value, goal.unit)}</span>
                        <span className="min-w-0 flex-1 truncate text-xs opacity-60">{e.note}</span>
                        <IconButton
                            icon="mark-x"
                            label={`Delete ${formatValue(e.value, goal.unit)} on ${formatDate(e.date, true)}`}
                            variant="ghost"
                            size="sm"
                            onClick={() => void deleteEntry(e)}
                        />
                    </li>
                ))}
            </ul>
            {entries.length > shown.length && (
                <button
                    type="button"
                    className="self-start text-xs underline underline-offset-4"
                    onClick={() => setShowAll(true)}
                >
                    Show all {entries.length}
                </button>
            )}
        </div>
    );
}
