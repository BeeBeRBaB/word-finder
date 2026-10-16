// Generates part38.json (round 4: museum, gallery and storybook hero icons).
import fs from 'node:fs';
const f = n => { const s = (Math.round(n * 10) / 10).toString(); return s === '-0' ? '0' : s; };
const P = (c, d, extra = '') => `<path class="${c}"${extra} d="${d}"/>`;
const C = (c, x, y, r) => `<circle class="${c}" cx="${f(x)}" cy="${f(y)}" r="${f(r)}"/>`;
const E = (c, x, y, rx, ry, rot) => `<ellipse class="${c}" cx="${f(x)}" cy="${f(y)}" rx="${f(rx)}" ry="${f(ry)}"${rot ? ` transform="rotate(${rot} ${f(x)} ${f(y)})"` : ''}/>`;
const R = (c, x, y, w, h, r = 0, extra = '') => `<rect class="${c}" x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}"${r ? ` rx="${f(r)}"` : ''}${extra}/>`;
const L = (d, w) => `<path class="ln"${w ? ` stroke-width="${w}"` : ''} d="${d}"/>`;
// stadium between two points
const cap = (x1, y1, x2, y2, w) => {
  const r = w / 2, dx = x2 - x1, dy = y2 - y1, l = Math.hypot(dx, dy) || 1, nx = -dy / l * r, ny = dx / l * r;
  return `M${f(x1 + nx)} ${f(y1 + ny)}L${f(x2 + nx)} ${f(y2 + ny)}A${f(r)} ${f(r)} 0 0 0 ${f(x2 - nx)} ${f(y2 - ny)}L${f(x1 - nx)} ${f(y1 - ny)}A${f(r)} ${f(r)} 0 0 0 ${f(x1 + nx)} ${f(y1 + ny)}Z`;
};
const limb = (pts, w) => pts.slice(1).map((p, i) => cap(pts[i][0], pts[i][1], p[0], p[1], w)).join('');
// polygon with quadratic-rounded corners; rad number or array
const rpoly = (pts, rad) => {
  const n = pts.length; let d = '';
  for (let i = 0; i < n; i++) {
    const v = pts[i], a = pts[(i + n - 1) % n], b = pts[(i + 1) % n], r = Array.isArray(rad) ? rad[i] : rad;
    const la = Math.hypot(a[0] - v[0], a[1] - v[1]), lb = Math.hypot(b[0] - v[0], b[1] - v[1]);
    const ta = Math.min(r / la, .5), tb = Math.min(r / lb, .5);
    const p1 = [v[0] + (a[0] - v[0]) * ta, v[1] + (a[1] - v[1]) * ta], p2 = [v[0] + (b[0] - v[0]) * tb, v[1] + (b[1] - v[1]) * tb];
    d += `${i ? 'L' : 'M'}${f(p1[0])} ${f(p1[1])}Q${f(v[0])} ${f(v[1])} ${f(p2[0])} ${f(p2[1])}`;
  }
  return d + 'Z';
};
const star = (cx, cy, R1, R2, n = 5, rot = -90) => Array.from({ length: n * 2 }, (_, i) => {
  const a = (rot + i * 180 / n) * Math.PI / 180, r = i % 2 ? R2 : R1; return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
});
const spark = (x, y, s) => `M${f(x)} ${f(y - s)}Q${f(x)} ${f(y)} ${f(x + s)} ${f(y)}Q${f(x)} ${f(y)} ${f(x)} ${f(y + s)}Q${f(x)} ${f(y)} ${f(x - s)} ${f(y)}Q${f(x)} ${f(y)} ${f(x)} ${f(y - s)}Z`;
const circ = (x, y, r) => `M${f(x - r)} ${f(y)}a${f(r)} ${f(r)} 0 1 0 ${f(2 * r)} 0a${f(r)} ${f(r)} 0 1 0 ${f(-2 * r)} 0Z`;
const rr = (x, y, w, h) => `M${f(x)} ${f(y)}h${f(w)}v${f(h)}h${f(-w)}Z`;
// counter-clockwise rect, same winding as circ(), so the two union in one path
const rrc = (x, y, w, h) => `M${f(x)} ${f(y)}v${f(h)}h${f(w)}v${f(-h)}Z`;
const mir = (pts, c = 32) => pts.map(([x, y]) => [2 * c - x, y]);

