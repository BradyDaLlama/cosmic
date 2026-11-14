import { deleteRule } from '@/lib/server/budget/categories';
import { withBudget } from '@/lib/server/budget/route';

type Ctx = { params: Promise<{ id: string }> };

export const DELETE = (request: Request, { params }: Ctx) =>
    withBudget(request, async (email) => deleteRule(email, (await params).id));
