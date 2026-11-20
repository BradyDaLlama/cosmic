/** Reads a byte stream as text. Stopping early (break or return) cancels the stream. */
export async function* readText(stream: ReadableStream<Uint8Array>): AsyncGenerator<string> {
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    try {
        for (;;) {
            const { value, done } = await reader.read();
            if (done) break;
            const text = decoder.decode(value, { stream: true });
            if (text) yield text;
        }
    } finally {
        await reader.cancel().catch(() => undefined);
    }
}
