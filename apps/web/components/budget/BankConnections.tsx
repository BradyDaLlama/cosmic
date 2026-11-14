'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePlaidLink } from 'react-plaid-link';
import { Button, Card, Pill } from '@bradydallama/ui';
import { api, ApiError } from '@/lib/apiClient';
import { notifyBudgetChanged } from '@/lib/budget/client';
import type { BankItem, BudgetAccount, SyncResult } from '@/lib/budget/model';

const LINK_KEY = 'cosmic.budget.link';
type PendingLink = { token: string; itemId?: string };

function readPending(): PendingLink | null {
    try {
        return JSON.parse(sessionStorage.getItem(LINK_KEY) ?? 'null') as PendingLink | null;
    } catch {
        return null;
    }
}
function writePending(link: PendingLink | null) {
    try {
        if (link) sessionStorage.setItem(LINK_KEY, JSON.stringify(link));
        else sessionStorage.removeItem(LINK_KEY);
    } catch {}
}

function message(err: unknown): string {
    if (err instanceof ApiError) {
        if (err.status === 401) return 'Sign in with Google first.';
        if (err.status === 0) return 'You are offline.';
        if (err.code === 'no_database') return 'The database is not set up (MONGODB_URI).';
        if (err.code === 'no_plaid') return 'Plaid is not set up. Add the PLAID_ keys to .env.local.';
    }
    return err instanceof Error ? `Something went wrong: ${err.message}` : 'Something went wrong.';
}

const formatAmount = (n: number | undefined, currency = 'USD') =>
    n === undefined ? '' : new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(n);

export function BankConnections() {
    const [items, setItems] = useState<BankItem[]>([]);
    const [accounts, setAccounts] = useState<BudgetAccount[]>([]);
    const [busy, setBusy] = useState<string | null>(null);
    const [status, setStatus] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [link, setLink] = useState<PendingLink | null>(null);
    const [redirectUri, setRedirectUri] = useState<string | undefined>();
    const openWhenReady = useRef(false);

    const load = useCallback(async () => {
        try {
            const a = await api<{ items: BankItem[]; accounts: BudgetAccount[] }>('/api/budget/accounts');
            setItems(a.items);
            setAccounts(a.accounts);
            setError(null);
        } catch (err) {
            setError(message(err));
        }
    }, []);

    useEffect(() => {
        load();
        if (new URLSearchParams(window.location.search).has('oauth_state_id')) {
            const pending = readPending();
            if (pending) {
                setRedirectUri(window.location.href);
                setLink(pending);
                openWhenReady.current = true;
            }
        }
    }, [load]);

    const describe = (r: SyncResult) =>
        r.items
            .map((i) =>
                i.error
                    ? `${i.institution}: ${i.error}`
                    : `${i.institution}: ${i.added} new, ${i.modified} changed, ${i.removed} removed` +
                      (i.updateStatus && i.updateStatus !== 'HISTORICAL_UPDATE_COMPLETE' ? ` (${i.updateStatus})` : ''),
            )
            .join('. ') || 'No banks linked yet.';

    const run = async (label: string, work: () => Promise<string | void>) => {
        setBusy(label);
        setError(null);
        try {
            const done = await work();
            if (done) setStatus(done);
            await load();
            notifyBudgetChanged();
        } catch (err) {
            setError(message(err));
        } finally {
            setBusy(null);
        }
    };

    const finishLink = () => {
        writePending(null);
        setLink(null);
        setRedirectUri(undefined);
        if (redirectUri) window.history.replaceState(null, '', window.location.pathname);
    };

    const { open, ready } = usePlaidLink({
        token: link?.token ?? null,
        receivedRedirectUri: redirectUri,
        onSuccess: (publicToken) => {
            const itemId = link?.itemId;
            finishLink();
            run('link', async () => {
                if (itemId) {
                    return describe(await api<SyncResult>('/api/budget/sync', { method: 'POST', body: { itemId } }));
                }
                const res = await api<{ item: BankItem; sync?: SyncResult['items'][number] }>(
                    '/api/budget/plaid/exchange',
                    { method: 'POST', body: { publicToken } },
                );
                return res.sync ? describe({ items: [res.sync] }) : `Linked ${res.item.institution}.`;
            });
        },
        onExit: (err) => {
            finishLink();
            if (err) setError(`Link closed: ${err.error_code}`);
        },
    });

    useEffect(() => {
        if (ready && openWhenReady.current) {
            openWhenReady.current = false;
            open();
        }
    }, [ready, open]);

    const startLink = (itemId?: string) =>
        run('link', async () => {
            const { linkToken } = await api<{ linkToken: string }>('/api/budget/plaid/link-token', {
                method: 'POST',
                body: itemId ? { itemId } : {},
            });
            const pending = { token: linkToken, itemId };
            writePending(pending);
            openWhenReady.current = true;
            setLink(pending);
        });

    const remove = (item: BankItem) => {
        if (!window.confirm(`Remove ${item.institution}? Its transactions stay.`)) return;
        run('remove', async () => {
            await api(`/api/budget/items/${item.id}`, { method: 'DELETE' });
            return `Removed ${item.institution}.`;
        });
    };

    return (
        <section className="flex flex-col gap-2">
            <h2 className="text-md text-bubble">Banks</h2>
            <div className="flex flex-wrap gap-2">
                <Button type="button" onClick={() => startLink()} disabled={!!busy}>
                    {busy === 'link' ? 'Opening...' : 'Connect bank'}
                </Button>
                <Button
                    type="button"
                    variant="ghost"
                    disabled={!!busy}
                    onClick={() =>
                        run('sync', async () =>
                            describe(await api<SyncResult>('/api/budget/sync', { method: 'POST', body: {} })),
                        )
                    }
                >
                    {busy === 'sync' ? 'Syncing...' : 'Sync now'}
                </Button>
            </div>

            {status && <p className="text-sm">{status}</p>}
            {error && (
                <p role="alert" className="text-sm text-bubble">
                    {error}
                </p>
            )}

            <div className="flex flex-col gap-2">
                {items.length === 0 && (
                    <p className="text-sm">No banks linked. In Sandbox, use user_good and pass_good.</p>
                )}
                {items.map((item) => (
                    <Card key={item.id} className="flex flex-col gap-2">
                        <div className="flex items-center justify-between gap-2">
                            <span>{item.institution}</span>
                            {item.status === 'needs_reconnect' && <Pill tone="outline">needs reconnecting</Pill>}
                        </div>
                        <span className="text-xs">
                            {item.lastSyncedAt
                                ? `Synced ${new Date(item.lastSyncedAt).toLocaleString()}`
                                : 'Not synced yet'}
                            {item.errorCode ? `, ${item.errorCode}` : ''}
                        </span>
                        <ul className="flex flex-col gap-1 text-sm">
                            {accounts
                                .filter((a) => a.itemId === item.id)
                                .map((a) => (
                                    <li key={a.id} className="flex justify-between gap-2">
                                        <span>
                                            {a.name} {a.mask && <span className="text-xs">{a.mask}</span>}
                                        </span>
                                        <span>{formatAmount(a.balance, a.currency)}</span>
                                    </li>
                                ))}
                        </ul>
                        <div className="flex gap-2">
                            <Button type="button" variant="ghost" disabled={!!busy} onClick={() => startLink(item.id)}>
                                Reconnect
                            </Button>
                            <Button type="button" variant="ghost" disabled={!!busy} onClick={() => remove(item)}>
                                Remove
                            </Button>
                        </div>
                    </Card>
                ))}
            </div>
        </section>
    );
}
