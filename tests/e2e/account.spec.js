import { test, expect } from '@playwright/test';
import { openBoard } from './helpers.js';

/** @typedef {import('@playwright/test').Page} Page */

// account.js on its own: each test mounts it in a host inside the open Settings card, in place of
// the game's own Account section, against a stand-in for levelplay.js that records what it was asked.
test.use({ serviceWorkers: 'block' });

/** @param {Page} page @param {object} status @param {string} what 'account' or 'signin' */
async function mount(page, status, what) {
  await page.goto('/?seed=1&subject=nature/birds');
  await page.click('#appearance');
  await page.evaluate(async ({ status, what }) => {
    const url = '/src/account.js';
    const m = await import(url);
    const w = /** @type {any} */ (window);
    w.calls = [];
    /** @type {any} */
    let s = status;
    w.next = null;   // the error the next sign-in throws, or null to succeed
    w.gate = null;   // a promise the next sign-in waits on
    const attempt = (/** @type {string} */ kind) => async (/** @type {string} */ u, /** @type {string} */ p) => {
      w.calls.push([kind, u, p]);
      if (w.gate) await w.gate;
      if (w.next) { const e = Object.assign(new Error(w.next.message), { code: w.next.code }); throw e; }
      return { uid: 'uid-1', username: u };
    };
    const play = {
      status: () => s,
      signIn: attempt('signIn'), signUp: attempt('signUp'),
      signOut: () => { w.calls.push(['signOut']); s = { ...s, signedIn: false }; },
    };
    const host = document.createElement('section');
    host.id = 'acct-host';
    host.className = 'panegroup';
    document.getElementById('settings-account')?.remove();
    document.getElementById('settings-body')?.prepend(host);
    // Drawn again, as a sync landing does, optionally with a new status.
    w.redraw = (/** @type {any} */ next) => {
      if (next) s = next;
      m.renderAccount(host, play, { onSignIn: () => w.calls.push(['onSignIn']), onSignOut: () => w.calls.push(['onSignOut']) });
    };
    if (what === 'account') w.redraw();
    else m.renderSignIn(host, play, { onDone: (/** @type {any} */ a) => w.calls.push(['onDone', a.username]) });
  }, { status, what });
}

/** @param {Page} page */
const calls = (page) => page.evaluate(() => /** @type {any} */ (window).calls);
const OUT = { signedIn: false, username: null, level: 0, points: 0, pending: false, error: null };
const IN = { signedIn: true, username: 'ana_reads', level: 12, points: 4210, pending: false, error: null };

test('signed out, the Account section offers Sign in', async ({ page }) => {
  await mount(page, OUT, 'account');
  const host = page.locator('#acct-host');
  await expect(host.getByRole('heading', { name: 'Account' })).toBeVisible();
  await expect(host).toContainText('Numbered puzzles that keep your points on any device.');
  await host.getByRole('button', { name: 'Sign in' }).click();
  expect(await calls(page)).toEqual([['onSignIn']]);
});

test('signed in, it names the account and where it stands, and signs out', async ({ page }) => {
  await mount(page, IN, 'account');
  const host = page.locator('#acct-host');
  await expect(host).toContainText('ana_reads');
  await expect(host).toContainText('Level 12 · 4,210 points · saved');
  await host.getByRole('button', { name: 'Sign out' }).click();
  expect(await calls(page)).toEqual([['signOut'], ['onSignOut']]);
});

test('a 20-character username is cut short rather than running under Sign out', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await mount(page, { ...IN, username: 'mmmmmmmmmmmmmmmmmmmm', pending: true }, 'account');
  await page.locator('#acct-host').getByRole('button', { name: 'Sign out' }).click();   // the wider "Sign out anyway"
  // Text overflowing its box does not move the box, so clipping is what keeps it off the button.
  const m = await page.evaluate(() => {
    const name = /** @type {HTMLElement} */ (document.querySelector('.acct-name'));
    const btn = /** @type {HTMLElement} */ (document.querySelector('.acct-seg button'));
    return { right: name.getBoundingClientRect().right, left: btn.getBoundingClientRect().left, btnRight: btn.getBoundingClientRect().right,
      contained: name.scrollWidth <= name.clientWidth || getComputedStyle(name).overflowX === 'hidden' };
  });
  expect(m.right).toBeLessThanOrEqual(m.left);
  expect(m.contained).toBe(true);
  expect(m.btnRight).toBeLessThanOrEqual(320);
});

