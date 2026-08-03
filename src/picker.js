// The category dialog. Owns no game state: it reports a chosen category id and lets
// main.js decide what that means.

/** @typedef {import('./catalog.js').Category} Category */

/**
 * @param {{
 *   root:HTMLElement, select:HTMLSelectElement, warning:HTMLElement, error:HTMLElement,
 *   start:HTMLElement, surprise:HTMLElement, cancel:HTMLElement, categories:Category[],
 *   leastBox:HTMLInputElement,
 *   isUnavailable:(categoryId:string)=>boolean,
 *   isComplete:(categoryId:string)=>boolean,
 *   leastDefault:()=>boolean,
 *   onLeast:(on:boolean)=>void,
 *   onStart:(categoryId:string|null)=>Promise<void>,
 * }} deps
 */
export function makePicker({ root, select, warning, error, start, surprise, cancel, categories, leastBox, isUnavailable, isComplete, leastDefault, onLeast, onStart }) {
  // A disabled placeholder, then the real categories. Random is its own button, so the
  // list holds only things you can choose — no action hiding among the values.
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

  // True while a deal is in flight. Without it, Start twice deals two puzzles, and
  // Cancel closes over a pending deal that then replaces the board and overwrites the
  // save. Cancel must mean cancel, so the dialog refuses to close instead.
  let pending = false;
  /** @param {boolean} on @returns {void} */
  function setBusy(on) {
    pending = on;
    for (const b of [start, surprise, cancel]) b.toggleAttribute('disabled', on);
    root.setAttribute('aria-busy', String(on));
    if (!on) syncDisabled();
  }

  const close = () => { if (!pending) root.style.display = 'none'; };

  // Derived from main.js's shared failure record on every call, never tracked here, so
  // a category the random draw found dead is disabled even though this dialog never
  // showed it failing. Start follows the select: nothing chosen, nothing to start.
  /** @returns {void} */
  function syncDisabled() {
    for (const o of select.options) if (o.value) o.disabled = isUnavailable(o.value);
    start.toggleAttribute('disabled', !select.value);
  }

  /** Rewrite the option labels, marking categories the player has fully covered.
   *
   * Called from open(), BEFORE select.focus(), and never while the control is live.
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
    // choice would silently narrow every later game to it. The checkbox below is the
    // deliberate opposite — it IS a setting, so it reflects the stored value instead of
    // being reset. Do not "fix" the inconsistency; the two controls differ on purpose.
    select.value = '';
    labelOptions();
    leastBox.checked = leastDefault();
    syncDisabled();
    warning.style.display = inProgress ? '' : 'none';
    error.hidden = true;
    root.style.display = 'flex';
    select.focus();
  }

  /** @param {string|null} chosen @param {string} label @returns {Promise<void>} */
  async function deal(chosen, label) {
    if (pending) return;
    setBusy(true);
    try {
      await onStart(chosen);
      setBusy(false);
      close();
    } catch {
      // Offline with an uncached category, or a random draw that lost the race with the
      // network. Stay open and say so: closing would leave a half-built board with
      // nothing explaining it.
      error.textContent = chosen
        ? `${label} isn't available offline yet. Try another category.`
        : "No category is available offline yet. Try again once you're back online.";
      error.hidden = false;
      if (chosen) select.value = '';
      setBusy(false);
    }
  }

  select.addEventListener('change', syncDisabled);
  leastBox.addEventListener('change', () => onLeast(leastBox.checked));
  // The label from `categories`, not from the option's text: labelOptions() may have
  // appended "(done)" to that, which would then read back in the failure message as
  // "Nature (done) isn't available offline yet."
  start.addEventListener('click', () => {
    const id = select.value || null;
    void deal(id, (id && categories.find(c => c.id === id)?.name) || '');
  });
  surprise.addEventListener('click', () => { void deal(null, ''); });
  cancel.addEventListener('click', close);
  root.addEventListener('click', (e) => { if (e.target === root) close(); });

  return { open, close };
}
