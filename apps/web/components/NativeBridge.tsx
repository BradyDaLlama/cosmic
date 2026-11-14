'use client';

import { useEffect } from 'react';
import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { isNativeApp } from '@/lib/native';

export function NativeBridge() {
    useEffect(() => {
        if (!isNativeApp()) return;
        const opened = App.addListener('appUrlOpen', ({ url }) => {
            const link = new URL(url);
            if (link.host !== 'auth') return;
            void Browser.close();
            const code = link.searchParams.get('code');
            window.location.href = code
                ? `/api/auth/app?code=${encodeURIComponent(code)}`
                : `/?auth=${encodeURIComponent(link.searchParams.get('auth') ?? 'failed')}`;
        });
        const back = App.addListener('backButton', ({ canGoBack }) => {
            if (canGoBack) window.history.back();
            else void App.exitApp();
        });
        return () => {
            void opened.then((l) => l.remove());
            void back.then((l) => l.remove());
        };
    }, []);
    return null;
}
