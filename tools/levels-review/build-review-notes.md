# Levels and accounts: build and review reports (2026-09-27)

The final reports of the workflow that built `src/scoring.js`, `src/levels.js`, `src/cloud.js` and
`src/scorecard.js`, one builder and one adversarial reviewer per module, kept verbatim. The open
questions, integration warnings and "not verified" lists here are not all in `docs/handoff.md`.

Paths under `<scratchpad>/levels/` and `.../scratchpad/levels/` no longer exist. The scripts worth keeping are
in this folder; see its README.

## scoring

### Built

Scoring is finished: `src/scoring.js`, `tests/unit/scoring.test.js` and one new row in the README file table. On the final run the full unit gate passed (234 tests, `scoring.js` at 100% lines, branches and functions) and `tsc --noEmit` was clean. I did not commit, and I touched no other files.

**Exported API**
- `SCORING`: the table exactly as specified. It is deep-frozen, so the nested arrays, rows and the `difficulty` map are frozen too.
- `scoreLevel({events, elapsedMs, difficulty, wordCount}) -> Breakdown`
  - `Breakdown = {lines: ScoreLine[], total, complete, stats: {found, revealed, elapsedMs, parMs, bestStreak}}`
  - `ScoreLine = {key, label, detail, points}`
  - JSDoc typedefs: `ScoreEvent`, `LineKey`, `ScoreLine`, `ScoreStats`, `Breakdown`.
- `formatClock(ms) -> string`: gives `m:ss`, and `h:mm:ss` from 3600 s up. It floors to whole seconds. Negative or NaN shows `0:00`, and `Infinity` shows `--:--`.

Labels are "Words", "Streak", "Easy/Normal/Hard ×m", "Speed", "Reveals", "Level complete" and "No reveals". Details are "5 words" (or "1 word"), "best ×1.5", "words + streak", "1:40 · par 2:00 · ×1.5", "all 6 words" and "every word found".

