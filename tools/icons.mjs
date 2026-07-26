#!/usr/bin/env node
// Renders icon-192.png and icon-512.png from one SVG so the app icon can follow the
// palette instead of drifting from it — the previous pair were un-regenerable binaries
// still wearing the pre-amber teal. Dev tool only: nothing under src/ imports it, and it
// adds no dependency (Playwright is already here for the e2e suite).
//
//   npm run icons            Write both PNGs.
//   npm run icons -- --check Fail if the committed PNGs differ from a fresh render.
//
// Colours are read from styles.css at run time, so a palette edit repaints the icon and
// `--check` is what notices if one happens without a re-render.

import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const ROOT = new URL('../', import.meta.url);
const css = readFileSync(new URL('styles.css', ROOT), 'utf8');

/** Pull a token out of the dark palette, which is what the icon is drawn against.
 * @param {string} name @returns {string} */
function token(name) {
  const block = css.slice(css.indexOf(':root, :root[data-appearance="dark"]'));
  const m = block.slice(0, block.indexOf('}')).match(new RegExp(`${name}\\s*:\\s*([^;]+);`));
  if (!m) throw new Error(`no ${name} in the dark palette`);
  return m[1].trim();
}

const BG = token('--bg'), SURFACE = token('--surface'), BORDER = token('--border');
const TEXT = token('--text'), ACCENT = token('--accent'), INK = token('--accent-ink');

// 3x3, not the old 4x4: sixteen letters at 192px were ~20px each and read as noise at the
// ~60px a home screen actually draws. Three rows carry the same "it's a word grid" idea
// with letters more than twice the size. The diagonal spells WIN — the game's payoff, and
// the one word the pill is shown finding.
const ROWS = ['WRD', 'AIE', 'STN'];

// Full bleed, and the manifest asks for `any` rather than `any maskable`. The old pair
// claimed maskable while putting the grid corners ~52% from centre, outside the 40% safe
// radius, so Android was already clipping them. Honouring that claim means padding the
// art into the middle 57%, which iOS then renders at face value through apple-touch-icon
// — a visibly small icon next to its neighbours. iOS is this app's main home screen, so
// the art fills the square and iOS applies its own rounding. 12% margins keep the grid
// clear of that corner radius.
const S = 512, GRID = 384, G0 = (S - GRID) / 2, CELL = GRID / 3;

/** Centre of a cell. @param {number} i @returns {number} */
const mid = (i) => G0 + (i + 0.5) * CELL;
const THICK = Math.round(CELL * 0.82);
const A = mid(0), B = mid(2);
const LEN = Math.hypot(B - A, B - A) + THICK;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">
  <defs>
    <radialGradient id="glow">
      <stop offset="0" stop-color="${ACCENT}" stop-opacity=".26"/>
      <stop offset="1" stop-color="${ACCENT}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <defs>
    <radialGradient id="plate">
      <stop offset="0" stop-color="${SURFACE}"/>
      <stop offset="1" stop-color="${BG}"/>
    </radialGradient>
  </defs>
  <rect width="${S}" height="${S}" fill="url(#plate)"/>
  <circle cx="${S / 2}" cy="${S / 2}" r="205" fill="url(#glow)"/>
  ${[1, 2].map(i => `<line x1="${G0 + i * CELL}" y1="${G0}" x2="${G0 + i * CELL}" y2="${G0 + GRID}" stroke="${BORDER}" stroke-width="5"/>
  <line x1="${G0}" y1="${G0 + i * CELL}" x2="${G0 + GRID}" y2="${G0 + i * CELL}" stroke="${BORDER}" stroke-width="5"/>`).join('\n  ')}
  <g transform="rotate(45 ${A} ${A})">
    <rect x="${A - THICK / 2}" y="${A - THICK / 2}" width="${LEN}" height="${THICK}" rx="${THICK / 2}" fill="${ACCENT}"/>
  </g>
  ${ROWS.flatMap((row, y) => [...row].map((ch, x) =>
    `<text x="${mid(x)}" y="${mid(y)}" fill="${x === y ? INK : TEXT}" font-size="74" font-weight="700"
        font-family="Atkinson Hyperlegible, sans-serif" text-anchor="middle" dominant-baseline="central">${ch}</text>`
  )).join('\n  ')}
</svg>`;

const page = await (await chromium.launch()).newPage({ viewport: { width: S, height: S } });
await page.setContent(`<!doctype html><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:wght@700&display=block" rel="stylesheet">
<style>html,body{margin:0;background:${BG}}svg{display:block}</style>${svg}`, { waitUntil: 'networkidle' });
// The face has to be resident before the shot, or the letters bake in a fallback and the
// icon quietly stops matching the grid it depicts.
await page.evaluate(() => document.fonts.load('700 74px "Atkinson Hyperlegible"').then(() => document.fonts.ready));

const check = process.argv.includes('--check');
let changed = 0;
for (const size of [192, 512]) {
  await page.setViewportSize({ width: size, height: size });
  await page.evaluate((s) => {
    const el = document.querySelector('svg');
    if (el) { el.setAttribute('width', String(s)); el.setAttribute('height', String(s)); }
  }, size);
  const shot = await page.screenshot({ omitBackground: false });
  const file = new URL(`icon-${size}.png`, ROOT);
  const sum = (/** @type {Buffer} */ b) => createHash('sha256').update(b).digest('hex').slice(0, 12);
  const before = readFileSync(file);
  if (check) {
    const same = sum(before) === sum(shot);
    console.log(`icon-${size}.png ${same ? 'matches' : 'DIFFERS FROM'} a fresh render`);
    if (!same) changed++;
  } else {
    writeFileSync(file, shot);
    console.log(`icon-${size}.png  ${(shot.length / 1024).toFixed(1)}KB  ${sum(before)} -> ${sum(shot)}`);
  }
}
await page.context().browser()?.close();
if (check && changed) {
  console.error(`\n${changed} icon(s) are stale — run \`npm run icons\` and commit the result.`);
  process.exit(1);
}
