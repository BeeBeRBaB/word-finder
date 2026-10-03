// Shared by the backgrounds, and not a background itself: the canvas the animated ones draw on,
// the host's size, and the 30fps frame loop, paused while the page is hidden, with a re-measure
// whenever the host's box changes.

// Nothing here is precached, so changing an export needs a CACHE bump in sw.js: else an
// importer cached last week can meet this file's new copy.

const STEP = 1000 / 30;

/**
 * A canvas laid over `host`, out of the way of pointers and assistive tech, with its 2d context.
 * Null, having added nothing, where the browser has no 2d canvas.
 * @param {HTMLElement} host positioned element the canvas covers
 * @param {boolean} [pixelated] square pixels scaled up, at the size the caller sets; else it fills the host
 * @returns {{cv:HTMLCanvasElement, ctx:CanvasRenderingContext2D}|null}
 */
export function hostCanvas(host, pixelated = false) {
  const cv = document.createElement('canvas');
  const ctx = cv.getContext('2d');
  if (!ctx) return null;
  cv.setAttribute('aria-hidden', 'true');
  cv.style.cssText = 'position:absolute;left:0;top:0;display:block;pointer-events:none;'
    + (pixelated ? 'image-rendering:crisp-edges;image-rendering:pixelated' : 'width:100%;height:100%');
  host.appendChild(cv);
  return { cv, ctx };
}

/** The host's size in CSS pixels, or the window's while the host has none (not laid out yet).
 * @param {HTMLElement} host @returns {[number, number]} */
export const hostSize = (host) => [host.clientWidth || innerWidth, host.clientHeight || innerHeight];

/**
 * Calls `tick` at exactly 30fps unless `still`, never while the page is hidden, and `resize`
 * whenever the host's box changes. Calls neither now: the caller sizes and paints first.
 * @param {HTMLElement} host positioned element the background fills
 * @param {() => void} resize re-measures and repaints
 * @param {(dt:number) => void} tick advances and draws one frame: `dt` seconds since the last
 *   one, at most 0.1, and 0 for the first after starting or coming back into view
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
    const dt = first ? 0 : Math.min(0.1, (now - last) / 1000);
    last = now;
    first = false;
    tick(dt);
  }
  /** @returns {void} */
  function play() {
    if (still || raf || !live || document.hidden) return;
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
