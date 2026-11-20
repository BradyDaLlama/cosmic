import { addDays, fromISODate } from '@/lib/dates';

export type TaskList = {
    id: string;
    title: string;
    updatedAt: string;
};

export type Task = {
    id: string;
    listId: string;
    title: string;
    notes?: string;
    done: boolean;
    completedAt?: string;
    due?: string;
    parentId?: string;
    position: string;
    updatedAt: string;
    webViewLink?: string;
};

export type NewTask = {
    listId: string;
    title: string;
    notes?: string;
    due?: string;
    parentId?: string;
    previousId?: string;
};

export type TaskPatch = {
    title?: string;
    notes?: string | null;
    due?: string | null;
    done?: boolean;
};

export function formatDue(due: string, today: string): string {
    if (due === today) return 'Today';
    if (due === addDays(today, 1)) return 'Tomorrow';
    if (due === addDays(today, -1)) return 'Yesterday';
    const inWeek = due > today && due <= addDays(today, 6);
    return fromISODate(due).toLocaleDateString(
        undefined,
        inWeek ? { weekday: 'long' } : { month: 'short', day: 'numeric' },
    );
}

const byPosition = (a: Task, b: Task) => a.position.localeCompare(b.position);

type TaskNode = { task: Task; children: Task[] };

export function arrangeList(tasks: Task[]): { open: TaskNode[]; completed: Task[] } {
    const open = tasks.filter((t) => !t.done);
    const openIds = new Set(open.map((t) => t.id));
    const roots = open.filter((t) => !t.parentId || !openIds.has(t.parentId)).sort(byPosition);
    const nodes = roots.map((task) => ({
        task,
        children: open.filter((t) => t.parentId === task.id).sort(byPosition),
    }));
    const completed = tasks
        .filter((t) => t.done)
        .sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''));
    return { open: nodes, completed };
}

export function lastOpenRoot(tasks: Task[]): Task | undefined {
    const { open } = arrangeList(tasks);
    return open.at(-1)?.task;
}

type DueGroups = { overdue: Task[]; today: Task[]; upcoming: Task[] };

export const UPCOMING_DAYS = 7;

export function dueGroups(tasks: Task[], today: string, upcomingDays = UPCOMING_DAYS): DueGroups {
    const until = addDays(today, upcomingDays);
    const sort = (a: Task, b: Task) =>
        (a.due ?? '').localeCompare(b.due ?? '') ||
        Number(a.done) - Number(b.done) ||
        a.listId.localeCompare(b.listId) ||
        byPosition(a, b);
    const groups: DueGroups = { overdue: [], today: [], upcoming: [] };
    for (const t of tasks) {
        if (!t.due) continue;
        if (t.due < today && !t.done) groups.overdue.push(t);
        else if (t.due === today) groups.today.push(t);
        else if (t.due > today && t.due <= until && !t.done) groups.upcoming.push(t);
    }
    groups.overdue.sort(sort);
    groups.today.sort(sort);
    groups.upcoming.sort(sort);
    return groups;
}

export function applyPatch(task: Task, patch: TaskPatch, stamp = new Date().toISOString()): Task {
    const next: Task = { ...task, updatedAt: stamp };
    if (patch.title !== undefined) next.title = patch.title.trim() || task.title;
    if (patch.notes !== undefined) next.notes = patch.notes?.trim() || undefined;
    if (patch.due !== undefined) next.due = patch.due ?? undefined;
    if (patch.done !== undefined && patch.done !== task.done) {
        next.done = patch.done;
        next.completedAt = patch.done ? stamp : undefined;
    }
    return next;
}
