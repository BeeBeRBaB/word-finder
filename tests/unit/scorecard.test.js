import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { playBreakdown, formatPoints } from '../../src/scorecard.js';

// A DOM just big enough for scorecard.js, and a window whose clock, frames and timers the
// test drives. Frames run every 16ms; timers fire in order, `late` ms after they are due,
// as a browser's do.

class FakeEl {
  /** @param {FakeDoc} doc @param {string} tag */
  constructor(doc, tag) {
    this.ownerDocument = doc;
    this.tagName = tag.toUpperCase();
    /** @type {(FakeEl|string)[]} */
    this.childNodes = [];
    /** @type {FakeEl|null} */
    this.parentNode = null;
    this.hidden = false;
    this.id = '';
    this.text = '';
    /** @type {Map<string,string>} */
    this.attrs = new Map();
    /** @type {Record<string,string>} */
    this.style = {};
    /** @type {Set<string>} */
    this.classes = new Set();
    /** @type {Map<string, Set<Function>>} */
    this.listeners = new Map();
  }
  get className() { return [...this.classes].join(' '); }
  set className(v) { this.classes = new Set(String(v).split(/\s+/).filter(Boolean)); }
  get classList() {
    return {
      /** @param {...string} c */
      add: (...c) => { for (const x of c) this.classes.add(x); },
      /** @param {string} c */
      contains: (c) => this.classes.has(c),
    };
  }
  /** @returns {string} */
  get textContent() {
    return this.childNodes.length
      ? this.childNodes.map(n => (typeof n === 'string' ? n : n.textContent)).join('')
      : this.text;
  }
  set textContent(v) { this.clear(); this.text = String(v); }
  clear() {
    for (const n of this.childNodes) if (typeof n !== 'string') n.parentNode = null;
    this.childNodes = [];
    this.text = '';
  }
  /** @param {...(FakeEl|string)} nodes */
  append(...nodes) {
    if (this.text) { this.childNodes.push(this.text); this.text = ''; }
    for (const n of nodes) {
      if (typeof n !== 'string') n.parentNode = this;
      this.childNodes.push(n);
    }
  }
  /** @param {...(FakeEl|string)} nodes */
  replaceChildren(...nodes) { this.clear(); this.append(...nodes); }
  /** @param {string} k @param {string} v */
  setAttribute(k, v) { this.attrs.set(k, String(v)); }
  /** @param {string} k */
  getAttribute(k) { return this.attrs.get(k) ?? null; }
  /** @param {string} type @param {Function} fn */
  addEventListener(type, fn) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    /** @type {Set<Function>} */ (this.listeners.get(type)).add(fn);
  }
  /** @param {string} type @param {Function} fn */
  removeEventListener(type, fn) { this.listeners.get(type)?.delete(fn); }
  /** A raw click, bubbling — what el.click() does whether or not the element is visible. */
  click() {
    /** @type {FakeEl|null} */
    let n = this;
    for (; n; n = n.parentNode) for (const fn of n.listeners.get('click') ?? []) fn({ type: 'click', target: this });
  }
  /** @param {FakeEl|null} other */
  contains(other) {
    for (let n = other; n; n = n.parentNode) if (n === this) return true;
    return false;
  }
  /** In the document and not under anything hidden: what a player could see. */
  get rendered() {
    /** @type {FakeEl|null} */
    let n = this;
    for (; n; n = n.parentNode) {
      if (n.hidden) return false;
      if (n === this.ownerDocument.body) return true;
    }
    return false;
  }
  focus() { if (this.rendered) this.ownerDocument.focused = this; }
  /** Every descendant carrying `cls`. @param {string} cls @returns {FakeEl[]} */
  all(cls) {
    /** @type {FakeEl[]} */
    const out = [];
    for (const n of this.childNodes) {
      if (typeof n === 'string') continue;
      if (n.classes.has(cls)) out.push(n);
      out.push(...n.all(cls));
    }
    return out;
  }
  /** @param {string} cls @returns {FakeEl} */
  one(cls) {
    const [el] = this.all(cls);
    assert.ok(el, `no .${cls}`);
    return el;
  }
}

