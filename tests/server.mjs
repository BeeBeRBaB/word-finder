// Static file server for the Playwright suite. Zero dependencies on purpose:
// the app itself has none, and `npx serve` would need a network fetch.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PORT = Number(process.env.PORT || 5173);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
};

// How many times each path was actually served from this process. A request that
// the service worker answered from its cache never arrives here — which is exactly
// what the cache-first assertions in Task 4 measure.
const hits = Object.create(null);
let probeCounter = 0;

createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  let path = decodeURIComponent(url.pathname);
  hits[path] = (hits[path] || 0) + 1;

  if (path === '/__stats') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    return res.end(JSON.stringify(hits));
  }
  if (path === '/__reset') {
    for (const k of Object.keys(hits)) delete hits[k];
    probeCounter = 0;
    res.writeHead(200, { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' });
    return res.end('ok');
  }
  // Body changes on every origin hit, so a stale cached copy is distinguishable
  // from a revalidated one. Cache-Control mirrors GitHub Pages' max-age=600.
  if (path === '/__probe.js') {
    probeCounter += 1;
    res.writeHead(200, { 'Content-Type': MIME['.js'], 'Cache-Control': 'max-age=600' });
    return res.end(`export const probe = ${probeCounter};\n`);
  }

  if (path.endsWith('/')) path += 'index.html';
  const safe = normalize(path).replace(/^(\.\.[/\\])+/, '');
  try {
    const body = await readFile(join(ROOT, safe));
    res.writeHead(200, {
      'Content-Type': MIME[extname(safe)] || 'application/octet-stream',
      'Cache-Control': 'max-age=600',
    });
    res.end(body);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('404');
  }
}).listen(PORT, () => console.log(`serving ${ROOT} on http://localhost:${PORT}`));
