#!/usr/bin/env node
// Renders the app at every screen shape in tests/e2e/devices.js and writes a PNG per
// shape, so "how does this look in landscape?" is one command instead of a throwaway
// Playwright script. Starts and stops its own static server, so nothing has to be
// running first.
//
// Dev tool only. Playwright is already a devDependency; this adds nothing to
// package.json and nothing under src/ imports it.
//
// Usage:
//   npm run shots                      Every shape.
//   npm run shots -- landscape         Only shapes whose name matches (case-insensitive).
//   npm run shots -- --subject=sports/golf
//   npm run shots -- --dark            Render the dark palette instead of light.
//   npm run shots -- --measure         Also print grid/list geometry per shape.
//
// The default subject is pinned so runs are comparable: the same board every time,
// and a deliberately LONG name, because a short one hides header-wrapping bugs (the
// suite pins nature/birds and missed exactly that).

import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { DEVICES } from '../tests/e2e/devices.js';

const OUT = new URL('../.shots/', import.meta.url);
const PORT = 5273;                       // not 5173: never fight a dev server already up
const DEFAULT_SUBJECT = 'history/industrial-revolution';

const args = process.argv.slice(2);
const flag = (name) => args.some((a) => a === `--${name}`);
const opt = (name, fallback) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};
const filters = args.filter((a) => !a.startsWith('--')).map((a) => a.toLowerCase());
const shapes = filters.length
  ? DEVICES.filter((d) => filters.some((f) => d.name.toLowerCase().includes(f)))
  : DEVICES;

if (!shapes.length) {
  console.error(`No shape matches ${filters.join(', ')}. Known shapes:`);
  for (const d of DEVICES) console.error(`  ${d.name}`);
  process.exit(1);
}

const server = spawn(process.execPath, [new URL('../tests/server.mjs', import.meta.url).pathname], {
  env: { ...process.env, PORT: String(PORT) },
  stdio: 'ignore',
});
// Poll rather than sleep a fixed time: the server is ready when it answers, and on a
// cold start that is sooner than any sleep long enough to be safe.
const base = `http://localhost:${PORT}`;
for (let i = 0; i < 100; i++) {
  try { await fetch(`${base}/index.html`); break; } catch { await new Promise((r) => setTimeout(r, 50)); }
}

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const subject = opt('subject', DEFAULT_SUBJECT);
const url = `${base}/index.html?seed=1&subject=${subject}`;
const browser = await chromium.launch();

for (const d of shapes) {
  const ctx = await browser.newContext({ viewport: { width: d.w, height: d.h } });
  const page = await ctx.newPage();
  // Set the stored preference before any script runs — index.html's inline resolver
  // reads it before first paint, so setting it after load would render the wrong
  // palette first and repaint.
  if (flag('dark')) await page.addInitScript(() => localStorage.setItem('wordfinder-appearance', 'dark'));
  await page.goto(url);
  await page.waitForSelector('#letters .cell');
  const file = new URL(`${d.name.replace(/\s+/g, '-').toLowerCase()}.png`, OUT);
  await page.screenshot({ path: file.pathname });

  let note = '';
  if (flag('measure')) {
    const m = await page.evaluate(() => {
      const box = (sel) => document.querySelector(sel)?.getBoundingClientRect();
      const g = box('#gridbox'), l = box('#list');
      const off = [...document.querySelectorAll('.cell')].filter((c) => {
        const b = c.getBoundingClientRect();
        return b.left < -0.5 || b.right > innerWidth + 0.5 || b.top < -0.5 || b.bottom > innerHeight + 0.5;
      }).length;
      const words = [...document.querySelectorAll('.w')].filter((e) => e.getBoundingClientRect().bottom > innerHeight + 0.5).length;
      return { cell: Math.round(box('.cell').width), grid: Math.round(g.width), list: Math.round(l.width), off, words };
    });
    note = `  cell=${m.cell}px grid=${m.grid} list=${m.list} ratio=1:${(m.list / m.grid).toFixed(2)}`
      + `${m.off ? `  ** ${m.off} CELLS OFF-SCREEN **` : ''}${m.words ? `  ** ${m.words} WORDS BELOW FOLD **` : ''}`;
  }
  console.log(`${d.name.padEnd(26)} ${String(d.w).padStart(4)}x${String(d.h).padEnd(4)}${note}`);
  await ctx.close();
}

await browser.close();
server.kill();
console.log(`\n${shapes.length} shot(s) -> ${OUT.pathname}`);
