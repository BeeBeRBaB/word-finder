// Shared by the pixel backgrounds, and not a background itself: one canvas of 4-8px cells
// scaled up with pixelated rendering, run by the 30fps loop in frame-loop.js.
import { frameLoop } from './frame-loop.js';

/**
 * @typedef {{resize:(W:number, H:number) => void, step:(dt:number) => void, draw:() => void}} Scene
 * resize repaints for a W x H cell grid, step advances dt seconds, draw paints one frame.
 * @typedef {{ctx:CanvasRenderingContext2D, run:(scene:Scene, still:boolean) => () => void}} Stage
 */

/**
 * The display canvas for `host`. Nothing is added to the page until `run`, which draws,
 * animates unless `still`, and returns the stop function that undoes all of it.
 * @param {HTMLElement} host positioned element the canvas fills
 * @returns {Stage | null} null when the browser has no 2d canvas
 */
export function pixelStage(host) {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'position:absolute;inset:0;overflow:hidden;pointer-events:none';
  const cv = wrap.appendChild(document.createElement('canvas'));
  cv.style.cssText = 'position:absolute;left:0;top:0;image-rendering:pixelated';
  const ctx = cv.getContext('2d');
  if (!ctx) return null;

  /** @param {Scene} scene @param {boolean} still @returns {() => void} stop */
  function run(scene, still) {
    let pw = 0, ph = 0;

    /** @returns {void} */
    function size() {
      const w = host.clientWidth || innerWidth, h = host.clientHeight || innerHeight;
      if (w === pw && h === ph) return;
      pw = w; ph = h;
      const px = Math.max(4, Math.min(8, Math.round(Math.min(w, h) / 140)));
      const W = Math.ceil(w / px), H = Math.ceil(h / px);
      cv.width = W; cv.height = H;
      cv.style.width = W * px + 'px'; cv.style.height = H * px + 'px';
      scene.resize(W, H);
      scene.draw();
    }

    host.appendChild(wrap);
    size();
    const stop = frameLoop(host, size, (dt) => { scene.step(dt); scene.draw(); }, still);
    return () => { stop(); wrap.remove(); };
  }

  return { ctx, run };
}
