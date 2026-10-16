// Chess: a game plays itself in the look's colours. Each side picks a legal move (no castling or
// en passant), the piece glides to its square, a taken piece fades as the taker lands, and after
// mate, stalemate or a long game the set fades and stands up again. The seed picks the variant:
// one large board in the middle of the page; a simultaneous display of small boards, each its own
// game at its own pace; or one board seen in perspective from a player's side, far rows small.

import { stage, clamp } from './stage.js';

const GLIDE = 0.85;    // s for a piece to reach its square
const REST = 0.9;      // s between moves, about
const VANISH = 0.6;    // s for a taken piece to fade
const FADE = 1.2;      // s for the whole set to fade out or in
const MAXPLY = 100;
const VALUE = [0, 1, 3, 3, 5, 9, 40];
const BACK = [4, 2, 3, 5, 6, 3, 2, 4];
const KN = [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]];
const KG = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
// Kind 1..6 (pawn, knight, bishop, rook, queen, king), in a 100 box standing on y 90.
const BASE = 'M24 78h52a4 4 0 0 1 4 4v8H20v-8a4 4 0 0 1 4-4z';
const SHAPES = ['',
  'M50 18a13 13 0 1 1 0 26a13 13 0 1 1 0-26zM40 46h20l-3 6c4 10 8 18 12 26H31c4-8 8-16 12-26z',
  'M30 78c0-16 8-22 14-30-8 2-16 4-20-2-3-6 6-14 14-20l4-12 7 9c16 0 29 14 27 55z',
  'M50 6a6 6 0 1 1 0 12a6 6 0 1 1 0-12zM50 18c13 10 17 24 11 40H39c-6-16-2-30 11-40zM40 60h20l6 18H34z',
  'M28 14h10v8h7v-8h10v8h7v-8h10v24H28zM34 40h32l4 38H30z',
  'M18 20a6 6 0 1 1 0 .1zM50 12a6 6 0 1 1 0 .1zM82 20a6 6 0 1 1 0 .1zM20 26l16 34h28l16-34-16 18-14-26-14 26zM36 62h28l6 16H30z',
  'M46 2h8v8h8v8h-8v8h-8v-8h-8v-8h8zM30 34c4-8 36-8 40 0l-7 26H37zM36 62h28l6 16H30z',
];

/** @typedef {{code:number, sq:number, gone:number}} Piece
 * code: side * 8 + kind; gone: -1 on the board, else seconds since it was taken. */
/** @typedef {{b:Int8Array, id:Int16Array, pieces:Piece[], turn:number, ply:number, from:number,
 *   to:number, u:number, wait:number, prey:number, end:number, show:number, pace:number,
 *   last:number[], lit:number, ox:number, oy:number, sq:number}} Game
 * from, to: the move under way (-1 none), u its progress; prey: the piece it takes, or -1; end:
 * -1 in play, else seconds since the game ended; show: the whole set's fade; lit: the last
 * move's squares fading in; ox, oy, sq: the board's corner and square size on a flat board. */

/** @param {number} r @param {number} c @returns {boolean} */
const on = (r, c) => r >= 0 && r < 8 && c >= 0 && c < 8;

/** Whether side `by` attacks square sq on board b. @param {Int8Array} b @param {number} sq
 * @param {number} by @returns {boolean} */
function attacked(b, sq, by) {
  const r = sq >> 3, c = sq & 7, o = by * 8;
  // Side 0 plays up the board, so its pawns attack from the row below.
  const pr = by === 0 ? r + 1 : r - 1;
  if (on(pr, c - 1) && b[pr * 8 + c - 1] === o + 1) return true;
  if (on(pr, c + 1) && b[pr * 8 + c + 1] === o + 1) return true;
  for (const [dr, dc] of KN) if (on(r + dr, c + dc) && b[(r + dr) * 8 + c + dc] === o + 2) return true;
  for (let k = 0; k < 8; k++) {
    const [dr, dc] = KG[k];
    if (on(r + dr, c + dc) && b[(r + dr) * 8 + c + dc] === o + 6) return true;
    let rr = r + dr, cc = c + dc;
    while (on(rr, cc)) {
      const p = b[rr * 8 + cc];
      if (p) {
        const t = p & 7;
        if (p >> 3 === by && (t === 5 || t === (k >= 4 ? 3 : 4))) return true;
        break;
      }
      rr += dr; cc += dc;
    }
  }
  return false;
}

