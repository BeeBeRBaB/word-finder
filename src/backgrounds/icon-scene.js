// Shared by the subject backgrounds, and not a background itself: which icons a subject
// shows, which way they face, and their sprites in either style.

// Nothing here is precached, so changing an export, or which icons a category maps, needs a CACHE
// bump in sw.js: else an importer cached last week can meet this file's new copy.

import { fnv1a } from '../rng.js';
import { retryingImport } from '../importer.js';
import { categoryOf } from '../catalog.js';
import { CATEGORY_ICONS, CATEGORY_MOTION, FACING, SUBJECT_ICONS, SUBJECT_MOTION } from './subject-icons.js';

/** @typedef {'mono'|'flat'} IconStyle mono draws each icon in one of the look's colours, flat in
 * its own colours. */

/** Seeds give each subject this many fixed scenes: three layouts, each with two heroes. */
export const VARIANTS = 6;

/** The theme's colours, or `fallback` alone while they are empty: the stylesheet has not applied,
 * which boot stops waiting for after 2s. @param {string[]} colors @param {string} fallback
 * @returns {string[]} */
export function sceneColors(colors, fallback) {
  const given = colors.filter(Boolean);
  return given.length ? given : [fallback];
}

/** The category whose icons a subject shows: its own, else nature's.
 * @param {string} subject @returns {string} */
function iconCategory(subject) {
  const cat = categoryOf(subject);
  return CATEGORY_ICONS[cat] ? cat : 'nature';
}

/** The subject's own icons, else its category's, hero first.
 * @param {string} subject e.g. 'animals/frogs' @returns {string[]} */
export function iconsFor(subject) {
  return (SUBJECT_ICONS[subject] ?? CATEGORY_ICONS[iconCategory(subject)]).split(' ');
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

/** A drawings file, icons/<style>/<category>.js, tried again under a new URL after a failure
 * (importer.js says why). @type {(file:string) => Promise<{ICONS:Readonly<Record<string, string>>}>} */
const importDrawings = retryingImport((file, query) => import(`./icons/${file}.js${query}`));
/** @type {Map<string, Promise<Readonly<Record<string, string>>>>} */
const drawings = new Map();

/** The drawings of every icon a subject's category maps, in a style: one file, loaded once, and
 * again after a failed load. @param {string} subject @param {IconStyle} style
 * @returns {Promise<Readonly<Record<string, string>>>} */
function drawingsFor(subject, style) {
  const file = `${style}/${iconCategory(subject)}`;
  let p = drawings.get(file);
  if (!p) {
    p = importDrawings(file).then(m => m.ICONS, (e) => { drawings.delete(file); throw e; });
    drawings.set(file, p);
  }
  return p;
}

/** A standalone SVG document for one drawing, for drawing onto a canvas: `color` tints one in
 * currentColor and leaves a flat one's own colours. @param {string} markup @param {string} color
 * @param {number} px @returns {string} */
function iconSvg(markup, color, px) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="${px}" height="${px}">` +
    `<g fill="${color}" color="${color}">${markup}</g></svg>`;
}

/** Rasterises each icon once, `px` square, in the colour `colorOf` gives it or, `flat`, its own,
 * for the canvas backgrounds. The icons are the subject's (`opts.subject`), in `opts.icons`'s
 * style; drawings that failed to load (offline) are tried again when the device is back online.
 * `ready` runs as each one lands; the returned cancel drops any still loading.
 * @param {string[]} ids @param {(i:number) => string} colorOf @param {number} px
 * @param {(i:number, sprite:HTMLCanvasElement) => void} ready
 * @param {{subject?:string, icons?:IconStyle}} opts @returns {() => void} */
export function iconSprites(ids, colorOf, px, ready, opts) {
  let live = true, landed = false;
  const load = () => drawingsFor(opts.subject ?? '', opts.icons === 'flat' ? 'flat' : 'mono').then((icons) => {
    removeEventListener('online', load);
    if (landed) return;   // a retry that was already on its way
    landed = true;
    ids.forEach((id, i) => {
      if (!live) return;
      const img = new Image();
      img.onload = () => {
        if (!live) return;
        const s = document.createElement('canvas');
        s.width = s.height = px;
        s.getContext('2d')?.drawImage(img, 0, 0, px, px);
        ready(i, s);
      };
      img.src = 'data:image/svg+xml,' + encodeURIComponent(iconSvg(icons[id] ?? '', colorOf(i), px));
    });
  }, () => {});
  addEventListener('online', load);
  load();
  return () => { live = false; removeEventListener('online', load); };
}
