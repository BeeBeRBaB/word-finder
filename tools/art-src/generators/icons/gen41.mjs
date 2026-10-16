// Generates part41.json (round 4).
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
const rad = a => a * Math.PI / 180;
const pol = (cx, cy, r, a) => [cx + r * Math.cos(rad(a)), cy + r * Math.sin(rad(a))];
// thick arc band between angles a0 -> a1 (degrees, increasing = clockwise on screen)
const arcBand = (cx, cy, r, w, a0, a1) => {
  const o0 = pol(cx, cy, r + w / 2, a0), o1 = pol(cx, cy, r + w / 2, a1), i1 = pol(cx, cy, r - w / 2, a1), i0 = pol(cx, cy, r - w / 2, a0);
  const lg = Math.abs(a1 - a0) > 180 ? 1 : 0;
  return `M${f(o0[0])} ${f(o0[1])}A${f(r + w / 2)} ${f(r + w / 2)} 0 ${lg} 1 ${f(o1[0])} ${f(o1[1])}L${f(i1[0])} ${f(i1[1])}A${f(r - w / 2)} ${f(r - w / 2)} 0 ${lg} 0 ${f(i0[0])} ${f(i0[1])}Z`;
};
const pts = a => 'M' + a.map(p => `${f(p[0])} ${f(p[1])}`).join('L') + 'Z';
// dashes along a polyline (array of points), returned as capsule subpaths
const dashes = (line, dash, gap, w) => {
  let d = '', segs = [];
  for (let i = 1; i < line.length; i++) segs.push([line[i - 1], line[i]]);
  let carry = 0, on = true, cur = null;
  for (const [p, q] of segs) {
    const L = Math.hypot(q[0] - p[0], q[1] - p[1]); let t = 0;
    while (t < L) {
      const need = (on ? dash : gap) - carry, step = Math.min(need, L - t);
      const a = [p[0] + (q[0] - p[0]) * t / L, p[1] + (q[1] - p[1]) * t / L];
      const b = [p[0] + (q[0] - p[0]) * (t + step) / L, p[1] + (q[1] - p[1]) * (t + step) / L];
      if (on) { if (!cur) cur = a; }
      t += step; carry += step;
      if (carry >= (on ? dash : gap) - 1e-6) { if (on) { d += bar(cur, b, w); cur = null; } on = !on; carry = 0; }
    }
  }
  return d;
};
const bar = (a, b, w) => { const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, nx = -(b[1] - a[1]) / l * w / 2, ny = (b[0] - a[0]) / l * w / 2;
  return pts([[a[0] + nx, a[1] + ny], [b[0] + nx, b[1] + ny], [b[0] - nx, b[1] - ny], [a[0] - nx, a[1] - ny]]); };
const arcPts = (cx, cy, r, a0, a1, n) => Array.from({ length: n + 1 }, (_, i) => pol(cx, cy, r, a0 + (a1 - a0) * i / n));

const icons = [];
const add = (id, motif, svg) => icons.push({ id, motif, svg });

// ---------- breathing-circle
{
  let s = '';
  const cx = 32, cy = 32;
  s += C('t-c', cx, cy, 21.5);
  s += `<circle class="ln" stroke-width="2.4" cx="${cx}" cy="${cy}" r="21.5"/>`;
  // IN arrow up the left side, OUT arrow down the right side
  const ar = 26.5, aw = 4;
  const head = (a, dir) => { const tip = pol(cx, cy, ar, a + dir * 11), b1 = pol(cx, cy, ar + 5.2, a), b2 = pol(cx, cy, ar - 5.2, a); return rpoly([tip, b1, b2], .8); };
  s += P('t-a', arcBand(cx, cy, ar, aw, 128, 222) + head(222, 1) + arcBand(cx, cy, ar, aw, -42, 52) + head(52, 1));
  // figure sitting cross-legged
  const hl = 'M28.9 16.2A3.9 3.9 0 0 1 31 13.6L31.4 14.6A2.8 2.8 0 0 0 29.9 16.5Z';
  s += P('t-a', circ(32, 17, 4.1) + hl, ' fill-rule="evenodd"');
  s += P('t-a', rpoly([[26, 23], [38, 23], [36.5, 41.5], [27.5, 41.5]], [3.5, 3.5, 2, 2]));
  s += R('t-a', 30.4, 19.8, 3.2, 4);
  s += P('t-a', limb([[27.5, 25], [22.6, 33], [21.4, 40.5]], 3.8) + limb([[36.5, 25], [41.4, 33], [42.6, 40.5]], 3.8));
  s += P('t-a', rpoly([[18.8, 44.5], [24, 40.2], [32, 39.6], [40, 40.2], [45.2, 44.5], [44, 47.6], [32, 48.2], [20, 47.6]], [2.5, 3, 2, 3, 2.5, 2, 2, 2]));
  s += P('t-b', 'M20.5 47.4Q32 49.6 43.5 47.4L44 47.6L32 48.4L20 47.6Z');
  s += L('M23.5 46.2Q32 42.5 40 41.2M40.5 46.2Q34 43.8 31 43', 1.3);
  s += P('t-b', 'M26.5 38.5Q32 40.5 37.5 38.5L37.2 41.5L27 41.5Z');
  s += C('t-a', 21.2, 41.6, 2.4) + C('t-a', 42.8, 41.6, 2.4);
  s += P('t-c', spark(6.5, 6.5, 3.2) + spark(57.5, 57, 3));
  add('breathing-circle', 'person sitting cross-legged in a circle with in and out breath arrows', s);
}

