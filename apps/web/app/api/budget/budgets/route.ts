import { createBudget, listBudgets } from '@/lib/server/budget/budgets';
import { withBudget } from '@/lib/server/budget/route';
import { readJson } from '@/lib/server/userRoute';

export const GET = (request: Request) =>
    withBudget(request, (email) => listBudgets(email, new URL(request.url).searchParams.get('date')));

export const POST = (request: Request) =>
    withBudget(request, async (email) => createBudget(email, await readJson(request)));
