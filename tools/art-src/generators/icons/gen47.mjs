// Generates part47.json (round 4: zen-stones, kite, herb-pots, baker, produce-crate, cold-frame).
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

const icons = [];
const add = (id, motif, svg) => icons.push({ id, motif, svg });
// extra helpers
const ell = (x, y, rx, ry) => `M${f(x - rx)} ${f(y)}a${f(rx)} ${f(ry)} 0 1 0 ${f(2 * rx)} 0a${f(rx)} ${f(ry)} 0 1 0 ${f(-2 * rx)} 0Z`;
const poly = pts => 'M' + pts.map(p => `${f(p[0])} ${f(p[1])}`).join('L') + 'Z';
const leaf = (bx, by, tx, ty, w) => { const mx = (bx + tx) / 2, my = (by + ty) / 2, l = Math.hypot(tx - bx, ty - by), nx = -(ty - by) / l * w, ny = (tx - bx) / l * w;
  return `M${f(bx)} ${f(by)}Q${f(mx + nx)} ${f(my + ny)} ${f(tx)} ${f(ty)}Q${f(mx - nx)} ${f(my - ny)} ${f(bx)} ${f(by)}Z`; };
const EO = ' fill-rule="evenodd"';
// tapered stadium: width w1 at (x1,y1), w2 at (x2,y2)
const taper = (x1, y1, x2, y2, w1, w2) => {
  const dx = x2 - x1, dy = y2 - y1, l = Math.hypot(dx, dy), ux = -dy / l, uy = dx / l, a = w1 / 2, b = w2 / 2;
  return `M${f(x1 + ux * a)} ${f(y1 + uy * a)}L${f(x2 + ux * b)} ${f(y2 + uy * b)}A${f(b)} ${f(b)} 0 0 0 ${f(x2 - ux * b)} ${f(y2 - uy * b)}L${f(x1 - ux * a)} ${f(y1 - uy * a)}A${f(a)} ${f(a)} 0 0 0 ${f(x1 + ux * a)} ${f(y1 + uy * a)}Z`;
};
const isect = (p, r, q, s) => { const cr = r[0] * s[1] - r[1] * s[0], t = ((q[0] - p[0]) * s[1] - (q[1] - p[1]) * s[0]) / cr; return [p[0] + r[0] * t, p[1] + r[1] * t]; };
// convex polygon with edge i (pts[i]->pts[i+1]) pushed inward by ds[i]
const inset = (pts, ds) => {
  const n = pts.length, c = [pts.reduce((a, p) => a + p[0], 0) / n, pts.reduce((a, p) => a + p[1], 0) / n];
  const ls = pts.map((a, i) => { const b = pts[(i + 1) % n], d = [b[0] - a[0], b[1] - a[1]], l = Math.hypot(...d); let m = [-d[1] / l, d[0] / l];
    if ((c[0] - a[0]) * m[0] + (c[1] - a[1]) * m[1] < 0) m = [-m[0], -m[1]]; return [[a[0] + m[0] * ds[i], a[1] + m[1] * ds[i]], d]; });
  return pts.map((_, i) => { const A = ls[(i + n - 1) % n], B = ls[i]; return isect(A[0], A[1], B[0], B[1]); });
};
const bez = (p0, p1, p2, p3, t) => { const u = 1 - t; return [0, 1].map(k => u * u * u * p0[k] + 3 * u * u * t * p1[k] + 3 * u * t * t * p2[k] + t * t * t * p3[k]); };
const bezd = (p0, p1, p2, p3, t) => { const u = 1 - t; return [0, 1].map(k => 3 * u * u * (p1[k] - p0[k]) + 6 * u * t * (p2[k] - p1[k]) + 3 * t * t * (p3[k] - p2[k])); };
const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

