import { deleteGoal, updateGoal } from '@/lib/server/goals';
import { readJson, withUser } from '@/lib/server/userRoute';

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = (request: Request, { params }: Ctx) =>
    withUser(request, async (email) => updateGoal(email, (await params).id, await readJson(request)));

export const DELETE = (request: Request, { params }: Ctx) =>
    withUser(request, async (email) => deleteGoal(email, (await params).id));
