'use client';

import type { CSSProperties } from 'react';
import { Icon, type IconName } from '@bradydallama/ui';
import { habitColor, type HabitColor } from '@/lib/habits/model';

/** A border plus an inset shadow rather than `outline`, so the rings take up layout space. */
const rings = (fill: string): CSSProperties => ({
    border: 'var(--border-outline) solid var(--color-bg)',
    boxShadow: `inset 0 0 0 var(--border-outline) ${fill}`,
});

const sizes = {
    sm: { box: 'size-8', icon: 'xs' as const, rounded: 'rounded-lg' },
    md: { box: 'size-10', icon: 'sm' as const, rounded: 'rounded-xl' },
};

type HabitBadgeProps = {
    icon: IconName;
    color: HabitColor;
    size?: 'sm' | 'md';
    /** `rounded` is a rounded square, for chips that aren't pills. */
    shape?: 'round' | 'rounded';
};

export function HabitBadge({ icon, color, size = 'sm', shape = 'round' }: HabitBadgeProps) {
    const { fill, ink } = habitColor(color);
    return (
        <span
            aria-hidden
            className={`grid ${sizes[size].box} shrink-0 place-items-center ${shape === 'round' ? 'rounded-full' : sizes[size].rounded}`}
            style={{ background: ink, color: fill, ...rings(fill) }}
        >
            <Icon name={icon} size={sizes[size].icon} />
        </span>
    );
}

type HabitCheckProps = {
    done: boolean;
    color: HabitColor;
    label: string;
    onToggle: () => void;
    disabled?: boolean;
};

export function HabitCheck({ done, color, label, onToggle, disabled }: HabitCheckProps) {
    const { fill, ink } = habitColor(color);
    return (
        <button
            type="button"
            role="checkbox"
            aria-checked={done}
            aria-label={label}
            onClick={onToggle}
            disabled={disabled}
            className="grid size-7 shrink-0 place-items-center rounded-full transition-[background-color,scale,opacity] duration-200 active:scale-90 disabled:opacity-35 disabled:active:scale-100"
            style={{ background: done ? fill : 'var(--color-bubble)', color: ink, ...rings(fill) }}
        >
            {done && <Icon name="mark-check" size="xs" />}
        </button>
    );
}

export function HabitCheckMark({ done, color }: { done: boolean; color: HabitColor }) {
    const { fill, ink } = habitColor(color);
    return (
        <span
            aria-hidden
            className="grid size-7 shrink-0 place-items-center rounded-full transition-[background-color] duration-200"
            style={{ background: done ? fill : 'var(--color-bubble)', color: ink, ...rings(fill) }}
        >
            {done && <Icon name="mark-check" size="xs" />}
        </span>
    );
}
