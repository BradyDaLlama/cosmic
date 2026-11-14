import { googleTasks } from '@/lib/server/google';
import { body, withSession } from '@/lib/server/respond';
import { TasksError } from '@/lib/tasks/api';

export const GET = (request: Request) => withSession(request, (s) => googleTasks.lists(s));

export const POST = (request: Request) =>
    withSession(request, async (s) => {
        const { title } = await body<{ title?: string }>(request);
        if (!title?.trim()) throw new TasksError('invalid', 'A list needs a name.');
        return googleTasks.createList(s, title.trim());
    });
