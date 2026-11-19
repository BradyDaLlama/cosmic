/**
 * Personal notes kept apart from Google Tasks: either a list of items to check off, or free text.
 * A list can carry free text too, shown above its items.
 */
import type { IconName } from '@bradydallama/ui';
import { fromISODate } from '@/lib/dates';
import type { HabitColor } from '@/lib/habits/model';

export type NoteType = 'list' | 'text';

export type NoteItem = { id: string; text: string; done: boolean };

export type Note = {
    id: string;
    type: NoteType;
    name: string;
    icon: IconName;
    color: HabitColor;
    text?: string;
    items: NoteItem[];
    /** The local day it was created, YYYY-MM-DD. */
    createdOn: string;
    /** Archived notes are hidden on Today but keep their contents, and the API still returns them. */
    archivedAt?: string;
    order: number;
    createdAt: string;
    updatedAt: string;
};

export type NoteInput = Pick<Note, 'type' | 'name' | 'icon' | 'color' | 'items'> & { text?: string };

export type NoteUpdate = Partial<NoteInput> & { archived?: boolean };

export const NOTE_TYPES: readonly NoteType[] = ['list', 'text'];
export const MAX_ITEMS = 300;
export const MAX_ITEM_LENGTH = 200;
export const MAX_TEXT_LENGTH = 5000;

export const openCount = (note: Note) => note.items.filter((i) => !i.done).length;

export function formatNoteDay(iso: string, today: string): string {
    const date = fromISODate(iso);
    const sameYear = iso.slice(0, 4) === today.slice(0, 4);
    return date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        ...(sameYear ? {} : { year: 'numeric' }),
    });
}
