'use client';

import { useState } from 'react';
import { Button, Dialog } from '@bradydallama/ui';
import type { TaskList } from '@/lib/tasks';

type ListPickerProps = {
    lists: TaskList[];
    value: string | undefined;
    onChange: (listId: string) => void;
    disabled?: boolean;
};

export function ListPicker({ lists, value, onChange, disabled }: ListPickerProps) {
    const [open, setOpen] = useState(false);
    const current = lists.find((l) => l.id === value);
    if (!current) return null;

    return (
        <>
            <Button
                type="button"
                size="sm"
                disabled={disabled}
                onClick={() => setOpen(true)}
                aria-label={`List: ${current.title}. Change list`}
                className="shrink-0"
            >
                {current.title}
            </Button>
            <Dialog open={open} onClose={() => setOpen(false)} variant="sheet" title="Add to list">
                <ul className="flex flex-col">
                    {lists.map((list) => (
                        <li key={list.id}>
                            <button
                                type="button"
                                aria-pressed={list.id === value}
                                onClick={() => {
                                    onChange(list.id);
                                    setOpen(false);
                                }}
                                className="flex min-h-11 w-full items-center justify-between text-left"
                            >
                                <span>{list.title}</span>
                                {list.id === value && <span className="text-xs text-primary">selected</span>}
                            </button>
                        </li>
                    ))}
                </ul>
            </Dialog>
        </>
    );
}
