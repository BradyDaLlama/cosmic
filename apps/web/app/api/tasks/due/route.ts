import { googleTasks } from '@/lib/server/google';
import { isDate, withSession } from '@/lib/server/respond';
import { TasksError } from '@/lib/tasks/api';

export const GET = (request: Request) =>
    withSession(request, (s) => {
        const until = new URL(request.url).searchParams.get('until');
        if (!isDate(until)) throw new TasksError('invalid', 'until must be YYYY-MM-DD.');
        return googleTasks.due(s, until);
    });
