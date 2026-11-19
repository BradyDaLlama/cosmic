import { deleteNote, updateNote } from '@/lib/server/notes';
import { readJson, withUser } from '@/lib/server/userRoute';

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = (request: Request, { params }: Ctx) =>
    withUser(request, async (email) => updateNote(email, (await params).id, await readJson(request)));

export const DELETE = (request: Request, { params }: Ctx) =>
    withUser(request, async (email) => deleteNote(email, (await params).id));
