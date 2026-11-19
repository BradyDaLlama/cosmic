'use client';

import { useEffect, useState, type KeyboardEvent } from 'react';
import { Button, Card, IconButton, Input, Pill, useLongPress } from '@bradydallama/ui';
import { HabitBadge, HabitCheck } from '@/components/habits/HabitBadge';
import { SortableList } from '@/components/SortableList';
import { toISODate } from '@/lib/dates';
import { habitColor } from '@/lib/habits/model';
import { formatNoteDay, MAX_ITEM_LENGTH, MAX_ITEMS, MAX_TEXT_LENGTH, openCount, type Note } from '@/lib/notes/model';
import {
    addItem,
    clearChecked,
    deleteItem,
    dismissNotesError,
    flushNote,
    notesSynced,
    reorderItems,
    setText,
    toggleItem,
    useNotes,
} from '@/lib/notes/store';
import { useToday } from '@/lib/tasks';
import { NoteEditor } from './NoteEditor';

export function NotesSection() {
    const today = useToday();
    const { notes, loaded, error } = useNotes();
    const [openId, setOpenId] = useState<string | null>(null);
    const [editing, setEditing] = useState<Note | 'new' | null>(null);
    const [showArchived, setShowArchived] = useState(false);
    const sorted = [...notes].sort((a, b) => a.order - b.order);
    const active = sorted.filter((n) => !n.archivedAt);
    const archived = sorted.filter((n) => n.archivedAt);
    const open = (showArchived ? sorted : active).find((n) => n.id === openId) ?? null;

    const chips = (list: Note[], label: string) => (
        <ul className="flex flex-wrap gap-2" aria-label={label}>
            {list.map((note) => (
                <li key={note.id} className={note.archivedAt ? 'opacity-70' : undefined}>
                    <NoteChip
                        note={note}
                        open={note.id === openId}
                        onToggle={() => setOpenId((id) => (id === note.id ? null : note.id))}
                        onEdit={() => setEditing(note)}
                    />
                </li>
            ))}
        </ul>
    );

    return (
        <section className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
                <h2 className="flex items-center gap-2 text-md text-bubble">
                    Notes
                    {!notesSynced && (
                        <Pill tone="outline" className="text-xs" title="Saved in this browser in demo mode">
                            this device
                        </Pill>
                    )}
                </h2>
                <span className="flex items-center gap-3">
                    {loaded && archived.length > 0 && (
                        <button
                            type="button"
                            aria-expanded={showArchived}
                            onClick={() => setShowArchived((v) => !v)}
                            className="text-xs text-bubble underline underline-offset-4"
                        >
                            {showArchived ? 'Hide archived' : `Show archived (${archived.length})`}
                        </button>
                    )}
                    {loaded && active.length > 0 && (
                        <button
                            type="button"
                            onClick={() => setEditing('new')}
                            className="text-xs text-bubble underline underline-offset-4"
                        >
                            + New note
                        </button>
                    )}
                </span>
            </div>

            {loaded && !error && active.length === 0 && (
                <Button icon="star-4" onClick={() => setEditing('new')} className="self-start">
                    Add a note
                </Button>
            )}

            {loaded && active.length > 0 && chips(active, 'Notes')}

            {open && !open.archivedAt && today && <NotePanel key={open.id} note={open} today={today} />}

            {loaded && showArchived && archived.length > 0 && chips(archived, 'Archived notes')}

            {open?.archivedAt && today && <NotePanel key={open.id} note={open} today={today} />}

            {error && (
                <p role="alert" className="flex items-center justify-between gap-2 text-xs text-bubble">
                    <span className="opacity-80">{error}</span>
                    <button type="button" className="underline underline-offset-4" onClick={dismissNotesError}>
                        Dismiss
                    </button>
                </p>
            )}

            <NoteEditor
                note={editing === 'new' ? null : editing}
                open={editing !== null}
                onClose={() => setEditing(null)}
                onSaved={(note) => setOpenId(note.id)}
                onDeleted={() => setOpenId(null)}
            />
        </section>
    );
}

