import { googleTasks } from '@/lib/server/google';
import { withSession } from '@/lib/server/respond';

type Ctx = { params: Promise<{ id: string }> };

export const POST = (request: Request, { params }: Ctx) =>
    withSession(request, async (s) => {
        const { id } = await params;
        await googleTasks.deleteCompleted(s, id);
    });
