'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { Card } from '@bradydallama/ui';
import { readJson, writeJson } from '@/lib/storage';
import { useTaskLists, useTasksState } from '@/lib/tasks';
import { Carousel } from './Carousel';
import { ListPanel, NEW_LIST_SLIDE, NewListDialog, NewListSlide } from './ListPanel';
import { ConnectGoogle, DemoBadge, SignOutButton, TaskSkeleton } from './TasksStatus';

const LAST_LIST_KEY = 'cosmic.tasks.lastList';

export function ListsView() {
    const router = useRouter();
    const params = useSearchParams();
    const { authorized } = useTasksState();
    const lists = useTaskLists();
    const [creating, setCreating] = useState(false);
    const [focusKey, setFocusKey] = useState<string | null>(null);

    const onChange = (key: string) => {
        if (key === NEW_LIST_SLIDE) return;
        writeJson(LAST_LIST_KEY, key);
        if (params.get('list') !== key) router.replace(`/tasks?list=${encodeURIComponent(key)}`, { scroll: false });
    };

    return (
        <main className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 pt-8 pb-16">
            <header className="flex flex-col gap-1">
                <Link href="/" className="text-xs text-bubble underline underline-offset-4">
                    ← Today
                </Link>
                <h1 className="flex items-center gap-2 text-xl text-bubble">
                    Lists <DemoBadge />
                </h1>
                <SignOutButton />
            </header>

            {!authorized ? (
                <ConnectGoogle />
            ) : lists.data ? (
                <Carousel
                    label="Task lists"
                    initialKey={params.get('list') ?? readJson<string>(LAST_LIST_KEY) ?? undefined}
                    focusKey={focusKey}
                    onChange={onChange}
                    slides={[
                        ...lists.data.map((list, i) => ({
                            key: list.id,
                            label: list.title,
                            content: <ListPanel list={list} isDefault={i === 0} />,
                        })),
                        {
                            key: NEW_LIST_SLIDE,
                            label: 'New list',
                            plus: true,
                            content: <NewListSlide onNew={() => setCreating(true)} />,
                        },
                    ]}
                />
            ) : lists.status === 'error' ? (
                <Card className="text-sm opacity-80">Couldn't load your lists.</Card>
            ) : (
                <Card>
                    <TaskSkeleton rows={4} />
                </Card>
            )}

            <NewListDialog
                open={creating}
                onClose={() => setCreating(false)}
                onCreated={(list) => setFocusKey(list.id)}
            />
        </main>
    );
}
