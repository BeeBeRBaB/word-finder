import { test, expect } from '@playwright/test';
import { findAndDrag } from './helpers.js';

/** @typedef {import('@playwright/test').Page} Page */

// Levels as a player meets them, against a stand-in for Firebase: Auth and Firestore are
// answered here, so nothing reaches the real project. The service worker is blocked so every
// request reaches page.route.
test.use({ serviceWorkers: 'block' });

const DOMAIN = 'users.word-finder.invalid';

/** A fake Firebase for one test: accounts by email, and one Firestore document per uid. */
function makeFirebase() {
  /** @type {Map<string, {password:string, uid:string}>} */
  const users = new Map();
  /** @type {Map<string, Record<string, any>>} */
  const docs = new Map();
  let next = 1;
  const saves = [];
  const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization,content-type',
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,OPTIONS' };
  /** @param {import('@playwright/test').Route} route @param {number} status @param {unknown} body */
  const send = (route, status, body) => route.fulfill({ status, headers: { ...cors, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  /** @param {string} uid */
  const tokens = (uid) => ({ localId: uid, idToken: `tok-${uid}`, refreshToken: `ref-${uid}`, expiresIn: '3600' });
  return {
    users, docs, saves,
    /** The progress saved for `uid`, parsed. @param {string} uid */
    progress: (uid) => { const d = docs.get(uid); return d ? JSON.parse(d.data.stringValue) : null; },
    /** @param {string} uid @param {object} progress */
    put(uid, progress) { docs.set(uid, { data: { stringValue: JSON.stringify(progress) } }); },
    /** @param {string} username @param {string} password @returns {string} uid */
    add(username, password) { const uid = `uid${next++}`; users.set(`${username}@${DOMAIN}`, { password, uid }); return uid; },
    /** @param {Page} page */
    async install(page) {
      await page.route(/^https:\/\/(identitytoolkit|securetoken|firestore)\.googleapis\.com\//, async (route) => {
        const req = route.request();
        if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
        const url = new URL(req.url());
        if (url.hostname === 'identitytoolkit.googleapis.com') {
          const { email, password } = JSON.parse(req.postData() || '{}');
          const known = users.get(email);
          if (url.pathname.endsWith(':signUp')) {
            if (known) return send(route, 400, { error: { message: 'EMAIL_EXISTS' } });
            const uid = `uid${next++}`;
            users.set(email, { password, uid });
            return send(route, 200, tokens(uid));
          }
          if (!known || known.password !== password) return send(route, 400, { error: { message: 'INVALID_LOGIN_CREDENTIALS' } });
          return send(route, 200, tokens(known.uid));
        }
        if (url.hostname === 'securetoken.googleapis.com') {
          const uid = String(new URLSearchParams(req.postData() || '').get('refresh_token')).replace(/^ref-/, '');
          return send(route, 200, { id_token: `tok-${uid}`, refresh_token: `ref-${uid}`, expires_in: '3600' });
        }
        const uid = decodeURIComponent(url.pathname.split('/').pop() || '');
        if (req.headers().authorization !== `Bearer tok-${uid}`) return send(route, 403, { error: { status: 'PERMISSION_DENIED' } });
        if (req.method() === 'GET') {
          const d = docs.get(uid);
          return d ? send(route, 200, { fields: d }) : send(route, 404, { error: { status: 'NOT_FOUND' } });
        }
        const { fields } = JSON.parse(req.postData() || '{}');
        docs.set(uid, fields);
        saves.push(JSON.parse(fields.data.stringValue));
        return send(route, 200, { fields });
      });
    },
  };
}

/** Sign this device in as `username` before the page loads, as a returning player.
 * @param {Page} page @param {string} uid @param {string} username */
async function signedInAs(page, uid, username) {
  await page.addInitScript(({ uid, username }) => {
    if (sessionStorage.getItem('seeded')) return;   // once, so a reload keeps what the game wrote
    sessionStorage.setItem('seeded', '1');
    localStorage.setItem('wordfinder-session-v1', JSON.stringify({ uid, username, idToken: `tok-${uid}`, refreshToken: `ref-${uid}`, expiresAt: Date.now() + 3600e3 }));
  }, { uid, username });
}

/** Find every word still on the list. @param {Page} page */
async function findTheRest(page) {
  for (const w of await page.locator('#list .w:not(.done):not(.glow)').allTextContents()) await findAndDrag(page, w.trim().toUpperCase());
}

/** New game ▸ Levels. @param {Page} page */
async function levelsSide(page) {
  await page.click('#catbtn');
  await page.locator('#picker-mode').getByRole('button', { name: 'Levels' }).click();
}

const PROGRESS = { v: 1, seed: 4242, level: 3, points: 420, history: [], current: null };

test('signing up from New game comes back to it, and a level plays through to its score card and is saved online', async ({ page }) => {
  const fb = makeFirebase();
  await fb.install(page);
  await page.goto('/?subject=nature/birds');
  await levelsSide(page);
  await expect(page.locator('#picker-level')).toContainText('Numbered puzzles that keep your points on any device.');
  await expect(page.locator('#picker-start')).toBeDisabled();
  await page.locator('#picker-level').getByRole('button', { name: 'Sign in' }).click();
  // Settings, at its Sign in page, ready to type.
  await expect(page.locator('#settings-signinpage')).toBeVisible();
  await expect(page.getByLabel('Username')).toBeFocused();
  await page.getByRole('button', { name: 'Create an account' }).click();
  await page.getByLabel('Username').fill('ana_reads');
  await page.getByLabel('Password').fill('hunter22');
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  // Back in New game, on the Levels side, with level 1 to play.
  await expect(page.locator('#settings')).toBeHidden();
  await expect(page.locator('#picker')).toBeVisible();
  await expect(page.locator('#picker-level .acct-lvl')).toHaveText('Level 1');
  await expect(page.locator('#picker-level .acct-lvl-line')).toHaveText('0 points · Normal');
  await expect(page.locator('#picker-start')).toHaveText('Play level 1');
  await page.click('#picker-start');
  await expect(page.locator('#picker')).toBeHidden();
  await expect(page.locator('#category')).toHaveText('Level 1');
  const uid = fb.users.get(`ana_reads@${DOMAIN}`)?.uid ?? '';
  await findTheRest(page);
  // The level's score card, not the plain one.
  const card = page.locator('#wincard');
  await expect(card.locator('h2')).toHaveText('Level 1 complete');
  await expect(page.locator('#winbtn')).toBeHidden();
  await expect(page.locator('#solved')).toBeHidden();
  await card.getByRole('button', { name: 'Skip' }).click();
  await expect(card.locator('.sc-all')).toHaveText(/^[\d,]+ points in all$/);
  await expect.poll(() => fb.progress(uid)?.level).toBe(2);
  const saved = fb.progress(uid);
  expect(saved.points).toBeGreaterThan(0);
  expect(saved.history).toHaveLength(1);
  await expect(card.locator('.sc-all')).toHaveText(`${saved.points.toLocaleString('en-US')} points in all`);
  await expect(card.getByRole('button', { name: 'Next level' })).toBeFocused();
  // Next level deals level 2.
  await card.getByRole('button', { name: 'Next level' }).click();
  await expect(page.locator('#win')).toBeHidden();
  await expect(page.locator('#category')).toHaveText('Level 2');
  await expect(card.locator('h2')).toHaveText('Puzzle solved!');
});

test('a level in progress survives a reload with its finds, then scores as the same level', async ({ page }) => {
  const fb = makeFirebase();
  const uid = fb.add('ana_reads', 'hunter22');
  fb.put(uid, PROGRESS);
  await fb.install(page);
  await signedInAs(page, uid, 'ana_reads');
  await page.goto('/?subject=nature/birds');
  await levelsSide(page);
  await expect(page.locator('#picker-level .acct-lvl')).toHaveText('Level 3');
  await expect(page.locator('#picker-level .acct-lvl-line')).toHaveText('420 points · Normal');
  await page.click('#picker-start');
  await expect(page.locator('#category')).toHaveText('Level 3');
  const words = await page.locator('#list .w').allTextContents();
  for (const w of words.slice(0, 2)) await findAndDrag(page, w.trim().toUpperCase());
  const before = await page.locator('#letters').textContent();
  // A plain visit, as a reload of one would be: ?subject= in the URL deals that subject afresh.
  await page.goto('/');
  await expect(page.locator('#category')).toHaveText('Level 3');
  await expect(page.locator('#letters')).toHaveText(before ?? '');
  await expect(page.locator('#list .w.done')).toHaveCount(2);
  // Kept, so New game does not warn that it is lost.
  await levelsSide(page);
  await expect(page.locator('#picker-warning')).toBeHidden();
  await page.click('#picker-cancel');
  await findTheRest(page);
  await expect(page.locator('#wincard h2')).toHaveText('Level 3 complete');
  await expect.poll(() => fb.progress(uid)?.level).toBe(4);
  const saved = fb.progress(uid);
  expect(saved.history[0].level).toBe(3);
  expect(saved.points).toBeGreaterThan(420);
});

test('a one-click New game leaves a level with its finds kept, and Undo or Levels brings it back', async ({ page }) => {
  const fb = makeFirebase();
  const uid = fb.add('ana_reads', 'hunter22');
  fb.put(uid, PROGRESS);
  await fb.install(page);
  await signedInAs(page, uid, 'ana_reads');
  await page.goto('/?subject=nature/birds');
  await levelsSide(page);
  await page.click('#picker-start');
  await expect(page.locator('#category')).toHaveText('Level 3');
  const first = (await page.locator('#list .w').first().textContent())?.trim() ?? '';
  await findAndDrag(page, first.toUpperCase());
  const board = await page.locator('#letters').textContent();
  await page.click('#newbtn');
  await expect(page.locator('#toast-undo')).toBeVisible();
  await expect(page.locator('#category')).not.toHaveText('Level 3');
  // Saved online as the level in progress, with its find.
  await expect.poll(() => fb.progress(uid)?.current?.events?.map((/** @type {any} */ e) => e.word)).toEqual([first.toUpperCase()]);
  await page.click('#toast-undo');
  await expect(page.locator('#category')).toHaveText('Level 3');
  await expect(page.locator('#letters')).toHaveText(board ?? '');
  await expect(page.locator('#list .w.done')).toHaveCount(1);
  // And from New game's Levels side, after a random game.
  await page.click('#newbtn');
  await expect(page.locator('#category')).not.toHaveText('Level 3');
  await levelsSide(page);
  await expect(page.locator('#picker-start')).toHaveText('Play level 3');
  await page.click('#picker-start');
  await expect(page.locator('#category')).toHaveText('Level 3');
  await expect(page.locator('#letters')).toHaveText(board ?? '');
  await expect(page.locator('#list .w.done')).toHaveCount(1);
});

test('leaving the page holds a level score card\'s countdown, as it cancels the plain card\'s, and Next level still deals', async ({ page }) => {
  const fb = makeFirebase();
  const uid = fb.add('ana_reads', 'hunter22');
  fb.put(uid, PROGRESS);
  await fb.install(page);
  await signedInAs(page, uid, 'ana_reads');
  await page.goto('/?subject=nature/birds');
  await levelsSide(page);
  await page.click('#picker-start');
  await findTheRest(page);
  const card = page.locator('#wincard');
  await card.getByRole('button', { name: 'Skip' }).click();
  await expect(card.locator('.sc-line')).toBeVisible();
  /** @param {boolean} hidden */
  const setHidden = (hidden) => page.evaluate((h) => {
    Object.defineProperty(document, 'hidden', { value: h, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  }, hidden);
  await setHidden(true);
  await setHidden(false);
  await expect(card.locator('.sc-line')).toBeHidden();
  await page.waitForTimeout(11000);   // past the countdown it no longer has
  await expect(page.locator('#category')).toHaveText('Level 3');
  await card.getByRole('button', { name: 'Next level' }).click();
  await expect(page.locator('#category')).toHaveText('Level 4');
});

test('the Account section shows the account, and signing out leaves an ordinary board', async ({ page }) => {
  const fb = makeFirebase();
  const uid = fb.add('ana_reads', 'hunter22');
  fb.put(uid, PROGRESS);
  await fb.install(page);
  await signedInAs(page, uid, 'ana_reads');
  await page.goto('/?subject=nature/birds');
  await levelsSide(page);
  await page.click('#picker-start');
  await expect(page.locator('#category')).toHaveText('Level 3');
  await page.click('#appearance');
  const account = page.locator('#settings-account');
  await expect(account.locator('.acct-name')).toHaveText('ana_reads');
  await expect(account).toContainText('Level 3 · 420 points · saved');
  await account.getByRole('button', { name: 'Sign out' }).click();
  await expect(account.getByRole('button', { name: 'Sign in' })).toBeFocused();
  await expect(page.locator('#category')).not.toHaveText('Level 3');
  await page.click('#settings-close');
  await levelsSide(page);
  await expect(page.locator('#picker-level')).toContainText('Numbered puzzles');
});

test('a level finished on another device lets go of this board when the account syncs', async ({ page }) => {
  const fb = makeFirebase();
  const uid = fb.add('ana_reads', 'hunter22');
  fb.put(uid, PROGRESS);
  await fb.install(page);
  await signedInAs(page, uid, 'ana_reads');
  await page.goto('/?subject=nature/birds');
  await levelsSide(page);
  await page.click('#picker-start');
  await expect(page.locator('#category')).toHaveText('Level 3');
  fb.put(uid, { ...PROGRESS, level: 4, points: 900, history: [{ level: 3, subject: 'x/y', difficulty: 'normal', score: 480, ms: 60000, reveals: 0, at: 1 }] });
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await expect(page.locator('#toast-msg')).toHaveText('This level was finished on another device.');
  await expect(page.locator('#category')).not.toHaveText('Level 3');
  await levelsSide(page);
  await expect(page.locator('#picker-start')).toHaveText('Play level 4');
});