/** Every move side could make ignoring check, as from * 64 + to. @param {Int8Array} b
 * @param {number} side @returns {number[]} */
function pseudo(b, side) {
  /** @type {number[]} */
  const out = [];
  for (let sq = 0; sq < 64; sq++) {
    const p = b[sq];
    if (!p || p >> 3 !== side) continue;
    const r = sq >> 3, c = sq & 7, t = p & 7;
    /** @param {number} rr @param {number} cc @returns {boolean} true when a slide can go on */
    const add = (rr, cc) => {
      if (!on(rr, cc)) return false;
      const q = b[rr * 8 + cc];
      if (q && q >> 3 === side) return false;
      out.push(sq * 64 + rr * 8 + cc);
      return !q;
    };
    if (t === 1) {
      const d = side === 0 ? -1 : 1;
      if (on(r + d, c) && !b[(r + d) * 8 + c]) {
        out.push(sq * 64 + (r + d) * 8 + c);
        if (r === (side === 0 ? 6 : 1) && !b[(r + 2 * d) * 8 + c]) out.push(sq * 64 + (r + 2 * d) * 8 + c);
      }
      for (const dc of [-1, 1]) {
        const q = on(r + d, c + dc) ? b[(r + d) * 8 + c + dc] : 0;
        if (q && q >> 3 !== side) out.push(sq * 64 + (r + d) * 8 + c + dc);
      }
    } else if (t === 2 || t === 6) {
      for (const [dr, dc] of t === 2 ? KN : KG) add(r + dr, c + dc);
    } else {
      for (let k = t === 3 ? 4 : 0; k < (t === 4 ? 4 : 8); k++) {
        const [dr, dc] = KG[k];
        for (let i = 1; add(r + dr * i, c + dc * i); i++);
      }
    }
  }
  return out;
}

/** Makes move m on b, a pawn on the far row becoming a queen. @param {Int8Array} b @param {number} m */
function apply(b, m) {
  const f = m >> 6, t = m & 63, p = b[f];
  b[t] = (p & 7) === 1 && (t >> 3 === 0 || t >> 3 === 7) ? (p & 8) + 5 : p;
  b[f] = 0;
}

/** @param {Int8Array} b @param {number} side @returns {boolean} */
function inCheck(b, side) {
  const k = b.indexOf(side * 8 + 6);
  return k >= 0 && attacked(b, k, side ^ 1);
}

const tmp = new Int8Array(64);

/** The moves that leave side's own king safe. @param {Int8Array} b @param {number} side @returns {number[]} */
function legal(b, side) {
  return pseudo(b, side).filter((m) => { tmp.set(b); apply(tmp, m); return !inCheck(tmp, side); });
}