**Choices the spec left open (you may want to check these)**
1. **Find straight after a reveal:** a reveal sets the streak level to 0 but does not move the "previous find" time. So a find within 20 s of the last find *before* the reveal goes to level 1 (×1.2), not level 0. A test pins this. If you meant a reveal to restart the chain completely, the fix is one line: also clear `lastFind` in the reveal branch.
2. **`stats.bestStreak`** is the best multiplier reached (1, 1.2, 1.5 or 2), matching the "best ×2" detail. It is not the level index.
3. **When a level counts as complete:** `wordCount` must also be a positive integer. Without that, an empty level with `wordCount` 0 counted as complete and earned the "No reveals" bonus.
4. **`elapsedMs` of `Infinity`** is treated as the slowest time (×0.8), which keeps "faster never scores less" true.
5. **Malformed input:** null or non-object events are dropped (and don't count towards completion). A non-string word scores 0. `revealed` is read as truthy or falsy, and `at` is clamped like `elapsedMs`.

**Tests: 17 in `tests/unit/scoring.test.js`**
- **Worked examples:** exact lines and totals for one six-word level on each difficulty (easy 506, normal 759, hard 1011), plus a perfect hard level (1652) where the streak hits its cap.
- **Streak:** the 20 s window is inclusive (20000 ms chains, 20001 ms drops to 0), a gap resets it, and a reveal resets it without counting as a find to chain from.
- **Reveals:** costs step up in order and are multiplied by difficulty, and never exceed the word's value × difficulty.
- **Reveals-only level:** it completes with a negative total and no bonuses.
- **Abandoned level:** no Speed line.
- **Time table:** every row at its boundary and 1 ms past it.
- **Other cases:** an empty level, bad input, and `formatClock` edge cases.
- **Deep freeze:** `SCORING` and everything inside it are frozen.
- **Seeded random checks (`makeRng`):**
  - Over 5000 levels, `total` equals the sum of the lines, all points are integers, lines are in order, and no line except Words is zero.
  - Over 3000 levels, turning any reveal into a find never lowers the total (more than 1000 flips checked).
  - Over 2000 levels, a faster time never scores less, including either side of every table boundary.

**Planted-bug checks**
I planted 26 bugs one at a time in a scratch copy, never in the repo, and all 26 were caught:
- **Streak:** exclusive window; reveal counted as a find; reveal not resetting the level; reveal boosting the level; first find chaining from 0; no cap.
- **Speed:** exclusive table boundary; Speed line on an incomplete level; Speed ignoring the difficulty points; slow multiplier above ×1.
- **Bonuses:** completion bonus with no player find; No reveals bonus despite reveals.
- **Reveals:** cost index off by one; difficulty ignored; reveals adding points.
- **Totals:** difficulty points not rounded; total leaving out the perfect line; total built from unrounded parts; zero lines kept.
- **Bad input:** unknown difficulty falling back to easy; NaN time not clamped; completion without the `wordCount` guard.
- **Clock and table:** hour boundary; missing zero-padding; `Infinity`; table not deep-frozen.

The first version of the random generator missed "reveal boosts the level" in the reveal-to-find test (another test caught it). I changed it so most gaps fall inside the streak window, and after that the reveal-to-find test catches it by itself.

**Not verified:** scoring is not wired into `main.js` yet, and I did not run the Playwright suite, as instructed.

Files are in the repo root:
- src/scoring.js
- tests/unit/scoring.test.js
- README.md

### Review

No logic defects found in `src/scoring.js`: it matched an independent from-the-spec reference on 200,000 seeded random levels with 0 mismatches. The review found three test gaps and one inaccurate doc comment, all fixed. The full gate (`node tools/coverage.mjs && tsc --noEmit`) passes: 259/259 tests, every file at or above the 90% floor (`scoring.js` 100/100/100), tsc clean.

**Exported API** (`src/scoring.js`)
- `SCORING`: frozen constants, exactly as in the spec. The nested arrays and objects are frozen too.
- `scoreLevel({events, elapsedMs, difficulty, wordCount}) -> Breakdown`, with the `ScoreEvent`, `ScoreLine`, `Breakdown` and `ScoreStats` typedefs. `stats.bestStreak` is the multiplier reached (1 when there was no streak).
- `formatClock(ms) -> "m:ss"`, or `"h:mm:ss"` from an hour up. `Infinity` gives `"--:--"`.

**Tests:** `tests/unit/scoring.test.js` still has 17 tests; I added assertions inside existing ones. The hand-worked totals check out by hand: easy 506, normal 759, hard 1011, and the perfect-level case 1652.

**Defects found and fixed**
1. Test gap: nothing checked that the streak window runs from the previous find rather than from the start of the chain. Added four finds 19s apart (45s in total) that must reach ×2.
2. Test gap: event times that are negative or NaN were never checked to clamp to 0. Added two cases that only chain when clamping happens.
3. Test gap: `complete` could have used `>=` instead of `===` unnoticed. Added a level with more events than words, which must not complete and must get no speed line or bonuses.
4. Doc comment: the `formatClock` comment didn't mention that `Infinity` gives `"--:--"`. Fixed.

The README row is present and accurate. There is no DOM, storage or clock access. The comments are short, and `×` and `·` are the real characters.

**Planted bugs** (49, one at a time, in the scratch copy at `.../scratchpad/levels/review-scoring-copy`)
- **Before my tests:** 46 of 49 caught. The three missed were the three gaps above: the window measured from the chain start, event times not clamped, and `complete` using `>=`.
- **After:** 49 of 49 caught.
- **Also caught:** off-by-one errors in the streak window, streak cap and reveal order; reveal costs and both bonuses ignoring difficulty; `<` instead of `<=` on the time table; the speed line on unfinished levels; speed ignoring the difficulty line; unrounded or floor-rounded lines; zero lines kept or `words` dropped; the wrong fallback difficulty; the `in` check letting `toString` through; wrong labels, `x` in place of `×`, line order; three `formatClock` padding and hour-boundary bugs; and the tables not being frozen.
- **Property tests on their own:** I ran just the random tests (sum of lines, finding versus revealing, faster versus slower) against five mutants aimed at them: total from unrounded parts, reveals paying out, slow multiplier above ×1, row 3 above row 2, and slow levels scoring positive. All five were caught, so those tests are doing real work.
- The first version of the "total rounded as a whole" bug turned out to change nothing, so I replaced it with one that does; that one is caught.

**Remaining concerns**
- **Streak after a reveal:** the code follows the spec's steps literally. A reveal sets the level to 0, then the next find within 20s of the previous find goes up to ×1.2. So a reveal straight after the first find of a chain costs no streak. The test pins this reading (the spec's note that a reveal is not a "previous find" only makes sense this way), but the lead should confirm it is the intended rule.
- **Infinite values:** an `elapsedMs` of `Infinity`, or a huge `wordCount`, passes through into `stats` as `Infinity`, which saves as `null` if stored as JSON. This only happens with invalid input; the spec only says to clamp negative and NaN times.
- **Differences from the literal spec, garbage input only:**
  - `complete` counts events after dropping any that are `null` or not objects.
  - `complete` needs `wordCount` to be a positive whole number. Without that, `wordCount 0` with no events would award "No reveals".
  - `scoreLevel(undefined)` throws, because the argument is destructured.
  - Events whose times go backwards still chain.
