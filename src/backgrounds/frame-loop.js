// Shared by the animated backgrounds, and not a background itself: the 30fps frame loop,
// paused while the page is hidden, and a re-measure whenever the host's box changes.

// Nothing here is precached, so changing an export needs a CACHE bump in sw.js: else an
// importer cached last week can meet this file's new copy.

const STEP = 1000 / 30;

/**
 * Calls `tick` at exactly 30fps unless `still`, never while the page is hidden, and `resize`
 * whenever the host's box changes. Calls neither now: the caller sizes and paints first.
 * @param {HTMLElement} host positioned element the background fills
 * @param {() => void} resize re-measures and repaints
 * @param {(ms:number, first:boolean) => void} tick advances and draws one frame: `ms` since the
 *   last tick, or since play for the `first` tick after starting or coming back into view
 * @param {boolean} still never ticks (reduced motion): only the first paint and resizes draw
 * @returns {() => void} stop: ends the loop and removes the observer and the listener
 */
export function frameLoop(host, resize, tick, still) {
  let raf = 0, last = 0, due = 0, first = true, live = true;

  /** @param {number} now @returns {void} */
  function frame(now) {
    raf = requestAnimationFrame(frame);
    if (now < due - 2) return;
    // Exactly 30fps at any refresh rate: each draw books the next 1/30s slot; a pause resyncs.
    due = (now - due > STEP ? now : due) + STEP;
    const ms = now - last, fresh = first;
    last = now;
    first = false;
    tick(ms, fresh);
  }
  /** @returns {void} */
  function play() {
    if (still || raf || !live || document.hidden) return;
    last = performance.now();
    first = true;
    raf = requestAnimationFrame(frame);
  }
  /** @returns {void} */
  function pause() { cancelAnimationFrame(raf); raf = 0; }

  const onVis = () => (document.hidden ? pause() : play());
  const ro = new ResizeObserver(resize);
  ro.observe(host);
  document.addEventListener('visibilitychange', onVis);
  play();

  return function stop() {
    live = false;
    pause();
    ro.disconnect();
    document.removeEventListener('visibilitychange', onVis);
  };
}
