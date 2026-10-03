import { test, expect } from '@playwright/test';
import { findAndDrag, skipAhead } from './helpers.js';

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
  /** @type {unknown[]} */
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

/** Hide or show the page, as switching tabs does. @param {Page} page @param {boolean} hidden */
const setHidden = (page, hidden) => page.evaluate((h) => {
  Object.defineProperty(document, 'hidden', { value: h, configurable: true });
  document.dispatchEvent(new Event('visibilitychange'));
}, hidden);

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

/** Settings ▸ Board. @param {Page} page @param {'auto'|'compact'|'full'} board */
async function setBoard(page, board) {
  await page.click('#appearance');
  await page.locator(`.seg[data-setting="board"] button[data-value="${board}"]`).click();
  await page.keyboard.press('Escape');
}

/** The first word on the list, found. @param {Page} page @returns {Promise<string>} */
async function findFirst(page) {
  const word = ((await page.locator('#list .w:not(.done):not(.glow)').first().textContent()) ?? '').trim().toUpperCase();
  await findAndDrag(page, word);
  return word;
}

const CELLS = { full: 169, compact: 100 };
for (const [from, to] of /** @type {const} */ ([['full', 'compact'], ['compact', 'full']])) {
  test(`a level started on the ${from} board stays on it, finds and all, after Board is set to ${to}`, async ({ page }) => {
    const fb = makeFirebase();
    const uid = fb.add('ana_reads', 'hunter22');
    fb.put(uid, PROGRESS);
    await fb.install(page);
    await signedInAs(page, uid, 'ana_reads');
    await page.goto('/?subject=nature/birds');
    await setBoard(page, from);
    await levelsSide(page);
    await page.click('#picker-start');
    await expect(page.locator('#category')).toHaveText('Level 3');
    await expect(page.locator('#letters .cell')).toHaveCount(CELLS[from]);
    const board = await page.locator('#letters').textContent();
    await findFirst(page);
    await setBoard(page, to);
    await page.click('#newbtn');   // away from the level, then back to it
    await expect(page.locator('#category')).not.toHaveText('Level 3');
    await expect(page.locator('#letters .cell')).toHaveCount(CELLS[to]);
    await levelsSide(page);
    await page.click('#picker-start');
    await expect(page.locator('#category')).toHaveText('Level 3');
    await expect(page.locator('#letters')).toHaveText(board ?? '');
    await expect(page.locator('#list .w.done')).toHaveCount(1);
  });
}

/** A second device signed in to the account: a phone, with its own storage.
 * @param {import('@playwright/test').Browser} browser @param {string|undefined} baseURL
 * @param {ReturnType<typeof makeFirebase>} fb @param {string} uid @returns {Promise<Page>} */
async function phoneOf(browser, baseURL, fb, uid) {
  const context = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  const phone = await context.newPage();
  await fb.install(phone);
  await signedInAs(phone, uid, 'ana_reads');
  await phone.goto('/?subject=nature/birds');
  return phone;
}

test('a level a phone carried on with is let go here when the account syncs, and dealt again on the phone\'s board', async ({ page, browser, baseURL }) => {
  const fb = makeFirebase();
  const uid = fb.add('ana_reads', 'hunter22');
  fb.put(uid, PROGRESS);
  await fb.install(page);
  await signedInAs(page, uid, 'ana_reads');
  await page.goto('/?subject=nature/birds');
  await levelsSide(page);
  await page.click('#picker-start');
  await expect(page.locator('#category')).toHaveText('Level 3');
  await expect(page.locator('#letters .cell')).toHaveCount(169);
  await setHidden(page, true);
  // The phone cannot show the large board, so it starts the level over on its own.
  const phone = await phoneOf(browser, baseURL, fb, uid);
  await levelsSide(phone);
  await phone.click('#picker-start');
  await expect(phone.locator('#category')).toHaveText('Level 3');
  await expect(phone.locator('#letters .cell')).toHaveCount(100);
  const board = await phone.locator('#letters').textContent();
  const found = [await findFirst(phone), await findFirst(phone)];
  await setHidden(phone, true);
  await expect.poll(() => fb.progress(uid)?.current?.events?.length).toBe(2);
  await setHidden(page, false);
  await expect(page.locator('#toast-msg')).toHaveText('Another device carried on with this level on a board of another size.');
  await expect(page.locator('#category')).not.toHaveText('Level 3');
  await levelsSide(page);
  await page.click('#picker-start');
  await expect(page.locator('#category')).toHaveText('Level 3');
  await expect(page.locator('#letters')).toHaveText(board ?? '');
  await expect.poll(async () => (await page.locator('#list .w.done').allTextContents()).map(w => w.trim().toUpperCase()).sort())
    .toEqual([...found].sort());
  await phone.context().close();
});