// ---------- comic-panels
{
  let s = '';
  // page with folded bottom-right corner
  const page = [[7, 5], [56, 5], [56, 47], [44, 59], [7, 59]];
  const pan = [
    [10, 8, 20.5, 14], // balloon
    [33, 8, 20, 25.5], // figure (tall)
    [10, 24.5, 20.5, 8.5], // sky / hills
    [10, 35.5, 14.5, 20.5], // small
    [27, 36, 26, 20], // wide, corner cut
  ];
  const holes = pan.map(([x, y, w, h], i) => {
    if (i === 4) return rpoly([[x, y], [x + w, y], [x + w, 46.5], [43.5 - 0, y + h], [x, y + h]], [1, 1, .5, .5, 1]);
    return rpoly([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], 1);
  }).join('');
  s += P('t-a', rpoly(page, [2, 2, 1, 1, 2]) + holes, ' fill-rule="evenodd"');
  s += P('t-c', holes);
  // panel 1: speech balloon with text lines
  s += P('t-a', 'M13.5 15A6.8 4.6 0 1 1 20.3 19.6L15.4 22L16.6 18.8A6.8 4.6 0 0 1 13.5 15Z');
  s += R('t-c', 15.8, 12.9, 9.4, 1.6, .8) + R('t-c', 16.8, 15.9, 7, 1.6, .8);
  // panel 2: waving figure
  s += P('t-a', circ(43, 16.5, 3.8) + rpoly([[37.5, 33.5], [38.5, 23.5], [47.5, 23.5], [48.5, 33.5]], [0, 3, 3, 0]) + limb([[47, 25], [50.5, 18.5], [50, 13]], 3));
  s += P('t-b', 'M41 21.6H45V23.8H41Z');
  // panel 3: sun and hills
  s += C('t-b', 25.5, 28, 2.4);
  s += P('t-a', 'M10 33L10 30.5Q14.5 26 19.5 30Q23.5 27.8 30.5 31.5L30.5 33Z');
  // panel 4: action star
  s += P('t-a', rpoly(star(17.2, 45.5, 6.3, 2.8, 6, -90), .4));
  s += L('M13 54L21.5 54', 1.4);
  // panel 5: second balloon and ground
  s += P('t-a', 'M30 44A6 4 0 1 1 36 48L32.5 51L33 47.4A6 4 0 0 1 30 44Z');
  s += C('t-c', 33.2, 44.2, 1) + C('t-c', 36, 44.2, 1) + C('t-c', 38.8, 44.2, 1);
  // turning corner flap
  s += P('t-b', 'M56 47L44 59Q46 51.5 46 49Q48.5 48.8 56 47Z');
  s += L('M56 47Q48.5 48.8 46 49Q46 51.5 44 59', 1.2);
  s += P('t-c', spark(59.5, 13, 2.8) + spark(59.5, 24, 1.8));
  add('comic-panels', 'comic page with panels, a speech balloon, a figure and a turning corner', s);
}

