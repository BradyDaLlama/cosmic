import { importHabits } from '@/lib/server/habits';
import { readJson, withUser } from '@/lib/server/userRoute';

export const POST = (request: Request) =>
    withUser(request, async (email) => importHabits(email, await readJson(request)));