test('a phone keeps playing a level started on the large board, and its game replaces that one', async ({ page, browser, baseURL }) => {
  const fb = makeFirebase();
  const uid = fb.add('ana_reads', 'hunter22');
  fb.put(uid, PROGRESS);
  await fb.install(page);
  await signedInAs(page, uid, 'ana_reads');
  await page.goto('/?subject=nature/birds');
  await levelsSide(page);
  await page.click('#picker-start');
  await expect(page.locator('#category')).toHaveText('Level 3');
  await expect(page.locator('#letters .cell')).toHaveCount(169);
  await findFirst(page);
  await findFirst(page);
  await setHidden(page, true);
  await expect.poll(() => fb.progress(uid)?.current?.events?.length).toBe(2);
  const phone = await phoneOf(browser, baseURL, fb, uid);
  await levelsSide(phone);
  await phone.click('#picker-start');
  await expect(phone.locator('#category')).toHaveText('Level 3');
  await expect(phone.locator('#letters .cell')).toHaveCount(100);
  const word = await findFirst(phone);
  // Its sync on the way out meets the large board's game, which has more finds.
  await setHidden(phone, true);
  await expect.poll(() => fb.progress(uid)?.current?.size).toBe(10);
  expect(fb.progress(uid).current.events.map((/** @type {any} */ e) => e.word)).toEqual([word]);
  await setHidden(phone, false);
  await expect(phone.locator('#category')).toHaveText('Level 3');
  await expect(phone.locator('#toast')).toBeHidden();
  await findTheRest(phone);
  await expect(phone.locator('#wincard h2')).toHaveText('Level 3 complete');
  await phone.context().close();
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

// Saves from before boards were stored hold only the seed, and a level's board is not the
// random deal's: it is rebuilt at the level's own difficulty, or its finds miss the words.
test('a level saved without its board is rebuilt as the level, at its difficulty', async ({ page }) => {
  const fb = makeFirebase();
  const uid = fb.add('ana_reads', 'hunter22');
  fb.put(uid, PROGRESS);
  await fb.install(page);
  await signedInAs(page, uid, 'ana_reads');
  await page.addInitScript(() => {
    if (!localStorage.getItem('wordfinder-settings-v1')) localStorage.setItem('wordfinder-settings-v1', JSON.stringify({ difficulty: 'hard' }));
  });
  await page.goto('/?subject=nature/birds');
  await levelsSide(page);
  await page.click('#picker-start');
  await expect(page.locator('#category')).toHaveText('Level 3');
  await findAndDrag(page, (await page.locator('#list .w').first().textContent() ?? '').trim().toUpperCase());
  const before = await page.locator('#letters').textContent();
  await page.evaluate(() => {
    const { cells, placements, ...rest } = JSON.parse(localStorage.getItem('wordfinder-save-v1') ?? '{}');
    localStorage.setItem('wordfinder-save-v1', JSON.stringify(rest));
  });
  await page.goto('/');
  await expect(page.locator('#category')).toHaveText('Level 3');
  await expect(page.locator('#letters')).toHaveText(before ?? '');
  await expect(page.locator('#list .w.done')).toHaveCount(1);
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
  await page.clock.install();
  await page.goto('/?subject=nature/birds');
  await levelsSide(page);
  await page.click('#picker-start');
  await expect(page.locator('#category')).toHaveText('Level 3');
  await findTheRest(page);
  const card = page.locator('#wincard');
  await card.getByRole('button', { name: 'Skip' }).click();
  await expect(card.locator('.sc-line')).toBeVisible();
  await setHidden(page, true);
  await setHidden(page, false);
  await expect(card.locator('.sc-line')).toBeHidden();
  await skipAhead(page, 11000);   // past the countdown it no longer has
  await expect(page.locator('#category')).toHaveText('Level 3');
  await card.getByRole('button', { name: 'Next level' }).click();
  await expect(page.locator('#category')).toHaveText('Level 4');
});

test('closing a level\'s score card stops its countdown', async ({ page }) => {
  const fb = makeFirebase();
  const uid = fb.add('ana_reads', 'hunter22');
  fb.put(uid, PROGRESS);
  await fb.install(page);
  await signedInAs(page, uid, 'ana_reads');
  await page.clock.install();
  await page.goto('/?subject=nature/birds');
  await levelsSide(page);
  await page.click('#picker-start');
  await expect(page.locator('#category')).toHaveText('Level 3');
  await findTheRest(page);
  const card = page.locator('#wincard');
  await card.getByRole('button', { name: 'Skip' }).click();
  await expect(card.locator('.sc-line')).toBeVisible();
  await page.click('#winclose');
  await skipAhead(page, 11000);   // past the countdown
  await expect(page.locator('#category')).toHaveText('Level 3');
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

test('a level let go under Settings says so once Settings closes, for the toast\'s full time', async ({ page }) => {
  const fb = makeFirebase();
  const uid = fb.add('ana_reads', 'hunter22');
  fb.put(uid, PROGRESS);
  await fb.install(page);
  await signedInAs(page, uid, 'ana_reads');
  await page.clock.install();
  await page.goto('/?subject=nature/birds');
  await levelsSide(page);
  await page.click('#picker-start');
  await expect(page.locator('#category')).toHaveText('Level 3');
  await page.click('#appearance');
  fb.put(uid, { ...PROGRESS, level: 4, points: 900, history: [{ level: 3, subject: 'x/y', difficulty: 'normal', score: 480, ms: 60000, reveals: 0, at: 1 }] });
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  const toast = page.locator('#toast');
  await expect(page.locator('#toast-msg')).toHaveText('This level was finished on another device.');
  await skipAhead(page, 7000);
  await expect(toast).toBeVisible();   // under Settings, where it cannot be read, it waits
  await page.keyboard.press('Escape');
  await skipAhead(page, 4000);
  await expect(toast).toBeVisible();
  await skipAhead(page, 2500);
  await expect(toast).toBeHidden();
});

test('a level let go under New game is not news once the next level is dealt from it', async ({ page }) => {
  const fb = makeFirebase();
  const uid = fb.add('ana_reads', 'hunter22');
  fb.put(uid, PROGRESS);
  await fb.install(page);
  await signedInAs(page, uid, 'ana_reads');
  await page.goto('/?subject=nature/birds');
  await levelsSide(page);
  await page.click('#picker-start');
  await expect(page.locator('#category')).toHaveText('Level 3');
  await levelsSide(page);
  fb.put(uid, { ...PROGRESS, level: 4, points: 900, history: [{ level: 3, subject: 'x/y', difficulty: 'normal', score: 480, ms: 60000, reveals: 0, at: 1 }] });
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await expect(page.locator('#toast-msg')).toHaveText('This level was finished on another device.');
  await expect(page.locator('#picker-start')).toHaveText('Play level 4');
  await page.click('#picker-start');
  await expect(page.locator('#category')).toHaveText('Level 4');
  await expect(page.locator('#toast')).toBeHidden({ timeout: 1000 });
});

// Two devices that each began the account's progress, as when its first save never reached the
// cloud: the cloud's copy wins, and this level number is another board there.
for (const [where, level] of [['at this level', 3], ['further on', 5]]) {
  test(`a level replaced by another device's progress ${where} says so, not that it was finished`, async ({ page }) => {
    const fb = makeFirebase();
    const uid = fb.add('ana_reads', 'hunter22');
    fb.put(uid, PROGRESS);
    await fb.install(page);
    await signedInAs(page, uid, 'ana_reads');
    await page.goto('/?subject=nature/birds');
    await levelsSide(page);
    await page.click('#picker-start');
    await expect(page.locator('#category')).toHaveText('Level 3');
    fb.put(uid, { ...PROGRESS, seed: 777, level });
    await page.evaluate(() => window.dispatchEvent(new Event('online')));
    await expect(page.locator('#toast-msg')).toHaveText('Your progress from another device replaced this level.');
    await expect(page.locator('#category')).not.toHaveText('Level 3');
  });
}

test('Undo brings a level back as an ordinary board once another device\'s progress replaced it', async ({ page }) => {
  const fb = makeFirebase();
  const uid = fb.add('ana_reads', 'hunter22');
  fb.put(uid, PROGRESS);
  await fb.install(page);
  await signedInAs(page, uid, 'ana_reads');
  await page.goto('/?subject=nature/birds');
  await levelsSide(page);
  await page.click('#picker-start');
  await expect(page.locator('#category')).toHaveText('Level 3');
  const subject = await page.locator('#subject').textContent();
  await findAndDrag(page, ((await page.locator('#list .w').first().textContent()) ?? '').trim().toUpperCase());
  await page.click('#newbtn');
  await expect(page.locator('#toast-undo')).toBeVisible();
  await expect.poll(() => fb.progress(uid)?.current?.events?.length).toBe(1);
  fb.put(uid, { ...PROGRESS, seed: 777 });
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('wordfinder-levels-v1') ?? 'null')?.seed)).toBe(777);
  await page.click('#toast-undo');
  await expect(page.locator('#subject')).toHaveText(subject ?? '');
  await expect(page.locator('#category')).not.toHaveText('Level 3');
  await findTheRest(page);
  await expect(page.locator('#wincard h2')).toHaveText('Puzzle solved!');
  expect(fb.progress(uid)).toEqual({ ...PROGRESS, seed: 777 });
});

test('a tab coming back reads the cloud before it saves, so it never writes over a level finished elsewhere', async ({ page }) => {
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
  await setHidden(page, true);
  await expect.poll(() => fb.progress(uid)?.current?.events?.length).toBe(1);
  // Meanwhile another device finishes levels 3 and 4.
  const ahead = { ...PROGRESS, level: 5, points: 1500, history: [3, 4].map(level => ({ level, subject: 'x/y', difficulty: 'normal', score: 540, ms: 60000, reveals: 0, at: 1 })) };
  fb.put(uid, ahead);
  await setHidden(page, false);
  await expect(page.locator('#toast-msg')).toHaveText('This level was finished on another device.');
  await setHidden(page, true);
  await page.waitForTimeout(300);
  expect(fb.progress(uid)).toEqual(ahead);
});

test('a reveal stays a reveal across a reload, and the level scores it as one', async ({ page }) => {
  const fb = makeFirebase();
  const uid = fb.add('ana_reads', 'hunter22');
  fb.put(uid, PROGRESS);
  await fb.install(page);
  await signedInAs(page, uid, 'ana_reads');
  await page.goto('/?subject=nature/birds');
  await levelsSide(page);
  await page.click('#picker-start');
  await expect(page.locator('#category')).toHaveText('Level 3');
  await page.click('#reveal');
  await expect(page.locator('#list .w.done, #list .w.glow')).toHaveCount(1);
  await page.goto('/');
  await expect(page.locator('#category')).toHaveText('Level 3');
  // Signing out and in again re-links the board from its own save, reveal and all.
  await page.click('#appearance');
  await expect(page.locator('#settings-account')).toContainText('420 points · saved');   // the reload's sync saved the reveal
  await page.locator('#settings-account').getByRole('button', { name: 'Sign out' }).click();
  await page.locator('#settings-account').getByRole('button', { name: 'Sign in' }).click();
  await page.getByLabel('Username').fill('ana_reads');
  await page.getByLabel('Password').fill('hunter22');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.locator('#settings-account .acct-name')).toHaveText('ana_reads');
  await page.click('#settings-close');
  await levelsSide(page);
  await page.click('#picker-start');
  await expect(page.locator('#category')).toHaveText('Level 3');
  await findTheRest(page);
  await expect(page.locator('#wincard h2')).toHaveText('Level 3 complete');
  await expect.poll(() => fb.progress(uid)?.level).toBe(4);
  expect(fb.progress(uid).history[0].reveals).toBe(1);
});

