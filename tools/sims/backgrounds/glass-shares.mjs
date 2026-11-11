// Turns glass.mjs runs into src/glass-shares.js: for each background in each flavour, the share of
// the surface its board, its words and the list's count row need, at worst over every look, shape,
// style, frame and subject in the runs, plus MARGIN, in steps of 5. styles.css takes the lesser of
// that and the look's own share, so a background is never short of what the look already proves.
//   node tools/sims/backgrounds/glass-shares.mjs phone.jsonl landscape.jsonl desktop.jsonl ...
// Each background has to appear in some run, in both flavours, or nothing is written. Subject motion
// has no row: it runs another background, whose glass main.js gives it once that has started.
// The backgrounds that draw the subject's icons (perDeal) need very different glass from one subject
// to the next (Bloom's count row needed 0% for one and 65% for another), and a run samples a few of
// the 600, so they share one row: the worst over all of them and every subject, plus ICON_MARGIN.
import fs from 'node:fs';
import { BACKGROUNDS } from '../../../src/backgrounds.js';

const MARGIN = 5, ICON_MARGIN = 10;
const GROUP = { cell: 0, 'cell found': 0, '.w': 1, '.w.done': 1, '#count': 2, '#reveal': 2 };
const files = process.argv.slice(2);
if (!files.length) { console.error('usage: glass-shares.mjs <runs.jsonl>...'); process.exit(2); }

/** id -> pref -> [board, list, band] needs, 0-2 @type {Record<string, Record<string, number[]>>} */
const need = {};
let rows = 0;
for (const f of files) for (const line of fs.readFileSync(f, 'utf8').split('\n')) {
  if (!line.trim()) continue;
  const r = JSON.parse(line);
  rows++;
  for (const [look, roles] of Object.entries(r.res)) {
    const pref = look.split('/')[1];
    const n = ((need[r.id] ??= {})[pref] ??= [0, 0, 0]);
    for (const [role, m] of Object.entries(roles)) {
      const g = GROUP[/** @type {keyof typeof GROUP} */ (role)];
      if (g !== undefined) n[g] = Math.max(n[g], m);
    }
  }
}
const IDS = BACKGROUNDS.map(b => b.id).filter(id => id !== 'motion');
const missing = IDS.filter(id => !need[id]?.dark || !need[id]?.light);
if (missing.length) { console.error(`no runs cover ${missing.join(', ')}`); process.exit(1); }

const ICONS = new Set(BACKGROUNDS.filter(b => b.perDeal).map(b => b.id));
/** @type {Record<string, number[]>} */
const icons = { dark: [0, 0, 0], light: [0, 0, 0] };
for (const id of IDS) if (ICONS.has(id)) for (const p of ['dark', 'light']) need[id][p].forEach((m, i) => { icons[p][i] = Math.max(icons[p][i], m); });
const pct = (/** @type {number} */ m, margin = MARGIN) => Math.min(100, Math.ceil((m * 100 - 1e-6) / 5) * 5 + margin);
/** @param {string} id @param {string} p */
const row = (id, p) => (ICONS.has(id) ? icons[p].map(m => pct(m, ICON_MARGIN)) : need[id][p].map(m => pct(m)));
const body = IDS.map((id) => {
  const [d, l] = ['dark', 'light'].map(p => `[${row(id, p).join(', ')}]`);
  return `  '${id}': { dark: ${d}, light: ${l} },`;
}).join('\n');

const out = `// Each background's own glass in each flavour: the share of the surface, in percent, that its
// board, its words and the list's count row need under them for AA, ${MARGIN} over the worst that
// tools/sims/backgrounds/glass.mjs measured across every look, shape, style, frame and subject.
// styles.css takes the lesser of this and the look's own share (--glass-board, --glass-list, the
// count row's 90%), so over a calm background the words sit on next to nothing. The backgrounds that
// draw the subject's icons share one row, ${ICON_MARGIN} over the worst of them, since their icons
// change with every subject. Subject motion has no row of its own: main.js gives it the row of the
// background it runs.
// Written by tools/sims/backgrounds/glass-shares.mjs from ${rows} runs: re-run it, don't edit by hand.

/** @type {Readonly<Record<string, {dark: readonly number[], light: readonly number[]}>>} */
export const GLASS_SHARES = Object.freeze({
${body}
});

/**
 * The custom properties styles.css reads for a background in a flavour, as [name, value] pairs.
 * The values are empty, which removes them, for a background with no shares of its own.
 * @param {string} id @param {string} pref 'dark' or 'light' @returns {[string, string][]}
 */
export function glassVars(id, pref) {
  const s = GLASS_SHARES[id]?.[pref === 'light' ? 'light' : 'dark'];
  return ['--clear-board', '--clear-list', '--clear-band'].map((k, i) => [k, s ? \`\${s[i]}%\` : '']);
}
`;
fs.writeFileSync(new URL('../../../src/glass-shares.js', import.meta.url), out);
const all = IDS.flatMap((id) => ['dark', 'light'].map(p => row(id, p)));
const clear = all.filter(s => s[1] <= MARGIN).length;
console.log(`src/glass-shares.js: ${IDS.length} backgrounds from ${rows} runs; the words sit on ${MARGIN}% or less in ${clear} of ${all.length} background-flavours; the icon backgrounds' row is dark [${row([...ICONS][0], 'dark')}], light [${row([...ICONS][0], 'light')}]`);
