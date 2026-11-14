import { listInbox } from '@/lib/server/budget/categories';
import { withBudget } from '@/lib/server/budget/route';

export const GET = (request: Request) => withBudget(request, (email) => listInbox(email));
