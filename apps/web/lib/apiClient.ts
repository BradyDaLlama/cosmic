export const usesServer = process.env.NEXT_PUBLIC_TASKS_BACKEND === 'http';

export class ApiError extends Error {
    constructor(
        readonly status: number,
        readonly code: string,
    ) {
        super(code);
        this.name = 'ApiError';
    }
}

export async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
    let res: Response;
    try {
        res = await fetch(path, {
            method: init.method ?? 'GET',
            credentials: 'include',
            headers: init.body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
            body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
        });
    } catch {
        throw new ApiError(0, 'offline');
    }
    if (res.status === 204) return undefined as T;
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new ApiError(res.status, (data as { error?: string }).error ?? 'error');
    return data as T;
}

export function loadErrorMessage(err: unknown, what: string): string {
    if (err instanceof ApiError) {
        if (err.status === 401) return `Connect Google to see your ${what}.`;
        if (err.status === 0) return `You're offline, so your ${what} can't load.`;
        if (err.code === 'no_database') return `The database isn't set up, so your ${what} can't load.`;
    }
    return `Your ${what} couldn't load. Try again shortly.`;
}
