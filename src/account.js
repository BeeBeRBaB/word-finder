// The levels screens outside the board: the Account section of Settings, the sign-in form, the
// Levels side of New game and a level's score card. Each renders into a host main.js gives it,
// and talks to the account only through levelplay.js; how dialogs and pages open is main.js's.
import { playBreakdown, make, grouped } from './scorecard.js';
import { codeOf } from './levelplay.js';
import { DIFFICULTY_NAMES } from './scoring.js';

/**
 * @typedef {import('./levelplay.js').Status} Status
 * @typedef {import('./levelplay.js').Finish} Finish
 * @typedef {import('./levels.js').LevelProgress} LevelProgress
 * @typedef {import('./levels.js').Difficulty} Difficulty
 * @typedef {import('./cloud.js').Account} Account
 * @typedef {{status():Status, signIn(u:string, p:string):Promise<Account>,
 *   signUp(u:string, p:string):Promise<Account>, signOut():void}} AccountPlay
 * @typedef {{status():Status, progress():LevelProgress|null}} ChoicePlay
 * @typedef {import('./scorecard.js').Playback} Playback
 * @typedef {Omit<import('./scorecard.js').PlayOptions, 'footnote'> & {focus?:boolean}} LevelWinOptions
 *   focus: move focus into the card, as when no pane is open over it.
 */

/** @param {number} n @returns {string} "1 point", "4,210 points" */
const points = (n) => `${grouped(Math.max(0, Math.round(n)))} ${n === 1 ? 'point' : 'points'}`;

/** One line on where the account stands. @param {Status} s @returns {string} */
function accountLine(s) {
  const saved = s.error === 'offline' ? 'offline, saved here'
    : s.error || s.pending ? 'not saved online yet' : 'saved';
  return `Level ${s.level} · ${points(s.points)} · ${saved}`;
}

/** A name over a muted line, beside one button: the layout of every account row.
 * @param {Document} doc @param {HTMLElement} name @param {string} line @param {string} label
 * @returns {{row:HTMLElement, btn:HTMLButtonElement, note:HTMLElement}} */
function accountRow(doc, name, line, label) {
  const row = make(doc, 'div', 'acct-row');
  const who = make(doc, 'span', 'acct-who');
  const seg = make(doc, 'div', 'seg acct-seg');
  const btn = /** @type {HTMLButtonElement} */ (make(doc, 'button', '', label));
  btn.type = 'button';
  seg.append(btn);
  const note = make(doc, 'small', 'acct-line', line);
  who.append(name, note);
  row.append(who, seg);
  return { row, btn, note };
}

const PITCH = 'Numbered puzzles that keep your points on any device.';

/** Render the Account section into `host`: Sign in when signed out, the account and Sign out
 * when signed in. Signing out with progress not yet saved online asks once more.
 * @param {HTMLElement} host @param {AccountPlay} play
 * @param {{onSignIn:() => void, onSignOut:() => void}} on @returns {void} */
export function renderAccount(host, play, on) {
  const doc = host.ownerDocument;
  const s = play.status();
  // Signed in at level 0: no copy here, and the cloud has not answered.
  const line = s.level ? accountLine(s) : "Your levels haven't loaded yet.";
  // Asked once already: a redraw (a sync landing) keeps the warning and Sign out anyway, so the
  // second tap still means what it says. Only the line under the name moves on.
  const asked = host.querySelector('.acct-warn:not([hidden])');
  const shown = host.querySelector('.acct-line');
  if (asked && shown && s.signedIn && s.pending) { shown.textContent = line; return; }
  const { row, btn } = s.signedIn
    ? accountRow(doc, make(doc, 'b', 'acct-name', s.username ?? ''), line, 'Sign out')
    : accountRow(doc, make(doc, 'span', 'acct-name', 'Levels'), PITCH, 'Sign in');
  const warn = make(doc, 'p', 'panenote acct-warn', "Your latest progress isn't saved online yet. Signing out here loses it.");
  warn.setAttribute('role', 'alert');   // shown in place of an action, so it is read out as it appears
  warn.hidden = true;
  if (!s.signedIn) btn.setAttribute('aria-expanded', 'false');   // it opens the sign-in page
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
 * @returns {void} */
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

  /** Not `disabled`: that would take focus off the field or button the player submitted from.
   * `busy` refuses a second submit or a switch instead. @param {boolean} on */
  function setBusy(on) {
    busy = on;
    for (const el of [user, pass]) el.readOnly = on;
    for (const el of [submit, toggle]) el.setAttribute('aria-disabled', String(on));
    form.setAttribute('aria-busy', String(on));
    if (on) submit.textContent = creating ? 'Creating account…' : 'Signing in…';
    else label();
  }

  toggle.addEventListener('click', () => {
    if (busy) return;
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
      const code = codeOf(x);
      err.textContent = x instanceof Error && x.message ? x.message : 'Something went wrong. Try again later.';
      err.hidden = false;
      (code === 'invalid' || code === 'taken' ? user : pass).focus();
    }
  });
}

