import { listTransactions } from '@/lib/server/budget/items';
import { withBudget } from '@/lib/server/budget/route';

export const GET = (request: Request) => withBudget(request, (email) => listTransactions(email, new URL(request.url)));
