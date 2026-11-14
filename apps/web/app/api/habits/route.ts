import { createHabit, listHabits } from '@/lib/server/habits';
import { readJson, withUser } from '@/lib/server/userRoute';

export const GET = (request: Request) => withUser(request, (email) => listHabits(email));

export const POST = (request: Request) =>
    withUser(request, async (email) => createHabit(email, await readJson(request)));
