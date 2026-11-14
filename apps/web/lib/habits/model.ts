import { parseColor, readableInk, type IconName } from '@bradydallama/ui';
import { fromISODate, pad2, toISODate } from '@/lib/dates';

export type HabitPeriod = 'daily' | 'weekly' | 'monthly';

export type Habit = {
    id: string;
    name: string;
    description?: string;
    icon: IconName;
    color: HabitColor;
    period: HabitPeriod;
    order: number;
    createdAt: string;
    updatedAt: string;
};

export type CheckIn = {
    habitId: string;
    periodKey: string;
    doneAt: string;
};

export type HabitInput = Pick<Habit, 'name' | 'icon' | 'color' | 'period'> & { description?: string };

export const HABIT_COLORS = {
    peach: { fill: '#fde1c8', ink: '#10212a', label: 'Peach' },
    pink: { fill: '#ff8fb1', ink: '#10212a', label: 'Pink' },
    rose: { fill: '#c45478', ink: '#f3f2ff', label: 'Rose' },
    coral: { fill: '#ffa98a', ink: '#10212a', label: 'Coral' },
    butter: { fill: '#ffe08a', ink: '#10212a', label: 'Butter' },
    mint: { fill: '#9fe3c4', ink: '#10212a', label: 'Mint' },
    sky: { fill: '#9ccfff', ink: '#10212a', label: 'Sky' },
    lavender: { fill: '#c8b6ff', ink: '#10212a', label: 'Lavender' },
} as const;

export type HabitColor = string;
type HabitPreset = keyof typeof HABIT_COLORS;
export const habitPresets = Object.keys(HABIT_COLORS) as HabitPreset[];

export function habitColor(color: HabitColor): { fill: string; ink: string } {
    const preset = HABIT_COLORS[color as HabitPreset];
    if (preset) return preset;
    return parseColor(color) ? { fill: color, ink: readableInk(color) } : HABIT_COLORS.peach;
}

export const HABIT_ICONS: IconName[] = [
    'heart',
    'water',
    'milk-bottle',
    'mug',
    'leaf',
    'flower',
    'sun',
    'moon',
    'star',
    'star-4',
    'flame-1',
    'lightning',
    'book',
    'book-2',
    'paintbrush',
    'camera',
    'mic',
    'game',
    'people-1',
    'people-2',
    'message-1',
    'cat',
    'fish',
    'cake',
    'gift',
    'coin',
    'dollar',
    'cart',
    'clipboard',
    'timer',
    'alarm',
    'bell',
    'medal-1',
    'crown',
    'gem',
    'planet',
    'spaceship',
    'location',
    'flag',
    'life-buoy',
];

export const WEEK_STARTS_ON = 1;

export function weekStart(date: string): string {
    const d = fromISODate(date);
    const back = (d.getDay() - WEEK_STARTS_ON + 7) % 7;
    d.setDate(d.getDate() - back);
    return toISODate(d);
}

export function periodKey(period: HabitPeriod, date: string): string {
    if (period === 'daily') return `d:${date}`;
    if (period === 'weekly') return `w:${weekStart(date)}`;
    return `m:${date.slice(0, 7)}`;
}

function previousPeriodKey(key: string): string {
    const [kind, value] = key.split(':');
    if (kind === 'm') {
        const [y, m] = value.split('-').map(Number);
        return m === 1 ? `m:${y - 1}-12` : `m:${y}-${pad2(m - 1)}`;
    }
    const d = fromISODate(value);
    d.setDate(d.getDate() - (kind === 'w' ? 7 : 1));
    return `${kind}:${toISODate(d)}`;
}

export const periodNoun: Record<HabitPeriod, { now: string; unit: string; units: string; label: string }> = {
    daily: { now: 'today', unit: 'day', units: 'days', label: 'Daily' },
    weekly: { now: 'this week', unit: 'week', units: 'weeks', label: 'Weekly' },
    monthly: { now: 'this month', unit: 'month', units: 'months', label: 'Monthly' },
};

function doneKeys(habit: Habit, checkins: CheckIn[]): Set<string> {
    return new Set(checkins.filter((c) => c.habitId === habit.id).map((c) => c.periodKey));
}

export function isDone(habit: Habit, checkins: CheckIn[], today: string): boolean {
    const key = periodKey(habit.period, today);
    return checkins.some((c) => c.habitId === habit.id && c.periodKey === key);
}

/** The current period doesn't break a streak until it's over. */
export function streak(habit: Habit, checkins: CheckIn[], today: string): number {
    const keys = doneKeys(habit, checkins);
    let key = periodKey(habit.period, today);
    if (!keys.has(key)) key = previousPeriodKey(key);
    let count = 0;
    while (keys.has(key)) {
        count++;
        key = previousPeriodKey(key);
    }
    return count;
}

