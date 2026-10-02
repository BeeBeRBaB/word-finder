// Generates part10.json (round 2, batch 10).
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

// ---------- stage-spotlight
{
  let s = '';
  // geometry: cone from (32±ht, 10) widening to ±hb at the pool centre; pool ellipse rx x ry at (32, cy)
  const ht = 3.2, hb = 12.5, cy = 47.5, rx = 14, ry = 3.8, yb = 40;
  const hw = y => ht + (hb - ht) * (y - 10) / (cy - 10);
  const inE = (x, y) => ((x - 32) / rx) ** 2 + ((y - cy) / ry) ** 2 < 1;
  const lit = (x, y) => inE(x, y) || (y <= cy && y >= 10 && Math.abs(x - 32) <= hw(y));
  let lo = cy - ry, hi = cy; // where the cone side enters the pool ellipse
  for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (inE(32 + hw(m) - .01, m)) hi = m; else lo = m; }
  const yi = hi, xi = hw(yi);
  const arc = `L${f(32 + xi)} ${f(yi)}A${rx} ${ry} 0 1 1 ${f(32 - xi)} ${f(yi)}Z`;
  s += P('t-c', `M${f(32 - ht)} 10L${f(32 + ht)} 10` + arc);
  // floor with the lit area cut out
  s += P('t-a', `M12 ${yb}H52L63 54H1ZM${f(32 - hw(yb))} ${yb}L${f(32 + hw(yb))} ${yb}` + arc, ' fill-rule="evenodd"');
  // floorboards, clipped to the unlit floor
  let boards = '';
  for (let k = 1; k < 8; k++) {
    const x0 = 12 + k * 40 / 8, x1 = 1 + k * 62 / 8; let st = null, last = null;
    for (let t = 0; t <= 1.0001; t += .02) {
      const x = x0 + (x1 - x0) * t, y = yb + (54 - yb) * t, o = !lit(x, y) && !lit(x + 1, y) && !lit(x - 1, y) && !lit(x, y - 1);
      if (o) { if (!st) st = [x, y]; last = [x, y]; }
      if ((!o || t > .99) && st) { if (Math.hypot(last[0] - st[0], last[1] - st[1]) > 1.5) boards += `M${f(st[0])} ${f(st[1])}L${f(last[0])} ${f(last[1])}`; st = null; }
    }
  }
  s += L(boards, 1.1);
  // apron with footlights
  s += R('t-b', 1, 54, 62, 7, 1);
  s += P('t-c', circ(12, 57.5, 1.3) + circ(24, 57.5, 1.3) + circ(40, 57.5, 1.3) + circ(52, 57.5, 1.3));
  // curtains
  const cur = 'M1 7H16C15 18 10.5 26 6 31C8 38 9.5 46 10.5 54H1Z', sh = 'M12.5 7H16C15 18 10.5 26 6 31L4 30C8.5 25 12.5 17 12.5 7Z';
  const folds = 'M5.5 9C5.5 18 5 24 3.5 29.5M9.5 9C9 18 7.5 24 5 30M4.5 36C5.5 43 6 48 6 52.5M7.5 36C8.5 43 8.8 48 8.8 52.5';
  const side = P('t-a', cur) + P('t-b', sh) + L(folds, 1.2) + P('t-b', cap(2.8, 33, 7.8, 31.5, 3.4));
  s += side + `<g transform="matrix(-1 0 0 1 64 0)">${side}</g>`;
  // valance with scallops
  let v = 'M1 1H63V7';
  for (let k = 0; k < 6; k++) { const a = 63 - k * 62 / 6, b = a - 62 / 6; v += `Q${f((a + b) / 2)} 14.5 ${f(b)} 7`; }
  s += P('t-a', v + 'Z') + R('t-b', 1, 1, 62, 3);
  // lamp lip
  s += R('t-b', 27.5, 7.5, 9, 3.5, 1.5);
  s += P('t-c', spark(18, 21, 3) + spark(47, 26, 2.4));
  add('stage-spotlight', 'stage with red curtains under a spotlight beam', s);
}

// ---------- spotlight
{
  let s = '';
  // tripod stand
  s += P('t-b', limb([[20, 53], [8.5, 61.2]], 3.2) + limb([[20, 53], [31.5, 61.2]], 3.2) + cap(20, 44, 20, 61.2, 3.6));
  // lamp, drawn along +x and tilted up-right about the yoke pivot
  const ax = -8.1, al = Math.atan(.34), r0 = 21.8, RB = 41.5, rs = 30, g = .05;
  const Q = (r, t) => `${f(ax + r * Math.cos(t))} ${f(r * Math.sin(t))}`;
  const a3 = al / 3;
  let beam = `M${Q(r0, -al)}L${Q(RB, -al)}A${RB} ${RB} 0 0 1 ${Q(RB, -a3 - g)}L${Q(rs, -a3)}L${Q(RB, -a3 + g)}`;
  beam += `A${RB} ${RB} 0 0 1 ${Q(RB, a3 - g)}L${Q(rs, a3)}L${Q(RB, a3 + g)}A${RB} ${RB} 0 0 1 ${Q(RB, al)}L${Q(r0, al)}Z`;
  let h = P('t-c', beam);
  // body with a cut highlight stripe
  h += P('t-a', `${rpoly([[-12, -8], [9, -8], [9, 8], [-12, 8]], 3)}M-8 -5.6H5V-3.6H-8Z`, ' fill-rule="evenodd"');
  h += R('t-c', -8, -5.6, 13, 2);
  h += P('t-b', 'M-12 3.5H9V5Q9 8 6 8H-9Q-12 8 -12 5Z');
  h += L('M-5 -2V8M-1.5 -2V8M2 -2V8', 1.2);
  h += R('t-b', -15, -6, 4.5, 12, 2);
  h += R('t-b', 8, -10.5, 4.2, 21, 1.5);
  h += E('t-c', 12.6, 0, 1.8, 7.6);
  s += `<g transform="translate(20 36.5) rotate(-35) scale(1.15)">${h}</g>`;
  // yoke arm and pivot knob
  s += P('t-b', cap(20, 36.5, 20, 46, 5));
  s += P('t-b', circ(20, 36.5, 3.8) + circ(20, 36.5, 1.6), ' fill-rule="evenodd"') + C('t-c', 20, 36.5, 1.6);
  s += P('t-c', spark(8, 9, 3.6) + spark(27, 6, 2.4) + spark(55, 50, 3.4));
  add('spotlight', 'stage spotlight throwing a cone of light', s);
}

