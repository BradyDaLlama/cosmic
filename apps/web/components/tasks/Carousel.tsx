'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';

export type CarouselSlide = {
    key: string;
    label: string;
    content: ReactNode;
    plus?: boolean;
};

type CarouselProps = {
    slides: CarouselSlide[];
    label: string;
    initialKey?: string;
    focusKey?: string | null;
    onChange?: (key: string) => void;
};

/** Must match `gap-3`. */
const GAP = 12;
/** Must match `-mx-4`. */
const BLEED = 16;
const LOCK_DISTANCE = 8;
const FLICK_VELOCITY = 0.3;
const EDGE_RESISTANCE = 0.3;

const easeOutCubic = (p: number) => 1 - (1 - p) ** 3;
const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

export function Carousel({ slides, label, initialKey, focusKey, onChange }: CarouselProps) {
    const viewportRef = useRef<HTMLDivElement>(null);
    const rowRef = useRef<HTMLDivElement>(null);
    const [active, setActive] = useState(0);
    const index = Math.min(active, Math.max(0, slides.length - 1));

    const offset = useRef(0);
    const target = useRef(0);
    const animation = useRef(0);
    const placed = useRef(false);
    const handledFocus = useRef<string | null | undefined>(undefined);
    const reducedMotion = useRef(false);

    const count = slides.length;
    const countRef = useRef(count);
    countRef.current = count;

    const step = () => (rowRef.current?.clientWidth ?? 0) - 24 + GAP;
    const CENTER = 12;
    const restingOffset = (i: number) => CENTER - i * step();
    const indexAt = (o: number) => clamp(Math.round((CENTER - o) / (step() || 1)), 0, countRef.current - 1);
    const bounds = () => [restingOffset(countRef.current - 1), restingOffset(0)] as const;

    const render = useCallback(() => {
        const row = rowRef.current;
        const viewport = viewportRef.current;
        if (!row || !viewport) return;
        const width = row.clientWidth;
        const s = step();
        row.style.transform = `translate3d(${offset.current}px, 0, 0)`;

        let tallest = 0;
        const els = row.children as HTMLCollectionOf<HTMLElement>;
        for (let i = 0; i < els.length; i++) {
            const el = els[i];
            const left = i * s + offset.current;
            const d = s ? Math.min(Math.abs((left - CENTER) / s), 1) : 0;
            if (!reducedMotion.current) {
                const e = clamp((d - 0.25) / 0.85, 0, 1);
                el.style.opacity = String(1 - e);
                el.style.transform = `scale(${1 - 0.2 * e})`;
            }
            const visible = Math.min(left + el.offsetWidth, width + BLEED) - Math.max(left, -BLEED);
            if (visible / el.offsetWidth > 0.15) tallest = Math.max(tallest, el.offsetHeight);
        }
        if (tallest) viewport.style.height = `${tallest}px`;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const stop = () => {
        cancelAnimationFrame(animation.current);
        animation.current = 0;
    };

    const animateTo = useCallback(
        (to: number) => {
            stop();
            target.current = to;
            const from = offset.current;
            const distance = Math.abs(to - from);
            if (distance < 0.5 || reducedMotion.current) {
                offset.current = to;
                render();
                return;
            }
            const duration = clamp(220 + distance * 0.35, 240, 420);
            const start = performance.now();
            const tick = (now: number) => {
                const p = Math.min(1, (now - start) / duration);
                offset.current = from + (to - from) * easeOutCubic(p);
                render();
                animation.current = p < 1 ? requestAnimationFrame(tick) : 0;
            };
            animation.current = requestAnimationFrame(tick);
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [render],
    );

    const goTo = useCallback(
        (i: number) => {
            const next = clamp(i, 0, countRef.current - 1);
            setActive(next);
            animateTo(restingOffset(next));
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [animateTo],
    );

    useLayoutEffect(() => {
        reducedMotion.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (placed.current || !count) return;
        placed.current = true;
        const i = Math.max(
            0,
            slides.findIndex((s) => s.key === initialKey),
        );
        setActive(i);
        offset.current = target.current = restingOffset(i);
        render();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [count, initialKey, render]);

    useEffect(() => {
        if (!focusKey || handledFocus.current === focusKey) return;
        const i = slides.findIndex((s) => s.key === focusKey);
        if (i < 0) return;
        handledFocus.current = focusKey;
        goTo(i);
    }, [focusKey, slides, goTo]);

    useLayoutEffect(() => {
        if (!placed.current || !count) return;
        const i = Math.min(index, count - 1);
        if (!animation.current) offset.current = target.current = restingOffset(i);
        render();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [count]);

    useEffect(() => {
        const row = rowRef.current;
        if (!row) return;
        const observer = new ResizeObserver(() => {
            if (!animation.current && !drag.current) {
                offset.current = target.current = restingOffset(indexAt(target.current));
            }
            render();
        });
        observer.observe(row);
        for (const el of row.children) observer.observe(el);
        return () => observer.disconnect();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [count, render]);

    useEffect(() => () => stop(), []);

    const activeKey = slides[index]?.key;
    const onChangeRef = useRef(onChange);
    onChangeRef.current = onChange;
    useEffect(() => {
        if (!placed.current || !activeKey) return;
        const timer = setTimeout(() => onChangeRef.current?.(activeKey), 450);
        return () => clearTimeout(timer);
    }, [activeKey]);

    const drag = useRef<{
        id: number;
        x0: number;
        y0: number;
        offset0: number;
        axis: 'x' | 'y' | null;
        lastX: number;
        lastT: number;
        velocity: number;
    } | null>(null);
    const suppressClick = useRef(false);

    const onPointerDown = (e: React.PointerEvent) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        stop();
        suppressClick.current = false;
        drag.current = {
            id: e.pointerId,
            x0: e.clientX,
            y0: e.clientY,
            offset0: offset.current,
            axis: null,
            lastX: e.clientX,
            lastT: e.timeStamp,
            velocity: 0,
        };
    };

    const onPointerMove = (e: React.PointerEvent) => {
        const d = drag.current;
        if (!d || e.pointerId !== d.id) return;
        const dx = e.clientX - d.x0;
        const dy = e.clientY - d.y0;
        if (!d.axis) {
            if (Math.abs(dx) < LOCK_DISTANCE && Math.abs(dy) < LOCK_DISTANCE) return;
            d.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
            if (d.axis === 'x') {
                try {
                    viewportRef.current?.setPointerCapture(e.pointerId);
                } catch {}
            }
        }
        if (d.axis !== 'x') return;

        const dt = e.timeStamp - d.lastT;
        if (dt > 0) d.velocity = 0.8 * ((e.clientX - d.lastX) / dt) + 0.2 * d.velocity;
        d.lastX = e.clientX;
        d.lastT = e.timeStamp;

        const [min, max] = bounds();
        let next = d.offset0 + dx;
        if (next > max) next = max + (next - max) * EDGE_RESISTANCE;
        if (next < min) next = min + (next - min) * EDGE_RESISTANCE;
        offset.current = next;
        render();
        const nearest = indexAt(next);
        setActive(nearest);
    };

    const endDrag = (e: React.PointerEvent) => {
        const d = drag.current;
        if (!d || e.pointerId !== d.id) return;
        drag.current = null;
        if (d.axis !== 'x') return;
        suppressClick.current = true;

        const s = step() || 1;
        const from = indexAt(target.current);
        const moved = -(offset.current - d.offset0) / s;
        // After a pause the velocity is stale, so use distance instead.
        const stale = e.timeStamp - d.lastT > 80;
        let to: number;
        if (!stale && Math.abs(d.velocity) > FLICK_VELOCITY) to = from + (d.velocity < 0 ? 1 : -1);
        else to = indexAt(offset.current);
        to = clamp(to, from - 1, from + 1);
        if (Math.abs(moved) < 0.02) to = from;
        goTo(to);
    };

    const onClickCapture = (e: React.MouseEvent) => {
        if (!suppressClick.current) return;
        suppressClick.current = false;
        e.preventDefault();
        e.stopPropagation();
    };

    useEffect(() => {
        const viewport = viewportRef.current;
        if (!viewport) return;
        // Trackpads keep sending shrinking momentum deltas after a swipe; those must not move again.
        // A new swipe shows up as deltas that grow again or flip direction.
        let accumulated = 0;
        let locked = false;
        let lockedAt = 0;
        let lockedDirection = 0;
        let lastSize = 0;
        let quiet: ReturnType<typeof setTimeout>;

        const unlock = () => {
            locked = false;
            accumulated = 0;
        };

        const onWheel = (e: WheelEvent) => {
            if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
            e.preventDefault();
            clearTimeout(quiet);
            quiet = setTimeout(unlock, 160);

            const size = Math.abs(e.deltaX);
            const direction = Math.sign(e.deltaX);
            if (locked) {
                const settled = e.timeStamp - lockedAt > 120;
                const growing = size > lastSize * 1.4 + 2 && size > 6;
                const reversed = direction !== lockedDirection && size > 3;
                lastSize = size;
                if (!(settled && (growing || reversed))) return;
                unlock();
            }
            lastSize = size;

            accumulated += e.deltaX;
            if (Math.abs(accumulated) > 30) {
                locked = true;
                lockedAt = e.timeStamp;
                lockedDirection = Math.sign(accumulated);
                const current = indexAt(target.current);
                goTo(current + lockedDirection);
                accumulated = 0;
            }
        };
        viewport.addEventListener('wheel', onWheel, { passive: false });
        return () => {
            viewport.removeEventListener('wheel', onWheel);
            clearTimeout(quiet);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [goTo]);

    return (
        <section aria-roledescription="carousel" aria-label={label} className="flex flex-col gap-1">
            <div className="flex items-center gap-1">
                {slides.map((slide, i) => {
                    const on = i === index;
                    return (
                        <button
                            key={slide.key}
                            type="button"
                            aria-label={`Show ${slide.label}`}
                            aria-current={on ? 'true' : undefined}
                            onClick={() => goTo(i)}
                            className="grid size-6 place-items-center text-bubble"
                        >
                            {slide.plus ? (
                                <span className={`text-sm leading-none ${on ? '' : 'opacity-50'}`}>+</span>
                            ) : (
                                <span
                                    className={`block rounded-full bg-current transition-all ${on ? 'h-2.5 w-5' : 'size-2.5 opacity-40'}`}
                                />
                            )}
                        </button>
                    );
                })}
            </div>
            <div
                ref={viewportRef}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
                onClickCapture={onClickCapture}
                style={{ touchAction: 'pan-y' }}
                className="cosmic-carousel-track -mx-4 overflow-hidden px-4 pt-1"
            >
                <div ref={rowRef} className="flex items-start gap-3 will-change-transform">
                    {slides.map((slide, i) => (
                        <div
                            key={slide.key}
                            role="group"
                            aria-roledescription="slide"
                            aria-label={`${slide.label}, ${i + 1} of ${slides.length}`}
                            inert={i !== index || undefined}
                            className="w-[calc(100%-1.5rem)] shrink-0 origin-top pb-2"
                        >
                            {slide.content}
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
