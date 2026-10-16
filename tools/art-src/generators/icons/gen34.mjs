// Generates part34.json (round 4).
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

const pt = p => `${f(p[0])} ${f(p[1])}`;
const poly = v => 'M' + v.map(pt).join('L') + 'Z';
const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const rect = (x, y, w, h) => `M${f(x)} ${f(y)}h${f(w)}v${f(h)}h${f(-w)}Z`;
const rrect = (x, y, w, h, r) => rpoly([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], r);

const icons = [];
const add = (id, motif, svg) => icons.push({ id, motif, svg });

// ---------- calendar
{
  let s = '';
  const kx = 50.5, ky = 50.5, kr = 9.6;
  // page body with day squares cut out, minus a round bite where the clock sits
  let cells = '';
  const cw = 6.4, ch = 5.2, gx = 2.1, gy = 2.2, x0 = 11.4, y0 = 24.6;
  let circled = null;
  for (let r = 0; r < 4; r++) for (let c = 0; c < 5; c++) {
    const x = x0 + c * (cw + gx), y = y0 + r * (ch + gy);
    const nx = Math.max(x, Math.min(kx, x + cw)), ny = Math.max(y, Math.min(ky, y + ch));
    if (Math.hypot(nx - kx, ny - ky) < kr + 2.6) continue;
    cells += rect(x, y, cw, ch);
    if (r === 1 && c === 2) circled = [x + cw / 2, y + ch / 2];
  }
  const page = rrect(8, 18, 48, 40, 3);
  const bite = circ(kx, ky, kr + 1.8);
  s += P('t-a', page + cells + bite, ' fill-rule="evenodd"');
  // bottom edge shade (stops before the bite)
  s += P('t-b', 'M8.2 53.5H39.5Q40 55.5 41.1 58H11Q8.2 58 8.2 55Z');
  // header bar with two ring holes
  s += P('t-b', rpoly([[8, 10], [56, 10], [56, 21], [8, 21]], [3, 3, 0, 0]) + circ(22, 14.5, 1.9) + circ(42, 14.5, 1.9), ' fill-rule="evenodd"');
  // binder rings
  s += P('t-a', cap(22, 4.6, 22, 13.5, 4.4) + cap(42, 4.6, 42, 13.5, 4.4));
  s += P('t-b', cap(22, 7, 22, 11, 1.3) + cap(42, 7, 42, 11, 1.3));
  // circled day
  s += L(circ(circled[0], circled[1], 5.6), 2.2);
  // clock
  s += P('t-b', circ(kx, ky, kr) + circ(kx, ky, kr - 2.3), ' fill-rule="evenodd"');
  s += P('t-c', circ(kx, ky, kr - 2.3));
  s += L(`M${kx} ${ky - 4.6}V${ky}L${f(kx + 3.4)} ${f(ky + 1.6)}`, 1.8);
  s += P('t-b', circ(kx, ky, 1.2) + circ(kx + 5.3, ky, .7) + circ(kx - 5.3, ky, .7) + circ(kx, ky + 5.3, .7));
  s += P('t-b', cap(kx - 5.5, ky - 9.5, kx - 3.5, ky - 8.3, 2.4) + cap(kx + 5.5, ky - 9.5, kx + 3.5, ky - 8.3, 2.4));
  s += P('t-c', spark(5, 6.5, 3.2) + spark(59, 6.5, 2.8));
  add('calendar', 'wall calendar page with a circled day and a little clock', s);
}

