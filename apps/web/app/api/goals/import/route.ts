import { importGoals } from '@/lib/server/goals';
import { readJson, withUser } from '@/lib/server/userRoute';

export const POST = (request: Request) =>
    withUser(request, async (email) => importGoals(email, await readJson(request)));
