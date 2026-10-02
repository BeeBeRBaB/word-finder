// Does sw.js cache a cross-origin, Bearer-authenticated GET (the shape of cloud.load())?
// FAIL until the "must fix before accounts ship" sw.js change lands; PASS after it.
//   node tools/levels-review/sw-cloud-probe.mjs        (APP_PORT / API_PORT move the two servers)
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const REPO = fileURLToPath(new URL('../../', import.meta.url));
const APP = Number(process.env.APP_PORT || 5197), API = Number(process.env.API_PORT || 5198);
let apiHits = 0;
const api = createServer((req, res) => {
  const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Access-Control-Allow-Methods': 'GET, PATCH' };
  if (req.method === 'OPTIONS') { res.writeHead(204, cors); return res.end(); }
  apiHits++;
  res.writeHead(200, { ...cors, 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ fields: { data: { stringValue: JSON.stringify({ n: apiHits, auth: req.headers.authorization }) } } }));
}).listen(API);
const app = spawn(process.execPath, ['tests/server.mjs'], { cwd: REPO, env: { ...process.env, PORT: String(APP) }, stdio: 'ignore' });
for (let i = 0; i < 100; i++) {
  try { await fetch(`http://localhost:${APP}/index.html`); break; } catch { await new Promise((r) => setTimeout(r, 50)); }
}
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.goto(`http://localhost:${APP}/?subject=sports/golf`);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  const controlled = await page.evaluate(() => !!navigator.serviceWorker.controller);
  const url = `http://localhost:${API}/v1/projects/p/databases/(default)/documents/users/u1`;
  const get = (token) => page.evaluate(async ([u, t]) => {
    const r = await fetch(u, { method: 'GET', headers: { Authorization: `Bearer ${t}` } });
    return JSON.parse((await r.json()).fields.data.stringValue);
  }, [url, token]);
  const a = await get('alice-1');
  const b = await get('alice-2');
  const c = await get('someone-else');
  console.log(JSON.stringify({ controlled, a, b, c, apiHits }));
  const cached = await page.evaluate(async () => {
    const out = [];
    for (const k of await caches.keys()) for (const r of await (await caches.open(k)).keys()) if (r.url.includes('/users/')) out.push(`${k}: ${r.url}`);
    return out;
  });
  console.log('cache entries for /users/:', cached);
  const pass = controlled && apiHits === 3 && cached.length === 0;
  console.log(pass ? 'PASS: every authenticated GET reached the network, nothing cached'
    : !controlled ? 'FAIL: the page was never controlled by the service worker, so this proves nothing'
      : 'FAIL: sw.js answered an authenticated cross-origin GET from its cache');
  process.exitCode = pass ? 0 : 1;
} finally {
  await browser.close(); app.kill(); api.close();
}
