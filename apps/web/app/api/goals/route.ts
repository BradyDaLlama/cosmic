import { createGoal, listGoals } from '@/lib/server/goals';
import { readJson, withUser } from '@/lib/server/userRoute';

export const GET = (request: Request) => withUser(request, (email) => listGoals(email));

export const POST = (request: Request) =>
    withUser(request, async (email) => createGoal(email, await readJson(request)));