const icons = [];
const add = (id, motif, svg) => icons.push({ id, motif, svg });

// ---------- exhibit-case
{
  let s = '';
  // case frame: lid, corner posts, back edges
  s += P('t-a', rpoly([[14.5, 6.5], [49.5, 6.5], [50, 11], [14, 11]], 1.2) + rr(16, 10.5, 3, 28) + rr(45, 10.5, 3, 28));
  s += P('t-b', rr(16, 10.5, 32, 1.6) + rr(46.4, 12, 1.6, 26));
  s += L('M19 13.5H45M21.5 12.1V37M42.5 12.1V37', 1.1);
  // glare on the glass
  s += P('t-c', 'M20 23L25.5 12.2H28L20 28Z' + 'M44.6 25.5L38.8 37.6H41.2L44.6 31Z');
  // amphora with a highlight cut out
  const hl = 'M27.2 23.6Q25.8 27.2 27.6 31.2L29 30.8Q27.8 27.2 28.7 23.8Z';
  const vase = 'M27.5 14.4H36.5V16.6H34.6V19.4Q40.3 21.4 40.3 27Q40.3 32.2 35.2 35H36.9V38H27.1V35H28.8Q23.7 32.2 23.7 27Q23.7 21.4 29.4 19.4V16.6H27.5Z';
  s += P('t-a', vase + hl, ' fill-rule="evenodd"');
  s += P('t-b', 'M24 25.4H40V28.4H24Z' + 'M36.6 20.6Q40.3 22.6 40.3 27Q40.3 32.2 35.2 35H33.4Q37.6 31.6 37.6 27Q37.6 23.2 35.6 20.4Z');
  s += P('t-c', hl);
  s += L('M29.4 17.6Q24.2 17.4 25.4 23M34.6 17.6Q39.8 17.4 38.6 23', 1.6);
  // plinth with label card cut out
  const lab = rr(25, 45, 14, 5.6);
  const pl = rpoly([[13, 38], [51, 38], [51, 42], [48, 42], [48, 55], [51, 55], [51, 59.5], [13, 59.5], [13, 55], [16, 55], [16, 42], [13, 42]], .8);
  s += P('t-a', pl + lab, ' fill-rule="evenodd"');
  s += P('t-b', rr(16, 42, 32, 1.6) + rr(44.5, 43.6, 3.5, 11.4) + rr(13, 57.6, 38, 1.9));
  s += P('t-c', lab) + P('t-b', rr(27, 46.6, 10, 1.1) + rr(27, 48.5, 6.5, 1.1));
  // rope barrier on two brass posts
  const post = x => rrc(x - 1.4, 42, 2.8, 15.5) + rpoly([[x - 3.9, 59.6], [x + 3.9, 59.6], [x + 3.4, 56.6], [x - 3.4, 56.6]], .8) + circ(x, 41.4, 2.7);
  s += P('t-a', post(7.6) + post(56.4));
  s += P('t-b', rr(7.6, 42, 1.4, 15) + rr(57.8 - 1.4, 42, 1.4, 15) + rr(3.7, 58.2, 7.8, 1.4) + rr(52.5, 58.2, 7.8, 1.4));
  s += P('t-c', circ(6.8, 40.5, .9) + circ(55.6, 40.5, .9));
  s += L('M9.4 44Q32 62 54.6 44', 3);
  s += P('t-c', spark(7.5, 8, 3.6) + spark(57, 7.5, 3) + spark(56.5, 24, 2.2));
  add('exhibit-case', 'museum glass case on a plinth with a vase, label and rope barrier', s);
}