// ---------- prism
{
  let s = '';
  const A = [27, 6.5], B = [5.5, 49.5], Cc = [48.5, 49.5];
  const E1 = lerp(A, B, .5), E2 = lerp(A, B, .585), X1 = lerp(A, Cc, .44), X2 = lerp(A, Cc, .63);
  const inner = poly([E1, X1, X2, E2]);
  const sh = [lerp(A, B, .17), lerp(A, B, .4)].map(p => [p[0] + 3.4, p[1] + 1.6]);
  const shine = cap(sh[0][0], sh[0][1], sh[1][0], sh[1][1], 2.6);
  // base slab
  s += P('t-b', rpoly([[6.5, 47], [47.5, 47], [50.5, 53.5], [9.5, 53.5]], 1.6));
  // glass body
  s += P('t-a', rpoly([A, Cc, B], 3) + inner + shine, ' fill-rule="evenodd"');
  // shaded right facet below the exit
  s += P('t-c', inner + shine);
  // incoming white beam
  s += P('t-c', poly([[2.5, 37.2], [E1[0] - .2, E1[1] - .2], [E2[0] - .2, E2[1] + .1], [2.5, 41.2]]));
  // outgoing fan
  const K = ['t-c', 't-a', 't-b', 't-a'];
  const by = { 't-a': '', 't-b': '', 't-c': '' };
  const nx = 1.9, ny = -.9;
  for (let i = 0; i < 4; i++) {
    const p = lerp(X1, X2, i / 4), q = lerp(X1, X2, (i + 1) / 4), ya = 21.5 + i * 9.1;
    by[K[i]] += poly([[p[0] + nx, p[1] + ny + (i ? .25 : 0)], [60.8, ya], [60.8, ya + 7.6], [q[0] + nx, q[1] + ny - (i < 3 ? .25 : 0)]]);
  }
  s += P('t-a', by['t-a']) + P('t-b', by['t-b']) + P('t-c', by['t-c']);
  s += P('t-c', spark(8, 9, 3.8) + spark(52, 8.5, 3) + circ(15, 59.5, 1.1));
  add('prism', 'glass prism splitting a white beam into a fan of colours', s);
}

// ---------- pulley
{
  let s = '';
  const cx = 32, cy = 28.2, R0 = 10.4;
  // ceiling bracket
  s += P('t-b', rrect(12, 3.5, 40, 5, 1.5) + poly([[24, 8], [40, 8], [36, 11.5], [28, 11.5]]));
  // hook
  s += L('M29.4 11V14Q29.4 17 32 17Q34.6 17 34.6 14.4', 2.4);
  // wheel with spoke holes
  let holes = '';
  for (const a of [45, 135, 225, 315]) { const r = a * Math.PI / 180; holes += circ(cx + 5.6 * Math.cos(r), cy + 5.6 * Math.sin(r), 2.1); }
  s += P('t-a', circ(cx, cy, R0) + holes, ' fill-rule="evenodd"');
  s += P('t-b', `M${f(cx + R0)} ${cy}A${R0} ${R0} 0 0 1 ${cx} ${f(cy + R0)}A${R0 + 3} ${R0 + 3} 0 0 0 ${f(cx + R0)} ${cy}Z`);
  // rope over the wheel and down both sides
  const rr = R0 - 1.4;
  s += L(`M${f(cx - rr)} 44V${cy}A${rr} ${rr} 0 0 1 ${f(cx + rr)} ${cy}V46`, 2.6);
  // strap / cheek plate with shackle ring on the hook
  s += P('t-b', circ(32, 18.2, 2.9) + circ(32, 18.2, 1.3) + rpoly([[30, 20.6], [34, 20.6], [35, 34.5], [29, 34.5]], 1.5), ' fill-rule="evenodd"');
  s += P('t-a', circ(32, cy, 2.4) + circ(32, cy, 1), ' fill-rule="evenodd"');
  // crate sling
  const lx = cx - rr;
  s += L(`M${f(lx - 8)} 41.5L${f(lx)} 44L${f(lx + 8)} 41.5`, 1.6);
  s += P('t-b', cap(lx, 42.5, lx, 45.5, 3));
  // crate: frame + planks + brace
  const cX = lx - 11.5, cY = 40.5, cW = 23, cH = 19;
  s += P('t-a', rrect(cX, cY, cW, cH, 1.6) + rect(cX + 2.8, cY + 2.8, cW - 5.6, cH - 5.6) + rect(cX + 3.6, cY + 3.6, cW - 7.2, cH - 7.2), ' fill-rule="evenodd"');
  const bx1 = cX + 3.6, by1 = cY + 3.6, bx2 = cX + cW - 3.6, by2 = cY + cH - 3.6;
  s += P('t-b', poly([[bx1, by2], [bx1, by2 - 3.2], [bx2 - 3.6, by1], [bx2, by1], [bx2, by1 + 3.2], [bx1 + 3.6, by2]]));
  s += L(`M${f(bx1)} ${f(cY + cH / 3 + 1.2)}H${f(bx2)}M${f(bx1)} ${f(cY + cH * 2 / 3 - 1.2)}H${f(bx2)}`, 1);
  s += P('t-b', rrect(cX, cY + cH - 2.4, cW, 2.4, 1));
  // pull loop
  const px = cx + rr;
  s += P('t-b', cap(px, 45.5, px, 49, 3.4));
  s += L(`M${f(px)} 49Q${f(px - 6.5)} 53 ${f(px - 4.5)} 57.5Q${f(px)} 61 ${f(px + 4.5)} 57.5Q${f(px + 6.5)} 53 ${f(px)} 49Z`, 2.6);
  s += P('t-a', cap(px - 3.4, 57.6, px + 3.4, 57.6, 3.6));
  s += P('t-c', spark(6.5, 15, 3.6) + spark(57, 16, 3) + circ(57, 34, 1.1));
  add('pulley', 'pulley wheel on a hook lifting a crate by rope', s);
}

