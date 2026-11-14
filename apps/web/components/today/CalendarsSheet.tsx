'use client';

import { useEffect, useState } from 'react';
import { Dialog, Switch } from '@bradydallama/ui';
import { api, ApiError } from '@/lib/apiClient';
import type { CalendarInfo } from '@/lib/calendar/model';
import { setCalendarHidden, useSettings } from '@/lib/settings/useSettings';

export function CalendarsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
    const { settings, error } = useSettings();
    const [calendars, setCalendars] = useState<CalendarInfo[] | null>(null);
    const [problem, setProblem] = useState<string | null>(null);

    useEffect(() => {
        if (!open) return;
        setProblem(null);
        api<{ calendars: CalendarInfo[] }>('/api/calendar/calendars')
            .then((r) => setCalendars(r.calendars))
            .catch((err) =>
                setProblem(
                    err instanceof ApiError && err.status === 403
                        ? 'Reconnect Google to choose calendars.'
                        : "Your calendars couldn't load. Try again shortly.",
                ),
            );
    }, [open]);

    const hidden = new Set(settings.hiddenCalendars);
    const shown = calendars?.filter((c) => !hidden.has(c.id)).length ?? 0;

    return (
        <Dialog open={open} onClose={onClose} variant="sheet" title="Calendars">
            <div className="flex flex-col gap-3">
                <p className="text-sm opacity-80">
                    Choose what Today shows. Hiding a calendar here leaves it on in Google Calendar.
                </p>
                {problem && <p className="text-sm">{problem}</p>}
                {!calendars && !problem && <p className="text-sm opacity-70">Loading your calendars…</p>}
                {calendars && (
                    <ul className="flex flex-col">
                        {calendars.map((c) => {
                            const on = !hidden.has(c.id);
                            return (
                                <li key={c.id} className="flex min-h-11 items-center gap-3">
                                    <span
                                        aria-hidden
                                        className="size-3 shrink-0 rounded-full"
                                        style={{ background: c.color ?? 'currentColor' }}
                                    />
                                    <span className="min-w-0 flex-1 truncate">
                                        {c.name}
                                        {c.primary && <span className="text-xs opacity-60"> (yours)</span>}
                                    </span>
                                    <Switch
                                        aria-label={`Show ${c.name} on Today`}
                                        checked={on}
                                        disabled={on && shown === 1}
                                        onChange={(e) => void setCalendarHidden(c.id, !e.target.checked)}
                                    />
                                </li>
                            );
                        })}
                    </ul>
                )}
                {error && (
                    <p role="alert" className="text-xs">
                        {error}
                    </p>
                )}
                <p className="text-xs opacity-60">Only calendars switched on in Google Calendar are listed here.</p>
            </div>
        </Dialog>
    );
}
