import { deleteCategory, updateCategory } from '@/lib/server/budget/categories';
import { withBudget } from '@/lib/server/budget/route';
import { readJson } from '@/lib/server/userRoute';

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = (request: Request, { params }: Ctx) =>
    withBudget(request, async (email) => updateCategory(email, (await params).id, await readJson(request)));

export const DELETE = (request: Request, { params }: Ctx) =>
    withBudget(request, async (email) => deleteCategory(email, (await params).id));
