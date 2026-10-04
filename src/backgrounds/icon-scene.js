// Shared by the subject backgrounds, and not a background itself: which icons a subject
// shows, how a variant lays them out, and the icon markup with its tones as attributes.

// Nothing here is precached, so changing an export needs a CACHE bump in sw.js: else an
// importer cached last week can meet this file's new copy.

import { fnv1a } from '../rng.js';
import { TONE } from '../art.js';
import { categoryOf } from '../catalog.js';
import { FACING, ICONS } from './icons.js';
import { CATEGORY_ICONS, CATEGORY_MOTION, SUBJECT_ICONS, SUBJECT_MOTION } from './subject-icons.js';

/** @typedef {{id:string, x:number, y:number, size:number, rot:number, hue:number, alpha:number}} Placed
 * x, y is the icon's centre in CSS px, size its edge, rot degrees, hue an index into the colours. */

/** Seeds give each subject this many fixed scenes: three layouts, each with two heroes. */
export const VARIANTS = 6;

/** The theme's colours, or `fallback` alone while they are empty: the stylesheet has not applied,
 * which boot stops waiting for after 2s. @param {string[]} colors @param {string} fallback
 * @returns {string[]} */
export function sceneColors(colors, fallback) {
  const given = colors.filter(Boolean);
  return given.length ? given : [fallback];
}

/** The subject's own icons, else its category's, hero first.
 * @param {string} subject e.g. 'animals/frogs' @returns {string[]} */
export function iconsFor(subject) {
  const list = SUBJECT_ICONS[subject] ?? CATEGORY_ICONS[categoryOf(subject)] ?? CATEGORY_ICONS.nature;
  return list.split(' ').filter(id => id in ICONS);
}

/** Which way an icon is drawn facing: -1 left, 1 right, 0 front-on or symmetric. A motion that
 * moves it sideways mirrors it to face its way. @param {string} id @returns {number} */
export function facingOf(id) {
  return FACING[id] ?? 0;
}

/** The motion id the subject moves with (subject-motion.js), else its category's, else drift.
 * @param {string} subject @returns {string} */
export function motionFor(subject) {
  return SUBJECT_MOTION[subject] ?? CATEGORY_MOTION[categoryOf(subject)] ?? 'drift';
}

/** The variant a seed picks, and the seed its layout rng starts from: the same subject and
 * variant always give the same scene. @param {string} subject @param {number} seed
 * @returns {{layout:number, hero:number, seed:number}} */
export function variantOf(subject, seed) {
  const v = (seed >>> 0) % VARIANTS;
  return { layout: v % 3, hero: Math.floor(v / 3), seed: (fnv1a(subject) ^ Math.imul(v + 1, 0x9E3779B1)) >>> 0 };
}

/** The ids with the chosen hero moved to the front. @param {string[]} ids @param {number} hero
 * @returns {string[]} */
export function withHero(ids, hero) {
  const k = Math.min(hero, ids.length - 1);
  return [ids[k], ...ids.filter((_, i) => i !== k)];
}

/** Icon markup that needs no stylesheet: the tone classes become presentation attributes, so
 * a parent's fill and color tint it, inline or as an image. @param {string} id @returns {string} */
export function iconMarkup(id) {
  /** @param {string} _ @param {string} tag @param {string} a @param {string} cls @param {string} b @param {string} end */
  const tone = (_, tag, a, cls, b, end) => {
    const rest = a + b;
    const attrs = cls === 't-a' ? ` fill-opacity="${TONE.a}"` : cls === 't-c' ? ` fill-opacity="${TONE.c}"` : cls === 't-b' ? '' :
      ` fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"${/stroke-width=/.test(rest) ? '' : ' stroke-width="2"'}`;
    return `<${tag}${rest}${attrs}${end}>`;
  };
  return (ICONS[id] ?? '').replace(/<(\w+)([^>]*?) class="(t-a|t-b|t-c|ln)"([^>]*?)(\/?)>/g, tone);
}

