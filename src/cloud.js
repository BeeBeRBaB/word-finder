// Accounts and a cloud copy of progress, over the Firebase Auth and Firestore REST APIs.
// Pure: the network is an injected fetch and the session an injected store. No Firebase SDK.
import { defaultStore } from './storage.js';

/** The web config of the word-finder-10f77 project. Public by design: firestore.rules guards the
 * data. While either is empty, accounts are hidden. */
export const FIREBASE = Object.freeze({ apiKey: 'AIzaSyB8gwufEWgZkvdXAJH1WKBxxCEQHEFKJnY', projectId: 'word-finder-10f77' });
export const SESSION_KEY = 'wordfinder-session-v1';
// Players type a username; Auth needs an email. RFC 2606 reserves .invalid, so this never
// delivers mail. Auth's email check passes it (2026-10-02); no account was made to prove it.
export const EMAIL_DOMAIN = 'users.word-finder.invalid';

const AUTH = 'https://identitytoolkit.googleapis.com/v1/accounts:';
const TOKEN = 'https://securetoken.googleapis.com/v1/token';
const FIRESTORE = 'https://firestore.googleapis.com/v1/projects/';
// Refresh this long before the id token's stated expiry, so a slow request never carries a dead one.
const EARLY = 60_000;
// Matches the size limit in firestore.rules: a bigger save would only be refused there.
const MAX_DATA = 200_000;

/**
 * @typedef {'taken'|'credentials'|'weak'|'throttled'|'offline'|'invalid'|'unconfigured'|'expired'|'server'} CloudCode
 * @typedef {{apiKey:string, projectId:string}} CloudConfig
 * @typedef {{ok:boolean, status:number, json():Promise<unknown>}} FetchResponse
 * @typedef {(url:string, init:{method:string, headers:Record<string,string>, body?:string, cache?:RequestCache}) => Promise<FetchResponse>} FetchLike
 * @typedef {Pick<Storage,'getItem'|'setItem'|'removeItem'>} SessionStore
 * @typedef {{uid:string, username:string, idToken:string, refreshToken:string, expiresAt:number}} Session
 * @typedef {{uid:string, username:string}} Account
 */

/** @type {Record<CloudCode, string>} */
const MESSAGES = {
  taken: 'That username is taken.',
  credentials: 'Wrong username or password.',
  weak: 'Passwords need at least 6 characters.',
  throttled: 'Too many tries. Wait a minute and try again.',
  offline: "You're offline. Try again when you're connected.",
  invalid: 'Usernames are 3–20 letters, numbers or underscores.',
  unconfigured: "Accounts aren't available yet.",
  expired: 'Please sign in again.',
  server: 'Something went wrong. Try again later.',
};

export class CloudError extends Error {
  /** @param {CloudCode} code @param {string} [message] a player-facing sentence */
  constructor(code, message = MESSAGES[code]) {
    super(message);
    this.name = 'CloudError';
    /** @type {CloudCode} */
    this.code = code;
  }
}

// Auth error messages start with a code, sometimes followed by " : detail".
/** @type {Record<string, CloudCode>} */
const SIGN_IN_ERRORS = {
  EMAIL_EXISTS: 'taken',
  INVALID_LOGIN_CREDENTIALS: 'credentials', INVALID_PASSWORD: 'credentials',
  EMAIL_NOT_FOUND: 'credentials', USER_DISABLED: 'credentials', MISSING_PASSWORD: 'credentials',
  WEAK_PASSWORD: 'weak',
  TOO_MANY_ATTEMPTS_TRY_LATER: 'throttled',
  OPERATION_NOT_ALLOWED: 'unconfigured',   // Email/Password sign-in not enabled in the console
  CONFIGURATION_NOT_FOUND: 'unconfigured', // Authentication never set up for the project
};
/** @type {Record<string, CloudCode>} */
const REFRESH_ERRORS = {
  TOKEN_EXPIRED: 'expired', INVALID_REFRESH_TOKEN: 'expired',
  USER_DISABLED: 'expired', USER_NOT_FOUND: 'expired',
  TOO_MANY_ATTEMPTS_TRY_LATER: 'throttled',
};

/** Trimmed and lowercased, or null when it is not 3-20 of a-z, 0-9 and underscore.
 * @param {unknown} s @returns {string|null} */
export function normalizeUsername(s) {
  if (typeof s !== 'string') return null;
  const u = s.trim().toLowerCase();
  return /^[a-z0-9_]{3,20}$/.test(u) ? u : null;
}

/** @param {unknown} v @returns {v is string} */
const isText = (v) => typeof v === 'string' && v.length > 0;

