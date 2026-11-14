import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
    appId: 'com.bradydallama.cosmic',
    appName: 'Cosmic',
    webDir: 'www',
    backgroundColor: '#10212a',
    server: {
        url: 'https://cosmic.bradydallama.com',
        errorPath: 'offline.html',
    },
    plugins: {
        SystemBars: { style: 'DARK' },
    },
};

export default config;
