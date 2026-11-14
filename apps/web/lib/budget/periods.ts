import { addDays, fromISODate, toISODate } from '@/lib/dates';
import { weekStart } from '@/lib/habits/model';
import type { BudgetPeriod, BudgetState } from './model';

export type Range = { start: string; end: string };

export function periodRange(period: BudgetPeriod, date: string): Range {
    if (period === 'weekly') {
        const start = weekStart(date);
        return { start, end: addDays(start, 6) };
    }
    const d = fromISODate(date);
    return {
        start: toISODate(new Date(d.getFullYear(), d.getMonth(), 1)),
        end: toISODate(new Date(d.getFullYear(), d.getMonth() + 1, 0)),
    };
}

export function previousRange(period: BudgetPeriod, range: Range): Range {
    return periodRange(period, addDays(range.start, -1));
}

export function elapsedShare(range: Range, date: string): number {
    const day = 86_400_000;
    const total = (fromISODate(range.end).getTime() - fromISODate(range.start).getTime()) / day + 1;
    const gone = (fromISODate(date).getTime() - fromISODate(range.start).getTime()) / day + 1;
    return Math.min(Math.max(Math.round(gone) / Math.round(total), 0), 1);
}

const PACE_MARGIN = 0.15;

export function budgetState(spent: number, amount: number, elapsed: number): BudgetState {
    if (spent > amount) return 'over';
    if (amount > 0 && spent / amount - elapsed > PACE_MARGIN) return 'ahead';
    return 'on_track';
}
