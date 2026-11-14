import { setDone } from '@/lib/server/habits';
import { readJson, withUser } from '@/lib/server/userRoute';

type Ctx = { params: Promise<{ id: string }> };

export const POST = (request: Request, { params }: Ctx) =>
    withUser(request, async (email) => setDone(email, (await params).id, await readJson(request)));
