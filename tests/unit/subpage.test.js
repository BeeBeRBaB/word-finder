import test from 'node:test';
import assert from 'node:assert/strict';
import { makeSubpage } from '../../src/subpage.js';

/** A stand-in element: just the attributes, focus and click listeners subpage.js uses. */
function el(name) {
  /** @type {Record<string, string>} */ const attrs = {};
  /** @type {(() => void)[]} */ const clicks = [];
  const e = {
    name, hidden: true, scrollTop: 40, dataset: /** @type {Record<string, string>} */ ({}), attrs, checked: /** @type {any} */ (null),
    setAttribute: (/** @type {string} */ k, /** @type {string} */ v) => { attrs[k] = v; },
    addEventListener: (/** @type {string} */ type, /** @type {() => void} */ fn) => { if (type === 'click') clicks.push(fn); },
    click: () => { for (const f of clicks) f(); },
    focus: () => { focused = e; },
    querySelector: () => e.checked,
  };
  return e;
}
/** @type {any} */ let focused = null;

function setup() {
  const card = el('card'), page = el('page'), row = el('row'), back = el('back');
  const sp = makeSubpage(/** @type {any} */ ({ card, page, row, back, name: 'background' }));
  return { card, page, row, back, sp };
}

test('the row opens the page in the card, scrolled to the top, focus on the current choice', () => {
  const { card, page, row, sp } = setup();
  const choice = el('choice');
  page.checked = choice;
  assert.equal(row.attrs['aria-expanded'], 'false');
  row.click();
  assert.equal(card.dataset.page, 'background');
  assert.equal(page.hidden, false);
  assert.equal(card.scrollTop, 0);
  assert.equal(row.attrs['aria-expanded'], 'true');
  assert.equal(focused, choice);
  assert.equal(sp.isOpen(), true);
});

test('with nothing chosen, focus goes to Back', () => {
  const { row, back } = setup();
  row.click();
  assert.equal(focused, back);
});

test('Back returns to the main page and to the row', () => {
  const { card, page, row, back, sp } = setup();
  row.click();
  back.click();
  assert.equal(card.dataset.page, undefined);
  assert.equal(page.hidden, true);
  assert.equal(row.attrs['aria-expanded'], 'false');
  assert.equal(focused, row);
  assert.equal(sp.isOpen(), false);
});

test('closing with the pane leaves focus alone, and closing twice is harmless', () => {
  const { card, row, back, sp } = setup();
  row.click();
  focused = null;
  sp.close(false);
  assert.equal(focused, null);
  assert.equal(card.dataset.page, undefined);
  sp.close();
  assert.equal(focused, null, 'a closed page does not grab focus');
  back.click();
  assert.equal(focused, null);
});

test('another page being open does not count as this one', () => {
  const { card, sp } = setup();
  card.dataset.page = 'theme';
  assert.equal(sp.isOpen(), false);
  sp.close();
  assert.equal(card.dataset.page, 'theme');
});

test('onOpen runs before the page shows, each time it opens', () => {
  const card = el('card'), page = el('page'), row = el('row'), back = el('back');
  /** @type {boolean[]} */ const seen = [];
  makeSubpage(/** @type {any} */ ({ card, page, row, back, name: 'theme', onOpen: () => seen.push(page.hidden) }));
  row.click(); back.click(); row.click();
  assert.deepEqual(seen, [true, true]);
});

test('a re-rendered row is looked up each time and never bound; focus can be picked', () => {
  const card = el('card'), page = el('page'), back = el('back'), field = el('field');
  let row = el('first');
  const sp = makeSubpage(/** @type {any} */ ({ card, page, row: () => row, back, name: 'signin', focus: () => field }));
  assert.equal(row.attrs['aria-expanded'], undefined, 'nothing is set on a row that may be replaced');
  row.click();
  assert.equal(sp.isOpen(), false, 'main.js opens it');
  sp.open();
  assert.equal(focused, field);
  assert.equal(row.attrs['aria-expanded'], 'true');
  row = el('second');   // the section re-rendered while the page was open
  back.click();
  assert.equal(focused, row, 'Back lands on the row as it is now');
  assert.equal(row.attrs['aria-expanded'], 'false');
  // No row at all, and a focus pick that finds nothing: Back takes focus, closing is harmless.
  const sp2 = makeSubpage(/** @type {any} */ ({ card, page, row: () => null, back, name: 'signin', focus: () => null }));
  sp2.open();
  assert.equal(focused, back);
  focused = null;
  sp2.close();
  assert.equal(focused, null);
});
