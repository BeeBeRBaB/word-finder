// The category dialog. Owns no game state: it reports a chosen category id and lets
// main.js decide what that means.

/**
 * @typedef {import('./catalog.js').Category} Category
 * @typedef {'random'|'levels'} PlayMode
 * @typedef {{enabled:() => boolean, getMode:() => PlayMode, setMode:(m:PlayMode) => void,
 *   render:(host:HTMLElement) => {ready:boolean, start:string}, onLevel:() => Promise<void>}} LevelSide
 *   The Levels side, offered while `enabled()`: `render` fills its pane and says what Start
 *   reads; `onLevel` deals the level. Its failures are handled like a category's.
 */

/**
 * `heading` takes focus on open: focusing the select instead opened it at once on an iPhone.
 * @param {{
 *   root:HTMLElement, heading:HTMLElement, select:HTMLSelectElement, warning:HTMLElement, error:HTMLElement,
 *   start:HTMLElement, cancel:HTMLElement, categories:Category[],
 *   isUnavailable:(categoryId:string)=>boolean,
 *   isComplete:(categoryId:string)=>boolean,
 *   onStart:(categoryId:string|null)=>Promise<void>,
 *   opener?:HTMLElement, levels?:LevelSide, behind?:HTMLElement[],
 * }} deps `behind` is the page under the dialog, inert while it is open.
 */