// ---------- cartoon-bomb
{
  let s = '';
  // BOOM burst behind
  const bp = star(17.5, 16.5, 13, 8.5, 9, -80);
  s += P('t-c', rpoly(bp, .6));
  // letters B O O M (small strokes)
  let lt = '';
  const lx = 8.6, ly = 12.5, h = 5.2;
  lt += `M${lx} ${ly}V${ly + h}H${lx + 2}Q${lx + 3.4} ${ly + h} ${lx + 3.4} ${ly + h * .75}Q${lx + 3.4} ${ly + h / 2} ${lx + 1.6} ${ly + h / 2}H${lx}M${lx} ${ly}H${lx + 1.8}Q${lx + 3} ${ly} ${lx + 3} ${ly + h / 4}Q${lx + 3} ${ly + h / 2} ${lx + 1.6} ${ly + h / 2}`;
  s += L(lt.replace(/(\d+\.\d{2,})/g, m => f(+m)), 1.3);
  s += `<ellipse class="ln" stroke-width="1.3" cx="15.6" cy="${f(ly + h / 2)}" rx="1.7" ry="2.6"/>`;
  s += `<ellipse class="ln" stroke-width="1.3" cx="20.3" cy="${f(ly + h / 2)}" rx="1.7" ry="2.6"/>`;
  s += L(`M23.6 ${f(ly + h)}V${ly}L25.4 ${f(ly + 3)}L27.2 ${ly}V${f(ly + h)}`, 1.3);
  // body
  const bx = 29, by = 39, br = 19.5;
  const shine = 'M17.5 33A13 13 0 0 1 25 24.5L26.2 27.3A10 10 0 0 0 20.4 34Z';
  const dot = circ(19, 38, 1.6);
  // neck cap
  const ang = -48, nc = pol(bx, by, br + 1.5, ang);
  const u = [Math.cos(rad(ang)), Math.sin(rad(ang))], v = [-u[1], u[0]];
  const q = (a, b) => [nc[0] + u[0] * a + v[0] * b, nc[1] + u[1] * a + v[1] * b];
  s += P('t-b', rpoly([q(-4, -5.5), q(4, -5.5), q(4, 5.5), q(-4, 5.5)], 1.2));
  s += P('t-a', circ(bx, by, br) + shine + dot, ' fill-rule="evenodd"');
  s += P('t-c', shine + dot);
  s += P('t-b', `M${f(bx + br)} ${f(by)}A${br} ${br} 0 0 1 ${f(bx - 9)} ${f(by + br - 2.2)}A24 24 0 0 1 ${f(bx + br)} ${f(by)}Z`);
  // cap band highlight
  s += L(`M${f(q(-1.5, -5.5)[0])} ${f(q(-1.5, -5.5)[1])}L${f(q(-1.5, 5.5)[0])} ${f(q(-1.5, 5.5)[1])}`, 1);
  // fuse
  const ft = q(4, 0);
  s += L(`M${f(ft[0])} ${f(ft[1])}Q${f(ft[0] + 1)} ${f(ft[1] - 7)} ${f(ft[0] + 6)} ${f(ft[1] - 7)}Q${f(ft[0] + 10)} ${f(ft[1] - 7)} 50.5 11`, 2.6);
  // spark
  s += P('t-a', rpoly(star(51.5, 10, 7.5, 3, 8, -90), .3));
  s += P('t-c', rpoly(star(51.5, 10, 3.6, 1.6, 8, -68), .2));
  s += L('M58.5 19L60.5 21M45 4L43.5 2.5M60 4.5L61.5 3', 1.3);
  s += P('t-c', spark(57, 33, 3) + spark(6.5, 55, 2.6));
  add('cartoon-bomb', 'round cartoon bomb with a sparking fuse and a BOOM star', s);
}