/** @param {unknown} v @returns {Record<string, any>} */
const asRecord = (v) => (v && typeof v === 'object' ? /** @type {Record<string, any>} */ (v) : {});

/** A stored session, or null unless every field is usable.
 * @param {string} raw @returns {Session|null} */
function parseSession(raw) {
  let s;
  try { s = asRecord(JSON.parse(raw)); } catch { return null; }
  if (!isText(s.uid) || !isText(s.idToken) || !isText(s.refreshToken)) return null;
  if (normalizeUsername(s.username) !== s.username || !Number.isFinite(s.expiresAt)) return null;
  return { uid: s.uid, username: s.username, idToken: s.idToken, refreshToken: s.refreshToken, expiresAt: s.expiresAt };
}

/** Auth reports lifetimes as a string of seconds; an unreadable one is taken as Firebase's hour.
 * @param {unknown} v @returns {number} milliseconds */
function lifetime(v) {
  const n = Number(v);
  return (Number.isFinite(n) && n > 0 ? n : 3600) * 1000;
}

/** @param {unknown} body @param {Record<string, CloudCode>} table @returns {CloudError} */
function authError(body, table) {
  const msg = asRecord(asRecord(body).error).message;
  const key = typeof msg === 'string' ? msg.split(/[ :]/)[0] : '';
  return new CloudError(Object.hasOwn(table, key) ? table[key] : 'server');
}

/** @param {FetchResponse} res @returns {Promise<unknown>} null when the body is not JSON */
async function readJson(res) {
  try { return await res.json(); } catch { return null; }
}