// ---------- gallery-frame
{
  let s = '';
  // picture light: beam fans down from the lamp to the frame
  s += P('t-c', 'M23.5 9.4H40.5L47 14.5H17Z');
  s += P('t-a', rpoly([[23.5, 4.6], [40.5, 4.6], [42, 9.4], [22, 9.4]], 1.6));
  s += P('t-b', rr(22.6, 8, 18.8, 1.4) + rr(30.8, 9.4, 2.4, 5));
  // frame with canvas cut out
  const cv = rr(15.5, 21.5, 33, 15.5);
  s += P('t-a', rpoly([[7, 14], [57, 14], [57, 44], [7, 44]], 1.5) + cv, ' fill-rule="evenodd"');
  s += P('t-b', rr(13.5, 19.5, 37, 19.5) + cv, ' fill-rule="evenodd"');
  s += P('t-b', 'M7 41.5H57V42.5Q57 44 55.5 44H8.5Q7 44 7 42.5Z');
  s += L('M10.3 17.3H53.7V40.7H10.3Z', 1);
  // corner rosettes and side cartouches
  const ros = [[8.6, 15.6], [55.4, 15.6], [8.6, 42.2], [55.4, 42.2]];
  s += P('t-a', ros.map(([x, y]) => circ(x, y, 3.6)).join('') + circ(32, 44.2, 2.6) + circ(5.6, 29, 2.3) + circ(58.4, 29, 2.3));
  s += P('t-b', ros.map(([x, y]) => circ(x, y, 1.5)).join('') + circ(32, 44.4, 1.1) + circ(5.4, 29, 1) + circ(58.6, 29, 1));
  // landscape: sky, sun, mountains, hill
  s += P('t-c', cv);
  s += P('t-a', circ(42.5, 25.5, 2.6) + 'M15.5 37V33L22.5 26L27 30.5L33.5 24.5L43 35V37Z');
  s += P('t-b', 'M15.5 37V33.6Q23 30.4 31 34Q39 30.8 48.5 32.6V37Z' + 'M33.5 24.5L43 35H38.4L35.2 27.6Z');
  // velvet rope on brass posts
  const post = x => rrc(x - 1.4, 48.4, 2.8, 9) + rpoly([[x - 4, 59.7], [x + 4, 59.7], [x + 3.6, 56.8], [x - 3.6, 56.8]], .8) + circ(x, 48, 2.6);
  s += P('t-a', post(13) + post(51));
  s += P('t-b', rr(13, 48.6, 1.4, 8.2) + rr(52.4 - 1.4, 48.6, 1.4, 8.2) + rr(9, 58.3, 8, 1.4) + rr(47, 58.3, 8, 1.4));
  s += P('t-c', circ(12.2, 47.1, .9) + circ(50.2, 47.1, .9));
  s += L('M14.8 50.2Q32 63.4 49.2 50.2', 3.4);
  s += P('t-c', spark(8, 7.5, 3.4) + spark(56.5, 7, 3));
  add('gallery-frame', 'ornate gallery picture frame lit from above with a velvet rope', s);
}

