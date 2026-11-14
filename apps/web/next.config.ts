import { realpathSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import type { NextConfig } from 'next';

const repoRoot = resolve(import.meta.dirname, '../..');

// Lets Turbopack read a locally linked ui checkout; undefined with the registry version.
function linkedRoot() {
    try {
        const ui = realpathSync(resolve(repoRoot, 'node_modules/@bradydallama/ui'));
        if (!relative(repoRoot, ui).startsWith('..')) return undefined;
        let shared = repoRoot;
        while (relative(shared, ui).startsWith('..')) shared = dirname(shared);
        return shared;
    } catch {
        return undefined;
    }
}
const root = linkedRoot();

const config: NextConfig = {
    allowedDevOrigins: ['192.168.*.*', '10.*.*.*'],
    ...(root && { turbopack: { root }, outputFileTracingRoot: root }),
};

export default config;
