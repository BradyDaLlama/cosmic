import type { NewTask, Task, TaskList, TaskPatch } from './model';

export type TasksApi = {
    lists(): Promise<TaskList[]>;
    createList(title: string): Promise<TaskList>;
    renameList(id: string, title: string): Promise<TaskList>;
    deleteList(id: string): Promise<void>;
    clearCompleted(listId: string): Promise<void>;

    tasks(listId: string): Promise<Task[]>;
    due(until: string): Promise<Task[]>;
    create(input: NewTask): Promise<Task>;
    update(task: Pick<Task, 'id' | 'listId'>, patch: TaskPatch): Promise<Task>;
    remove(task: Pick<Task, 'id' | 'listId'>): Promise<void>;
};

export type TasksErrorCode = 'offline' | 'unauthorized' | 'not_found' | 'rate_limited' | 'invalid' | 'google';

export class TasksError extends Error {
    constructor(
        readonly code: TasksErrorCode,
        message?: string,
    ) {
        super(message ?? code);
        this.name = 'TasksError';
    }
}

export function toTasksError(err: unknown): TasksError {
    if (err instanceof TasksError) return err;
    if (typeof navigator !== 'undefined' && !navigator.onLine) return new TasksError('offline');
    if (err instanceof TypeError) return new TasksError('offline', err.message);
    return new TasksError('google', err instanceof Error ? err.message : String(err));
}

export const errorMessages: Record<TasksErrorCode, string> = {
    offline: "You're offline. Changes need a connection.",
    unauthorized: 'Connect your Google account to use tasks.',
    not_found: 'That was already deleted in Google.',
    rate_limited: 'Google is busy. Try again in a moment.',
    invalid: "That change wasn't valid.",
    google: "Google Tasks didn't respond. Try again.",
};