class FakeDoc {
  /** @param {object} win */
  constructor(win) {
    this.defaultView = win;
    this.hidden = false;
    this.body = new FakeEl(this, 'body');
    /** @type {FakeEl|null} */
    this.focused = null;
    this.noActive = false;
    /** @type {Map<string, Set<Function>>} */
    this.listeners = new Map();
  }
  /** @param {string} tag */
  createElement(tag) { return new FakeEl(this, tag); }
  // Like a browser: focus on something no longer rendered falls back to <body>.
  get activeElement() {
    if (this.noActive) return null;
    return this.focused && this.focused.rendered ? this.focused : this.body;
  }
  /** @param {string} type @param {Function} fn */
  addEventListener(type, fn) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    /** @type {Set<Function>} */ (this.listeners.get(type)).add(fn);
  }
  /** @param {string} type @param {Function} fn */
  removeEventListener(type, fn) { this.listeners.get(type)?.delete(fn); }
  /** @param {boolean} hidden */
  setHidden(hidden) {
    this.hidden = hidden;
    for (const fn of this.listeners.get('visibilitychange') ?? []) fn({ type: 'visibilitychange' });
  }
}

function makeEnv({ late = 2 } = {}) {
  let t = 0, seq = 0;
  /** @type {Map<number, Function>} */
  const frames = new Map();
  /** @type {Map<number, {at:number, cb:Function}>} */
  const timers = new Map();
  const win = {
    performance: { now: () => t },
    /** @param {Function} cb */
    requestAnimationFrame: (cb) => { frames.set(++seq, cb); return seq; },
    /** @param {number} id */
    cancelAnimationFrame: (id) => { frames.delete(id); },
    /** @param {Function} cb @param {number} ms */
    setTimeout: (cb, ms) => { timers.set(++seq, { at: t + ms + late, cb }); return seq; },
    /** @param {number} id */
    clearTimeout: (id) => { timers.delete(id); },
  };
  const doc = new FakeDoc(win);
  const card = doc.createElement('div');
  const host = doc.createElement('div');
  card.append(host);
  doc.body.append(card);
  return {
    doc, card, host, frames, timers,
    get now() { return t; },
    /** @param {number} ms */
    advance(ms) {
      for (let i = 0; i < ms; i++) {
        t++;
        const due = [...timers].filter(([, x]) => x.at <= t).sort((a, b) => a[1].at - b[1].at || a[0] - b[0]);
        for (const [id, x] of due) if (timers.has(id)) { timers.delete(id); x.cb(); }
        if (t % 16 === 0) {
          const run = [...frames.values()];
          frames.clear();
          for (const cb of run) cb(t);
        }
      }
    },
  };
}

/** What a player can do: click only what is on screen. @param {FakeEl} el */
function press(el) {
  assert.ok(el.rendered, `.${el.className} is not on screen`);
  el.click();
}

const BREAKDOWN = {
  lines: [
    { key: 'words', label: 'Words', detail: '12 words', points: 540 },
    { key: 'streak', label: 'Streak', detail: 'best ×1.5', points: 120 },
    { key: 'reveals', label: 'Reveals', detail: '1 word', points: -60 },
  ],
  total: 600, complete: true,
  stats: { found: 11, revealed: 1, elapsedMs: 161000, parMs: 240000, bestStreak: 1.5 },
};
const NEGATIVE = { ...BREAKDOWN, lines: [{ key: 'reveals', label: 'Reveals', detail: '6 words', points: -300 }], total: -300 };
// The reveal's pacing, from the module's own numbers: 150ms in, a 300ms count, 120ms gap.
const STEP = 570, REVEAL = (BREAKDOWN.lines.length) * STEP + 450;

/** @param {ReturnType<typeof makeEnv>} env @param {object} [breakdown] @param {object} [opts] */
function play(env, breakdown = BREAKDOWN, opts = {}) {
  const calls = { next: 0, stay: 0 };
  const pb = playBreakdown(/** @type {any} */ (env.host), /** @type {any} */ (breakdown), {
    onNext: () => { calls.next++; }, onStay: () => { calls.stay++; }, scope: /** @type {any} */ (env.card), ...opts,
  });
  return { pb, calls };
}

