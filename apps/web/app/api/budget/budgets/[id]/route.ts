import { deleteBudget, updateBudget } from '@/lib/server/budget/budgets';
import { withBudget } from '@/lib/server/budget/route';
import { readJson } from '@/lib/server/userRoute';

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = (request: Request, { params }: Ctx) =>
    withBudget(request, async (email) => updateBudget(email, (await params).id, await readJson(request)));

export const DELETE = (request: Request, { params }: Ctx) =>
    withBudget(request, async (email) => deleteBudget(email, (await params).id));
