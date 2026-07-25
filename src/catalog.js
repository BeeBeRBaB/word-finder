// Category and subject NAMES. No words live here — that is the point of the file.
// It loads on every visit and is precached in the service worker shell, so it must
// stay small enough that the cost of having 600 subjects is a list of names rather
// than the corpus behind them.

/**
 * @typedef {{id:string, name:string}} SubjectRef
 * @typedef {{id:string, name:string, subjects:SubjectRef[]}} Category
 * @typedef {{id:string, name:string, category:string, categoryName:string}} SubjectMeta
 */

/** @type {Category[]} */
export const CATEGORIES = [
  {
    id: 'nature', name: 'Nature', subjects: [
      { id: 'nature/birds', name: 'Birds' },
    ],
  },
];

/** Every subject in the catalog, flattened, each carrying its category down with it.
 * Built once at module load rather than re-derived per call: the picker, the URL
 * resolver and the loader all want this list, and it is a few hundred small objects.
 * @type {SubjectMeta[]} */
export const SUBJECTS = CATEGORIES.flatMap(c =>
  c.subjects.map(s => ({ id: s.id, name: s.name, category: c.id, categoryName: c.name })));

/** @param {string} id @returns {SubjectMeta|null} */
export const findSubject = (id) => SUBJECTS.find(s => s.id === id) ?? null;
/** @param {string} id @returns {Category|null} */
export const findCategory = (id) => CATEGORIES.find(c => c.id === id) ?? null;
