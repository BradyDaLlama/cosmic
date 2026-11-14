'use client';

type AppEvents = {
    'habit:done': { habitId: string; name: string; periodKey: string };
};

export type AppEventName = keyof AppEvents;

const PREFIX = 'cosmic:';

export function emitAppEvent<N extends AppEventName>(name: N, detail: AppEvents[N]) {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent(PREFIX + name, { detail }));
}

export function onAppEvent<N extends AppEventName>(name: N, handler: (detail: AppEvents[N]) => void) {
    if (typeof window === 'undefined') return () => {};
    const listener = (e: Event) => handler((e as CustomEvent<AppEvents[N]>).detail);
    window.addEventListener(PREFIX + name, listener);
    return () => window.removeEventListener(PREFIX + name, listener);
}
