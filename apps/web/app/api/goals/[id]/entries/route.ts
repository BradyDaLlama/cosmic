import { addEntry } from '@/lib/server/goals';
import { readJson, withUser } from '@/lib/server/userRoute';

type Ctx = { params: Promise<{ id: string }> };

export const POST = (request: Request, { params }: Ctx) =>
    withUser(request, async (email) => addEntry(email, (await params).id, await readJson(request)));
