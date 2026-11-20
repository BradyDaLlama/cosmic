'use client';

import { useEffect, useState } from 'react';

const TICK_MS = 28;
const MAX_CATCH_UP_MS = 3000;

type Reveal = { text: string; count: number; run: number };

/** Reveals text a character at a time, carrying on when the text grows and starting over when it changes. */
export function useReveal(text: string): Reveal & { revealing: boolean } {
    const [reveal, setReveal] = useState<Reveal>({ text, count: 0, run: 0 });
    if (reveal.text !== text) {
        const kept = text.startsWith(reveal.text.slice(0, reveal.count));
        setReveal({ text, count: kept ? reveal.count : 0, run: kept ? reveal.run : reveal.run + 1 });
    }
    const behind = reveal.count < text.length;

    useEffect(() => {
        if (!behind) return;
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            setReveal((r) => ({ ...r, count: r.text.length }));
            return;
        }
        const id = window.setInterval(() => {
            setReveal((r) => {
                const backlog = r.text.length - r.count;
                if (backlog <= 0) return r;
                return { ...r, count: r.count + Math.max(1, Math.ceil((backlog * TICK_MS) / MAX_CATCH_UP_MS)) };
            });
        }, TICK_MS);
        return () => window.clearInterval(id);
    }, [behind]);

    return { ...reveal, revealing: behind };
}

/** Every character is laid out up front so the bubble doesn't reflow as they appear. */
export function BubbleText({ text, count, run }: { text: string; count: number; run: number }) {
    let index = 0;
    return (
        <>
            <span className="sr-only">{text}</span>
            <span key={run} aria-hidden>
                {text.split(' ').map((word, w) => (
                    <span key={w} className="inline-block">
                        {[...`${word} `].map((char) => {
                            const i = index++;
                            return (
                                <span key={i} className="cosmic-char" data-shown={i < count || undefined}>
                                    {char === ' ' ? ' ' : char}
                                </span>
                            );
                        })}
                    </span>
                ))}
            </span>
        </>
    );
}
