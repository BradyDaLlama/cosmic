'use client';

import { useEffect, useState } from 'react';
import { Button, Card, Pill } from '@bradydallama/ui';
import { formatClock } from '@/lib/dates';
import { connectGoogle } from '@/lib/native';
import { removeJson } from '@/lib/storage';
import { dismissNotice, errorMessages, SNAPSHOT_KEY, tasksBackend, undoDelete, useTasksState } from '@/lib/tasks';

export function OfflineNote({ fetchedAt }: { fetchedAt?: number }) {
    const { online } = useTasksState();
    if (online) return null;
    return (
        <p role="status" className="text-xs opacity-70">
            Offline, read-only{fetchedAt ? ` (updated ${formatClock(fetchedAt)})` : ''}
        </p>
    );
}

export function TasksNotices() {
    const { undoable, notice } = useTasksState();

    useEffect(() => {
        if (!notice || notice.retry) return;
        const timer = setTimeout(dismissNotice, 6000);
        return () => clearTimeout(timer);
    }, [notice]);

    return (
        <>
            {undoable && (
                <p role="status" className="flex items-center justify-between gap-2 pt-1 text-xs">
                    <span className="truncate opacity-70">Deleted “{undoable.title}”</span>
                    <button
                        type="button"
                        className="font-bold underline underline-offset-4"
                        onClick={() => undoDelete(undoable.id)}
                    >
                        Undo
                    </button>
                </p>
            )}
            {notice && (
                <p role="alert" className="flex items-center justify-between gap-2 pt-1 text-xs">
                    <span className="opacity-80">{notice.message}</span>
                    <span className="flex shrink-0 gap-3">
                        {notice.retry && notice.code !== 'offline' && notice.code !== 'unauthorized' && (
                            <button
                                type="button"
                                className="font-bold underline underline-offset-4"
                                onClick={() => {
                                    const retry = notice.retry;
                                    dismissNotice();
                                    retry?.();
                                }}
                            >
                                Retry
                            </button>
                        )}
                        <button
                            type="button"
                            className="underline underline-offset-4 opacity-70"
                            onClick={dismissNotice}
                        >
                            Dismiss
                        </button>
                    </span>
                </p>
            )}
        </>
    );
}

const signInMessages: Record<string, string> = {
    cancelled: 'Sign-in was cancelled.',
    failed: "Sign-in didn't work. Try again.",
    not_allowed: "That Google account isn't allowed. Add it to ALLOWED_EMAILS.",
};

export function ConnectGoogle() {
    const [result, setResult] = useState<string | null>(null);
    useEffect(() => {
        const auth = new URLSearchParams(window.location.search).get('auth');
        if (auth && signInMessages[auth]) setResult(signInMessages[auth]);
    }, []);

    return (
        <Card className="flex flex-col items-start gap-3">
            <p className="text-sm">{errorMessages.unauthorized}</p>
            {result && (
                <p role="alert" className="text-xs opacity-80">
                    {result}
                </p>
            )}
            <Button icon="link" onClick={connectGoogle}>
                Connect Google
            </Button>
        </Card>
    );
}

export function SignOutButton() {
    const { authorized } = useTasksState();
    const [busy, setBusy] = useState(false);
    if (tasksBackend !== 'google' || !authorized) return null;
    return (
        <button
            type="button"
            disabled={busy}
            className="self-start text-xs text-bubble underline underline-offset-4 disabled:opacity-50"
            onClick={async () => {
                setBusy(true);
                await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }).catch(() => undefined);
                removeJson(SNAPSHOT_KEY);
                window.location.href = '/';
            }}
        >
            Sign out of Google
        </button>
    );
}

export function DemoBadge() {
    if (tasksBackend !== 'demo') return null;
    return (
        <Pill
            tone="outline"
            className="text-xs"
            title="Tasks are stored in this browser until Google sign-in is set up"
        >
            demo data
        </Pill>
    );
}

export function TaskSkeleton({ rows = 3 }: { rows?: number }) {
    return (
        <ul aria-hidden className="flex flex-col gap-2 py-1">
            {Array.from({ length: rows }, (_, i) => (
                <li key={i} className="flex h-8 items-center gap-2">
                    <span className="size-5 rounded-full bg-current opacity-15" />
                    <span
                        className="h-3 flex-1 rounded-full bg-current opacity-15"
                        style={{ maxWidth: `${70 - i * 12}%` }}
                    />
                </li>
            ))}
        </ul>
    );
}
