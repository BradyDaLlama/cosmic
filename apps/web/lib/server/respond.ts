import { NextResponse } from 'next/server';
import { TasksError, type TasksErrorCode } from '@/lib/tasks/api';
import { getSession, type Session } from './session';

const statusFor: Record<TasksErrorCode, number> = {
    offline: 503,
    unauthorized: 401,
    not_found: 404,
    rate_limited: 429,
    invalid: 400,
    google: 502,
};

export function errorResponse(err: unknown) {
    const code: TasksErrorCode = err instanceof TasksError ? err.code : 'google';
    if (!(err instanceof TasksError)) console.error('[api]', err);
    return NextResponse.json({ error: code }, { status: statusFor[code] });
}

export async function withSession(
    request: Request,
    handler: (session: Session) => Promise<unknown>,
): Promise<Response> {
    try {
        const session = await getSession(request);
        if (!session) throw new TasksError('unauthorized');
        const result = await handler(session);
        return result === undefined ? new Response(null, { status: 204 }) : NextResponse.json(result);
    } catch (err) {
        return errorResponse(err);
    }
}

export async function body<T>(request: Request): Promise<T> {
    try {
        return (await request.json()) as T;
    } catch {
        throw new TasksError('invalid', 'Invalid JSON body.');
    }
}

export const isDate = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
