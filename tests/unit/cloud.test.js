import test from 'node:test';
import assert from 'node:assert/strict';
import {
  makeCloud, normalizeUsername, CloudError, FIREBASE, SESSION_KEY, EMAIL_DOMAIN,
} from '../../src/cloud.js';
import { memStore } from './helpers.js';

const CONFIG = { apiKey: 'test-key', projectId: 'demo-proj' };
const PASSWORD = 'correct-horse-7';
const SIGN_UP = 'https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=test-key';
const SIGN_IN = 'https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=test-key';
const TOKEN = 'https://securetoken.googleapis.com/v1/token?key=test-key';
const DOC = 'https://firestore.googleapis.com/v1/projects/demo-proj/databases/(default)/documents/users/uid-1';
const T0 = 1_700_000_000_000;

/** @param {number} status @param {unknown} [body] */
const reply = (status, body) => ({ status, body });
const authOk = (n = 1) => reply(200, { localId: 'uid-1', idToken: `id-${n}`, refreshToken: `rt-${n}`, expiresIn: '3600' });
const tokenOk = (n = 2) => reply(200, { id_token: `id-${n}`, refresh_token: `rt-${n}`, expires_in: '3600', user_id: 'uid-1' });
/** @param {number} status @param {string} message */
const fail = (status, message) => reply(status, { error: { code: status, message } });
const docOk = (data) => reply(200, { name: 'x', fields: { data: { stringValue: JSON.stringify(data) } } });

/** A scripted fetch: each call takes the next reply, 'offline' rejects. Every request is
 * recorded, and one carrying the password anywhere but the body fails the test outright.
 * @param {...any} replies */
function fakeFetch(...replies) {
  /** @type {{url:string, method:string, headers:Record<string,string>, body?:string}[]} */
  const calls = [];
  /** @param {string} url @param {any} init */
  const fn = async (url, init) => {
    assert.ok(!url.includes(PASSWORD) && !url.includes(encodeURIComponent(PASSWORD)), `password in URL ${url}`);
    assert.ok(!JSON.stringify(init.headers).includes(PASSWORD), 'password in headers');
    calls.push({ url, ...init });
    let r = replies.shift();
    if (!r) throw new Error(`unexpected request ${url}`);
    if (typeof r.then === 'function') r = await r;   // a reply the test releases later
    if (r === 'offline') throw new TypeError('Failed to fetch');
    return {
      ok: r.status >= 200 && r.status < 300,
      status: r.status,
      json: async () => { if (r.body === undefined) throw new SyntaxError('no body'); return r.body; },
    };
  };
  return Object.assign(fn, { calls, left: () => replies.length });
}

/** @param {any[]} replies @param {{store?:any, config?:any}} [opt] */
function setup(replies, opt = {}) {
  const clock = { t: T0 };
  const fetch = fakeFetch(...replies);
  const store = opt.store === undefined ? memStore() : opt.store;
  const cloud = makeCloud({ config: opt.config ?? CONFIG, fetch, store, now: () => clock.t });
  return { cloud, fetch, store, clock };
}

/** Signed in as alice with id-1/rt-1, expiring an hour after T0; `replies` follow the sign-in. */
async function signedIn(replies = [], opt = {}) {
  const env = setup([authOk(), ...replies], opt);
  await env.cloud.signIn('alice', PASSWORD);
  env.fetch.calls.length = 0;
  return env;
}

/** @param {Promise<unknown>} p @param {string} code */
async function rejectsWith(p, code) {
  await assert.rejects(p, (err) => {
    assert.ok(err instanceof CloudError, `not a CloudError: ${err}`);
    assert.equal(err.code, code);
    return true;
  });
}

test('usernames are trimmed, lowercased and held to 3-20 of a-z 0-9 _', () => {
  assert.equal(normalizeUsername('  Alice_99 '), 'alice_99');
  assert.equal(normalizeUsername('abc'), 'abc');
  assert.equal(normalizeUsername('a'.repeat(20)), 'a'.repeat(20));
  for (const bad of ['ab', 'a'.repeat(21), 'al ice', 'alice!', 'élan', 'a.b.c', '', 42, null, undefined]) {
    assert.equal(normalizeUsername(bad), null, String(bad));
  }
});

