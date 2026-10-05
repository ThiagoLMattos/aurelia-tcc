// Bundles the API into dist/server.mjs. @aurelia/shared is TypeScript source, so it is bundled in;
// every other dependency stays external and is installed in the image with `npm ci --omit=dev`.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { build } from 'esbuild';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const external = Object.keys(pkg.dependencies).filter((name) => name !== '@aurelia/shared');

await build({
  entryPoints: [fileURLToPath(new URL('../src/server.ts', import.meta.url))],
  outfile: fileURLToPath(new URL('../dist/server.mjs', import.meta.url)),
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  sourcemap: true,
  external,
  logLevel: 'info',
});
