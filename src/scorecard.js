// The end-of-level score card: scoring.js's breakdown revealed a line at a time, then a
// countdown to the next level. Every timer and frame is owned here and stops on cancel().

/**
 * @typedef {{key:string, label:string, detail:string, points:number}} Line
 * @typedef {{lines:Line[], total:number, complete:boolean,
 *   stats:{found:number, revealed:number, elapsedMs:number, parMs:number, bestStreak:number}}} Breakdown
 * @typedef {{reduceMotion?:boolean, countdownMs?:number, nextLabel?:string,
 *   onNext:() => void, onStay:() => void}} PlayOptions
 *   countdownMs: 0, negative or Infinity means no countdown — the Next button only.
 * @typedef {{skip():void, cancel():void}} Playback
 * @typedef {{el:HTMLElement, num:HTMLElement, points:number, shown:boolean}} Row
 */

/** Must match the sc-wipe duration in styles.css. */
export const WIPE_MS = 350;
// Points count up from part-way into the wipe, so the number is mostly uncovered while it
// runs; the next line starts GAP_MS after the count ends.
const COUNT_DELAY_MS = 150, COUNT_MS = 300, GAP_MS = 120;
const STEP_MS = COUNT_DELAY_MS + COUNT_MS + GAP_MS;
// Late enough that the live region is in the accessibility tree before it changes.
const ANNOUNCE_MS = 250;
const DEFAULT_COUNTDOWN_MS = 10000;
const MINUS = '\u2212';

/** @type {WeakMap<Element, Playback>} */
const running = new WeakMap();

/** @param {unknown} n @returns {number} rounded; anything non-finite is 0 */
const whole = (n) => (typeof n === 'number' && Number.isFinite(n) ? Math.round(n) : 0);

/** Signed and grouped, with a real minus sign: "+1,240", "−60", "0".
 * @param {number} n @returns {string} */