// ---------- sound-waves
{
  let s = '';
  const ox = 22, oy = 29;
  // arc band with round ends
  const band = (r, w, a0, a1) => {
    const ro = r + w / 2, ri = r - w / 2, d = Math.PI / 180, P1 = (rad, a) => [ox + rad * Math.cos(a * d), oy + rad * Math.sin(a * d)];
    return `M${pt(P1(ro, a0))}A${f(ro)} ${f(ro)} 0 0 1 ${pt(P1(ro, a1))}A${f(w / 2)} ${f(w / 2)} 0 0 1 ${pt(P1(ri, a1))}A${f(ri)} ${f(ri)} 0 0 0 ${pt(P1(ri, a0))}A${f(w / 2)} ${f(w / 2)} 0 0 1 ${pt(P1(ro, a0))}Z`;
  };
  s += P('t-a', band(11.5, 4.4, -42, 42) + band(20, 4.4, -42, 42) + band(28.5, 4.2, -41, 41) + band(36.5, 3.8, -38, 38));
  // magnet box
  s += P('t-b', rrect(3.5, 21, 8.5, 16, 2));
  // cone with shine cut out
  const shine = cap(13.6, 25, 18.4, 18.5, 2);
  s += P('t-a', rpoly([[10.5, 23.5], [21, 11.5], [21, 46.5], [10.5, 34.5]], 1.6) + shine, ' fill-rule="evenodd"');
  s += P('t-c', shine);
  s += P('t-b', poly([[10.8, 31], [21, 38], [21, 46], [10.8, 34.2]]));
  // front rim
  s += P('t-b', cap(21.5, 11.5, 21.5, 46.5, 4));
  // waveform underneath
  let w = 'M5 56', n = 26;
  for (let i = 1; i <= n; i++) {
    const x = 5 + i * 54 / n, env = Math.sin(Math.PI * i / n) * (i % 3 === 1 ? 1 : .6) + .15, y = 56 + (i % 2 ? -4.2 : 4.2) * env;
    w += `L${f(x)} ${f(i === n ? 56 : y)}`;
  }
  s += L(w, 2.2);
  s += P('t-c', spark(6.5, 8, 3.6) + spark(57.5, 8.5, 2.8) + circ(5.5, 45, 1.1));
  add('sound-waves', 'speaker cone sending curved sound waves over a waveform', s);
}