/** @param {FakeEl} host */
const numbers = (host) => host.all('sc-num').map(n => n.textContent);
/** @param {FakeEl} host */
const shownRows = (host) => host.all('sc-row').map(r => r.classes.has('sc-in'));

test('formatPoints signs, groups and uses a real minus sign', () => {
  assert.equal(formatPoints(540), '+540');
  assert.equal(formatPoints(-60), '\u221260');
  assert.equal(formatPoints(1240), '+1,240');
  assert.equal(formatPoints(-1234567), '\u22121,234,567');
  assert.equal(formatPoints(0), '0');
  assert.equal(formatPoints(-0.4), '0', 'rounds to zero without a sign');
  assert.equal(formatPoints(12.6), '+13');
  assert.equal(formatPoints(NaN), '0');
  assert.equal(formatPoints(Infinity), '0');
});

test('renders a list of lines and a total, each with its final value for screen readers', () => {
  const env = makeEnv();
  env.host.append(env.doc.createElement('p'));   // replaced, not appended to
  play(env);
  assert.equal(env.host.childNodes.length, 1);
  const list = env.host.one('sc-list');
  assert.equal(list.tagName, 'UL');
  assert.equal(list.getAttribute('role'), 'list');
  const items = list.all('sc-row');
  assert.deepEqual(items.map(r => r.tagName), ['LI', 'LI', 'LI']);
  assert.deepEqual(items.map(r => r.one('sc-label').textContent), ['Words', 'Streak', 'Reveals']);
  assert.deepEqual(items.map(r => r.one('sc-detail').textContent), ['12 words', 'best ×1.5', '1 word']);
  const total = env.host.one('sc-total');
  assert.ok(!list.contains(total), 'the total is its own row after the list');
  assert.equal(total.one('sc-label').textContent, 'Total');
  assert.equal(total.all('sc-detail').length, 0);
  assert.deepEqual(env.host.all('sc-pts').map(p => p.textContent.slice(p.one('sc-num').textContent.length)),
    [' +540', ' +120', ' \u221260', ' +600']);
  for (const n of env.host.all('sc-num')) assert.equal(n.getAttribute('aria-hidden'), 'true');
  assert.deepEqual(numbers(env.host), ['0', '0', '0', '0'], 'every number starts from 0');
  assert.ok(!env.host.one('sc').classes.has('sc-neg'));
});

test('rows appear one at a time, in order, each counting up from 0', () => {
  const env = makeEnv();
  play(env);
  assert.deepEqual(shownRows(env.host), [false, false, false, false], 'nothing before the first frame');
  env.advance(16);
  assert.deepEqual(shownRows(env.host), [true, false, false, false]);
  assert.equal(numbers(env.host)[0], '0', 'the count waits for the wipe to uncover it');
  /** @type {number[][]} */
  const seen = [[], [], [], []];
  let order = 0;
  for (let t = 16; t < REVEAL + 32; t += 16) {
    env.advance(16);
    const shown = shownRows(env.host);
    const n = shown.filter(Boolean).length;
    assert.deepEqual(shown, shown.map((_, i) => i < n), 'a later row never shows before an earlier one');
    assert.ok(n >= order, 'rows never disappear');
    order = n;
    numbers(env.host).forEach((s, i) => seen[i].push(Number(s.replace('\u2212', '-').replace(/[+,]/g, ''))));
  }
  const targets = [540, 120, -60, 600];
  seen.forEach((vals, i) => {
    const mags = vals.map(Math.abs);
    assert.ok(mags.every((m, k) => k === 0 || m >= mags[k - 1]), `row ${i} counts monotonically`);
    assert.equal(vals[vals.length - 1], targets[i]);
    assert.ok(vals.some(v => v !== 0 && v !== targets[i]), `row ${i} shows values on the way`);
  });
  // Row 1 appears one step after row 0, not with it.
  const env2 = makeEnv();
  play(env2);
  env2.advance(STEP - 10);
  assert.deepEqual(shownRows(env2.host), [true, false, false, false]);
  env2.advance(20);
  assert.deepEqual(shownRows(env2.host), [true, true, false, false]);
  assert.ok(!env2.host.one('sc').classes.has('sc-done'));
  assert.ok(env2.host.one('sc-skip').rendered, 'Skip is offered while rows are coming in');
  assert.ok(!env2.host.one('sc-next').rendered);
});

