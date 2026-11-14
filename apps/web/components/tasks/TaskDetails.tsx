'use client';

import { useEffect, useState } from 'react';
import { Button, Dialog, Input } from '@bradydallama/ui';
import { deleteTask, updateTask, useTasksState, type Task, type TaskPatch } from '@/lib/tasks';

type TaskDetailsProps = {
    task: Task | null;
    listName?: string;
    onClose: () => void;
};

export function TaskDetails({ task, listName, onClose }: TaskDetailsProps) {
    const { online, authorized } = useTasksState();
    const writable = online && authorized;
    const [title, setTitle] = useState('');
    const [notes, setNotes] = useState('');
    const [due, setDue] = useState('');

    useEffect(() => {
        if (!task) return;
        setTitle(task.title);
        setNotes(task.notes ?? '');
        setDue(task.due ?? '');
        // Reset only when a different task opens, not on every refresh of it.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [task?.id]);

    const save = () => {
        if (!task) return;
        const patch: TaskPatch = {};
        if (title.trim() && title.trim() !== task.title) patch.title = title;
        if (notes.trim() !== (task.notes ?? '')) patch.notes = notes.trim() || null;
        if (due !== (task.due ?? '')) patch.due = due || null;
        if (Object.keys(patch).length) void updateTask(task, patch);
        onClose();
    };

    return (
        <Dialog open={!!task} onClose={onClose} variant="sheet" title="Task">
            {task && (
                <form
                    className="flex flex-col gap-3"
                    onSubmit={(e) => {
                        e.preventDefault();
                        save();
                    }}
                >
                    <Input
                        label="Title"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        disabled={!writable}
                    />
                    <label className="bd-field flex flex-col gap-1">
                        <span className="bd-field-label">Notes</span>
                        <textarea
                            className="bd-input min-h-24 resize-y !rounded-2xl py-2"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            disabled={!writable}
                            placeholder="Add notes"
                        />
                    </label>
                    <div className="flex items-end gap-2">
                        <Input
                            label="Due date"
                            type="date"
                            value={due}
                            onChange={(e) => setDue(e.target.value)}
                            disabled={!writable}
                            className="flex-1"
                        />
                        {due && (
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => setDue('')}
                                disabled={!writable}
                            >
                                Clear
                            </Button>
                        )}
                    </div>
                    {listName && <p className="text-xs opacity-70">In {listName}</p>}
                    {task.webViewLink && (
                        <a
                            href={task.webViewLink}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs text-primary underline underline-offset-4"
                        >
                            Open in Google Tasks
                        </a>
                    )}
                    <div className="flex justify-between gap-2 pt-1">
                        <Button
                            type="button"
                            variant="danger"
                            icon="mark-x"
                            disabled={!writable}
                            onClick={() => {
                                deleteTask(task);
                                onClose();
                            }}
                        >
                            Delete
                        </Button>
                        <Button type="submit" disabled={!writable || !title.trim()}>
                            Save
                        </Button>
                    </div>
                </form>
            )}
        </Dialog>
    );
}