// ---------- ice-cube
{
  let s = '';
  // cube from front-bottom corner O, size sz, yaw t (deg)
  const cube = (O, sz, t, hs = .95) => {
    const r = t * Math.PI / 180, k = .5;
    const a = [sz * Math.cos(r), -sz * Math.sin(r) * k], c = [-sz * Math.sin(r), -sz * Math.cos(r) * k], H = [0, -sz * hs];
    const add2 = (...v) => v.reduce((p, q) => [p[0] + q[0], p[1] + q[1]], [0, 0]);
    const g = .7, sc = (pts, s2) => { const m = pts.reduce((p, q) => [p[0] + q[0] / pts.length, p[1] + q[1] / pts.length], [0, 0]); return pts.map(p => [m[0] + (p[0] - m[0]) * s2, m[1] + (p[1] - m[1]) * s2]); };
    const right = [O, add2(O, a), add2(O, a, H), add2(O, H)];
    const left = [O, add2(O, H), add2(O, c, H), add2(O, c)];
    const top = [add2(O, H), add2(O, a, H), add2(O, a, c, H), add2(O, c, H)];
    const shrink = (pts, d) => { const m = pts.reduce((p, q) => [p[0] + q[0] / 4, p[1] + q[1] / 4], [0, 0]); return pts.map(p => { const dx = m[0] - p[0], dy = m[1] - p[1], l = Math.hypot(dx, dy); return [p[0] + dx / l * d, p[1] + dy / l * d]; }); };
    const R2 = sz * .13;
    const L1 = shrink(left, g), Rt = shrink(right, g), T = shrink(top, g);
    const topIn = poly(sc(T, .55));
    const st = [lerp(L1[1], L1[2], .32), lerp(L1[0], L1[3], .2)];
    const streak = cap(...lerp(st[0], st[1], .2), ...lerp(st[0], st[1], .62), sz * .13);
    return { l: poly(L1), t: poly(T), bb: poly(Rt), a: rpoly(L1, R2) + streak + rpoly(T, R2) + topIn, b: rpoly(Rt, R2), c: streak + topIn };
  };
  // puddle
  s += P('t-c', 'M6.5 56.5Q7 51.5 15 51.5Q24 50.5 34 51Q46 50 54 51.5Q61 52.5 60.5 56Q60 59.5 50 59.5Q40 60.5 30 59.8Q19 60.5 11 59.6Q6.3 59 6.5 56.5Z');
  s += P('t-b', 'M9 57.2Q20 58.4 30 57.6Q42 58.4 56.5 56.6Q57.5 57 56 57.7Q44 59.5 30 58.9Q18 59.6 9.4 58Q8.5 57.5 9 57.2Z');
  const c2 = cube([45, 48.5], 15.5, 57), c1 = cube([22.5, 55.5], 20.5, 33);
  const c3 = cube([52.5, 57.5], 8.6, 18);
  for (const c of [c2, c1]) s += P('t-a', c.a, ' fill-rule="evenodd"') + P('t-b', c.b) + P('t-c', c.c);
  s += P('t-a', c3.l + c3.t) + P('t-b', c3.bb);
  // drops
  const drop = (x, y, r) => `M${f(x)} ${f(y - r * 2.4)}Q${f(x + r * .35)} ${f(y - r * 1.2)} ${f(x + r)} ${f(y - r * .1)}A${f(r)} ${f(r)} 0 1 1 ${f(x - r)} ${f(y - r * .1)}Q${f(x - r * .35)} ${f(y - r * 1.2)} ${f(x)} ${f(y - r * 2.4)}Z`;
  const dh = (x, y, r) => circ(x - r * .35, y - r * .25, r * .32);
  s += P('t-a', drop(7.5, 46, 2.6) + dh(7.5, 46, 2.6) + drop(6, 33, 1.7) + drop(56, 22, 2.3) + dh(56, 22, 2.3), ' fill-rule="evenodd"');
  s += P('t-c', dh(7.5, 46, 2.6) + dh(56, 22, 2.3));
  s += P('t-c', spark(9, 9, 3.8) + spark(31, 8, 2.6) + spark(57, 7, 3));
  add('ice-cube', 'chunky bevelled ice cubes melting into a puddle', s);
}