// Not pinned to empty: the owner fills FIREBASE in, and that push must still pass the suite.
test('an empty config hides accounts and every call is unconfigured', async () => {
  assert.ok(Object.isFrozen(FIREBASE));
  assert.equal(makeCloud({ fetch: fakeFetch(), store: null }).enabled, Boolean(FIREBASE.apiKey && FIREBASE.projectId),
    'the default config is FIREBASE');
  if (FIREBASE.apiKey && FIREBASE.projectId) {
    const f = fakeFetch(fail(400, 'EMAIL_NOT_FOUND'));
    await rejectsWith(makeCloud({ fetch: f, store: null }).signIn('alice', PASSWORD), 'credentials');
    assert.ok(f.calls[0].url.endsWith(`?key=${encodeURIComponent(FIREBASE.apiKey)}`), 'the default key is FIREBASE\'s');
  }
  const store = memStore();
  store.setItem(SESSION_KEY, JSON.stringify({ uid: 'u', username: 'alice', idToken: 'i', refreshToken: 'r', expiresAt: T0 }));
  const fetch = fakeFetch();
  const cloud = makeCloud({ config: { apiKey: '', projectId: '' }, fetch, store });
  assert.equal(cloud.enabled, false);
  assert.equal(cloud.session(), null, 'a stored session is not surfaced while disabled');
  await rejectsWith(cloud.signUp('alice', PASSWORD), 'unconfigured');
  await rejectsWith(cloud.signIn('alice', PASSWORD), 'unconfigured');
  await rejectsWith(cloud.load(), 'unconfigured');
  await rejectsWith(cloud.save({}), 'unconfigured');
  await rejectsWith(cloud.save(() => 1), 'unconfigured');
  assert.equal(fetch.calls.length, 0);
  for (const config of [{ apiKey: 'k', projectId: '' }, { apiKey: '', projectId: 'p' }]) {
    assert.equal(makeCloud({ config, fetch, store }).enabled, false);
  }
  assert.equal(makeCloud({ config: CONFIG, fetch, store: null }).enabled, true);
});

test('sign up posts the synthetic email and password as JSON, and keeps the session', async () => {
  const { cloud, fetch, store, clock } = setup([authOk()]);
  assert.deepEqual(await cloud.signUp(' Alice ', PASSWORD), { uid: 'uid-1', username: 'alice' });
  assert.equal(fetch.calls.length, 1);
  const c = fetch.calls[0];
  assert.equal(c.url, SIGN_UP);
  assert.equal(c.method, 'POST');
  assert.deepEqual(c.headers, { 'Content-Type': 'application/json' });
  assert.deepEqual(JSON.parse(String(c.body)),
    { email: `alice@${EMAIL_DOMAIN}`, password: PASSWORD, returnSecureToken: true });
  assert.deepEqual(cloud.session(), { uid: 'uid-1', username: 'alice' });
  const saved = String(store.getItem(SESSION_KEY));
  assert.deepEqual(JSON.parse(saved),
    { uid: 'uid-1', username: 'alice', idToken: 'id-1', refreshToken: 'rt-1', expiresAt: clock.t + 3_600_000 });
  assert.ok(!saved.includes(PASSWORD), 'the password is never stored');
});

test('sign in posts to signInWithPassword and a new instance restores the session', async () => {
  const { cloud, fetch, store } = setup([authOk()]);
  assert.deepEqual(await cloud.signIn('BOB_1', PASSWORD), { uid: 'uid-1', username: 'bob_1' });
  const c = fetch.calls[0];
  assert.equal(c.url, SIGN_IN);
  assert.equal(c.method, 'POST');
  assert.deepEqual(c.headers, { 'Content-Type': 'application/json' });
  assert.deepEqual(JSON.parse(String(c.body)),
    { email: `bob_1@${EMAIL_DOMAIN}`, password: PASSWORD, returnSecureToken: true });

  const again = makeCloud({ config: CONFIG, fetch: fakeFetch(docOk({ level: 1 })), store, now: () => T0 });
  assert.deepEqual(again.session(), { uid: 'uid-1', username: 'bob_1' });
});