/** @param {{config?:CloudConfig, fetch?:FetchLike, store?:SessionStore|null, now?:() => number}} [deps] */
export function makeCloud(deps = {}) {
  const config = deps.config ?? FIREBASE;
  // Wrapped, not stored bare: calling the real fetch as a method of another object throws.
  /** @type {FetchLike} */
  const fetcher = deps.fetch ?? ((url, init) => globalThis.fetch(url, init));
  const store = deps.store === undefined ? defaultStore() : deps.store;
  const now = deps.now ?? Date.now;
  const enabled = isText(config.apiKey) && isText(config.projectId);
  const key = encodeURIComponent(config.apiKey);

  /** @type {Session|null} */
  let session = null;
  /** @type {{uid:string, p:Promise<Session>}|null} */
  let refreshing = null;

  /** @returns {void} */
  const persist = () => {
    try { if (store) store.setItem(SESSION_KEY, JSON.stringify(session)); } catch { /* not remembered */ }
  };
  /** @returns {void} */
  const forget = () => {
    session = null;
    try { if (store) store.removeItem(SESSION_KEY); } catch { /* nothing to forget */ }
  };

  if (enabled) {
    // Reading localStorage can itself throw (see storage.js), so the read is guarded too.
    try {
      const raw = store ? store.getItem(SESSION_KEY) : null;
      if (raw) { session = parseSession(raw); if (!session) forget(); }
    } catch { session = null; }
  }

  /** @param {string} url @param {{method:string, headers:Record<string,string>, body?:string, cache?:RequestCache}} init
   * @returns {Promise<FetchResponse>} */
  async function send(url, init) {
    try { return await fetcher(url, init); } catch { throw new CloudError('offline'); }
  }

  /** @param {'signUp'|'signInWithPassword'} endpoint @param {string} username @param {string} password
   * @returns {Promise<Account>} */
  async function authenticate(endpoint, username, password) {
    const res = await send(`${AUTH}${endpoint}?key=${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: `${username}@${EMAIL_DOMAIN}`, password, returnSecureToken: true }),
    });
    const body = await readJson(res);
    if (!res.ok) throw authError(body, SIGN_IN_ERRORS);
    const b = asRecord(body);
    if (!isText(b.localId) || !isText(b.idToken) || !isText(b.refreshToken)) throw new CloudError('server');
    session = { uid: b.localId, username, idToken: b.idToken, refreshToken: b.refreshToken, expiresAt: now() + lifetime(b.expiresIn) };
    persist();
    return { uid: session.uid, username };
  }

  /** A new id token for `s`. Concurrent callers for the same account share one request, so
   * one still in flight after a switch of account is never handed to the next player.
   * @param {Session} s @returns {Promise<Session>} */
  function refresh(s) {
    if (refreshing?.uid !== s.uid) {
      const p = exchange(s).finally(() => { if (refreshing?.p === p) refreshing = null; });
      refreshing = { uid: s.uid, p };
    }
    return refreshing.p;
  }

  /** @param {Session} s @returns {Promise<Session>} */
  async function exchange(s) {
    const res = await send(`${TOKEN}?key=${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: s.refreshToken }).toString(),
    });
    const body = await readJson(res);
    // Only the session this refresh was for is touched: a sign-out meanwhile stays signed out.
    const current = () => session !== null && session.uid === s.uid;
    if (!res.ok) {
      const err = authError(body, REFRESH_ERRORS);
      if (err.code === 'expired' && current()) forget();
      throw err;
    }
    const b = asRecord(body);
    if (!isText(b.id_token) || !isText(b.refresh_token)) throw new CloudError('server');
    const next = { ...s, idToken: b.id_token, refreshToken: b.refresh_token, expiresAt: now() + lifetime(b.expires_in) };
    if (current()) { session = next; persist(); }
    return next;
  }

  /** One request for the signed-in player's document, refreshing the token when it is about
   * to expire and once more on a 401/403, with a single retry.
   * @param {'GET'|'PATCH'} method @param {string} [body] @returns {Promise<FetchResponse>} */
  async function doc(method, body) {
    if (!enabled) throw new CloudError('unconfigured');
    let s = session;
    if (!s) throw new CloudError('expired');
    const url = `${FIRESTORE}${encodeURIComponent(config.projectId)}/databases/(default)/documents/users/${encodeURIComponent(s.uid)}`;
    // no-store: a document is per account, so neither cache may answer for it.
    /** @param {Session} t */
    const go = (t) => send(url, {
      method,
      cache: 'no-store',
      headers: body === undefined
        ? { Authorization: `Bearer ${t.idToken}` }
        : { Authorization: `Bearer ${t.idToken}`, 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body }),
    });
    if (now() >= s.expiresAt - EARLY) s = await refresh(s);
    let res = await go(s);
    if (res.status === 401 || res.status === 403) {
      s = await refresh(s);
      res = await go(s);
    }
    return res;
  }

  /** @param {FetchResponse} res @returns {CloudError} */
  const docError = (res) => new CloudError(res.status === 429 ? 'throttled' : 'server');

  return {
    enabled,

    /** @returns {Account|null} */
    session: () => (session ? { uid: session.uid, username: session.username } : null),

    /** @param {string} username @param {string} password @returns {Promise<Account>} */
    async signUp(username, password) {
      if (!enabled) throw new CloudError('unconfigured');
      const u = normalizeUsername(username);
      if (!u) throw new CloudError('invalid');
      if (typeof password !== 'string' || password.length < 6) throw new CloudError('weak');
      return authenticate('signUp', u, password);
    },

    /** @param {string} username @param {string} password @returns {Promise<Account>} */
    async signIn(username, password) {
      if (!enabled) throw new CloudError('unconfigured');
      const u = normalizeUsername(username);
      if (!u) throw new CloudError('invalid');
      if (!isText(password)) throw new CloudError('credentials');
      return authenticate('signInWithPassword', u, password);
    },

    /** @returns {void} */
    signOut: forget,

    /** The parsed `data` field; null when there is no document or its data is unreadable.
     * A 200 whose body cannot be read throws: null would invite a save over a good copy.
     * @returns {Promise<unknown|null>} */
    async load() {
      const res = await doc('GET');
      if (res.status === 404) return null;
      if (!res.ok) throw docError(res);
      const body = await readJson(res);
      if (body === null) throw new CloudError('server');
      const text = asRecord(asRecord(asRecord(body).fields).data).stringValue;
      if (typeof text !== 'string') return null;
      try { return JSON.parse(text); } catch { return null; }
    },

    /** Replace the document. `level` and `points` are copied out when they are safe integers,
     * so a leaderboard can query them without parsing `data`.
     * @param {unknown} data @returns {Promise<void>} */
    async save(data) {
      if (!enabled) throw new CloudError('unconfigured');
      let json;
      try { json = JSON.stringify(data === undefined ? null : data); } catch { json = ''; }
      if (!json || json.length >= MAX_DATA) throw new CloudError('invalid', 'This progress cannot be saved online.');
      /** @type {Record<string, object>} */
      const fields = { data: { stringValue: json } };
      const d = asRecord(data);
      if (Number.isSafeInteger(d.level)) fields.level = { integerValue: String(d.level) };
      if (Number.isSafeInteger(d.points)) fields.points = { integerValue: String(d.points) };
      fields.updated = { timestampValue: new Date(now()).toISOString() };
      const res = await doc('PATCH', JSON.stringify({ fields }));
      if (!res.ok) throw docError(res);
    },
  };
}
