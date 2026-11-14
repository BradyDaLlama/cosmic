import { createHash } from 'node:crypto';
import { TasksError, type TasksErrorCode } from '@/lib/tasks/api';
import type { NewTask, Task, TaskList, TaskPatch } from '@/lib/tasks/model';
import type { Session } from './session';

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const TASKS_URL = 'https://tasks.googleapis.com/tasks/v1';

const TASKS_SCOPE = 'https://www.googleapis.com/auth/tasks';
export const CALENDAR_EVENTS_SCOPE = 'https://www.googleapis.com/auth/calendar.events';
export const CALENDAR_LIST_SCOPE = 'https://www.googleapis.com/auth/calendar.calendarlist.readonly';
const CALENDAR_SCOPES = [CALENDAR_EVENTS_SCOPE, CALENDAR_LIST_SCOPE];

const SCOPES = ['openid', 'email', TASKS_SCOPE, ...CALENDAR_SCOPES];

function credentials() {
    const id = process.env.GOOGLE_CLIENT_ID;
    const secret = process.env.GOOGLE_CLIENT_SECRET;
    if (!id || !secret) {
        throw new Error('GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set (see apps/web/.env.example).');
    }
    return { id, secret };
}

export const redirectUri = (origin: string) => `${origin}/api/auth/google/callback`;

export function authorizationUrl(origin: string, state: string): string {
    const params = new URLSearchParams({
        client_id: credentials().id,
        redirect_uri: redirectUri(origin),
        response_type: 'code',
        scope: SCOPES.join(' '),
        // Offline access returns a refresh token; consent makes Google send it every time.
        access_type: 'offline',
        prompt: 'consent',
        include_granted_scopes: 'true',
        state,
    });
    return `${AUTH_URL}?${params}`;
}

type TokenResponse = {
    access_token: string;
    expires_in: number;
    refresh_token?: string;
    id_token?: string;
    scope?: string;
};

async function tokenRequest(body: Record<string, string>): Promise<TokenResponse> {
    const { id, secret } = credentials();
    const res = await fetch(TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ client_id: id, client_secret: secret, ...body }),
        cache: 'no-store',
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new TasksError(data.error === 'invalid_grant' ? 'unauthorized' : 'google', data.error_description);
    }
    return data as TokenResponse;
}

export async function exchangeCode(
    code: string,
    origin: string,
): Promise<{ email: string; refreshToken: string; scopes: string[] }> {
    const tokens = await tokenRequest({
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri(origin),
    });
    if (!tokens.refresh_token) throw new TasksError('google', 'Google did not return a refresh token.');
    const scopes = (tokens.scope ?? '').split(' ').filter(Boolean);
    if (!scopes.includes(TASKS_SCOPE)) throw new TasksError('unauthorized', 'Tasks access was not granted.');
    // Straight from Google's token endpoint over TLS, so the signature needn't be verified (per Google's docs).
    const payload = tokens.id_token?.split('.')[1];
    const claims = payload ? JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) : {};
    if (!claims.email || claims.email_verified === false) throw new TasksError('google', 'No verified email.');
    cacheAccessToken(tokens.refresh_token, tokens);
    return { email: claims.email as string, refreshToken: tokens.refresh_token, scopes };
}

const accessTokens = new Map<string, { token: string; expiresAt: number }>();
const cacheKey = (refreshToken: string) => createHash('sha256').update(refreshToken).digest('hex');

function cacheAccessToken(refreshToken: string, tokens: TokenResponse) {
    accessTokens.set(cacheKey(refreshToken), {
        token: tokens.access_token,
        expiresAt: Date.now() + (tokens.expires_in - 60) * 1000,
    });
}

async function accessToken(session: Session): Promise<string> {
    const cached = accessTokens.get(cacheKey(session.refreshToken));
    if (cached && cached.expiresAt > Date.now()) return cached.token;
    const tokens = await tokenRequest({ refresh_token: session.refreshToken, grant_type: 'refresh_token' });
    cacheAccessToken(session.refreshToken, tokens);
    return tokens.access_token;
}

