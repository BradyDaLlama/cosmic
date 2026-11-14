import { googleTasks } from '@/lib/server/google';
import { body, withSession } from '@/lib/server/respond';
import { TasksError } from '@/lib/tasks/api';

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = (request: Request, { params }: Ctx) =>
    withSession(request, async (s) => {
        const { id } = await params;
        const { title } = await body<{ title?: string }>(request);
        if (!title?.trim()) throw new TasksError('invalid', 'A list needs a name.');
        return googleTasks.renameList(s, id, title.trim());
    });

export const DELETE = (request: Request, { params }: Ctx) =>
    withSession(request, async (s) => {
        const { id } = await params;
        const lists = await googleTasks.lists(s);
        if (lists[0]?.id === id) throw new TasksError('invalid', "The default list can't be deleted.");
        await googleTasks.deleteList(s, id);
    });
