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