// ---------- zen-stones
{
  let s = '';
  const st = [[32, 44, 15.5, 6.8, 0], [31, 32.6, 12.5, 5.6, -4], [32.6, 22.6, 9.6, 4.8, 3], [31.4, 14.2, 6.6, 3.8, -3]];
  // ripple rings: front halves, plus back arcs where the bottom stone does not hide them
  const [sx, sy, srx, sry] = st[0];
  const inStone = (x, y) => ((x - sx) / (srx + 1.6)) ** 2 + ((y - sy) / (sry + 1.6)) ** 2 < 1;
  let rp = '';
  for (const [rx, ry] of [[19.5, 3.2], [24.5, 4.8], [29.5, 6.3]]) {
    const cx = 32, cy = 51, yu = x => cy - ry * Math.sqrt(Math.max(0, 1 - ((x - cx) / rx) ** 2));
    rp += `M${f(cx - rx)} ${f(cy)}A${f(rx)} ${f(ry)} 0 0 0 ${f(cx + rx)} ${f(cy)}`;
    let dx = 0; while (dx < rx && inStone(cx - dx, yu(cx - dx))) dx += .25;
    if (dx < rx - .5) rp += `M${f(cx - rx)} ${f(cy)}A${f(rx)} ${f(ry)} 0 0 1 ${f(cx - dx)} ${f(yu(cx - dx))}M${f(cx + dx)} ${f(yu(cx + dx))}A${f(rx)} ${f(ry)} 0 0 1 ${f(cx + rx)} ${f(cy)}`;
  }
  s += L(rp, 1.6);
  for (const [x, y, rx, ry, rot] of st) {
    const tr = rot ? ` transform="rotate(${rot} ${f(x)} ${f(y)})"` : '';
    const hl = leaf(x - rx * .66, y - ry * .05, x - rx * .12, y - ry * .62, ry * .34);
    s += P('t-a', ell(x, y, rx, ry) + hl, EO + tr);
    s += P('t-b', `M${f(x - rx)} ${f(y)}A${f(rx)} ${f(ry)} 0 0 0 ${f(x + rx)} ${f(y)}A${f(rx)} ${f(ry * .32)} 0 0 1 ${f(x - rx)} ${f(y)}Z`, tr);
    s += P('t-c', hl, tr);
  }
  // bamboo sprig
  s += L('M44.5 22.5Q46 20.5 48 19.2', 1.6);
  s += P('t-a', leaf(47.5, 19.5, 61, 5, 6.5) + leaf(48, 19.5, 60.5, 21.5, 4.6));
  s += L('M49 18.2Q55 12 59 7.2M50 19.6Q55 20.4 58.5 21.2', 1.1);
  s += P('t-c', spark(9, 9, 3.6) + spark(13, 26, 2.2));
  add('zen-stones', 'four balanced stones stacked in still water with ripples and a bamboo leaf', s);
}

// ---------- kite
{
  let s = '';
  const T = [25, 4.5], Rr = [46.5, 15], B = [30.5, 41], Lf = [10.5, 20.5];
  const X = isect(T, [B[0] - T[0], B[1] - T[1]], Lf, [Rr[0] - Lf[0], Rr[1] - Lf[1]]);
  // clouds
  const cloud = (x, y, w) => circ(x - w * .27, y + w * .02, w * .2) + circ(x + .02 * w, y - w * .1, w * .27) + circ(x + w * .3, y + w * .05, w * .17)
    + rpoly([[x - w * .47, y - w * .02], [x - w * .47, y + w * .22], [x + w * .47, y + w * .22], [x + w * .47, y - w * .02]], w * .12);
  s += P('t-c', cloud(53, 8, 15) + cloud(10.5, 45, 14));
  // string from the bridle down to the corner
  s += L(`M${f(X[0])} ${f(X[1])}Q50 27 59.5 59.5`, 1.4);
  // tail
  const s1 = [B, [23, 46], [36, 49.5], [28.5, 52.5]], s2 = [[28.5, 52.5], [21, 55.5], [29, 58], [21.5, 59]];
  s += L(`M${f(B[0])} ${f(B[1])}C23 46 36 49.5 28.5 52.5S29 58 21.5 59`, 1.4);
  // spars sit in the gaps between panels
  s += P('t-c', cap(T[0], T[1], B[0], B[1], 1.8) + cap(Lf[0], Lf[1], Rr[0], Rr[1], 1.8));
  const g = 1.2, pan = (a, b) => rpoly(inset([a, b, X], [0, g, g]), .9);
  s += P('t-a', pan(Rr, B) + pan(Lf, T));
  s += P('t-b', pan(T, Rr) + pan(B, Lf));
  // bows along the tail
  let bw = '', kn = '';
  for (const [seg, t] of [[s1, .5], [s2, .4], [s2, 1]]) {
    const p = bez(...seg, t), d = bezd(...seg, t), l = Math.hypot(...d), v = [d[0] / l, d[1] / l], u = [-v[1], v[0]];
    const q = (a, b) => [p[0] + u[0] * a + v[0] * b, p[1] + u[1] * a + v[1] * b];
    bw += rpoly([q(3.4, 2.1), q(3.4, -2.1), q(-3.4, 2.1), q(-3.4, -2.1)], .6);
    kn += circ(p[0], p[1], 1.2);
  }
  s += P('t-a', bw);
  s += P('t-b', kn);
  s += P('t-c', spark(6, 7, 3.4) + spark(44, 53, 2.6));
  add('kite', 'diamond kite with cross spars and bow tail among clouds', s);
}

