#!/usr/bin/env node
// Retakes the README screenshots in docs/screenshots/ from the live site, each in a fresh
// context with the service worker blocked, so they show the deployed build and not a cache.
//
// Usage: node tools/readme-shots.mjs [base-url]   (default: the GitHub Pages site)

import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { findRunsInGrid, dragCells } from '../tests/e2e/helpers.js';

const BASE = (process.argv[2] ?? 'https://beeberbab.github.io/word-finder/').replace(/\/?$/, '/');
const OUT = new URL('../docs/screenshots/', import.meta.url);
mkdirSync(OUT, { recursive: true });

/** @typedef {{file:string, w:number, h:number, theme:string, look:string, subject:string,
 *   found:number, open?:'theme'|'bg'}} Shot */
/** @type {Shot[]} */
const SHOTS = [
  { file: 'laptop.jpg', w: 1440, h: 900, theme: 'phosphor', look: 'dark', subject: 'space/rockets', found: 5 },
  { file: 'iphone.jpg', w: 430, h: 752, theme: 'grove', look: 'light', subject: 'animals/penguins', found: 3 },
  { file: 'iphone-won.jpg', w: 430, h: 752, theme: 'sticker', look: 'light', subject: 'food/desserts', found: 99 },
  { file: 'iphone-themes.jpg', w: 430, h: 752, theme: 'plum', look: 'dark', subject: 'music/guitars', found: 0, open: 'theme' },
  { file: 'ipad.jpg', w: 1133, h: 664, theme: 'broadsheet', look: 'light', subject: 'history/vikings', found: 4 },
];

const browser = await chromium.launch();
for (const s of SHOTS) {
  const phone = s.w < 600;
  const ctx = await browser.newContext({
    viewport: { width: s.w, height: s.h }, deviceScaleFactor: phone ? 2 : 1, serviceWorkers: 'block',
    isMobile: phone, hasTouch: phone,
  });
  await ctx.addInitScript(([theme, look]) => {
    localStorage.setItem('wordfinder-theme', theme);
    localStorage.setItem('wordfinder-appearance', look);
  }, [s.theme, s.look]);
  const page = await ctx.newPage();
  await page.goto(`${BASE}?seed=7&subject=${s.subject}`);
  await page.locator('.cell').first().waitFor();
  await page.evaluate(() => document.fonts.ready);

  const words = (await page.locator('.w').allTextContents()).map((w) => w.trim().toUpperCase());
  for (const word of words.slice(0, s.found)) {
    for (const run of await findRunsInGrid(page, word)) {
      await dragCells(page, run);
      const done = await page.locator('.w.done, .w.glow').allTextContents();
      if (done.some((t) => t.trim().toUpperCase() === word)) break;
    }
  }
  if (s.found >= words.length) {
    await page.locator('#win').waitFor({ state: 'visible' });
    await page.locator('#winstay').click().catch(() => {});
  }
  if (s.open) {
    await page.locator('#appearance').click();
    await page.locator(s.open === 'theme' ? '#settings-theme' : '#settings-bg').click();
  }
  await page.waitForTimeout(1500);
  await page.screenshot({ path: new URL(s.file, OUT).pathname, type: 'jpeg', quality: 80 });
  console.log(`${s.file}  ${s.w}x${s.h}  ${s.theme} ${s.look}  ${s.subject}`);
  await ctx.close();
}
await browser.close();
