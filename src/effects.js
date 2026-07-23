// Confetti and sound. Decoration only — nothing here feeds back into puzzle state.

/**
 * @typedef {import('./puzzle.js').Selection} Selection
 * @typedef {import('./layout.js').LayoutDims} LayoutDims
 */

/**
 * Confetti from the middle of a found selection. The Math.random() calls are
 * deliberate and must NOT be routed through the seeded rng: a reproducible puzzle
 * means a reproducible GRID, not identical confetti.
 * @param {HTMLElement} fxEl @param {Selection} s @param {number} count
 * @param {LayoutDims} dims @param {number} pad
 * @returns {void}
 */
export function burst(fxEl, s, count, dims, pad) {
  if (globalThis.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const cell = dims.cell;
  const cx = pad + ((s.x0 + s.x1) / 2 + 0.5) * cell, cy = pad + ((s.y0 + s.y1) / 2 + 0.5) * cell;
  const colors = ['#4fd1a5','#f0c45a','#78dcff','#ff8c96','#be96ff','#eef6f2'];
  for (let i = 0; i < count; i++) {
    const d = document.createElement('div');
    const sz = 5 + Math.random() * 6;
    d.style.cssText = 'position:absolute;left:' + cx + 'px;top:' + cy + 'px;width:' + sz + 'px;height:' + (sz * (Math.random() < 0.5 ? 1 : 0.45)) + 'px;background:' + colors[i % 6] + ';border-radius:' + (Math.random() < 0.3 ? '50%' : '2px');
    fxEl.appendChild(d);
    const ang = Math.random() * Math.PI * 2, v = 60 + Math.random() * 130;
    const anim = d.animate([
      { transform: 'translate(0,0) rotate(0deg)', opacity: 1 },
      { transform: 'translate(' + (Math.cos(ang) * v) + 'px,' + (Math.sin(ang) * v + 110) + 'px) rotate(' + ((Math.random() - 0.5) * 720) + 'deg)', opacity: 0 },
    ], { duration: 900 + Math.random() * 700, easing: 'cubic-bezier(.15,.6,.4,1)' });
    anim.onfinish = () => d.remove();
  }
}

// The AudioContext is created on first use and reused forever after; browsers cap
// how many a page may open. It lives here because `pop(win)` takes no handle —
// audio is this module's business and nobody else's.
/** @type {AudioContext | null} */
let ac = null;

/** A short arpeggio: two notes for a find, four for the win.
 * @param {boolean} win @returns {void} */
export function pop(win) {
  try {
    // `webkitAudioContext` is the pre-standard Safari global; it isn't part of
    // TypeScript's DOM lib, so the fallback lookup is typed by hand rather than
    // widened to `any`.
    const AudioCtor = window.AudioContext ||
      /** @type {{webkitAudioContext?: typeof AudioContext}} */ (window).webkitAudioContext;
    ac = ac || new AudioCtor();
    // Aliased to a `const` so the narrowing to non-null survives inside the
    // `forEach` closure below — TS re-widens a captured mutable `let` back to its
    // declared (nullable) type inside nested functions.
    const ctx = ac;
    if (ctx.state === 'suspended') ctx.resume();
    const notes = win ? [523, 659, 784, 1047] : [523, 784];
    notes.forEach((f, i) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.value = f; o.type = 'triangle';
      const t = ctx.currentTime + i * (win ? 0.11 : 0.06);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.18, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
      o.connect(g); g.connect(ctx.destination); o.start(t); o.stop(t + 0.4);
    });
  } catch (e) {}
}