// ---------- music-notes
{
  let s = '';
  const head = (x, y) => {
    let h = P('t-a', 'M-9.5 0a9.5 6.8 0 1 0 19 0a9.5 6.8 0 1 0 -19 0ZM-7 -2.4a3.2 1.6 0 1 0 6.4 0a3.2 1.6 0 1 0 -6.4 0Z', ' fill-rule="evenodd"');
    h += E('t-c', -3.8, -2.4, 3.2, 1.6);
    h += P('t-b', 'M9.4 -.8A9.5 6.8 0 0 1 -7.3 4.4Q1 5 9.4 -.8Z');
    return `<g transform="translate(${x} ${y}) rotate(-24) scale(1.07)">${h}</g>`;
  };
  // stems (shaded on the right) and the beam
  s += R('t-a', 22.4, 14, 4.3, 34) + R('t-a', 51.5, 6, 4.3, 36);
  s += R('t-b', 24.9, 18, 1.8, 28) + R('t-b', 54, 10, 1.8, 30);
  s += P('t-a', rpoly([[22, 12.4], [56.2, 3.6], [56.2, 12.6], [22, 21.4]], 1.4) + 'M25.6 14.4L52.4 7.5V9.5L25.6 16.4Z', ' fill-rule="evenodd"');
  s += P('t-c', 'M25.6 14.4L52.4 7.5V9.5L25.6 16.4Z');
  s += P('t-b', 'M22.2 18.9L56 10.2V11.6Q56 12.5 55 12.8L23.2 21Q22.2 21.2 22.2 20.2Z');
  s += head(17, 50) + head(46, 43);
  s += P('t-c', spark(9, 16, 4.5) + spark(60, 35, 3) + spark(36, 57, 2.6));
  s += C('t-c', 16, 30, 1.3) + C('t-c', 40, 28, 1.1);
  add('music-notes', 'pair of beamed music notes', s);
}

// ---------- snowflake
{
  let s = '';
  const cx = 32, cy = 32.5, w = 2.4, bw = 1.5, sn = Math.sin(50 * Math.PI / 180), cs = Math.cos(50 * Math.PI / 180), k = cs / sn;
  // left half of one arm pointing up (local coords, origin at centre); a branch leaves the stem at height d with length l
  const half = [[-w, -w * Math.sqrt(3)]];
  for (const [d, l] of [[10, 8.5], [17, 6.2]]) {
    const t = [-sn * l, -d - cs * l];
    half.push([-w, -d + bw / sn - w * k], [t[0] - bw * cs, t[1] + bw * sn], [t[0] + bw * cs, t[1] - bw * sn], [-w, -d - bw / sn - w * k]);
  }
  half.push([-w, -22.6], [-3.7, -25.2], [0, -29]);
  const arm = half.concat(half.slice(1, -1).reverse().map(([x, y]) => [-x, y]));
  const rot = (n, [x, y]) => { const t = n * Math.PI / 3; return [cx + x * Math.cos(t) - y * Math.sin(t), cy + x * Math.sin(t) + y * Math.cos(t)]; };
  const poly = pts => 'M' + pts.map(p => f(p[0]) + ' ' + f(p[1])).join(' ') + 'Z';
  const hex = (r, o) => poly(Array.from({ length: 6 }, (_, i) => [cx + r * Math.sin((i * 60 + o) * Math.PI / 180), cy - r * Math.cos((i * 60 + o) * Math.PI / 180)]));
  let out = [], crease = '';
  for (let n = 0; n < 6; n++) {
    out = out.concat(arm.map(p => rot(n, p)));
    crease += poly([[0, -10], [.8, -15.5], [0, -24.5], [-.8, -15.5]].map(p => rot(n, p)));
  }
  s += P('t-a', poly(out) + hex(4.4, 30), ' fill-rule="evenodd"');
  s += P('t-b', crease + hex(8.2, 30) + hex(4.4, 30), ' fill-rule="evenodd"');
  s += P('t-c', hex(2.8, 0));
  s += P('t-c', spark(55.5, 8, 4.5) + spark(8.5, 57, 3));
  add('snowflake', 'six-armed snowflake', s);
}

// ---------- mitten
{
  let s = '';
  // one mitten, thumb on its left, origin at the cuff's bottom centre
  const hand = 'M-9.5 -2Q-9.5 0 -7.5 0H7.5Q9.5 0 9.5 -2V-9Q9.5 -10.5 8.5 -10.5V-28A8.5 8.5 0 0 0 -8.5 -28V-24.5C-11 -26.5 -14.5 -26 -14.5 -21.5C-14.5 -17 -11.5 -14.5 -8.5 -14V-10.5Q-9.5 -10.5 -9.5 -9ZM-5.6 -30.5Q-5.4 -33.6 -2.2 -35L-1.6 -33.6Q-3.9 -32.6 -4.1 -30.3Z';
  const one = (tr, extra) => `<g transform="${tr}">` + P('t-a', hand, ' fill-rule="evenodd"') + P('t-c', 'M-5.6 -30.5Q-5.4 -33.6 -2.2 -35L-1.6 -33.6Q-3.9 -32.6 -4.1 -30.3Z') + P('t-b', 'M8.5 -10.5V-28A8.5 8.5 0 0 0 3.6 -35.7Q6.3 -32.5 6.3 -28V-10.5Z') +
    P('t-b', 'M-9.5 -10.5H9.5V-8.9H-9.5ZM-6.3 -7.5h1.4v6h-1.4ZM-2.8 -7.5h1.4v6h-1.4ZM.7 -7.5h1.4v6h-1.4ZM4.2 -7.5h1.4v6h-1.4Z') +
    P('t-b', 'M-8.5 -18H8.5V-16.6H-8.5ZM-8.5 -28.4H8.5V-27H-8.5ZM-7.6 -22.3l2.2 -2.6 2.2 2.6 -2.2 2.6ZM-2.2 -22.3l2.2 -2.6 2.2 2.6 -2.2 2.6ZM3.2 -22.3l2.2 -2.6 2.2 2.6 -2.2 2.6Z') + extra + '</g>';
  s += L('M20.5 53.5C21 62.5 43 62.5 43.5 53.5', 1.6);
  s += one('translate(19 53.5) rotate(-11) scale(-1.16 1.16)', '');
  s += one('translate(45 53.5) rotate(11) scale(1.16)', '');
  s += P('t-c', spark(32, 8, 4.5) + spark(56, 6, 2.6));
  add('mitten', 'pair of knitted mittens', s);
}

