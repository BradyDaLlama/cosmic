import { deleteEntry } from '@/lib/server/goals';
import { withUser } from '@/lib/server/userRoute';

type Ctx = { params: Promise<{ entryId: string }> };

export const DELETE = (request: Request, { params }: Ctx) =>
    withUser(request, async (email) => deleteEntry(email, (await params).entryId));