// ---------- herb-pots
{
  let s = '';
  // window frame behind
  s += L('M6 49V6H58V49', 1.6);
  // basil: stem, paired broad leaves
  s += L('M13 35V17', 1.6);
  const bas = [[12.5, 30, 4, 25.5], [13.5, 30, 22, 25.5], [12.5, 23, 5.5, 17.5], [13.5, 23, 20.5, 17.5], [13, 19, 10.5, 10.5], [13, 19, 16, 11]];
  s += P('t-a', bas.map(([a, b, c, d], i) => leaf(a, b, c, d, i < 4 ? 7 : 5.6)).join(''));
  s += L(bas.map(([a, b, c, d]) => `M${f(a)} ${f(b)}l${f((c - a) * .75)} ${f((d - b) * .75)}`).join(''), 1.1);
  // rosemary: spiky stems, needles as Vs through the stem
  let ro = '', nd = '';
  for (const [bx, tx, ty] of [[30.5, 26.5, 13], [32, 32, 9], [33.5, 37.5, 13]]) {
    ro += `M${bx} 35L${tx} ${ty}`;
    const n = Math.round((35 - ty) / 3);
    for (let i = 1; i < n; i++) { const t = i / n, x = bx + (tx - bx) * t, y = 35 + (ty - 35) * t;
      nd += `M${f(x - 2.6)} ${f(y - 2)}l2.6 2l2.6 -2`; }
  }
  s += L(ro, 1.8) + L(nd, 1.3);
  // parsley: stems and scalloped round clumps
  s += L('M51 35L46 25M51 35V18M51 35L56.5 26', 1.6);
  const scal = (x, y, r, n) => { const pt = k => { const a = k / n * 2 * Math.PI - Math.PI / 2; return [x + r * Math.cos(a), y + r * Math.sin(a)]; };
    const br = r * Math.sin(Math.PI / n) * 1.25; let d = `M${f(pt(0)[0])} ${f(pt(0)[1])}`;
    for (let k = 1; k <= n; k++) { const p = pt(k); d += `A${f(br)} ${f(br)} 0 0 1 ${f(p[0])} ${f(p[1])}`; } return d + 'Z'; };
  let pa = '', pc = '';
  for (const [x, y, r] of [[46.3, 22.5, 4.5], [51.5, 16.6, 4.6], [56.2, 23, 4.3]]) {
    pa += scal(x, y, r, 9);
    pc += `M${f(x - 1.6)} ${f(y + .4)}a1.3 1.3 0 1 1 1.8 1.4M${f(x + .6)} ${f(y - 1.8)}a1.2 1.2 0 1 1 1.6 1.3`;
  }
  s += P('t-a', pa);
  s += L(pc, 1);
  // pots: terracotta body with a cut-out label, rim on top
  let body = '', lab = '', wr = '';
  for (const cx of [13, 32, 51]) {
    const lb = `M${f(cx - 3.4)} 40.6h6.8v5.2h-6.8Z`;
    body += `M${f(cx - 6.6)} 38h13.2l-1.6 11h-10Z` + lb;
    lab += lb; wr += `M${f(cx - 2)} 42.6h4M${f(cx - 2)} 44.2h2.8`;
    s += R('t-a', cx - 8.2, 33.4, 16.4, 4.6, 1.2);
  }
  s += P('t-b', body, EO);
  s += P('t-c', lab);
  s += L(wr, .9);
  // windowsill
  s += R('t-a', 3, 49, 58, 3.6, 1.2);
  s += R('t-b', 4, 52.6, 56, 3.8, 1);
  s += P('t-c', spark(23, 9, 2.6) + spark(42, 8.5, 2.2));
  add('herb-pots', 'three terracotta herb pots with labels on a windowsill', s);
}

