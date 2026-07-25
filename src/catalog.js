// Category names only. No words live here, and neither do subject ids or names --
// those are derived rather than listed, which is the whole point of this file: the
// picker never shows a subject name (you choose a category and a subject is drawn
// inside it), so the eagerly-loaded, precached payload needs category names only.
//
// A subject's category is its slug prefix (categoryOf), its display name is its
// slug title-cased (subjectName), and the subjects that exist in a category are
// simply Object.keys() of that category's loaded word module -- see loadCategory
// and loadSubject in src/subjects.js. Pure data and pure string helpers only: no
// DOM, no network, no imports of other src modules.

/** @typedef {{id:string, name:string}} Category */

/** @type {Category[]} */
export const CATEGORIES = [
  { id: 'nature', name: 'Nature' },
  { id: 'food', name: 'Food & Drink' },
  { id: 'sports', name: 'Sports & Games' },
  { id: 'animals', name: 'Animals' },
  { id: 'home', name: 'Home' },
  { id: 'travel', name: 'Travel' },
  { id: 'science', name: 'Science' },
  { id: 'space', name: 'Space' },
  { id: 'music', name: 'Music' },
  { id: 'art', name: 'Art' },
  { id: 'books', name: 'Books & Writing' },
  { id: 'movies', name: 'Movies & TV' },
  { id: 'jobs', name: 'Jobs' },
  { id: 'school', name: 'School' },
  { id: 'body', name: 'The Body' },
  { id: 'health', name: 'Health' },
  { id: 'tech', name: 'Technology' },
  { id: 'vehicles', name: 'Vehicles' },
  { id: 'clothing', name: 'Clothing' },
  { id: 'celebrations', name: 'Celebrations' },
  { id: 'myth', name: 'Myth & Fantasy' },
  { id: 'history', name: 'History' },
  { id: 'places', name: 'Cities & Places' },
  { id: 'feelings', name: 'Feelings' },
  { id: 'garden', name: 'Garden' },
];

/** @param {string} id @returns {Category|null} */
export const findCategory = (id) => CATEGORIES.find(c => c.id === id) ?? null;

/** A subject's category is the slug prefix before the slash: 'nature/birds' -> 'nature'.
 * @param {string} subjectId @returns {string} */
export const categoryOf = (subjectId) => subjectId.split('/')[0];

/** A subject's display name is its slug, title-cased word by word:
 * 'sports/card-games' -> 'Card Games'.
 * @param {string} subjectId @returns {string} */
export const subjectName = (subjectId) => {
  const slug = subjectId.split('/')[1] ?? '';
  return slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
};