/** @param {HTMLElement} host @param {import('./stage.js').StageOptions} opts @returns {() => void} */
export function start(host, opts) {
  return stage(host, opts, (s) => {
    const { rng } = s;
    const nc = s.colors.length;
    const tilt = s.layout === 2;
    /** @type {Game[]} */
    const games = [];
    /** Every piece in one sheet (one texture): kind across, side down, cells S + 2 apart. */
    const atlas = document.createElement('canvas');
    let S = 0, fresh = true;
    // The perspective view: focal length, camera height, horizon, near depth.
    let F = 1, HGT = 5, hy = 0;
    const D0 = 8;

    /** @param {Game} g */
    function setup(g) {
      g.b.fill(0); g.id.fill(-1); g.pieces = [];
      for (let c = 0; c < 8; c++) {
        /** @type {[number, number][]} */
        const put = [[0, 8 + BACK[c]], [1, 9], [6, 1], [7, BACK[c]]];
        for (const [r, code] of put) {
          g.b[r * 8 + c] = code;
          g.id[r * 8 + c] = g.pieces.length;
          g.pieces.push({ code, sq: r * 8 + c, gone: -1 });
        }
      }
      g.turn = 0; g.ply = 0; g.from = -1; g.prey = -1; g.end = -1; g.last = []; g.lit = 0;
    }

    /** @returns {Game} */
    function game() {
      /** @type {Game} */
      const g = { b: new Int8Array(64), id: new Int16Array(64), pieces: [], turn: 0, ply: 0, from: -1,
        to: -1, u: 0, wait: REST, prey: -1, end: -1, show: 1, pace: 0.85 + rng.random() * 0.35,
        last: [], lit: 0, ox: 0, oy: 0, sq: 0 };
      setup(g);
      // A game already under way.
      for (let k = 8 + rng.int(36); k > 0 && g.end < 0; k--) instant(g);
      if (g.end >= 0) setup(g);
      return g;
    }

    /** The move to play: takes and checks first, a piece left hanging avoided, with a shuffle.
     * @param {Game} g @returns {number} -1 when there is none */
    function choose(g) {
      const moves = legal(g.b, g.turn);
      let best = -1, score = -Infinity;
      for (const m of moves) {
        const f = m >> 6, t = m & 63, kind = g.b[f] & 7;
        let k = VALUE[g.b[t] & 7] * 10 + rng.random() * 4;
        tmp.set(g.b); apply(tmp, m);
        if (attacked(tmp, t, g.turn ^ 1)) k -= VALUE[kind] * 9;
        if (inCheck(tmp, g.turn ^ 1)) k += 2.5;
        if (kind === 1) k += 0.6;
        if (g.ply < 16 && (kind === 2 || kind === 3) && (f >> 3 === 0 || f >> 3 === 7)) k += 1.5;
        if (kind === 6 && g.ply < 40) k -= 2;
        if (k > score) { score = k; best = m; }
      }
      return best;
    }

    /** Whether the game is over before side to move plays: no move, too long, or bare kings.
     * @param {Game} g @returns {boolean} */
    function over(g) {
      if (g.ply >= MAXPLY || !legal(g.b, g.turn).length) return true;
      let men = 0;
      for (let i = 0; i < 64; i++) if (g.b[i]) men++;
      return men <= 3;
    }

    /** Ends the game; a mated king fades first. @param {Game} g */
    function finish(g) {
      g.end = 0; g.from = -1;
      if (inCheck(g.b, g.turn)) {
        const k = g.id[g.b.indexOf(g.turn * 8 + 6)];
        if (k >= 0) g.pieces[k].gone = 0;
      }
    }

    /** Plays a move at once, for a game already under way. @param {Game} g */
    function instant(g) {
      if (over(g)) { g.end = 0; return; }
      const m = choose(g);
      g.from = m >> 6; g.to = m & 63; g.prey = g.id[g.to];
      commit(g);
      if (g.prey >= 0) g.pieces[g.prey].gone = VANISH;
      g.prey = -1; g.lit = 1;
    }

    /** @param {Game} g */
    function commit(g) {
      const m = g.from * 64 + g.to;
      if (g.prey >= 0 && g.pieces[g.prey].gone < 0) g.pieces[g.prey].gone = 0;
      apply(g.b, m);
      const i = g.id[g.from];
      g.id[g.to] = i; g.id[g.from] = -1;
      g.pieces[i].sq = g.to; g.pieces[i].code = g.b[g.to];
      g.last = [g.from, g.to]; g.lit = 0;
      g.from = -1; g.prey = -1; g.turn ^= 1; g.ply++;
      g.wait = REST * (0.6 + rng.random() * 0.8);
    }

    /** @param {Game} g @param {number} dt */
    function tick(g, dt) {
      dt *= g.pace;
      for (const p of g.pieces) if (p.gone >= 0) p.gone += dt;
      g.lit = Math.min(1, g.lit + dt / 0.5);
      if (g.end >= 0) {
        g.end += dt;
        if (g.end > 1.2) g.show = Math.max(0, 1 - (g.end - 1.2) / FADE);
        if (g.end > 1.6 + FADE) { setup(g); g.show = 0; g.wait = FADE + 0.4; }
        return;
      }
      if (g.show < 1) { g.show = Math.min(1, g.show + dt / FADE); return; }
      if (g.from >= 0) {
        g.u += dt / GLIDE;
        if (g.prey >= 0 && g.u > 0.6 && g.pieces[g.prey].gone < 0) g.pieces[g.prey].gone = 0;
        if (g.u >= 1) commit(g);
        return;
      }
      g.wait -= dt;
      if (g.wait > 0) return;
      if (over(g)) { finish(g); return; }
      const m = choose(g);
      g.from = m >> 6; g.to = m & 63; g.u = 0; g.prey = g.id[g.to];
    }

    /** A point on the board (column, row in squares, 0..8) to the page, and the square's width
     * there. @param {Game} g @param {number} c @param {number} r @returns {[number, number, number]} */
    function proj(g, c, r) {
      if (!tilt) return [g.ox + c * g.sq, g.oy + r * g.sq, g.sq];
      const d = D0 + 8 - r;
      return [s.W / 2 + F * (c - 4) / d, hy + F * HGT / d, F / d];
    }

    function layout() {
      const m = Math.min(s.W, s.H);
      if (s.layout === 1) {
        const b = clamp(m * 0.46, 160, 380);
        const cols = Math.max(1, Math.floor(s.W / (b * 1.08))), rows = Math.max(1, Math.floor(s.H / (b * 1.08)));
        const nx = Math.min(cols, 3), ny = Math.min(rows, Math.ceil(6 / nx));
        const n = nx * ny;
        const side = Math.min(s.W / nx, s.H / ny) * 0.86;
        const gx = (s.W - nx * side) / (nx + 1), gy = (s.H - ny * side) / (ny + 1);
        while (games.length < n) games.push(game());
        games.length = n;
        games.forEach((g, i) => {
          g.sq = side / 8;
          g.ox = gx + (i % nx) * (side + gx);
          g.oy = gy + Math.floor(i / nx) * (side + gy);
        });
      } else {
        if (!games.length) games.push(game());
        const side = clamp(m * 0.9, 200, 900);
        const g = games[0];
        g.sq = side / 8; g.ox = (s.W - side) / 2; g.oy = (s.H - side) / 2;
      }
      if (tilt) {
        F = Math.min(s.W * (s.W < s.H ? 1.6 : 1.15), s.H * 1.9);
        HGT = clamp(s.H * 0.8 / (F * (1 / D0 - 1 / (D0 + 8))), 3, 20);
        hy = s.H * 0.97 - F * HGT / D0;
      }
    }

    /** Each board's dark squares, light squares and edge, as paths made once per size. @type {Path2D[][]} */
    let paths = [];

    /** The boards: a few fills, cheaper than a page-sized cached layer. @param {CanvasRenderingContext2D} g2 */
    function boards(g2) {
      g2.fillStyle = s.ink; g2.strokeStyle = s.ink;
      games.forEach((g, k) => {
        const [dark, light, edge] = paths[k];
        g2.globalAlpha = s.dark ? 0.1 : 0.085; g2.fill(dark);
        g2.globalAlpha = s.dark ? 0.03 : 0.025; g2.fill(light);
        g2.globalAlpha = s.dark ? 0.28 : 0.3;
        g2.lineWidth = Math.max(1.5, proj(g, 0, 8)[2] * 0.03);
        g2.stroke(edge);
      });
    }

    function render() {
      paths = games.map((g) => {
        const dark = new Path2D(), light = new Path2D(), edge = new Path2D();
        for (let i = 0; i < 64; i++) quad(((i >> 3) + (i & 7)) & 1 ? dark : light, g, i & 7, i >> 3);
        quad(edge, g, 0, 0, 8);
        return [dark, light, edge];
      });
      // Sprites: big enough for the largest square, at device pixels.
      const big = Math.max(...games.map((g) => proj(g, 0, 8)[2]));
      const size = Math.ceil(big * s.dpr);
      if (size !== S) {
        S = size;
        atlas.width = 6 * (S + 2); atlas.height = 2 * (S + 2);
        const g2 = atlas.getContext('2d');
        if (g2) for (let code = 1; code < 15; code++) if ((code & 7) && (code & 7) < 7) sprite(g2, code);
      }
    }

    /** Adds square (c, r), n squares wide, to the path. @param {CanvasRenderingContext2D|Path2D} g2
     * @param {Game} g @param {number} c @param {number} r @param {number} [n] */
    function quad(g2, g, c, r, n = 1) {
      const a = proj(g, c, r), b = proj(g, c + n, r), d = proj(g, c + n, r + n), e = proj(g, c, r + n);
      g2.moveTo(a[0], a[1]); g2.lineTo(b[0], b[1]); g2.lineTo(d[0], d[1]); g2.lineTo(e[0], e[1]); g2.closePath();
    }

    /** Draws one piece into its cell of the sheet. @param {CanvasRenderingContext2D} g2 @param {number} code */
    function sprite(g2, code) {
      const side = code >> 3, kind = code & 7, col = s.colors[side % nc];
      g2.save();
      g2.translate((kind - 1) * (S + 2) + 1, side * (S + 2) + 1);
      g2.beginPath(); g2.rect(0, 0, S, S); g2.clip();
      g2.scale(S / 100, S / 100);
      // The black knight faces the other way.
      if (side && kind === 2) { g2.translate(100, 0); g2.scale(-1, 1); }
      const p = new Path2D(SHAPES[kind] + BASE);
      g2.fillStyle = col; g2.strokeStyle = col; g2.lineJoin = 'round';
      if (side) {
        g2.globalAlpha = 0.38; g2.fill(p);
        g2.globalAlpha = 1; g2.lineWidth = 6; g2.stroke(p);
      } else {
        g2.fill(p);
      }
      // A slit in the bishop's mitre, and the knight's eye.
      g2.globalCompositeOperation = 'destination-out';
      g2.lineWidth = 5; g2.lineCap = 'round';
      if (kind === 3) { g2.beginPath(); g2.moveTo(56, 26); g2.lineTo(47, 40); g2.stroke(); }
      if (kind === 2) { g2.beginPath(); g2.arc(48, 34, 3.5, 0, Math.PI * 2); g2.fill(); }
      if (side === 0) { g2.fillRect(18, 74, 64, 3); }
      g2.restore();
    }

    return {
      lay() {
        layout();
        render();
        if (fresh) {
          fresh = false;
          // A first frame mid-move, for reduced motion.
          for (const g of games) { g.wait = 0; tick(g, 0); if (g.from >= 0) g.u = 0.45; }
        }
      },
      step(dt) { for (const g of games) tick(g, dt); },
      draw() {
        const { ctx } = s;
        boards(ctx);
        for (const g of games) {
          // The last move's two squares, softly.
          if (g.last.length && g.show > 0) {
            ctx.globalAlpha = (s.dark ? 0.2 : 0.22) * g.lit * g.show;
            ctx.fillStyle = s.colors[2 % nc];
            ctx.beginPath();
            for (const q of g.last) quad(ctx, g, q & 7, q >> 3);
            ctx.fill();
          }
          /** @type {[number, number, number, number, number][]} y, x, size, code, alpha */
          const list = [];
          for (let i = 0; i < g.pieces.length; i++) {
            const p = g.pieces[i];
            const a = p.gone < 0 ? 1 : 1 - p.gone / VANISH;
            if (a <= 0) continue;
            let c = (p.sq & 7) + 0.5, r = (p.sq >> 3) + 0.5;
            if (g.from >= 0 && g.id[g.from] === i) {
              const e = g.u * g.u * (3 - 2 * g.u);
              c += ((g.to & 7) - (g.from & 7)) * e;
              r += ((g.to >> 3) - (g.from >> 3)) * e;
            }
            const [x, y, k] = proj(g, c, r);
            list.push([y, x, k, p.code, a]);
          }
          if (tilt) list.sort((a, b) => a[0] - b[0]);
          for (const [y, x, k, code, a] of list) {
            ctx.globalAlpha = (tilt ? 0.52 : 0.6) * a * g.show;
            const z = k * (tilt ? 0.82 : 0.86);
            ctx.drawImage(atlas, ((code & 7) - 1) * (S + 2) + 1, (code >> 3) * (S + 2) + 1, S, S, x - z / 2, y - z * (tilt ? 0.88 : 0.52), z, z);
          }
        }
      },
    };
  });
}