export function formatPoints(n) {
  const v = whole(n);
  const digits = String(Math.abs(v)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return v > 0 ? `+${digits}` : v < 0 ? MINUS + digits : digits;
}

/** @param {Document} doc @param {string} tag @param {string} cls @param {string} [text]
 * @returns {HTMLElement} */
function make(doc, tag, cls, text) {
  const el = doc.createElement(tag);
  if (cls) el.className = cls;
  if (text) el.textContent = text;
  return el;
}

/** @param {Document} doc @param {string} cls @param {string} text @returns {HTMLElement} */
function button(doc, cls, text) {
  const b = make(doc, 'button', cls, text);
  b.setAttribute('type', 'button');
  return b;
}

/** Label, detail, points. The counting digits are hidden from screen readers, which read
 * the final value instead.
 * @param {Document} doc @param {string} tag @param {string} label @param {string} detail
 * @param {number} points @returns {Row} */
function row(doc, tag, label, detail, points) {
  const el = make(doc, tag, 'sc-row');
  const desc = make(doc, 'span', 'sc-desc');
  desc.append(make(doc, 'span', 'sc-label', label));
  if (detail) desc.append(' ', make(doc, 'span', 'sc-detail', detail));
  const pts = make(doc, 'span', 'sc-pts');
  const num = make(doc, 'span', 'sc-num', formatPoints(0));
  num.setAttribute('aria-hidden', 'true');
  pts.append(num, make(doc, 'span', 'sr', ` ${formatPoints(points)}`));
  el.append(desc, pts);
  return { el, num, points, shown: false };
}

/** Time that only runs while the page is visible. @param {() => number} now */
function makeClock(now) {
  let spent = 0;
  /** @type {number|null} */
  let since = null;
  return {
    elapsed: () => spent + (since === null ? 0 : now() - since),
    pause() { if (since !== null) { spent += now() - since; since = null; } },
    resume() { if (since === null) since = now(); },
    /** @param {boolean} run */
    reset(run) { spent = 0; since = run ? now() : null; },
  };
}

/** Render `breakdown` into `host` and play it. A second call on the same host cancels the first.
 * @param {HTMLElement} host @param {Breakdown} breakdown @param {PlayOptions} opts
 * @returns {Playback} */
export function playBreakdown(host, breakdown, opts) {
  running.get(host)?.cancel();
  const doc = host.ownerDocument;
  const win = /** @type {Window} */ (doc.defaultView);
  const clock = makeClock(() => win.performance.now());
  const still = !!opts.reduceMotion;
  const label = typeof opts.nextLabel === 'string' && opts.nextLabel ? opts.nextLabel : 'Next level';
  const limit = opts.countdownMs === undefined ? DEFAULT_COUNTDOWN_MS : opts.countdownMs;
  const auto = Number.isFinite(limit) && limit > 0;
  const total = whole(breakdown.total);
  const lines = (Array.isArray(breakdown.lines) ? breakdown.lines : []).filter(l => l && typeof l === 'object');

  const root = make(doc, 'div', total < 0 ? 'sc sc-neg' : 'sc');
  if (still) root.classList.add('sc-still');
  const list = make(doc, 'ul', 'sc-list');
  list.setAttribute('role', 'list');   // Safari drops list semantics under list-style:none
  const rows = lines.map(l => row(doc, 'li', String(l.label ?? ''), String(l.detail ?? ''), whole(l.points)));
  list.append(...rows.map(r => r.el));
  const sum = row(doc, 'div', 'Total', '', total);
  sum.el.classList.add('sc-total');
  rows.push(sum);
  const live = make(doc, 'span', 'sr');
  live.setAttribute('role', 'status');
  live.setAttribute('aria-atomic', 'true');

  const skipBtn = button(doc, 'sc-skip', 'Skip');
  const next = make(doc, 'div', 'sc-next');
  next.hidden = true;
  const line = make(doc, 'div', 'sc-line');
  const count = make(doc, 'span', 'sc-count', `${label} in `);
  const secs = make(doc, 'b', 'sc-secs');
  count.append(secs);
  count.setAttribute('aria-hidden', 'true');   // the live region says it once
  const stayBtn = button(doc, 'sc-stay', 'Stay');
  line.append(count, stayBtn);
  const bar = make(doc, 'div', 'sc-bar');
  bar.setAttribute('aria-hidden', 'true');
  const fill = make(doc, 'i', '');
  bar.append(fill);
  line.hidden = bar.hidden = !auto;
  const go = button(doc, 'sc-go', `${label} `);
  const arrow = make(doc, 'span', '', '\u2192');
  arrow.setAttribute('aria-hidden', 'true');
  go.append(arrow);
  next.append(line, bar, go);
  const foot = make(doc, 'div', 'sc-foot');
  foot.append(skipBtn, next);
  root.append(list, sum.el, live, foot);
  host.replaceChildren(root);

  let alive = true, done = false, ticking = false, announced = false;
  let raf = 0, timer = 0, speak = 0;
  /** @type {Playback} */
  const api = { skip, cancel: stop };
  running.set(host, api);

  /** @param {Row} r @param {number} v */
  function show(r, v) {
    const s = formatPoints(v);
    if (r.num.textContent !== s) r.num.textContent = s;
  }

  function frame() {
    raf = 0;
    const t = clock.elapsed();
    for (let i = 0; i < rows.length && t >= i * STEP_MS; i++) {
      const r = rows[i];
      if (!r.shown) {
        r.shown = true;
        r.el.classList.add('sc-in');
        if (r === sum) announce();
      }
      const p = Math.min(1, Math.max(0, (t - i * STEP_MS - COUNT_DELAY_MS) / COUNT_MS));
      show(r, r.points * (1 - (1 - p) ** 3));
    }
    if (t >= (rows.length - 1) * STEP_MS + COUNT_DELAY_MS + COUNT_MS) finish();
    else raf = win.requestAnimationFrame(frame);
  }

  function announce() {
    if (announced) return;
    announced = true;
    const msg = `Total ${formatPoints(total)} points.` + (auto ? ` ${label} in ${Math.ceil(limit / 1000)} seconds.` : '');
    speak = win.setTimeout(() => { live.textContent = msg; }, ANNOUNCE_MS);
  }

  function finish() {
    if (done) return;
    done = true;
    quiet();
    for (const r of rows) { r.shown = true; r.el.classList.add('sc-in'); show(r, r.points); }
    root.classList.add('sc-done');
    announce();
    skipBtn.hidden = true;
    next.hidden = false;
    if (auto) {
      ticking = true;
      secs.textContent = String(Math.ceil(limit / 1000));
      clock.reset(!doc.hidden);
      if (!doc.hidden) run();
    }
    // Only from inside the card or from nowhere: never out of a field the player is using.
    const a = doc.activeElement;
    if (!a || a === doc.body || (host.closest('#wincard') ?? host).contains(a)) go.focus({ preventScroll: true });
  }

  function run() {
    tick();
    if (!still) grow();
  }

  // Wakes on each whole second left, from active time, so a throttled timer cannot drift.
  function tick() {
    const left = limit - clock.elapsed();
    if (left <= 0) { advance(); return; }
    secs.textContent = String(Math.ceil(left / 1000));
    timer = win.setTimeout(tick, ((Math.ceil(left) - 1) % 1000) + 1);
  }

  function grow() {
    const p = Math.min(1, clock.elapsed() / limit);
    fill.style.transform = `scaleX(${p})`;
    raf = p < 1 ? win.requestAnimationFrame(grow) : 0;
  }

  function quiet() {
    win.clearTimeout(timer);
    win.cancelAnimationFrame(raf);
    timer = raf = 0;
  }

  function skip() { if (alive) finish(); }

  function advance() {
    if (!alive) return;
    stop();
    opts.onNext();
  }

  function stay() {
    if (!ticking) return;
    ticking = false;
    quiet();
    line.hidden = bar.hidden = true;
    go.focus({ preventScroll: true });   // Stay is gone; keep focus in the card
    opts.onStay();
  }

  function stop() {
    alive = ticking = false;
    quiet();
    win.clearTimeout(speak);
    doc.removeEventListener('visibilitychange', onVisibility);
    if (running.get(host) === api) running.delete(host);
  }

  // Pauses the reveal and the countdown alike, and picks both up where they stopped.
  function onVisibility() {
    quiet();
    if (doc.hidden) { clock.pause(); return; }
    clock.resume();
    if (!done) raf = win.requestAnimationFrame(frame);
    else if (ticking) run();
  }

  doc.addEventListener('visibilitychange', onVisibility);
  skipBtn.addEventListener('click', skip);
  list.addEventListener('click', skip);
  sum.el.addEventListener('click', skip);
  stayBtn.addEventListener('click', stay);
  go.addEventListener('click', advance);

  if (still) finish();
  else {
    clock.reset(!doc.hidden);
    if (!doc.hidden) raf = win.requestAnimationFrame(frame);
  }
  return api;
}
