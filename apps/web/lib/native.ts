import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';

export const isNativeApp = () => Capacitor.isNativePlatform();

// Google refuses to sign in inside an app's web view, so the app signs in through a Chrome tab.
export function connectGoogle() {
    if (isNativeApp()) void Browser.open({ url: `${window.location.origin}/api/auth/google?app` });
    else window.location.href = '/api/auth/google';
}
