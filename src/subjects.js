// Resolving a category or a subject id to its words. The one place that knows word
// pools are fetched rather than merely read, and the boundary where a network
// failure becomes something the picker can act on.

import { findCategory, categoryOf, subjectName } from './catalog.js';

/** @typedef {{id:string, name:string, subjectIds:string[], words:Record<string,string>}} CategoryData */
/** @typedef {{id:string, name:string, category:string, categoryName:string, words:string[]}} Subject */

/**
 * Why the failures are typed: offline with an uncached category and a typo'd
 * `?subject=` / `?category=` are the same rejected promise otherwise, and the
 * picker needs to disable an option for the first while ignoring the second.
 */
export class SubjectLoadError extends Error {
  /** @param {'unknown'|'unavailable'} reason @param {string} id */
  constructor(reason, id) {
    super(`${reason} subject: ${id}`);
    this.name = 'SubjectLoadError';
    this.reason = reason;
    this.id = id;
  }
}

/** The real dynamic import, plus the retry the module map makes necessary. A dynamic
 * import that fails is remembered as failed for the life of the page, so the same
 * specifier keeps rejecting from memory even once the network is back -- measured:
 * offline import rejects, network restored rejects again from cache, the same file
 * with `?retry=1` resolves. Each attempt therefore has to name a URL the page has not
 * already failed on, which is why this counts rather than flags: once `?retry=1` has
 * failed it is poisoned too.
 *
 * All of it lives in here so `fetchWords` keeps one job (ask, memoise on success) and
 * the injected-importer contract stays one argument -- a test double, or any future
 * importer, should not have to accept a counter that means nothing to it.
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

  /** One import per category id, memoised, regardless of whether it was reached via
   * loadCategory or loadSubject. A failed category is not memoised: a player who was
   * offline when they first reached for it can get it on the next try.
   * @param {string} category @param {string} idForError @returns {Promise<Record<string,string>>} */
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