test('signing out with progress not saved online asks once more', async ({ page }) => {
  await mount(page, { ...IN, pending: true, error: 'offline' }, 'account');
  const host = page.locator('#acct-host');
  await expect(host).toContainText('Level 12 · 4,210 points · offline, saved here');
  await host.getByRole('button', { name: 'Sign out' }).click();
  await expect(host).toContainText("Your latest progress isn't saved online yet.");
  expect(await calls(page)).toEqual([]);
  // A sync landing meanwhile redraws the section: the question stands, and its line moves on.
  await page.evaluate((st) => /** @type {any} */ (window).redraw(st), { ...IN, level: 13, pending: true, error: 'offline' });
  await expect(host.locator('.acct-line')).toHaveText('Level 13 · 4,210 points · offline, saved here');
  await expect(host.getByRole('alert')).toHaveText("Your latest progress isn't saved online yet. Signing out here loses it.");
  await host.getByRole('button', { name: 'Sign out anyway' }).click();
  expect(await calls(page)).toEqual([['signOut'], ['onSignOut']]);
});

test('once the progress is saved, a redraw drops the warning and Sign out signs out', async ({ page }) => {
  await mount(page, { ...IN, pending: true, error: 'offline' }, 'account');
  const host = page.locator('#acct-host');
  await host.getByRole('button', { name: 'Sign out' }).click();
  await page.evaluate((st) => /** @type {any} */ (window).redraw(st), IN);
  await expect(host.getByRole('alert')).toBeHidden();
  await host.getByRole('button', { name: 'Sign out', exact: true }).click();
  expect(await calls(page)).toEqual([['signOut'], ['onSignOut']]);
});

test('the form signs in with what was typed, and Enter submits it', async ({ page }) => {
  await mount(page, OUT, 'signin');
  await page.getByLabel('Username').fill('Ana_Reads');
  await page.getByLabel('Password').fill('hunter22');
  await page.getByLabel('Password').press('Enter');
  await expect.poll(() => calls(page)).toEqual([['signIn', 'Ana_Reads', 'hunter22'], ['onDone', 'Ana_Reads']]);
  await expect(page.getByLabel('Password')).toHaveValue('');
  await expect(page.getByLabel('Password')).toHaveAttribute('autocomplete', 'current-password');
});

test('a refused attempt shows why, keeps the username, and focuses the field to fix', async ({ page }) => {
  await mount(page, OUT, 'signin');
  await page.evaluate(() => { /** @type {any} */ (window).next = { code: 'credentials', message: 'Wrong username or password.' }; });
  await page.getByLabel('Username').fill('ana');
  await page.getByLabel('Password').fill('nope12');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText('Wrong username or password.');
  await expect(page.getByLabel('Password')).toBeFocused();
  await expect(page.getByLabel('Username')).toHaveValue('ana');
  await page.evaluate(() => { /** @type {any} */ (window).next = { code: 'invalid', message: 'Usernames are 3–20 letters, numbers or underscores.' }; });
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText('Usernames are 3–20 letters, numbers or underscores.');
  await expect(page.getByLabel('Username')).toBeFocused();
});

