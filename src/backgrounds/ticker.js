// Ticker: LED dot-matrix signs, every dot a small lamp on a dark panel, spell out words and
// numbers a column at a time. The seed picks the variant: ribbons of stock ticker crawling
// across the host, symbols and prices with their rises and falls in their own colours; one
// station departure board whose rows wipe on to the next train as each leaves, a clock ticking
// in its corner and a line of notices crawling along its foot; or a wall of small signs of
// different sizes, some crawling, some rolling one short message up and the next in.

import { stage, clamp } from './stage.js';
import { roundRect } from './shapes.js';

// A 5x7 dot font: each glyph is seven rows, each row one base-32 digit of five bits, left high.
// '^' and '_' are up and down triangles.
const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 .,:-+/%!'^_>*";
const FONT = 'ehhvhhhuhhuhhuehgggheuhhhhhuvgguggvvggugggehgnhhfhhhvhhhe44444e72222ichikokihggggggvhrllhhhhh'
  + 'pljhhehhhhheuhhugggehhhliduhhukihfgge11uv444444hhhhhhehhhhha4hhhlllahha4ahhhha4444v1248gvehjlphe4c4'
  + '444eeh1248vv2421he26aiv22vgu11he68guhhev124888ehhehheehhf12c000000000000cc0000c480cc0cc0000v000044v4'
  + '4001248g0op248j34444404c48000004ev00000ve400g84248g04lel40';

/** Column masks of each glyph, bit r lit in row r. @type {Map<string, number[]>} */
const GLYPHS = new Map();
for (let i = 0; i < CHARS.length; i++) {
  const rows = [...FONT.slice(i * 7, i * 7 + 7)].map((d) => parseInt(d, 32));
  GLYPHS.set(CHARS[i], [0, 1, 2, 3, 4].map((c) => rows.reduce((m, v, r) => m | (((v >> (4 - c)) & 1) << r), 0)));
}

const SYMBOLS = ['OAKS', 'FERN', 'NOVA', 'KITE', 'BOLT', 'LUMA', 'ZEST', 'PIKE', 'CORA', 'TIDE', 'ORBI',
  'QUIL', 'RUNE', 'SAGE', 'VELA', 'WISP', 'YAWL', 'BRIX', 'DUNE', 'MOSS', 'JUNO', 'HALO', 'GLEN', 'APEX'];
const PLACES = ['NORTHGATE', 'HARBOUR', 'MILLBROOK', 'EASTFIELD', 'KINGSWAY', 'RIVERSIDE', 'ASHVALE',
  'HIGHCROSS', 'LAKESIDE', 'OLD TOWN', 'PARKWAY', 'STONEBRIDGE', 'WESTMEAD', 'BAYVIEW', 'ELMHURST',
  'FAIRHAVEN', 'GREENHILL', 'MAPLEWOOD', 'CLIFFTOP', 'DOCKLANDS', 'SUNNYSIDE', 'BROOKFIELD'];

/** @typedef {[string, number][]} Spans text runs, each with a colour slot (0 main, 1 up, 2 down, 3 quiet, 4 accent) */
/** @typedef {{cv:HTMLCanvasElement, cols:number, start:number}} Item lit dots of some text, from column start */
/** @typedef {{x:number, y:number, C:number, pd:number, kind:number, items:Item[], off:number, rate:number,
 *   gen:() => Spans, next:Item|null, wipe:number, roll:number, hold:number}} Line
 * A row of dots at device px (x, y), C columns at pitch pd. kind 0 crawls (items queued from
 * off), 1 holds still and wipes on to next, 2 rolls next up from below; hold: seconds to wait. */

