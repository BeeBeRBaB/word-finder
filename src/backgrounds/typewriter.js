// Typewriter: lines of text typed a key at a time in a typewriter face, a caret softly pulsing
// where the next letter lands; at each line's end the paper rolls up a line. The seed picks the
// variant: one page across the whole host, a few tilted sheets each typed at its own pace, or a
// carriage that carries the page left under a fixed type guide and glides back at each return.

import { stage, TAU, clamp } from './stage.js';

/** @typedef {{text:string, c:number, cv:HTMLCanvasElement}} Line  a finished line, prerendered */
/** @typedef {{x:number, y:number, w:number, h:number, rot:number, cols:number, lines:Line[],
 *   text:string, c:number, typed:number, wait:number, roll:number, back:number, para:number,
 *   words:string[], struck:number[]}} Sheet
 * A sheet of paper: its box in the host (turned by rot about its centre), its finished lines,
 * the line being typed and how much of it is; roll runs 0..1 as the paper rolls up a line, back
 * 1..0 as the carriage returns; para counts lines left in the paragraph; words are queued text;
 * struck holds when each typed letter of the line landed. */

const WORDS = ('the a of and to in is it on as at by we our you all one day light word page letter '
  + 'ink paper ribbon key line story river stone garden quiet morning evening rain window lamp '
  + 'small bright old new long slow soft warm cold green blue golden silver little open far near '
  + 'walk read write find hide seek wait turn hold keep bring carry follow remember wonder '
  + 'house road field forest island harbour village mountain valley meadow orchard library '
  + 'clock bell candle letterbox kettle teacup chair desk shelf drawer notebook pencil '
  + 'while under over between before after along across beyond around through into').split(' ');
const ROLL = 0.5;    // seconds the paper takes to roll up a line
const BACK = 1.3;    // the carriage's glide back