test('Create an account switches the same form to sign-up', async ({ page }) => {
  await mount(page, OUT, 'signin');
  await page.getByRole('button', { name: 'Create an account' }).click();
  await expect(page.getByLabel('Password')).toHaveAttribute('autocomplete', 'new-password');
  await page.getByLabel('Username').fill('bo');
  await page.getByLabel('Password').fill('secret1');
  await page.evaluate(() => { /** @type {any} */ (window).next = { code: 'taken', message: 'That username is taken.' }; });
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText('That username is taken.');
  await expect(page.getByLabel('Username')).toBeFocused();
  // Switching back clears the message and offers Sign in again.
  await page.getByRole('button', { name: 'Sign in instead' }).click();
  await expect(page.getByRole('alert')).toBeHidden();
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
  expect((await calls(page)).map((/** @type {string[]} */ c) => c[0])).toEqual(['signUp']);
});

test('while an attempt is in flight the form is busy, and a second submit sends nothing', async ({ page }) => {
  await mount(page, OUT, 'signin');
  await page.evaluate(() => { const w = /** @type {any} */ (window); w.gate = new Promise(r => { w.release = r; }); });
  await page.getByLabel('Username').fill('ana');
  await page.getByLabel('Password').fill('hunter22');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.locator('.acct-form')).toHaveAttribute('aria-busy', 'true');
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeDisabled();
  await page.evaluate(() => document.querySelector('.acct-form')?.dispatchEvent(new Event('submit', { cancelable: true })));
  await page.evaluate(() => /** @type {any} */ (window).release());
  await expect.poll(() => calls(page)).toEqual([['signIn', 'ana', 'hunter22'], ['onDone', 'ana']]);
  await expect(page.locator('.acct-form')).toHaveAttribute('aria-busy', 'false');
});

test('every control is a 44px touch target, and the fields are 16px so iOS does not zoom', async ({ page }) => {
  await mount(page, OUT, 'signin');
  const sizes = await page.evaluate(() => [...document.querySelectorAll('#acct-host input, #acct-host button')].map(el => {
    const r = el.getBoundingClientRect();
    return { h: Math.round(r.height), w: Math.round(r.width), font: getComputedStyle(el).fontSize, tag: el.tagName };
  }));
  expect(sizes.length).toBe(4);
  for (const s of sizes) {
    expect(s.h).toBeGreaterThanOrEqual(44);
    expect(s.w).toBeGreaterThanOrEqual(44);
    if (s.tag === 'INPUT') expect(s.font).toBe('16px');
  }
  // The board's html,body rule turns both off; a field without them back cannot be typed in on iOS.
  for (const f of await page.evaluate(() => [...document.querySelectorAll('#acct-host input')].map(el => [getComputedStyle(el).touchAction, getComputedStyle(el).userSelect]))) {
    expect(f).toEqual(['manipulation', 'text']);
  }
});

/** Mount the Levels side of New game under the open dialog's heading.
 * @param {Page} page @param {object} status @param {object|null} progress */
async function mountChoice(page, status, progress) {
  await page.goto('/?seed=1&subject=nature/birds');
  await page.click('#catbtn');
  await page.evaluate(async ({ status, progress }) => {
    const url = '/src/account.js';
    const m = await import(url);
    const w = /** @type {any} */ (window);
    w.calls = [];
    const host = document.createElement('div');
    host.id = 'lv-host';
    document.querySelector('#pickercard h2')?.after(host);
    const play = { status: () => status, progress: () => progress };
    w.result = m.renderLevelChoice(host, play, { difficulty: 'easy', onSignIn: () => w.calls.push(['onSignIn']), onRetry: () => w.calls.push(['onRetry']) });
  }, { status, progress });
}

/** @param {Page} page */
const result = (page) => page.evaluate(() => /** @type {any} */ (window).result);
const PROGRESS = { seed: 7, level: 12, points: 4210, history: [], current: null };

test('New game shows the level to play next, at the difficulty setting', async ({ page }) => {
  await mountChoice(page, IN, PROGRESS);
  const host = page.locator('#lv-host');
  await expect(host.locator('.acct-lvl')).toHaveText('Level 12');
  await expect(host.locator('.acct-lvl-line')).toHaveText('4,210 points · Easy');
  expect(await result(page)).toEqual({ ready: true, start: 'Play level 12' });
  await expect(host.getByRole('button')).toHaveCount(0);
});

