// WCAG contrast of every text role on the score card (against the win card) and on the account
// section and sign-in form (against the Settings card), and of the countdown bar against its
// track (3:1, non-text), for each palette x theme x mode. Exits 1 on any failure.
//   node tools/levels-review/levels-contrast.mjs
import { chromium } from '@playwright/test';
import { serve } from '../sims/site.mjs';

const THEMES = ['phosphor', 'broadsheet', 'sticker', 'drafting', 'grove', 'plum', 'graphite'];
const PALETTES = ['classic', 'jewel', 'duotone', 'calm'];
const site = await serve();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
await page.goto(site.url + '/?subject=sports/golf');
await page.waitForSelector('.cell');
// Mounted twice, so each sign's colours are read from a real card.
await page.evaluate(async () => {
  const { playBreakdown } = await import('/src/scorecard.js');
  const card = document.getElementById('wincard');
  for (const sign of [1, -1]) {
    const host = document.createElement('div');
    host.id = sign > 0 ? 'sc-pos' : 'sc-neg';
    card.append(host);
    playBreakdown(host, { lines: [{ key: 'words', label: 'Words', detail: '3 words', points: 90 * sign }], total: 90 * sign, complete: true,
      stats: { found: 3, revealed: 0, elapsedMs: 0, parMs: 0, bestStreak: 1 } }, { countdownMs: 60000, onNext() {}, onStay() {} });
    // Text colour only depends on the classes, so the finished card can be forced without waiting.
    host.querySelector('.sc')?.classList.add('sc-done');
  }
  document.getElementById('win').style.display = 'flex';
  const acct = await import('/src/account.js');
  const settings = document.getElementById('settings');
  if (settings) settings.style.display = 'flex';
  const body = document.getElementById('settings-body');
  const status = { signedIn: true, username: 'ana', level: 3, points: 90, pending: false, error: null };
  const play = { status: () => status, signIn: async () => ({ uid: '', username: '' }), signUp: async () => ({ uid: '', username: '' }), signOut() {} };
  for (const id of ['acct-section', 'acct-page']) {
    const host = document.createElement('section');
    host.id = id;
    host.className = 'panegroup';
    body?.prepend(host);
  }
  acct.renderAccount(/** @type {HTMLElement} */ (document.getElementById('acct-section')), play, { onSignIn() {}, onSignOut() {} });
  acct.renderSignIn(/** @type {HTMLElement} */ (document.getElementById('acct-page')), play, { onDone() {} });
  const err = /** @type {HTMLElement} */ (document.querySelector('.acct-err'));
  err.hidden = false;
  err.textContent = 'Wrong username or password.';
});

let failed = 0;
for (const palette of PALETTES) for (const mode of ['dark', 'light']) for (const theme of THEMES) {
  const r = await page.evaluate(([palette, mode, theme]) => {
    Object.assign(document.documentElement.dataset, { palette, appearance: mode, theme });
    const rgb = (s) => (s.match(/[\d.]+/g) || []).map(Number).slice(0, 3);
    const L = (c) => { const [r, g, b] = c.map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
    const cr = (a, b) => { const x = L(rgb(a)), y = L(rgb(b)); return +((Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)).toFixed(2); };
    const cs = (s) => getComputedStyle(/** @type {Element} */ (document.querySelector(s)));
    const card = cs('#wincard').backgroundColor;
    const text = {
      label: cr(cs('#sc-pos .sc-label').color, card), detail: cr(cs('#sc-pos .sc-detail').color, card),
      points: cr(cs('#sc-pos .sc-pts').color, card), total: cr(cs('#sc-pos .sc-total .sc-label').color, card),
      count: cr(cs('#sc-pos .sc-count').color, card), stay: cr(cs('#sc-pos .sc-stay').color, card),
      next: cr(cs('#sc-pos .sc-go').color, cs('#sc-pos .sc-go').backgroundColor),
    };
    const pane = cs('#settingscard').backgroundColor;
    Object.assign(text, {
      acctName: cr(cs('#acct-section .acct-name').color, pane), acctLine: cr(cs('#acct-section .acct-line').color, pane),
      fieldLabel: cr(cs('#acct-page .panelabel').color, pane), note: cr(cs('#acct-page .panenote').color, pane),
      input: cr(cs('#acct-page input').color, cs('#acct-page input').backgroundColor),
      error: cr(cs('#acct-page .acct-err').color, cs('#acct-page .acct-err').backgroundColor),
      submit: cr(cs('#acct-page .acct-submit').color, cs('#acct-page .acct-submit').backgroundColor),
      toggle: cr(cs('#acct-page .acct-toggle').color, pane),
    });
    const track = cs('#sc-pos .sc-bar').backgroundColor;
    const bar = { pos: cr(cs('#sc-pos .sc-bar i').backgroundColor, track), neg: cr(cs('#sc-neg .sc-bar i').backgroundColor, track) };
    const bad = [...Object.entries(text).filter(([, v]) => v < 4.5), ...Object.entries(bar).filter(([, v]) => v < 3)].map(([k]) => k);
    return { palette, mode, theme, text, bar, bad };
  }, [palette, mode, theme]);
  console.log(JSON.stringify(r));
  failed += r.bad.length;
}
await browser.close();
site.close();
console.log(failed ? `FAIL: ${failed} pairs under AA` : 'PASS: every pair meets AA');
if (failed) process.exitCode = 1;
