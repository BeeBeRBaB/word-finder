// Resolving a subject id to its words. The one place that knows word pools are
// fetched rather than merely read, and the boundary where a network failure becomes
// something the picker can act on.

import { findSubject } from './catalog.js';

/** @typedef {import('./catalog.js').SubjectMeta} SubjectMeta */
/** @typedef {SubjectMeta & {words:string[]}} Subject */

/**
 * Why the failures are typed: offline with an uncached category and a typo'd
 * `?subject=` are the same rejected promise otherwise, and the picker needs to
 * disable an option for the first while ignoring the second.
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
 * @returns {(id:string) => Promise<Subject>}
 */
export function makeSubjectLoader(importFn) {
  /** @type {(category:string) => Promise<{WORDS:Record<string,string>}>} */
  const load = importFn ?? ((category) => import(`./subjects/${category}.js`));
  /** @type {Map<string, Record<string,string>>} */
  const cache = new Map();
  return async function loadSubject(id) {
    const meta = findSubject(id);
    if (!meta) throw new SubjectLoadError('unknown', id);
    let words = cache.get(meta.category);
    if (!words) {
      words = await load(meta.category).then(
        (m) => m.WORDS,
        () => { throw new SubjectLoadError('unavailable', id); },
      );
      cache.set(meta.category, words);
    }
    const raw = words[id];
    // The catalog and the module disagreeing is a content bug that content.test.js
    // catches before it ships; treat it as unknown rather than crashing the boot.
    if (!raw) throw new SubjectLoadError('unknown', id);
    return { ...meta, words: raw.split(',') };
  };
}

export const loadSubject = makeSubjectLoader();