- **Duplicate type:** `src/scorecard.js` (not my file) declares its own copy of the `Breakdown` type instead of importing it from `scoring.js`. The two match today but could drift apart.
- **Not verified:** the Playwright suite and anything in the browser, per the ground rules.

The scratch scripts are in `<scratchpad>/levels/review-scoring/`:
- `ref.mjs` is the independent reference comparison.
- `probe.mjs` holds the edge-case inputs.
- `mutate.mjs` plants the bugs.

## levels

### Built

The levels module is finished. `src/levels.js` has 100% line, branch and function coverage, and the full unit gate passes: all 234 tests, every file above 90%, and `tsc --noEmit` clean. I also added a row for it to the README file table, next to the rows other agents added. I did not change `sw.js`, `main.js`, `index.html` or anything another agent owns, and I did not commit or run Playwright.

**Exported API** (`src/levels.js`):
- `LEVELS_KEY = 'wordfinder-levels-v1'`
- `HISTORY_MAX = 50`
- Typedefs: `Difficulty`, `LevelResult`, `LevelEvent`, `LevelCurrent`, `LevelProgress`, `LevelStore` (`Pick<Storage,'getItem'|'setItem'|'removeItem'>`)
- `newProgress(seed: number): LevelProgress` — the seed is coerced with `>>> 0`.
- `normalizeProgress(raw: unknown): LevelProgress|null`
  - Returns null unless `v === 1` and `seed` is an integer from 0 to 2^32-1.
  - Level is floored with a minimum of 1 (1 if not a finite number); points are floored with a minimum of 0.
  - Bad history entries are dropped one at a time, keeping the last 50.
  - `current` is all or nothing: one bad event, or a `current.level` other than `level`, drops the whole thing.
  - Always returns a new copy and drops unknown fields.
- `levelSeed(accountSeed: number, level: number): number` — returns a uint32. For a fixed account it can never repeat for levels below 2^32.
- `levelCategory(accountSeed: number, level: number, categoryIds: string[]): string`
  - Ids are sorted first, so their listing order does not matter; they must be distinct.
  - Two categories always use cycle 0's order, because that is the only order with no back-to-back repeat.
- `levelSubject(accountSeed: number, level: number, categoryId: string, subjectIds: string[], categoryCount: number): string` — `categoryCount` must be the length of the list passed to `levelCategory`.
- Throw `RangeError` (both functions): level not an integer of at least 1, an empty id list, or a bad `categoryCount`.
- `recordLevel(progress: LevelProgress, result: LevelResult): LevelProgress`
  - A stale, future, duplicate or malformed result returns the same `progress` object, so a caller can check with `===`.
  - Points are floored and never go below 0.
- `saveCurrent(progress: LevelProgress, current: LevelCurrent): LevelProgress` — a malformed current, or one for another level, returns the same `progress` object.
- `mergeProgress(local: unknown, remote: unknown): LevelProgress|null`
  - Both sides are normalized first, so garbage counts as null. It returns null only when both sides are null, so the return type is `|null`, not the bare `LevelProgress` in the spec.
  - The result is a copy, never one of the inputs.
- `makeLevelStore(deps?: {store?: LevelStore|null}): {load(): LevelProgress|null, save(p: LevelProgress): void, clear(): void}`
  - It never throws.
  - `save` writes nothing if the record fails normalization.
  - `load` reads the store on every call.

**Tests:** 26 tests in `tests/unit/levels.test.js`. They add about 0.2s to the unit run, mostly the 100k-level seed check and the 10k-seed cycle-boundary check.