// ---------- whistle
{
  let s = '';
  const hl = 'M-7 -2.5A7.5 7.5 0 0 1 -2.5 -7.1L-1.9 -5.6A6 6 0 0 0 -5.5 -1.9ZM-25.5 -12.4H-12.5V-10.9H-25.5Z';
  s += L('M50.4 24.5C46 6 26 1 17 6.5C9.5 11 22 19.5 50.4 24.5', 2.6);
  s += '<g transform="translate(41 44) rotate(-8)">';
  s += P('t-a', 'M-29 -12Q-29 -14 -27 -14H-10.5V-10.2H-4.2L-2.6 -14H0A14 14 0 1 1 -13.3 -4.5H-27Q-29 -4.5 -29 -6.5Z' + hl, ' fill-rule="evenodd"');
  s += P('t-c', hl);
  s += P('t-b', 'M-29 -12Q-29 -14 -27 -14H-25.5V-4.5H-27Q-29 -4.5 -29 -6.5ZM-25.5 -6.8H-12.3L-13.3 -4.5H-25.5Z');
  s += P('t-b', 'M13.4 4A14 14 0 0 1 -9.5 10.3A15 15 0 0 0 13.4 4Z' + circ(0, 0, 9.4) + circ(0, 0, 7.7), ' fill-rule="evenodd"');
  s += C('t-b', 0, 0, 2.8);
  s += P('t-b', circ(11, -11.4, 4.4) + circ(11, -11.4, 2.6), ' fill-rule="evenodd"');
  s += '</g>';
  s += R('t-b', 48, 21.2, 4.8, 6.4, 1.6);
  s += P('t-c', spark(55, 8, 4.5) + spark(9, 54, 2.8));
  add('whistle', "coach's whistle on a lanyard", s);
}

// ---------- flame
{ let s = '';
  // gas burner ring under the flame
  s += P('t-b', 'M10 55.5H54V58.5C54 61 44 62.5 32 62.5C20 62.5 10 61 10 58.5Z');
  s += E('t-a', 32, 55.5, 22, 3.6);
  s += P('t-c', circ(14.5, 56.2, .9) + circ(21, 57.6, .9) + circ(28, 58.3, .9) + circ(36, 58.3, .9) + circ(43, 57.6, .9) + circ(49.5, 56.2, .9));
  const OUT = 'M32 55C22.5 55 14 48.5 14 38.5C14 30.5 15 23 16.5 14.5C20 20.5 23 23.5 25.8 26C24.5 17 27.5 8.5 34 1.5C32 9.5 37.5 15.5 40.5 21.5C43 17.5 46.5 13.5 48 8C50.5 16 51 23.5 51 31.5C51 46.5 42.5 55 32 55Z';
  const MID = 'M32 52.5C25.5 52.5 21 48 21 42C21 36.5 23.5 33 26 28.5C27.5 31.5 28.7 33.3 30.3 34.5C30 28 31.5 21.5 35.5 16C34.5 23 41.5 27.5 42.5 35C43.5 42 41 52.5 32 52.5Z';
  const IN = 'M32 51C28.6 51 26.5 48.6 26.5 45.6C26.5 41.5 30 39.5 32.5 33.5C35 38.5 38 41.5 38 45.8C38 49 35.6 51 32 51Z';
  s += P('t-a', OUT + MID, ' fill-rule="evenodd"');
  s += P('t-b', 'M48 8C50.5 16 51 23.5 51 31.5C51 46.5 42.5 55 32 55C39 53 46.6 46 46.6 34C46.6 25 48.2 17 48 8Z');
  s += P('t-c', MID + IN, ' fill-rule="evenodd"');
  s += P('t-a', IN);
  s += P('t-c', 'M18.8 31C17.6 35 17.4 39 18.6 42.6L17 43C15.7 39 16 35 17.3 30.6Z');
  s += P('t-c', spark(10, 10, 3.2) + spark(56, 44, 2.4)) + C('t-a', 56, 4.5, 1.4) + C('t-c', 7, 24, 1.2);
  add('flame', 'flickering cooking flame', s); }

