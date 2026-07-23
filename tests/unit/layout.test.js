import test from 'node:test';
import assert from 'node:assert/strict';
import { computeLayout } from '../../src/layout.js';

const at = (vw, vh) => computeLayout({ vw, vh, size: 13, pad: 10 });

// Space available inside #app (the caller subtracts #app padding + safe-area insets).
// These are the in-scope device viewports minus a nominal 20px app padding.
const DEVICES = [
  { name: 'iPhone 13 portrait',       vw: 370,  vh: 644 },
  { name: 'iPhone 13 landscape',      vw: 824,  vh: 280 },
  { name: 'iPhone Pro Max portrait',  vw: 410,  vh: 732 },
  { name: 'iPhone Pro Max landscape', vw: 912,  vh: 320 },
  { name: 'iPad Mini portrait',       vw: 724,  vh: 1033 },
  { name: 'iPad Mini landscape',      vw: 1113, vh: 644 },
  { name: 'Desktop',                  vw: 1420, vh: 880 },
];

test('orientation flips on the 1.08 aspect threshold', () => {
  assert.equal(at(370, 644).landscape, false);
  assert.equal(at(824, 280).landscape, true);
});

test('the word list is two columns in both orientations', () => {
  assert.equal(at(370, 644).listColumns, '1fr 1fr');
  assert.equal(at(824, 280).listColumns, '1fr 1fr');
});

test('grid fits within the available space on every in-scope device', () => {
  for (const d of DEVICES) {
    const { landscape, gridSize, sideWidth } = at(d.vw, d.vh);
    // The grid box never exceeds the available height...
    assert.ok(gridSize <= d.vh + 0.5, `${d.name}: grid ${gridSize} > vh ${d.vh}`);
    if (landscape) {
      // ...and in landscape, grid + gap + list fit the width, with a usable rail.
      assert.ok(gridSize + 20 + sideWidth <= d.vw + 0.5, `${d.name}: grid+list ${gridSize + 20 + sideWidth} > vw ${d.vw}`);
      assert.ok(sideWidth >= 160, `${d.name}: list rail ${sideWidth} too narrow`);
    } else {
      // ...in portrait the grid fits the width too (list sits under it).
      assert.ok(gridSize <= d.vw + 0.5, `${d.name}: grid ${gridSize} > vw ${d.vw}`);
    }
  }
});

test('cells stay within [16, 54] and reach 54 on desktop', () => {
  for (const d of DEVICES) {
    const { cell } = at(d.vw, d.vh);
    assert.ok(cell >= 16 && cell <= 54, `${d.name}: cell ${cell}`);
  }
  assert.equal(at(1420, 880).cell, 54);
});

test('non-zero insets shrink the usable space and still fit', () => {
  // Caller passes inset-reduced vw/vh; a notch case must still fit.
  const { gridSize } = at(824 - 88, 280); // 44px inset each side in landscape
  assert.ok(gridSize <= 280 + 0.5);
});
