'use client';

import Link from 'next/link';
import { useMemo, useState, type KeyboardEvent } from 'react';
import { Card, Input } from '@bradydallama/ui';
import { addDays } from '@/lib/dates';
import { createTask, dueGroups, useDueTasks, useTaskLists, useTasksState, useToday, type Task } from '@/lib/tasks';
import { Carousel, type CarouselSlide } from './Carousel';
import { ListPanel, NEW_LIST_SLIDE, NewListDialog, NewListSlide } from './ListPanel';
import { ListPicker } from './ListPicker';
import { TaskDetails } from './TaskDetails';
import { TaskRow } from './TaskRow';
import { ConnectGoogle, DemoBadge, OfflineNote, TasksNotices, TaskSkeleton } from './TasksStatus';

const UPCOMING_DAYS = 7;
const DUE_SLIDE = 'due';

export function TodayTasks() {
    const today = useToday();
    const { authorized } = useTasksState();
    const lists = useTaskLists();
    const [creating, setCreating] = useState(false);
    const [focusKey, setFocusKey] = useState<string | null>(null);

    const slides: CarouselSlide[] = [
        {
            key: DUE_SLIDE,
            label: 'Due today',
            content: today ? (
                <DueSlide today={today} />
            ) : (
                <SlideFrame title="Due today">
                    <Card>
                        <TaskSkeleton />
                    </Card>
                </SlideFrame>
            ),
        },
        ...(lists.data ?? []).map((list, i) => ({
            key: list.id,
            label: list.title,
            content: <ListPanel list={list} isDefault={i === 0} />,
        })),
    ];
    if (lists.data) {
        slides.push({
            key: NEW_LIST_SLIDE,
            label: 'New list',
            plus: true,
            content: <NewListSlide onNew={() => setCreating(true)} />,
        });
    }

    return (
        <section className="flex flex-col gap-1">
            <div className="flex items-center justify-between gap-2">
                <h2 className="flex items-center gap-2 text-md text-bubble">
                    Tasks <DemoBadge />
                </h2>
                <Link href="/tasks" className="text-xs text-bubble underline underline-offset-4">
                    Lists page
                </Link>
            </div>
            {authorized ? (
                <Carousel label="Tasks" slides={slides} initialKey={DUE_SLIDE} focusKey={focusKey} />
            ) : (
                <ConnectGoogle />
            )}
            <NewListDialog
                open={creating}
                onClose={() => setCreating(false)}
                onCreated={(list) => setFocusKey(list.id)}
            />
        </section>
    );
}

function SlideFrame({ title, meta, children }: { title: string; meta?: string; children: React.ReactNode }) {
    return (
        <div className="flex flex-col gap-2">
            <div className="flex min-h-10 items-baseline gap-2 pt-2">
                <h3 className="truncate text-lg text-bubble">{title}</h3>
                {meta && <span className="shrink-0 text-xs text-bubble opacity-70">{meta}</span>}
            </div>
            {children}
        </div>
    );
}

function DueSlide({ today }: { today: string }) {
    const { online, authorized } = useTasksState();
    const lists = useTaskLists();
    const due = useDueTasks(addDays(today, UPCOMING_DAYS));
    const [draft, setDraft] = useState('');
    const [chosenList, setChosenList] = useState<string>();
    const [openId, setOpenId] = useState<string | null>(null);
    const [showUpcoming, setShowUpcoming] = useState(false);

    const listNames = useMemo(() => new Map(lists.data?.map((l) => [l.id, l.title])), [lists.data]);
    const groups = useMemo(() => dueGroups(due.data ?? [], today, UPCOMING_DAYS), [due.data, today]);
    const listId = chosenList && listNames.has(chosenList) ? chosenList : lists.data?.[0]?.id;
    const writable = online && authorized;
    const openTask = openId ? (due.data?.find((t) => t.id === openId) ?? null) : null;
    const multipleLists = (lists.data?.length ?? 0) > 1;

    const onAddKey = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key !== 'Enter' || !draft.trim() || !listId) return;
        void createTask({ listId, title: draft, due: today });
        setDraft('');
    };

    const row = (task: Task, showDue: boolean) => (
        <TaskRow
            key={task.id}
            task={task}
            today={today}
            showDue={showDue}
            listName={multipleLists ? listNames.get(task.listId) : undefined}
            onOpen={(t) => setOpenId(t.id)}
        />
    );

    const loading = !due.data && due.status !== 'error';
    const empty = !loading && !groups.overdue.length && !groups.today.length;
    const openToday = groups.overdue.length + groups.today.filter((t) => !t.done).length;

    return (
        <SlideFrame title="Due today" meta={due.data ? `${openToday} open` : undefined}>
            <Card className="flex flex-col gap-1">
                <OfflineNote fetchedAt={due.fetchedAt} />
                {loading && <TaskSkeleton />}
                {!due.data && due.status === 'error' && <p className="py-1 text-sm opacity-70">Couldn't load tasks.</p>}

                {groups.overdue.length > 0 && (
                    <>
                        <GroupLabel>Overdue</GroupLabel>
                        <ul className="flex flex-col">{groups.overdue.map((t) => row(t, true))}</ul>
                    </>
                )}
                {(groups.today.length > 0 || groups.overdue.length > 0) && (
                    <>
                        {groups.overdue.length > 0 && <GroupLabel>Today</GroupLabel>}
                        <ul className="flex flex-col">{groups.today.map((t) => row(t, false))}</ul>
                    </>
                )}
                {empty && due.data && <p className="py-1 text-sm opacity-70">Nothing due today.</p>}

                <div className="mt-1 flex items-center gap-2">
                    <Input
                        aria-label="Add a task due today"
                        placeholder={writable ? 'Add a task for today' : 'Offline'}
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        onKeyDown={onAddKey}
                        disabled={!writable || !listId}
                        className="min-w-0 flex-1"
                    />
                    {multipleLists && lists.data && (
                        <ListPicker lists={lists.data} value={listId} onChange={setChosenList} disabled={!writable} />
                    )}
                </div>

                {groups.upcoming.length > 0 && (
                    <>
                        <button
                            type="button"
                            aria-expanded={showUpcoming}
                            onClick={() => setShowUpcoming((v) => !v)}
                            className="mt-2 flex items-center justify-between text-left text-xs opacity-80"
                        >
                            <span>
                                Next {UPCOMING_DAYS} days ({groups.upcoming.length})
                            </span>
                            <span aria-hidden>{showUpcoming ? '−' : '+'}</span>
                        </button>
                        {showUpcoming && <ul className="flex flex-col">{groups.upcoming.map((t) => row(t, true))}</ul>}
                    </>
                )}

                <TasksNotices />
            </Card>
            <TaskDetails
                task={openTask}
                listName={openTask ? listNames.get(openTask.listId) : undefined}
                onClose={() => setOpenId(null)}
            />
        </SlideFrame>
    );
}

function GroupLabel({ children }: { children: React.ReactNode }) {
    return <h4 className="pt-1 text-xs opacity-70">{children}</h4>;
}