test('a level already started keeps its own difficulty, and one point is singular', async ({ page }) => {
  const current = { level: 3, subject: 'nature/birds', difficulty: 'hard', events: [], elapsedMs: 0 };
  await mountChoice(page, IN, { ...PROGRESS, level: 3, points: 1, current });
  await expect(page.locator('#lv-host .acct-lvl-line')).toHaveText('1 point · Hard');
  expect(await result(page)).toEqual({ ready: true, start: 'Play level 3' });
});

test('signed out, the Levels side offers Sign in and cannot start', async ({ page }) => {
  // Progress left over from a signed-out session must not be offered.
  await mountChoice(page, OUT, PROGRESS);
  const host = page.locator('#lv-host');
  await expect(host).toContainText('Numbered puzzles that keep your points on any device.');
  await expect(host.locator('.acct-lvl')).toHaveCount(0);
  expect(await result(page)).toEqual({ ready: false, start: 'Play level' });
  await host.getByRole('button', { name: 'Sign in' }).click();
  expect(await calls(page)).toEqual([['onSignIn']]);
});

test('signed in with no progress to deal from, it says so and offers to try again', async ({ page }) => {
  await mountChoice(page, IN, null);
  const host = page.locator('#lv-host');
  // An alert, so the line is read out again each time a Try again fails and draws it anew.
  await expect(host.getByRole('alert')).toHaveText("Your levels haven't loaded yet. Check your connection, then try again.");
  expect(await result(page)).toEqual({ ready: false, start: 'Play level' });
  await host.getByRole('button', { name: 'Try again' }).click();
  expect(await calls(page)).toEqual([['onRetry']]);
  const b = await host.getByRole('button', { name: 'Try again' }).boundingBox();
  expect(b && b.height).toBeGreaterThanOrEqual(44);
});

test('the score card footnote is the new total, or why it did not change', async ({ page }) => {
  await openBoard(page, '/?seed=1&subject=nature/birds');
  const lines = await page.evaluate(async () => {
    const url = '/src/account.js';
    const m = await import(url);
    return [m.levelFootnote({ banked: true, progress: { points: 5644 } }), m.levelFootnote({ banked: true, progress: { points: 1 } }),
      m.levelFootnote({ banked: false, progress: { points: 5644 } })];
  });
  expect(lines).toEqual(['5,644 points in all', '1 point in all', "These points couldn't be added to your total."]);
});

/** The real win card, showing, with a level's score card in it.
 * @param {Page} page @param {object} [opts] */
async function levelWin(page, opts = {}) {
  // The board first: its deal clears the win card, so one landing late would take this one.
  await openBoard(page, '/?seed=1&subject=nature/birds');
  await page.evaluate(async (opts) => {
    const url = '/src/account.js', scoring = '/src/scoring.js';
    const m = await import(url);
    const { scoreLevel } = await import(scoring);
    const W = ['ROBIN', 'WREN', 'OWL', 'HERON', 'FINCH', 'CRANE', 'EAGLE', 'SWIFT'];
    const breakdown = scoreLevel({ events: W.map((w, i) => ({ word: w, at: 9000 * (i + 1), revealed: i === 7 })), elapsedMs: 96000, difficulty: 'normal', wordCount: 8 });
    const w = /** @type {any} */ (window);
    w.calls = [];
    w.m = m;
    w.card = document.getElementById('wincard');
    w.title = w.card.querySelector('h2');
    /** @type {HTMLElement} */ (document.getElementById('win')).style.display = 'flex';
    w.pb = m.showLevelWin(w.card, w.title, 12, { breakdown, banked: true, progress: { points: 5644 } },
      { onNext: () => w.calls.push('next'), ...opts });
  }, opts);
}