// ---------- storyteller
{
  let s = '';
  // wing armchair, side on, facing right
  s += P('t-b', rpoly([[5.5, 12], [14.5, 10.5], [17.5, 39], [6.5, 40]], [3, 3, 1, 1]) + rpoly([[6.5, 37.5], [35, 37.5], [36.5, 41], [35.5, 52], [6.5, 52]], [1, 2.5, 2, 1, 1])
    + rr(8.5, 51, 3, 6) + rr(31, 51, 3, 6) + rpoly([[14, 31], [33, 31], [33, 37.5], [14, 37.5]], 1) + circ(33.2, 33.6, 3.4));
  // reader
  const head = circ(24, 15.2, 5.4);
  s += P('t-a', limb([[20.3, 24.5], [21, 37.5]], 9.5) + limb([[20.5, 38], [35, 37.2]], 8.4) + limb([[34.6, 37.2], [35.6, 54]], 6.4) + cap(34.6, 55.4, 39.2, 55.4, 4.2)
    + limb([[21.5, 25.5], [26.5, 33.5], [32.5, 28.6]], 4.6) + head);
  s += P('t-b', 'M18.8 15Q18.4 9 24 9.6Q29 9.8 29.4 13.8Q26 12 23.6 14.6Q22.6 17.4 21 19.4Q19 18.4 18.8 15Z' + circ(18.4, 11.4, 2.4));
  // open book, pages cut out of the cover
  const pg = 'M-7.2 -3.6Q-3.6 -5 -.6 -3.1V3.9Q-3.6 2.3 -7.6 3.4Z' + 'M7.2 -3.6Q3.6 -5 .6 -3.1V3.9Q3.6 2.3 7.6 3.4Z';
  const cov = 'M-8.4 -4.6Q-4 -6.6 0 -4.2Q4 -6.6 8.4 -4.6L9.2 4.6Q4 3.2 0 5.6Q-4 3.2 -9.2 4.6Z';
  s += `<g transform="translate(37.4 22.4) rotate(-14)">${P('t-b', cov + pg, ' fill-rule="evenodd"')}${P('t-c', pg)}${L('M-5.6 -1.6Q-3.4 -2.4 -2 -1.4M-5.8 .8Q-3.6 0 -2 1M5.6 -1.6Q3.4 -2.4 2 -1.4M5.8 .8Q3.6 0 2 1', .8)}</g>`;
  s += C('t-a', 33, 28.2, 2.4);
  // speech curls rising from the book
  s += L('M37 15Q35.4 10.6 38.6 8.2Q41.6 6.4 42.6 9.2Q43 11.4 40.6 11.2' + 'M43.6 15.8Q45.4 10.4 50.4 10.4Q54.4 10.8 53.6 14.2Q52.6 16.2 50.6 14.8' + 'M46.4 21.6Q51.4 19.4 55.4 22.4Q58.4 25.4 55.6 27.4Q53.4 28.2 53 26', 2);
  // child on the rug, hugging knees and facing the reader
  s += P('t-b', 'M38.5 58.6Q49 55.8 59.6 58.6Q49 60.8 38.5 58.6Z');
  s += P('t-a', limb([[53.6, 54.4], [53, 45.6]], 7.6) + limb([[54, 54.6], [46.8, 47.8]], 6) + limb([[46.8, 47.8], [46, 55.6]], 5) + cap(46.4, 56.4, 44, 56.4, 3.6)
    + limb([[52.4, 46.6], [47.6, 50.6]], 3.6) + circ(52.2, 39.8, 4.8));
  s += P('t-b', 'M48.2 37.6Q49.6 34.2 53.6 34.8Q57.6 35.8 57.2 40.4Q56.8 42.6 55.6 43.4Q55.4 39.8 52.8 38.8Q50.6 38 48.2 37.6Z');
  s += P('t-c', spark(8, 6, 2.8) + spark(58.5, 34, 2.4));
  add('storyteller', 'adult in an armchair reading aloud to a child on the floor', s);
}

