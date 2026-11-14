import { TasksError, toTasksError, type TasksApi, type TasksErrorCode } from './api';
import { API_URL } from '@/lib/apiClient';
import type { Task, TaskList } from './model';

const BASE = `${API_URL}/api`;

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    let res: Response;
    try {
        res = await fetch(`${BASE}${path}`, {
            ...init,
            credentials: 'include',
            headers: { 'Content-Type': 'application/json', ...init.headers },
        });
    } catch (err) {
        throw toTasksError(err);
    }
    if (res.status === 204) return undefined as T;
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
        const code: TasksErrorCode =
            body.error ?? (res.status === 401 ? 'unauthorized' : res.status === 404 ? 'not_found' : 'google');
        throw new TasksError(code);
    }
    return body as T;
}

const json = (method: string, data: unknown): RequestInit => ({ method, body: JSON.stringify(data) });
const q = encodeURIComponent;

export const httpTasksApi: TasksApi = {
    lists: () => request<TaskList[]>('/tasklists'),
    createList: (title) => request<TaskList>('/tasklists', json('POST', { title })),
    renameList: (id, title) => request<TaskList>(`/tasklists/${q(id)}`, json('PATCH', { title })),
    deleteList: (id) => request<void>(`/tasklists/${q(id)}`, { method: 'DELETE' }),
    clearCompleted: (listId) => request<void>(`/tasklists/${q(listId)}/clear`, { method: 'POST' }),

    tasks: (listId) => request<Task[]>(`/tasks?list=${q(listId)}`),
    due: (until) => request<Task[]>(`/tasks/due?until=${q(until)}`),
    create: (input) => request<Task>('/tasks', json('POST', input)),
    update: (task, patch) => request<Task>(`/tasks/${q(task.id)}`, json('PATCH', { listId: task.listId, ...patch })),
    remove: (task) => request<void>(`/tasks/${q(task.id)}?list=${q(task.listId)}`, { method: 'DELETE' }),
};