export function history(habit: Habit, checkins: CheckIn[], today: string, count = 7): { key: string; done: boolean }[] {
    const keys = doneKeys(habit, checkins);
    const out: { key: string; done: boolean }[] = [];
    let key = periodKey(habit.period, today);
    for (let i = 0; i < count; i++) {
        out.unshift({ key, done: keys.has(key) });
        key = previousPeriodKey(key);
    }
    return out;
}

export function periodLabel(key: string): string {
    const [kind, value] = key.split(':');
    if (kind === 'm') {
        const [y, m] = value.split('-').map(Number);
        return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'short' });
    }
    const d = fromISODate(value);
    return kind === 'd'
        ? d.toLocaleDateString(undefined, { weekday: 'short' })
        : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function statusLine(habit: Habit, checkins: CheckIn[], today: string): string {
    const n = streak(habit, checkins, today);
    const noun = periodNoun[habit.period];
    if (n >= 2) return `${n} ${noun.unit} streak`;
    return isDone(habit, checkins, today) ? `Done ${noun.now}` : `Not yet ${noun.now}`;
}

const PERIOD_ORDER: HabitPeriod[] = ['daily', 'weekly', 'monthly'];

export function groupByPeriod(habits: Habit[]): { period: HabitPeriod; habits: Habit[] }[] {
    return PERIOD_ORDER.map((period) => ({
        period,
        habits: habits.filter((h) => h.period === period).sort((a, b) => a.order - b.order),
    })).filter((g) => g.habits.length);
}

function nextPeriodKey(key: string): string {
    const [kind, value] = key.split(':');
    if (kind === 'm') {
        const [y, m] = value.split('-').map(Number);
        return m === 12 ? `m:${y + 1}-01` : `m:${y}-${pad2(m + 1)}`;
    }
    const d = fromISODate(value);
    d.setDate(d.getDate() + (kind === 'w' ? 7 : 1));
    return `${kind}:${toISODate(d)}`;
}

export function bestStreak(habit: Habit, checkins: CheckIn[]): number {
    const keys = doneKeys(habit, checkins);
    let best = 0;
    for (const key of keys) {
        if (keys.has(previousPeriodKey(key))) continue;
        let length = 0;
        let k = key;
        while (keys.has(k)) {
            length++;
            k = nextPeriodKey(k);
        }
        best = Math.max(best, length);
    }
    return best;
}

function firstPeriodKey(habit: Habit): string {
    return periodKey(habit.period, toISODate(new Date(habit.createdAt)));
}

/** The current period counts only once it's done, so the rate doesn't dip every morning. */
export function completion(
    habit: Habit,
    checkins: CheckIn[],
    today: string,
    max = 30,
): { done: number; total: number } {
    const keys = doneKeys(habit, checkins);
    const first = firstPeriodKey(habit);
    const current = periodKey(habit.period, today);
    let key = keys.has(current) ? current : previousPeriodKey(current);
    let done = 0;
    let total = 0;
    for (let i = 0; i < max; i++) {
        // Keys of one kind sort chronologically as text.
        if (key < first && !keys.has(key)) break;
        total++;
        if (keys.has(key)) done++;
        key = previousPeriodKey(key);
    }
    return { done, total };
}

export type CalendarCell = {
    key: string;
    label: string;
    done: boolean;
    future: boolean;
    before: boolean;
    current: boolean;
};

export function trackerGrid(habit: Habit, checkins: CheckIn[], today: string, weeks = 6, count = 12): CalendarCell[][] {
    const keys = doneKeys(habit, checkins);
    const first = firstPeriodKey(habit);
    const current = periodKey(habit.period, today);
    const cell = (key: string, label: string): CalendarCell => ({
        key,
        label,
        done: keys.has(key),
        future: key > current,
        before: key < first,
        current: key === current,
    });

    if (habit.period === 'daily') {
        const start = fromISODate(weekStart(today));
        start.setDate(start.getDate() - 7 * (weeks - 1));
        const rows: CalendarCell[][] = [];
        for (let w = 0; w < weeks; w++) {
            const row: CalendarCell[] = [];
            for (let d = 0; d < 7; d++) {
                const date = new Date(start);
                date.setDate(start.getDate() + w * 7 + d);
                row.push(cell(`d:${toISODate(date)}`, String(date.getDate())));
            }
            rows.push(row);
        }
        return rows;
    }

    const cells: CalendarCell[] = [];
    let key = current;
    for (let i = 0; i < count; i++) {
        cells.unshift(cell(key, periodLabel(key)));
        key = previousPeriodKey(key);
    }
    const rows: CalendarCell[][] = [];
    for (let i = 0; i < cells.length; i += 6) rows.push(cells.slice(i, i + 6));
    return rows;
}

export function weekdayInitials(): string[] {
    const monday = new Date(2024, 0, 1);
    return Array.from({ length: 7 }, (_, i) => {
        const d = new Date(monday);
        d.setDate(monday.getDate() + ((WEEK_STARTS_ON - 1 + 7) % 7) + i);
        return d.toLocaleDateString(undefined, { weekday: 'narrow' });
    });
}
