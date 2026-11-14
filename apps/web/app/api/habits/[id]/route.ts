import { deleteHabit, updateHabit } from '@/lib/server/habits';
import { readJson, withUser } from '@/lib/server/userRoute';

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = (request: Request, { params }: Ctx) =>
    withUser(request, async (email) => updateHabit(email, (await params).id, await readJson(request)));

export const DELETE = (request: Request, { params }: Ctx) =>
    withUser(request, async (email) => deleteHabit(email, (await params).id));
