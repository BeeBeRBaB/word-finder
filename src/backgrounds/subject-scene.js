// Subject scene: the subject's icons composed into one still picture, re-laid out on resize.
// The seed picks one of the subject's fixed variants (icon-scene.js).

import { makeRng } from '../rng.js';
import { iconMarkup, iconsFor, layoutScene, sceneColors, variantOf, withHero } from './icon-scene.js';
import { hostSize } from './frame-loop.js';

/** @typedef {{colors:string[], dark:boolean, reducedMotion:boolean, subject:string, seed?:number}} BackgroundOptions */

const NS = 'http://www.w3.org/2000/svg';

/**
 * @param {HTMLElement} host positioned element the scene fills
 * @param {BackgroundOptions} opts
 * @returns {() => void} stop: undoes everything start did
 */
export function start(host, opts) {
  const subject = opts.subject;
  const colors = sceneColors(opts.colors, 'currentColor');
  const { layout, hero, seed } = variantOf(subject, opts.seed ?? 0);
  const ids = withHero(iconsFor(subject), hero);
  /** @type {Map<string, string>} */
  const markup = new Map(ids.map(id => [id, iconMarkup(id)]));
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('aria-hidden', 'true');
  svg.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none;overflow:hidden';
  host.appendChild(svg);
  let W = 0, H = 0;

  /** @returns {void} */
  function draw() {
    const [w, h] = hostSize(host);
    if (w === W && h === H) return;
    W = w; H = h;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    // A fresh rng per layout, so a resize re-flows the same variant instead of drawing a new one.
    const placed = layoutScene(layout, ids, W, H, makeRng(seed));
    svg.innerHTML = placed.map(p => {
      const c = colors[p.hue % colors.length], s = p.size / 64;
      return `<g transform="translate(${(p.x - p.size / 2).toFixed(1)} ${(p.y - p.size / 2).toFixed(1)}) ` +
        `rotate(${p.rot.toFixed(1)} ${(p.size / 2).toFixed(1)} ${(p.size / 2).toFixed(1)}) scale(${s.toFixed(3)})" ` +
        `fill="${c}" color="${c}" opacity="${p.alpha}" data-icon="${p.id}">${markup.get(p.id)}</g>`;
    }).join('');
  }

  const ro = new ResizeObserver(draw);
  ro.observe(host);
  draw();

  return function stop() {
    ro.disconnect();
    svg.remove();
  };
}