/** @param {HTMLElement} host @param {import('./stage.js').StageOptions} opts @returns {() => void} */
export function start(host, opts) {
  return stage(host, opts, (s) => {
    const { rng, layout } = s;
    /** @type {Sheet[]} */
    let sheets = [];
    let fs = 18, cw = 11, lh = 30;
    const font = () => `400 ${Math.round(fs)}px 'Space Mono',ui-monospace,Menlo,monospace`;
    const INK = s.dark ? 0.46 : 0.54;

    /** Queues a sentence of words, the first capitalised, now and then a comma, a full stop.
     * @param {Sheet} sh @returns {void} */
    function sentence(sh) {
      const n = 5 + rng.int(9);
      for (let k = 0; k < n; k++) {
        let w = WORDS[rng.int(WORDS.length)];
        if (k === 0) w = w[0].toUpperCase() + w.slice(1);
        if (k === n - 1) w += '.'; else if (k > 1 && rng.random() < 0.12) w += ',';
        sh.words.push(w);
      }
    }

    /** The next line's text: words up to the sheet's width, indented to start a paragraph.
     * @param {Sheet} sh @returns {string} */
    function nextLine(sh) {
      if (sh.para <= 0) { sh.para = 3 + rng.int(4); sh.c = (sh.c + 1) % s.colors.length; return ''; }
      let line = '';
      if (!sh.lines.length || sh.lines[sh.lines.length - 1].text === '') line = '    ';
      for (;;) {
        if (!sh.words.length) sentence(sh);
        const w = sh.words[0];
        const add = (line.trim() ? ' ' : '') + w;
        if (line.length + add.length > sh.cols) break;
        line += add; sh.words.shift();
      }
      sh.para--;
      return line;
    }

    /** Renders a finished line once, each letter with a little of a typewriter's unevenness.
     * @param {Line} ln @returns {void} */
    function render(ln) {
      const cv = ln.cv, w = Math.max(1, Math.ceil((ln.text.length * cw + 4) * s.dpr)), h = Math.ceil(lh * s.dpr);
      if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
      const g = cv.getContext('2d');
      if (!g) return;
      g.setTransform(s.dpr, 0, 0, s.dpr, 0, 0);
      g.clearRect(0, 0, w, h);
      g.font = font(); g.textBaseline = 'alphabetic'; g.fillStyle = s.colors[ln.c];
      for (let i = 0; i < ln.text.length; i++) {
        if (ln.text[i] === ' ') continue;
        g.globalAlpha = 0.78 + rng.random() * 0.22;
        g.fillText(ln.text[i], 2 + i * cw, lh * 0.68 + (rng.random() - 0.5) * 1.1);
      }
    }

    /** Ends the line being typed and starts the next. @param {Sheet} sh @returns {void} */
    function carriageReturn(sh) {
      const keep = Math.ceil(sh.h / lh) + 2;
      const old = sh.lines.length >= keep ? sh.lines.shift() : null;
      /** @type {Line} */
      const ln = { text: sh.text, c: sh.c, cv: old?.cv ?? document.createElement('canvas') };
      if (ln.text) render(ln);
      sh.lines.push(ln);
      sh.text = nextLine(sh); sh.typed = 0; sh.struck.length = 0;
      sh.roll = 0; sh.back = 1;
    }

    /** A sheet with its paper already full of text and a line half typed.
     * @param {number} x @param {number} y @param {number} w @param {number} h @param {number} rot
     * @param {number} cols @returns {Sheet} */
    function sheet(x, y, w, h, rot, cols) {
      /** @type {Sheet} */
      const sh = { x, y, w, h, rot, cols, lines: [], text: '', c: rng.int(s.colors.length), typed: 0,
        wait: 0, roll: 1, back: 0, para: 1 + rng.int(4), words: [], struck: [] };
      sh.text = nextLine(sh);
      for (let k = Math.ceil(h / lh) + 1; k > 0 || !sh.text; k--) carriageReturn(sh);
      sh.roll = 1; sh.back = 0;
      sh.typed = Math.floor(sh.text.length * (0.3 + rng.random() * 0.5));
      for (let i = 0; i < sh.typed; i++) sh.struck.push(-9);
      return sh;
    }

    /** @param {Sheet} sh @param {number} dt @returns {void} */
    function type(sh, dt) {
      sh.roll = Math.min(1, sh.roll + dt / ROLL);
      sh.back = Math.max(0, sh.back - dt / BACK);
      sh.wait -= dt;
      if (sh.wait > 0) return;
      if (sh.typed >= sh.text.length) {
        if (sh.back > 0) return;
        carriageReturn(sh);
        sh.wait = layout === 2 ? BACK : 0.6;
        return;
      }
      const ch = sh.text[sh.typed++];
      sh.struck.push(s.t);
      // A typist's rhythm: quick within words, a beat at spaces, longer after a full stop.
      sh.wait = (0.06 + rng.random() * 0.08) + (ch === ' ' ? 0.06 : 0) + (ch === '.' || ch === ',' ? 0.35 : 0)
        + (rng.random() < 0.03 ? 0.5 : 0);
      if (sh.typed >= sh.text.length) sh.wait += 0.5;
    }

    return {
      lay() {
        const m = Math.min(s.W, s.H);
        fs = clamp(m / (layout === 1 ? 30 : 26), 13, layout === 1 ? 20 : 25);
        lh = fs * 1.75;
        s.ctx.font = font();
        cw = s.ctx.measureText('M').width || fs * 0.6;
        const old = sheets;
        if (layout === 1) {
          const cols = Math.max(1, Math.round(s.W / 440)), rows = s.H > s.W * 1.2 ? 2 : 1;
          const cellW = s.W / cols, cellH = s.H / rows;
          sheets = [];
          for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
              const w = cellW * 0.82, h = cellH * 0.8;
              sheets.push(sheet(c * cellW + (cellW - w) / 2, r * cellH + (cellH - h) / 2, w, h,
                (rng.random() - 0.5) * 0.09, Math.floor((w - fs * 2.4) / cw)));
            }
          }
        } else {
          const cols = layout === 2 ? clamp(Math.floor(s.W * 0.75 / cw), 18, 64)
            : Math.floor((s.W - Math.max(fs * 2, s.W * 0.06) * 2) / cw);
          const sh = old[0];
          if (sh && sh.cols === cols) {
            // Same width: keep the text, re-rendered at the new size.
            sh.w = s.W; sh.h = s.H;
            for (const ln of sh.lines) if (ln.text) render(ln);
            sheets = [sh];
          } else sheets = [sheet(0, 0, s.W, s.H, 0, cols)];
        }
      },
      step(dt) { for (const sh of sheets) type(sh, dt); },
      draw() {
        const { ctx } = s;
        ctx.font = font(); ctx.textBaseline = 'alphabetic';
        const pulse = 0.5 + 0.5 * Math.sin(s.t * TAU / 1.6);
        for (const sh of sheets) {
          ctx.save();
          ctx.translate(sh.x + sh.w / 2, sh.y + sh.h / 2);
          ctx.rotate(sh.rot);
          ctx.translate(-sh.w / 2, -sh.h / 2);
          const pad = layout === 1 ? fs * 1.2 : Math.max(fs * 2, sh.w * 0.06);
          if (layout === 1) {
            // The paper: a faint sheet, its text kept inside it.
            ctx.globalAlpha = s.dark ? 0.05 : 0.18;
            ctx.fillStyle = s.dark ? s.colors[sh.c] : '#fff';
            ctx.fillRect(0, 0, sh.w, sh.h);
            ctx.globalAlpha = s.dark ? 0.22 : 0.26; ctx.strokeStyle = s.colors[sh.c]; ctx.lineWidth = 1.5;
            ctx.strokeRect(0, 0, sh.w, sh.h);
            ctx.beginPath(); ctx.rect(0, 0, sh.w, sh.h); ctx.clip();
          }
          const e = sh.roll * sh.roll * (3 - 2 * sh.roll);
          const base = sh.h - (layout === 1 ? pad : layout === 2 ? sh.h * 0.22 : lh * 1.6);
          const by = base + lh * (1 - e);
          // The carriage: the page sits so that the next letter lands on the guide.
          const guide = sh.w / 2;
          const b = sh.back * sh.back * (3 - 2 * sh.back);
          const lastLen = sh.lines.length ? sh.lines[sh.lines.length - 1].text.length : 0;
          const left = layout === 2 ? guide - (sh.typed + b * Math.max(0, lastLen - sh.typed)) * cw : pad;
          // Finished lines, dimmer the higher they have rolled.
          for (let k = sh.lines.length - 1, y = by - lh; k >= 0 && y > -lh; k--, y -= lh) {
            const ln = sh.lines[k];
            if (!ln.text) continue;
            ctx.globalAlpha = INK * clamp(0.25 + (y / sh.h) * 0.95, 0.2, 1);
            ctx.drawImage(ln.cv, left - 2, y - lh * 0.68, ln.cv.width / s.dpr, ln.cv.height / s.dpr);
          }
          // The line being typed: each letter lands darker and settles.
          ctx.fillStyle = s.colors[sh.c];
          for (let i = 0; i < sh.typed; i++) {
            if (sh.text[i] === ' ') continue;
            const age = s.t - sh.struck[i];
            ctx.globalAlpha = Math.min(1, INK * (1 + 0.6 * clamp(1 - age / 0.4, 0, 1)));
            ctx.fillText(sh.text[i], left + i * cw, by);
          }
          // The caret, a soft pulse, never a blink.
          const cx = left + sh.typed * cw;
          ctx.globalAlpha = (0.22 + 0.4 * pulse) * (sh.back > 0 ? 0.4 : 1);
          ctx.fillRect(cx, by + fs * 0.18, cw * 0.9, Math.max(2, fs * 0.12));
          if (layout === 2) {
            // The paper bail and platen roller across the host, and the type guide, fixed while the
            // page slides.
            ctx.strokeStyle = s.ink; ctx.lineWidth = 1.5;
            ctx.globalAlpha = s.dark ? 0.22 : 0.28;
            const top = by + fs * 0.75, roller = lh * 1.5;
            ctx.fillStyle = s.ink; ctx.globalAlpha = s.dark ? 0.05 : 0.06;
            ctx.fillRect(0, top, sh.w, roller);
            ctx.globalAlpha = s.dark ? 0.22 : 0.28;
            ctx.beginPath();
            ctx.moveTo(0, top); ctx.lineTo(sh.w, top);
            ctx.moveTo(0, top + roller); ctx.lineTo(sh.w, top + roller);
            ctx.moveTo(guide + cw * 0.45 - fs * 0.4, by + fs * 1.25); ctx.lineTo(guide + cw * 0.45, by + fs * 0.85);
            ctx.lineTo(guide + cw * 0.45 + fs * 0.4, by + fs * 1.25);
            ctx.stroke();
          }
          ctx.restore();
        }
      },
    };
  });
}