test('the total is announced once, politely, after it appears', () => {
  const env = makeEnv();
  play(env);
  const live = env.host.all('sr').find(s => s.getAttribute('role') === 'status');
  assert.ok(live, 'a status region exists from the start');
  assert.equal(live.textContent, '');
  env.advance(REVEAL - STEP);
  assert.equal(live.textContent, '', 'not before the total row');
  // The total row starts at 3 steps (1710ms); its announcement lands 250ms later, before
  // the reveal finishes at 2160ms.
  env.advance(1990 - env.now);
  assert.ok(!env.host.one('sc').classes.has('sc-done'));
  assert.equal(live.textContent, 'Total +600 points. Next level in 10 seconds.');
  live.textContent = '';
  env.advance(3000);
  assert.equal(live.textContent, '', 'said once: not again when the reveal finishes, nor every second');
});

test('Skip, a click on a row, or skip() finishes at once, and only once', () => {
  for (const how of ['button', 'row', 'total', 'api']) {
    const env = makeEnv();
    const { pb } = play(env);
    env.advance(100);
    if (how === 'button') press(env.host.one('sc-skip'));
    else if (how === 'row') press(env.host.one('sc-label'));
    else if (how === 'total') env.host.one('sc-total').click();
    else pb.skip();
    assert.deepEqual(shownRows(env.host), [true, true, true, true], how);
    assert.deepEqual(numbers(env.host), ['+540', '+120', '\u221260', '+600'], how);
    assert.ok(env.host.one('sc').classes.has('sc-done'));
    assert.ok(!env.host.one('sc-skip').rendered, 'Skip goes once there is nothing to skip');
    assert.ok(env.host.one('sc-next').rendered);
    assert.equal(env.host.one('sc-secs').textContent, '10');
    env.advance(4050);
    const timers = env.timers.size;
    pb.skip();
    press(env.host.one('sc-label'));
    assert.equal(env.timers.size, timers, 'a second skip starts nothing new');
    assert.equal(env.host.one('sc-secs').textContent, '6', 'nor restarts the countdown');
  }
});

test('the countdown shows whole seconds, fills its bar, and fires onNext exactly once', () => {
  const env = makeEnv();
  const { calls } = play(env, BREAKDOWN, { countdownMs: 5000 });
  env.advance(REVEAL + 16);
  const secs = env.host.one('sc-secs');
  assert.equal(env.host.one('sc-count').textContent, 'Next level in 5');
  assert.equal(env.host.one('sc-count').getAttribute('aria-hidden'), 'true');
  const fill = env.host.one('sc-bar').childNodes[0];
  assert.ok(typeof fill !== 'string');
  env.advance(1100);
  assert.equal(secs.textContent, '4');
  const early = Number(/scaleX\(([\d.]+)\)/.exec(fill.style.transform)?.[1]);
  assert.ok(early > 0.15 && early < 0.3, `bar at ${early}`);
  env.advance(2000);
  assert.equal(secs.textContent, '2');
  assert.equal(calls.next, 0);
  env.advance(1850);
  assert.equal(secs.textContent, '1');
  assert.equal(calls.next, 0, 'not before the deadline');
  env.advance(100);
  assert.equal(calls.next, 1);
  assert.equal(env.timers.size + env.frames.size, 0, 'nothing left running');
  env.advance(10000);
  press(env.host.one('sc-go'));
  assert.equal(calls.next, 1, 'the button cannot fire it a second time');
  assert.equal(calls.stay, 0);
});

test('the Next button continues at once', () => {
  const env = makeEnv();
  const { calls } = play(env);
  env.advance(REVEAL + 16);
  const go = env.host.one('sc-go');
  assert.equal(go.textContent, 'Next level \u2192');
  assert.equal(go.childNodes[1] && typeof go.childNodes[1] !== 'string' && go.childNodes[1].getAttribute('aria-hidden'), 'true');
  assert.equal(go.getAttribute('type'), 'button');
  press(go);
  press(go);
  assert.equal(calls.next, 1);
  assert.equal(env.timers.size + env.frames.size, 0);
});

