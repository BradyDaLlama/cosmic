import { googleTasks } from '@/lib/server/google';
import { body, isDate, withSession } from '@/lib/server/respond';
import { TasksError } from '@/lib/tasks/api';
import type { NewTask } from '@/lib/tasks/model';

export const GET = (request: Request) =>
    withSession(request, (s) => {
        const list = new URL(request.url).searchParams.get('list');
        if (!list) throw new TasksError('invalid', 'Missing ?list=');
        return googleTasks.tasks(s, list);
    });

export const POST = (request: Request) =>
    withSession(request, async (s) => {
        const input = await body<Partial<NewTask>>(request);
        if (!input.listId || !input.title?.trim()) throw new TasksError('invalid', 'A task needs a list and a title.');
        if (input.due !== undefined && !isDate(input.due)) throw new TasksError('invalid', 'due must be YYYY-MM-DD.');
        return googleTasks.create(s, {
            listId: input.listId,
            title: input.title,
            notes: input.notes,
            due: input.due,
            parentId: input.parentId,
            previousId: input.previousId,
        });
    });