test('a sign-in from New game that lands after Settings was closed stays out of the way', async ({ page }) => {
  const fb = makeFirebase();
  await fb.install(page);
  // Hold Auth's answer until Settings is closed.
  /** @type {() => void} */
  let release = () => {};
  const held = new Promise(r => { release = () => r(undefined); });
  await page.route(/identitytoolkit/, async (route) => { await held; await route.fallback(); });
  await page.goto('/?subject=nature/birds');
  await levelsSide(page);
  await page.locator('#picker-level').getByRole('button', { name: 'Sign in' }).click();
  await page.getByRole('button', { name: 'Create an account' }).click();
  await page.getByLabel('Username').fill('ana_reads');
  await page.getByLabel('Password').fill('hunter22');
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await page.keyboard.press('Escape');
  await expect(page.locator('#settings')).toBeHidden();
  release();
  await expect.poll(() => fb.users.size).toBe(1);
  await page.waitForTimeout(300);
  await expect(page.locator('#picker')).toBeHidden();
});

test('a session that lapses leaves an ordinary board, and Next level then deals a random game', async ({ page }) => {
  const fb = makeFirebase();
  const uid = fb.add('ana_reads', 'hunter22');
  fb.put(uid, PROGRESS);
  await fb.install(page);
  await signedInAs(page, uid, 'ana_reads');
  await page.goto('/?subject=nature/birds');
  await levelsSide(page);
  await page.click('#picker-start');
  await expect(page.locator('#category')).toHaveText('Level 3');
  // The refresh token is refused from here on, and the stored session has run out.
  await page.route(/securetoken/, (route) => route.fulfill({ status: 400, headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
    body: JSON.stringify({ error: { message: 'TOKEN_EXPIRED' } }) }));
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('wordfinder-session-v1') || '{}');
    localStorage.setItem('wordfinder-session-v1', JSON.stringify({ ...s, expiresAt: 0 }));
  });
  await page.goto('/');
  await expect(page.locator('#category')).not.toHaveText('Level 3');
  await expect(page.locator('#letters .cell')).not.toHaveCount(0);
});

