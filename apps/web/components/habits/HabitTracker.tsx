'use client';

import { Button, Dialog } from '@bradydallama/ui';
import {
    bestStreak,
    completion,
    habitColor,
    periodLabel,
    periodNoun,
    streak,
    trackerGrid,
    weekdayInitials,
    type CalendarCell,
    type CheckIn,
    type Habit,
} from '@/lib/habits/model';
import { setHabitDone } from '@/lib/habits/store';
import { HabitBadge } from './HabitBadge';

type HabitTrackerProps = {
    habit: Habit | null;
    checkins: CheckIn[];
    today: string;
    onClose: () => void;
    onEdit: (habit: Habit) => void;
};

export function HabitTracker({ habit, checkins, today, onClose, onEdit }: HabitTrackerProps) {
    return (
        <Dialog open={!!habit} onClose={onClose} variant="sheet" title={habit?.name ?? 'Habit'}>
            {habit && <TrackerBody habit={habit} checkins={checkins} today={today} onEdit={onEdit} />}
        </Dialog>
    );
}

function TrackerBody({
    habit,
    checkins,
    today,
    onEdit,
}: {
    habit: Habit;
    checkins: CheckIn[];
    today: string;
    onEdit: (habit: Habit) => void;
}) {
    const noun = periodNoun[habit.period];
    const current = streak(habit, checkins, today);
    const best = bestStreak(habit, checkins);
    const rate = completion(habit, checkins, today, 30);
    const percent = rate.total ? Math.round((rate.done / rate.total) * 100) : 0;
    const grid = trackerGrid(habit, checkins, today);

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
                <HabitBadge icon={habit.icon} color={habit.color} size="md" />
                <div className="flex min-w-0 flex-col">
                    <span className="text-sm opacity-80">{noun.label}</span>
                    {habit.description && <span className="text-xs opacity-70">{habit.description}</span>}
                </div>
            </div>

            <dl className="grid grid-cols-3 gap-2 text-center">
                <Stat label="Current streak" value={current} unit={current === 1 ? noun.unit : noun.units} />
                <Stat label="Best streak" value={best} unit={best === 1 ? noun.unit : noun.units} />
                <Stat
                    label={`Last ${rate.total || 1} ${rate.total === 1 ? noun.unit : noun.units}`}
                    value={`${percent}%`}
                    unit={`${rate.done} of ${rate.total}`}
                />
            </dl>

            <Calendar habit={habit} grid={grid} />

            <p className="text-xs opacity-70">
                Tap a past {noun.unit} to mark it done or not. Faded ones are before you added this habit.
            </p>

            <div className="flex justify-end">
                <Button type="button" variant="secondary" icon="gear-1" onClick={() => onEdit(habit)}>
                    Edit habit
                </Button>
            </div>
        </div>
    );
}

function Stat({ label, value, unit }: { label: string; value: number | string; unit: string }) {
    return (
        <div className="flex flex-col items-center gap-0.5 rounded-2xl border-2 border-current/20 px-1 py-2">
            <dd className="text-xl leading-none">{value}</dd>
            <dd className="text-xs opacity-70">{unit}</dd>
            <dt className="text-xs opacity-80">{label}</dt>
        </div>
    );
}

function Calendar({ habit, grid }: { habit: Habit; grid: CalendarCell[][] }) {
    const daily = habit.period === 'daily';
    const cols = daily ? 7 : 6;
    return (
        <div className="flex flex-col gap-1.5">
            {daily && (
                <div className="grid grid-cols-7 gap-1.5 text-center text-xs opacity-60" aria-hidden>
                    {weekdayInitials().map((d, i) => (
                        <span key={i}>{d}</span>
                    ))}
                </div>
            )}
            {grid.map((row, r) => (
                <div
                    key={r}
                    className="grid gap-1.5"
                    style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
                >
                    {row.map((cell) => (
                        <CalendarDay key={cell.key} habit={habit} cell={cell} daily={daily} />
                    ))}
                </div>
            ))}
        </div>
    );
}

function CalendarDay({ habit, cell, daily }: { habit: Habit; cell: CalendarCell; daily: boolean }) {
    const { fill, ink } = habitColor(habit.color);
    const name = `${daily ? periodLabel(cell.key) + ' ' : ''}${cell.label}`;
    return (
        <button
            type="button"
            disabled={cell.future}
            aria-pressed={cell.done}
            aria-label={`${name}: ${cell.done ? 'done' : 'not done'}`}
            onClick={() => void setHabitDone(habit, cell.key, !cell.done)}
            className={`relative grid h-8 place-items-center justify-self-center rounded-full text-xs transition-[background-color,scale] duration-200 active:scale-90 disabled:cursor-default ${daily ? 'w-8' : 'min-w-8 px-2'}`}
            style={{
                background: cell.done ? fill : 'transparent',
                color: cell.done ? ink : 'inherit',
                border: cell.current ? 'var(--border-outline) solid var(--color-bg)' : '2px solid transparent',
                outline: cell.current ? `var(--border-outline) solid ${fill}` : undefined,
                opacity: cell.future ? 0.2 : cell.before && !cell.done ? 0.35 : 1,
            }}
        >
            <span className="whitespace-nowrap">{cell.label}</span>
        </button>
    );
}
