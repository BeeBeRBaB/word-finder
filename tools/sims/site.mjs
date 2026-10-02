// Shared by the browser sims: a static server on a free port, and a git ref exported to a
// temp dir so a sim can compare two builds. SITE=<dir> serves another checkout instead.
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const REPO = fileURLToPath(new URL('../../', import.meta.url));

const TYPES = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.png': 'image/png', '.json': 'application/json', '.webmanifest': 'application/manifest+json',
};

/**
 * Serve `root` (a dir, or a function returning one per request so a sim can swap builds
 * mid-run). `rewrite(urlPath, body)` may alter a file on the way out.
 * @param {string | (() => string)} [root]
 * @param {{port?: number, cacheControl?: string, rewrite?: (p: string, b: Buffer) => Buffer | string}} [opts]
 */
export async function serve(root = process.env.SITE || REPO, { port = 0, cacheControl = 'no-store', rewrite } = {}) {
  const srv = http.createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname);
    if (p.endsWith('/')) p += 'index.html';
    const dir = typeof root === 'function' ? root() : root;
    const f = path.join(dir, path.normalize(p).replace(/^(\.\.[/\\])+/, ''));
    fs.readFile(f, (e, d) => {
      if (e) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream', 'cache-control': cacheControl });
      res.end(rewrite ? rewrite(p, d) : d);
    });
  });
  await new Promise((r) => srv.listen(port, () => r(undefined)));
  const addr = /** @type {import('node:net').AddressInfo} */ (srv.address());
  return { url: `http://localhost:${addr.port}`, close: () => srv.close() };
}

/** Export a git ref's tree to a temp dir; WORKTREE returns the repo itself. */
export function checkout(ref) {
  if (ref === 'WORKTREE') return REPO;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wf-' + ref.replace(/[^\w.-]/g, '_') + '-'));
  const tar = execFileSync('git', ['-C', REPO, 'archive', ref], { maxBuffer: 1 << 28 });
  execFileSync('tar', ['-x', '-C', dir], { input: tar });
  return dir;
}