/** Refuse this tab's session from here on: every document request is a 401 and the refresh token
 * has expired, so the next request signs the device out. @param {Page} page */
async function refuseSession(page) {
  const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization,content-type', 'Access-Control-Allow-Methods': 'GET,POST,PATCH,OPTIONS' };
  await page.route(/^https:\/\/(securetoken|firestore)\.googleapis\.com\//, (route) => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    const expired = route.request().url().includes('securetoken');
    return route.fulfill({ status: expired ? 400 : 401, headers: { ...cors, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: expired ? { message: 'TOKEN_EXPIRED' } : { status: 'UNAUTHENTICATED' } }) });
  });
}

test('a session refused mid-level says so when the player is back, and signing in again picks the level up', async ({ page }) => {
  const fb = makeFirebase();
  const uid = fb.add('ana_reads', 'hunter22');
  fb.put(uid, PROGRESS);
  await fb.install(page);
  await signedInAs(page, uid, 'ana_reads');
  await page.goto('/?subject=nature/birds');
  await levelsSide(page);
  await page.click('#picker-start');
  await expect(page.locator('#category')).toHaveText('Level 3');
  const words = (await page.locator('#list .w').allTextContents()).map(w => w.trim().toUpperCase());
  await findAndDrag(page, words[0]);
  await refuseSession(page);
  await setHidden(page, true);    // the save on the way out is refused, which signs this device out
  await setHidden(page, false);
  await expect(page.locator('#toast-msg')).toHaveText("You've been signed out, so this game no longer counts as a level.");
  await expect(page.locator('#category')).not.toHaveText('Level 3');
  await findAndDrag(page, words[1]);
  // Signing in again: the board is the level it was, with both finds on it.
  await page.unroute(/^https:\/\/(securetoken|firestore)\.googleapis\.com\//);
  await fb.install(page);
  await page.click('#appearance');
  await page.locator('#settings-account').getByRole('button', { name: 'Sign in' }).click();
  await page.getByLabel('Username').fill('ana_reads');
  await page.getByLabel('Password').fill('hunter22');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.keyboard.press('Escape');
  await expect(page.locator('#category')).toHaveText('Level 3');
  await setHidden(page, true);
  await expect.poll(() => fb.progress(uid)?.current?.events?.map((/** @type {any} */ e) => e.word)).toEqual(words.slice(0, 2));
});

test('a sign-out raised under Settings is not news once signing in again there picks the level up', async ({ page }) => {
  const fb = makeFirebase();
  const uid = fb.add('ana_reads', 'hunter22');
  fb.put(uid, PROGRESS);
  await fb.install(page);
  await signedInAs(page, uid, 'ana_reads');
  await page.goto('/?subject=nature/birds');
  await levelsSide(page);
  await page.click('#picker-start');
  await expect(page.locator('#category')).toHaveText('Level 3');
  await findFirst(page);
  await refuseSession(page);
  await page.click('#appearance');   // it syncs the unsent find, which is refused and signs this device out
  await expect(page.locator('#toast-msg')).toHaveText("You've been signed out, so this game no longer counts as a level.");
  await page.unroute(/^https:\/\/(securetoken|firestore)\.googleapis\.com\//);
  await fb.install(page);
  await page.locator('#settings-account').getByRole('button', { name: 'Sign in' }).click();
  await page.getByLabel('Username').fill('ana_reads');
  await page.getByLabel('Password').fill('hunter22');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.locator('#category')).toHaveText('Level 3');
  await page.keyboard.press('Escape');
  await expect(page.locator('#toast')).toBeHidden({ timeout: 1000 });
});

// Level 3 of seed 4242 is in Space, a category this page has not loaded, so its deal waits on
// the network while the session is refused.
test('a session that lapses while New game deals a level asks to sign in, not about the network', async ({ page }) => {
  const fb = makeFirebase();
  const uid = fb.add('ana_reads', 'hunter22');
  fb.put(uid, PROGRESS);
  await fb.install(page);
  await signedInAs(page, uid, 'ana_reads');
  await page.goto('/?subject=nature/birds');
  await levelsSide(page);
  /** @type {() => void} */
  let release = () => {};
  const held = new Promise((r) => { release = () => r(undefined); });
  await page.route(/\/src\/subjects\/space\.js/, async (route) => { await held; await route.continue(); });
  await page.click('#picker-start');
  await refuseSession(page);
  await page.evaluate(() => window.dispatchEvent(new Event('online')));   // its sync is refused
  await expect.poll(() => page.evaluate(() => localStorage.getItem('wordfinder-session-v1'))).toBeNull();
  release();
  await expect(page.locator('#picker-level').getByRole('button', { name: 'Sign in' })).toBeVisible();
  await expect(page.locator('#picker-error')).toBeHidden();
  await expect(page.locator('#picker-title')).toBeFocused();
  await expect(page.locator('#category')).not.toHaveText(/^Level/);
});

test('Undo brings a level back as an ordinary board once the session has lapsed, and says why', async ({ page }) => {
  const fb = makeFirebase();
  const uid = fb.add('ana_reads', 'hunter22');
  fb.put(uid, PROGRESS);
  await fb.install(page);
  await signedInAs(page, uid, 'ana_reads');
  await page.goto('/?subject=nature/birds');
  await levelsSide(page);
  await page.click('#picker-start');
  await expect(page.locator('#category')).toHaveText('Level 3');
  await findAndDrag(page, ((await page.locator('#list .w').first().textContent()) ?? '').trim().toUpperCase());
  await refuseSession(page);
  await page.click('#newbtn');   // the save on the way out is refused, which signs this device out
  await expect.poll(() => page.evaluate(() => localStorage.getItem('wordfinder-session-v1'))).toBeNull();
  await page.click('#toast-undo');
  await expect(page.locator('#list .w.done')).toHaveCount(1);
  await expect(page.locator('#category')).not.toHaveText('Level 3');
  await expect(page.locator('#toast-msg')).toHaveText("You've been signed out, so this game no longer counts as a level.");
});

// The score card comes up a moment after the last find. A sync landing in that moment used to let
// go of the level, so the card read "Level 3 complete" over a header that no longer said Level 3.
test('a sync between the last find and the score card leaves the level in the header', async ({ page }) => {
  const fb = makeFirebase();
  const uid = fb.add('ana_reads', 'hunter22');
  fb.put(uid, PROGRESS);
  await fb.install(page);
  await signedInAs(page, uid, 'ana_reads');
  await page.clock.install();   // the card waits on the clock, so the sync is sure to land first
  await page.goto('/?subject=nature/birds');
  await levelsSide(page);
  await page.click('#picker-start');
  await expect(page.locator('#category')).toHaveText('Level 3');
  const words = (await page.locator('#list .w').allTextContents()).map(w => w.trim().toUpperCase());
  for (const w of words) await findAndDrag(page, w);
  const synced = page.waitForResponse((r) => r.url().startsWith('https://firestore.') && r.request().method() === 'GET');
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await synced;
  await page.waitForTimeout(300);
  await expect(page.locator('#category')).toHaveText('Level 3');
  await skipAhead(page, 1000);
  await expect(page.locator('#wincard h2')).toHaveText('Level 3 complete');
  await expect(page.locator('#category')).toHaveText('Level 3');
});

test('signing out between the last find and the score card shows the plain win card', async ({ page }) => {
  const fb = makeFirebase();
  const uid = fb.add('ana_reads', 'hunter22');
  fb.put(uid, PROGRESS);
  await fb.install(page);
  await signedInAs(page, uid, 'ana_reads');
  await page.clock.install();   // the card waits on the clock
  await page.goto('/?subject=nature/birds');
  await levelsSide(page);
  await page.click('#picker-start');
  await expect(page.locator('#category')).toHaveText('Level 3');
  for (const w of await page.locator('#list .w').allTextContents()) await findAndDrag(page, w.trim().toUpperCase());
  await page.click('#appearance');
  await page.locator('#settings-account').getByRole('button', { name: 'Sign out' }).click();
  await page.click('#settings-close');
  await skipAhead(page, 1000);
  await expect(page.locator('#wincard h2')).toHaveText('Puzzle solved!');
  await expect(page.locator('#wincard')).not.toHaveAttribute('data-level');
});

// A level won here was banked at its last find, so a session that lapses afterwards takes nothing.
test('a level finished here goes quietly when the session lapses afterwards', async ({ page }) => {
  const fb = makeFirebase();
  const uid = fb.add('ana_reads', 'hunter22');
  fb.put(uid, PROGRESS);
  await fb.install(page);
  await signedInAs(page, uid, 'ana_reads');
  await page.goto('/?subject=nature/birds');
  await levelsSide(page);
  await page.click('#picker-start');
  await expect(page.locator('#category')).toHaveText('Level 3');
  await findTheRest(page);
  await expect(page.locator('#wincard h2')).toHaveText('Level 3 complete');
  await expect.poll(() => fb.progress(uid)?.level).toBe(4);
  await page.locator('#winclose').click();
  await refuseSession(page);
  await page.evaluate(() => window.dispatchEvent(new Event('online')));   // its sync is refused
  await expect.poll(() => page.evaluate(() => localStorage.getItem('wordfinder-session-v1'))).toBeNull();
  await expect(page.locator('#category')).not.toHaveText(/^Level/);
  await expect(page.locator('#toast')).toBeHidden();
});

test('a session that lapses while a score card shows makes Next level deal a random game', async ({ page }) => {
  const fb = makeFirebase();
  const uid = fb.add('ana_reads', 'hunter22');
  fb.put(uid, PROGRESS);
  await fb.install(page);
  await signedInAs(page, uid, 'ana_reads');
  await page.goto('/?subject=nature/birds');
  await levelsSide(page);
  await page.click('#picker-start');
  await expect(page.locator('#category')).toHaveText('Level 3');
  await findTheRest(page);
  const card = page.locator('#wincard');
  await expect(card.locator('h2')).toHaveText('Level 3 complete');
  await expect.poll(() => fb.progress(uid)?.level).toBe(4);
  await refuseSession(page);
  await page.evaluate(() => window.dispatchEvent(new Event('online')));   // its sync is refused
  await card.getByRole('button', { name: 'Skip' }).click();
  await card.getByRole('button', { name: 'Next level' }).click();
  await expect(page.locator('#toast-msg')).toHaveText("You're signed out, so this is a random game.");
  await expect(page.locator('#category')).not.toHaveText(/^Level/);
  await expect(page.locator('#win')).toBeHidden();
});

test('when the finds of two devices together complete a level, the one being looked at shows its score card', async ({ page }) => {
  const fb = makeFirebase();
  const uid = fb.add('ana_reads', 'hunter22');
  fb.put(uid, PROGRESS);
  await fb.install(page);
  await signedInAs(page, uid, 'ana_reads');
  await page.goto('/?subject=nature/birds');
  await levelsSide(page);
  await page.click('#picker-start');
  await expect(page.locator('#category')).toHaveText('Level 3');
  const words = (await page.locator('#list .w').allTextContents()).map(w => w.trim().toUpperCase());
  for (const w of words.slice(0, -1)) await findAndDrag(page, w);
  await setHidden(page, true);
  await expect.poll(() => fb.progress(uid)?.current?.events?.length).toBe(words.length - 1);
  // Meanwhile another device found the last word.
  const p = fb.progress(uid);
  fb.put(uid, { ...p, current: { ...p.current, events: [...p.current.events, { word: words[words.length - 1], at: p.current.elapsedMs + 1, revealed: false }] } });
  await setHidden(page, false);
  await expect(page.locator('#wincard h2')).toHaveText('Level 3 complete');
  await expect.poll(() => fb.progress(uid)?.level).toBe(4);
});

test('a level a sync completes while Settings is open ends with the Account line saying it is saved', async ({ page }) => {
  const fb = makeFirebase();
  const uid = fb.add('ana_reads', 'hunter22');
  fb.put(uid, PROGRESS);
  await fb.install(page);
  await signedInAs(page, uid, 'ana_reads');
  await page.goto('/?subject=nature/birds');
  await levelsSide(page);
  await page.click('#picker-start');
  await expect(page.locator('#category')).toHaveText('Level 3');
  const words = (await page.locator('#list .w').allTextContents()).map(w => w.trim().toUpperCase());
  for (const w of words.slice(0, -1)) await findAndDrag(page, w);
  await setHidden(page, true);
  await expect.poll(() => fb.progress(uid)?.current?.events?.length).toBe(words.length - 1);
  await setHidden(page, false);
  await page.click('#appearance');
  const line = page.locator('#settings-account .acct-line');
  await expect(line).toHaveText(/^Level 3 .* saved$/);
  // Another device finds the last word, and this one hears of it with Settings open.
  const p = fb.progress(uid);
  fb.put(uid, { ...p, current: { ...p.current, events: [...p.current.events, { word: words[words.length - 1], at: p.current.elapsedMs + 1, revealed: false }] } });
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await expect.poll(() => fb.progress(uid)?.level).toBe(4);
  await expect(line).toHaveText(/^Level 4 .* saved$/);
});

/** The puzzles this device has solved. @param {Page} page */
const solves = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('wordfinder-progress-v1') ?? '{}').puzzles ?? 0);

