import { test, expect } from '@playwright/test';

/** @typedef {import('@playwright/test').Page} Page */

// account.js is not wired into the game yet, so each test mounts it in a host inside the open
// Settings card, against a stand-in for levelplay.js that records what it was asked.
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
    document.getElementById('settings-body')?.prepend(host);
    if (what === 'account') m.renderAccount(host, play, { onSignIn: () => w.calls.push(['onSignIn']), onSignOut: () => w.calls.push(['onSignOut']) });
    else w.form = m.renderSignIn(host, play, { onDone: (/** @type {any} */ a) => w.calls.push(['onDone', a.username]) });
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
  await host.getByRole('button', { name: 'Sign out anyway' }).click();
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
