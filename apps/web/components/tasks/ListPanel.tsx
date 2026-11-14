'use client';

import { useEffect, useMemo, useState, type KeyboardEvent } from 'react';
import { Button, Card, Dialog, IconButton, Input } from '@bradydallama/ui';
import {
    arrangeList,
    clearCompleted,
    createList,
    createTask,
    deleteList,
    lastOpenRoot,
    renameList,
    useListTasks,
    useTasksState,
    useToday,
    type Task,
    type TaskList,
} from '@/lib/tasks';
import { TaskDetails } from './TaskDetails';
import { TaskRow } from './TaskRow';
import { OfflineNote, TasksNotices, TaskSkeleton } from './TasksStatus';

export function ListPanel({ list, isDefault }: { list: TaskList; isDefault: boolean }) {
    const today = useToday();
    const { online, authorized } = useTasksState();
    const tasks = useListTasks(list.id);
    const [draft, setDraft] = useState('');
    const [openId, setOpenId] = useState<string | null>(null);
    const [showCompleted, setShowCompleted] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);

    const arranged = useMemo(() => arrangeList(tasks.data ?? []), [tasks.data]);
    const openCount = arranged.open.reduce((n, node) => n + 1 + node.children.length, 0);
    const writable = online && authorized;
    const openTask = openId ? (tasks.data?.find((t) => t.id === openId) ?? null) : null;

    const onAddKey = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key !== 'Enter' || !draft.trim()) return;
        void createTask({ listId: list.id, title: draft, previousId: lastOpenRoot(tasks.data ?? [])?.id });
        setDraft('');
    };

    const row = (task: Task, indent = false) =>
        today && <TaskRow key={task.id} task={task} today={today} indent={indent} onOpen={(t) => setOpenId(t.id)} />;

    return (
        <section aria-label={list.title} className="flex flex-col gap-2">
            <div className="flex min-h-10 items-center justify-between gap-2">
                <div className="flex min-w-0 items-baseline gap-2">
                    <h3 className="truncate text-lg text-bubble">{list.title}</h3>
                    {tasks.data && <span className="shrink-0 text-xs text-bubble opacity-70">{openCount} open</span>}
                </div>
                <IconButton
                    icon="gear-1"
                    label={`${list.title} list options`}
                    variant="ghost"
                    size="sm"
                    onClick={() => setMenuOpen(true)}
                />
            </div>

            <Card className="flex flex-col gap-1">
                <OfflineNote fetchedAt={tasks.fetchedAt} />
                {(!tasks.data || !today) && tasks.status !== 'error' && <TaskSkeleton rows={4} />}
                {!tasks.data && tasks.status === 'error' && (
                    <p className="py-1 text-sm opacity-70">Couldn't load this list.</p>
                )}
                {tasks.data && today && (
                    <>
                        {arranged.open.length === 0 && (
                            <p className="py-1 text-sm opacity-70">No tasks in this list.</p>
                        )}
                        <ul className="flex flex-col">
                            {arranged.open.flatMap((node) => [
                                row(node.task),
                                ...node.children.map((c) => row(c, true)),
                            ])}
                        </ul>
                    </>
                )}

                <Input
                    aria-label={`Add a task to ${list.title}`}
                    placeholder={writable ? 'Add a task' : 'Offline'}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={onAddKey}
                    disabled={!writable || !tasks.data}
                    className="mt-1"
                />

                {arranged.completed.length > 0 && (
                    <>
                        <button
                            type="button"
                            aria-expanded={showCompleted}
                            onClick={() => setShowCompleted((v) => !v)}
                            className="mt-2 flex items-center justify-between text-left text-xs opacity-80"
                        >
                            <span>Completed ({arranged.completed.length})</span>
                            <span aria-hidden>{showCompleted ? '−' : '+'}</span>
                        </button>
                        {showCompleted && <ul className="flex flex-col">{arranged.completed.map((t) => row(t))}</ul>}
                    </>
                )}

                <TasksNotices />
            </Card>

            <TaskDetails task={openTask} onClose={() => setOpenId(null)} />
            <ListMenu
                open={menuOpen}
                onClose={() => setMenuOpen(false)}
                list={list}
                isDefault={isDefault}
                taskCount={tasks.data?.length ?? 0}
                completedCount={arranged.completed.length}
            />
        </section>
    );
}