// ---------- book-club-mugs
{
  let s = '';
  // three upright books
  const l2 = rr(25, 12.5, 6, 8.5), l3 = rr(35.4, 15.5, 5.6, 6.5);
  s += P('t-a', rpoly([[13, 13], [22.5, 13], [22.5, 40], [13, 40]], [1.2, 0, 0, .6]));
  s += P('t-b', rr(13, 17, 9.5, 2.2) + rr(13, 33.6, 9.5, 2.2) + rr(15.6, 22.6, 4.2, 7.6));
  s += P('t-b', rpoly([[22.5, 5], [33.5, 5], [33.5, 40], [22.5, 40]], [1.2, 1.2, 0, 0]) + l2, ' fill-rule="evenodd"');
  s += P('t-c', l2) + P('t-a', rr(22.5, 30.4, 11, 2) + rr(22.5, 34.2, 11, 1.2));
  s += P('t-a', rpoly([[33.5, 10.5], [43, 10.5], [43, 40], [33.5, 40]], [0, 1.2, .6, 0]) + l3, ' fill-rule="evenodd"');
  s += P('t-c', l3) + P('t-b', rr(33.5, 32.6, 9.5, 2.2) + rr(40.6, 10.5, 2.4, 29.5));
  // mugs with handles cut through
  const mug = (x, y, w, h) => {
    const hx = x + w, hy = y + h * .45;
    return [rpoly([[x, y], [x + w, y], [x + w - .6, y + h], [x + .6, y + h]], [.6, .6, 3, 3]) + `M${f(hx - .5)} ${f(hy - 5)}Q${f(hx + 5.6)} ${f(hy - 5)} ${f(hx + 5)} ${f(hy + .4)}Q${f(hx + 4.4)} ${f(hy + 5.4)} ${f(hx - 1)} ${f(hy + 5.4)}L${f(hx - .8)} ${f(hy + 2.8)}Q${f(hx + 2.2)} ${f(hy + 2.8)} ${f(hx + 2.4)} ${f(hy + .2)}Q${f(hx + 2.6)} ${f(hy - 2.4)} ${f(hx - .6)} ${f(hy - 2.4)}Z`,
      E('t-b', x + w / 2, y + .4, w / 2 - .6, 1.5), rr(x + .2, y + h * .5, w - .6, 2.4) + `M${f(x + w - 2.6)} ${f(y + 2)}H${f(x + w - .2)}L${f(x + w - .7)} ${f(y + h - 1.4)}Q${f(x + w - 1.2)} ${f(y + h)} ${f(x + w - 3)} ${f(y + h)}Z`];
  };
  const m1 = mug(5, 41.5, 11.5, 15.5), m2 = mug(45, 37.5, 11, 15);
  s += P('t-a', m1[0] + m2[0]) + m1[1] + m2[1] + P('t-b', m1[2] + m2[2]);
  s += L('M9 38Q7.2 35 9.2 32.2Q11 29.4 9.4 26.6M13 38.4Q11.4 35.6 13.2 33.2', 1.8);
  s += L('M48.6 34Q46.8 31 48.8 28.2Q50.6 25.4 49 22.6M52.6 34.4Q51 31.6 52.8 29.2Q54.4 27 53 24.4', 1.8);
  // plate with a slice of cake and a cherry
  s += P('t-c', 'M18.5 55.4A13.5 3 0 0 1 45.5 55.4A13.5 3 0 0 1 18.5 55.4Z');
  s += P('t-b', 'M18.5 55.4A13.5 3 0 0 0 45.5 55.4A13.5 4.6 0 0 1 18.5 55.4Z');
  s += P('t-a', 'M21.6 45.6L42.4 48.4V55.2H21.6Z');
  s += P('t-b', 'M21.6 49.4L42.4 51.4V53.2L21.6 51.4Z');
  s += P('t-c', 'M21.6 45.6L28.6 41.8L42.4 48.4Z');
  s += P('t-b', circ(27.6, 40.6, 2.3)) + L('M28 38.4Q29 35.6 31.4 35', 1.2);
  s += P('t-c', spark(6.5, 8, 3.4) + spark(56, 9, 3));
  add('book-club-mugs', 'three upright books with two steaming mugs and a slice of cake', s);
}

// ---------- glass-slipper
{
  let s = '';
  // thin low cushion
  s += P('t-b', 'M6.5 52.6Q32 48.6 57.5 52.6Q59 55.2 57.5 57.6Q32 60 6.5 57.6Q5 55.2 6.5 52.6Z');
  s += P('t-a', circ(6.2, 55.1, 1.6) + circ(57.8, 55.1, 1.6));
  // court shoe, side on, toe right: thin heel back left, arched sole, pointed toe
  const shoe = 'M12 51.2L15.2 51.2Q16 40.4 18.6 33.6Q31 36 39 48.6Q40.6 51.2 43.4 51.2L54 51.2Q59.4 50.8 59.8 48.6Q53.6 40.4 41.4 36Q25 27 9.8 21.4Q7.4 22.4 8 27Q8.8 31 10.6 34Q11.8 42 12 51.2Z';
  const fac = 'M45.6 40.2Q47.4 40.6 48.6 41.2L50.2 49.4Q49.4 49.6 48.6 49.2Z' + 'M52 43.4Q53.6 44.2 54.8 45.2L55.2 49.4Q54.6 49.6 54 49.4Z' + 'M20.4 31.2Q27.4 33.4 33.6 38.6Q32.6 39.2 31.6 38.8Q26 35 20.2 32.8Z';
  s += P('t-a', shoe + fac, ' fill-rule="evenodd"');
  s += P('t-c', fac);
  // open top: dark inside between the far rim and the near topline
  s += P('t-b', 'M9.8 21.4Q25 27 41.4 36Q26.4 37.2 11.4 26.6Q9.8 24.6 9.8 21.4Z');
  // underside of the arch and inner face of the heel
  s += P('t-b', 'M15.2 51.2Q16 40.4 18.6 33.6Q31 36 39 48.6Q40.6 51.2 43.4 51.2H41.6Q38.6 50.6 37 48Q30 38 19.6 35.6Q17.6 41 16.8 51.2Z');
  s += P('t-c', spark(50, 17, 4.6) + spark(27, 13, 3) + spark(8.5, 8.5, 2.6) + spark(58, 31, 2.2) + spark(38, 25, 1.8) + spark(25.5, 45.5, 2));
  add('glass-slipper', 'sparkling glass high-heeled slipper on a thin cushion', s);
}