test('a level\'s win card names the level and plays its score, with the new total under it', async ({ page }) => {
  await levelWin(page, { reduceMotion: true, focus: true });
  const card = page.locator('#wincard');
  await expect(card.locator('h2')).toHaveText('Level 12 complete');
  await expect(card).toHaveAttribute('data-level', '12');
  // Right under the title, so it reads before the plain card's parts the stylesheet hides.
  expect(await page.evaluate(() => document.querySelector('#wincard h2')?.nextElementSibling?.className)).toBe('sc-host');
  await expect(card.locator('.sc-all')).toHaveText('5,644 points in all');
  await expect(card.getByRole('button', { name: /Next level/ })).toBeFocused();
  await card.getByRole('button', { name: /Next level/ }).click();
  expect(await calls(page)).toEqual(['next']);
});

// A phone in split screen: one row cut the countdown to "Nex…", so Next level goes under it.
for (const [w, h] of [[412, 360], [463, 400]]) test(`at ${w}x${h} the score card's countdown is whole and nothing scrolls`, async ({ page }) => {
  await page.setViewportSize({ width: w, height: h });
  await levelWin(page, { focus: true });
  await page.evaluate(() => /** @type {any} */ (window).pb.skip());
  await page.locator('#wincard').evaluate((e) => Promise.all(e.getAnimations().map(a => a.finished)));
  await expect(page.locator('#wincard .sc-line')).toBeVisible();
  const m = await page.evaluate(() => {
    const win = /** @type {HTMLElement} */ (document.getElementById('win'));
    const count = /** @type {HTMLElement} */ (document.querySelector('.sc-count'));
    const go = /** @type {HTMLElement} */ (document.querySelector('.sc-go'));
    return { scroll: win.scrollHeight - win.clientHeight, clipped: count.scrollWidth > count.clientWidth, goBottom: go.getBoundingClientRect().bottom };
  });
  expect(m.clipped, 'the countdown is cut short').toBe(false);
  expect(m.scroll).toBeLessThanOrEqual(0);
  expect(m.goBottom).toBeLessThanOrEqual(h);
});

test('while the score plays, focus waits on Skip', async ({ page }) => {
  await levelWin(page, { focus: true });
  await expect(page.locator('#wincard .sc-skip')).toBeFocused();
});

test('clearing it puts the plain card back, and twice is harmless', async ({ page }) => {
  await levelWin(page, { countdownMs: 0, reduceMotion: true });
  await page.evaluate(() => { const w = /** @type {any} */ (window); w.m.clearLevelWin(w.card, w.title); });
  const card = page.locator('#wincard');
  await expect(card.locator('h2')).toHaveText('Puzzle solved!');
  await expect(card).not.toHaveAttribute('data-level');
  await expect(card.locator('.sc-host')).toHaveCount(0);
  await page.evaluate(() => { const w = /** @type {any} */ (window); w.m.clearLevelWin(w.card, w.title); });
  await expect(card.locator('h2')).toHaveText('Puzzle solved!');
});

test('showing a second level replaces the first score card rather than stacking it', async ({ page }) => {
  await levelWin(page, { countdownMs: 0, reduceMotion: true });
  await page.evaluate(() => {
    const w = /** @type {any} */ (window);
    w.m.showLevelWin(w.card, w.title, 13, { breakdown: { lines: [], total: 0 }, banked: false, progress: { points: 1 } },
      { reduceMotion: true, countdownMs: 0, onNext() {} });
  });
  const card = page.locator('#wincard');
  await expect(card.locator('.sc-host')).toHaveCount(1);
  await expect(card.locator('h2')).toHaveText('Level 13 complete');
  await expect(card.locator('.sc-all')).toHaveText("These points couldn't be added to your total.");
  await page.evaluate(() => { const w = /** @type {any} */ (window); w.m.clearLevelWin(w.card, w.title); });
  await expect(card.locator('h2')).toHaveText('Puzzle solved!', { timeout: 1000 });
});
