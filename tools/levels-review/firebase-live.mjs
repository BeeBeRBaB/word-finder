// A live check of the Firebase project with the game's own cloud.js: two throwaway accounts, one
// save and load, the privacy and shape rules, then every record and account it made is deleted.
// It writes to the production project, so run it only with the owner's OK, e.g. after a rules change:
//   node tools/levels-review/firebase-live.mjs   (behind a proxy: NODE_USE_ENV_PROXY=1)
import { makeCloud, FIREBASE, SESSION_KEY } from '../../src/cloud.js';
import { randomBytes } from 'node:crypto';

const REFERER = 'https://beeberbab.github.io/word-finder/';
const KEY = encodeURIComponent(FIREBASE.apiKey);
const DOCS = `https://firestore.googleapis.com/v1/projects/${FIREBASE.projectId}/databases/(default)/documents/users/`;
const AUTH = 'https://identitytoolkit.googleapis.com/v1/accounts:';
/** @param {string} url @param {any} [init] */
const net = (url, init = {}) => fetch(url, { ...init, headers: { ...(init.headers || {}), Referer: REFERER } });
const memStore = () => { const m = new Map(); return { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k) }; };
const tag = randomBytes(3).toString('hex');
const password = randomBytes(12).toString('base64url');
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`); };
const made = [];   // {store} for each account created, cleaned up in finally

try {
  const sa = memStore(), sb = memStore();
  const a = makeCloud({ fetch: net, store: sa }), b = makeCloud({ fetch: net, store: sb });
  const ua = `zz_check_${tag}a`, ub = `zz_check_${tag}b`;

  const accA = await a.signUp(ua, password);
  made.push(sa);
  check('sign-up with a username address', !!accA.uid, ua);
  const progress = { v: 1, seed: 12345, level: 3, points: 420, history: [], current: null };
  await a.save(progress);
  check('save own progress', true);
  const back = await a.load();
  check('load own progress back unchanged', JSON.stringify(back) === JSON.stringify(progress));

  const accB = await b.signUp(ub, password);
  made.push(sb);
  const tokB = JSON.parse(sb.getItem(SESSION_KEY)).idToken;
  const tokA = JSON.parse(sa.getItem(SESSION_KEY)).idToken;
  const read = await net(`${DOCS}${accA.uid}`, { headers: { Authorization: `Bearer ${tokB}` } });
  check("another account cannot read it", read.status === 403, `HTTP ${read.status}`);
  const write = await net(`${DOCS}${accA.uid}`, { method: 'PATCH', headers: { Authorization: `Bearer ${tokB}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: { data: { stringValue: '{}' } } }) });
  check('another account cannot overwrite it', write.status === 403, `HTTP ${write.status}`);
  const shape = await net(`${DOCS}${accA.uid}`, { method: 'PATCH', headers: { Authorization: `Bearer ${tokA}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: { data: { stringValue: '{}' }, extra: { stringValue: 'x' } } }) });
  check('the owner cannot add fields the rules do not allow', shape.status === 403, `HTTP ${shape.status}`);
  const again = await makeCloud({ fetch: net, store: memStore() }).signIn(ua, password);
  check('sign in again on a fresh device', again.uid === accA.uid);
  check('accounts are distinct', accA.uid !== accB.uid);
} catch (e) {
  check('unexpected error', false, `${e && e.code ? e.code + ': ' : ''}${e && e.message}`);
} finally {
  for (const s of made) {
    const sess = JSON.parse(s.getItem(SESSION_KEY) || 'null');
    if (!sess) { check('cleanup: session missing', false); continue; }
    const d = await net(`${DOCS}${sess.uid}`, { method: 'DELETE', headers: { Authorization: `Bearer ${sess.idToken}` } });
    check(`cleanup: delete ${sess.username}'s record`, d.ok, `HTTP ${d.status}`);
    const x = await net(`${AUTH}delete?key=${KEY}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken: sess.idToken }) });
    check(`cleanup: delete ${sess.username}'s account`, x.ok, `HTTP ${x.status}`);
    let gone = false;
    try { await makeCloud({ fetch: net, store: memStore() }).signIn(sess.username, password); } catch (e) { gone = e.code === 'credentials'; }
    check(`cleanup: ${sess.username} can no longer sign in`, gone);
  }
  const failed = results.filter(r => !r.ok).length;
  console.log(`\n${results.length - failed} passed, ${failed} failed`);
  process.exitCode = failed ? 1 : 0;
}
