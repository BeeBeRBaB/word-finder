// Torn-deploy sim: a visitor installs the service worker on OLD, NEW deploys to the same
// origin, and the visitor comes back six times. Each visit says which build every file it
// loaded came from; MIXED (old and new files in one page) is a tear. Runs NEW as-is and with
// CACHE flipped (forced to OLD's name when NEW bumped it, bumped when it did not).
//   node tools/sims/sw/tear.mjs [old=origin/main] [new=WORKTREE]
//   node tools/sims/sw/tear.mjs 52a5fdb 83f29bc          a historical deploy (v14 -> v15)
// Exits 1 if any as-is visit after the deploy is mixed, errors, or renders no board.
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { serve, checkout } from '../site.mjs';

const [oldRef = 'origin/main', newRef = 'WORKTREE'] = process.argv.slice(2);
const oldDir = checkout(oldRef), newDir = checkout(newRef);
const cacheOf = (dir) => fs.readFileSync(path.join(dir, 'sw.js'), 'utf8').match(/const CACHE\s*=\s*'([^']+)'/)?.[1];
const oldCache = cacheOf(oldDir), newCache = cacheOf(newDir);
console.log(`old ${oldRef} CACHE=${oldCache}   new ${newRef} CACHE=${newCache}`);

let root = oldDir, forceCache = /** @type {string | null} */ (null);
// GitHub Pages sends max-age=600; sw.js re-issues code requests with no-cache to beat it.
const site = await serve(() => root, {
  cacheControl: 'max-age=600',
  rewrite: (p, body) => p === '/sw.js' && forceCache && root === newDir
    ? body.toString().replace(/(const CACHE\s*=\s*')[^']+'/, `$1${forceCache}'`) : body,
});
const browser = await chromium.launch();

async function run(label, cache) {
  root = oldDir; forceCache = cache;
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage(); const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  const own = (u) => u.startsWith(site.url);              // fonts are cross-origin; offline is not a tear
  page.on('requestfailed', (r) => { if (own(r.url())) errs.push('failed ' + new URL(r.url()).pathname); });
  page.on('response', (r) => { if (own(r.url()) && r.status() >= 400) errs.push(r.status() + ' ' + new URL(r.url()).pathname); });
  // Which build served each same-origin file: compared byte for byte with both trees.
  const from = new Map();
  page.on('response', async (r) => {
    if (!own(r.url()) || !r.ok()) return;
    let p = new URL(r.url()).pathname; if (p.endsWith('/')) p += 'index.html';
    if (p === '/sw.js') return;
    const body = await r.body().catch(() => null); if (!body) return;
    const read = (d) => { try { return fs.readFileSync(path.join(d, p)); } catch { return null; } };
    const o = read(oldDir), n = read(newDir);
    if (o && n && o.equals(n)) return;                    // unchanged by the deploy
    from.set(p, o && body.equals(o) ? 'old' : n && body.equals(n) ? 'new' : 'neither');
  });
  let torn = false, firstNew = '', differs = false;
  const visit = async (u, tag, wait = 1500) => {
    errs.length = 0; from.clear(); await page.goto(site.url + u); await page.waitForTimeout(wait);
    const s = await page.evaluate(async () => {
      const keys = (await caches.keys()).filter((k) => k.startsWith('wordfinder-v'));
      document.getElementById('appearance')?.click();
      await new Promise((r) => setTimeout(r, 300));
      const pane = document.getElementById('settings');
      return { cells: document.querySelectorAll('.cell').length, settingsOpens: !!pane && getComputedStyle(pane).display !== 'none', caches: keys };
    });
    const kinds = new Set(from.values());
    const build = kinds.size === 0 ? 'same' : kinds.size === 1 ? [...kinds][0] : 'MIXED';
    const files = build === 'MIXED' || kinds.has('neither') ? Object.fromEntries(from) : undefined;
    const bad = build === 'MIXED' || kinds.has('neither') || errs.length > 0 || !s.cells;
    if (bad && tag.startsWith('after')) torn = true;
    if (build === 'new' && !firstNew) firstNew = tag;
    if (kinds.size) differs = true;
    console.log(`${label.padEnd(13)} ${tag.padEnd(14)} ${bad ? 'TORN' : 'ok  '} build=${build.padEnd(5)} ${JSON.stringify({ ...s, errors: errs.slice(), files })}`);
  };
  await page.goto(site.url + '/'); await page.waitForSelector('.cell');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await visit('/?subject=sports/golf', 'before-deploy');   // a shared link, on the OLD build
  await visit('/', 'before-deploy');
  root = newDir;                                         // the deploy lands
  for (let i = 1; i <= 4; i++) await visit('/', 'after-' + i, i === 1 ? 3000 : 1500);
  for (let i = 5; i <= 6; i++) await visit('/?subject=sports/golf', 'after-' + i); // the shared link again
  await ctx.close();
  console.log(`${label.padEnd(13)} => ${torn ? 'TORN' : 'clean'}, ${!differs ? 'no served file differs' : firstNew ? 'new build from ' + firstNew : 'never reached the new build'}\n`);
  return torn;
}

const asIsTorn = await run('as-is', null);
const flipped = newCache !== oldCache ? oldCache : newCache + '-sim';
await run(newCache !== oldCache ? 'without-bump' : 'with-bump', flipped);
await browser.close(); site.close();
for (const d of [oldDir, newDir]) if (d !== checkout('WORKTREE')) fs.rmSync(d, { recursive: true, force: true });
if (asIsTorn) process.exitCode = 1;
