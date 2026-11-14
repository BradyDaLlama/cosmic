import { createRule } from '@/lib/server/budget/categories';
import { withBudget } from '@/lib/server/budget/route';
import { readJson } from '@/lib/server/userRoute';

export const POST = (request: Request) =>
    withBudget(request, async (email) => createRule(email, await readJson(request)));