test('an unreadable or non-positive expiresIn is taken as an hour', async () => {
  for (const expiresIn of ['soon', '0', '-5', undefined]) {
    const { cloud, store, clock } = setup([reply(200, { localId: 'uid-1', idToken: 'i', refreshToken: 'r', expiresIn })]);
    await cloud.signIn('alice', PASSWORD);
    assert.equal(JSON.parse(String(store.getItem(SESSION_KEY))).expiresAt, clock.t + 3_600_000, String(expiresIn));
  }
});

test('client-side checks refuse before any request', async () => {
  const { cloud, fetch } = setup([]);
  await rejectsWith(cloud.signUp('no', PASSWORD), 'invalid');
  await rejectsWith(cloud.signUp('has space', PASSWORD), 'invalid');
  await rejectsWith(cloud.signUp('alice', '12345'), 'weak');
  await rejectsWith(cloud.signUp('alice', /** @type {any} */ (null)), 'weak');
  await rejectsWith(cloud.signIn('x', PASSWORD), 'invalid');
  await rejectsWith(cloud.signIn('alice', ''), 'credentials');
  assert.equal(fetch.calls.length, 0);
  assert.equal(cloud.session(), null);
});

test('each Auth error maps to a code with a player-facing message', async () => {
  /** @type {[string, string][]} */
  const table = [
    ['EMAIL_EXISTS', 'taken'],
    ['INVALID_LOGIN_CREDENTIALS', 'credentials'],
    ['INVALID_PASSWORD', 'credentials'],
    ['EMAIL_NOT_FOUND', 'credentials'],
    ['USER_DISABLED', 'credentials'],
    ['MISSING_PASSWORD', 'credentials'],
    ['WEAK_PASSWORD : Password should be at least 6 characters', 'weak'],
    ['TOO_MANY_ATTEMPTS_TRY_LATER : Access to this account has been temporarily disabled', 'throttled'],
    ['OPERATION_NOT_ALLOWED', 'unconfigured'],
    ['CONFIGURATION_NOT_FOUND', 'unconfigured'],
    ['SOMETHING_NEW', 'server'],
    ['constructor', 'server'],
  ];
  for (const [message, code] of table) {
    const { cloud } = setup([fail(400, message)]);
    await assert.rejects(cloud.signUp('alice', PASSWORD), (err) => {
      assert.ok(err instanceof CloudError && err instanceof Error);
      assert.equal(err.name, 'CloudError');
      assert.equal(err.code, code, message);
      assert.ok(err.message.length > 0 && err.message !== message, 'a sentence, not the raw code');
      return true;
    });
    assert.equal(cloud.session(), null);
  }
  for (const r of [reply(500), reply(503, { error: 'nope' }), reply(400, { error: { message: 7 } })]) {
    await rejectsWith(setup([r]).cloud.signIn('alice', PASSWORD), 'server');
  }
});

test('a 200 without usable tokens is a server error, not a session', async () => {
  for (const body of [undefined, null, { localId: 'uid-1', idToken: 'i' }, { localId: '', idToken: 'i', refreshToken: 'r' }]) {
    const { cloud, store } = setup([reply(200, body)]);
    await rejectsWith(cloud.signIn('alice', PASSWORD), 'server');
    assert.equal(cloud.session(), null);
    assert.equal(store.getItem(SESSION_KEY), null);
  }
});

test('a rejected fetch is offline, and leaves the session alone', async () => {
  await rejectsWith(setup(['offline']).cloud.signUp('alice', PASSWORD), 'offline');
  const { cloud } = await signedIn(['offline', 'offline']);
  await rejectsWith(cloud.load(), 'offline');
  await rejectsWith(cloud.save({ level: 1 }), 'offline');
  assert.deepEqual(cloud.session(), { uid: 'uid-1', username: 'alice' });
});