**Planted-bug checks:** I ran 33 mutations on a scratch copy (`.../scratchpad/levels/levels-copy`, script `.../scratchpad/levels/mutate.mjs`), and the tests caught all 33. Each one was caught by a behaviour test, not only by the pinned-values test:
- **Category order:** removing the cycle-boundary swap, swapping with the last slot, comparing against the wrong cycle, removing the two-category special case, not sorting category or subject ids, and an off-by-one category index.
- **levelSeed:** weak mixing, truncating the level, ignoring the account seed.
- **Subject order:** round or category missing from the subject seed, and `visit` ignoring `categoryCount`.
- **normalize:** keeping a stale current, keeping the oldest history instead of the newest, uncapped history, accepting negative reveals, skipping a bad event instead of dropping the current, accepting any `v`, accepting an oversize seed.
- **recordLevel:** points not floored at 0, accepting a future result, mutating its input, keeping `current`.
- **saveCurrent:** ignoring the level.
- **merge:** a full tie going to local, ignoring seed, points or events, returning the input object.
- **Store:** an unguarded load, saving an invalid record, `clear` doing nothing.

**Not verified, and things you should know:**
- I have not checked `levelCategory`/`levelSubject` against the real `main.js` wiring, because you are doing that integration.
- **Changing content re-deals levels.** Adding a subject to a category changes that category's subject order for future levels on every account. Adding or removing a category changes every future category. An in-progress level is safe because `current.subject` is stored. The pinned-values test uses literal lists on purpose, so content edits do not break it.
- **Adjacent-subject repeat is possible but rare.** Across a round boundary, the same subject can come up on two back-to-back visits to its category (about 1 in 24, once every roughly 600 levels). The spec did not ask to prevent that, so I didn't.
- **Assumption about `cloud.js`.** `normalizeProgress` requires `v: 1`, so the cloud module has to store the record exactly as these functions produce it.

### Review

The review found no logic defects in `src/levels.js`. It found one inaccurate comment, which I fixed, and five places where planted bugs got past the tests, which I closed with new tests. `levels.test.js` now has 28 passing tests (26 before), `levels.js` has 100% line, branch and function coverage, the full unit gate is 259/259, and `tsc --noEmit` is clean. The README row is present and the module touches no DOM or network.

**Exported API (unchanged, matches the spec)**
- `LEVELS_KEY = 'wordfinder-levels-v1'`, `HISTORY_MAX = 50`
- `newProgress(seed) -> LevelProgress`
- `normalizeProgress(raw: unknown) -> LevelProgress|null`
- `levelSeed(accountSeed, level) -> uint32`
- `levelCategory(accountSeed, level, categoryIds) -> string` (throws `RangeError` on a bad level or an empty list)
- `levelSubject(accountSeed, level, categoryId, subjectIds, categoryCount) -> string` (throws `RangeError` on bad arguments)
- `recordLevel(progress, result) -> LevelProgress`
- `saveCurrent(progress, current) -> LevelProgress`
- `mergeProgress(local: unknown, remote: unknown) -> LevelProgress|null`
- `makeLevelStore({store?}) -> {load(): LevelProgress|null, save(p): void, clear(): void}`

**Defects found and fixed**
- **Header comment (`src/levels.js` lines 2–4):** it said the deal depends on "(account seed, n) alone". It also depends on the catalog: adding a category or subject re-deals every account's unplayed levels. The comment now says so.
- **Test gap, re-deals:** the only pinned test used a single account (seed 12345) that never hits the cycle-0 guard. Added `the deal across many accounts is pinned`, a checksum over 200 accounts' first 30 levels (category, subject and `levelSeed`).
- **Test gap, zero values:** nothing checked that 0 is a valid time. Added a test that a level saved the moment it starts (`elapsedMs: 0`, event `at: 0`) is kept, and a result with `ms: 0, at: 0` is banked.
- **Test gap, seed 0:** nothing checked that seed 0 is accepted. Added `normalizeProgress(newProgress(0))` round-tripping.
- **Test gap, arrays:** nothing checked that arrays are rejected as records. Added array-shaped cases for the progress record, a history entry and `current`.