// ---------- couch-blanket
{
  let s = '';
  // sofa
  s += P('t-a', rpoly([[8, 19], [42, 19], [42, 41], [8, 41]], 5));
  s += P('t-b', 'M8.5 36H41.5V41H8.5Z');
  s += P('t-a', rpoly([[4, 30], [12.5, 30], [12.5, 51], [4, 51]], [4, 4, 1, 1]) + rpoly([[37.5, 30], [46, 30], [46, 51], [37.5, 51]], [4, 4, 1, 1]));
  // seat cushions
  s += P('t-a', rpoly([[11.5, 38], [39, 38], [39, 46.5], [11.5, 46.5]], 2));
  s += L('M25 38.5V46', 1.2);
  s += P('t-b', 'M5 47H45V51.5Q45 52.5 44 52.5H6Q5 52.5 5 51.5Z');
  s += R('t-b', 7, 52, 3, 3, .8) + R('t-b', 40, 52, 3, 3, .8);
  // cushion (cut out of back)
  const pil = h => { const k = rad(-10), rt = ([x, y]) => [18 + x * Math.cos(k) - y * Math.sin(k), 27.3 + x * Math.sin(k) + y * Math.cos(k)];
    const c = [[-h, -h], [h, -h], [h, h], [-h, h]].map(rt), m = [[0, -h * .62], [h * .62, 0], [0, h * .62], [-h * .62, 0]].map(rt);
    return `M${f(c[0][0])} ${f(c[0][1])}` + [1, 2, 3, 0].map((j, i) => `Q${f(m[i][0])} ${f(m[i][1])} ${f(c[j][0])} ${f(c[j][1])}`).join('') + 'Z'; };
  const cu = pil(5);
  s = s.replace(rpoly([[8, 19], [42, 19], [42, 41], [8, 41]], 5) + '"', rpoly([[8, 19], [42, 19], [42, 41], [8, 41]], 5) + pil(5.9) + '" fill-rule="evenodd"');
  s += P('t-c', cu);
  s += C('t-b', 18, 27.3, 1.1);
  // knitted blanket over the back, seat and right arm
  const bl = [[26.5, 17.5], [41, 19], [46.5, 25.5], [46, 50], [27, 50], [28, 34]];
  s += P('t-b', rpoly(bl, [3, 4, 3, 1, 1, 6]));
  let kn = '';
  for (let y = 23; y < 48; y += 5.5) {
    let r = `M28.7 ${f(y)}l`;
    for (let i = 0; i < 6; i++) r += i % 2 ? ' 2.6-1.7' : ' 2.6 1.7';
    r += 'v1.3l';
    for (let i = 5; i >= 0; i--) r += i % 2 ? '-2.6 1.7' : '-2.6-1.7';
    kn += r + 'Z';
  }
  s += P('t-a', kn);
  // fringe
  let fr = '';
  for (let x = 27.5; x < 43; x += 2.5) fr += `M${f(x)} 50V53.2`;
  s += L(fr, 1.2);
  // side table with mug and steam
  s += R('t-a', 48, 39.5, 12, 3, 1.2) + R('t-a', 52.6, 42, 2.8, 13) + R('t-a', 49, 54.5, 10, 2.5, 1.2);
  s += P('t-a', rpoly([[49.5, 30], [57, 30], [56.5, 39.5], [50, 39.5]], [1, 1, 2, 2]));
  s += `<path class="ln" stroke-width="1.8" d="M56.8 32.3Q60.5 32.5 59.8 35Q59.3 37 56.5 37"/>`;
  s += P('t-b', 'M50.2 33.5H56.6L56.5 35.5H50.3Z');
  s += L('M51.5 27Q50 24.5 51.5 22Q53 19.5 51.5 17M55 27Q53.5 24.5 55 22Q56.5 19.5 55 17', 1.4);
  // slippers
  const sl = x => `M${x} 59.5V57Q${x} 55 ${x + 3} 55Q${x + 9} 55.5 ${x + 10.5} 59.5Z`;
  s += P('t-a', sl(13) + sl(25.5));
  s += P('t-b', 'M14 56.4Q16.5 55.4 18.5 56.6L18 58Q16 57 14 57.6Z' + 'M26.5 56.4Q29 55.4 31 56.6L30.5 58Q28.5 57 26.5 57.6Z');
  s += P('t-c', spark(6.5, 9.5, 3.2) + spark(58.5, 8, 2.4));
  add('couch-blanket', 'cosy sofa with knitted blanket, cushion, steaming mug and slippers', s);
}

