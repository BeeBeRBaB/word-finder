// The category dialog. Owns no game state: it reports a chosen category id and lets
// main.js decide what that means. Split out of main.js because that module is the
// single home of mutable game state and this is a self-contained piece of DOM with
// one output.

/** @typedef {import('./catalog.js').Category} Category */

/**
 * @param {{
 *   root:HTMLElement, select:HTMLSelectElement, warning:HTMLElement, error:HTMLElement,
 *   start:HTMLElement, cancel:HTMLElement, categories:Category[],
 *   onStart:(categoryId:string|null)=>Promise<void>,
 * }} deps
 */
export function makePicker({ root, select, warning, error, start, cancel, categories, onStart }) {
  // The empty value is Surprise me, so "no category chosen" and "the default" are the
  // same state and neither needs a sentinel string.
  select.innerHTML = '';
  for (const [value, label] of [['', 'Surprise me'], ...categories.map(c => [c.id, c.name])]) {
    const o = document.createElement('option');
    o.value = value;
    o.textContent = label;
    select.appendChild(o);
  }

  const close = () => { root.style.display = 'none'; };

  /** @param {boolean} inProgress @returns {void} */
  function open(inProgress) {
    // Reset to Surprise me on every open. Choosing a category is an act, not a
    // setting: a remembered choice would silently narrow every later game to it.
    select.value = '';
    warning.style.display = inProgress ? '' : 'none';
    error.hidden = true;
    root.style.display = 'flex';
    select.focus();
  }

  start.addEventListener('click', async () => {
    const chosen = select.value || null;
    /** @type {HTMLOptionElement} */
    const option = select.selectedOptions[0];
    try {
      await onStart(chosen);
      close();
    } catch {
      // Offline with an uncached category. Stay open, say so, and disable the option
      // so it cannot be chosen again this session — closing on failure would leave a
      // half-built board with nothing explaining it.
      error.textContent = chosen
        ? `${option.textContent} isn't available offline yet. Try another category.`
        : 'No categories are available offline yet.';
      error.hidden = false;
      if (chosen) { option.disabled = true; select.value = ''; }
    }
  });
  cancel.addEventListener('click', close);
  root.addEventListener('click', (e) => { if (e.target === root) close(); });

  return { open, close };
}
