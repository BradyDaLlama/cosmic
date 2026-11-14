import type { IconName } from '@bradydallama/ui';
import { fromISODate } from '@/lib/dates';
import type { HabitColor } from '@/lib/habits/model';

export type Better = 'higher' | 'lower';

export type Goal = {
    id: string;
    name: string;
    description?: string;
    unit?: string;
    icon: IconName;
    color: HabitColor;
    target?: number;
    better: Better;
    order: number;
    createdAt: string;
    updatedAt: string;
};

export type GoalEntry = {
    id: string;
    goalId: string;
    date: string;
    value: number;
    note?: string;
    createdAt: string;
};

export type GoalInput = Pick<Goal, 'name' | 'icon' | 'color' | 'better'> & {
    description?: string;
    unit?: string;
    target?: number;
};

export type EntryInput = Pick<GoalEntry, 'date' | 'value'> & { note?: string };

/** Midday, so points never land on the wrong day across DST shifts. */
const dateMs = (iso: string) => fromISODate(iso).getTime() + 12 * 3_600_000;

export function formatDate(iso: string, withYear = false): string {
    return fromISODate(iso).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        ...(withYear ? { year: 'numeric' } : {}),
    });
}

const numberFormat = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });

export function formatValue(value: number, unit?: string): string {
    const n = numberFormat.format(value);
    return unit ? `${n} ${unit}` : n;
}

export function formatChange(delta: number, unit?: string): string {
    if (Math.abs(delta) < 1e-9) return 'No change';
    return `${delta > 0 ? '+' : '-'}${formatValue(Math.abs(delta), unit)}`;
}

export function entriesFor(goal: Goal, entries: GoalEntry[]): GoalEntry[] {
    return entries
        .filter((e) => e.goalId === goal.id)
        .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));
}

export function direction(goal: Goal, sorted: GoalEntry[]): Better {
    if (goal.target === undefined || !sorted.length) return goal.better;
    return goal.target < sorted[0].value ? 'lower' : 'higher';
}

const pick = (better: Better) => (a: number, b: number) => (better === 'higher' ? Math.max(a, b) : Math.min(a, b));

export type DayPoint = { date: string; t: number; value: number; count: number };

export function dailySeries(sorted: GoalEntry[], better: Better): DayPoint[] {
    const byDay = new Map<string, DayPoint>();
    const best = pick(better);
    for (const e of sorted) {
        const p = byDay.get(e.date);
        if (p) {
            p.value = best(p.value, e.value);
            p.count++;
        } else byDay.set(e.date, { date: e.date, t: dateMs(e.date), value: e.value, count: 1 });
    }
    return [...byDay.values()].sort((a, b) => a.t - b.t);
}

type GoalSummary = {
    latest?: GoalEntry;
    first?: GoalEntry;
    best?: number;
    change?: number;
    better: Better;
    progress?: number;
    reached: boolean;
};

export function summarize(goal: Goal, entries: GoalEntry[]): GoalSummary {
    const sorted = entriesFor(goal, entries);
    const better = direction(goal, sorted);
    const first = sorted[0];
    const latest = sorted.at(-1);
    const best = sorted.length ? sorted.map((e) => e.value).reduce(pick(better)) : undefined;
    let progress: number | undefined;
    let reached = false;
    if (goal.target !== undefined && first && latest) {
        const span = goal.target - first.value;
        progress = span === 0 ? 1 : Math.min(1, Math.max(0, (latest.value - first.value) / span));
        reached = better === 'higher' ? latest.value >= goal.target : latest.value <= goal.target;
    }
    return {
        latest,
        first,
        best,
        change: latest && first ? latest.value - first.value : undefined,
        better,
        progress,
        reached,
    };
}

export type Range = '1m' | '3m' | '1y' | 'all';
export const RANGES: { id: Range; label: string; days?: number }[] = [
    { id: '1m', label: '1M', days: 31 },
    { id: '3m', label: '3M', days: 92 },
    { id: '1y', label: '1Y', days: 366 },
    { id: 'all', label: 'All' },
];

export function inRange(points: DayPoint[], range: Range, today: string): DayPoint[] {
    const days = RANGES.find((r) => r.id === range)?.days;
    if (!days) return points;
    const from = dateMs(today) - days * 86_400_000;
    return points.filter((p) => p.t >= from);
}

export function niceTicks(min: number, max: number, count = 4): number[] {
    if (min === max) {
        const pad = Math.abs(min) * 0.1 || 1;
        min -= pad;
        max += pad;
    }
    const raw = (max - min) / Math.max(1, count - 1);
    const power = 10 ** Math.floor(Math.log10(raw));
    const step = [1, 2, 2.5, 5, 10].map((m) => m * power).find((s) => s >= raw) ?? raw;
    const start = Math.floor(min / step) * step;
    const ticks: number[] = [];
    for (let v = start; v <= max + step * 0.5; v += step) ticks.push(Math.round(v * 1e6) / 1e6);
    if (ticks.at(-1)! < max) ticks.push(ticks.at(-1)! + step);
    return ticks;
}
