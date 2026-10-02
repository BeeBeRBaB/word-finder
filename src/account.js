// The Account section of Settings and the sign-in form. Each renders into a host main.js gives
// it, and talks to the account only through levelplay.js; how Settings pages open is main.js's.

/**
 * @typedef {import('./levelplay.js').Status} Status
 * @typedef {import('./cloud.js').Account} Account
 * @typedef {{status():Status, signIn(u:string, p:string):Promise<Account>,
 *   signUp(u:string, p:string):Promise<Account>, signOut():void}} AccountPlay
 */

/** @param {Document} doc @param {string} tag @param {string} [cls] @param {string} [text]
 * @returns {HTMLElement} */
function make(doc, tag, cls, text) {
  const el = doc.createElement(tag);
  if (cls) el.className = cls;
  if (text) el.textContent = text;
  return el;
}

/** @param {number} n @returns {string} */
const grouped = (n) => String(Math.max(0, Math.round(n))).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

/** One line on where the account stands. @param {Status} s @returns {string} */
export function accountLine(s) {
  const saved = s.error === 'offline' ? 'offline, saved here'
    : s.error || s.pending ? 'not saved online yet' : 'saved';
  return `Level ${s.level} · ${grouped(s.points)} ${s.points === 1 ? 'point' : 'points'} · ${saved}`;
}

/** Render the Account section into `host`: Sign in when signed out, the account and Sign out
 * when signed in. Signing out with progress not yet saved online asks once more.
 * @param {HTMLElement} host @param {AccountPlay} play
 * @param {{onSignIn:() => void, onSignOut:() => void}} on @returns {void} */
export function renderAccount(host, play, on) {
  const doc = host.ownerDocument;
  const s = play.status();
  const row = make(doc, 'div', 'acct-row');
  const who = make(doc, 'span', 'acct-who');
  const seg = make(doc, 'div', 'seg acct-seg');
  const btn = /** @type {HTMLButtonElement} */ (make(doc, 'button', '', s.signedIn ? 'Sign out' : 'Sign in'));
  btn.type = 'button';
  btn.setAttribute('aria-pressed', 'false');
  seg.append(btn);
  if (s.signedIn) {
    who.append(make(doc, 'b', 'acct-name', s.username ?? ''), make(doc, 'small', 'acct-line', accountLine(s)));
  } else {
    who.append(make(doc, 'span', 'acct-name', 'Levels'), make(doc, 'small', 'acct-line', 'Numbered puzzles that keep your points on any device.'));
  }
  row.append(who, seg);
  const warn = make(doc, 'p', 'panenote acct-warn', "Your latest progress isn't saved online yet. Signing out here loses it.");
  warn.hidden = true;
  host.replaceChildren(make(doc, 'h3', 'panesection', 'Account'), row, warn);
  btn.addEventListener('click', () => {
    if (!s.signedIn) { on.onSignIn(); return; }
    if (play.status().pending && warn.hidden) {
      warn.hidden = false;
      btn.textContent = 'Sign out anyway';
      return;
    }
    play.signOut();
    on.onSignOut();
  });
}

/** Render the sign-in form into `host`. One form serves both Sign in and Create an account;
 * a refused attempt shows the account's own message and keeps what was typed.
 * @param {HTMLElement} host @param {AccountPlay} play @param {{onDone:(a:Account) => void}} on
 * @returns {{focus():void}} */
export function renderSignIn(host, play, on) {
  const doc = host.ownerDocument;
  let creating = false, busy = false;
  const form = /** @type {HTMLFormElement} */ (make(doc, 'form', 'acct-form'));
  form.noValidate = true;   // the account's own checks give the messages
  const intro = make(doc, 'p', 'panenote', 'Sign in to play levels. Random play never needs an account.');

  /** @param {string} id @param {string} label @param {string} type @returns {HTMLInputElement} */
  const field = (id, label, type) => {
    const wrap = make(doc, 'div', 'acct-field');
    const l = /** @type {HTMLLabelElement} */ (make(doc, 'label', 'panelabel', label));
    l.htmlFor = id;
    const input = /** @type {HTMLInputElement} */ (make(doc, 'input'));
    Object.assign(input, { id, type, name: id, required: true, spellcheck: false });
    input.setAttribute('autocapitalize', 'none');
    input.setAttribute('autocorrect', 'off');
    wrap.append(l, input);
    form.append(wrap);
    return input;
  };
  form.append(intro);
  const user = field('acct-username', 'Username', 'text');
  user.autocomplete = 'username';
  user.maxLength = 20;
  const pass = field('acct-password', 'Password', 'password');
  const err = make(doc, 'p', 'acct-err');
  err.setAttribute('role', 'alert');
  err.hidden = true;
  const submit = /** @type {HTMLButtonElement} */ (make(doc, 'button', 'acct-submit'));
  submit.type = 'submit';
  const swap = make(doc, 'p', 'panenote acct-swap');
  const prompt = make(doc, 'span');
  const toggle = /** @type {HTMLButtonElement} */ (make(doc, 'button', 'acct-toggle'));
  toggle.type = 'button';
  swap.append(prompt, ' ', toggle);
  const rules = make(doc, 'p', 'panenote', 'Usernames are 3–20 letters, numbers or underscores. There is no email, so a forgotten password cannot be reset.');
  form.append(err, submit, swap, rules);
  host.replaceChildren(form);

  function label() {
    submit.textContent = creating ? 'Create account' : 'Sign in';
    prompt.textContent = creating ? 'Have an account?' : 'New here?';
    toggle.textContent = creating ? 'Sign in instead' : 'Create an account';
    pass.autocomplete = creating ? 'new-password' : 'current-password';
  }
  label();

  /** @param {boolean} on */
  function setBusy(on) {
    busy = on;
    for (const el of [user, pass, submit, toggle]) el.disabled = on;
    form.setAttribute('aria-busy', String(on));
  }

  toggle.addEventListener('click', () => {
    creating = !creating;
    err.hidden = true;
    label();
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (busy) return;
    err.hidden = true;
    setBusy(true);
    try {
      const a = await (creating ? play.signUp(user.value, pass.value) : play.signIn(user.value, pass.value));
      setBusy(false);
      pass.value = '';
      on.onDone(a);
    } catch (x) {
      setBusy(false);
      const code = x && typeof x === 'object' && 'code' in x ? x.code : '';
      err.textContent = x instanceof Error && x.message ? x.message : 'Something went wrong. Try again later.';
      err.hidden = false;
      (code === 'invalid' || code === 'taken' ? user : pass).focus();
    }
  });

  return { focus: () => user.focus() };
}