test('a level the account\'s finds complete when the page reloads shows its score card, as one solve', async ({ page }) => {
  const fb = makeFirebase();
  const uid = fb.add('ana_reads', 'hunter22');
  fb.put(uid, PROGRESS);
  await fb.install(page);
  await signedInAs(page, uid, 'ana_reads');
  await page.goto('/?subject=nature/birds');
  await levelsSide(page);
  await page.click('#picker-start');
  await expect(page.locator('#category')).toHaveText('Level 3');
  const words = (await page.locator('#list .w').allTextContents()).map(w => w.trim().toUpperCase());
  for (const w of words.slice(0, -1)) await findAndDrag(page, w);
  await setHidden(page, true);
  await expect.poll(() => fb.progress(uid)?.current?.events?.length).toBe(words.length - 1);
  // Another device found the last word, and this one comes back by a reload.
  const p = fb.progress(uid);
  fb.put(uid, { ...p, current: { ...p.current, events: [...p.current.events, { word: words[words.length - 1], at: p.current.elapsedMs + 1, revealed: false }] } });
  await page.goto('/');
  await expect(page.locator('#wincard h2')).toHaveText('Level 3 complete');
  await expect(page.locator('#list .w.done')).toHaveCount(words.length);
  await expect.poll(() => fb.progress(uid)?.level).toBe(4);
  expect(await solves(page)).toBe(1);
});