/** @param {HTMLElement} host @param {import('./stage.js').StageOptions} opts @returns {() => void} */
export function start(host, opts) {
  return stage(host, opts, (s) => {
    const { rng, layout } = s;
    const nc = s.colors.length;
    const base = rng.int(nc);
    // Colour slots: main, up, down, quiet, accent.
    const slot = [0, 2, 3, 5, 1].map((k) => s.colors[(base + k) % nc]);
    if (nc >= 6) slot[3] = s.colors[5];
    const subject = ((opts.subject ?? '').split('/')[1] ?? '').replace(/-/g, ' ').toUpperCase();
    /** @type {Line[]} */
    let lines = [];
    /** Sign panels, device px rects. @type {number[][]} */
    let panels = [];
    /** Unlit dots: one dot cell per pitch, as a pattern. @type {Map<number, CanvasPattern|null>} */
    const unlit = new Map();
    /** Glow sprites per colour slot, for the current pitch. @type {Map<string, HTMLCanvasElement>} */
    const glows = new Map();
    let clock = 0, minute = 0, tick = 0;
    /** @type {{t:number, dest:string, plat:number, late:number}[]} */
    let trains = [];
    let destW = 10, wide = true, serving = rng.int(80);
    /** @type {number[]} */
    let deck = [];

    /** @template T @param {T[]} a @returns {T} */
    const rand = (a) => a[rng.int(a.length)];
    const hhmm = (/** @type {number} */ m) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

    /** Columns of `text`, one blank after each glyph. @param {string} text @returns {number[]} */
    function columns(text) {
      /** @type {number[]} */
      const out = [];
      for (const ch of text) out.push(...(GLYPHS.get(ch) ?? GLYPHS.get(' ') ?? [0, 0, 0, 0, 0]), 0);
      return out;
    }

    /** @param {string} color @param {number} pd @returns {HTMLCanvasElement} a soft glow two dots across */
    function glow(color, pd) {
      const key = color + pd;
      const had = glows.get(key);
      if (had) return had;
      const c = document.createElement('canvas');
      c.width = c.height = pd * 3;
      const g = c.getContext('2d');
      if (g) {
        const h = pd * 1.5;
        const grad = g.createRadialGradient(h, h, 0, h, h, h);
        grad.addColorStop(0, color);
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = grad;
        g.globalAlpha = 0.4;
        g.fillRect(0, 0, h * 2, h * 2);
      }
      glows.set(key, c);
      return c;
    }

    /** Renders `spans` as lit dots at pitch pd, a dot's row of padding above and below for glows.
     * @param {Spans} spans @param {number} pd @param {number} [width] columns to pad or centre to
     * @returns {Item} */
    function render(spans, pd, width = 0) {
      /** @type {number[]} */
      let cols = [];
      /** @type {number[]} */
      let tint = [];
      for (const [text, k] of spans) {
        const c = columns(text);
        cols = cols.concat(c);
        tint = tint.concat(c.map(() => k));
      }
      if (width > cols.length) {
        const pad = Math.floor((width - cols.length) / 2);
        cols = Array(pad).fill(0).concat(cols, Array(width - cols.length - pad).fill(0));
        tint = Array(pad).fill(0).concat(tint, Array(width - tint.length - pad).fill(0));
      }
      const cv = document.createElement('canvas');
      cv.width = Math.max(1, cols.length * pd); cv.height = pd * 9;
      const g = cv.getContext('2d');
      if (g) {
        const r = pd * 0.38;
        if (s.dark) {
          for (let c = 0; c < cols.length; c++) for (let row = 0; row < 7; row++) {
            if (cols[c] >> row & 1) g.drawImage(glow(slot[tint[c]], pd), c * pd - pd, (row + 1) * pd - pd);
          }
        }
        for (let k = 0; k < slot.length; k++) {
          g.fillStyle = slot[k];
          g.beginPath();
          for (let c = 0; c < cols.length; c++) {
            if (tint[c] !== k) continue;
            for (let row = 0; row < 7; row++) {
              if (!(cols[c] >> row & 1)) continue;
              const x = c * pd + pd / 2, y = (row + 1) * pd + pd / 2;
              g.moveTo(x + r, y); g.arc(x, y, r, 0, Math.PI * 2);
            }
          }
          g.fill();
        }
      }
      return { cv, cols: cols.length, start: 0 };
    }

    // ---- what the signs say ----

    /** @returns {Spans} one stock: symbol, price and its change */
    function stock() {
      const up = rng.random() < 0.58;
      const price = (5 + rng.random() * rng.random() * 480).toFixed(2);
      const ch = (0.01 + rng.random() * rng.random() * 6).toFixed(2);
      return [[rand(SYMBOLS) + ' ', 0], [price + ' ', 3], [(up ? '^' : '_') + ch, up ? 1 : 2], ['    ', 0]];
    }

    /** @returns {Spans} a line of news between the stocks */
    function news() {
      /** @type {(() => Spans)[]} */
      const picks = [
        () => [['INDEX ', 0], [(3000 + rng.int(4000)) + '.' + String(rng.int(100)).padStart(2, '0') + ' ', 3], ['^' + (rng.random() * 30).toFixed(1), 1]],
        () => [['WEATHER ', 0], [`${8 + rng.int(20)}C `, 3], [rand(['SUNNY', 'CLOUDY', 'SHOWERS', 'BREEZY', 'CLEAR']), 4]],
        () => [['MARKETS ', 0], [rand(['OPEN', 'STEADY', 'BUSY', 'CALM']), 4]],
        () => [['TIME ', 0], [hhmm(minute), 3]],
        () => [['FX ', 0], [(0.5 + rng.random()).toFixed(4) + ' ', 3], [rng.random() < 0.5 ? '_0.12%' : '^0.08%', rng.random() < 0.5 ? 2 : 1]],
      ];
      if (subject) picks.push(() => [['TODAY: ', 0], [subject, 4]]);
      return [...rand(picks)(), ['     ', 0]];
    }

    /** @param {number} i @returns {Spans} departure row i, padded to the board's columns */
    function departure(i) {
      const t = trains[i];
      const dest = (t.dest + ' '.repeat(destW)).slice(0, destW);
      const status = i === 0 && minute >= t.t - 1 ? 'BOARDING' : t.late ? `EXP ${hhmm(t.t + t.late).slice(0, 5)}` : 'ON TIME';
      /** @type {Spans} */
      const out = [[hhmm(t.t) + ' ', 3], [dest + ' ', 0], [String(t.plat).padStart(2) + ' ', 4]];
      if (wide) out.push([status.padEnd(9).slice(0, 9), t.late ? 2 : 1]);
      return out;
    }

    /** @returns {Spans} a notice for the foot of the board */
    function notice() {
      const t = trains[0];
      const calls = rng.shuffle(PLACES.filter((p) => p !== t.dest)).slice(0, 3 + rng.int(3));
      /** @type {(() => Spans)[]} */
      const picks = [
        () => [['CALLING AT ', 3], [calls.join(', ') + ' AND ' + t.dest, 0], ['        ', 0]],
        () => [['PLEASE STAND BEHIND THE LINE        ', 3]],
        () => [['NEXT TRAIN FROM PLATFORM ' + t.plat + ' IS FOR ', 3], [t.dest, 0], ['        ', 0]],
        () => [['TICKETS PLEASE        ', 3]],
      ];
      return rand(picks)();
    }

    /** Messages for the wall of signs, up to `fit` characters. @param {number} fit @returns {Spans} */
    function short(fit) {
      /** @type {(() => Spans)[]} */
      const picks = [
        () => [['OPEN', 1]], () => [['WELCOME', 0]], () => [[hhmm(minute), 3]], () => [[`${8 + rng.int(20)}C`, 4]],
        () => [['ROOM ' + (1 + rng.int(12)), 0]], () => [['NOW ' + String(++serving % 1000).padStart(3, '0'), 4]],
        () => [['PLAT ' + (1 + rng.int(9)), 0]], () => [['EXIT >', 1]], () => [['GOOD LUCK', 0]], () => [['QUIET', 3]],
      ];
      if (subject) picks.push(() => [[subject, 4]]);
      for (let k = 0; k < 12; k++) {
        // Dealt from a shuffled deck, so neighbouring signs seldom say the same.
        if (!deck.length) deck = rng.shuffle(picks.map((_, i) => i));
        const out = picks[/** @type {number} */ (deck.pop())]();
        if (out.reduce((n, [t]) => n + t.length, 0) <= fit) return out;
      }
      return [['OPEN', 1]];
    }

    /** @returns {Spans} a longer crawling message */
    function long() {
      /** @type {(() => Spans)[]} */
      const picks = [
        () => [['NEXT STOP ', 3], [rand(PLACES), 0], ['      ', 0]],
        () => [['FIND THE WORDS HIDDEN IN THE GRID      ', 0]],
        () => [['NOW SERVING ', 3], [String(++serving % 1000).padStart(3, '0'), 4], ['      ', 0]],
        () => stock(),
        () => [['MIND THE STEP      ', 3]],
        () => [['TODAY ', 3], [`${8 + rng.int(20)}C `, 4], [rand(['SUNNY', 'CLOUDY', 'SHOWERS', 'CLEAR']), 0], ['      ', 0]],
      ];
      if (subject) picks.push(() => [['TODAY: ', 3], [subject, 4], ['      ', 0]]);
      return rand(picks)();
    }

    // ---- lines ----

    /** @param {number} x @param {number} y @param {number} C @param {number} pd @param {number} kind @param {() => Spans} gen @param {number} rate @returns {Line} */
    function line(x, y, C, pd, kind, gen, rate) {
      /** @type {Line} */
      const l = { x, y, C, pd, kind, items: [], off: 0, rate, gen, next: null, wipe: -1, roll: -1, hold: 3 + rng.random() * 5 };
      if (kind === 0) {
        l.off = rng.int(40);
        fill(l);
      } else l.items = [render(gen(), pd, C)];
      return l;
    }

    /** Queues items until the crawl reaches past the window, and drops those gone by. @param {Line} l */
    function fill(l) {
      let end = l.items.length ? l.items[l.items.length - 1].start + l.items[l.items.length - 1].cols : Math.floor(l.off);
      while (end < l.off + l.C + 2) {
        const it = render(l.gen(), l.pd);
        it.start = end;
        end += it.cols;
        l.items.push(it);
      }
      while (l.items.length && l.items[0].start + l.items[0].cols < l.off - 1) l.items.shift();
    }

    /** @param {number} dt */
    function advance(dt) {
      // A minute of the clocks every 4.5 s.
      tick += dt;
      while (tick > 4.5) {
        tick -= 4.5;
        minute = (minute + 1) % 1440;
        if (layout === 1) clockMinute();
      }
      clock += dt;
      for (const l of lines) {
        if (l.kind === 0) {
          l.off += l.rate * dt;
          fill(l);
        } else if (l.next && l.kind === 1) {
          l.wipe += l.C / 1.2 * dt;
          if (l.wipe >= l.C) { l.items = [l.next]; l.next = null; l.wipe = -1; }
        } else if (l.next) {
          l.roll += 9 * dt;
          if (l.roll >= 9) { l.items = [l.next]; l.next = null; l.roll = -1; }
        } else if (layout === 2 && (l.hold -= dt) <= 0) {
          l.hold = 4 + rng.random() * 5;
          l.next = render(l.gen(), l.pd, l.C);
          l.roll = 0;
        }
      }
    }

    /** The board's clock moves on; a train leaves when its time comes. */
    function clockMinute() {
      const [head, ...rows] = lines;
      head.items = [render(boardHead(), head.pd, head.C)];
      if (!trains.length) return;
      if (minute >= trains[0].t + (trains[0].late || 0)) {
        trains.shift();
        const last = trains[trains.length - 1];
        trains.push({ t: last.t + 3 + rng.int(7), dest: rand(PLACES), plat: 1 + rng.int(9), late: rng.random() < 0.18 ? 2 + rng.int(8) : 0 });
        // Rows wipe on to their new trains top first, each a little after the one above.
        rows.slice(0, trains.length).forEach((l, i) => {
          l.next = render(departure(i), l.pd, l.C);
          l.wipe = -i * l.C * 0.2;
        });
      } else if (minute === trains[0].t - 1) {
        const l = rows[0];
        l.next = render(departure(0), l.pd, l.C);
        l.wipe = 0;
      }
    }

    /** @returns {Spans} the board's header: a title, and the time at the right */
    function boardHead() {
      const C = lines[0]?.C ?? 0;
      const chars = Math.floor(C / 6);
      const title = wide ? 'DEPARTURES' : 'TRAINS';
      return [[title + ' '.repeat(Math.max(1, chars - title.length - 5)), 3], [hhmm(minute), 0]];
    }

    /** Paints the panels and every line's unlit dots, each line's dot cell as a pattern laid
     * from its corner (cheaper than a cached full-screen layer on very big hosts). */
    function paintBack() {
      const g = s.ctx;
      const r = Math.max(4, (lines[0]?.pd ?? 6) * 1.2);
      g.fillStyle = s.dark ? '#000' : s.ink;
      g.globalAlpha = s.dark ? 0.22 : 0.06;
      g.beginPath();
      for (const [x, y, w, h] of panels) roundRect(g, x, y, w, h, r);
      g.fill();
      g.strokeStyle = s.ink;
      g.globalAlpha = s.dark ? 0.16 : 0.18;
      g.lineWidth = Math.max(1, s.dpr);
      g.stroke();
      g.globalAlpha = s.dark ? 0.1 : 0.09;
      for (const l of lines) {
        if (!unlit.has(l.pd)) {
          const cell = document.createElement('canvas');
          cell.width = cell.height = l.pd;
          const cg = cell.getContext('2d');
          if (cg) { cg.fillStyle = s.ink; cg.beginPath(); cg.arc(l.pd / 2, l.pd / 2, l.pd * 0.34, 0, Math.PI * 2); cg.fill(); }
          unlit.set(l.pd, g.createPattern(cell, 'repeat'));
        }
        const pat = unlit.get(l.pd);
        if (!pat) continue;
        g.fillStyle = pat;
        g.setTransform(1, 0, 0, 1, l.x, l.y);
        g.fillRect(0, 0, l.C * l.pd, 7 * l.pd);
      }
      g.setTransform(1, 0, 0, 1, 0, 0);
    }

    /** Builds the signs for this size. */
    function build() {
      const { dpr } = s;
      const Wd = s.cv.width, Hd = s.cv.height, m = Math.min(s.W, s.H);
      lines = [];
      glows.clear();
      unlit.clear();
      panels = [];
      minute = 6 * 60 + rng.int(14 * 60);
      if (layout === 0) {
        const pd = Math.max(3, Math.round(clamp(Math.min(s.W / 180, s.H / 80), 3, 6.5) * dpr));
        const n = clamp(Math.round(s.H / 170), 2, 6);
        const C = Math.floor(Wd / pd);
        const x = Math.round((Wd - C * pd) / 2);
        for (let i = 0; i < n; i++) {
          const y = Math.round(Hd * (i + 0.5) / n - 3.5 * pd);
          const gen = i % 2 === 1 && n > 2 ? news : stock;
          lines.push(line(x, y, C, pd, 0, gen, [7.5, 6, 8.5, 6.5, 7][i]));
          panels.push([-pd, y - pd * 1.5, Wd + pd * 2, pd * 10]);
        }
      } else if (layout === 1) {
        const pd = Math.max(3, Math.round(clamp(Math.min(s.W / 215, s.H / 85), 2.5, 6.5) * dpr));
        const C = Math.floor(Wd * 0.9 / pd);
        const chars = Math.floor(C / 6);
        wide = chars >= 30;
        destW = clamp(chars - (wide ? 19 : 10), 6, 12);
        const rows = clamp(Math.floor(Hd * 0.8 / (pd * 9)) - 2, 3, 16);
        const x = Math.round((Wd - C * pd) / 2);
        const top = Math.round((Hd - (rows + 2) * 9 * pd) / 2);
        trains = [];
        let t = minute + 2 + rng.int(4);
        for (let i = 0; i < rows; i++) {
          trains.push({ t, dest: rand(PLACES), plat: 1 + rng.int(9), late: rng.random() < 0.18 ? 2 + rng.int(8) : 0 });
          t += 3 + rng.int(7);
        }
        lines.push(line(x, top, C, pd, 1, boardHead, 10));
        lines[0].items = [render(boardHead(), pd, C)];
        for (let i = 0; i < rows; i++) {
          const k = i;
          lines.push(line(x, top + (i + 1) * 9 * pd + pd, C, pd, 1, () => departure(k), 10));
        }
        lines.push(line(x, top + (rows + 1) * 9 * pd + pd * 2, C, pd, 0, notice, 8));
        panels.push([x - pd * 2, top - pd * 2, C * pd + pd * 4, (rows + 2) * 9 * pd + pd * 4]);
      } else {
        const p0 = clamp(m / 125, 3, 6.5);
        const n = clamp(Math.round(s.W * s.H / 36000), 6, 14);
        /** @type {number[][]} */
        const boxes = [];
        for (let tries = 0; tries < 600 && boxes.length < n; tries++) {
          const big = rng.random() < 0.3;
          const pd = Math.max(3, Math.round(p0 * (big ? 1.45 : 1) * dpr));
          const maxC = Math.floor((Wd - pd * 6) / pd);
          const C = Math.min(maxC, [36, 42, 48, 60, 72][rng.int(5)]);
          const w = C * pd + pd * 4, h = pd * 11;
          const x = pd * 2 + rng.random() * Math.max(0, Wd - w - pd * 4), y = pd * 2 + rng.random() * Math.max(0, Hd - h - pd * 4);
          const gap = pd * 2;
          if (boxes.some(([bx, by, bw, bh]) => x < bx + bw + gap && bx < x + w + gap && y < by + bh + gap && by < y + h + gap)) continue;
          boxes.push([x, y, w, h]);
          const lx = Math.round(x + pd * 2), ly = Math.round(y + pd * 2);
          const crawl = C > 48 || rng.random() < 0.35;
          lines.push(line(lx, ly, C, pd, crawl ? 0 : 2, crawl ? long : () => short(Math.floor(C / 6)), 6 + rng.random() * 3));
          panels.push([x, y, w, h]);
        }
      }
    }

    /** Copies columns [from, from + w) of `it` to the line's column `at`. @param {Line} l @param {Item} it @param {number} from @param {number} at @param {number} w @param {number} [dy] */
    function blit(l, it, from, at, w, dy = 0) {
      if (w <= 0) return;
      s.ctx.drawImage(it.cv, from * l.pd, 0, w * l.pd, it.cv.height, l.x + at * l.pd, l.y - l.pd + dy, w * l.pd, it.cv.height);
    }

    /** A crawl at whole column `o`. @param {Line} l @param {number} o */
    function crawl(l, o) {
      for (const it of l.items) {
        const from = Math.max(0, o - it.start), at = Math.max(0, it.start - o);
        blit(l, it, from, at, Math.min(it.cols - from, l.C - at));
      }
    }

    return {
      lay: build,
      step: advance,
      draw() {
        const { ctx } = s;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        paintBack();
        const lit = s.dark ? 0.48 : 0.5;
        for (const l of lines) {
          if (l.kind === 0) {
            // Each step of the crawl eases from one column to the next over half a step.
            const o = Math.floor(l.off), e = clamp((l.off - o - 0.5) * 2, 0, 1);
            ctx.globalAlpha = lit * (1 - e);
            crawl(l, o);
            if (e > 0) { ctx.globalAlpha = lit * e; crawl(l, o + 1); }
          } else if (l.next && l.kind === 1) {
            const w = clamp(Math.floor(l.wipe), 0, l.C);
            ctx.globalAlpha = lit;
            blit(l, l.next, 0, 0, Math.min(w, l.next.cols));
            blit(l, l.items[0], w, w, Math.min(l.C, l.items[0].cols) - w);
          } else if (l.next) {
            const r = Math.floor(l.roll);
            ctx.save();
            ctx.beginPath();
            ctx.rect(l.x, l.y - l.pd * 0.5, l.C * l.pd, l.pd * 8);
            ctx.clip();
            ctx.globalAlpha = lit;
            blit(l, l.items[0], 0, 0, Math.min(l.C, l.items[0].cols), -r * l.pd);
            blit(l, l.next, 0, 0, Math.min(l.C, l.next.cols), (9 - r) * l.pd);
            ctx.restore();
          } else {
            ctx.globalAlpha = lit;
            blit(l, l.items[0], 0, 0, Math.min(l.C, l.items[0].cols));
          }
        }
        ctx.globalAlpha = 1;
      },
    };
  });
}
