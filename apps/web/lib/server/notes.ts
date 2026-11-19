import { MAX_ITEM_LENGTH, MAX_ITEMS, MAX_TEXT_LENGTH, NOTE_TYPES, type Note, type NoteItem } from '@/lib/notes/model';
import { collections, type NoteDoc } from './db';
import { invalid, isDate, isString, newId, notFound, oneOf, optionalText, requiredText } from './userRoute';

const toNote = ({ email: _e, _id, ...rest }: NoteDoc): Note => ({ ...rest, id: _id }) as Note;

function items(raw: unknown): NoteItem[] {
    if (!Array.isArray(raw)) throw invalid('items must be a list.');
    if (raw.length > MAX_ITEMS) throw invalid(`A note can have up to ${MAX_ITEMS} items.`);
    const ids = new Set<string>();
    return raw.map((i: Record<string, unknown>) => {
        const id = isString(i?.id, 64) && i.id ? i.id : newId();
        if (ids.has(id)) throw invalid('Item ids must be unique.');
        ids.add(id);
        return { id, text: requiredText(i?.text, 'item', MAX_ITEM_LENGTH), done: i?.done === true };
    });
}

type Fields = Pick<NoteDoc, 'type' | 'name' | 'icon' | 'color' | 'text' | 'items'>;

function fields(body: Record<string, unknown>, partial: boolean): Partial<Fields> & { clearText?: boolean } {
    const out: Partial<Fields> & { clearText?: boolean } = {};
    if (!partial || 'type' in body) out.type = oneOf(body.type, NOTE_TYPES, 'type');
    if (!partial || 'name' in body) out.name = requiredText(body.name, 'name');
    if (!partial || 'icon' in body) {
        if (!isString(body.icon, 40) || !body.icon) throw invalid('icon is required.');
        out.icon = body.icon;
    }
    if (!partial || 'color' in body) {
        if (!isString(body.color, 32) || !body.color) throw invalid('color is required.');
        out.color = body.color;
    }
    if ('text' in body) {
        const text = optionalText(body.text, 'text', MAX_TEXT_LENGTH);
        if (text) out.text = text;
        else out.clearText = true;
    }
    if (!partial || 'items' in body) out.items = items(body.items ?? []);
    return out;
}

export async function listNotes(email: string): Promise<Note[]> {
    const notes = await collections.notes();
    return (await notes.find({ email }).sort({ order: 1 }).toArray()).map(toNote);
}

export async function createNote(email: string, body: Record<string, unknown>): Promise<Note> {
    const notes = await collections.notes();
    const last = await notes.find({ email }).sort({ order: -1 }).limit(1).next();
    const { clearText: _c, ...f } = fields(body, false);
    const stamp = new Date().toISOString();
    const doc: NoteDoc = {
        ...(f as Fields),
        _id: newId(),
        email,
        // The client sends its local day; the server's UTC day is only a fallback.
        createdOn: isDate(body.createdOn) ? body.createdOn : stamp.slice(0, 10),
        order: (last?.order ?? 0) + 1,
        createdAt: stamp,
        updatedAt: stamp,
    };
    await notes.insertOne(doc);
    return toNote(doc);
}

export async function updateNote(email: string, id: string, body: Record<string, unknown>): Promise<Note> {
    const notes = await collections.notes();
    const { clearText, ...f } = fields(body, true);
    if ('archived' in body && typeof body.archived !== 'boolean') throw invalid('archived must be true or false.');
    const stamp = new Date().toISOString();
    const unset = {
        ...(clearText ? { text: '' as const } : {}),
        ...(body.archived === false ? { archivedAt: '' as const } : {}),
    };
    const doc = await notes.findOneAndUpdate(
        { _id: id, email },
        {
            $set: { ...f, updatedAt: stamp, ...(body.archived === true ? { archivedAt: stamp } : {}) },
            ...(Object.keys(unset).length ? { $unset: unset } : {}),
        },
        { returnDocument: 'after' },
    );
    if (!doc) throw notFound();
    return toNote(doc);
}

export async function deleteNote(email: string, id: string): Promise<void> {
    const notes = await collections.notes();
    const { deletedCount } = await notes.deleteOne({ _id: id, email });
    if (!deletedCount) throw notFound();
}