test('load GETs the player document with the id token and parses its data field', async () => {
  const { cloud, fetch } = await signedIn([docOk({ level: 4, words: ['A'] })]);
  assert.deepEqual(await cloud.load(), { level: 4, words: ['A'] });
  assert.equal(fetch.calls.length, 1);
  const c = fetch.calls[0];
  assert.equal(c.url, DOC);
  assert.equal(c.method, 'GET');
  assert.equal(c.cache, 'no-store', "the browser's HTTP cache must never answer for another account");
  assert.deepEqual(c.headers, { Authorization: 'Bearer id-1' });
  assert.equal(c.body, undefined);
  assert.equal('body' in c, false);
});

test('load is null for a missing document or unreadable data, and throws on other failures', async () => {
  const { cloud } = await signedIn([
    reply(404, { error: { code: 404, status: 'NOT_FOUND' } }),
    reply(200, { name: 'x', fields: {} }),
    reply(200, { name: 'x', fields: { data: { stringValue: '{broken' } } }),
    reply(200),
    reply(500, { error: { code: 500 } }),
    reply(429, { error: { code: 429 } }),
  ]);
  assert.equal(await cloud.load(), null);
  assert.equal(await cloud.load(), null);
  assert.equal(await cloud.load(), null);
  // The document exists but its body never arrived: null would read as "no copy yet".
  await rejectsWith(cloud.load(), 'server');
  await rejectsWith(cloud.load(), 'server');
  await rejectsWith(cloud.load(), 'throttled');
});

test('save PATCHes the whole document, copying integer level and points out of data', async () => {
  const { cloud, fetch, clock } = await signedIn([reply(200, {})]);
  const data = { level: 3, points: 120, seen: { a: 1 } };
  await cloud.save(data);
  const c = fetch.calls[0];
  assert.equal(c.url, DOC);
  assert.equal(c.cache, 'no-store');
  assert.equal(c.method, 'PATCH');
  assert.deepEqual(c.headers, { Authorization: 'Bearer id-1', 'Content-Type': 'application/json' });
  assert.deepEqual(JSON.parse(String(c.body)), {
    fields: {
      data: { stringValue: JSON.stringify(data) },
      level: { integerValue: '3' },
      points: { integerValue: '120' },
      updated: { timestampValue: new Date(clock.t).toISOString() },
    },
  });
});

test('save leaves out a level or points that is not an integer', async () => {
  const { cloud, fetch } = await signedIn([reply(200, {}), reply(200, {}), reply(200, {}), reply(200, {}), reply(200, {})]);
  await cloud.save({ level: 2.5, points: '10' });
  await cloud.save([1, 2]);
  await cloud.save(undefined);
  // Only safe integers: past 2^53 a double no longer names one integer, and 1e21 is past int64.
  await cloud.save({ level: 1e21, points: -(2 ** 53) });
  await cloud.save({ level: Number.MAX_SAFE_INTEGER, points: -5 });
  const fields = fetch.calls.map(c => JSON.parse(String(c.body)).fields);
  for (const f of fields.slice(0, 4)) assert.deepEqual(Object.keys(f).sort(), ['data', 'updated']);
  assert.equal(fields[1].data.stringValue, '[1,2]');
  assert.equal(fields[2].data.stringValue, 'null');
  assert.deepEqual(fields[4].level, { integerValue: String(Number.MAX_SAFE_INTEGER) });
  assert.deepEqual(fields[4].points, { integerValue: '-5' });
});

test('save refuses data the rules would refuse, without a request', async () => {
  const { cloud, fetch } = await signedIn();
  await rejectsWith(cloud.save({ blob: 'x'.repeat(200_000) }), 'invalid');
  await rejectsWith(cloud.save({ n: 1n }), 'invalid');
  await rejectsWith(cloud.save(() => 1), 'invalid');
  // A JSON string is its characters plus two quotes: 200000 is refused, 199999 goes out.
  await rejectsWith(cloud.save('x'.repeat(199_998)), 'invalid');
  assert.equal(fetch.calls.length, 0);
  await rejectsWith(signedIn().then(e => e.cloud.save('x'.repeat(199_997))), 'offline');
});

