'use client';

import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { formatDate, formatValue, niceTicks, type DayPoint } from '@/lib/goals/model';

const SURFACE = 'var(--color-bg)';
const GRID = 'color-mix(in srgb, var(--color-bubble) 14%, transparent)';
const MUTED = 'color-mix(in srgb, var(--color-bubble) 65%, transparent)';
const PAD = { top: 18, right: 14, bottom: 22, left: 40 };
const DOTS_UP_TO = 30;

type LineChartProps = {
    points: DayPoint[];
    color: string;
    unit?: string;
    height?: number;
    label: string;
};

export function LineChart({ points, color, unit, height = 200, label }: LineChartProps) {
    const wrapRef = useRef<HTMLDivElement>(null);
    const [width, setWidth] = useState(0);
    const [hover, setHover] = useState<number | null>(null);

    useEffect(() => {
        const el = wrapRef.current;
        if (!el) return;
        const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
        observer.observe(el);
        return () => observer.disconnect();
    }, []);

    if (!points.length) {
        return (
            <div
                className="grid place-items-center rounded-3xl text-sm"
                style={{ height, background: SURFACE, color: MUTED }}
            >
                No entries in this range yet.
            </div>
        );
    }

    const plotW = Math.max(1, width - PAD.left - PAD.right);
    const plotH = height - PAD.top - PAD.bottom;
    const values = points.map((p) => p.value);
    const ticks = niceTicks(Math.min(...values), Math.max(...values), 4);
    const yMin = ticks[0];
    const yMax = ticks.at(-1)!;
    const t0 = points[0].t;
    const t1 = points.at(-1)!.t;
    const x = (t: number) => PAD.left + (t1 === t0 ? plotW / 2 : ((t - t0) / (t1 - t0)) * plotW);
    const y = (v: number) => PAD.top + (1 - (v - yMin) / (yMax - yMin || 1)) * plotH;

    const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
    const area = `${line} L${x(t1).toFixed(1)},${PAD.top + plotH} L${x(t0).toFixed(1)},${PAD.top + plotH} Z`;
    const last = points.at(-1)!;
    const lastX = x(last.t);
    const lastY = y(last.value);
    const labelAnchor = lastX > width - 60 ? 'end' : 'start';
    const showDots = points.length <= DOTS_UP_TO;

    const onMove = (e: PointerEvent<SVGRectElement>) => {
        const box = e.currentTarget.getBoundingClientRect();
        const px = e.clientX - box.left + PAD.left;
        let nearest = 0;
        points.forEach((p, i) => {
            if (Math.abs(x(p.t) - px) < Math.abs(x(points[nearest].t) - px)) nearest = i;
        });
        setHover(nearest);
    };

    const h = hover !== null ? points[hover] : null;

    return (
        <div ref={wrapRef} className="relative rounded-3xl" style={{ background: SURFACE, height }}>
            {width > 0 && (
                <svg width={width} height={height} role="img" aria-label={label} className="block">
                    {ticks.map((v) => (
                        <g key={v}>
                            <line
                                x1={PAD.left}
                                x2={width - PAD.right}
                                y1={y(v)}
                                y2={y(v)}
                                stroke={GRID}
                                strokeWidth={1}
                            />
                            <text
                                x={PAD.left - 8}
                                y={y(v)}
                                dy="0.35em"
                                textAnchor="end"
                                fontSize={11}
                                fill={MUTED}
                                className="tabular-nums"
                            >
                                {formatValue(v)}
                            </text>
                        </g>
                    ))}
                    <text
                        x={x(t0)}
                        y={height - 6}
                        fontSize={11}
                        fill={MUTED}
                        textAnchor={t1 === t0 ? 'middle' : 'start'}
                    >
                        {formatDate(points[0].date)}
                    </text>
                    {t1 !== t0 && (
                        <text x={x(t1)} y={height - 6} fontSize={11} fill={MUTED} textAnchor="end">
                            {formatDate(last.date)}
                        </text>
                    )}

                    {points.length > 1 && <path d={area} fill={color} opacity={0.1} />}
                    {points.length > 1 && (
                        <path
                            d={line}
                            fill="none"
                            stroke={color}
                            strokeWidth={2}
                            strokeLinejoin="round"
                            strokeLinecap="round"
                        />
                    )}

                    {h && (
                        <line
                            x1={x(h.t)}
                            x2={x(h.t)}
                            y1={PAD.top}
                            y2={PAD.top + plotH}
                            stroke={MUTED}
                            strokeWidth={1}
                        />
                    )}

                    {points.map((p, i) =>
                        showDots || i === points.length - 1 || i === hover ? (
                            <circle
                                key={p.date}
                                cx={x(p.t)}
                                cy={y(p.value)}
                                r={i === hover ? 5 : 4}
                                fill={color}
                                stroke={SURFACE}
                                strokeWidth={2}
                            />
                        ) : null,
                    )}

                    {hover === null && (
                        <text
                            x={lastX + (labelAnchor === 'end' ? -8 : 8)}
                            y={lastY - 10}
                            textAnchor={labelAnchor}
                            fontSize={12}
                            fill="var(--color-bubble)"
                        >
                            {formatValue(last.value, unit)}
                        </text>
                    )}

                    <rect
                        x={PAD.left}
                        y={0}
                        width={plotW}
                        height={height}
                        fill="transparent"
                        style={{ touchAction: 'pan-y' }}
                        onPointerMove={onMove}
                        onPointerDown={onMove}
                        onPointerLeave={() => setHover(null)}
                    />
                </svg>
            )}

            {h && (
                <div
                    role="status"
                    className="pointer-events-none absolute top-1 rounded-xl px-2 py-1 text-xs whitespace-nowrap"
                    style={{
                        left: Math.min(Math.max(x(h.t), 60), width - 60),
                        transform: 'translateX(-50%)',
                        background: 'var(--color-bubble)',
                        color: 'var(--color-text)',
                    }}
                >
                    {formatDate(h.date, true)}: {formatValue(h.value, unit)}
                    {h.count > 1 ? ` (best of ${h.count})` : ''}
                </div>
            )}
        </div>
    );
}

export function Sparkline({
    points,
    color,
    width = 72,
    height = 28,
}: {
    points: DayPoint[];
    color: string;
    width?: number;
    height?: number;
}) {
    if (points.length < 2) return null;
    const pad = 4;
    const values = points.map((p) => p.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const t0 = points[0].t;
    const t1 = points.at(-1)!.t;
    const x = (t: number) => pad + ((t - t0) / (t1 - t0 || 1)) * (width - pad * 2);
    const y = (v: number) => pad + (1 - (v - min) / (max - min || 1)) * (height - pad * 2);
    const d = points.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
    const last = points.at(-1)!;
    return (
        <svg width={width} height={height} aria-hidden className="shrink-0">
            <path
                d={d}
                fill="none"
                stroke="var(--color-text)"
                strokeOpacity={0.55}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
            />
            <circle cx={x(last.t)} cy={y(last.value)} r={3.5} fill={color} stroke="var(--color-text)" strokeWidth={2} />
        </svg>
    );
}
