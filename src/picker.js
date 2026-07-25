// The category dialog. Owns no game state: it reports a chosen category id and lets
// main.js decide what that means. Split out of main.js because that module is the
// single home of mutable game state and this is a self-contained piece of DOM with
// one output.

/** @typedef {import('./catalog.js').Category} Category */

/**
 * @param {{
 *   root:HTMLElement, select:HTMLSelectElement, warning:HTMLElement, error:HTMLElement,
 *   start:HTMLElement, cancel:HTMLElement, categories:Category[],
 *   isUnavailable:(categoryId:string)=>boolean,
 *   onStart:(categoryId:string|null)=>Promise<void>,
 * }} deps
 */
export function makePicker({ root, select, warning, error, start, cancel, categories, isUnavailable, onStart }) {
  // The empty value is Surprise me, so "no category chosen" and "the default" are the
  // same state and neither needs a sentinel string.
  select.innerHTML = '';
  for (const [value, label] of [['', 'Surprise me'], ...categories.map(c => [c.id, c.name])]) {
    const o = document.createElement('option');
    o.value = value;
    o.textContent = label;
    select.appendChild(o);
  }

  // True while a deal is in flight. `onStart` is async and can take as long as a
  // module fetch on a slow connection, during which the dialog stays open and every
  // control still works. Without this, two ways to lose a game in progress: tapping
  // Start twice deals two puzzles from one dialog, and tapping Cancel closes over a
  // pending deal that lands seconds later, replacing the board and overwriting the
  // save of the game the player just chose to keep. Cancel means cancel, so the
  // dialog refuses to close rather than closing on a promise it cannot recall.
  let pending = false;
  /** @param {boolean} on @returns {void} */
  function setBusy(on) {
    pending = on;
    start.toggleAttribute('disabled', on);
    cancel.toggleAttribute('disabled', on);
    root.setAttribute('aria-busy', String(on));
  }

  const close = () => { if (!pending) root.style.display = 'none'; };

  // Disabled state is derived from main.js's shared failure record on every call,
  // never tracked here — main.js's random draw (used by both Surprise me and the win
  // card, which bypasses this dialog entirely) reads the same record, so a category
  // this dialog has never even shown as failed still cannot come back around.
  /** @returns {void} */
  function syncDisabled() {
    for (const o of select.options) if (o.value) o.disabled = isUnavailable(o.value);
  }

  /** @param {boolean} inProgress @returns {void} */
  function open(inProgress) {
    // Reset to Surprise me on every open. Choosing a category is an act, not a
    // setting: a remembered choice would silently narrow every later game to it.
    select.value = '';
    syncDisabled();
    warning.style.display = inProgress ? '' : 'none';
    error.hidden = true;
    root.style.display = 'flex';
    select.focus();
  }

  start.addEventListener('click', async () => {
    if (pending) return;
    const chosen = select.value || null;
    /** @type {HTMLOptionElement} */
    const option = select.selectedOptions[0];
    setBusy(true);
    try {
      await onStart(chosen);
      setBusy(false);
      close();
    } catch {
      setBusy(false);
      // Offline with an uncached category, or a Surprise me draw that lost the race
      // with the network. Stay open, say so, and resync every option's disabled state
      // from the record main.js's newGame() just updated — closing on failure would
      // leave a half-built board with nothing explaining it, and only disabling the
      // one option picker.js already knew about would miss a category the random
      // draw just found dead on its own.
      error.textContent = chosen
        ? `${option.textContent} isn't available offline yet. Try another category.`
        : "That category isn't available offline yet. Try Surprise me again.";
      error.hidden = false;
      syncDisabled();
      if (chosen) select.value = '';
    }
  });
  cancel.addEventListener('click', close);
  root.addEventListener('click', (e) => { if (e.target === root) close(); });

  return { open, close };
}