export function makePicker({ root, heading, select, warning, error, start, cancel, categories, isUnavailable, isComplete, onStart, opener, levels, behind = [] }) {
  // A disabled placeholder, then the real categories. Random is the header's one-click New
  // game, so the list holds only things you can choose — no action hiding among the values.
  select.innerHTML = '';
  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = 'Choose a category…';
  placeholder.disabled = true;
  select.appendChild(placeholder);
  for (const c of categories) {
    const o = document.createElement('option');
    o.value = c.id;
    o.textContent = c.name;
    select.appendChild(o);
  }

  // Random | Levels, under the heading, and the Levels pane in the category's place. Built
  // here so the markup holds only what every game shows.
  const doc = root.ownerDocument;
  const seg = doc.createElement('div');
  seg.className = 'seg';
  seg.id = 'picker-mode';
  seg.setAttribute('role', 'group');
  seg.setAttribute('aria-label', 'Game');
  for (const [mode, text] of [['random', 'Random'], ['levels', 'Levels']]) {
    const b = doc.createElement('button');
    b.type = 'button';
    b.dataset.mode = mode;
    b.textContent = text;
    seg.append(b);
  }
  heading.after(seg);
  const pane = doc.createElement('div');
  pane.id = 'picker-level';
  error.before(pane);
  // Shown and hidden by style throughout: .seg and the category label set display, which
  // would beat the hidden attribute.
  const field = select.parentElement, label = select.labels?.[0];
  let levelReady = false;
  seg.style.display = pane.style.display = 'none';

  /** @returns {boolean} */
  const onLevels = () => !!levels && levels.enabled() && levels.getMode() === 'levels';

  /** Show the side the player last chose; Random whenever levels are unavailable.
   * @returns {void} */
  function showSide() {
    seg.style.display = levels && levels.enabled() ? '' : 'none';
    const lv = onLevels();
    for (const b of seg.querySelectorAll('button')) b.setAttribute('aria-pressed', String((b.dataset.mode === 'levels') === lv));
    for (const el of [field, label]) if (el) el.style.display = lv ? 'none' : '';
    pane.style.display = lv ? '' : 'none';
    if (lv && levels) {
      const r = levels.render(pane);
      levelReady = r.ready;
      start.textContent = r.start;
    } else {
      pane.replaceChildren();
      start.textContent = 'Start';
    }
  }

  // True while a deal is in flight. Without it, Start twice deals two puzzles, and
  // Cancel closes over a pending deal that then replaces the board and overwrites the
  // save. Cancel must mean cancel, so the dialog refuses to close instead.
  let pending = false;
  /** @param {boolean} on @returns {void} */
  function setBusy(on) {
    pending = on;
    for (const b of [start, cancel]) b.toggleAttribute('disabled', on);
    root.setAttribute('aria-busy', String(on));
    if (!on) syncDisabled();
  }

  // Focus goes back to the button that opened the pane, or it is left on a hidden element.
  const close = () => {
    if (pending || root.style.display !== 'flex') return;
    root.style.display = 'none';
    for (const el of behind) el.inert = false;
    opener?.setAttribute('aria-expanded', 'false');
    opener?.focus();
  };

  // Derived from main.js's shared failure record on every call, never tracked here, so
  // a category the random draw found dead is disabled even though this dialog never
  // showed it failing. Start follows the select: nothing chosen, nothing to start.
  /** @returns {void} */
  function syncDisabled() {
    for (const o of select.options) if (o.value) o.disabled = isUnavailable(o.value);
    start.toggleAttribute('disabled', onLevels() ? !levelReady : !select.value);
  }

  /** Rewrite the option labels, marking categories the player has fully covered.
   *
   * Called from open(), before the dialog takes focus, and never while the control is live.
   * Changing a focused control's accessible name is not reliably announced — JAWS+Chrome
   * and NVDA+Firefox have both been measured failing on it, and devtools hide the bug by
   * showing the new name while the screen reader still reports the old one. Rewriting
   * before focus is a fresh render rather than a rename.
   *
   * The mark is text, not a tick glyph: <option> permits only text content, and a check
   * character is announced inconsistently across screen readers.
   * @returns {void} */
  function labelOptions() {
    for (const o of select.options) {
      if (!o.value) continue;
      const c = categories.find(x => x.id === o.value);
      if (c) o.textContent = isComplete(o.value) ? `${c.name} (done)` : c.name;
    }
  }

  /** @param {boolean} inProgress @returns {void} */
  function open(inProgress) {
    // Reset on every open. Choosing a category is an act, not a setting: a remembered
    // choice would silently narrow every later game to it. (Least-seen IS a setting, which
    // is why it lives in Settings rather than here.)
    select.value = '';
    labelOptions();
    showSide();
    syncDisabled();
    warning.style.display = inProgress ? '' : 'none';
    error.hidden = true;
    root.style.display = 'flex';
    for (const el of behind) el.inert = true;
    opener?.setAttribute('aria-expanded', 'true');
    heading.focus();
  }

  /** @param {string|null} chosen @param {string} label @returns {Promise<void>} */
  async function deal(chosen, label) {
    if (pending) return;
    const lv = onLevels();
    setBusy(true);
    try {
      await (lv && levels ? levels.onLevel() : onStart(chosen));
      setBusy(false);
      close();
    } catch {
      // Offline with an uncached category, or a random draw that lost the race with the
      // network. Stay open and say so: closing would leave a half-built board with
      // nothing explaining it.
      error.hidden = false;
      error.textContent = lv ? "This level isn't available offline yet. Try again once you're back online."
        : chosen ? `${label} isn't available offline yet. Try another category.`
          : "No category is available offline yet. Try again once you're back online.";
      if (chosen && !lv) select.value = '';
      setBusy(false);
      // A short screen scrolls the card: keep the message and the buttons under it in view.
      start.scrollIntoView({ block: 'nearest' });
    }
  }

  seg.addEventListener('click', (e) => {
    const b = e.target instanceof Element ? e.target.closest('button[data-mode]') : null;
    if (!b || !levels || pending) return;
    levels.setMode(/** @type {PlayMode} */ (/** @type {HTMLElement} */ (b).dataset.mode));
    error.hidden = true;
    showSide();
    syncDisabled();
  });

  select.addEventListener('change', syncDisabled);
  // The label from `categories`, not from the option's text: labelOptions() may have
  // appended "(done)" to that, which would then read back in the failure message as
  // "Nature (done) isn't available offline yet."
  start.addEventListener('click', () => {
    const id = select.value || null;
    void deal(id, (id && categories.find(c => c.id === id)?.name) || '');
  });
  cancel.addEventListener('click', close);
  root.addEventListener('click', (e) => { if (e.target === root) close(); });

  /** Redraw the Levels pane and the offered categories, as when the account or the network
   * has changed. Focus inside the pane moves to its new button, else to Start, else to the
   * heading, never to the page. @returns {void} */
  function refresh() {
    if (root.style.display !== 'flex' || pending) return;
    const had = pane.contains(doc.activeElement);
    showSide();
    syncDisabled();
    if (!had) return;
    const next = pane.querySelector('button') ?? (start.hasAttribute('disabled') ? heading : start);
    /** @type {HTMLElement} */ (next).focus();
  }

  return { open, close, refresh };
}