test('save maps a failed PATCH to a code', async () => {
  const { cloud } = await signedIn([reply(500, { error: { code: 500 } }), reply(429, {})]);
  await rejectsWith(cloud.save({ level: 1 }), 'server');
  await rejectsWith(cloud.save({ level: 1 }), 'throttled');
});

test('the id token is refreshed a minute before it expires, form-encoded, and kept', async () => {
  const { cloud, fetch, store, clock } = await signedIn([docOk(1), tokenOk(2), docOk(2)]);
  clock.t = T0 + 3_600_000 - 60_001;
  assert.equal(await cloud.load(), 1);
  assert.deepEqual(fetch.calls.map(c => c.url), [DOC], 'no refresh just outside the margin');

  clock.t += 1;
  assert.equal(await cloud.load(), 2);
  const [r, get] = fetch.calls.slice(1);
  assert.equal(r.url, TOKEN);
  assert.equal(r.method, 'POST');
  assert.deepEqual(r.headers, { 'Content-Type': 'application/x-www-form-urlencoded' });
  assert.equal(r.body, 'grant_type=refresh_token&refresh_token=rt-1');
  assert.deepEqual(get.headers, { Authorization: 'Bearer id-2' });
  assert.deepEqual(JSON.parse(String(store.getItem(SESSION_KEY))),
    { uid: 'uid-1', username: 'alice', idToken: 'id-2', refreshToken: 'rt-2', expiresAt: clock.t + 3_600_000 });
});

test('a 401 or 403 from Firestore refreshes once and retries once', async () => {
  for (const status of [401, 403]) {
    const { cloud, fetch } = await signedIn([reply(status, {}), tokenOk(2), docOk('ok')]);
    assert.equal(await cloud.load(), 'ok');
    assert.deepEqual(fetch.calls.map(c => c.url), [DOC, TOKEN, DOC]);
    assert.deepEqual(fetch.calls.map(c => c.headers.Authorization), ['Bearer id-1', undefined, 'Bearer id-2']);
  }
  const { cloud, fetch } = await signedIn([reply(401, {}), tokenOk(2), reply(401, {})]);
  await rejectsWith(cloud.save({ level: 1 }), 'server');
  assert.deepEqual(fetch.calls.map(c => c.url), [DOC, TOKEN, DOC], 'no second refresh or retry');
  const [first, , retry] = fetch.calls;
  assert.equal(retry.method, 'PATCH');
  assert.equal(retry.body, first.body, 'the retry sends the same document');
  assert.deepEqual(retry.headers, { Authorization: 'Bearer id-2', 'Content-Type': 'application/json' });
  assert.equal(fetch.left(), 0);
  assert.deepEqual(cloud.session(), { uid: 'uid-1', username: 'alice' });
});

test('a refresh token Auth no longer honours ends the session', async () => {
  for (const message of ['TOKEN_EXPIRED', 'INVALID_REFRESH_TOKEN', 'USER_DISABLED', 'USER_NOT_FOUND']) {
    const { cloud, fetch, store } = await signedIn([reply(401, {}), fail(400, message)]);
    await rejectsWith(cloud.load(), 'expired');
    assert.equal(cloud.session(), null, message);
    assert.equal(store.getItem(SESSION_KEY), null);
    await rejectsWith(cloud.load(), 'expired');
    await rejectsWith(cloud.save({}), 'expired');
    assert.equal(fetch.calls.length, 2, 'signed out: no further requests');
  }
});

