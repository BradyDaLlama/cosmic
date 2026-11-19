'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { api as request, loadErrorMessage, usesServer } from '@/lib/apiClient';
import { todayISO } from '@/lib/dates';
import { newId } from '@/lib/id';
import { readJson, writeJson } from '@/lib/storage';
import { MAX_ITEMS, type Note, type NoteInput, type NoteItem, type NoteUpdate } from './model';

type NewNote = NoteInput & { createdOn: string };

type NotesApi = {
    load(): Promise<Note[]>;
    createNote(input: NewNote): Promise<Note>;
    updateNote(id: string, input: NoteUpdate): Promise<Note>;
    deleteNote(id: string): Promise<void>;
};

const KEY = 'cosmic.notes';
type Stored = { version: 2; notes: Note[] };
function read(): Stored {
    const data = readJson<Stored>(KEY);
    return data?.version === 2 ? data : { version: 2, notes: [] };
}
const write = (data: Stored) => writeJson(KEY, data);

const localApi: NotesApi = {
    async load() {
        return read().notes;
    },
    async createNote(input) {
        const d = read();
        const stamp = new Date().toISOString();
        const note: Note = {
            ...input,
            name: input.name.trim(),
            id: newId(),
            order: d.notes.reduce((m, n) => Math.max(m, n.order), 0) + 1,
            createdAt: stamp,
            updatedAt: stamp,
        };
        if (!note.text) delete note.text;
        d.notes.push(note);
        write(d);
        return note;
    },
    async updateNote(id, input) {
        const d = read();
        const note = d.notes.find((n) => n.id === id);
        if (!note) throw new Error('not found');
        const { archived, ...fields } = input;
        const stamp = new Date().toISOString();
        Object.assign(note, fields, { updatedAt: stamp });
        if ('text' in fields && !fields.text) delete note.text;
        if (archived === true) note.archivedAt = stamp;
        if (archived === false) delete note.archivedAt;
        write(d);
        return note;
    },
    async deleteNote(id) {
        const d = read();
        d.notes = d.notes.filter((n) => n.id !== id);
        write(d);
    },
};

const enc = encodeURIComponent;
const httpApi: NotesApi = {
    load: () => request('/api/notes'),
    createNote: (input) => request('/api/notes', { method: 'POST', body: input }),
    updateNote: (id, input) =>
        request(`/api/notes/${enc(id)}`, {
            method: 'PATCH',
            // JSON drops `undefined`, so cleared text is sent as `null`.
            body: 'text' in input && !input.text ? { ...input, text: null } : input,
        }),
    deleteNote: (id) => request(`/api/notes/${enc(id)}`, { method: 'DELETE' }),
};

const api = usesServer ? httpApi : localApi;
export const notesSynced = usesServer;

type State = { notes: Note[]; loaded: boolean; error: string | null };
const initial: State = { notes: [], loaded: false, error: null };
let state = initial;
const listeners = new Set<() => void>();
let loading = false;

function set(next: Partial<State>) {
    state = { ...state, ...next };
    listeners.forEach((l) => l());
}

function load() {
    if (loading) return;
    loading = true;
    api.load()
        .then((notes) => set({ notes, loaded: true, error: null }))
        .catch((err) => {
            set({ loaded: true, error: loadErrorMessage(err, 'notes') });
            loading = false;
        });
}

const current = (note: Note) => state.notes.find((n) => n.id === note.id) ?? note;
const setLocal = (note: Note, patch: Partial<Note>) =>
    set({ notes: state.notes.map((n) => (n.id === note.id ? { ...n, ...patch } : n)), error: null });

/** Saves to one note run in order, so quick taps can't land out of order and undo each other. */
const queues = new Map<string, Promise<unknown>>();

function persist(note: Note, input: NoteUpdate) {
    const next = (queues.get(note.id) ?? Promise.resolve())
        .then(() => api.updateNote(note.id, input))
        .catch(() => {
            set({ error: "That change didn't save. Try again." });
            api.load()
                .then((notes) => set({ notes }))
                .catch(() => {});
        });
    queues.set(note.id, next);
    return next;
}

function save(note: Note, input: Partial<NoteInput>) {
    setLocal(note, input);
    return persist(note, input);
}

/** Typing and dragging change a note many times a second, so those saves wait for a pause. */
const pending = new Map<string, { timer: ReturnType<typeof setTimeout>; flush: () => void }>();

function saveSoon(note: Note, field: 'items' | 'text') {
    const key = `${note.id}:${field}`;
    clearTimeout(pending.get(key)?.timer);
    const flush = () => {
        pending.delete(key);
        const latest = current(note);
        void persist(note, field === 'items' ? { items: latest.items } : { text: latest.text?.trim() || undefined });
    };
    pending.set(key, { timer: setTimeout(flush, 600), flush });
}

/** Saves any typing or reordering still waiting on its pause. */
export function flushNote(note: Note) {
    for (const field of ['items', 'text'] as const) {
        const entry = pending.get(`${note.id}:${field}`);
        if (!entry) continue;
        clearTimeout(entry.timer);
        entry.flush();
    }
}

export async function createNote(input: NoteInput): Promise<Note | undefined> {
    try {
        const note = await api.createNote({ ...input, createdOn: todayISO() });
        set({ notes: [...state.notes, note], error: null });
        return note;
    } catch {
        set({ error: "That note didn't save. Try again." });
        return undefined;
    }
}

export const updateNote = (note: Note, input: Partial<NoteInput>) => save(note, input);

export function setArchived(note: Note, archived: boolean) {
    flushNote(note);
    setLocal(note, { archivedAt: archived ? new Date().toISOString() : undefined });
    return persist(note, { archived });
}

export async function deleteNote(note: Note) {
    const before = state.notes;
    set({ notes: before.filter((n) => n.id !== note.id) });
    try {
        await api.deleteNote(note.id);
    } catch {
        set({ notes: before, error: "That didn't delete. Try again." });
    }
}

export function setText(note: Note, text: string) {
    setLocal(note, { text });
    saveSoon(note, 'text');
}

const editItems = (note: Note, edit: (items: NoteItem[]) => NoteItem[]) =>
    save(note, { items: edit(current(note).items) });

export function addItem(note: Note, text: string) {
    const clean = text.trim();
    if (!clean || current(note).items.length >= MAX_ITEMS) return;
    return editItems(note, (items) => [...items, { id: newId(), text: clean, done: false }]);
}

export const toggleItem = (note: Note, id: string) =>
    editItems(note, (items) => items.map((i) => (i.id === id ? { ...i, done: !i.done } : i)));

export const deleteItem = (note: Note, id: string) => editItems(note, (items) => items.filter((i) => i.id !== id));

export const clearChecked = (note: Note) => editItems(note, (items) => items.filter((i) => !i.done));

export function reorderItems(note: Note, items: NoteItem[]) {
    setLocal(note, { items });
    saveSoon(note, 'items');
}

export function dismissNotesError() {
    set({ error: null });
}

const subscribe = (l: () => void) => {
    listeners.add(l);
    return () => listeners.delete(l);
};

export function useNotes(): State {
    const snapshot = useSyncExternalStore(
        subscribe,
        () => state,
        () => initial,
    );
    useEffect(load, []);
    return snapshot;
}
