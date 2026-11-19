'use client';

import { useEffect, useRef, useState } from 'react';
import {
    Button,
    ColorPicker,
    Dialog,
    IconPicker,
    iconNames,
    Input,
    type ColorSwatch,
    type IconName,
} from '@bradydallama/ui';
import { HabitBadge } from '@/components/habits/HabitBadge';
import { HABIT_COLORS, habitColor, habitPresets, type HabitColor } from '@/lib/habits/model';
import { MAX_TEXT_LENGTH, type Note, type NoteType } from '@/lib/notes/model';
import { createNote, deleteNote, flushNote, setArchived, updateNote } from '@/lib/notes/store';

const SWATCHES: ColorSwatch[] = habitPresets.map((c) => ({ value: c, ...HABIT_COLORS[c] }));

const TYPES: { value: NoteType; label: string }[] = [
    { value: 'list', label: 'List' },
    { value: 'text', label: 'Text' },
];

type NoteEditorProps = {
    note: Note | null;
    open: boolean;
    onClose: () => void;
    onSaved?: (note: Note) => void;
    onDeleted?: () => void;
};

export function NoteEditor({ note, open, onClose, onSaved, onDeleted }: NoteEditorProps) {
    const [name, setName] = useState('');
    const [type, setType] = useState<NoteType>('list');
    const [text, setText] = useState('');
    const [color, setColor] = useState<HabitColor>('sky');
    const [icon, setIcon] = useState<IconName>('clipboard-2');
    const [confirmDelete, setConfirmDelete] = useState(false);
    const nameRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!open) return;
        if (note) flushNote(note);
        setName(note?.name ?? '');
        setType(note?.type ?? 'list');
        setText(note?.text ?? '');
        setColor(note?.color ?? 'sky');
        setIcon(note?.icon ?? 'clipboard-2');
        setConfirmDelete(false);
        if (!note) requestAnimationFrame(() => nameRef.current?.focus());
    }, [open, note]);

    const save = async () => {
        const input = { name: name.trim(), type, color, icon, text: text.trim() || undefined };
        if (note) {
            void updateNote(note, input);
            onClose();
        } else {
            const created = await createNote({ ...input, items: [] });
            onClose();
            if (created) onSaved?.(created);
        }
    };

    const preview = habitColor(color);

    return (
        <Dialog open={open} onClose={onClose} variant="sheet" title={note ? 'Edit note' : 'New note'}>
            <form
                className="flex flex-col gap-4"
                onSubmit={(e) => {
                    e.preventDefault();
                    if (name.trim()) void save();
                }}
            >
                <div className="flex items-end gap-3">
                    <span className="mb-1.5">
                        <HabitBadge icon={icon} color={color} size="md" shape="rounded" />
                    </span>
                    <Input
                        ref={nameRef}
                        label="Name"
                        placeholder={type === 'list' ? 'Movies to watch' : 'Gift ideas for Mom'}
                        value={name}
                        maxLength={120}
                        onChange={(e) => setName(e.target.value)}
                        className="flex-1"
                    />
                </div>

                <fieldset className="flex flex-col gap-2">
                    <legend className="bd-field-label pb-2">Type</legend>
                    <div className="flex gap-2">
                        {TYPES.map((t) => (
                            <Button
                                key={t.value}
                                type="button"
                                size="sm"
                                variant={type === t.value ? 'primary' : 'ghost'}
                                aria-pressed={type === t.value}
                                onClick={() => setType(t.value)}
                            >
                                {t.label}
                            </Button>
                        ))}
                    </div>
                    <p className="text-xs opacity-70">
                        {type === 'list'
                            ? 'Items to check off and reorder. Add them once the note is open.'
                            : 'Free text you can edit right in the note.'}
                    </p>
                </fieldset>

                <label className="flex flex-col gap-1">
                    <span className="bd-field-label">{type === 'list' ? 'Note (optional)' : 'Text'}</span>
                    <textarea
                        className="bd-input min-h-24 resize-y !rounded-2xl py-2"
                        value={text}
                        maxLength={MAX_TEXT_LENGTH}
                        onChange={(e) => setText(e.target.value)}
                        placeholder={type === 'list' ? 'Shown above the list' : 'Write anything'}
                    />
                </label>

                <ColorPicker label="Color" swatches={SWATCHES} tools value={preview.fill} onChange={setColor} />

                <IconPicker
                    label="Icon"
                    icons={iconNames}
                    value={icon}
                    onChange={setIcon}
                    accent={preview.fill}
                    accentInk={preview.ink}
                    maxHeight="10rem"
                />

                <div className="flex items-center justify-between gap-2 pt-1">
                    {note ? (
                        confirmDelete ? (
                            <span className="flex items-center gap-2">
                                <Button
                                    type="button"
                                    variant="danger"
                                    onClick={() => {
                                        void deleteNote(note);
                                        onClose();
                                        onDeleted?.();
                                    }}
                                >
                                    Delete note
                                </Button>
                                <Button type="button" variant="ghost" onClick={() => setConfirmDelete(false)}>
                                    Cancel
                                </Button>
                            </span>
                        ) : (
                            <span className="flex items-center gap-2">
                                <Button
                                    type="button"
                                    variant="secondary"
                                    icon={note.archivedAt ? 'eye' : 'eye-hide'}
                                    title={
                                        note.archivedAt
                                            ? 'Show this note on Today again'
                                            : 'Hide this note from Today but keep its contents'
                                    }
                                    onClick={() => {
                                        void setArchived(note, !note.archivedAt);
                                        onClose();
                                    }}
                                >
                                    {note.archivedAt ? 'Unarchive' : 'Archive'}
                                </Button>
                                <Button
                                    type="button"
                                    variant="secondary"
                                    icon="mark-x"
                                    onClick={() => setConfirmDelete(true)}
                                >
                                    Delete
                                </Button>
                            </span>
                        )
                    ) : (
                        <span />
                    )}
                    {!confirmDelete && (
                        <Button type="submit" disabled={!name.trim()}>
                            {note ? 'Save' : 'Add note'}
                        </Button>
                    )}
                </div>
            </form>
        </Dialog>
    );
}