**Planted bugs (91, run in the scratch copy against `levels.test.js`)**
- **Round 1 (73 bugs):** 70 were caught before my tests and 72 after. Among those caught before: no swap, swap against the same cycle, swap with the last slot, unsorted ids, one shuffle for every cycle, the two-category special case removed, and all the `levelSubject` seed and visit variants. So were the `levelSeed` changes (account ignored, 16-bit level, unmixed), all the `recordLevel`, `saveCurrent`, `normalize` and `merge` rule changes, and every store guard. The one still missed was my own mistake: that edit didn't change behaviour.
- **Round 2 (17 bugs):** 13 caught before and 16 after. The three my tests now catch are: 0 rejected as a time, seed 0 rejected, and an array accepted as `current`. Still missed: `save` writing the raw record instead of the cleaned copy. `load` cleans it either way, so no caller can see the difference.
- **Newly caught by my tests:** dropping the cycle-0 guard (caught by the checksum) and arrays accepted as records.
- **Still missed, both harmless:** with exactly two categories, using cycle 1's order instead of cycle 0's. The result is still correct and the real catalog has 25 categories.

**Other checks (throwaway scripts, all passed)**
- No back-to-back category for list sizes 1 to 30, 300 seeds and 8 cycles each.
- Categories and subjects come out evenly spread across seeds.
- Adjacent levels' seeds differ in 16.0 bits on average.
- 200k random inputs through normalize, merge, `recordLevel` and `saveCurrent`: nothing threw, every output was well-formed, and normalizing twice gives the same result.

