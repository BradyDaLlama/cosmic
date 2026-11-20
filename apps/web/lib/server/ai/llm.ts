import { readText } from '@/lib/streams';

export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

export class AiUnavailable extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'AiUnavailable';
    }
}

type Config = { baseUrl: string; apiKey?: string; model: string; timeoutMs: number; reasoningEffort?: string };

function config(): Config | null {
    const baseUrl = process.env.AI_BASE_URL?.trim().replace(/\/+$/, '');
    const model = process.env.AI_MODEL?.trim();
    if (!baseUrl || !model) return null;
    const timeoutMs = Number(process.env.AI_TIMEOUT_MS) || 60_000;
    // With thinking on, small models can spend the whole token budget before answering.
    const effort = process.env.AI_REASONING_EFFORT?.trim() || 'none';
    return {
        baseUrl,
        model,
        apiKey: process.env.AI_API_KEY?.trim() || undefined,
        timeoutMs,
        reasoningEffort: effort === 'default' ? undefined : effort,
    };
}

export const aiConfigured = () => config() !== null;

type StreamChunk = { choices?: { delta?: { content?: string | null } }[] };

/** Throws `AiUnavailable` before yielding anything if the model can't answer. */
export async function* streamChat(
    messages: ChatMessage[],
    { maxTokens = 256, temperature = 0.7 }: { maxTokens?: number; temperature?: number } = {},
): AsyncGenerator<string> {
    const cfg = config();
    if (!cfg) throw new AiUnavailable('AI_BASE_URL and AI_MODEL are not set.');

    let res: Response;
    try {
        res = await fetch(`${cfg.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(cfg.apiKey ? { Authorization: `Bearer ${cfg.apiKey}` } : {}),
            },
            body: JSON.stringify({
                model: cfg.model,
                messages,
                max_tokens: maxTokens,
                temperature,
                stream: true,
                ...(cfg.reasoningEffort ? { reasoning_effort: cfg.reasoningEffort } : {}),
            }),
            signal: AbortSignal.timeout(cfg.timeoutMs),
            cache: 'no-store',
        });
    } catch (err) {
        const timedOut = err instanceof Error && err.name === 'TimeoutError';
        throw new AiUnavailable(timedOut ? `The model took longer than ${cfg.timeoutMs} ms.` : String(err));
    }
    if (!res.ok || !res.body) {
        const detail = await res.text().catch(() => '');
        throw new AiUnavailable(`The model server answered ${res.status}. ${detail.slice(0, 200)}`.trim());
    }

    let buffer = '';
    for await (const piece of readText(res.body)) {
        buffer += piece;
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
            if (!line.startsWith('data:')) continue;
            const data = line.slice(5).trim();
            if (data === '[DONE]') return;
            const text = (JSON.parse(data) as StreamChunk).choices?.[0]?.delta?.content;
            if (text) yield text;
        }
    }
}