test('a refresh that fails any other way keeps the session', async () => {
  const cases = [
    [fail(400, 'TOO_MANY_ATTEMPTS_TRY_LATER'), 'throttled'],
    [fail(400, 'MISSING_REFRESH_TOKEN'), 'server'],
    ['offline', 'offline'],
    [reply(200, { id_token: 'i' }), 'server'],
    [reply(200), 'server'],
  ];
  for (const [r, code] of cases) {
    const { cloud, store, clock } = await signedIn([r]);
    clock.t = T0 + 3_600_000;
    await rejectsWith(cloud.load(), String(code));
    assert.deepEqual(cloud.session(), { uid: 'uid-1', username: 'alice' });
    assert.equal(JSON.parse(String(store.getItem(SESSION_KEY))).idToken, 'id-1');
  }
});

test('concurrent calls share one refresh', async () => {
  const { cloud, fetch, clock } = await signedIn([tokenOk(2), docOk('a'), docOk('b')]);
  clock.t = T0 + 3_600_000;
  assert.deepEqual(await Promise.all([cloud.load(), cloud.load()]), ['a', 'b']);
  assert.deepEqual(fetch.calls.map(c => c.url), [TOKEN, DOC, DOC]);
  assert.ok(fetch.calls.slice(1).every(c => c.headers.Authorization === 'Bearer id-2'));
});

test('sign out forgets the session, and a refresh already in flight does not bring it back', async () => {
  const { cloud, fetch, store, clock } = await signedIn([tokenOk(2), docOk('late')]);
  clock.t = T0 + 3_600_000;
  const pending = cloud.load();
  cloud.signOut();
  assert.equal(cloud.session(), null);
  assert.equal(store.getItem(SESSION_KEY), null);
  assert.equal(await pending, 'late');
  assert.equal(cloud.session(), null);
  assert.equal(store.getItem(SESSION_KEY), null);
  assert.equal(fetch.calls.length, 2);

  // Refresh fails only after someone else has signed in: their session must survive it.
  /** @type {(v: unknown) => void} */
  let release = () => {};
  const late = new Promise(res => { release = res; });
  const env = await signedIn([late, reply(200, { localId: 'uid-2', idToken: 'j', refreshToken: 's', expiresIn: '3600' })]);
  env.clock.t = T0 + 3_600_000;
  const p = env.cloud.load();
  env.cloud.signOut();
  await env.cloud.signIn('bob', PASSWORD);
  release(fail(400, 'TOKEN_EXPIRED'));
  await rejectsWith(p, 'expired');
  assert.deepEqual(env.cloud.session(), { uid: 'uid-2', username: 'bob' });
  assert.equal(JSON.parse(String(env.store.getItem(SESSION_KEY))).uid, 'uid-2');
});

test('a refresh in flight for one account is never handed to the next', async () => {
  /** @type {((v: unknown) => void)[]} */
  const release = [];
  const held = () => new Promise(res => { release.push(res); });
  const bob = reply(200, { localId: 'uid-2', idToken: 'j-1', refreshToken: 's-1', expiresIn: '3600' });
  const bobToken = reply(200, { id_token: 'j-2', refresh_token: 's-2', expires_in: '3600', user_id: 'uid-2' });
  const { cloud, fetch, clock } = await signedIn([held(), bob, reply(403, {}), held(), docOk('one'), docOk('two')]);
  clock.t = T0 + 3_600_000;
  const alice = cloud.load().catch(e => e.code);
  cloud.signOut();
  await cloud.signIn('bob', PASSWORD);
  const first = cloud.load();
  // Bob's GET is refused, so he refreshes while Alice's refresh is still held.
  await new Promise(res => setTimeout(res, 0));
  release[0](fail(400, 'TOKEN_EXPIRED'));
  assert.equal(await alice, 'expired');
  // Alice's refresh settling must not drop Bob's: a second call joins it rather than asking again.
  clock.t = T0 + 7_200_000;
  const second = cloud.load();
  release[1](bobToken);
  assert.deepEqual(await Promise.all([first, second]), ['one', 'two']);
  const bobDoc = DOC.replace('uid-1', 'uid-2');
  assert.deepEqual(fetch.calls.map(c => c.url), [TOKEN, SIGN_IN, bobDoc, TOKEN, bobDoc, bobDoc]);
  assert.equal(fetch.calls[3].body, 'grant_type=refresh_token&refresh_token=s-1');
  assert.deepEqual(fetch.calls.slice(4).map(c => c.headers.Authorization), ['Bearer j-2', 'Bearer j-2']);
  assert.deepEqual(cloud.session(), { uid: 'uid-2', username: 'bob' });
});

