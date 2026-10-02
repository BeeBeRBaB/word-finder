// A page inside the Settings card, opened from a row on the main page: it takes the card's
// place until Back returns to that row. Owns no setting; main.js reads and writes those.

/**
 * @typedef {{card:HTMLElement, page:HTMLElement, row:HTMLElement|(() => HTMLElement|null), back:HTMLElement,
 *   name:string, onOpen?:() => void, focus?:() => HTMLElement|null}} SubpageEls
 * `card` holds the main page and every subpage; `name` is what card[data-page] says while open;
 * `onOpen` runs before the page shows, to fill it. `row` is a function when the row is
 * re-rendered: it is then looked up each time, and main.js opens the page itself.
 * `focus` picks where focus lands instead of the current choice.
 */

/** @param {SubpageEls} els */
export function makeSubpage({ card, page, row, back, name, onOpen, focus }) {
  /** @returns {HTMLElement|null} */
  const rowEl = () => (typeof row === 'function' ? row() : row);
  /** @returns {boolean} */
  const isOpen = () => card.dataset.page === name;

  /** Focus lands on the current choice, so arrow keys move through the choices at once.
   * @returns {void} */
  function open() {
    onOpen?.();
    card.dataset.page = name;
    page.hidden = false;
    rowEl()?.setAttribute('aria-expanded', 'true');
    card.scrollTop = 0;
    const on = focus ? focus() : /** @type {HTMLElement|null} */ (page.querySelector('input:checked'));
    (on ?? back).focus({ preventScroll: true });
  }
  /** Back to the main page. `refocus` is false when the whole pane is closing.
   * @param {boolean} [refocus] @returns {void} */
  function close(refocus = true) {
    if (!isOpen()) return;
    delete card.dataset.page;
    page.hidden = true;
    const r = rowEl();
    r?.setAttribute('aria-expanded', 'false');
    if (refocus) r?.focus({ preventScroll: true });
  }
  if (typeof row !== 'function') {
    row.setAttribute('aria-expanded', 'false');
    row.addEventListener('click', open);
  }
  back.addEventListener('click', () => close());
  return { open, close, isOpen };
}