function NoteChip({
    note,
    open,
    onToggle,
    onEdit,
}: {
    note: Note;
    open: boolean;
    onToggle: () => void;
    onEdit: () => void;
}) {
    const { fill } = habitColor(note.color);
    const { handlers, pressing } = useLongPress({ onTap: onToggle, onLongPress: onEdit });
    const done = note.items.length - openCount(note);
    const status = note.type === 'list' && note.items.length > 0 ? `${done}/${note.items.length}` : null;
    return (
        <button
            type="button"
            aria-expanded={open}
            aria-keyshortcuts="Shift+F10"
            title="Tap to open. Hold to edit."
            {...handlers}
            className="flex items-center gap-2 rounded-xl py-1 pr-3 pl-1 text-sm"
            style={{
                ...handlers.style,
                scale: pressing ? '0.92' : '1',
                transition: pressing ? 'scale 500ms ease-in' : 'scale 150ms ease-out',
                background: 'var(--color-bubble)',
                color: 'var(--color-text)',
                border: 'var(--border-outline) solid var(--color-bg)',
                outline: `var(--border-outline) solid ${fill}`,
            }}
        >
            <HabitBadge icon={note.icon} color={note.color} shape="rounded" />
            <span>{note.name}</span>
            {status && <span className="text-xs opacity-60">{status}</span>}
        </button>
    );
}

function NotePanel({ note, today }: { note: Note; today: string }) {
    // Save any typing still waiting on its pause when the panel closes.
    useEffect(() => () => flushNote(note), [note.id]); // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <Card className="flex flex-col gap-1">
            <span className="pb-1 text-xs opacity-70">
                Created {formatNoteDay(note.createdOn, today)}
                {note.archivedAt && `, archived ${formatNoteDay(toISODate(new Date(note.archivedAt)), today)}`}
            </span>
            {note.type === 'list' ? (
                <ListBody note={note} />
            ) : (
                <textarea
                    aria-label={note.name}
                    className="bd-input min-h-32 resize-y !rounded-2xl py-2"
                    value={note.text ?? ''}
                    maxLength={MAX_TEXT_LENGTH}
                    placeholder="Write anything"
                    onChange={(e) => setText(note, e.target.value)}
                    onBlur={() => flushNote(note)}
                />
            )}
        </Card>
    );
}

function ListBody({ note }: { note: Note }) {
    const [draft, setDraft] = useState('');
    const checked = note.items.length - openCount(note);
    const full = note.items.length >= MAX_ITEMS;

    const onAddKey = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key !== 'Enter' || !draft.trim()) return;
        void addItem(note, draft);
        setDraft('');
    };

    return (
        <>
            {note.text && <p className="pb-1 text-sm whitespace-pre-wrap opacity-80">{note.text}</p>}

            {note.items.length === 0 && <p className="py-1 text-sm opacity-70">Nothing on this list yet.</p>}

            <SortableList
                items={note.items}
                getKey={(item) => item.id}
                onReorder={(items) => reorderItems(note, items)}
                label={(item) => `“${item.text}”`}
                gap={0}
                renderItem={(item, _, handle) => (
                    <div className="group flex min-h-10 items-center gap-2">
                        {handle}
                        <HabitCheck
                            done={item.done}
                            color={note.color}
                            label={item.done ? `Uncheck “${item.text}”` : `Check off “${item.text}”`}
                            onToggle={() => void toggleItem(note, item.id)}
                        />
                        <span className={`min-w-0 flex-1 break-words ${item.done ? 'line-through opacity-60' : ''}`}>
                            {item.text}
                        </span>
                        <IconButton
                            icon="mark-x"
                            label={`Delete “${item.text}”`}
                            variant="ghost"
                            size="sm"
                            onClick={() => void deleteItem(note, item.id)}
                            className="shrink-0 opacity-60 [--button-fg:var(--color-secondary)] group-hover:opacity-100 focus-visible:opacity-100"
                        />
                    </div>
                )}
            />

            <Input
                aria-label={`Add to ${note.name}`}
                placeholder={full ? `Lists hold up to ${MAX_ITEMS} items` : 'Add an item'}
                value={draft}
                maxLength={MAX_ITEM_LENGTH}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={onAddKey}
                disabled={full}
                className="mt-1"
            />

            {checked > 0 && (
                <button
                    type="button"
                    onClick={() => void clearChecked(note)}
                    className="mt-2 self-start text-xs underline underline-offset-4 opacity-80"
                >
                    Clear checked ({checked})
                </button>
            )}
        </>
    );
}