test('a garbled stored session is discarded', async () => {
  const good = { uid: 'uid-1', username: 'alice', idToken: 'i', refreshToken: 'r', expiresAt: T0 };
  const garbled = [
    '{not json', 'null', '[]', '"alice"',
    JSON.stringify({ ...good, uid: '' }),
    JSON.stringify({ ...good, idToken: 5 }),
    JSON.stringify({ ...good, refreshToken: undefined }),
    JSON.stringify({ ...good, username: 'Alice' }),
    JSON.stringify({ ...good, username: 'a' }),
    JSON.stringify({ ...good, expiresAt: String(T0) }),
    JSON.stringify({ ...good, expiresAt: null }),
  ];
  for (const raw of garbled) {
    const store = memStore();
    store.setItem(SESSION_KEY, raw);
    const cloud = makeCloud({ config: CONFIG, fetch: fakeFetch(), store, now: () => T0 });
    assert.equal(cloud.session(), null, raw);
    assert.equal(store.getItem(SESSION_KEY), null, `${raw} is removed`);
    await rejectsWith(cloud.load(), 'expired');
  }
  const store = memStore();
  store.setItem(SESSION_KEY, JSON.stringify(good));
  assert.deepEqual(makeCloud({ config: CONFIG, fetch: fakeFetch(), store }).session(), { uid: 'uid-1', username: 'alice' });
});

test('a throwing or missing store still signs in, for this session only', async () => {
  const bad = {
    getItem() { throw new Error('blocked'); },
    setItem() { throw new Error('blocked'); },
    removeItem() { throw new Error('blocked'); },
  };
  for (const store of [bad, null]) {
    const { cloud } = setup([authOk(), docOk(7)], { store });
    assert.equal(cloud.session(), null);
    await cloud.signIn('alice', PASSWORD);
    assert.equal(await cloud.load(), 7);
    cloud.signOut();
    assert.equal(cloud.session(), null);
  }
  const removeThrows = memStore();
  removeThrows.setItem(SESSION_KEY, '{bad');
  removeThrows.removeItem = () => { throw new Error('blocked'); };
  assert.equal(makeCloud({ config: CONFIG, fetch: fakeFetch(), store: removeThrows }).session(), null);
});

test('config values and the uid are encoded into the URL', async () => {
  const config = { apiKey: 'k&x=1', projectId: 'p/q' };
  const env = setup([reply(200, { localId: 'a/b?c', idToken: 'i', refreshToken: 'r', expiresIn: '3600' }), docOk(0)], { config });
  await env.cloud.signIn('alice', PASSWORD);
  await env.cloud.load();
  assert.equal(env.fetch.calls[0].url, 'https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=k%26x%3D1');
  assert.equal(env.fetch.calls[1].url,
    'https://firestore.googleapis.com/v1/projects/p%2Fq/databases/(default)/documents/users/a%2Fb%3Fc');
});

test('without injected fetch or clock it uses the global fetch and Date.now', async () => {
  const saved = globalThis.fetch;
  const fetch = fakeFetch(authOk());
  globalThis.fetch = /** @type {any} */ (fetch);
  try {
    const store = memStore();
    const before = Date.now();
    await makeCloud({ config: CONFIG, store }).signIn('alice', PASSWORD);
    const { expiresAt } = JSON.parse(String(store.getItem(SESSION_KEY)));
    assert.ok(expiresAt >= before + 3_600_000 && expiresAt <= Date.now() + 3_600_000);
    assert.equal(fetch.calls.length, 1);
  } finally {
    globalThis.fetch = saved;
  }
  assert.equal(makeCloud({ config: CONFIG, fetch: fakeFetch() }).session(), null, 'no localStorage in Node: no session');
});
