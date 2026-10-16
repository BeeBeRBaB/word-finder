// Generates part48.json (round 4).
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

// sampled-point helpers (for clipping)
const qpts = (a, c, b, n = 6) => Array.from({ length: n }, (_, i) => { const t = (i + 1) / n, u = 1 - t; return [u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]]; });
const rpts = (pts, rad, n = 4) => { const N = pts.length, out = [];
  for (let i = 0; i < N; i++) { const v = pts[i], a = pts[(i + N - 1) % N], b = pts[(i + 1) % N], r = Array.isArray(rad) ? rad[i] : rad;
    const la = Math.hypot(a[0] - v[0], a[1] - v[1]), lb = Math.hypot(b[0] - v[0], b[1] - v[1]);
    const ta = Math.min(r / la, .5), tb = Math.min(r / lb, .5);
    const p1 = [v[0] + (a[0] - v[0]) * ta, v[1] + (a[1] - v[1]) * ta], p2 = [v[0] + (b[0] - v[0]) * tb, v[1] + (b[1] - v[1]) * tb];
    out.push(p1, ...qpts(p1, v, p2, n)); }
  return out; };
const poly = pts => pts.map((p, i) => `${i ? 'L' : 'M'}${f(p[0])} ${f(p[1])}`).join('') + 'Z';
const area = pts => pts.reduce((s, p, i) => { const q = pts[(i + 1) % pts.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0) / 2;
const clip = (subj, cl) => { const sg = Math.sign(area(cl)); let out = subj;
  for (let i = 0; i < cl.length && out.length; i++) { const A = cl[i], B = cl[(i + 1) % cl.length], inp = out; out = [];
    const side = p => sg * ((B[0] - A[0]) * (p[1] - A[1]) - (B[1] - A[1]) * (p[0] - A[0])) >= 0;
    const X = (p, q) => { const a1 = B[1] - A[1], b1 = A[0] - B[0], c1 = a1 * A[0] + b1 * A[1], a2 = q[1] - p[1], b2 = p[0] - q[0], c2 = a2 * p[0] + b2 * p[1], d = a1 * b2 - a2 * b1; return [(c1 * b2 - c2 * b1) / d, (a1 * c2 - a2 * c1) / d]; };
    for (let j = 0; j < inp.length; j++) { const P1 = inp[j], Q = inp[(j + 1) % inp.length], ip = side(P1), iq = side(Q);
      if (iq) { if (!ip) out.push(X(P1, Q)); out.push(Q); } else if (ip) out.push(X(P1, Q)); } }
  return out; };
const rev = pts => pts.slice().reverse();

const icons = [];
const add = (id, motif, svg) => icons.push({ id, motif, svg });

// ---------- floating-castle
{ let s = '';
  // clouds
  const cloud = (x, y, k) => circ(x - 3 * k, y + .5 * k, 2.6 * k) + circ(x + .5 * k, y - 1 * k, 3.4 * k) + circ(x + 4 * k, y + .8 * k, 2.3 * k);
  s += P('t-c', cloud(9, 34, 1) + cloud(55.5, 31, .95) + cloud(53.5, 52.5, .85));
  s += R('t-c', 3.6, 34.8, 11.4, 3, 1.5) + R('t-c', 50.2, 31.6, 10.6, 2.8, 1.4) + R('t-c', 48.6, 52.8, 9.4, 2.6, 1.3);
  // rock underside
  s += P('t-b', rpoly([[8.5, 44], [55.5, 44], [49, 50.5], [41, 53], [34.5, 58.5], [29, 54.5], [21, 52.5], [14, 49.5]], [2, 2, 2, 2, 1.5, 2, 2, 2]));
  s += L('M22 47L26 49.5L25 51.5M37 47L35.5 50.5L38.5 52.5M45 47L47 49', 1.2);
  // roots
  s += L('M17 50Q16 52 17 53.5T17 57M23.5 52.5Q22.5 54.5 23.5 56T23 59.3M23.3 55.5L21.3 57M31.5 56Q30.8 57.5 31.8 59.3M40.5 53.5Q41.5 55 40.5 56.5T41 59.3M40.8 56L43 57.3M46.5 51Q47.5 52.5 46.5 54T47 56', 1.1);
  // grassy top
  s += P('t-a', rpoly([[6, 40.5], [58, 40.5], [55.5, 46], [8.5, 46]], 2.2));
  // castle with door and slit windows cut out
  const keep = rpoly([[26, 21], [38, 21], [38, 41.5], [26, 41.5]], .5);
  const wall = 'M20 30H22V27.5H25V30H27V41.5H20ZM37 30H39V27.5H42V30H44V41.5H37Z';
  const tl = rpoly([[12.5, 27], [20.5, 27], [20.5, 41.5], [12.5, 41.5]], .5), tr = rpoly([[43.5, 27], [51.5, 27], [51.5, 41.5], [43.5, 41.5]], .5);
  const door = 'M29 41V36Q29 32.5 32 32.5Q35 32.5 35 36V41Z';
  const win = (x, y) => `M${f(x - 1)} ${f(y + 4)}V${f(y + 1)}Q${f(x - 1)} ${f(y)} ${f(x)} ${f(y)}Q${f(x + 1)} ${f(y)} ${f(x + 1)} ${f(y + 1)}V${f(y + 4)}Z`;
  s += P('t-a', keep + door + win(32, 24.5), ' fill-rule="evenodd"');
  s += P('t-a', tl + win(16.5, 31) + tr + win(47.5, 31), ' fill-rule="evenodd"');
  s += P('t-a', wall);
  // pointed roofs
  s += P('t-b', rpoly([[24.5, 22], [32, 5.5], [39.5, 22]], [.8, .6, .8]) + rpoly([[11, 28], [16.5, 14], [22, 28]], [.8, .6, .8]) + rpoly([[42, 28], [47.5, 14], [53, 28]], [.8, .6, .8]));
  // flags
  s += L('M16.5 14.5V9M47.5 14.5V9', 1.2);
  s += P('t-a', 'M16.5 8.5L21.5 10.2L16.5 12ZM47.5 8.5L52.5 10.2L47.5 12Z');
  s += P('t-c', spark(7, 9, 3.2) + spark(57.5, 19, 2.4));
  add('floating-castle', 'fairy-tale castle on a floating rock island with hanging roots and clouds', s); }

// ---------- treasure-map
{ let s = '';
  s += P('t-a', 'M11 12Q21.5 8.5 32 12T53 12V52Q42.5 55.5 32 52T11 52Z');
  // compass rose
  s += P('t-b', poly(star(21, 21, 7.5, 1.7, 4)) + poly(star(21, 21, 4.2, 1.3, 4, -45)));
  s += L('M17 21A4 4 0 0 1 25 21A4 4 0 0 1 17 21', 1);
  // island with palm
  s += P('t-b', 'M14.5 46Q16 41.5 22 41.5Q29 41.5 31 46Q23 47.5 14.5 46Z');
  s += L('M22 42Q20.5 37 23 32', 1.8);
  s += P('t-b', 'M23 32Q18 29 15.5 32.5Q19 30.5 23 32.6Z' + 'M23 32Q27.5 28.5 30.5 32Q26.5 30.5 23 32.6Z' + 'M23 32Q20 26.5 16.5 27.5Q21 28 22.6 32.3Z' + 'M23 32Q26 26.5 29.5 27.5Q25 28 23.4 32.3Z');
  // dashed path
  const A = [31, 44], Cc = [46, 44], B = [43.5, 28]; let d = '';
  for (let i = 0; i < 6; i++) { const t0 = i / 6 + .02, t1 = t0 + .09; const pt = t => { const u = 1 - t; return [u * u * A[0] + 2 * u * t * Cc[0] + t * t * B[0], u * u * A[1] + 2 * u * t * Cc[1] + t * t * B[1]]; };
    const p = pt(t0), q = pt(t1); d += `M${f(p[0])} ${f(p[1])}L${f(q[0])} ${f(q[1])}`; }
  s += L(d, 1.8);
  // X
  s += P('t-b', cap(39, 16.5, 48.5, 26, 3.4));
  s += P('t-b', cap(48.5, 16.5, 39, 26, 3.4));
  // sea waves
  s += L('M36 48.5q1.5-1.5 3 0t3 0M15 15.5', 1.1);
  // curled rolls
  s += P('t-b', cap(9, 9, 9, 55, 7) + cap(55, 9, 55, 55, 7));
  s += P('t-a', circ(9, 9, 2.2) + circ(55, 9, 2.2));
  s += L('M10.5 14V51M53.5 14V51', 1);
  add('treasure-map', 'curled parchment treasure map with dashed path to an X, compass rose and palm island', s); }

// ---------- candlestick-phone
{ let s = '';
  // cord
  s += L('M18.5 45Q17 54 23 54.5Q27 55 28 51', 1.8);
  // stem and collars
  s += P('t-a', rpoly([[30.2, 17], [33.8, 17], [34.2, 48], [29.8, 48]], 1));
  s += R('t-b', 29, 26, 6, 2.6, 1) + R('t-b', 29.2, 40, 5.6, 2.4, 1);
  // base
  s += P('t-a', rpoly([[27.5, 46], [36.5, 46], [41, 52.5], [47, 55], [47, 58.5], [17, 58.5], [17, 55], [23, 52.5]], [2, 2, 3, 2, 1, 1, 2, 3]));
  s += P('t-b', rpoly([[17, 55.8], [47, 55.8], [47, 58.5], [17, 58.5]], 1));
  // mouthpiece (cone opening right)
  s += P('t-a', rpoly([[28.5, 12.5], [36, 13], [44.5, 6.5], [44.5, 22.5], [36, 17.8], [28.5, 18.5]], [2, 2, 1, 1, 2, 2]));
  s += E('t-b', 45, 14.5, 3, 8);
  s += E('t-a', 45.6, 14.5, 1.4, 5);
  // hook arm
  s += P('t-a', limb([[30.5, 21.5], [22, 21.5], [20, 18.5]], 2.4));
  // earpiece hanging from hook
  s += P('t-a', rpoly([[18.2, 21.5], [22.2, 21.5], [22.6, 33], [25.5, 39], [25.5, 46], [11.5, 46], [11.5, 39], [14.4, 33]], [1.5, 1.5, 2, 2, 1.2, 1.2, 2, 2]));
  s += P('t-b', rpoly([[11.5, 42.5], [25.5, 42.5], [25.5, 46], [11.5, 46]], [0, 0, 1.2, 1.2]));
  s += L('M18.5 24.5V33', 1.1);
  s += P('t-c', spark(55, 30, 3.4) + spark(8.5, 9, 2.6));
  add('candlestick-phone', 'antique candlestick telephone with earpiece hanging on its hook', s); }

// ---------- silk-bolts
{ let s = '';
  const dots = (x0, y0, x1, y1, step) => { let d = ''; for (let y = y0, r = 0; y <= y1; y += step, r++) for (let x = x0 + (r % 2) * step / 2; x <= x1; x += step) d += `M${f(x)} ${f(y - 1)}L${f(x + 1)} ${f(y)}L${f(x)} ${f(y + 1)}L${f(x - 1)} ${f(y)}Z`; return d; };
  // flowing ribbon from bottom roll
  const rib = 'M38 41.5C46 40 48 50 58.8 40.5L59.3 48C50 57 45 49 38 56Z';
  s += P('t-a', rib + dots(45.5, 48, 51.5, 48, 6) + dots(54.5, 45.5, 54.5, 45.5, 6) , ' fill-rule="evenodd"');
  s += P('t-b', 'M38 53.2C44 50 47.5 56 59.2 45.8L59.3 48C50 57 45 49 38 56Z');
  // bottom roll body
  s += P('t-a', rpoly([[12, 40], [40, 40], [41, 56], [12, 56]], [0, 1.5, 1.5, 0]) + dots(23, 44, 36, 52, 6), ' fill-rule="evenodd"');
  s += R('t-b', 25.5, 40, 2.5, 16) + R('t-b', 31.5, 40, 1.2, 16);
  // top roll body
  s += P('t-a', rpoly([[18, 24], [45, 24], [46, 40], [18, 40]], [0, 1.5, 1.5, 0]) + dots(29, 28, 42, 36, 6), ' fill-rule="evenodd"');
  s += R('t-b', 32, 24, 2.5, 16) + R('t-b', 38, 24, 1.2, 16);
  s += R('t-b', 18, 38.6, 28, 1.4);
  // roll ends with hollow core
  s += P('t-b', circ(12, 48, 8) + circ(12, 48, 2), ' fill-rule="evenodd"');
  s += P('t-b', circ(18, 32, 8) + circ(18, 32, 2), ' fill-rule="evenodd"');
  s += L('M12 52.5A4.5 4.5 0 1 1 16.5 48M18 36.5A4.5 4.5 0 1 1 22.5 32', 1.1);
  // lantern
  s += L('M53 4.8V9', 1.2);
  s += P('t-a', `M53 9.5C61 9.5 61 25.5 53 25.5C45 25.5 45 9.5 53 9.5Z`);
  s += R('t-b', 49.5, 8.5, 7, 2.6, 1) + R('t-b', 49.5, 24.2, 7, 2.6, 1);
  s += L('M53 10.5V24.5M50 11Q47.5 17.5 50 24M56 11Q58.5 17.5 56 24', 1);
  s += L('M53 27V32', 1.3);
  s += P('t-b', 'M51.8 31H54.2L54.8 35.5H51.2Z');
  s += P('t-c', spark(8, 10, 3.4) + spark(30, 13, 2.2));
  add('silk-bolts', 'rolls of patterned silk, one unrolling into a ribbon, with a paper lantern', s); }

// ---------- heraldic-shield
{ let s = '';
  const sh = [[15, 14], [49, 14], [49, 31], ...qpts([49, 31], [49, 47], [32, 57.5], 8), ...qpts([32, 57.5], [15, 47], [15, 31], 8)];
  const inside = (p, pg) => { let c = false; for (let i = 0, j = pg.length - 1; i < pg.length; j = i++) { const [xi, yi] = pg[i], [xj, yj] = pg[j]; if ((yi > p[1]) !== (yj > p[1]) && p[0] < (xj - xi) * (p[1] - yi) / (yj - yi) + xi) c = !c; } return c; };
  // lance behind: only the parts outside the shield (the lion hole must not show it)
  const L0 = [6.5, 57.5], L1 = [54, 10], at = t => [L0[0] + (L1[0] - L0[0]) * t, L0[1] + (L1[1] - L0[1]) * t];
  let ta = 0, tb = 1; while (!inside(at(ta + .005), sh)) ta += .005; while (!inside(at(tb - .005), sh)) tb -= .005;
  const pa = at(ta + .03), pb = at(tb - .03);
  s += P('t-b', cap(L0[0], L0[1], pa[0], pa[1], 3.2));
  s += P('t-b', cap(pb[0], pb[1], L1[0], L1[1], 3.2));
  s += P('t-b', rpoly([[9.5, 48], [17.5, 56], [13, 57], [8.5, 52.5]], .8));
  s += P('t-a', rpoly([[52, 9.5], [59.3, 4.7], [54.5, 12]], .4));
  // pennant
  s += P('t-a', rpoly([[52.8, 11.2], [49.4, 14.6], [36, 12.4], [40.5, 10.3], [36.5, 6]], [.4, .4, .4, .3, .4]));
  // quartered shield: t-a quarters (top-right, bottom-left) carry cut-out charges
  const q = (x0, y0, x1, y1) => clip(sh, [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]);
  const fx = 40.5, fl = [`M${f(fx)} 15.5Q${f(fx + 3.7)} 19.5 ${f(fx + 1.7)} 25.8H${f(fx - 1.7)}Q${f(fx - 3.7)} 19.5 ${f(fx)} 15.5Z`,
    rpoly([[fx - 5, 26.3], [fx + 5, 26.3], [fx + 5, 28.3], [fx - 5, 28.3]], .5),
    `M${f(fx - 1.6)} 28.8H${f(fx + 1.6)}L${f(fx + 3)} 31.2Q${f(fx)} 30.2 ${f(fx - 3)} 31.2Z`].join('');
  const pet = sg => { const X = x => f(fx + sg * x); return `M${X(-2.4)} 25.9Q${X(-7.2)} 26.4 ${X(-6.8)} 22Q${X(-6.4)} 18.8 ${X(-3.6)} 19.8Q${X(-5.6)} 21.5 ${X(-4.3)} 23.4Q${X(-3.4)} 24.9 ${X(-2.4)} 25Z`; };
  const cx = 25.5, crown = poly([[cx - 4.5, 45.5], [cx - 4.8, 38.8], [cx - 2.2, 41.6], [cx, 37.6], [cx + 2.2, 41.6], [cx + 4.8, 38.8], [cx + 4.5, 45.5]]) + circ(cx - 4.8, 37.4, 1) + circ(cx, 36.1, 1) + circ(cx + 4.8, 37.4, 1);
  s += P('t-b', poly(q(14, 13, 32, 33)) + poly(q(32, 33, 50, 59)));
  s += P('t-a', poly(q(32, 13, 50, 33)) + fl + pet(1) + pet(-1), ' fill-rule="evenodd"');
  s += P('t-a', poly(q(14, 33, 32, 59)) + crown, ' fill-rule="evenodd"');
  s += P('t-c', spark(8, 9, 3.4) + spark(57, 33, 2.4));
  add('heraldic-shield', 'quartered knight shield with fleur-de-lis and crown, lance and pennant behind', s); }

// ---------- bullet-train
{ let s = '';
  // speed lines
  s += P('t-b', cap(4.5, 27, 11, 27, 2.4) + cap(6.5, 33, 12, 33, 2.4) + cap(4.5, 39, 11, 39, 2.4));
  // rail
  s += L('M5 50.5H59.5', 1.6);
  // skirt / bogies
  s += P('t-b', rpoly([[17, 42], [52, 42], [51, 47], [18, 47]], 1.2));
  // body with window band and cockpit window cut out
  const body = 'M14.5 25Q14.5 21.5 18 21.5H34C45 21.5 53 28 59.5 37Q61 41 56.5 42.5L54 44H18Q14.5 44 14.5 40.5Z';
  const band = 'M18 26.5H40.5Q42 26.5 42 28V31Q42 32.5 40.5 32.5H18Q17 32.5 17 31.5V27.5Q17 26.5 18 26.5Z';
  const cock = 'M44.5 27.5Q48 28.5 51 32.5Q51.5 33.5 50.2 33.5H45.5Q44.5 33.5 44.5 32.5Z';
  s += P('t-a', body + band + cock, ' fill-rule="evenodd"');
  // livery stripe
  s += P('t-b', 'M14.5 36.5H44C50 36.5 54.5 37 58.8 37.6Q59.6 38.6 59.3 39.4C54 39.6 50 39.4 44 39.4H14.5Z');
  s += L('M25 26.5V32.5M33 26.5V32.5', 1);
  // pantograph
  s += L('M28 21.5L31.5 16.5H36', 1.2);
  s += P('t-c', spark(55, 13, 3.4) + spark(8, 10, 2.4));
  add('bullet-train', 'sleek bullet train side-on with long pointed nose and speed lines', s); }

fs.writeFileSync(process.argv[2] || new URL('../../icons/part48.json', import.meta.url), JSON.stringify(icons, null, 1));
console.log(icons.map(i => `${i.id} ${i.svg.length}`).join('\n'));
