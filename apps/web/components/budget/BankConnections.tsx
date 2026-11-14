'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button, Card, Pill } from '@bradydallama/ui';
import { api, ApiError } from '@/lib/apiClient';
import { formatAsOf, notifyBudgetChanged, syncIfStale } from '@/lib/budget/client';
import type { BankConnection, BudgetAccount, SyncResult } from '@/lib/budget/model';
import { connectGoogle } from '@/lib/native';

function message(err: unknown): string {
    if (err instanceof ApiError) {
        if (err.status === 401) return 'Sign in with Google first.';
        if (err.status === 0) return 'You are offline.';
        if (err.code === 'no_database') return 'The database is not set up (MONGODB_URI).';
        if (err.detail) return err.detail;
    }
    return err instanceof Error ? `Something went wrong: ${err.message}` : 'Something went wrong.';
}

function describe(r: SyncResult): string {
    const checked = r.connections.filter((c) => !c.skipped);
    if (!checked.length) return 'Checked moments ago.';
    const added = checked.reduce((n, c) => n + c.added, 0);
    const errors = checked.flatMap((c) => c.errors);
    return [`${added} new ${added === 1 ? 'purchase' : 'purchases'}.`, ...errors].join(' ');
}

export function BankConnections() {
    const [connections, setConnections] = useState<BankConnection[] | null>(null);
    const [accounts, setAccounts] = useState<BudgetAccount[]>([]);
    const [needsGmail, setNeedsGmail] = useState(false);
    const [busy, setBusy] = useState<'connect' | 'sync' | 'remove' | null>(null);
    const [status, setStatus] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        try {
            const a = await api<{ connections: BankConnection[]; accounts: BudgetAccount[] }>('/api/budget/accounts');
            setConnections(a.connections);
            setAccounts(a.accounts);
        } catch (err) {
            setError(message(err));
        }
    }, []);

    useEffect(() => {
        void load();
        void syncIfStale().then(load);
    }, [load]);

    const run = async (label: NonNullable<typeof busy>, work: () => Promise<string>) => {
        setBusy(label);
        setError(null);
        setStatus(null);
        try {
            setStatus(await work());
            await load();
            notifyBudgetChanged();
        } catch (err) {
            if (err instanceof ApiError && err.code === 'needs_gmail') setNeedsGmail(true);
            else setError(message(err));
        } finally {
            setBusy(null);
        }
    };

    const connect = () =>
        run('connect', async () => {
            const res = await api<{ sync: SyncResult['connections'][number] }>('/api/budget/connections', {
                method: 'POST',
            });
            return `Reading Chase alerts. ${describe({ connections: [res.sync] })}`;
        });

    const sync = () =>
        run('sync', async () => describe(await api<SyncResult>('/api/budget/sync', { method: 'POST', body: {} })));

    const remove = (connection: BankConnection) => {
        if (!window.confirm('Stop reading Chase alerts? Your purchases stay.')) return;
        void run('remove', async () => {
            await api(`/api/budget/connections/${connection.id}`, { method: 'DELETE' });
            return 'Stopped reading Chase alerts.';
        });
    };

    const gmailMissing = needsGmail || connections?.some((c) => c.errors.some((e) => e.includes('Gmail access')));

    return (
        <section className="flex flex-col gap-2">
            <h2 className="text-md text-bubble">Banks</h2>

            {connections?.length === 0 && (
                <Card className="flex flex-col items-start gap-3">
                    <p className="text-sm">
                        Cosmic reads Chase&apos;s purchase alert emails from your Gmail. Turn on an alert for every
                        purchase in the Chase app, then start here.
                    </p>
                    <Button type="button" onClick={() => void connect()} disabled={!!busy}>
                        {busy === 'connect' ? 'Starting...' : 'Read Chase alerts'}
                    </Button>
                </Card>
            )}

            {gmailMissing && (
                <Card className="flex flex-col items-start gap-3">
                    <p className="text-sm">
                        Sign in with Google again and allow Gmail access. Cosmic only reads emails from Chase.
                    </p>
                    <Button type="button" icon="link" onClick={connectGoogle}>
                        Allow Gmail access
                    </Button>
                </Card>
            )}

            {connections?.map((c) => (
                <Card key={c.id} className="flex flex-col gap-2">
                    <div className="flex items-center justify-between gap-2">
                        <span>Chase alerts</span>
                        {c.status === 'error' && <Pill tone="outline">needs attention</Pill>}
                    </div>
                    <span className="text-xs opacity-70">
                        {c.lastSyncedAt ? `Checked ${formatAsOf(c.lastSyncedAt)}` : 'Not checked yet'}
                    </span>
                    {c.errors.map((e) => (
                        <p key={e} className="text-xs">
                            {e}
                        </p>
                    ))}
                    {accounts.some((a) => a.connectionId === c.id) && (
                        <ul className="flex flex-col gap-1 text-sm">
                            {accounts
                                .filter((a) => a.connectionId === c.id)
                                .map((a) => (
                                    <li key={a.id}>{a.name}</li>
                                ))}
                        </ul>
                    )}
                    <div className="flex flex-wrap gap-2">
                        <Button type="button" variant="ghost" disabled={!!busy} onClick={() => void sync()}>
                            {busy === 'sync' ? 'Checking...' : 'Check now'}
                        </Button>
                        <Button type="button" variant="ghost" disabled={!!busy} onClick={() => remove(c)}>
                            Stop
                        </Button>
                    </div>
                </Card>
            ))}

            {status && <p className="text-sm">{status}</p>}
            {error && (
                <p role="alert" className="text-sm text-bubble">
                    {error}
                </p>
            )}
        </section>
    );
}
