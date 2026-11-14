import { googleTasks } from '@/lib/server/google';
import { body, isDate, withSession } from '@/lib/server/respond';
import { TasksError } from '@/lib/tasks/api';
import type { TaskPatch } from '@/lib/tasks/model';

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = (request: Request, { params }: Ctx) =>
    withSession(request, async (s) => {
        const { id } = await params;
        const { listId, ...patch } = await body<TaskPatch & { listId?: string }>(request);
        if (!listId) throw new TasksError('invalid', 'Missing listId.');
        if (patch.title !== undefined && !patch.title.trim()) throw new TasksError('invalid', 'Title is empty.');
        if (patch.due != null && !isDate(patch.due)) throw new TasksError('invalid', 'due must be YYYY-MM-DD.');
        return googleTasks.update(s, listId, id, {
            title: patch.title,
            notes: patch.notes,
            due: patch.due,
            done: patch.done,
        });
    });

export const DELETE = (request: Request, { params }: Ctx) =>
    withSession(request, async (s) => {
        const { id } = await params;
        const list = new URL(request.url).searchParams.get('list');
        if (!list) throw new TasksError('invalid', 'Missing ?list=');
        await googleTasks.remove(s, list, id);
    });