test('Stay cancels the countdown, hands focus to Next, and Next still works', () => {
  const env = makeEnv();
  const { calls } = play(env);
  env.advance(REVEAL + 16);
  const stay = env.host.one('sc-stay');
  stay.focus();
  press(stay);
  assert.equal(calls.stay, 1);
  assert.ok(!env.host.one('sc-line').rendered && !env.host.one('sc-bar').rendered);
  assert.ok(env.host.one('sc-go').rendered);
  assert.equal(env.doc.activeElement, env.host.one('sc-go'));
  env.advance(20000);
  assert.equal(calls.next, 0, 'the countdown is gone');
  stay.click();   // a stale event on the hidden button
  assert.equal(calls.stay, 1);
  env.doc.setHidden(true);
  env.doc.setHidden(false);
  env.advance(20000);
  assert.equal(calls.next, 0, 'coming back to the page does not restart it');
  press(env.host.one('sc-go'));
  assert.equal(calls.next, 1);
});

test('hold() stops the countdown, or keeps it from starting, without Stay or a move of focus', () => {
  // Mid-countdown: the line and bar go, its sentence leaves the live region, Next stays.
  const env = makeEnv();
  const { pb, calls } = play(env);
  env.advance(REVEAL + 16);
  const live = /** @type {FakeEl} */ (env.host.all('sr').find(s => s.getAttribute('role') === 'status'));
  assert.equal(live.textContent, 'Total +600 points. Next level in 10 seconds.');
  env.host.one('sc-stay').focus();
  pb.hold();
  pb.hold();
  assert.ok(!env.host.one('sc-line').rendered && !env.host.one('sc-bar').rendered);
  assert.equal(live.textContent, 'Total +600 points.');
  assert.equal(calls.stay, 0, 'not the Stay button');
  assert.equal(env.timers.size + env.frames.size, 0, 'nothing left running');
  env.doc.setHidden(true);
  env.doc.setHidden(false);
  env.advance(20000);
  assert.equal(calls.next, 0);
  press(env.host.one('sc-go'));
  assert.equal(calls.next, 1);
  // Mid-reveal: the reveal carries on to the end, then no countdown and none announced.
  const early = makeEnv();
  const e = play(early);
  early.advance(STEP);
  e.pb.hold();
  early.advance(REVEAL);
  assert.ok(early.host.one('sc').classes.has('sc-done'), 'the reveal still finishes');
  assert.ok(early.host.one('sc-go').rendered && !early.host.one('sc-line').rendered);
  assert.equal(/** @type {FakeEl} */ (early.host.all('sr').find(s => s.getAttribute('role') === 'status')).textContent, 'Total +600 points.');
  early.advance(20000);
  assert.equal(e.calls.next, 0);
  // After cancel() it does nothing.
  const gone = makeEnv();
  const g = play(gone);
  g.pb.cancel();
  g.pb.hold();
  assert.equal(gone.timers.size + gone.frames.size, 0);
});

test('hold() hands focus from Stay to Next, which stays on screen', () => {
  const env = makeEnv();
  const { pb } = play(env);
  env.advance(REVEAL + 16);
  env.host.one('sc-stay').focus();
  pb.hold();
  assert.equal(env.doc.activeElement, env.host.one('sc-go'));
  // Focus elsewhere is left alone.
  const other = makeEnv();
  const o = play(other);
  other.advance(REVEAL + 16);
  o.pb.hold();
  assert.equal(other.doc.activeElement, other.host.one('sc-go'), 'finish() had already focused Next');
});

test('rearm() lets Next fire once more after its deal was dropped, with no countdown; cancel() stays final', () => {
  const env = makeEnv();
  const { pb, calls } = play(env, BREAKDOWN, { countdownMs: 3000 });
  env.advance(REVEAL + 16);
  pb.rearm();
  assert.equal(calls.next, 0, 'not while it is still live');
  press(env.host.one('sc-go'));
  assert.equal(calls.next, 1);
  press(env.host.one('sc-go'));
  assert.equal(calls.next, 1, 'Next is spent');
  pb.rearm();
  assert.ok(!env.host.one('sc-line').rendered && !env.host.one('sc-bar').rendered);
  env.advance(10000);
  assert.equal(calls.next, 1, 'no countdown comes back');
  press(env.host.one('sc-go'));
  assert.equal(calls.next, 2);
  // Before the reveal ends, or after cancel(), there is nothing to rearm.
  const early = makeEnv();
  const e = play(early);
  e.pb.cancel();
  e.pb.rearm();
  early.advance(REVEAL + 16);
  assert.ok(!early.host.one('sc').classes.has('sc-done'));
  const gone = makeEnv();
  const g = play(gone);
  gone.advance(REVEAL + 16);
  g.pb.cancel();
  g.pb.rearm();
  press(gone.host.one('sc-go'));
  assert.equal(g.calls.next, 0);
});