// ---------- sun-lounger
{
  let s = '';
  // parasol edge overhead: a striped band of a dome, scalloped underneath
  const ccx = 27, ccy = -44, rt = 50, rb = 59.5, xL = 4, xR = 52, n = 6;
  const yt = x => Math.max(4.5, ccy + Math.sqrt(rt * rt - (x - ccx) ** 2));
  const yb = x => ccy + Math.sqrt(rb * rb - (x - ccx) ** 2);
  const seg = { 't-a': '', 't-b': '' };
  for (let i = 0; i < n; i++) {
    const x1 = xL + (xR - xL) * i / n, x2 = xL + (xR - xL) * (i + 1) / n;
    let d = `M${f(x1)} ${f(yt(x1))}`;
    for (let k = 1; k <= 4; k++) { const x = x1 + (x2 - x1) * k / 4; d += `L${f(x)} ${f(yt(x))}`; }
    const xm = (x1 + x2) / 2;
    d += `L${f(x2)} ${f(yb(x2))}Q${f(xm)} ${f(yb(xm) + 5.2)} ${f(x1)} ${f(yb(x1))}Z`;
    seg[i % 2 ? 't-b' : 't-a'] += d;
  }
  // pole
  s += P('t-b', cap(ccx, 14, ccx, 56, 2.4));
  s += P('t-a', seg['t-a']) + P('t-b', seg['t-b']);
  s += P('t-a', circ(ccx, yb(ccx) + 2.6, 1.6));
  // sand
  s += P('t-b', 'M3.5 58.5Q3.5 56 7 56H57Q60.5 56 60.5 58.5Q60.5 60.5 58 60.5H6Q3.5 60.5 3.5 58.5Z');
  // lounger frame legs
  s += P('t-b', limb([[19.5, 45], [14.5, 56.5]], 2.8) + limb([[40.5, 45], [45, 56.5]], 2.8) + limb([[13.5, 36], [24.5, 45]], 2.4));
  // slatted seat + backrest
  const seat = cap(19, 43, 47, 43, 5.4) + cap(19, 43, 9, 25, 5.4);
  let slots = '';
  for (const x of [24, 29.5, 35, 40.5]) slots += cap(x, 41.6, x, 44.4, 1.2);
  for (const t of [.3, .55, .8]) { const p = lerp([19, 43], [9, 25], t); slots += cap(p[0] - 1.2, p[1] + .7, p[0] + 1.2, p[1] - .7, 1.2); }
  s += P('t-a', seat + slots, ' fill-rule="evenodd"');
  s += P('t-b', cap(20, 45, 46.5, 45, 1.6));
  // folded towel on the seat
  s += P('t-c', 'M29.5 34.5H41Q41.6 34.5 41.6 35.3V39.6Q41.6 40.4 40.8 40.4H29.5A2.95 2.95 0 0 1 29.5 34.5Z');
  s += P('t-b', rect(36.2, 34.5, 1.4, 5.9) + rect(38.6, 34.5, 1.4, 5.9));
  s += L('M29.6 37.4H35', 1);
  // side table
  s += P('t-b', rrect(48, 41.5, 12, 2.6, 1) + cap(54, 43, 54, 56, 2.4) + cap(50.5, 56, 57.5, 56, 2.2));
  // drink with straw
  s += L('M54.5 33L57 25.5L59.5 24.8', 1.4);
  s += P('t-c', rpoly([[50.6, 30], [57.4, 30], [56.6, 41.5], [51.4, 41.5]], 1));
  s += P('t-a', rpoly([[51, 33.5], [57.1, 33.5], [56.6, 41.5], [51.4, 41.5]], 1));
  s += P('t-a', `M48.6 30.6A3 3 0 0 1 53.6 29.4L51.1 31.2Z`);
  s += P('t-c', spark(58, 11, 3.4) + spark(6.5, 46, 2.6));
  add('sun-lounger', 'reclining sun lounger with towel, drink and parasol edge', s);
}

fs.writeFileSync(process.argv[2] || new URL('../../icons/part34.json', import.meta.url), JSON.stringify(icons, null, 1));
console.log(icons.map(i => `${i.id} ${i.svg.length}`).join('\n'));
