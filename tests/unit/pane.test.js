import test from 'node:test';
import assert from 'node:assert/strict';
import { makePane } from '../../src/pane.js';

/** @type {any} */ let focused = null;
/** A stand-in element: just the style, attributes, inert flag and focus pane.js uses. */
function el() {
  /** @type {Record<string, string>} */ const attrs = {};
  const e = {
    style: { display: 'none' }, inert: false, attrs,
    setAttribute: (/** @type {string} */ k, /** @type {string} */ v) => { attrs[k] = v; },
    focus: () => { focused = e; },
  };
  return e;
}

test('a pane opens over an inert page, its opener expanded and its heading focused', () => {
  const root = el(), heading = el(), opener = el(), page = el(), toast = el();
  /** @type {boolean[]} */ const closed = [];
  const pane = makePane(/** @type {any} */ ({ root, heading, opener, behind: [page, toast], onClose: () => closed.push(pane.isOpen()) }));
  assert.equal(opener.attrs['aria-expanded'], 'false');
  pane.open();
  assert.equal(pane.isOpen(), true);
  assert.deepEqual([page.inert, toast.inert], [true, true]);
  assert.equal(opener.attrs['aria-expanded'], 'true');
  assert.equal(focused, heading);
  pane.close();
  assert.equal(pane.isOpen(), false);
  assert.deepEqual([page.inert, toast.inert], [false, false]);
  assert.equal(opener.attrs['aria-expanded'], 'false');
  assert.equal(focused, opener);
  assert.deepEqual(closed, [false], 'onClose ran once, after the pane had closed');
});

test('closing a pane that is not open leaves focus and the page alone', () => {
  const root = el(), page = el();
  let closes = 0;
  const pane = makePane(/** @type {any} */ ({ root, heading: el(), opener: el(), behind: [page], onClose: () => closes++ }));
  page.inert = true;   // some other pane's doing
  focused = null;
  pane.close();
  assert.equal(page.inert, true);
  assert.equal(focused, null);
  assert.equal(closes, 0);
});