/** A standalone SVG document for one icon in one colour, for drawing onto a canvas.
 * @param {string} id @param {string} color @param {number} px @returns {string} */
export function iconSvg(id, color, px) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="${px}" height="${px}">` +
    `<g fill="${color}" color="${color}">${iconMarkup(id)}</g></svg>`;
}

/** Rasterises each icon once, `px` square in the colour `colorOf` gives it, for the canvas
 * backgrounds. `ready` runs as each one lands; the returned cancel drops any still loading.
 * @param {string[]} ids @param {(i:number) => string} colorOf @param {number} px
 * @param {(i:number, sprite:HTMLCanvasElement) => void} ready @returns {() => void} */
export function iconSprites(ids, colorOf, px, ready) {
  let live = true;
  ids.forEach((id, i) => {
    const img = new Image();
    img.onload = () => {
      if (!live) return;
      const s = document.createElement('canvas');
      s.width = s.height = px;
      s.getContext('2d')?.drawImage(img, 0, 0, px, px);
      ready(i, s);
    };
    img.src = 'data:image/svg+xml,' + encodeURIComponent(iconSvg(id, colorOf(i), px));
  });
  return () => { live = false; };
}

/**
 * Places icons over a W x H host. Layout 0 scatters them on a jittered grid, 1 is a tidy
 * staggered wallpaper, 2 is one large hero bleeding off a corner with small icons around it.
 * @param {number} layout @param {string[]} ids hero first @param {number} W @param {number} H
 * @param {import('../rng.js').Rng} rng @returns {Placed[]}
 */
export function layoutScene(layout, ids, W, H, rng) {
  /** @type {Placed[]} */
  const out = [];
  const n = ids.length;
  if (!n || W <= 0 || H <= 0) return out;
  const hueAt = rng.int(5);
  const short = Math.min(W, H);
  // Cell edge: about 120px on a laptop, never so small a narrow rail gets confetti.
  const cell = Math.max(64, Math.min(150, Math.sqrt(W * H / 34), short / 1.6));
  const cols = Math.max(1, Math.round(W / cell)), rows = Math.max(1, Math.round(H / cell));
  const cw = W / cols, ch = H / rows;
  if (layout === 1) {
    const size = Math.min(cw, ch) * 0.5;
    for (let r = -1; r <= rows; r++) {
      const off = (r & 1) * cw / 2;
      for (let c = -1; c <= cols; c++) {
        const k = ((r * 2 + c) % n + n) % n;
        out.push({ id: ids[k], x: c * cw + cw / 2 + off, y: r * ch + ch / 2, size, rot: 0, hue: (hueAt + ((r % 2) + 2) % 2) % 5, alpha: 0.5 });
      }
    }
    return out;
  }
  let hero = null;
  if (layout === 2) {
    const size = Math.min(short * 0.62, 520), right = rng.random() < 0.5, low = rng.random() < 0.6;
    hero = { x: right ? W - size * 0.38 : size * 0.38, y: low ? H - size * 0.38 : size * 0.38, r: size * 0.48 };
    out.push({ id: ids[0], x: hero.x, y: hero.y, size, rot: (right ? -1 : 1) * (4 + rng.random() * 6), hue: hueAt, alpha: 0.4 });
  }
  const pool = layout === 2 && n > 1 ? ids.slice(1) : ids;
  const order = rng.shuffle(pool);
  let k = 0;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const x = (c + 0.5 + (rng.random() - 0.5) * 0.55) * cw, y = (r + 0.5 + (rng.random() - 0.5) * 0.55) * ch;
    const size = Math.min(cw, ch) * (layout === 2 ? 0.42 : 0.5 + rng.random() * 0.22);
    if (hero && Math.hypot(x - hero.x, y - hero.y) < hero.r + size * 0.35) continue;
    out.push({ id: order[k % order.length], x, y, size, rot: (rng.random() - 0.5) * 36, hue: (hueAt + 1 + (k % 4)) % 5, alpha: 0.5 });
    k++;
  }
  return out;
}