/** Render the Levels side of the New game dialog into `host`: the level to play and where the
 * account stands, or a way in. Returns what the dialog's Start button says, and whether it can.
 * @param {HTMLElement} host @param {ChoicePlay} play
 * @param {{difficulty:Difficulty, onSignIn:() => void, onRetry:() => void}} on
 *   difficulty: the setting, for a level not yet started; a started level keeps its own.
 * @returns {{ready:boolean, start:string}} */
export function renderLevelChoice(host, play, on) {
  const doc = host.ownerDocument;
  const s = play.status();
  const p = play.progress();
  if (p) {
    const d = p.current ? p.current.difficulty : on.difficulty;
    host.replaceChildren(make(doc, 'p', 'acct-lvl', `Level ${p.level}`),
      make(doc, 'p', 'acct-lvl-line', `${points(p.points)} · ${DIFFICULTY_NAMES[d]}`));
    return { ready: true, start: `Play level ${p.level}` };
  }
  // Signed in with nothing to deal from: this device has no copy and the cloud has not answered.
  const { row, btn, note } = s.signedIn
    ? accountRow(doc, make(doc, 'span', 'acct-name', 'Levels'), "Your levels haven't loaded yet. Check your connection, then try again.", 'Try again')
    : accountRow(doc, make(doc, 'span', 'acct-name', 'Levels'), PITCH, 'Sign in');
  // Drawn again after each Try again that fails, and read out each time, so the tap is answered.
  if (s.signedIn) note.setAttribute('role', 'alert');
  btn.addEventListener('click', s.signedIn ? on.onRetry : on.onSignIn);
  host.replaceChildren(row);
  return { ready: false, start: 'Play level' };
}

/** Make the win card a level's score card: "Level N complete" over the breakdown, played a line
 * at a time, and the account's new total. `card[data-level]` lets the stylesheet hide the plain
 * card's message and buttons. Cancel the playback it returns before the card is cleared or shown
 * again: taking the card down does not stop it. @param {HTMLElement} card
 * @param {HTMLElement} title its heading @param {number} level @param {Finish} f
 * @param {LevelWinOptions} opts @returns {Playback} */
export function showLevelWin(card, title, level, f, opts) {
  clearLevelWin(card, title);
  const doc = card.ownerDocument;
  title.dataset.plain = title.textContent ?? '';
  title.textContent = `Level ${level} complete`;
  card.dataset.level = String(level);
  const host = make(doc, 'div', 'sc-host');
  title.after(host);
  const { focus, ...rest } = opts;
  const pb = playBreakdown(host, f.breakdown, { ...rest, footnote: `${points(f.progress.points)} in all`, scope: card });
  if (focus) {
    const skip = /** @type {HTMLElement|null} */ (host.querySelector('.sc-skip'));
    const go = /** @type {HTMLElement|null} */ (host.querySelector('.sc-go'));
    (skip && !skip.hidden ? skip : go)?.focus({ preventScroll: true });
  }
  return pb;
}

/** Put the plain win card back. @param {HTMLElement} card @param {HTMLElement} title @returns {void} */
export function clearLevelWin(card, title) {
  card.querySelector('.sc-host')?.remove();
  if (title.dataset.plain !== undefined) {
    title.textContent = title.dataset.plain;
    delete title.dataset.plain;
  }
  delete card.dataset.level;
}