// ---------- cupcake
{ let s = '';
  // pleated wrapper: cylinder pleats bunch toward the edges
  s += P('t-a', rpoly([[13.5, 39], [50.5, 39], [45.5, 61], [18.5, 61]], [1, 1, 2.5, 2.5]));
  let pl = '';
  const n = 9, xt = k => 32 + 18.5 * Math.sin((-1 + 2 * k / n) * 1.35) / Math.sin(1.35), xb = k => 32 + 13.5 * Math.sin((-1 + 2 * k / n) * 1.35) / Math.sin(1.35);
  for (let k = 1; k < n; k += 2) pl += `M${f(xt(k))} 39L${f(xt(k + 1))} 39L${f(xb(k + 1))} 60.5L${f(xb(k))} 60.5Z`;
  s += P('t-b', pl + 'M14 41.5H50L49.4 44H14.6Z');
  // frosting swirl
  s += P('t-c', 'M12.5 41.5C6.5 41.5 6.5 32 13.5 31C11.5 25 16 21.5 21.5 22.5C20.5 16 25.5 12.5 32 12.5C38.5 12.5 43.5 16 42.5 22.5C48 21.5 52.5 25 50.5 31C57.5 32 57.5 41.5 51.5 41.5Z');
  s += P('t-a', 'M13.5 31C22 36 42 36 50.5 31C50 34.5 47 38.5 32 38.5C17 38.5 14 34.5 13.5 31Z');
  s += P('t-a', 'M21.5 22.5C27 26.5 37 26.5 42.5 22.5C42 25.5 39 28.5 32 28.5C25 28.5 22 25.5 21.5 22.5Z');
  s += P('t-a', 'M51.5 41.5C55 40 56 35 53 32.5C55 36 54 39.5 50 41.5Z');
  // sprinkles
  s += P('t-b', cap(17, 36, 19.5, 34.5, 1.6) + cap(27, 33.5, 29.8, 33.8, 1.6) + cap(40.5, 33, 42, 35.3, 1.6) + cap(24.5, 24.5, 26.5, 26.5, 1.6) + cap(36.5, 18.5, 39, 19.5, 1.6) + cap(45.5, 26, 47.5, 27.5, 1.6));
  s += P('t-a', cap(11.8, 35.5, 12.6, 37.8, 1.6) + cap(18, 26.5, 18.3, 29, 1.6) + cap(30, 30.8, 32.5, 30.4, 1.6) + cap(46.8, 39.8, 49.3, 39.2, 1.6) + cap(24.5, 18, 26, 16, 1.6));
  // cherry with stem
  s += L('M33 7C34 4.5 36 2.5 39 1.5', 1.6);
  s += P('t-b', circ(32, 10.5, 5.2) + 'M28.8 9.2a1.6 2.2 30 1 0 2.2 -2.6a1.6 2.2 30 1 0 -2.2 2.6Z', ' fill-rule="evenodd"');
  s += P('t-c', 'M28.8 9.2a1.6 2.2 30 1 0 2.2 -2.6a1.6 2.2 30 1 0 -2.2 2.6Z');
  s += P('t-c', spark(9, 14, 3.2) + spark(55.5, 9, 2.6)) + C('t-a', 57, 22, 1.3) + C('t-c', 7.5, 25, 1.1);
  add('cupcake', 'frosted cupcake with sprinkles', s); }

// ---------- invitation-card
{ let s = '';
  // open flap and envelope interior, cut around the card
  const yf = 30 - 10 * 21 / 26;
  s += P('t-b', `M6 31L6 57L16 57L16 ${f(yf)}ZM48 ${f(yf)}L48 57L58 57L58 31Z`);
  // card peeking out
  s += P('t-c', rpoly([[16, 5], [48, 5], [48, 50], [16, 50]], 2.2));
  s += P('ln', rpoly([[19.5, 8.5], [44.5, 8.5], [44.5, 46], [19.5, 46]], 1.2), ' stroke-width="1.2"');
  s += P('t-a', rpoly(star(32, 21, 8.5, 3.6), .8));
  s += P('t-a', spark(23.5, 13, 2.2) + spark(41, 30, 2) + circ(41.5, 13.5, 1.1) + circ(23, 29.5, 1.1));
  // shadow on the card where it enters the pocket
  s += P('t-a', 'M16 34.5L32 44.5L48 34.5V37.1L32 47.6L16 37.1Z');
  // front pocket
  s += P('t-a', rpoly([[6, 30.5], [32, 47.5], [58, 30.5], [58, 58.5], [6, 58.5]], [1, 2, 1, 3, 3]));
  s += P('t-b', 'M58 30.5V58.5H54Q56 57.5 56 55V32Z');
  s += L('M7.5 57.3L25 45.2M56.5 57.3L39 45.2', 1.6);
  // heart wax seal
  const H = 'M32 54.2C28.8 52 27.2 50.1 27.2 48.2C27.2 46.6 28.4 45.6 29.7 45.6C30.7 45.6 31.5 46.2 32 47C32.5 46.2 33.3 45.6 34.3 45.6C35.6 45.6 36.8 46.6 36.8 48.2C36.8 50.1 35.2 52 32 54.2Z';
  s += P('t-b', circ(32, 49.6, 7) + H, ' fill-rule="evenodd"');
  s += P('t-c', H);
  s += P('t-c', spark(8.5, 14, 3.2) + spark(55.5, 18, 2.6)) + C('t-a', 56.5, 6.5, 1.4) + C('t-c', 9, 24.5, 1.1);
  add('invitation-card', 'envelope with a card peeking out', s); }

