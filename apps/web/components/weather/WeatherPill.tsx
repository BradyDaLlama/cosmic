'use client';

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { Pill } from '@bradydallama/ui';
import { useNow } from '@/lib/calendar/useDayEvents';
import { conditionIcon, conditionLabel, whenLabel } from '@/lib/weather/model';
import { useWeather } from '@/lib/weather/useWeather';

const STEP_PX = 18;
const WHEEL_STEP = 24;
const TAP_SLOP = 6;

export function WeatherPill() {
    const { status, data, requestLocation } = useWeather();
    const now = useNow();
    const [offset, setOffset] = useState(0);
    const pillRef = useRef<HTMLButtonElement>(null);
    const [label, setLabel] = useState('');

    const slots = data?.slots ?? [];
    const time = now ?? data?.now.at ?? 0;
    const nowIndex = Math.max(
        0,
        slots.findIndex((s) => s.start <= time && time < s.start + 30 * 60_000),
    );
    const min = -nowIndex;
    const max = slots.length - 1 - nowIndex;
    const clampOffset = (n: number) => Math.min(max, Math.max(min, n));
    const slot = offset !== 0 ? slots[nowIndex + offset] : undefined;

    useEffect(() => {
        if (slot) setLabel(whenLabel(slot.start, time));
    }, [slot, time]);

    useEffect(() => {
        if (slots.length) setOffset((o) => Math.min(max, Math.max(min, o)));
    }, [min, max, slots.length]);

    const drag = useRef<{ x0: number; start: number; moved: boolean } | null>(null);
    const swallowClick = useRef(false);

    const onPointerDown = (e: PointerEvent<HTMLButtonElement>) => {
        if (!data || (e.pointerType === 'mouse' && e.button !== 0)) return;
        drag.current = { x0: e.clientX, start: offset, moved: false };
        swallowClick.current = false;
    };
    const onPointerMove = (e: PointerEvent<HTMLButtonElement>) => {
        const d = drag.current;
        if (!d) return;
        const dx = e.clientX - d.x0;
        if (!d.moved && Math.abs(dx) < TAP_SLOP) return;
        if (!d.moved) {
            d.moved = true;
            try {
                e.currentTarget.setPointerCapture(e.pointerId);
            } catch {}
        }
        setOffset(clampOffset(d.start + Math.round(-dx / STEP_PX)));
    };
    const onPointerUp = () => {
        if (drag.current?.moved) swallowClick.current = true;
        drag.current = null;
    };

    useEffect(() => {
        const el = pillRef.current;
        if (!el || !data) return;
        let acc = 0;
        const onWheel = (e: WheelEvent) => {
            if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
            e.preventDefault();
            acc += e.deltaX;
            const steps = Math.trunc(acc / WHEEL_STEP);
            if (steps) {
                acc -= steps * WHEEL_STEP;
                setOffset((o) => Math.min(max, Math.max(min, o + steps)));
            }
        };
        el.addEventListener('wheel', onWheel, { passive: false });
        return () => el.removeEventListener('wheel', onWheel);
    }, [data, min, max]);

    const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
        if (e.key === 'ArrowRight') setOffset((o) => clampOffset(o + 1));
        else if (e.key === 'ArrowLeft') setOffset((o) => clampOffset(o - 1));
        else return;
        e.preventDefault();
    };

    if (!data) {
        const text =
            status === 'locating' || status === 'loading'
                ? 'Weather…'
                : status === 'denied'
                  ? 'No location'
                  : status === 'error'
                    ? 'Weather unavailable'
                    : 'Weather';
        return (
            <button
                type="button"
                onClick={() => void requestLocation()}
                aria-label={status === 'needs_location' ? 'Show weather (uses your location)' : text}
                title={
                    status === 'denied'
                        ? 'Allow location access for this site in your browser settings to see weather.'
                        : undefined
                }
                className="shrink-0"
            >
                <Pill tone="primary" icon="location">
                    {text}
                </Pill>
            </button>
        );
    }

    const shown = slot ?? { ...data.now };
    const temp = shown.temp;
    const condition = shown.condition;
    const isDay = shown.isDay;
    const at = slot ? label : 'now';

    return (
        <div className="flex shrink-0 items-center gap-2">
            <span
                aria-hidden
                className="text-xs whitespace-nowrap text-bubble transition-opacity duration-300"
                style={{ opacity: slot ? 0.8 : 0 }}
            >
                {label}
            </span>
            <button
                ref={pillRef}
                type="button"
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
                onKeyDown={onKeyDown}
                onClick={() => {
                    if (swallowClick.current) {
                        swallowClick.current = false;
                        return;
                    }
                    setOffset(0);
                }}
                aria-label={`${temp} degrees, ${conditionLabel[condition]}, ${at}. Swipe or use arrow keys to see other times; tap to go back to now.`}
                title="Swipe to see other times. Tap for now."
                style={{ touchAction: 'pan-y' }}
                className="shrink-0 select-none"
            >
                <Pill tone="primary" icon={conditionIcon(condition, isDay)} className="tabular-nums">
                    {temp}°
                </Pill>
            </button>
        </div>
    );
}