// ---------- dozing-chair (side-on, facing right)
{
  let s = '';
  // chair: back, far arm, seat, legs
  s += P('t-a', rpoly([[6.5, 12], [17, 8.5], [22.5, 47], [9.5, 50]], [5, 4, 2, 3]));
  s += P('t-a', rpoly([[16, 31], [44, 31], [44, 37.5], [18, 38]], [1, 3, 3, 1]) + circ(44, 34.5, 4.5));
  s += P('t-b', circ(44, 34.5, 2));
  s += P('t-a', rpoly([[12, 41.5], [46, 41.5], [47, 49], [11, 51]], [2, 2, 2, 2]));
  s += P('t-b', 'M11.3 48.5L46.8 47.2L47 49L11 51Z');
  s += P('t-b', limb([[14, 50], [12.5, 57]], 3) + limb([[43.5, 48.5], [45, 57]], 3));
  // sleeper (dark) with head tipped back
  s += P('t-b', circ(19.5, 16.5, 5) + circ(23.6, 12.6, 1.5));
  s += P('t-b', rpoly([[16.5, 22], [24, 21], [30.5, 41.5], [22, 44]], [3, 3, 2, 3]));
  s += P('t-b', cap(25.5, 41, 43, 38.5, 8.2) + cap(43.5, 39.5, 47.5, 54.5, 6) + cap(46, 55.8, 54, 56.4, 4.2));
  s += P('t-b', limb([[23, 25], [25.5, 35], [32, 37.5]], 4));
  // book face-down on lap
  s += P('t-a', rpoly([[26.5, 37.5], [35.5, 26.5], [46, 35], [44.8, 37], [35.5, 30.4], [28.2, 39.4]], [.6, 1.2, .6, .4, .5, .4]));
  s += P('t-a', 'M35.5 30.4L44.8 37L36 34.2Z');
  // Z z z
  const Z = (x, y, w) => { const t = w * .26; return `M${f(x)} ${f(y)}H${f(x + w)}V${f(y + t)}L${f(x + t * 1.5)} ${f(y + w - t)}H${f(x + w)}V${f(y + w)}H${f(x)}V${f(y + w - t)}L${f(x + w - t * 1.5)} ${f(y + t)}H${f(x)}Z`; };
  s += P('t-a', Z(27.5, 13, 6) + Z(36, 7.5, 7.5) + Z(46.5, 4, 9.5));
  s += P('t-c', spark(57, 25, 3) + spark(5.5, 57, 2.4));
  add('dozing-chair', 'person asleep in an armchair with a book on their lap and Zzz', s);
}

// ---------- green-screen
{
  let s = '';
  // stands and top bar
  s += R('t-b', 12, 4, 38, 2.8, 1.4);
  s += P('t-b', cap(16, 6, 16, 57, 2.4) + cap(46, 6, 46, 57, 2.4) + cap(11.5, 57.5, 20.5, 57.5, 2.6) + cap(41.5, 57.5, 50.5, 57.5, 2.6));
  // screen with dashed figure outline cut out
  const fig = [...arcPts(31, 14.5, 4.6, 95, 445, 24)];
  const body = [[22, 35], [22.5, 26], [25, 22.5], [37, 22.5], [39.5, 26], [40, 35]];
  const cut = dashes(fig, 2.2, 1.4, 1.6) + dashes(body, 3, 1.8, 1.6);
  s += P('t-a', rpoly([[13.5, 6.5], [48.5, 6.5], [48.5, 37], [13.5, 37]], [.6, .6, 1.5, 1.5]) + cut, ' fill-rule="evenodd"');
  s += P('t-b', 'M13.5 34.5H48.5V35.5Q48.5 37 47 37H15Q13.5 37 13.5 35.5Z');
  // camera on tripod, pointing right at the screen
  s += P('t-b', limb([[7, 43], [3.5, 58]], 2.2) + limb([[8, 43], [8, 58]], 2.2) + limb([[9, 43], [12.5, 58]], 2.2));
  s += P('t-a', rpoly([[3.5, 36], [13, 36], [13, 44], [3.5, 44]], 1.5) + rpoly([[12.5, 37.5], [16.5, 36], [16.5, 44], [12.5, 42.5]], .6));
  s += R('t-a', 5, 33.5, 5, 3, 1);
  s += P('t-b', 'M4.5 41.2H12.5V42.8Q12.5 43.4 12 43.4H5Q4.5 43.4 4.5 42.8Z');
  s += C('t-b', 7.3, 38.8, 1.3);
  // light on tripod at the right, aimed at the screen
  s += P('t-b', limb([[56, 30], [56, 50]], 2) + limb([[56, 49], [51.5, 58]], 2) + limb([[56, 49], [60.5, 58]], 2) + limb([[56, 49], [56, 58.5]], 2));
  s += P('t-a', rpoly([[50, 19], [58, 16.5], [60.5, 25], [52.5, 27.5]], 1.4) + rpoly([[50.5, 18.6], [45.5, 16.5], [47.5, 29.5], [52.5, 27.6]], .8));
  s += P('t-b', rpoly([[55.5, 26.5], [57, 26], [56.8, 31], [55.3, 31]], .3));
  s += L('M42 22.5L35.5 20M43 27L37 27.5', 1.2);
  s += P('t-c', spark(5.5, 7, 3.2) + spark(57, 7.5, 2.6));
  add('green-screen', 'film set with backdrop screen, light and camera on tripods', s);
}

fs.writeFileSync(process.argv[2] || new URL('../../icons/part41.json', import.meta.url), JSON.stringify(icons, null, 1));
console.log(icons.map(i => `${i.id} ${i.svg.length}`).join('\n'));