test('the bar and the colour follow the sign of the total', () => {
  const env = makeEnv();
  play(env, NEGATIVE);
  assert.ok(env.host.one('sc').classes.has('sc-neg'));
  const css = readFileSync(new URL('../../styles.css', import.meta.url), 'utf8');
  assert.match(css, /\.sc-bar i\{[^}]*transform-origin:left center/);
  assert.match(css, /\.sc-neg \.sc-bar i\{[^}]*transform-origin:right center/);
  const pos = /\.sc-bar i\{[^}]*background:(var\(--[\w-]+\))/.exec(css);
  const neg = /\.sc-neg \.sc-bar i\{[^}]*background:(var\(--[\w-]+\))/.exec(css);
  assert.ok(pos && neg);
  assert.equal(pos[1], 'var(--accent)');
  assert.notEqual(neg[1], pos[1]);
});

test('the reveal pauses while hidden, too', () => {
  const env = makeEnv();
  play(env);
  env.advance(100);
  env.doc.setHidden(true);
  env.advance(10000);
  assert.deepEqual(shownRows(env.host), [true, false, false, false]);
  env.doc.setHidden(false);
  env.advance(STEP);
  assert.deepEqual(shownRows(env.host), [true, true, false, false]);
});

test('a card mounted while the page is hidden starts its reveal when it shows', () => {
  const env = makeEnv();
  env.doc.hidden = true;
  play(env);
  env.advance(5000);
  assert.deepEqual(shownRows(env.host), [false, false, false, false]);
  env.doc.setHidden(false);
  env.advance(16);
  assert.deepEqual(shownRows(env.host), [true, false, false, false]);
});

// Hiding the page drops the countdown, and that is main.js's call (hold()), as for the plain card.
test('once the reveal is over, hiding the page leaves the card alone', () => {
  const env = makeEnv();
  const { calls } = play(env);
  env.advance(REVEAL + 16);
  assert.equal(env.doc.listeners.get('visibilitychange')?.size ?? 0, 0);
  env.advance(10016);
  assert.equal(calls.next, 1);
});

