// Player preferences other than the look (appearance.js) and least-seen (progress.js):
// one record, validated field by field, stored under one key. Pure: the store is injected,
// and a missing, throwing or garbled one degrades to the defaults, never into the game.
import { defaultStore } from './storage.js';
import { BACKGROUNDS } from './backgrounds.js';

export const SETTINGS_KEY = 'wordfinder-settings-v1';
// The standalone key auto-start was stored under before this record existed.
const LEGACY_AUTO_KEY = 'wordfinder-autonext';

/**
 * @typedef {{art:string, area:'list'|'full', board:'auto'|'compact'|'full',
 *   difficulty:'normal'|'easy'|'hard', letters:'normal'|'large', motion:'system'|'reduce',
 *   sound:boolean, vibrate:boolean, reveal:boolean, autoNext:boolean, play:'random'|'levels'}} Settings
 *   play: the side of New game last chosen. It has no Settings control.
 * @typedef {Pick<Storage,'getItem'|'setItem'>} SettingsStore
 */

/** @type {Readonly<Settings>} */
export const DEFAULTS = Object.freeze({
  art: 'illustrated', area: 'list', board: 'auto', difficulty: 'normal', letters: 'normal', motion: 'system',
  sound: true, vibrate: true, reveal: true, autoNext: true, play: 'random',
});

/** The allowed values of each multiple-choice setting, default first. */
export const CHOICES = Object.freeze({
  art: BACKGROUNDS.map(b => b.id), area: ['list', 'full'], board: ['auto', 'compact', 'full'],
  difficulty: ['normal', 'easy', 'hard'], letters: ['normal', 'large'], motion: ['system', 'reduce'],
  play: ['random', 'levels'],
});
const FLAGS = ['sound', 'vibrate', 'reveal', 'autoNext'];

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
  return out;
}

/** @param {{store?:SettingsStore|null}} [deps] */
export function makeSettings(deps = {}) {
  const store = deps.store === undefined ? defaultStore() : deps.store;
  /** @type {Settings} */
  let data = { ...DEFAULTS };
  try {
    const raw = store ? store.getItem(SETTINGS_KEY) : null;
    if (raw) data = normalizeSettings(JSON.parse(raw));
    else if (store && store.getItem(LEGACY_AUTO_KEY) === 'off') data = { ...data, autoNext: false };
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
      try { if (store) store.setItem(SETTINGS_KEY, JSON.stringify(data)); } catch { /* not remembered */ }
      return { ...data };
    },
  };
}
