import { NextResponse } from 'next/server';
import { DatabaseNotConfigured } from './db';
import { getSession } from './session';

export class HttpError extends Error {
    constructor(
        readonly status: number,
        readonly code: string,
        message?: string,
    ) {
        super(message ?? code);
    }
}

export const invalid = (message: string) => new HttpError(400, 'invalid', message);
export const notFound = () => new HttpError(404, 'not_found');

export async function withUser(request: Request, handler: (email: string) => Promise<unknown>): Promise<Response> {
    const session = await getSession(request);
    if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    try {
        const result = await handler(session.email.toLowerCase());
        return result === undefined ? new Response(null, { status: 204 }) : NextResponse.json(result);
    } catch (err) {
        if (err instanceof HttpError)
            return NextResponse.json({ error: err.code, message: err.message }, { status: err.status });
        if (err instanceof DatabaseNotConfigured) return NextResponse.json({ error: 'no_database' }, { status: 503 });
        console.error('[api]', err);
        const detail = process.env.NODE_ENV === 'development' ? String(err) : undefined;
        return NextResponse.json({ error: 'database', ...(detail ? { detail } : {}) }, { status: 502 });
    }
}

export async function readJson<T>(request: Request): Promise<T> {
    try {
        return (await request.json()) as T;
    } catch {
        throw invalid('Invalid JSON body.');
    }
}

export const isString = (v: unknown, max = 200): v is string => typeof v === 'string' && v.length <= max;
export const isDate = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
export const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

export function optionalText(v: unknown, field: string, max = 500): string | undefined {
    if (v === undefined || v === null) return undefined;
    if (!isString(v, max)) throw invalid(`${field} must be text up to ${max} characters.`);
    return v.trim() || undefined;
}

export function requiredText(v: unknown, field: string, max = 120): string {
    const text = optionalText(v, field, max);
    if (!text) throw invalid(`${field} is required.`);
    return text;
}

export function oneOf<T extends string>(v: unknown, options: readonly T[], field: string): T {
    if (typeof v === 'string' && (options as readonly string[]).includes(v)) return v as T;
    throw invalid(`${field} must be one of ${options.join(', ')}.`);
}

export { newId } from '@/lib/id';
