import { deleteRoutine, updateRoutine } from '@/lib/server/routines';
import { readJson, withUser } from '@/lib/server/userRoute';

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = (request: Request, { params }: Ctx) =>
    withUser(request, async (email) => updateRoutine(email, (await params).id, await readJson(request)));

export const DELETE = (request: Request, { params }: Ctx) =>
    withUser(request, async (email) => deleteRoutine(email, (await params).id));
