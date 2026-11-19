import { createNote, listNotes } from '@/lib/server/notes';
import { readJson, withUser } from '@/lib/server/userRoute';

export const GET = (request: Request) => withUser(request, (email) => listNotes(email));

export const POST = (request: Request) =>
    withUser(request, async (email) => createNote(email, await readJson(request)));
