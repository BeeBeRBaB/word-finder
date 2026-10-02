// A page inside the Settings card, opened from a row on the main page: it takes the card's
// place until Back returns to that row. Owns no setting; main.js reads and writes those.

/**
 * @typedef {{card:HTMLElement, page:HTMLElement, row:HTMLElement, back:HTMLElement, name:string}} SubpageEls
 * `card` holds the main page and every subpage; `name` is what card[data-page] says while open.
 */

/** @param {SubpageEls} els */
export function makeSubpage({ card, page, row, back, name }) {
  /** @returns {boolean} */
  const isOpen = () => card.dataset.page === name;

  /** Focus lands on the current choice, so arrow keys move through the choices at once.
   * @returns {void} */
  function open() {
    card.dataset.page = name;
    page.hidden = false;
    row.setAttribute('aria-expanded', 'true');
    card.scrollTop = 0;
    const on = /** @type {HTMLElement|null} */ (page.querySelector('input:checked'));
    (on ?? back).focus({ preventScroll: true });
  }
  /** Back to the main page. `refocus` is false when the whole pane is closing.
   * @param {boolean} [refocus] @returns {void} */
  function close(refocus = true) {
    if (!isOpen()) return;
    delete card.dataset.page;
    page.hidden = true;
    row.setAttribute('aria-expanded', 'false');
    if (refocus) row.focus({ preventScroll: true });
  }
  row.setAttribute('aria-expanded', 'false');
  row.addEventListener('click', open);
  back.addEventListener('click', () => close());
  return { open, close, isOpen };
}
