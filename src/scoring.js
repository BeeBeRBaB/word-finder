// Scores one finished or abandoned level. Pure: no DOM, no storage, no clock.
// Each line is rounded on its own, and the total is exactly the sum of the lines.

/**
 * @typedef {{word:string, at:number, revealed:boolean}} ScoreEvent
 *   at: active ms since the level started. Events arrive in the order they happened.
 * @typedef {'words'|'streak'|'difficulty'|'time'|'reveals'|'complete'|'perfect'} LineKey
 * @typedef {{key:LineKey, label:string, detail:string, points:number}} ScoreLine
 * @typedef {{found:number, revealed:number, elapsedMs:number, parMs:number, bestStreak:number}} ScoreStats
 *   bestStreak: the highest streak multiplier reached, 1 when there was none.
 * @typedef {{lines:ScoreLine[], total:number, complete:boolean, stats:ScoreStats}} Breakdown
 */

export const SCORING = Object.freeze({
  perLetter: 10,
  streakWindowMs: 20000,
  streak: Object.freeze([1, 1.2, 1.5, 2]),
  difficulty: Object.freeze({ easy: 1, normal: 1.5, hard: 2 }),
  parPerWordMs: 20000,
  // elapsed / par: the first row it fits under sets the multiplier; past the last, slowMult.
  time: Object.freeze([
    Object.freeze({ upTo: 0.5, mult: 2 }), Object.freeze({ upTo: 1, mult: 1.5 }),
    Object.freeze({ upTo: 2, mult: 1.2 }), Object.freeze({ upTo: 3, mult: 1 }),
  ]),
  slowMult: 0.8,
  // The k-th reveal costs this share of the word's base; the last entry repeats.
  reveal: Object.freeze([0.5, 0.75, 1]),
  complete: 100,
  perfect: 50,
});

/** Every difficulty, by the name the player sees. @type {Readonly<Record<string, string>>} */
export const DIFFICULTY_NAMES = Object.freeze({ easy: 'Easy', normal: 'Normal', hard: 'Hard' });

/** Negative, NaN and non-numeric times count as 0. @param {unknown} t @returns {number} */
const ms = (t) => (typeof t === 'number' && t > 0 ? t : 0);

/** @param {unknown} w @returns {number} */
const base = (w) => SCORING.perLetter * (typeof w === 'string' ? w.length : 0);

/** @param {number} n @returns {string} */
const words = (n) => `${n} ${n === 1 ? 'word' : 'words'}`;

/** "m:ss", or "h:mm:ss" from an hour up; Infinity reads "--:--". @param {number} t @returns {string} */
export function formatClock(t) {
  if (t === Infinity) return '--:--';
  const s = Math.floor(ms(t) / 1000);
  const h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60;
  /** @param {number} n */
  const two = (n) => String(n).padStart(2, '0');
  return h ? `${h}:${two(m)}:${two(s % 60)}` : `${m}:${two(s % 60)}`;
}

/** @param {{events:ScoreEvent[], elapsedMs:number, difficulty:string, wordCount:number}} level
 * @returns {Breakdown} */
export function scoreLevel({ events, elapsedMs, difficulty, wordCount }) {
  const list = Array.isArray(events) ? events.filter(e => e && typeof e === 'object') : [];
  /** @type {Record<string, number>} */
  const mults = SCORING.difficulty;
  const diff = Object.keys(mults).includes(difficulty) ? difficulty : 'normal';
  const dm = mults[diff];
  const elapsed = ms(elapsedMs);
  const n = Number.isInteger(wordCount) && wordCount > 0 ? wordCount : 0;
  const complete = n > 0 && list.length === n;

  let found = 0, revealed = 0, wordPts = 0, streakPts = 0, revealCost = 0, level = 0, best = 0;
  /** @type {number|null} */
  let lastFind = null;
  for (const e of list) {
    const b = base(e.word);
    if (e.revealed) {
      // A reveal ends the streak: the next find starts a new one, and does not chain from the reveal.
      revealed++;
      revealCost += Math.round(b * SCORING.reveal[Math.min(revealed, SCORING.reveal.length) - 1] * dm);
      lastFind = null;
      continue;
    }
    const at = ms(e.at);
    // Finds at one instant were on the board before the level took it over (levelplay's
    // carry), not found in a run, so they never chain.
    level = lastFind !== null && at > lastFind && at - lastFind <= SCORING.streakWindowMs
      ? Math.min(level + 1, SCORING.streak.length - 1) : 0;
    lastFind = at;
    found++;
    wordPts += b;
    streakPts += Math.round(b * (SCORING.streak[level] - 1));
    best = Math.max(best, level);
  }

  const diffPts = Math.round((wordPts + streakPts) * (dm - 1));
  const parMs = SCORING.parPerWordMs * n;
  const row = SCORING.time.find(r => elapsed / parMs <= r.upTo);
  const speed = row ? row.mult : SCORING.slowMult;
  const timePts = complete ? Math.round((wordPts + streakPts + diffPts) * (speed - 1)) : 0;

  /** @type {ScoreLine[]} */
  const lines = [{ key: 'words', label: 'Words', detail: words(found), points: wordPts }];
  /** @param {LineKey} key @param {string} label @param {string} detail @param {number} points */
  const add = (key, label, detail, points) => { if (points) lines.push({ key, label, detail, points }); };
  add('streak', 'Streak', `best ×${SCORING.streak[best]}`, streakPts);
  add('difficulty', `${DIFFICULTY_NAMES[diff]} ×${dm}`, 'words + streak', diffPts);
  add('time', 'Speed', `${formatClock(elapsed)} · par ${formatClock(parMs)} · ×${speed}`, timePts);
  add('reveals', 'Reveals', words(revealed), -revealCost);
  add('complete', 'Level complete', `all ${words(n)}`, complete && found ? Math.round(SCORING.complete * dm) : 0);
  add('perfect', 'No reveals', 'every word found', complete && !revealed ? Math.round(SCORING.perfect * dm) : 0);

  return {
    lines,
    total: lines.reduce((sum, l) => sum + l.points, 0),
    complete,
    stats: { found, revealed, elapsedMs: elapsed, parMs, bestStreak: SCORING.streak[best] },
  };
}