// ---------- baker
{
  let s = '';
  // body (chef jacket) and arms
  s += P('t-a', rpoly([[13, 33], [31, 33], [36.5, 38.5], [37.5, 61], [6.5, 61], [7.5, 38.5]], [3, 3, 4, 0, 0, 4])
    + limb([[8.5, 38.5], [5.5, 50], [6.5, 55.5]], 6) + circ(6.8, 57.2, 3)
    + limb([[33.5, 38], [44, 45], [50, 32]], 6) + circ(50, 30, 3.4));
  s += L('M10.2 41.5L9.4 54M45 39.5l2.5 2.5', 1.2);
  // apron with pocket cut out, straps
  s += P('t-b', 'M15 39h14v7.5l4.5 1.5l1 13.5h-25l1-13.5l4.5-1.5ZM16.5 50h10v5.5h-10Z', EO);
  s += P('t-b', cap(16, 39.5, 17.6, 33.6, 2.2) + cap(28, 39.5, 26.4, 33.6, 2.2));
  // head and ears
  s += P('t-a', circ(22, 25, 6.5) + circ(15.4, 25.6, 1.7) + circ(28.6, 25.6, 1.7));
  // neckerchief, eyes, moustache
  s += P('t-b', rpoly([[16.5, 31.2], [27.5, 31.2], [22, 37]], 1.2) + circ(19.5, 24.2, 1) + circ(24.5, 24.2, 1)
    + 'M22 27.4Q19.2 26.2 17.6 28.6Q20 29.8 22 28.6Q24 29.8 26.4 28.6Q24.8 26.2 22 27.4Z');
  // chef's hat with band and pleats
  s += P('t-c', circ(17.4, 11.6, 4.6) + circ(22, 8.4, 5.6) + circ(26.6, 11.6, 4.6) + 'M15.3 11v7.5h13.4V11Z');
  s += R('t-b', 15.3, 14.2, 13.4, 1.4);
  s += L('M19 14V9.8M22 14V6.6M25 14V9.8', 1.1);
  // tray of three loaves with cut-out scoring
  let lv = '', sl = '';
  for (const [x, w, h] of [[40.6, 4.1, 7], [49.2, 4.3, 9.4], [57.5, 4, 7]]) {
    lv += `M${f(x - w)} 25A${f(w)} ${f(h)} 0 0 1 ${f(x + w)} 25Z`;
    for (const k of h > 8 ? [-.55, -.15, .25] : [-.5, -.05]) {
      const yy = 25 - h * (.5 + k * .1), sh = leaf(x - 1.6, yy + h * .12 + k * 2, x + 1.6, yy - h * .12 + k * 2, 1.4);
      lv += sh; sl += sh;
    }
  }
  s += P('t-a', lv, EO);
  s += P('t-c', sl);
  s += P('t-b', 'M36.5 25h24q1 0 .8 1l-.4 1.6q-.2 1-1.2 1h-22.4q-1 0-1.2-1l-.4-1.6q-.2-1 .8-1Z');
  // steam
  s += L('M42 15.5q-1.5-2 0-4t0-4M49.2 12.5q-1.6-2.2 0-4.3t0-4.2M56.5 15.5q-1.5-2 0-4t0-4', 1.3);
  s += P('t-c', spark(6, 8, 3.2) + spark(54, 53, 3));
  add('baker', 'baker in a tall chef hat and apron holding out a tray of loaves', s);
}