test('reduced motion renders the finished card at once, without the bar', () => {
  const env = makeEnv();
  const { calls } = play(env, NEGATIVE, { reduceMotion: true });
  const root = env.host.one('sc');
  assert.ok(root.classes.has('sc-still') && root.classes.has('sc-done'));
  assert.deepEqual(shownRows(env.host), [true, true]);
  assert.deepEqual(numbers(env.host), ['\u2212300', '\u2212300']);
  assert.ok(!env.host.one('sc-skip').rendered);
  assert.equal(env.host.one('sc-count').textContent, 'Next level in 10');
  assert.ok(env.host.one('sc-go').rendered && env.host.one('sc-stay').rendered);
  assert.equal(env.frames.size, 0, 'no animation frames at all');
  const fill = env.host.one('sc-bar').childNodes[0];
  assert.ok(typeof fill !== 'string' && fill.style.transform === undefined, 'the bar is never driven');
  env.advance(9990);
  assert.equal(calls.next, 0);
  env.advance(20);
  assert.equal(calls.next, 1);
  const css = readFileSync(new URL('../../styles.css', import.meta.url), 'utf8');
  assert.match(css, /:root\[data-motion="reduce"\] \.sc-bar[^{]*\{display:none\}/);
  assert.match(css, /:root\[data-motion="reduce"\] \.sc-row\.sc-in\{animation:none\}/);
  assert.match(css, /\.sc-still \.sc-bar\{display:none\}/);
});

test('cancel() stops everything and nothing fires afterwards', () => {
  for (const at of [100, REVEAL + 16]) {
    const env = makeEnv();
    const { pb, calls } = play(env);
    env.advance(at);
    pb.cancel();
    assert.equal(env.timers.size + env.frames.size, 0, `at ${at}ms`);
    assert.equal(env.doc.listeners.get('visibilitychange')?.size ?? 0, 0);
    env.advance(30000);
    pb.skip();
    env.host.one('sc-go').click();
    env.host.one('sc-stay').click();
    env.doc.setHidden(true);
    env.doc.setHidden(false);
    env.advance(30000);
    assert.deepEqual(calls, { next: 0, stay: 0 });
    pb.cancel();   // twice is fine
  }
});

test('a second call on the same host cancels the first', () => {
  const env = makeEnv();
  const first = play(env);
  env.advance(REVEAL + 16);
  const second = play(env, NEGATIVE, { countdownMs: 20000 });
  assert.ok(env.host.one('sc').classes.has('sc-neg'));
  assert.equal(env.host.all('sc').length, 1);
  env.advance(15000);
  assert.deepEqual(first.calls, { next: 0, stay: 0 }, 'the first countdown went with its card');
  first.pb.cancel();   // a stale handle must not stop the new run
  env.advance(10000);
  assert.deepEqual(first.calls, { next: 0, stay: 0 });
  assert.equal(second.calls.next, 1);
});

test('focus moves to Next only from inside the card or from nowhere', () => {
  // From <body>.
  let env = makeEnv();
  play(env, BREAKDOWN, { reduceMotion: true });
  assert.equal(env.doc.activeElement, env.host.one('sc-go'));
  // From Skip, which disappears under the finger.
  env = makeEnv();
  play(env);
  env.host.one('sc-skip').focus();
  press(env.host.one('sc-skip'));
  assert.equal(env.doc.activeElement, env.host.one('sc-go'));
  // From elsewhere in the card, such as its close button.
  env = makeEnv();
  const close = env.doc.createElement('button');
  env.card.append(close);
  close.focus();
  play(env, BREAKDOWN, { reduceMotion: true });
  assert.equal(env.doc.activeElement, env.host.one('sc-go'));
  // Never out of a field outside the card.
  env = makeEnv();
  const field = env.doc.createElement('input');
  env.doc.body.append(field);
  field.focus();
  play(env, BREAKDOWN, { reduceMotion: true });
  assert.equal(env.doc.activeElement, field);
  // With no scope given, the host alone is the card.
  env = makeEnv();
  const loose = env.doc.createElement('div');
  env.doc.body.append(loose);
  const other = env.doc.createElement('button');
  env.doc.body.append(other);
  other.focus();
  playBreakdown(/** @type {any} */ (loose), /** @type {any} */ (BREAKDOWN), { reduceMotion: true, onNext() {}, onStay() {} });
  assert.equal(env.doc.activeElement, other);
  // No active element at all.
  env = makeEnv();
  env.doc.noActive = true;
  play(env, BREAKDOWN, { reduceMotion: true });
  env.doc.noActive = false;
  assert.equal(env.doc.activeElement, env.host.one('sc-go'));
});

test('no countdown when countdownMs is 0 or Infinity, and nextLabel names the button', () => {
  for (const countdownMs of [0, -5, Infinity, NaN]) {
    const env = makeEnv();
    const { calls } = play(env, BREAKDOWN, { countdownMs, nextLabel: 'Next puzzle' });
    env.advance(REVEAL + 16);
    assert.ok(!env.host.one('sc-line').rendered && !env.host.one('sc-bar').rendered, String(countdownMs));
    assert.equal(env.host.one('sc-go').textContent, 'Next puzzle \u2192');
    const live = /** @type {FakeEl} */ (env.host.all('sr').find(s => s.getAttribute('role') === 'status'));
    env.advance(60000);
    assert.equal(live.textContent, 'Total +600 points.');
    assert.equal(calls.next, 0);
    press(env.host.one('sc-go'));
    assert.equal(calls.next, 1);
  }
  const env = makeEnv();
  play(env, BREAKDOWN, { reduceMotion: true, nextLabel: 'Next puzzle' });
  assert.equal(env.host.one('sc-count').textContent, 'Next puzzle in 10');
  const blank = makeEnv();
  play(blank, BREAKDOWN, { reduceMotion: true, nextLabel: '' });
  assert.equal(blank.host.one('sc-count').textContent, 'Next level in 10');
});

test('a footnote sits under the total, appears with it and is read out with it', () => {
  const env = makeEnv();
  play(env, BREAKDOWN, { footnote: '5,644 points in all' });
  const sc = env.host.one('sc');
  const note = env.host.one('sc-all');
  assert.equal(note.textContent, '5,644 points in all');
  assert.equal(note.tagName, 'DIV', '#wincard p would restyle a p');
  assert.equal(sc.childNodes.indexOf(note), sc.childNodes.indexOf(env.host.one('sc-total')) + 1);
  const live = /** @type {FakeEl} */ (env.host.all('sr').find(s => s.getAttribute('role') === 'status'));
  env.advance(1700);
  assert.ok(!note.classes.has('sc-in'), 'not before the total row');
  env.advance(20);
  assert.ok(note.classes.has('sc-in'));
  env.advance(300);
  assert.equal(live.textContent, 'Total +600 points. 5,644 points in all. Next level in 10 seconds.');
  // Its own full stop is kept, not doubled; skipping straight to the end shows it too.
  const env2 = makeEnv();
  const { pb } = play(env2, BREAKDOWN, { footnote: ' Not added again. ', countdownMs: 0 });
  pb.skip();
  assert.ok(env2.host.one('sc-all').classes.has('sc-in'));
  assert.equal(env2.host.one('sc-all').textContent, 'Not added again.');
  env2.advance(300);
  assert.equal(/** @type {FakeEl} */ (env2.host.all('sr').find(s => s.getAttribute('role') === 'status')).textContent,
    'Total +600 points. Not added again.');
  for (const footnote of [undefined, '', '   ']) {
    const e = makeEnv();
    play(e, BREAKDOWN, { footnote, reduceMotion: true });
    assert.equal(e.host.all('sc-all').length, 0, String(footnote));
  }
});

test('with no lines, the total is the first and only row to wipe in', () => {
  const env3 = makeEnv();
  play(env3, { ...BREAKDOWN, lines: [] });
  env3.advance(16);
  assert.deepEqual(shownRows(env3.host), [true]);
  env3.advance(450);
  assert.ok(env3.host.one('sc').classes.has('sc-done'));
});

test('the stylesheet agrees with the module and stays inside its own classes', () => {
  const css = readFileSync(new URL('../../styles.css', import.meta.url), 'utf8');
  const m = /\.sc-row\.sc-in\{[^}]*animation:sc-wipe ([\d.]+)s/.exec(css);
  assert.ok(m, 'no sc-wipe animation on .sc-row.sc-in');
  const src = readFileSync(new URL('../../src/scorecard.js', import.meta.url), 'utf8');
  const t = /const COUNT_DELAY_MS = (\d+), COUNT_MS = (\d+)/.exec(src);
  assert.ok(t, 'no COUNT_DELAY_MS / COUNT_MS in scorecard.js');
  const wipe = Number(m[1]) * 1000, delay = Number(t[1]), count = Number(t[2]);
  assert.ok(wipe > delay && wipe <= delay + count,
    `the count must start inside the ${wipe}ms wipe and end after it (it runs ${delay}–${delay + count}ms)`);
  const at = css.indexOf('/* Level score card */');
  assert.notEqual(at, -1, 'no Level score card section');
  const end = css.indexOf('/* End level score card */', at);
  assert.ok(end > at, 'the section is not closed');
  const section = css.slice(at, end);
  const selectors = [...section.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{/g)].map(s => s[1].trim())
    .filter(s => !s.startsWith('@') && !/^(from|to|\d+%)$/.test(s));
  for (const sel of selectors) {
    for (const part of sel.split(',')) {
      assert.match(part.trim(), /^(:root\[data-motion="reduce"\] )?\.sc(-|\b)/, `"${part.trim()}" is outside .sc-`);
    }
  }
  assert.doesNotMatch(section, /#[0-9a-fA-F]{3,8}\b|rgba?\(/, 'colours must be tokens');
});
