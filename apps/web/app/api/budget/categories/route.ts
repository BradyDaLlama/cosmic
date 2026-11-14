import { createCategory, listCategories } from '@/lib/server/budget/categories';
import { withBudget } from '@/lib/server/budget/route';
import { readJson } from '@/lib/server/userRoute';

export const GET = (request: Request) => withBudget(request, (email) => listCategories(email));

export const POST = (request: Request) =>
    withBudget(request, async (email) => createCategory(email, await readJson(request)));
