#!/usr/bin/env node
// Loads every src/subjects/*.js WORDS pool into an in-memory SQLite database (Node's
// built-in node:sqlite -- no dependency, nothing in package.json) so questions about
// overlap and length buckets can be answered with SQL instead of one-off scripts.
// Dev tool only: nothing under src/ imports this, and it ships to GitHub Pages as
// harmless unreferenced dead weight.
//
// Usage:
//   node tools/words-db.mjs                  Print the summary + overlap report.
//   node tools/words-db.mjs "SELECT ..."     Run one query, print the rows as a table.
//
// Example queries:
//   -- Words used as filler across many subjects, longest bucket first (the one that
//   -- is hardest to fill honestly, so most tempting to pad):
//   node tools/words-db.mjs "SELECT word, len, COUNT(DISTINCT subject) n FROM words WHERE len BETWEEN 9 AND 12 GROUP BY word HAVING n > 8 ORDER BY n DESC"
//
//   -- Which subjects share the most words with sports/soccer:
//   node tools/words-db.mjs "SELECT b.subject, COUNT(*) shared FROM words a JOIN words b ON a.word = b.word AND b.subject != 'sports/soccer' WHERE a.subject = 'sports/soccer' GROUP BY b.subject ORDER BY shared DESC LIMIT 10"
//
//   -- How many distinct categories a word spans -- a low number (1-2) with a high
//   -- subject count suggests genuinely shared domain vocabulary (FUR, SUN); a high
//   -- number suggests generic filler (CHAMPIONSHIP, EQUIPMENT):
//   node tools/words-db.mjs "SELECT word, COUNT(DISTINCT subject) subjects, COUNT(DISTINCT category) categories FROM words GROUP BY word HAVING subjects > 5 ORDER BY subjects DESC"
//
//   -- Per-category totals, to spot a category that is thin overall:
//   node tools/words-db.mjs "SELECT category, COUNT(DISTINCT subject) subjects, COUNT(*) words FROM words GROUP BY category ORDER BY subjects DESC"

import { DatabaseSync } from 'node:sqlite';
import { readdirSync } from 'node:fs';

const SUBJECTS_DIR = new URL('../src/subjects/', import.meta.url);

/** One row per word per subject.
 * @typedef {{category:string, subject:string, word:string, len:number}} WordRow */

/** Reads every src/subjects/*.js on disk and flattens their WORDS pools into rows.
 * Categories are written in parallel elsewhere in this repo, so this only sees
 * whatever category files currently exist -- same as tests/unit/content.test.js.
 * @returns {Promise<WordRow[]>} */
async function loadRows() {
  /** @type {WordRow[]} */
  const rows = [];
  const files = readdirSync(SUBJECTS_DIR).filter((f) => f.endsWith('.js'));
  for (const file of files) {
    const category = file.slice(0, -3);
    const mod = await import(new URL(file, SUBJECTS_DIR).href);
    for (const [subject, raw] of Object.entries(mod.WORDS)) {
      for (const word of raw.split(',')) {
        rows.push({ category, subject, word, len: word.length });
      }
    }
  }
  return rows;
}

/** Builds the in-memory words table and loads it.
 * @param {WordRow[]} rows @returns {DatabaseSync} */
function buildDb(rows) {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    CREATE TABLE words (
      category TEXT NOT NULL,
      subject  TEXT NOT NULL,
      word     TEXT NOT NULL,
      len      INTEGER NOT NULL
    );
    CREATE INDEX idx_words_word ON words(word);
    CREATE INDEX idx_words_subject ON words(subject);
    CREATE INDEX idx_words_category ON words(category);
  `);
  const insert = db.prepare('INSERT INTO words (category, subject, word, len) VALUES (?, ?, ?, ?)');
  db.exec('BEGIN');
  for (const r of rows) insert.run(r.category, r.subject, r.word, r.len);
  db.exec('COMMIT');
  return db;
}

/** Prints a plain-text aligned table for an array of row objects. Nothing fancy --
 * this is a debugging affordance, not a UI.
 * @param {Record<string, unknown>[]} rows */
function printTable(rows) {
  if (rows.length === 0) {
    console.log('(no rows)');
    return;
  }
  const cols = Object.keys(rows[0]);
  const widths = cols.map((c) => Math.max(c.length, ...rows.map((r) => String(r[c]).length)));
  const line = (cells) => cells.map((c, i) => String(c).padEnd(widths[i])).join('  ');
  console.log(line(cols));
  console.log(widths.map((w) => '-'.repeat(w)).join('  '));
  for (const r of rows) console.log(line(cols.map((c) => r[c])));
}

/** @param {DatabaseSync} db */
function printSummary(db) {
  const totals = /** @type {{categories:number, subjects:number, slots:number, distinctWords:number}} */ (
    db.prepare(`
      SELECT
        COUNT(DISTINCT category) AS categories,
        COUNT(DISTINCT subject)  AS subjects,
        COUNT(*)                 AS slots,
        COUNT(DISTINCT word)     AS distinctWords
      FROM words
    `).get()
  );
  const shared = /** @type {{sharedSlots:number}} */ (
    db.prepare(`
      SELECT COUNT(*) AS sharedSlots FROM words w
      WHERE (SELECT COUNT(DISTINCT subject) FROM words w2 WHERE w2.word = w.word) > 1
    `).get()
  );
  const pct = totals.slots ? ((shared.sharedSlots / totals.slots) * 100).toFixed(1) : '0.0';

  console.log('Word Finder content DB');
  console.log('='.repeat(23));
  console.log(`Categories on disk : ${totals.categories}`);
  console.log(`Subjects           : ${totals.subjects}`);
  console.log(`Word slots         : ${totals.slots}`);
  console.log(`Distinct words     : ${totals.distinctWords}`);
  console.log(`Slots filled by a word used in >1 subject : ${shared.sharedSlots} (${pct}%)`);
  console.log('');

  console.log('Most-repeated words (top 25 by number of distinct subjects):');
  const top = db.prepare(`
    SELECT word, len, COUNT(DISTINCT subject) AS n, GROUP_CONCAT(DISTINCT category) AS categories
    FROM words
    GROUP BY word
    HAVING n > 1
    ORDER BY n DESC, word ASC
    LIMIT 25
  `).all();
  const subjectsFor = db.prepare('SELECT DISTINCT subject FROM words WHERE word = ? ORDER BY subject');
  printTable(top.map((r) => {
    const subjects = subjectsFor.all(r.word).map((s) => s.subject);
    const shown = subjects.slice(0, 5).join(', ') + (subjects.length > 5 ? `, +${subjects.length - 5} more` : '');
    return { word: r.word, len: r.len, subjects: r.n, categories: r.categories, in: shown };
  }));
}

async function main() {
  const rows = await loadRows();
  const db = buildDb(rows);

  const sql = process.argv[2];
  if (sql) {
    try {
      const result = db.prepare(sql).all();
      printTable(result);
    } catch (err) {
      console.error(`Query failed: ${/** @type {Error} */ (err).message}`);
      process.exitCode = 1;
    }
  } else {
    printSummary(db);
  }

  db.close();
}

main();
