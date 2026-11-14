import { createRoutine, listRoutines } from '@/lib/server/routines';
import { readJson, withUser } from '@/lib/server/userRoute';

export const GET = (request: Request) =>
    withUser(request, (email) => listRoutines(email, new URL(request.url).searchParams.get('date') ?? ''));

export const POST = (request: Request) =>
    withUser(request, async (email) => createRoutine(email, await readJson(request)));
