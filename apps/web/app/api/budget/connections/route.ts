import { connect } from '@/lib/server/budget/connections';
import { withBudget } from '@/lib/server/budget/route';

export const maxDuration = 60;

export const POST = (request: Request) => withBudget(request, (email, session) => connect(email, session));
