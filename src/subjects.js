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

/**
 * The importer is injected so a unit test can fail one without a network, and so the
 * memoisation can be observed. The default is the real dynamic import — a runtime
 * `import()` with no bundler in sight, which is what keeps the no-build-step rule.
 * @param {(category:string) => Promise<{WORDS:Record<string,string>}>} [importFn]
 * @returns {{loadCategory:(id:string) => Promise<CategoryData>, loadSubject:(id:string) => Promise<Subject>}}
 */
export function makeSubjectLoader(importFn) {
  /** @type {(category:string) => Promise<{WORDS:Record<string,string>}>} */
  const load = importFn ?? ((category) => import(`./subjects/${category}.js`));
  /** @type {Map<string, Record<string,string>>} */
  const cache = new Map();

  /** One import per category id, memoised, regardless of whether it was reached via
   * loadCategory or loadSubject.
   * @param {string} category @param {string} idForError @returns {Promise<Record<string,string>>} */
  async function fetchWords(category, idForError) {
    let words = cache.get(category);
    if (!words) {
      words = await load(category).then(
        (m) => m.WORDS,
        () => { throw new SubjectLoadError('unavailable', idForError); },
      );
      cache.set(category, words);
    }
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
