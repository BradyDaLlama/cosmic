import { exchangePublicToken } from '@/lib/server/budget/items';
import { withBudget } from '@/lib/server/budget/route';
import { readJson } from '@/lib/server/userRoute';

export const POST = (request: Request) =>
    withBudget(request, async (email) => exchangePublicToken(email, await readJson(request)));
