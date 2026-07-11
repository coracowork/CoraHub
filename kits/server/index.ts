/**
 * Local Hub index server for development and testing.
 *
 * Serves the dist/ directory so CoraCowork can fetch index.json and extension zips
 * from localhost instead of GitHub CDN.
 *
 * Usage:
 *   bun run kits/serve.ts                  # default port 3456
 *   bun run kits/serve.ts --port 8080      # custom port
 *
 * Then start CoraCowork with:
 *   CORA_COWORK_HUB_URL=http://localhost:3456/ bun run start
 */

import path from 'node:path';

const DEFAULT_PORT = 3456;

function parsePort(): number {
  const idx = process.argv.indexOf('--port');
  if (idx !== -1 && process.argv[idx + 1]) {
    const port = Number(process.argv[idx + 1]);
    if (Number.isFinite(port) && port > 0) return port;
  }
  return DEFAULT_PORT;
}

const port = parsePort();
const distDir = path.resolve(import.meta.dir, '..', '..', 'dist');

const server = Bun.serve({
  port,
  async fetch(req) {
    const url = new URL(req.url);
    console.log(`${req.method} ${url.pathname}`);
    const filePath = path.join(distDir, url.pathname);

    // Prevent directory traversal
    if (!filePath.startsWith(distDir)) {
      return new Response('Forbidden', { status: 403 });
    }

    const file = Bun.file(filePath);
    if (await file.exists()) {
      return new Response(file);
    }

    return new Response('Not Found', { status: 404 });
  },
});

console.log(`Hub dev server running at http://localhost:${server.port}/`);
console.log(`Serving: ${distDir}`);
console.log(`\nStart CoraCowork with:\n  CORA_COWORK_HUB_URL=http://localhost:${server.port}/ bun run start`);
