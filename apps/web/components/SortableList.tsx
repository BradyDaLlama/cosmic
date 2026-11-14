'use client';

import { useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';

/** Pointer events rather than HTML drag-and-drop, which doesn't work on phones. */
type SortableListProps<T> = {
    items: T[];
    getKey: (item: T) => string;
    onReorder: (items: T[]) => void;
    renderItem: (item: T, index: number, handle: ReactNode) => ReactNode;
    label: (item: T, index: number) => string;
    gap?: number;
    className?: string;
};

export function SortableList<T>({
    items,
    getKey,
    onReorder,
    renderItem,
    label,
    gap = 8,
    className,
}: SortableListProps<T>) {
    const rows = useRef(new Map<string, HTMLLIElement>());
    const [drag, setDrag] = useState<{ key: string; offset: number } | null>(null);
    const start = useRef(0);
    const order = useRef(items);
    order.current = items;

    const move = (from: number, to: number) => {
        const next = [...order.current];
        const [item] = next.splice(from, 1);
        next.splice(to, 0, item);
        order.current = next;
        onReorder(next);
    };

    const onPointerDown = (key: string) => (e: PointerEvent<HTMLButtonElement>) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        e.preventDefault();
        try {
            e.currentTarget.setPointerCapture(e.pointerId);
        } catch {}
        start.current = e.clientY;
        setDrag({ key, offset: 0 });
    };

    const onPointerMove = (key: string) => (e: PointerEvent<HTMLButtonElement>) => {
        if (drag?.key !== key) return;
        let offset = e.clientY - start.current;
        const index = order.current.findIndex((item) => getKey(item) === key);
        const below = order.current[index + 1];
        const above = order.current[index - 1];
        const belowEl = below && rows.current.get(getKey(below));
        const aboveEl = above && rows.current.get(getKey(above));
        if (belowEl && offset > belowEl.offsetHeight / 2) {
            const step = belowEl.offsetHeight + gap;
            move(index, index + 1);
            start.current += step;
            offset -= step;
        } else if (aboveEl && offset < -aboveEl.offsetHeight / 2) {
            const step = aboveEl.offsetHeight + gap;
            move(index, index - 1);
            start.current -= step;
            offset += step;
        }
        setDrag({ key, offset });
    };

    const endDrag = () => setDrag(null);

    const onKeyDown = (index: number) => (e: KeyboardEvent<HTMLButtonElement>) => {
        if (e.key === 'ArrowUp' && index > 0) move(index, index - 1);
        else if (e.key === 'ArrowDown' && index < order.current.length - 1) move(index, index + 1);
        else return;
        e.preventDefault();
        const key = getKey(order.current[e.key === 'ArrowUp' ? index - 1 : index + 1]);
        requestAnimationFrame(() => rows.current.get(key)?.querySelector<HTMLButtonElement>('[data-handle]')?.focus());
    };

    return (
        <ol className={className} style={{ display: 'flex', flexDirection: 'column', gap }}>
            {items.map((item, index) => {
                const key = getKey(item);
                const dragging = drag?.key === key;
                const handle = (
                    <button
                        type="button"
                        data-handle
                        aria-label={`Reorder ${label(item, index)}. Drag, or use the up and down arrow keys.`}
                        onPointerDown={onPointerDown(key)}
                        onPointerMove={onPointerMove(key)}
                        onPointerUp={endDrag}
                        onPointerCancel={endDrag}
                        onKeyDown={onKeyDown(index)}
                        className="grid h-9 w-6 shrink-0 cursor-grab place-items-center rounded-lg opacity-60 hover:opacity-100 focus-visible:opacity-100 active:cursor-grabbing"
                        style={{ touchAction: 'none' }}
                    >
                        <Grip />
                    </button>
                );
                return (
                    <li
                        key={key}
                        ref={(el) => {
                            if (el) rows.current.set(key, el);
                            else rows.current.delete(key);
                        }}
                        className={dragging ? 'relative z-10' : 'relative'}
                        style={{
                            transform: dragging ? `translateY(${drag.offset}px) scale(1.02)` : undefined,
                            transition: dragging ? 'scale 150ms ease' : 'transform 150ms ease',
                            filter: dragging ? 'drop-shadow(0 6px 10px rgba(0,0,0,0.35))' : undefined,
                        }}
                    >
                        {renderItem(item, index, handle)}
                    </li>
                );
            })}
        </ol>
    );
}

function Grip() {
    return (
        <span aria-hidden className="grid grid-cols-2 gap-[3px]">
            {Array.from({ length: 6 }, (_, i) => (
                <span key={i} className="block size-[3px] rounded-full bg-current" />
            ))}
        </span>
    );
}