// ---------- bed
{
  let s = '';
  // oblique view: depth runs up-right by (14,-10); head at left (x 4..18), foot at right (x 44..58)
  const pt = p => f(p[0]) + ' ' + f(p[1]);
  const quad = (a, b, c, d) => `M${pt(a)}L${pt(b)}L${pt(c)}L${pt(d)}Z`;
  // back posts: head one hidden below the pillow, foot one shows its leg
  s += P('t-b', cap(18, 7, 18, 23, 4) + cap(58, 21, 58, 50, 4));
  // headboard inner face + mattress head strip, pillow cut out of both
  // puffy pillow: sides bow outward between pinched corners
  const pc = [[5.5, 35.5], [14, 36], [23, 30], [13.5, 25]];
  const pillow = 'M' + pt(pc[0]) + pc.map((a, i) => { const b = pc[(i + 1) % 4], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy);
    return 'Q' + pt([(a[0] + b[0]) / 2 - dy / l * 2, (a[1] + b[1]) / 2 + dx / l * 2]) + ' ' + pt(b); }).join('') + 'Z';
  s += P('t-a', 'M4 36V18Q11 -2 18 8V26Z' + quad([4, 36], [17, 36], [31, 26], [18, 26]) + 'M4 36H17V50H4Z' + pillow, ' fill-rule="evenodd"');
  s += P('t-b', 'M6.5 29.5V18.5Q11 4.5 16 10.5V20.5Z');
  s += P('t-c', pillow);
  // quilt: top surface + front drape, patchwork in three tones
  const top = (u, v) => [17 + u * 27 + v * 14, 36 - v * 10];
  const band = 2.6 / 27, cols = 4, tone = (i, j) => (i + 2 * j + 3) % 3;
  let qb = '', qc = quad(top(0, 0), top(band, 0), top(band, 1), top(0, 1)) + 'M17 36H19.6V50.5H17Z';
  for (let i = 0; i < cols; i++) {
    const u0 = band + i * (1 - band) / cols, u1 = band + (i + 1) * (1 - band) / cols, x0 = top(u0, 0)[0], x1 = top(u1, 0)[0];
    for (let j = 0; j < 2; j++) {
      const t1 = tone(i, -1 - j), qt = quad(top(u0, j / 2), top(u1, j / 2), top(u1, (j + 1) / 2), top(u0, (j + 1) / 2));
      if (t1 === 1) qb += qt; else if (t1 === 2) qc += qt;
      const t2 = tone(i, j), qf = `M${f(x0)} ${36 + j * 7}H${f(x1)}V${43 + j * 7}H${f(x0)}Z`;
      if (t2 === 1) qb += qf; else if (t2 === 2) qc += qf;
    }
  }
  s += P('t-a', quad(top(0, 0), top(1, 0), top(1, 1), top(0, 1)) + 'M17 36H44V51.5Q40.6 50 37.2 51.5Q33.8 50 30.5 51.5Q27 50 23.7 51.5Q20.4 50 17 51.5Z' + qc, ' fill-rule="evenodd"');
  s += P('t-b', qb);
  s += P('t-c', qc);
  // front side rail under the hem
  s += P('t-b', 'M4 50H17V51.5Q20.4 50 23.7 51.5Q27 50 30.5 51.5Q33.8 50 37.2 51.5Q40.6 50 44 51.5V55H4Z');
  // footboard outer face
  s += P('t-a', 'M44 54V30Q50 15 58 20V44Z');
  s += P('t-b', 'M46.5 49V30.5Q50.5 21 55.5 23.5V43Z');
  // front posts + legs, turned knobs
  s += P('t-b', cap(4, 17, 4, 60, 4.5) + cap(44, 27, 44, 60, 4.5));
  s += P('t-c', circ(4, 15.5, 2.7) + circ(44, 25.5, 2.7) + circ(18, 5.7, 2.3) + circ(58, 19.7, 2.3));
  s += P('t-c', spark(37, 11, 4.5) + spark(50, 6, 2.6));
  add('bed', 'bed with a quilt and headboard', s);
}
// ---------- bookshelf
{
  let s = '';
  const acc = { a: '', b: '', c: '', cut: '' };
  const rr = (x, y, w, h) => `M${f(x)} ${f(y)}h${f(w)}v${f(h)}h${f(-w)}Z`;
  // upright spine: tone 'a'|'b'|'c', bands drawn dark on light spines and cut out of dark ones
  const book = (x, floor, w, h, t, bands) => {
    acc[t] += rr(x, floor - h, w, h);
    for (const [y, bh] of bands) {
      const r = rr(x + .9, floor - h + y, w - 1.8, bh);
      if (t === 'b') { acc.b += r; acc.c += r; } else acc.b += r;
    }
  };
  const row = (x, floor, list) => { for (const [w, h, t, bd] of list) { book(x, floor, w, h, t, bd); x += w + .7; } return x; };
  // case: cornice + body with three open bays
  const L0 = 8, R0 = 56, bays = [[10, 23.5], [26.5, 40], [43, 56.5]];
  s += P('t-a', rr(6, 6, 52, 4.4) + rr(L0, 10, R0 - L0, 49) + bays.map(([t, b]) => rr(L0 + 3.5, t, R0 - L0 - 7, b - t)).join(''), ' fill-rule="evenodd"');
  s += P('t-b', rr(L0, 10, R0 - L0, 1.2) + bays.slice(0, 2).map(([, b]) => rr(L0 + 3.5, b + 2, R0 - L0 - 7, 1)).join('') + rr(L0 + 3.5, 58, R0 - L0 - 7, 1) + rr(L0 + 1, 59, 5, 2.5) + rr(R0 - 6, 59, 5, 2.5));
  // top bay: upright run ending in a leaning book
  let x = row(12.2, 23.5, [[4.5, 12, 'a', [[1.5, 1.2], [8.5, 1.2]]], [3.6, 10, 'c', [[1.5, 1]]], [5, 12.5, 'b', [[2, 1.2], [9, 1.2]]], [4, 11, 'a', [[2, 1.2]]], [3.2, 9.5, 'c', [[6.5, 1]]], [5, 12, 'b', [[1.6, 1.4]]]]);
  { const a = 22 * Math.PI / 180, h = 11.5, w = 4, bx = x + h * Math.sin(a) + w * Math.cos(a) - .4, by = 23.5;
    const pts = [[bx, by], [bx - w * Math.cos(a), by - w * Math.sin(a)], [bx - w * Math.cos(a) - h * Math.sin(a), by - w * Math.sin(a) - h * Math.cos(a)], [bx - h * Math.sin(a), by - h * Math.cos(a)]];
    acc.a += 'M' + pts.map(p => f(p[0]) + ' ' + f(p[1])).join('L') + 'Z';
    const q = (u, v) => [pts[1][0] + (pts[0][0] - pts[1][0]) * u + (pts[2][0] - pts[1][0]) * v, pts[1][1] + (pts[0][1] - pts[1][1]) * u + (pts[2][1] - pts[1][1]) * v];
    acc.b += 'M' + [q(.22, .72), q(.78, .72), q(.78, .82), q(.22, .82)].map(p => f(p[0]) + ' ' + f(p[1])).join('L') + 'Z'; }
  // middle bay: a stack lying flat, then spines
  acc.b += rr(12.2, 37, 12.5, 3); acc.c += rr(13, 37.9, 3, 1.2); acc.b += rr(13, 37.9, 3, 1.2);
  acc.c += rr(13.2, 33.6, 11, 2.9); acc.a += rr(12.6, 30.2, 11.8, 2.9); acc.b += rr(21, 30.9, 1.4, 1.5);
  row(25.6, 40, [[3.8, 11.5, 'a', [[1.5, 1.2], [8, 1.2]]], [5, 12.5, 'c', [[2, 1.4], [8.5, 1.4]]], [3.4, 10.5, 'b', [[2, 1.2]]], [4.6, 12.2, 'a', [[3, 2.4]]], [3.6, 11, 'b', [[1.6, 1], [8, 1]]], [2.4, 9, 'c', [[2, 1]]]]);
  // bottom bay: tall run
  row(12.2, 56.5, [[5, 12.5, 'c', [[2, 1.2], [9, 1.2]]], [3.6, 11, 'b', [[2, 1.2]]], [4.4, 12, 'a', [[1.6, 1.2], [8.5, 1.2]]], [3.2, 10, 'c', [[2, 1]]], [5.2, 12.8, 'b', [[2.4, 1.4], [9.4, 1.4]]], [4, 11.5, 'a', [[3, 2]]], [3.6, 10.5, 'c', [[1.8, 1]]], [4.4, 12.4, 'b', [[2, 1.2]]]]);
  s += P('t-a', acc.a);
  s += P('t-c', acc.c);
  s += P('t-b', acc.b, ' fill-rule="evenodd"');
  s += P('t-c', spark(3.4, 18, 2.8) + spark(60.6, 47, 2.4));
  add('bookshelf', 'wooden bookshelf packed with spines', s);
}
// ---------- easel-canvas
{
  let s = '';
  const pt = (x, y) => f(x) + ' ' + f(y);
  // tripod: front legs splay from the mast, back leg + stretcher in shade
  const lx = y => 30 - 20.5 * (y - 3) / 58.5, rx = y => 64 - lx(y);
  const leg = (fx, y0) => rpoly([[fx(y0) - 2, y0], [fx(y0) + 2, y0], [fx(61.5) + 2, 61.5], [fx(61.5) - 2, 61.5]], [0, 0, 1.5, 1.5]);
  s += P('t-b', 'M30.6 44H33.4V57.3Q32 59.5 30.6 57.3Z');
  s += P('t-a', leg(lx, 44.5) + leg(rx, 44.5) + `M${pt(lx(8) - 2.1, 8)}L29.6 2.6Q32 .8 34.4 2.6L${pt(rx(8) + 2.1, 8)}Z`);
  s += P('t-b', `M${pt(lx(51.5), 51.5)}H${f(rx(51.5))}V53.5H${f(lx(53.5))}Z`);
  // canvas: painted region on the left with brushy stroke ends, blank right
  const X0 = 10.9, X1 = 53.1, Y0 = 9.4, Y1 = 38.6;
  const ins = [[29, Y0], [28, 13.5], [30.5, 17.5], [32, 21.5], [33.5, 26], [34.5, 30.5], [35.5, 35], [38, Y1]];
  const outs = [31.5, 33, 34, 36, 37.5, 38.5, 39];
  let paint = `M${pt(X0, Y1)}V${f(Y0)}H29`;
  for (let i = 0; i < outs.length; i++) { const a = ins[i], b = ins[i + 1]; paint += `Q${pt(2 * outs[i] - (a[0] + b[0]) / 2, (a[1] + b[1]) / 2)} ${pt(b[0], b[1])}`; }
  paint += 'Z';
  const sx = 18.5, sy = 15.3;
  const sun = 'M' + star(sx, sy, 5, 3, 8, -90).map(p => pt(p[0], p[1])).join('L') + 'Z';
  s += P('t-b', `M9.5 8H54.5V40H9.5ZM${pt(X0, Y0)}H${f(X1)}V${f(Y1)}H${f(X0)}Z`, ' fill-rule="evenodd"');
  s += P('t-c', `M${pt(X0, Y0)}H${f(X1)}V${f(Y1)}H${f(X0)}Z` + paint + sun, ' fill-rule="evenodd"');
  s += P('t-a', paint + sun, ' fill-rule="evenodd"');
  // far hill painted in shade, its stroke ending short of the blank area
  s += P('t-b', 'M11.2 25Q18 19.5 24.5 20.8Q29 21.8 31 23.3Q34 25.8 32.5 28.6Q24 26 11.2 31.5Z');
  // pencil underdrawing still waiting for paint
  s += L('M36.8 25.6Q41 24 45.5 18.8Q49 21 52.3 22.5M38.6 31.2Q45 34.5 52.3 29.5M39 15Q39.5 12 42.5 12.8Q44.5 10.2 47 12.6Q49.8 12.6 49.6 15Z', 0.9);
  // top clamp + ledge (lit top face cut out)
  s += R('t-b', 29.2, 5.2, 5.6, 5.3, 1);
  s += P('t-a', 'M7.5 40H56.5Q57.5 40 57.5 41V43.5Q57.5 44.5 56.5 44.5H7.5Q6.5 44.5 6.5 43.5V41Q6.5 40 7.5 40ZM7 40.6H57V41.6H7Z', ' fill-rule="evenodd"');
  s += P('t-c', 'M7 40.6H57V41.6H7Z');
  s += P('t-b', 'M6.5 43.2H57.5V43.5Q57.5 44.5 56.5 44.5H7.5Q6.5 44.5 6.5 43.5Z');
  // brush leaning on the ledge, wet tip in the air past the canvas edge
  s += P('t-b', cap(41.2, 42.6, 55.2, 28.6, 2.2) + 'M57.6 26.4Q58.5 23.5 62.2 22.6Q61.3 26.3 58.4 27.2Z');
  s += P('t-c', cap(54.8, 29, 57.8, 26, 3));
  s += P('t-c', spark(5, 6.5, 3.4) + spark(58.5, 9, 2.2));
  add('easel-canvas', 'canvas on a wooden easel with a half-finished landscape', s);
}

