'use client';

import { Checkbox, IconButton, Pill } from '@bradydallama/ui';
import { deleteTask, formatDue, updateTask, useTasksState, type Task } from '@/lib/tasks';

type TaskRowProps = {
    task: Task;
    today: string;
    onOpen: (task: Task) => void;
    listName?: string;
    showDue?: boolean;
    indent?: boolean;
};

export function TaskRow({ task, today, onOpen, listName, showDue = true, indent = false }: TaskRowProps) {
    const { pending, online, authorized } = useTasksState();
    const busy = pending.has(task.id);
    const writable = online && authorized && !task.id.startsWith('temp-');

    return (
        <li
            className={`group flex min-h-10 items-center gap-2 transition-opacity ${indent ? 'pl-7' : ''} ${busy ? 'opacity-60' : ''}`}
            aria-busy={busy || undefined}
        >
            <Checkbox
                aria-label={task.done ? `Mark “${task.title}” not done` : `Mark “${task.title}” done`}
                checked={task.done}
                disabled={!writable}
                onChange={(e) => void updateTask(task, { done: e.target.checked })}
            />
            <button
                type="button"
                onClick={() => onOpen(task)}
                aria-haspopup="dialog"
                className="flex min-w-0 flex-1 flex-col items-start text-left"
            >
                <span className={`w-full truncate ${task.done ? 'line-through opacity-60' : ''}`}>{task.title}</span>
                {task.notes && <span className="w-full truncate text-xs opacity-60">{task.notes}</span>}
            </button>
            {listName && (
                <Pill tone="outline" className="hidden shrink-0 text-xs min-[380px]:inline-flex">
                    {listName}
                </Pill>
            )}
            {showDue && task.due && <Pill className="shrink-0 text-xs">{formatDue(task.due, today)}</Pill>}
            <IconButton
                icon="mark-x"
                label={`Delete “${task.title}”`}
                variant="ghost"
                size="sm"
                disabled={!writable}
                onClick={() => deleteTask(task)}
                className="shrink-0 opacity-60 [--button-fg:var(--color-secondary)] group-hover:opacity-100 focus-visible:opacity-100"
            />
        </li>
    );
}
