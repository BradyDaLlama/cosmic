import { resetRun, saveRun } from '@/lib/server/routines';
import { readJson, withUser } from '@/lib/server/userRoute';

type Ctx = { params: Promise<{ id: string; date: string }> };

export const PUT = (request: Request, { params }: Ctx) =>
    withUser(request, async (email) => {
        const { id, date } = await params;
        return saveRun(email, id, date, await readJson(request));
    });

export const DELETE = (request: Request, { params }: Ctx) =>
    withUser(request, async (email) => {
        const { id, date } = await params;
        await resetRun(email, id, date);
    });
