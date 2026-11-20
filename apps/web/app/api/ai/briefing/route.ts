import { NextResponse } from 'next/server';
import { parseFacts, streamBriefing } from '@/lib/server/ai/briefing';
import { aiConfigured, AiUnavailable } from '@/lib/server/ai/llm';
import { getSession } from '@/lib/server/session';
import { HttpError, readJson } from '@/lib/server/userRoute';

export const maxDuration = 60;

const failed = (err: unknown) => {
    console.error('[ai] briefing failed:', err instanceof AiUnavailable ? err.message : err);
    return NextResponse.json({ error: 'ai_failed' }, { status: 502 });
};

/** Streams the briefing as plain text. Errors before the first words come back as JSON with a status code. */
export async function POST(request: Request) {
    const session = await getSession(request);
    if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    if (!aiConfigured()) return NextResponse.json({ error: 'ai_disabled' }, { status: 503 });

    let pieces: AsyncGenerator<string>;
    let first: IteratorResult<string>;
    try {
        pieces = streamBriefing(parseFacts(await readJson(request)));
        first = await pieces.next();
    } catch (err) {
        if (err instanceof HttpError) {
            return NextResponse.json({ error: err.code, message: err.message }, { status: err.status });
        }
        return failed(err);
    }
    if (first.done) return failed(new AiUnavailable('The model returned no text.'));

    const encoder = new TextEncoder();
    const body = new ReadableStream<Uint8Array>({
        start(controller) {
            controller.enqueue(encoder.encode(first.value));
        },
        async pull(controller) {
            try {
                const next = await pieces.next();
                if (next.done) controller.close();
                else controller.enqueue(encoder.encode(next.value));
            } catch (err) {
                console.error('[ai] briefing stream broke:', err instanceof AiUnavailable ? err.message : err);
                controller.error(err);
            }
        },
        async cancel() {
            await pieces.return(undefined);
        },
    });
    return new Response(body, {
        headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
    });
}