test('a level the account\'s finds completed while another game was on shows its score card when played', async ({ page }) => {
  const fb = makeFirebase();
  const uid = fb.add('ana_reads', 'hunter22');
  fb.put(uid, PROGRESS);
  await fb.install(page);
  await signedInAs(page, uid, 'ana_reads');
  await page.goto('/?subject=nature/birds');
  await levelsSide(page);
  await page.click('#picker-start');
  await expect(page.locator('#category')).toHaveText('Level 3');
  const words = (await page.locator('#list .w').allTextContents()).map(w => w.trim().toUpperCase());
  await findAndDrag(page, words[0]);
  await page.click('#newbtn');
  await expect(page.locator('#category')).not.toHaveText('Level 3');
  await expect.poll(() => fb.progress(uid)?.current?.events?.length).toBe(1);
  // Another device finds the rest, and this one hears of it when the player comes back.
  const p = fb.progress(uid);
  fb.put(uid, { ...p, current: { ...p.current, events: words.map((word, i) => ({ word, at: i + 1, revealed: false })) } });
  await setHidden(page, true);
  await setHidden(page, false);
  await levelsSide(page);
  await expect(page.locator('#picker-start')).toHaveText('Play level 3');
  await page.click('#picker-start');
  await expect(page.locator('#wincard h2')).toHaveText('Level 3 complete');
  await expect.poll(() => fb.progress(uid)?.level).toBe(4);
  expect(await solves(page)).toBe(1);
});

