import test from 'node:test';
import assert from 'node:assert/strict';
import { computeLayout, pickPreset, reservePortrait, PRESETS } from '../../src/layout.js';

const at = (vw, vh, count = 12) => computeLayout({ vw, vh, size: 13, pad: 10, count });

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

test('the word list is two content-sized columns in both orientations', () => {
  // Content-sized rather than `1fr 1fr`: fractional tracks split the whole rail, and in
  // landscape the rail is every pixel left over after the grid — so the second column
  // sat far from the first on a wide window and slid on every resize.
  assert.equal(at(370, 644).listColumns, 'max-content max-content');
  assert.equal(at(824, 280).listColumns, 'max-content max-content');
});

test('the list column track never varies with the viewport', () => {
  // The regression this guards is not the literal string above, it is the track being a
  // function of available width at all. One distinct value across wildly different
  // viewports is what keeps the second column from moving as the window resizes.
  const seen = new Set([[390, 800], [900, 600], [1440, 900], [1920, 900], [824, 280]]
    .map(([vw, vh]) => at(vw, vh).listColumns));
  assert.equal(seen.size, 1, `list columns varied with the viewport: ${[...seen].join(' | ')}`);
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

// screen, not viewport. A preset that moved when the window did would rebuild the
// board out from under a desktop player dragging their window narrow, and would make
// "which board am I playing" a question about furniture rather than about the device.
const SCREENS = [
  { name: 'iPhone 13',       w: 390,  h: 844,  want: 'compact' },
  { name: 'iPhone Pro Max',  w: 430,  h: 932,  want: 'compact' },
  { name: 'iPad Mini',       w: 744,  h: 1133, want: 'full' },
  { name: 'Desktop',         w: 1440, h: 900,  want: 'full' },
];

test('pickPreset keys on the device screen, both ways round', () => {
  for (const s of SCREENS) {
    const want = PRESETS[/** @type {'full'|'compact'} */ (s.want)];
    assert.equal(pickPreset({ screenW: s.w, screenH: s.h }), want, `${s.name} portrait`);
    assert.equal(pickPreset({ screenW: s.h, screenH: s.w }), want, `${s.name} landscape`);
  }
});

// iOS Safari reports a device's portrait screen values whichever way it is held;
// Chrome on Android swaps them. min() is what makes both correct, and this is the
// test that fails if someone "simplifies" it to screenW alone.
test('pickPreset is unchanged by rotation', () => {
  assert.equal(pickPreset({ screenW: 390, screenH: 844 }), pickPreset({ screenW: 844, screenH: 390 }));
});

test('the presets are the two shapes the game deals', () => {
  assert.equal(PRESETS.full.size, 13);
  assert.equal(PRESETS.full.count, 12);
  assert.equal(PRESETS.compact.size, 10);
  assert.equal(PRESETS.compact.count, 8);
  for (const p of [PRESETS.full, PRESETS.compact]) {
    assert.equal(p.mix.reduce((n, b) => n + b.take, 0), p.count, 'the mix must add up to count');
    for (const b of p.mix) assert.ok(b.max <= p.size - 1, `${b.max} is too long for ${p.size}x${p.size}`);
  }
});

// Pinned exactly, not approximately. The full preset must be a provable no-op on a
// value that was measured against real devices; every px of drift here is a px the
// portrait grid silently loses.
test('reservePortrait(12) reproduces the measured 366 exactly', () => {
  assert.equal(reservePortrait(12), 366);
});

test('eight words reserve two rows less than twelve', () => {
  assert.equal(reservePortrait(8), 298);
  assert.ok(reservePortrait(8) < reservePortrait(12));
});

test('a shorter list gives the portrait grid its rows back', () => {
  // iPhone 13 portrait, inside #app. 13x13 with 12 words is the cramped board the
  // compact preset exists to replace.
  const big = computeLayout({ vw: 370, vh: 644, size: 13, pad: 10, count: 12 });
  const small = computeLayout({ vw: 370, vh: 644, size: 10, pad: 10, count: 8 });
  assert.equal(big.cell, 19);
  assert.ok(small.cell >= 30, `compact cell is ${small.cell}px, expected 30+`);
});
