import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import './globals.css';

// Personal-use font license: never bundle it in the published packages.
const display = localFont({
    src: './fonts/mini-wakuwaku-maru.otf',
    variable: '--bd-font-display',
    display: 'swap',
});

export const metadata: Metadata = {
    title: 'Cosmic',
    description: 'Goals, people, money, health, and time in one place.',
};

export const viewport: Viewport = {
    themeColor: '#10212a',
    width: 'device-width',
    initialScale: 1,
    viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en" data-case="lower" className={display.variable}>
            <body className="bd-body">{children}</body>
        </html>
    );
}
