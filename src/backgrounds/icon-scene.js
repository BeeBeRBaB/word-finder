// Shared by the subject backgrounds, and not a background itself: which icons a subject
// shows, how a variant lays them out, and the icon markup with its tones as attributes.

// Nothing here is precached, so changing an export needs a CACHE bump in sw.js: else an
// importer cached last week can meet this file's new copy.

import { fnv1a } from '../rng.js';
import { categoryOf } from '../catalog.js';
import { FACING, ICONS } from './icons.js';
import { CATEGORY_ICONS, CATEGORY_MOTION, SUBJECT_ICONS, SUBJECT_MOTION } from './subject-icons.js';

/** Each icon tone's opacity, so 'b' is the densest: t-a main, t-b shade, t-c highlight.
 * @type {Readonly<Record<string, number>>} */
const TONE = Object.freeze({ a: 0.72, b: 1, c: 0.4 });

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
