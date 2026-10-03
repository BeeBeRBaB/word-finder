// A modal pane over the page: New game and Settings. Shown by style; while it shows, the page
// under it is inert, as its aria-modal says, and the button that opens it reads expanded.

/**
 * Focus goes to the heading on open, never a control: a select focused from a tap opens at once
 * on an iPhone. On close it goes back to the opener, or it is left on a hidden element.
 * @param {{root:HTMLElement, heading:HTMLElement, opener?:HTMLElement, behind?:HTMLElement[], onClose?:() => void}} els
 *   `behind` is the page under the pane; `onClose` runs once the pane has closed.
 */
export function makePane({ root, heading, opener, behind = [], onClose }) {
  /** @returns {boolean} */
  const isOpen = () => root.style.display === 'flex';
  /** @param {boolean} on @returns {void} */
  function show(on) {
    root.style.display = on ? 'flex' : 'none';
    for (const el of behind) el.inert = on;
    opener?.setAttribute('aria-expanded', String(on));
    (on ? heading : opener)?.focus({ preventScroll: true });
  }
  opener?.setAttribute('aria-expanded', 'false');
  return {
    isOpen,
    /** @returns {void} */
    open: () => show(true),
    /** @returns {void} */
    close: () => { if (isOpen()) { show(false); onClose?.(); } },
  };
}