type ListMenuProps = {
    open: boolean;
    onClose: () => void;
    list: TaskList;
    isDefault: boolean;
    taskCount: number;
    completedCount: number;
};

function ListMenu({ open, onClose, list, isDefault, taskCount, completedCount }: ListMenuProps) {
    const { online, authorized } = useTasksState();
    const writable = online && authorized;
    const [title, setTitle] = useState(list.title);
    const [confirmDelete, setConfirmDelete] = useState(false);

    useEffect(() => {
        if (!open) return;
        setTitle(list.title);
        setConfirmDelete(false);
    }, [open, list.title]);

    return (
        <Dialog open={open} onClose={onClose} variant="sheet" title="List options">
            <form
                className="flex items-end gap-2"
                onSubmit={(e) => {
                    e.preventDefault();
                    void renameList(list, title);
                    onClose();
                }}
            >
                <Input
                    label="Name"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    disabled={!writable}
                    className="flex-1"
                />
                <Button type="submit" disabled={!writable || !title.trim() || title.trim() === list.title}>
                    Rename
                </Button>
            </form>

            <div className="flex flex-col gap-2 pt-2">
                <Button
                    variant="secondary"
                    disabled={!writable || completedCount === 0}
                    onClick={() => {
                        void clearCompleted(list.id);
                        onClose();
                    }}
                >
                    Delete completed ({completedCount})
                </Button>

                {isDefault ? (
                    <p className="text-xs opacity-70">This is your default list, so it can't be deleted.</p>
                ) : confirmDelete ? (
                    <div className="flex flex-col gap-2">
                        <p className="text-sm">
                            Delete “{list.title}” and its {taskCount} {taskCount === 1 ? 'task' : 'tasks'} from Google?
                            This can't be undone.
                        </p>
                        <div className="flex gap-2">
                            <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
                                Cancel
                            </Button>
                            <Button
                                variant="danger"
                                disabled={!writable}
                                onClick={() => {
                                    void deleteList(list);
                                    onClose();
                                }}
                            >
                                Delete list
                            </Button>
                        </div>
                    </div>
                ) : (
                    <Button variant="danger" disabled={!writable} onClick={() => setConfirmDelete(true)}>
                        Delete list…
                    </Button>
                )}
            </div>
        </Dialog>
    );
}

export function NewListDialog({
    open,
    onClose,
    onCreated,
}: {
    open: boolean;
    onClose: () => void;
    onCreated: (list: TaskList) => void;
}) {
    const [title, setTitle] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (open) setTitle('');
    }, [open]);

    return (
        <Dialog open={open} onClose={onClose} variant="sheet" title="New list">
            <form
                className="flex flex-col gap-3"
                onSubmit={async (e) => {
                    e.preventDefault();
                    setSaving(true);
                    const list = await createList(title);
                    setSaving(false);
                    if (list) {
                        onCreated(list);
                        onClose();
                    }
                }}
            >
                <Input label="Name" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
                <TasksNotices />
                <Button type="submit" disabled={!title.trim() || saving}>
                    {saving ? 'Creating…' : 'Create list'}
                </Button>
            </form>
        </Dialog>
    );
}

export const NEW_LIST_SLIDE = 'new-list';

export function NewListSlide({ onNew }: { onNew: () => void }) {
    const { online, authorized } = useTasksState();
    return (
        <div className="pt-11">
            <Card className="flex min-h-48 flex-col items-center justify-center gap-3 text-center">
                <p className="text-sm opacity-80">Start another list.</p>
                <Button icon="star-4" onClick={onNew} disabled={!online || !authorized}>
                    New list
                </Button>
            </Card>
        </div>
    );
}