**Remaining concerns (not fixed, because the spec doesn't require it)**
- **Resume could deal the wrong subject:** because the deal depends on the catalog, a device still on an older service-worker build can deal a different subject for the same level. `main.js` should resume from `current.subject`, not recompute it. It must also pass `levelSubject` the same count as the list given to `levelCategory`.
- **A bad result is dropped silently:** `recordLevel` returns `progress` unchanged for a malformed result (for example a `NaN` score or a non-integer `reveals`), so the player would be stuck on that level. The lead should check `next === progress`.
- **Huge levels can get stuck:** normalize accepts any integer level or points, including values like 1e300 from a corrupt cloud record. The level would then stop advancing and the points could reach Infinity, which is saved as 0. Firestore rules should cap both, or normalize could cap them at `Number.MAX_SAFE_INTEGER`.
- **`levelSeed` doesn't validate the level,** while the other two dealing functions throw. A level of 1.5 gets level 1's seed; `NaN` gets level 0's.
- **A subject can repeat back to back** across a round boundary, 25 levels apart, about once every 600 levels. The spec allows this; categories get a swap to prevent it but subjects don't.
- **Test speed:** the `levelSeed` collision test takes about 0.55s under coverage, but `content.test.js` is still the slowest file in the hook.
- **Not verified:** integration with `main.js` (not wired yet) and Playwright (not run, per the ground rules).

Files are in the repo root:
- src/levels.js
- tests/unit/levels.test.js

## cloud

### Built

I built the cloud module and its 25 unit tests, and all 25 pass. The full unit gate passes too: 234 tests, every file at or above 90%, and `src/cloud.js` at 100% lines, branches and functions. `tsc --noEmit` is clean. Nothing was committed, and I edited no file owned by another agent.

**Files**
- `src/cloud.js`
- `tests/unit/cloud.test.js`
- `firestore.rules`
- `README.md`: a row for `src/cloud.js`, a row for `firestore.rules` in the root file table, and a new `## Accounts (Firebase)` section at the end.

**Exported API**
- `FIREBASE`: `Object.freeze({ apiKey: '', projectId: '' })`
- `SESSION_KEY`: `'wordfinder-session-v1'`
- `EMAIL_DOMAIN`: `'users.word-finder.invalid'`
- `normalizeUsername(s: unknown): string|null`
- `class CloudError extends Error { constructor(code: CloudCode, message?: string); code: CloudCode }`. `name` is `'CloudError'`, and each code has a default player-facing sentence.
- `makeCloud(deps?: {config?, fetch?, store?, now?})` returns:
  - `enabled: boolean`
  - `session(): {uid, username}|null`
  - `signUp(username, password): Promise<{uid, username}>`
  - `signIn(username, password): Promise<{uid, username}>`
  - `signOut(): void`
  - `load(): Promise<unknown|null>`
  - `save(data): Promise<void>`

The default dependencies are `FIREBASE`, a wrapper that calls `globalThis.fetch` (so the browser does not throw "Illegal invocation"), `defaultStore()` and `Date.now`. A store of `null` means the session is not kept between visits.

**Checked against the docs (context7)**
All the request and response shapes in the brief match the docs: sign-up, sign-in, the form-encoded refresh, `{error:{code,message}}`, the Firestore PATCH that creates or replaces, and the `Bearer` ID token. The docs add two things the brief left out:
- `OPERATION_NOT_ALLOWED` means Email/Password sign-in is not enabled. I mapped it to `'unconfigured'`.
- `MISSING_PASSWORD` exists. I mapped it to `'credentials'`.

**Choices the brief left open**
- **Disabled accounts at sign-in:** `USER_DISABLED` returns `'credentials'`. During a token refresh it returns `'expired'` and clears the session, as the brief asks.
- **Signed out:** `load` and `save` with no session throw `'expired'` without making a request. `session()` returns `null` while accounts are disabled.
- **Sign-in checks:** `signIn` checks the username the same way `signUp` does (`'invalid'`). An empty password gives `'credentials'` without a request.
- **Firestore errors:** a 429 gives `'throttled'`. A 401 or 403 that is still there after one refresh and one retry gives `'server'`, and so does any other failure.
- **Unreadable cloud data:** `load` returns `null` when the document exists but its `data` field is missing or is not valid JSON.
- **Save size limit:** `save` refuses anything the rules would refuse, before sending a request. That is JSON of 200,000 characters or more, or data that cannot be turned into JSON. It throws `'invalid'` with its own message.
- **Concurrent refreshes:** calls that need a new token at the same moment share one refresh request.
- **Sign-out during a refresh:** a refresh only updates or clears the session it started for, compared by uid. If the player signed out, or someone else signed in, in the meantime, that refresh can neither bring the old session back nor clear the new one.

**Planted-bug checks**
I ran 26 mutations in a scratch copy (`.../scratchpad/levels/cloud-copy`), and the tests caught all 26. The copy was restored afterwards.
- **Password:** put in the sign-in URL; stored in the session.
- **Refresh timing:** margin removed; margin off by one; retry twice; no retry on 403; no shared refresh.
- **Session ending:** an expired refresh keeps the session; `USER_NOT_FOUND` not treated as expired; a refresh saves the session after sign-out; an expired refresh clears a newer session; the "same session" check ignores the uid.
- **Error mapping:** `EMAIL_EXISTS` mapped to credentials; the code not split at " : "; 404 not returned as null; 429 not throttled; a failed PATCH treated as success; a rejected fetch not reported as offline.
- **Requests:** refresh body sent as JSON; uid not encoded in the URL; a non-integer `level` copied; the 200,000-character limit removed; the weak-password check skipped; accounts enabled with only one config field.
- **Stored session:** an un-normalized username accepted; a garbled session left in the store.

**Not verified**
- **Email domain:** whether Firebase accepts the `.invalid` domain. If it does not, every sign-up would fail with `INVALID_EMAIL`, which currently shows as `'server'`. The code comment and the README say this.
- **Rules:** `firestore.rules` has never been compiled or run. That needs the Firebase emulator (firebase-tools and Java), which would be a new dependency.
- **Live API:** no request has been made to the real Firebase APIs. This includes the refresh sequence and the API-key referrer restriction described in the README.
- **Playwright:** I did not run the Playwright suite, as instructed.

### Review

Five real defects are fixed in `src/cloud.js` and `tests/unit/cloud.test.js`. One serious integration bug remains in `sw.js`, which I'm not allowed to edit: it caches every Firestore read forever, so `load()` always returns the first copy of a player's data that device ever fetched. The rest of the module matches the spec line by line. The cloud tests pass (26), `node tools/coverage.mjs` passes 259/259 with `cloud.js` at 100/100/100, and `tsc --noEmit` is clean. Nothing was committed and Playwright was not run.

**Exported API (unchanged):**
- `FIREBASE` (frozen `{apiKey, projectId}`), `SESSION_KEY`, `EMAIL_DOMAIN`
- `normalizeUsername(s: unknown): string|null`
- `class CloudError extends Error { code: CloudCode }`
- `makeCloud({config?, fetch?, store?, now?})` returns `{ enabled, session(), signUp(u, p), signIn(u, p), signOut(), load(), save(data) }`

The Firebase docs (via context7) confirm the spec's request and response shapes. The token refresh also returns `token_type` and `project_id`, which the code doesn't need. Firestore rules count string size in characters, so the client's JavaScript length check is at least as strict as the rules.

**Defects found and fixed:**
1. **The config test would have blocked the owner's deploy.** It asserted `FIREBASE` is empty, so step 7 of the README (paste the two values and push) would have failed the hook and `npm test`. It now checks an explicit empty config and that the default config is `FIREBASE`. I confirmed it passes with `FIREBASE` filled in.
2. **A token refresh could be handed to the wrong account.** After signing out and in as someone else, a refresh still in flight for the first player was shared with the second. My probe showed Bob's document retried with Alice's token (`Bearer a2`). Refreshes are now shared only within one account, and an old refresh finishing can't cancel a newer one.
3. **`load()` returned `null` for a 200 whose body couldn't be read**, such as a connection dropped mid-body or a captive portal page. `null` means "no cloud copy yet", which invites the caller to save local progress over a good cloud copy. It now throws `'server'`. A document that exists but has missing or garbled `data` still returns `null`.
4. **Six gaps where a planted bug passed every test.** I added tests for:
   - the safe-integer limit on `level` and `points`
   - the exact 200000-character size limit
   - `expiresIn` of `'0'` or a negative number being treated as an hour
   - the retried PATCH resending the same body
   - `'unconfigured'` winning over a save the client would refuse
   - the account-switch refresh case from item 2
5. **The account-switch test could hang the suite.** Under the item-2 bug my first version deadlocked, and `node --test` has no timeout, so it would have stalled the hook. It now fails instead.

I also corrected the `save` comment from "integers" to "safe integers". `firestore.rules`, the README row and the Accounts section check out against the spec and are unchanged.

**Planted bugs (scratch copy only):** 39 at first; 33 were caught and 6 survived (the gaps in item 4). After my changes all 43 are caught, including the 3 re-introducing the defects I fixed and one pointing the default config somewhere other than `FIREBASE`. They cover each error mapping, the one-minute refresh margin, 401/403 refresh-and-retry-once, clearing the session on an expired refresh, the password in a URL, URL encoding, garbled stored sessions, sign-out racing a refresh, and the size limit.

**Remaining concerns:**
- **`sw.js` caches Firestore reads (checked in Chromium, not reasoned about).** Its fetch handler treats any cross-origin GET like an icon: it caches the first response and serves it until the next `CACHE` bump, ignoring the `Authorization` header. In my probe, three GETs with different tokens reached the server once and all got the first reply, stored in `wordfinder-v14`. Adding the one line below made every GET reach the network with nothing cached. It needs a `CACHE` bump and, per CLAUDE.md, the cascade-and-cache-reviewer.
  ```js
  if(e.request.method!=='GET'||e.request.headers.has('Authorization'))return;
  ```
- **Not verified without a live project:** the rules' syntax (no emulator without adding a dependency), whether Firebase accepts the `.invalid` email domain, and whether Firestore's own caching headers could matter.
- **A read started before sign-out still returns its data.** The existing tests expect this, so the lead's code should ignore a `load()` that resolves after sign-out.
- **An owner-enabled password policy would show "Something went wrong".** Its error (`PASSWORD_DOES_NOT_MEET_REQUIREMENTS`) maps to `'server'` because the `'weak'` message only mentions 6 characters.

Scratch files are in `<scratchpad>/levels/review-cloud/`: the planted-bug runner (`mutate.mjs`, `mutations.json`, results in `mutations.clean.txt`), `probe-refresh.mjs`, and `sw-probe.mjs`.

## scorecard

### Built

Only the opening of the builder's report survived (the pipeline dropped the module's result when its review failed):

> The score card is built and checked in Chromium. The full unit gate still exits 1, but only because of `src/backgrounds.js` (functions at 85.71%, under the 90% floor), which belongs to the backgrounds workflow. All 267 unit tests pass, `tsc --noEmit` is clean, and `src/scorecard.js` is at 100% lines, 99.01% branches, 100% functions. I didn't commit, push or run the Playwright suite. The port 5191 …

### Review

Never completed. The reviewer stalled on all six attempts:

- [stall] agent "review:scorecard" stalled (no progress) after 4125s — retrying (1/5)
- [stall] agent "review:scorecard" stalled (no progress) after 987s — retrying (2/5)
- [stall] agent "review:scorecard" stalled (no progress) after 1035s — retrying (3/5)
- [stall] agent "review:scorecard" stalled (no progress) after 907s — retrying (4/5)
- [stall] agent "review:scorecard" stalled (no progress) after 908s — retrying (5/5)
- pipeline[3] failed: agent stalled on all 6 attempts (no progress for 180000ms each)
