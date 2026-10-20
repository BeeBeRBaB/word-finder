// Player preferences other than the look (appearance.js) and least-seen (progress.js):
// one record, validated field by field, stored under one key. Pure: the store is injected,
// and a missing, throwing or garbled one degrades to the defaults, never into the game.
import { safeStore } from './storage.js';
import { BACKGROUNDS } from './backgrounds.js';
import { makeRng } from './rng.js';

export const SETTINGS_KEY = 'wordfinder-settings-v1';
// The standalone key auto-start was stored under before this record existed.
const LEGACY_AUTO_KEY = 'wordfinder-autonext';

/**
 * @typedef {{bgmode:'theme'|'random'|'manual', art:string, board:'auto'|'compact'|'full',
 *   difficulty:'normal'|'easy'|'hard', letters:'normal'|'large', motion:'system'|'reduce',
 *   sound:boolean, vibrate:boolean, reveal:boolean, autoNext:boolean, play:'random'|'levels',
 *   style:'beads'|'glass'|'tiles'|'random', icons:'mono'|'flat'}} Settings
 *   bgmode: how the background is chosen (backgrounds.js resolveBackground); art is Manual's pick.
 *   icons: the style the icon backgrounds draw in (icon-scene.js IconStyle).
 *   play: the side of New game last chosen. It has no Settings control.
 *   style: how found words and the cards are drawn (STYLES), or Random, which picks one per deal.
 * @typedef {Pick<Storage,'getItem'|'setItem'>} SettingsStore
 */

/** @type {Readonly<Settings>} */
export const DEFAULTS = Object.freeze({
  bgmode: 'theme', art: 'drift', board: 'auto', difficulty: 'normal', letters: 'normal', motion: 'system',
  sound: true, vibrate: true, reveal: true, autoNext: true, play: 'random', style: 'beads', icons: 'mono',
});

/** The allowed values of each multiple-choice setting, default first. */
export const CHOICES = Object.freeze({
  bgmode: ['theme', 'random', 'manual'], art: BACKGROUNDS.map(b => b.id),
  board: ['auto', 'compact', 'full'],
  difficulty: ['normal', 'easy', 'hard'], letters: ['normal', 'large'], motion: ['system', 'reduce'],
  play: ['random', 'levels'], style: ['beads', 'glass', 'tiles', 'random'], icons: ['mono', 'flat'],
});
const FLAGS = ['sound', 'vibrate', 'reveal', 'autoNext'];

/** The styles a board can be drawn in: #app's data-style in styles.css. */
export const STYLES = Object.freeze(['beads', 'glass', 'tiles']);

/** The style a deal shows: the setting, or under Random one picked by the deal's seed, never
 * `previous`, so a new game always changes it. Off by one from the seed so it does not move in step
 * with a Random background, which picks from the same seed.
 * @param {string} setting @param {number} seed @param {string} [previous] @returns {string} */
export function pickStyle(setting, seed, previous = '') {
  if (setting !== 'random') return STYLES.includes(setting) ? setting : STYLES[0];
  const from = STYLES.filter(s => s !== previous);
  return from[makeRng(seed + 1).int(from.length)];
}

/** Keep each field that is valid, default the rest: one bad field never costs the others.
 * @param {unknown} raw @returns {Settings} */
export function normalizeSettings(raw) {
  const out = /** @type {Settings} */ ({ ...DEFAULTS });
  if (!raw || typeof raw !== 'object') return out;
  const r = /** @type {Record<string, unknown>} */ (raw);
  for (const [k, list] of Object.entries(CHOICES)) {
    if (list.some(v => v === r[k])) /** @type {any} */ (out)[k] = r[k];
  }
  for (const k of FLAGS) if (typeof r[k] === 'boolean') /** @type {any} */ (out)[k] = r[k];
  // A record from before the mode keeps a background the player picked as Manual. A pick that is
  // gone, as the still backgrounds are, falls back to the theme's own.
  if (!CHOICES.bgmode.some(v => v === r.bgmode)) out.bgmode = out.art === r.art ? 'manual' : 'theme';
  else if (out.bgmode === 'manual' && out.art !== r.art) out.bgmode = 'theme';
  return out;
}

/** @param {{store?:SettingsStore|null}} [deps] */
export function makeSettings(deps = {}) {
  const kv = safeStore(deps.store);
  /** @type {Settings} */
  let data = { ...DEFAULTS };
  const raw = kv.get(SETTINGS_KEY);
  try {
    if (raw) data = normalizeSettings(JSON.parse(raw));
    else if (kv.get(LEGACY_AUTO_KEY) === 'off') data = { ...data, autoNext: false };
  } catch { data = { ...DEFAULTS }; }

  return {
    /** @returns {Settings} a copy, so a caller cannot change the record behind its back */
    get: () => ({ ...data }),
    /** Set one field; an invalid value is ignored rather than stored.
     * @template {keyof Settings} K @param {K} key @param {Settings[K]} value @returns {Settings} */
    set(key, value) {
      const next = normalizeSettings({ ...data, [key]: value });
      if (next[key] !== value) return { ...data };
      data = next;
      kv.set(SETTINGS_KEY, JSON.stringify(data));
      return { ...data };
    },
  };
}
