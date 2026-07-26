// Resolves a category or subject id to its words. The only place that knows pools are
// fetched rather than read, and where a network failure becomes actionable.

import { findCategory, categoryOf, subjectName } from './catalog.js';

/** @typedef {{id:string, name:string, subjectIds:string[], words:Record<string,string>}} CategoryData */
/** @typedef {{id:string, name:string, category:string, categoryName:string, words:string[]}} Subject */

/** Typed so the header can say "Offline" for a fetch failure and "Unavailable" for an
 * id that is not in the catalog — otherwise both are one rejected promise. */
export class SubjectLoadError extends Error {
  /** @param {'unknown'|'unavailable'} reason @param {string} id */
  constructor(reason, id) {
    super(`${reason} subject: ${id}`);
    this.name = 'SubjectLoadError';
    this.reason = reason;
    this.id = id;
  }
}

/** The real import, plus a retry. A failed dynamic import is remembered as failed for
 * the life of the page, so a retry must name a URL the page has not already failed on
 * — hence a counter, not a flag: `?retry=1` is poisoned once it fails too. Kept in here
 * so the injected-importer contract stays one argument.
 * @returns {(category:string) => Promise<{WORDS:Record<string,string>}>} */
function realImport() {
  /** @type {Map<string, number>} */
  const failures = new Map();
  return (category) => {
    const n = failures.get(category) ?? 0;
    return import(n === 0 ? `./subjects/${category}.js` : `./subjects/${category}.js?retry=${n}`)
      .catch((err) => { failures.set(category, n + 1); throw err; });
  };
}

/**
 * The importer is injected so a unit test can fail one without a network, and so the
 * memoisation can be observed. The default is the real dynamic import — a runtime
 * `import()` with no bundler in sight, which is what keeps the no-build-step rule.
 * @param {(category:string) => Promise<{WORDS:Record<string,string>}>} [importFn]
 * @returns {{loadCategory:(id:string) => Promise<CategoryData>, loadSubject:(id:string) => Promise<Subject>}}
 */
export function makeSubjectLoader(importFn) {
  const load = importFn ?? realImport();
  /** @type {Map<string, Record<string,string>>} */
  const cache = new Map();

  /** One import per category, memoised. Failures are not cached, so a player who was
   * offline can retry. @param {string} category @param {string} idForError
   * @returns {Promise<Record<string,string>>} */
  async function fetchWords(category, idForError) {
    const cached = cache.get(category);
    if (cached) return cached;
    const words = await load(category).then(
      (m) => m.WORDS,
      () => { throw new SubjectLoadError('unavailable', idForError); },
    );
    cache.set(category, words);
    return words;
  }

  /** @type {(id:string) => Promise<CategoryData>} */
  async function loadCategory(id) {
    const meta = findCategory(id);
    if (!meta) throw new SubjectLoadError('unknown', id);
    const words = await fetchWords(meta.id, id);
    return { id: meta.id, name: meta.name, subjectIds: Object.keys(words), words };
  }

  /** @type {(id:string) => Promise<Subject>} */
  async function loadSubject(id) {
    const meta = findCategory(categoryOf(id));
    if (!meta) throw new SubjectLoadError('unknown', id);
    const words = await fetchWords(meta.id, id);
    const raw = words[id];
    // The module not having this key is a content bug that content.test.js catches
    // before it ships; treat it as unknown rather than crashing the boot.
    if (!raw) throw new SubjectLoadError('unknown', id);
    return { id, name: subjectName(id), category: meta.id, categoryName: meta.name, words: raw.split(',') };
  }

  return { loadCategory, loadSubject };
}

export const { loadCategory, loadSubject } = makeSubjectLoader();
