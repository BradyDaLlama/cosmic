/**
 * Each day gets its own run. A wait starts counting down once everything above
 * it is done, and the steps below unlock when it finishes or is skipped.
 */
import type { IconName } from '@bradydallama/ui';
import type { HabitColor } from '@/lib/habits/model';

type TaskStep = { id: string; kind: 'task'; title: string };
type WaitStep = { id: string; kind: 'wait'; minutes: number };
export type RoutineStep = TaskStep | WaitStep;

export type Routine = {
    id: string;
    name: string;
    icon: IconName;
    color: HabitColor;
    steps: RoutineStep[];
    habitId?: string;
    order: number;
    createdAt: string;
    updatedAt: string;
};

export type RoutineInput = Pick<Routine, 'name' | 'icon' | 'color' | 'steps'> & { habitId?: string };

export type RoutineRun = {
    routineId: string;
    date: string;
    done: string[];
    waits: Record<string, string>;
    skipped: string[];
    completedAt?: string;
    updatedAt: string;
};

export const MAX_STEPS = 50;
export const MAX_WAIT_MINUTES = 240;

export const emptyRun = (routineId: string, date: string): RoutineRun => ({
    routineId,
    date,
    done: [],
    waits: {},
    skipped: [],
    updatedAt: new Date().toISOString(),
});

export type StepState =
    | { kind: 'task'; status: 'done' | 'todo' | 'locked' }
    | { kind: 'wait'; status: 'done' | 'skipped' | 'pending' | 'locked' }
    | { kind: 'wait'; status: 'running'; endsAt: number; remainingMs: number };

const waitEnd = (step: WaitStep, run: RoutineRun) => {
    const started = run.waits[step.id];
    return started ? Date.parse(started) + step.minutes * 60_000 : undefined;
};

function waitFinished(step: WaitStep, run: RoutineRun, now: number): boolean {
    if (run.skipped.includes(step.id)) return true;
    const end = waitEnd(step, run);
    return end !== undefined && end <= now;
}

export function stepStates(routine: Routine, run: RoutineRun, now: number): StepState[] {
    const done = new Set(run.done);
    let blocked = false;
    let allAboveDone = true;
    return routine.steps.map((step): StepState => {
        if (step.kind === 'task') {
            const isDone = done.has(step.id);
            if (!isDone) allAboveDone = false;
            if (isDone) return { kind: 'task', status: 'done' };
            return { kind: 'task', status: blocked ? 'locked' : 'todo' };
        }
        if (blocked) {
            allAboveDone = false;
            return { kind: 'wait', status: 'locked' };
        }
        if (run.skipped.includes(step.id)) return { kind: 'wait', status: 'skipped' };
        const end = waitEnd(step, run);
        if (end !== undefined && allAboveDone) {
            if (end <= now) return { kind: 'wait', status: 'done' };
            blocked = true;
            allAboveDone = false;
            return { kind: 'wait', status: 'running', endsAt: end, remainingMs: end - now };
        }
        blocked = true;
        allAboveDone = false;
        return { kind: 'wait', status: 'pending' };
    });
}

function isComplete(routine: Routine, run: RoutineRun, now: number): boolean {
    if (!routine.steps.length) return false;
    const done = new Set(run.done);
    return routine.steps.every((s) => (s.kind === 'task' ? done.has(s.id) : waitFinished(s, run, now)));
}

export function progress(routine: Routine, run: RoutineRun, now: number): { done: number; total: number } {
    const states = stepStates(routine, run, now);
    return {
        done: states.filter((s) => s.status === 'done' || s.status === 'skipped').length,
        total: routine.steps.length,
    };
}

export function settleWaits(routine: Routine, run: RoutineRun, now: number): RoutineRun {
    const done = new Set(run.done);
    const waits = { ...run.waits };
    let allAboveDone = true;
    // Back-to-back waits chain: the next starts when the previous ended, not now.
    let previousWaitEnd: number | undefined;
    for (const step of routine.steps) {
        if (step.kind === 'task') {
            if (!done.has(step.id)) allAboveDone = false;
            previousWaitEnd = undefined;
            continue;
        }
        if (!allAboveDone) {
            delete waits[step.id];
            continue;
        }
        if (run.skipped.includes(step.id)) {
            previousWaitEnd = undefined;
            continue;
        }
        if (!waits[step.id]) waits[step.id] = new Date(previousWaitEnd ?? now).toISOString();
        const end = Date.parse(waits[step.id]) + step.minutes * 60_000;
        if (end > now) allAboveDone = false;
        previousWaitEnd = end <= now ? end : undefined;
    }
    return { ...run, waits };
}

export function toggleTask(routine: Routine, run: RoutineRun, stepId: string, now: number): RoutineRun {
    const done = new Set(run.done);
    if (done.has(stepId)) done.delete(stepId);
    else done.add(stepId);
    return finish(routine, settleWaits(routine, { ...run, done: [...done] }, now), now);
}

export function skipWait(routine: Routine, run: RoutineRun, stepId: string, now: number): RoutineRun {
    const skipped = run.skipped.includes(stepId) ? run.skipped : [...run.skipped, stepId];
    return finish(routine, settleWaits(routine, { ...run, skipped }, now), now);
}

export function finish(routine: Routine, run: RoutineRun, now: number): RoutineRun {
    const complete = isComplete(routine, run, now);
    const stamp = new Date(now).toISOString();
    return {
        ...run,
        completedAt: complete ? (run.completedAt ?? stamp) : undefined,
        updatedAt: stamp,
    };
}

export function formatCountdown(ms: number): string {
    const total = Math.max(0, Math.ceil(ms / 1000));
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
}

export const waitLabel = (minutes: number) => `Wait ${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`;