// ---------- landmark-tower
{
  let s = '';
  // x on a quadratic edge, sampled by y
  const qx = (p0, p1, p2) => y => { let lo = 0, hi = 1; const Y = t => (1 - t) ** 2 * p0[1] + 2 * t * (1 - t) * p1[1] + t * t * p2[1];
    const up = Y(1) > Y(0); for (let i = 0; i < 30; i++) { const m = (lo + hi) / 2; if ((Y(m) < y) === up) lo = m; else hi = m; }
    const t = (lo + hi) / 2; return (1 - t) ** 2 * p0[0] + 2 * t * (1 - t) * p1[0] + t * t * p2[0]; };
  const oL = qx([8.6, 59.6], [17.6, 51], [20.4, 38.6]);
  const aL = qx([17.6, 59.6], [18, 47.4], [32, 46.4]);
  const tL = qx([21, 36.4], [25.6, 30], [27.2, 21.6]);
  const tower = 'M8.6 59.6Q17.6 51 20.4 38.6H16V35.6H21.2Q25.6 30 27.2 21.6H24.6V18.6H28.6L31 8.6H30.8V7H33.2V8.6H33L35.4 18.6H39.4V21.6H36.8Q38.4 30 42.8 35.6H48V38.6H43.6Q46.4 51 55.4 59.6H46.4Q46 47.4 32 46.4Q18 47.4 17.6 59.6Z';
  s += P('t-a', tower);
  // platforms' undersides and right-hand shade
  s += P('t-b', rr(16, 37.6, 32, 1.4) + rr(24.6, 20.6, 14.8, 1.4) + 'M32.4 8.6H33L35.4 18.6H34Z' + 'M40.4 30.4Q41.4 33.6 42.8 35.6H40.6Z');
  // lattice
  let lt = '';
  const zig = (fl, fr, y0, y1, n, ins = 1.2) => { let d = '', e = ''; for (let i = 0; i <= n; i++) { const y = y0 + (y1 - y0) * i / n, a = i % 2;
    d += (i ? 'L' : 'M') + f((a ? fr(y) - ins : fl(y) + ins)) + ' ' + f(y); e += (i ? 'L' : 'M') + f((a ? fl(y) + ins : fr(y) - ins)) + ' ' + f(y); } return d + e; };
  lt += zig(tL, y => 64 - tL(y), 23, 34.6, 4);
  lt += zig(oL, aL, 40, 57.4, 5, 1) + zig(y => 64 - aL(y), y => 64 - oL(y), 40, 57.4, 5, 1);
  lt += 'M22.4 40.6H41.6';
  s += L(lt, 1);
  s += L('M17 35.6V34.2H47V35.6M25.4 18.6V17.4H38.6V18.6', 1);
  // flag and clouds
  s += L('M32 7V4.8', 1.2);
  s += P('t-b', 'M32.4 4.6L38.6 6L32.4 7.6Z');
  const cloud = (x, y, k) => circ(x, y, 3.4 * k) + circ(x + 4.2 * k, y - 1.6 * k, 4 * k) + circ(x + 8.4 * k, y, 3.2 * k);
  s += P('t-c', cloud(7.4, 25, 1) + cloud(48.6, 31, .95) + rrc(7.4, 24.8, 8.4, 3.4) + rrc(48.6, 30.8, 8, 3.2));
  s += P('t-c', spark(9, 9, 3.4) + spark(53, 12, 2.8) + spark(57, 46, 2));
  add('landmark-tower', 'Eiffel-style lattice tower with a flag and clouds', s);
}

fs.writeFileSync(process.argv[2] || new URL('../../icons/part38.json', import.meta.url), JSON.stringify(icons, null, 1));
console.log(icons.map(i => `${i.id} ${i.svg.length}`).join('\n'));