// ---------- produce-crate
{
  let s = '';
  // carrot tops
  const car = [[12.5, 16, 3.5, 31, 5], [17, 18.5, 8, 34, 5]];
  let ct = '';
  for (const [x, y] of car) ct += leaf(x, y, x - 3.5, y - 11, 2.6) + leaf(x, y, x + 1.5, y - 12.5, 2.6) + leaf(x, y, x + 6, y - 9.5, 2.6);
  // leek: pale stalk, dark leaves
  s += P('t-c', cap(41.5, 36, 48.5, 16.5, 6.6));
  s += L('M43 30l4.2-11.5M40.4 29l4-11', 1);
  s += P('t-b', leaf(48.2, 18.5, 43, 4.5, 4.6) + leaf(48.8, 18, 52.5, 3.8, 4.6) + leaf(49.5, 19.5, 60, 10.5, 4.4));
  // carrots with ridge marks
  let cr = '', rl = '';
  for (const [x, y, tx, ty, w] of car) {
    cr += taper(x, y, tx, ty, w, 1);
    const dx = tx - x, dy = ty - y, l = Math.hypot(dx, dy), ux = -dy / l, uy = dx / l;
    for (const t of [.3, .55]) { const px = x + dx * t, py = y + dy * t, hw = w * (1 - t * .8) / 2;
      rl += `M${f(px + ux * hw * .9)} ${f(py + uy * hw * .9)}L${f(px)} ${f(py)}`; }
  }
  s += P('t-a', cr);
  s += L(rl, 1.1);
  s += P('t-b', ct);
  // apples (same relative outline each), shade crescents, stems, two leaves
  const ap = [[23.2, 21.6], [34.8, 21.6], [17.5, 31], [29, 31], [40.5, 31]];
  const apple = 'c2.8-3.4 6.2-.3 5.6 3.6c-.3 3.9-3.4 5.3-5.6 4.2c-2.2 1.1-5.3-.3-5.6-4.2c-.6-3.9 2.8-7 5.6-3.6Z';
  const shade = 'q3.4 4.2-2.5 7.3q3.6-3.4 2.5-7.3Z';
  s += P('t-a', ap.map(([x, y]) => `M${f(x)} ${f(y - 3.1)}${apple}`).join(''));
  s += P('t-b', ap.map(([x, y]) => `M${f(x + 3.1)} ${f(y - 2.5)}${shade}`).join('') + leaf(24.6, 15.3, 28.4, 13.6, 2) + leaf(36.2, 15.3, 40, 13.6, 2));
  s += L(ap.map(([x, y]) => `M${f(x)} ${f(y - 2.8)}q.2-2.2 1.2-3.6`).join(''), 1.3);
  // crate: planks, rail, posts
  s += P('t-a', 'M6 38h44v9.4h-44ZM6 49h44v7.8q0 1.2-1.2 1.2h-41.6q-1.2 0-1.2-1.2Z');
  s += L('M14 43h10M30 53.5h10', 1);
  s += P('t-b', rpoly([[5, 35.5], [51, 35.5], [51, 39], [5, 39]], 1) + 'M6 38h4.6v20h-3.4q-1.2 0-1.2-1.2ZM45.4 38h4.6v18.8q0 1.2-1.2 1.2h-3.4Z');
  // price tag on a string, grommet cut out
  const a = 14 * Math.PI / 180, rot = ([x, y]) => [56.3 + x * Math.cos(a) - y * Math.sin(a), 50 + x * Math.sin(a) + y * Math.cos(a)];
  const [hx, hy] = rot([0, -4.6]), w = [[-2, 0], [2, 0], [-2, 2.8], [1, 2.8]].map(rot);
  s += L('M50.6 37.4Q54.5 38 56 42', 1.2);
  s += P('t-c', rpoly([[0, -8.4], [4, -5], [4, 7], [-4, 7], [-4, -5]].map(rot), [1, .8, 1, 1, .8]) + circ(hx, hy, 1.2), EO);
  s += L(`M${f(w[0][0])} ${f(w[0][1])}L${f(w[1][0])} ${f(w[1][1])}M${f(w[2][0])} ${f(w[2][1])}L${f(w[3][0])} ${f(w[3][1])}`, 1.1);
  s += P('t-c', spark(29.5, 8, 3.2) + spark(57, 26, 2.2));
  add('produce-crate', 'wooden crate of apples, carrots and a leek with a price tag', s);
}

