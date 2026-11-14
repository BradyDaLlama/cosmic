import { listAccounts } from '@/lib/server/budget/items';
import { withBudget } from '@/lib/server/budget/route';

export const GET = (request: Request) => withBudget(request, (email) => listAccounts(email));