// ---------- frog
{
  let s = '';
  const el = (x, y, rx, ry, rot = 0, rev = 0) => {
    const a = rot * Math.PI / 180, c = Math.cos(a), sn = Math.sin(a), p1 = [x - rx * c, y - rx * sn], p2 = [x + rx * c, y + rx * sn];
    return `M${f(p1[0])} ${f(p1[1])}A${f(rx)} ${f(ry)} ${rot} 1 ${rev} ${f(p2[0])} ${f(p2[1])}A${f(rx)} ${f(ry)} ${rot} 1 ${rev} ${f(p1[0])} ${f(p1[1])}Z`;
  };
  const pt = p => `${f(p[0])} ${f(p[1])}`;
  const pc = [32, 52.5, 26, 9.5];
  const ep = (t, e = pc) => [e[0] + e[2] * Math.cos(t * Math.PI / 180), e[1] + e[3] * Math.sin(t * Math.PI / 180)];
  const o = -1.5; // frog vertical offset
  // ripples: arcs of a wider ring
  const rg = [32, 52.5, 29.5, 10.8];
  s += L(`M${pt(ep(205, rg))}A29.5 10.8 0 0 0 ${pt(ep(128, rg))}M${pt(ep(52, rg))}A29.5 10.8 0 0 0 ${pt(ep(-25, rg))}`, 1.8);
  // lily pad: bottom arc with a notch, top cut away under the frog
  const PL = ep(196), PR = ep(-16);
  const LH = [[28, 51.2, 24.5, 53.5], [17, 55.2, 10.5, 54.2], [7.4, 54, ...PL]];
  let cut = '', prev = [32, 50.8];
  const pts = [[32, 51.2], ...LH.map(q => [q[2], q[3]])];
  for (let i = LH.length - 1; i >= 0; i--) cut += `Q${f(64 - LH[i][0])} ${f(LH[i][1])} ${f(64 - pts[i][0])} ${f(pts[i][1])}`;
  for (const q of LH) cut += `Q${f(q[0])} ${f(q[1])} ${f(q[2])} ${f(q[3])}`;
  s += P('t-b', `M${pt(PL)}A26 9.5 0 0 0 ${pt(ep(78))}L39.6 58L${pt(ep(60))}A26 9.5 0 0 0 ${pt(PR)}${cut}Z`);
  // frog silhouette (one nonzero path; eye whites + belly are reversed holes)
  let fr = '';
  fr += circ(22, 16 + o, 6.8) + circ(42, 16 + o, 6.8) + el(32, 28 + o, 17, 10.5) + el(32, 41 + o, 13.5, 10);
  fr += el(19, 44 + o, 8.5, 6.5, -30) + el(45, 44 + o, 8.5, 6.5, 30);
  fr += el(14.5, 50.3 + o, 5.5, 2.2, 10) + el(49.5, 50.3 + o, 5.5, 2.2, -10);
  fr += circ(9.8, 49.4 + o, 1.7) + circ(10.4, 52.6 + o, 1.7) + circ(54.2, 49.4 + o, 1.7) + circ(53.6, 52.6 + o, 1.7);
  fr += el(24.6, 44.5 + o, 6.6, 2.4, 95) + el(39.4, 44.5 + o, 6.6, 2.4, 85);
  fr += el(24.4, 49.8 + o, 3.4, 1.6) + el(39.6, 49.8 + o, 3.4, 1.6) + circ(21.8, 51 + o, 1.6) + circ(24.5, 52.2 + o, 1.6) + circ(27.2, 51 + o, 1.6) + circ(36.8, 51 + o, 1.6) + circ(39.5, 52.2 + o, 1.6) + circ(42.2, 51 + o, 1.6);
  fr += el(22, 15 + o, 4, 4, 0, 1) + el(42, 15 + o, 4, 4, 0, 1) + el(32, 44.5 + o, 4.2, 5.5, 0, 1);
  s += P('t-a', fr);
  s += P('t-c', circ(22, 15 + o, 4) + circ(42, 15 + o, 4) + el(32, 44.5 + o, 4.2, 5.5));
  // pupils with a glint
  s += P('t-b', circ(23, 15.6 + o, 2.3) + circ(22.2, 14.7 + o, .8) + circ(41, 15.6 + o, 2.3) + circ(40.2, 14.7 + o, .8), ' fill-rule="evenodd"');
  // shade: right of head
  const ha = [32, 28 + o, 17, 10.5];
  s += P('t-b', `M${pt(ep(-35, ha))}A17 10.5 0 0 1 ${pt(ep(100, ha))}Q46 34 ${pt(ep(-35, ha))}Z`);
  s += P('t-b', circ(29, 21.5 + o, 1.2) + circ(35, 21.5 + o, 1.2));
  s += L(`M25 ${f(29.5 + o)}Q32 ${f(34.5 + o)} 39 ${f(29.5 + o)}`, 1.8);
  s += P('t-c', spark(55, 9, 4.2) + spark(8, 27, 2.6));
  add('frog', 'frog sitting on a lily pad', s);
}
// ---------- wheelbarrow
{
  let s = '';
  // far handle (behind)
  s += P('t-b', limb([[46.8, 36], [59, 29]], 2.8) + cap(53.5, 32.1, 59.5, 28.7, 4.2));
  // soil heap
  s += P('t-b', 'M6.5 27.2Q7 22.5 12 21.5Q14.5 16.5 21 16.8Q25.5 12.5 31.5 14.6Q38 12.8 41.5 18Q47.5 19 48.5 27.2Z' + circ(16.5, 23, 1) + circ(24.5, 19.5, .9) + circ(35, 19.5, 1.1) + circ(42, 23.5, .9) + circ(29.5, 23.5, 1), ' fill-rule="evenodd"');
  // sprout
  s += L('M30 15.5Q29.6 11 30.4 7.5', 2);
  s += P('t-a', 'M30.2 9.5Q25.5 4 21.5 6.5Q25 11.5 30.2 9.5ZM30.6 8.5Q33.5 2.5 39 3.5Q37 9.5 30.6 8.5Z');
  // tray + rim (one path) with a highlight slot
  s += P('t-a', rpoly([[3.5, 27], [51.5, 27], [51.5, 31.5], [3.5, 31.5]], 2) + rpoly([[6.5, 30], [48.5, 30], [42.5, 44], [19, 44]], 2.5) + rpoly([[11, 34], [14, 34], [20, 40.5], [17.5, 40.5]].reverse(), 1));
  s += P('t-c', rpoly([[11, 34], [14, 34], [20, 40.5], [17.5, 40.5]], 1));
  // tray shade + rim shade
  s += P('t-b', 'M45.7 36.5L42.5 44Q42 44.5 41 44.5H20.5Q19.5 44.5 18.8 43.8L16.3 40.7Q30 41 45.7 36.5Z');
  s += P('t-b', 'M3.5 30H51.5V30Q51.5 31.5 50 31.5H5Q3.5 31.5 3.5 30Z');
  // frame + near handle, leg
  s += P('t-a', limb([[22.5, 49.3], [38, 46.5], [60.3, 35.3]], 3.2) + limb([[37.5, 47], [40, 58]], 3) + cap(36.5, 58.8, 43.5, 58.8, 2.6));
  s += P('t-b', cap(54.4, 38.1, 60.3, 35.2, 4.6));
  // wheel: tyre ring, hub, axle
  s += P('t-b', circ(14, 50.5, 9.5) + circ(14, 50.5, 6), ' fill-rule="evenodd"');
  s += C('t-a', 14, 50.5, 6);
  s += P('t-b', circ(14, 50.5, 2) + 'M13.4 45H14.6V56H13.4ZM8.5 49.9H19.5V51.1H8.5Z');
  s += P('t-c', spark(56, 12, 4) + spark(8, 13, 2.6));
  add('wheelbarrow', 'wheelbarrow heaped with soil', s);
}
// ---------- wifi-signal
{
  let s = '';
  const cx = 32, cy = 44.5;
  const pa = (r, a) => `${f(cx + r * Math.cos(a * Math.PI / 180))} ${f(cy + r * Math.sin(a * Math.PI / 180))}`;
  // annular band from radius r0 to r1 between angles a1..a2 with round caps (cap = 1) or square ends
  const band = (r0, r1, a1, a2, rc = 0, rev = 0) => {
    const w = (r1 - r0) / 2, sw = rev ? 0 : 1, lg = a2 - a1 > 180 ? 1 : 0;
    const e1 = rc ? `A${f(w)} ${f(w)} 0 0 ${sw} ` : 'L', R1 = rev ? r0 : r1, R0 = rev ? r1 : r0, A1 = rev ? a2 : a1, A2 = rev ? a1 : a2;
    return `M${pa(R1, A1)}A${f(R1)} ${f(R1)} 0 ${lg} ${sw} ${pa(R1, A2)}${e1}${pa(R0, A2)}A${f(R0)} ${f(R0)} 0 ${lg} ${1 - sw} ${pa(R0, A1)}${e1}${pa(R1, A1)}Z`;
  };
  const arcs = [[11, 6], [20, 6], [29, 6]];
  const A1 = -138, A2 = -42;
  let main = '', shade = '', hi = '';
  for (const [r, w] of arcs) {
    main += band(r - w / 2, r + w / 2, A1, A2, 1);
    shade += band(r - w / 2, r - w / 2 + 2, A1 + 4, A2, 0);
    const h = [r + .4, r + 1.8, A1 + 7, A1 + 7 + 120 / r * 2.2];
    main += band(h[0], h[1], h[2], h[3], 1, 1);
    hi += band(h[0], h[1], h[2], h[3], 1);
  }
  const rcirc = (x, y, r) => `M${f(x - r)} ${f(y)}a${f(r)} ${f(r)} 0 1 1 ${f(2 * r)} 0a${f(r)} ${f(r)} 0 1 1 ${f(-2 * r)} 0Z`;
  const leds = [[40.5, 54.5], [44.5, 54.5], [48.5, 54.5]];
  // arcs, dot on a short post, router box (one path, same winding) with LED holes
  s += P('t-a', main + circ(cx, cy, 4.6) + cap(32, 47, 32, 52.5, 3.2) + rpoly([[13, 51.5], [51, 51.5], [51, 60], [13, 60]].reverse(), 3) + leds.map(p => rcirc(p[0], p[1], 1.1)).join(''));
  s += P('t-c', hi + leds.map(p => circ(p[0], p[1], 1.1)).join(''));
  s += P('t-b', shade + 'M36.4 43.3A4.6 4.6 0 0 1 28.8 47.8Q35 47.5 36.4 43.3Z' + 'M13 57H51V57Q51 60 48 60H16Q13 60 13 57Z' + cap(16.5, 60.6, 19.5, 60.6, 2.2) + cap(44.5, 60.6, 47.5, 60.6, 2.2) + 'M16.5 54h11v1.4h-11z');
  s += P('t-c', spark(55, 12, 4) + spark(9, 14, 2.6));
  add('wifi-signal', 'wifi fan of arcs over a dot', s);
}

fs.writeFileSync(process.argv[2] || new URL('../../icons/part10.json', import.meta.url), JSON.stringify(icons, null, 1));
console.log(icons.map(i => `${i.id} ${i.svg.length}`).join('\n'));