// ---------- cold-frame
{
  let s = '';
  const A = [5, 31], Bn = [42, 40], O = [10, -7.5], ang = 36 * Math.PI / 180;
  const add2 = (p, q, k = 1) => [p[0] + q[0] * k, p[1] + q[1] * k];
  const A2 = add2(A, O), B2 = add2(Bn, O);
  const vx = Bn[0] - A[0], vy = Bn[1] - A[1];
  const Bo = [A[0] + vx * Math.cos(ang) + vy * Math.sin(ang), A[1] - vx * Math.sin(ang) + vy * Math.cos(ang)], Bo2 = add2(Bo, O);
  const edgeY = x => A[1] + (x - A[0]) * vy / vx;
  // far top edge of the box
  s += L(`M${f(A2[0])} ${f(A2[1])}L${f(B2[0])} ${f(B2[1])}`, 1.4);
  // seedlings: back row (smaller, base visible) then front row (base behind the wall)
  let sd = '', sl = '';
  const sprout = (x, base, top, k) => { sd += leaf(x, top, x - 3.2 * k, top - 1.8 * k, 2.4 * k) + leaf(x, top, x + 3.2 * k, top - 1.8 * k, 2.4 * k);
    sl += `M${f(x)} ${f(base)}L${f(x)} ${f(top)}`; };
  for (const x of [26, 33, 40]) { const b = (x < Bn[0] ? edgeY(x) : 40) - 2.4; sprout(x, b, b - 3.8, .85); }
  for (const x of [22, 29, 36]) { const b = edgeY(x) + .6; sprout(x, b, b - 5.4, 1); }
  s += L(sl, 1.3);
  s += P('t-a', sd);
  // box: near side with plank gaps, end face
  s += P('t-a', poly([A, Bn, [Bn[0], 56], [A[0], 56]]) + cap(7.5, 47.4, 40, 47.4, 1.3) + cap(7.5, 39.6, 30, 39.6, 1.3), EO);
  s += P('t-b', poly([Bn, B2, [B2[0], 56 + O[1]], [Bn[0], 56]]));
  // lid: frame with glass panes, and its edge thickness
  const pt = (u, v) => [A[0] + (Bo[0] - A[0]) * u + O[0] * v, A[1] + (Bo[1] - A[1]) * u + O[1] * v];
  const panes = [[.06, .33], [.37, .64], [.68, .95]].map(([u0, u1]) => poly([pt(u0, .2), pt(u1, .2), pt(u1, .8), pt(u0, .8)]));
  s += P('t-b', poly([A, Bo, [Bo[0], Bo[1] + 2.2], [A[0], A[1] + 2.2]]));
  s += P('t-a', poly([A, Bo, Bo2, A2]) + panes.join(''), EO);
  s += P('t-c', panes.join(''));
  let gl = '';
  for (const u of [.12, .43, .74]) { const p = pt(u, .3), q = pt(u + .12, .7); gl += `M${f(p[0])} ${f(p[1])}L${f(q[0])} ${f(q[1])}`; }
  s += L(gl, 1);
  // prop stick
  const m1 = lerp(Bn, B2, .5), m2 = lerp(Bo, Bo2, .5);
  s += P('t-b', cap(m1[0], m1[1] + .5, m2[0], m2[1], 2.2));
  // trowel stuck in the ground beside it
  const tr = ' transform="rotate(10 58.5 49)"';
  s += P('t-b', cap(58.5, 36.5, 58.5, 44, 4.2) + cap(58.5, 44, 58.5, 47.4, 1.6), tr);
  s += P('t-a', rpoly([[54.6, 48], [62.4, 48], [61.4, 55], [58.5, 61], [55.6, 55]], [1.2, 1.2, 2, .8, 2]), tr);
  s += L('M58.5 50V57', 1.1).replace('/>', tr + '/>');
  s += P('t-c', spark(9, 10, 3.4) + spark(28, 7.5, 2.2));
  add('cold-frame', 'low wooden cold frame with glass lid propped open over seedlings, trowel beside', s);
}

fs.writeFileSync(process.argv[2] || new URL('../../icons/part47.json', import.meta.url), JSON.stringify(icons, null, 1));
console.log(icons.map(i => `${i.id} ${i.svg.length}`).join('\n'));
