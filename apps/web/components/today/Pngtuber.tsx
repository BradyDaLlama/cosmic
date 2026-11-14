'use client';

import { useCallback, useEffect, useRef } from 'react';
import { onAppEvent, type AppEventName } from '@/lib/events';

const { href: SRC, origin: ORIGIN } = new URL(process.env.NEXT_PUBLIC_PNGTUBER_URL!);

type PngEvent =
    | 'blink'
    | 'lookdown'
    | 'lookleft'
    | 'smile'
    | 'type'
    | 'mousearound'
    | 'fascination'
    | 'fear'
    | 'squint'
    | 'suspicion';

const REACTIONS: { [N in AppEventName]?: PngEvent } = {
    'habit:done': 'fascination',
};

const READY_DELAY = 400;

const reducedMotion = () =>
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function Pngtuber({ talking = false, className }: { talking?: boolean; className?: string }) {
    const frameRef = useRef<HTMLIFrameElement>(null);
    const bodyRef = useRef<HTMLDivElement>(null);
    const ready = useRef(false);
    const queue = useRef<PngEvent[]>([]);

    const send = useCallback((event: PngEvent) => {
        const win = frameRef.current?.contentWindow;
        if (!ready.current || !win) {
            queue.current.push(event);
            return;
        }
        win.postMessage({ type: 'triggerEvent', event }, ORIGIN);
    }, []);

    const flush = useCallback(() => {
        if (ready.current) return;
        ready.current = true;
        const pending = queue.current;
        queue.current = [];
        pending.forEach((e) =>
            frameRef.current?.contentWindow?.postMessage({ type: 'triggerEvent', event: e }, ORIGIN),
        );
    }, []);
    const onLoad = useCallback(() => void window.setTimeout(flush, READY_DELAY), [flush]);
    // The frame can finish loading before hydration attaches onLoad.
    useEffect(() => {
        const id = window.setTimeout(flush, 4000);
        return () => window.clearTimeout(id);
    }, [flush]);

    const wasTalking = useRef(false);
    useEffect(() => {
        const el = bodyRef.current;
        if (talking) {
            wasTalking.current = true;
            if (!el || reducedMotion()) return;
            const bounce = el.animate(
                [
                    { transform: 'translateY(0) scale(1, 1)' },
                    { transform: 'translateY(-2%) scale(0.98, 1.03)' },
                    { transform: 'translateY(0) scale(1.02, 0.98)' },
                ],
                { duration: 220, iterations: Infinity, direction: 'alternate', easing: 'ease-in-out' },
            );
            return () => bounce.cancel();
        }
        if (wasTalking.current) {
            wasTalking.current = false;
            send('smile');
        }
    }, [talking, send]);

    useEffect(() => {
        const offs = (Object.keys(REACTIONS) as AppEventName[]).map((name) =>
            onAppEvent(name, () => {
                const reaction = REACTIONS[name];
                if (reaction) send(reaction);
                if (!bodyRef.current || reducedMotion()) return;
                bodyRef.current.animate(
                    [
                        { transform: 'translateY(0) rotate(0)' },
                        { transform: 'translateY(-18%) rotate(-6deg)', offset: 0.35 },
                        { transform: 'translateY(0) rotate(4deg)', offset: 0.7 },
                        { transform: 'translateY(0) rotate(0)' },
                    ],
                    { duration: 600, easing: 'ease-out', composite: 'add' },
                );
            }),
        );
        return () => offs.forEach((off) => off());
    }, [send]);

    return (
        <div className={className} aria-hidden>
            <div ref={bodyRef} className="size-full origin-bottom">
                <iframe
                    ref={frameRef}
                    src={SRC}
                    title="BradyDaLlama pngtuber"
                    tabIndex={-1}
                    onLoad={onLoad}
                    style={{ colorScheme: 'normal' }}
                    className="pointer-events-none size-full border-0 bg-transparent"
                />
            </div>
        </div>
    );
}
