// The category dialog. Owns no game state: it reports a chosen category id and lets
// main.js decide what that means.

/** @typedef {import('./catalog.js').Category} Category */

/**
 * @param {{
 *   root:HTMLElement, select:HTMLSelectElement, warning:HTMLElement, error:HTMLElement,
 *   start:HTMLElement, surprise:HTMLElement, cancel:HTMLElement, categories:Category[],
 *   isUnavailable:(categoryId:string)=>boolean,
 *   onStart:(categoryId:string|null)=>Promise<void>,
 * }} deps
 */
export function makePicker({ root, select, warning, error, start, surprise, cancel, categories, isUnavailable, onStart }) {
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

  /** @param {boolean} inProgress @returns {void} */
  function open(inProgress) {
    // Reset on every open. Choosing a category is an act, not a setting: a remembered
    // choice would silently narrow every later game to it.
    select.value = '';
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
  start.addEventListener('click', () => { void deal(select.value || null, select.selectedOptions[0]?.textContent ?? ''); });
  surprise.addEventListener('click', () => { void deal(null, ''); });
  cancel.addEventListener('click', close);
  root.addEventListener('click', (e) => { if (e.target === root) close(); });

  return { open, close };
}