export async function revoke(session: Session) {
    accessTokens.delete(cacheKey(session.refreshToken));
    await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(session.refreshToken)}`, {
        method: 'POST',
    }).catch(() => undefined);
}

type GTaskList = { id: string; title: string; updated: string };
type GTask = {
    id: string;
    title?: string;
    notes?: string;
    status: 'needsAction' | 'completed';
    due?: string;
    completed?: string;
    updated: string;
    parent?: string;
    position: string;
    deleted?: boolean;
    hidden?: boolean;
    webViewLink?: string;
};
type Page<T> = { items?: T[]; nextPageToken?: string };

function errorCode(status: number, reason?: string): TasksErrorCode {
    if (status === 401) return 'unauthorized';
    if (status === 404) return 'not_found';
    if (status === 429 || reason === 'rateLimitExceeded' || reason === 'userRateLimitExceeded') return 'rate_limited';
    if (status === 403 && reason === 'insufficientPermissions') return 'unauthorized';
    return 'google';
}

export async function googleFetch<T>(session: Session, url: string, init: RequestInit = {}): Promise<T> {
    const token = await accessToken(session);
    const res = await fetch(url, {
        ...init,
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...init.headers },
        cache: 'no-store',
    });
    if (res.status === 204) return undefined as T;
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        if (res.status === 401) accessTokens.delete(cacheKey(session.refreshToken));
        const reason = data.error?.errors?.[0]?.reason as string | undefined;
        throw new TasksError(errorCode(res.status, reason), data.error?.message);
    }
    return data as T;
}

const call = <T>(session: Session, path: string, init: RequestInit = {}) =>
    googleFetch<T>(session, `${TASKS_URL}${path}`, init);

async function all<T>(session: Session, path: string): Promise<T[]> {
    const items: T[] = [];
    let pageToken: string | undefined;
    do {
        const sep = path.includes('?') ? '&' : '?';
        const page = await call<Page<T>>(
            session,
            `${path}${sep}maxResults=100${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`,
        );
        items.push(...(page.items ?? []));
        pageToken = page.nextPageToken;
    } while (pageToken);
    return items;
}

const q = encodeURIComponent;
const toDue = (date: string) => `${date}T00:00:00.000Z`;

const toList = (l: GTaskList): TaskList => ({ id: l.id, title: l.title, updatedAt: l.updated });

const toTask = (t: GTask, listId: string): Task => ({
    id: t.id,
    listId,
    title: t.title ?? '',
    notes: t.notes || undefined,
    done: t.status === 'completed',
    completedAt: t.completed,
    // Google keeps only the date; never shift it through a time zone.
    due: t.due?.slice(0, 10),
    parentId: t.parent,
    position: t.position,
    updatedAt: t.updated,
    webViewLink: t.webViewLink,
});

export const googleTasks = {
    async lists(session: Session): Promise<TaskList[]> {
        return (await all<GTaskList>(session, '/users/@me/lists')).map(toList);
    },

    async createList(session: Session, title: string): Promise<TaskList> {
        return toList(await call(session, '/users/@me/lists', { method: 'POST', body: JSON.stringify({ title }) }));
    },

    async renameList(session: Session, id: string, title: string): Promise<TaskList> {
        return toList(
            await call(session, `/users/@me/lists/${q(id)}`, { method: 'PATCH', body: JSON.stringify({ title }) }),
        );
    },

    async deleteList(session: Session, id: string): Promise<void> {
        await call(session, `/users/@me/lists/${q(id)}`, { method: 'DELETE' });
    },

    async tasks(session: Session, listId: string): Promise<Task[]> {
        const items = await all<GTask>(session, `/lists/${q(listId)}/tasks?showCompleted=true&showHidden=true`);
        return items.filter((t) => !t.deleted && t.title?.trim()).map((t) => toTask(t, listId));
    },

    async due(session: Session, until: string): Promise<Task[]> {
        const lists = await googleTasks.lists(session);
        const dueMax = `${until}T23:59:59.999Z`;
        const recent = new Date(`${until}T00:00:00Z`);
        recent.setUTCDate(recent.getUTCDate() - 10);
        const recentDate = recent.toISOString().slice(0, 10);
        const perList = await Promise.all(
            lists.map(async (list) => {
                const items = await all<GTask>(
                    session,
                    `/lists/${q(list.id)}/tasks?showCompleted=true&showHidden=true&dueMax=${q(dueMax)}`,
                );
                return items
                    .filter((t) => !t.deleted && t.due && t.title?.trim())
                    .map((t) => toTask(t, list.id))
                    .filter((t) => t.due! <= until && (!t.done || t.due! >= recentDate));
            }),
        );
        return perList.flat();
    },

    async create(session: Session, input: NewTask): Promise<Task> {
        const params = new URLSearchParams();
        if (input.parentId) params.set('parent', input.parentId);
        if (input.previousId) params.set('previous', input.previousId);
        const query = params.size ? `?${params}` : '';
        const body: Partial<GTask> = { title: input.title.trim() };
        if (input.notes?.trim()) body.notes = input.notes.trim();
        if (input.due) body.due = toDue(input.due);
        const task = await call<GTask>(session, `/lists/${q(input.listId)}/tasks${query}`, {
            method: 'POST',
            body: JSON.stringify(body),
        });
        return toTask(task, input.listId);
    },

    async update(session: Session, listId: string, id: string, patch: TaskPatch): Promise<Task> {
        const body: Record<string, unknown> = {};
        if (patch.title !== undefined) body.title = patch.title.trim();
        if (patch.notes !== undefined) body.notes = patch.notes?.trim() || null;
        if (patch.due !== undefined) body.due = patch.due ? toDue(patch.due) : null;
        if (patch.done !== undefined) {
            body.status = patch.done ? 'completed' : 'needsAction';
            if (!patch.done) body.completed = null;
        }
        const task = await call<GTask>(session, `/lists/${q(listId)}/tasks/${q(id)}`, {
            method: 'PATCH',
            body: JSON.stringify(body),
        });
        return toTask(task, listId);
    },

    async remove(session: Session, listId: string, id: string): Promise<void> {
        await call(session, `/lists/${q(listId)}/tasks/${q(id)}`, { method: 'DELETE' });
    },

    /** The API's `clear` only hides tasks, and hidden tasks are still fetched, so delete them instead. */
    async deleteCompleted(session: Session, listId: string): Promise<void> {
        const done = (await googleTasks.tasks(session, listId)).filter((t) => t.done);
        for (let i = 0; i < done.length; i += 5) {
            await Promise.all(done.slice(i, i + 5).map((t) => googleTasks.remove(session, listId, t.id)));
        }
    },
};