test('a level finished while signed out is banked on signing in again, and not counted twice', async ({ page }) => {
  const fb = makeFirebase();
  const uid = fb.add('ana_reads', 'hunter22');
  fb.put(uid, PROGRESS);
  await fb.install(page);
  await signedInAs(page, uid, 'ana_reads');
  await page.goto('/?subject=nature/birds');
  await levelsSide(page);
  await page.click('#picker-start');
  await expect(page.locator('#category')).toHaveText('Level 3');
  const words = (await page.locator('#list .w').allTextContents()).map(w => w.trim().toUpperCase());
  await findAndDrag(page, words[0]);
  await refuseSession(page);
  await setHidden(page, true);    // the save on the way out is refused, which signs this device out
  await setHidden(page, false);
  await expect(page.locator('#category')).not.toHaveText('Level 3');
  for (const w of words.slice(1)) await findAndDrag(page, w);
  await expect(page.locator('#win')).toBeVisible();
  expect(await solves(page)).toBe(1);
  await page.click('#winclose');   // the finished board stays, rather than the next game coming
  await page.unroute(/^https:\/\/(securetoken|firestore)\.googleapis\.com\//);
  await fb.install(page);
  await page.click('#appearance');
  await page.locator('#settings-account').getByRole('button', { name: 'Sign in' }).click();
  await page.getByLabel('Username').fill('ana_reads');
  await page.getByLabel('Password').fill('hunter22');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  // Banked as the account signs in, and the Account section says so.
  await expect(page.locator('#settings-account .acct-line')).toContainText('Level 4');
  await expect.poll(() => fb.progress(uid)?.level).toBe(4);
  expect(await solves(page)).toBe(1);
});

// Short landscape phones: Random | Levels and the level's score card both have to fit about 300px.
for (const [w, h] of [[844, 300], [568, 320], [320, 400]]) {
  test(`New game and a level's score card fit ${w}x${h} without scrolling`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    const fb = makeFirebase();
    const uid = fb.add('ana_reads', 'hunter22');
    fb.put(uid, PROGRESS);
    await fb.install(page);
    await signedInAs(page, uid, 'ana_reads');
    await page.goto('/?subject=nature/birds');
    const first = (await page.locator('#list .w').first().textContent())?.trim() ?? '';
    await findAndDrag(page, first.toUpperCase());
    // A game in progress, so the warning shows too.
    await page.click('#catbtn');
    await expect(page.locator('#picker-warning')).toBeVisible();
    /** @param {string} card */
    const fits = (card) => page.evaluate((sel) => {
      const c = /** @type {HTMLElement} */ (document.querySelector(sel));
      return { scroll: c.scrollHeight - c.clientHeight, bottom: c.getBoundingClientRect().bottom, vh: innerHeight };
    }, card);
    let f = await fits('#pickercard');
    expect(f.scroll, 'Random side').toBeLessThanOrEqual(0);
    await page.locator('#picker-mode').getByRole('button', { name: 'Levels' }).click();
    f = await fits('#pickercard');
    expect(f.scroll, 'Levels side').toBeLessThanOrEqual(0);
    expect(f.bottom).toBeLessThanOrEqual(f.vh);
    await page.click('#picker-start');
    await expect(page.locator('#category')).toHaveText('Level 3');
    await findTheRest(page);
    const card = page.locator('#wincard');
    await expect(card.locator('h2')).toHaveText('Level 3 complete');
    await card.getByRole('button', { name: 'Skip' }).click();
    await expect(card.locator('.sc-line')).toBeVisible();
    const m = await page.evaluate(() => {
      const win = /** @type {HTMLElement} */ (document.getElementById('win'));
      const count = /** @type {HTMLElement} */ (document.querySelector('.sc-count'));
      const go = /** @type {HTMLElement} */ (document.querySelector('.sc-go'));
      return { scroll: win.scrollHeight - win.clientHeight, goBottom: go.getBoundingClientRect().bottom, vh: innerHeight,
        clipped: count.scrollWidth > count.clientWidth };
    });
    expect(m.scroll, 'the win card scrolls').toBeLessThanOrEqual(0);
    expect(m.goBottom).toBeLessThanOrEqual(m.vh);
    expect(m.clipped, 'the countdown is cut short').toBe(false);
  });
}
