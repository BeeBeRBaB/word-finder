// Generates part55.json (round 4).
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
const poly = pts => 'M' + pts.map(p => `${f(p[0])} ${f(p[1])}`).join('L') + 'Z';
// Sutherland-Hodgman: keep the part of pts where a*x + b*y <= c
const clip = (pts, a, b, c) => {
  const out = [], v = p => a * p[0] + b * p[1] - c;
  pts.forEach((p, i) => {
    const q = pts[(i + 1) % pts.length], vp = v(p), vq = v(q);
    if (vp <= 0) out.push(p);
    if ((vp < 0 && vq > 0) || (vp > 0 && vq < 0)) { const t = vp / (vp - vq); out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]); }
  });
  return out;
};
const pine = (cx, top, bot, w, trunk = 4) => {
  const h = bot - top - trunk, r = [[cx, top], [cx + w * .28, top + h * .34], [cx + w * .13, top + h * .34], [cx + w * .4, top + h * .68], [cx + w * .2, top + h * .68], [cx + w * .5, top + h], [cx + 1.3, top + h], [cx + 1.3, bot]];
  return [...r, ...r.slice(1).reverse().map(([x, y]) => [2 * cx - x, y])];
};

// ---------- orbit-path
{
  let s = '';
  const cx = 31, cy = 34.5, A = 27.5, B = 11.5, th = -20 * Math.PI / 180, pr = 13;
  const pt = t => { const x = A * Math.cos(t), y = B * Math.sin(t); return [cx + x * Math.cos(th) - y * Math.sin(th), cy + x * Math.sin(th) + y * Math.cos(th)]; };
  const tm = .78, mo = pt(tm), mr = 5.5, ta = -.62;
  const dist = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]);
  let back = '', front = '';
  for (let t = ta + .1; t < ta + 2 * Math.PI - .3; t += .34) {
    const ps = [t, t + .1, t + .2].map(pt);
    if (ps.some(p => dist(p, mo) < mr + 1.6)) continue;
    const seg = `M${f(ps[0][0])} ${f(ps[0][1])}Q${f(2 * ps[1][0] - (ps[0][0] + ps[2][0]) / 2)} ${f(2 * ps[1][1] - (ps[0][1] + ps[2][1]) / 2)} ${f(ps[2][0])} ${f(ps[2][1])}`;
    if (Math.sin(t + .1) < 0) { if (ps.some(p => dist(p, [cx, cy]) < pr + 1.6)) continue; back += seg; } else front += seg;
  }
  s += L(back, 2.6);
  // planet with shaded crescent and craters
  s += C('t-a', cx, cy, pr);
  const a1 = -40 * Math.PI / 180, a2 = a1 + Math.PI, p1 = [cx + pr * Math.cos(a1), cy + pr * Math.sin(a1)], p2 = [cx + pr * Math.cos(a2), cy + pr * Math.sin(a2)];
  s += P('t-b', `M${f(p1[0])} ${f(p1[1])}A${pr} ${pr} 0 0 1 ${f(p2[0])} ${f(p2[1])}A${f(pr * 1.7)} ${f(pr * 1.7)} 0 0 0 ${f(p1[0])} ${f(p1[1])}Z` + circ(cx - 5, cy - 4, 2.4) + circ(cx + 1.5, cy - 7.5, 1.5) + circ(cx - 6.5, cy + 3.5, 1.3));
  s += L(front, 2.6);
  // moon
  s += C('t-a', mo[0], mo[1], mr);
  s += P('t-b', `M${f(mo[0] + 3.5)} ${f(mo[1] - 3.5)}A${mr} ${mr} 0 0 1 ${f(mo[0] - 3.5)} ${f(mo[1] + 3.5)}A7 7 0 0 0 ${f(mo[0] + 3.5)} ${f(mo[1] - 3.5)}Z` + circ(mo[0] - 1.6, mo[1] - 1.4, 1.2));
  // arrowhead ahead of the moon (moving toward smaller t)
  const tp = pt(ta), q = pt(ta + .01), ux = (tp[0] - q[0]), uy = (tp[1] - q[1]), ul = Math.hypot(ux, uy), u = [ux / ul, uy / ul], n = [-u[1], u[0]];
  s += P('t-b', poly([[tp[0] + u[0] * 3.6, tp[1] + u[1] * 3.6], [tp[0] - u[0] * 2.8 + n[0] * 3.8, tp[1] - u[1] * 2.8 + n[1] * 3.8], [tp[0] - u[0] * 1.2, tp[1] - u[1] * 1.2], [tp[0] - u[0] * 2.8 - n[0] * 3.8, tp[1] - u[1] * 2.8 - n[1] * 3.8]]));
  s += P('t-c', poly(star(11.5, 12, 5.5, 2.4)) + spark(56, 9, 3.2) + spark(10, 55, 2.8));
  add('orbit-path', 'planet with a moon on a tilted dashed orbit and a star', s);
}

// ---------- meteor-shower
{
  let s = '';
  const d = [.811, -.584], n = [.584, .811];
  const tail = (hx, hy, Lt, r) => {
    const a = .25, ca = Math.cos(a) * r, sa = Math.sin(a) * r;
    const p1 = [hx + n[0] * ca + d[0] * sa, hy + n[1] * ca + d[1] * sa], p2 = [hx - n[0] * ca + d[0] * sa, hy - n[1] * ca + d[1] * sa];
    const E = [hx + d[0] * Lt, hy + d[1] * Lt], c1 = [hx + d[0] * Lt * .35 + n[0] * r * .9, hy + d[1] * Lt * .35 + n[1] * r * .9], c2 = [hx + d[0] * Lt * .35 - n[0] * r * .9, hy + d[1] * Lt * .35 - n[1] * r * .9];
    return `M${f(p1[0])} ${f(p1[1])}Q${f(c1[0])} ${f(c1[1])} ${f(E[0])} ${f(E[1])}Q${f(c2[0])} ${f(c2[1])} ${f(p2[0])} ${f(p2[1])}A${f(r)} ${f(r)} 0 1 0 ${f(p1[0])} ${f(p1[1])}Z`;
  };
  const ms = [[14, 23.9, 28, 2.8], [21, 32, 36, 3.4], [29, 38.4, 28, 2.8], [43, 40.2, 18, 2.3], [8, 16.2, 13, 1.7]];
  let rim = '', body = '', core = '';
  for (const [x, y, Lt, r] of ms) {
    if (r > 2) rim += tail(x, y, Lt, r + 1.5) + tail(x, y, Lt * .8, r);
    body += tail(x, y, r > 2 ? Lt * .8 : Lt, r) + (r > 2 ? tail(x, y, Lt * .45, r * .5) : '');
    if (r > 2) core += tail(x, y, Lt * .45, r * .5);
  }
  s += P('t-b', rim, ' fill-rule="evenodd"');
  s += P('t-a', body, ' fill-rule="evenodd"');
  s += P('t-c', core);
  // hill with a few pines
  s += P('t-b', 'M3.5 60V53Q13 46 25 50Q36 54 45 48.5Q53 44.5 60.5 47.5V60Z' + poly(pine(50, 38.5, 48, 6.5, 1.6)) + poly(pine(56, 40.5, 48, 6, 1.6)) + poly(pine(10, 44, 51, 5.5, 1.4)));
  s += P('t-c', spark(53, 32, 2.8) + spark(6, 6.5, 2.4) + circ(36, 8, .9) + circ(9, 42, .9) + circ(60, 13, .8));
  add('meteor-shower', 'meteors streaking down-left with fiery tails over a hill', s);
}

// ---------- park-sign
{
  let s = '';
  const bx0 = 11, bx1 = 53, by0 = 22.5, by1 = 45;
  // peaks behind, snow cut out
  const snow1 = [[24, 6.9], [27.2, 10.1], [25.6, 9.4], [24, 11], [22.4, 9.6], [20.8, 10.1]];
  const snow2 = [[38, 8.4], [40.6, 10.2], [39.4, 9.9], [38.2, 11.1], [36.8, 10], [35.6, 10.2]];
  s += P('t-a', rpoly([[9, 21], [24, 6], [31, 13], [38, 7.5], [55, 21]], [.5, 1, 1, 1, .5]) + poly(snow1) + poly(snow2), ' fill-rule="evenodd"');
  s += P('t-c', poly(snow1) + poly(snow2));
  s += P('t-b', poly([[27.2, 10.1], [31, 13], [29.5, 21], [25, 21], [25.8, 13.5]]) + poly([[40.6, 10.2], [45, 13.5], [46, 21], [40.5, 21], [40.2, 14]]));
  // pines peeking over the board, posts either side
  s += P('t-b', poly(clip(pine(17.5, 8, 30, 10.5), 0, 1, 21)) + poly(clip(pine(48, 11, 30, 9.5), 0, 1, 21)) + poly(clip(pine(32, 15, 30, 7), 0, 1, 21))
    + rpoly([[5.5, 17], [10.5, 17], [10.5, 58.5], [5.5, 58.5]], [2.5, 2.5, 0, 0]) + rpoly([[53.5, 17], [58.5, 17], [58.5, 58.5], [53.5, 58.5]], [2.5, 2.5, 0, 0]));
  // the board, with the carved mountain, sun and pine cut out
  s += P('t-a', rpoly([[bx0, by0], [bx1, by0], [bx1, by1], [bx0, by1]], 1) + rpoly([[14.5, 40.5], [23, 27.5], [26.8, 32.5], [30.6, 27.8], [39, 40.5]], [.6, 1, .8, 1, .6]) + circ(35.8, 28.2, 2.2) + poly(pine(45.2, 26.5, 41, 10, 2.5)), ' fill-rule="evenodd"');
  s += R('t-b', bx0, 42.5, bx1 - bx0, 2.5);
  s += L('M3.5 59H60.5', 1.4) + L('M18 59L17 56.5M20 59V56M44 59V56M46 59L47 56.5', 1.2);
  s += P('t-c', spark(52.5, 7, 3.2) + spark(9, 9, 2.4));
  add('park-sign', 'wooden national park entrance sign with a carved mountain and pine', s);
}

// ---------- curly-braces
{
  let s = '';
  const brace = (sx, top, bot, dir) => {
    const mid = (top + bot) / 2, X = v => f(sx + dir * v), w = 3, e = 8.5, et = 5.6;
    return `M${X(e)} ${f(top)}L${X(e)} ${f(top + et)}Q${X(w)} ${f(top + et)} ${X(w)} ${f(top + et + 4.5)}L${X(w)} ${f(mid - 5)}Q${X(w)} ${f(mid)} ${X(-2.5)} ${f(mid)}Q${X(w)} ${f(mid)} ${X(w)} ${f(mid + 5)}L${X(w)} ${f(bot - et - 4.5)}Q${X(w)} ${f(bot - et)} ${X(e)} ${f(bot - et)}L${X(e)} ${f(bot)}Q${X(-w)} ${f(bot)} ${X(-w)} ${f(bot - 8)}L${X(-w)} ${f(mid + 5)}Q${X(-w)} ${f(mid)} ${X(-9.5)} ${f(mid)}Q${X(-w)} ${f(mid)} ${X(-w)} ${f(mid - 5)}L${X(-w)} ${f(top + 8)}Q${X(-w)} ${f(top)} ${X(e)} ${f(top)}Z`;
  };
  const br = brace(16.5, 12, 52, 1) + brace(47.5, 12, 52, -1);
  const code = rpoly([[26.5, 30.6], [31.4, 30.6], [31.4, 33.4], [26.5, 33.4]], 1.2);
  const cur = rpoly([[34, 25.5], [37, 25.5], [37, 38.5], [34, 38.5]], 1);
  s += P('t-b', rpoly([[4, 4], [60, 4], [60, 60], [4, 60]], 9) + br + code + cur, ' fill-rule="evenodd"');
  s += P('t-a', br + cur);
  s += P('t-c', code);
  add('curly-braces', 'bold curly braces with a cursor and a code line on a dark tile', s);
}

// ---------- flatbed-trailer
{
  let s = '';
  // crates with planks and straps
  s += P('t-a', rpoly([[5.5, 25], [17.5, 25], [17.5, 41], [5.5, 41]], 1) + rpoly([[18.8, 31], [27.5, 31], [27.5, 41], [18.8, 41]], 1));
  s += P('t-b', 'M5.5 30.5H17.5V31.4H5.5ZM5.5 35.8H17.5V36.7H5.5ZM18.8 35.6H27.5V36.5H18.8Z' + 'M10.6 25H12.6V41H10.6ZM22.2 31H24.2V41H22.2Z' + 'M9.8 32.2H13.4V35H9.8ZM21.4 37.4H25V40.2H21.4Z');
  // deck, mudguard, drawbar, hitch ball and receiver
  s += P('t-b', rpoly([[4.5, 41], [28.5, 41], [28.5, 44.5], [4.5, 44.5]], .8) + 'M9.4 47.5A6.8 6.8 0 0 1 22.6 47.5H20.6A4.8 4.8 0 0 0 11.4 47.5Z' + cap(27, 43, 31.8, 44.6, 2.2) + circ(32.3, 44.4, 1.8) + rpoly([[31.5, 45.4], [34.5, 45.4], [34.5, 47.4], [31.5, 47.4]], .4));
  // car, windows and headlight cut out
  const win = rpoly([[38.3, 37], [40.2, 31.2], [43.6, 31.2], [43.6, 37]], .7) + rpoly([[45.3, 31.2], [47.5, 31.2], [51.2, 37], [45.3, 37]], .7) + 'M58.3 40.3H60.5V42.6H58.3Z';
  s += P('t-a', 'M60.5 41V49Q60.5 50 59.5 50A5.8 5.8 0 0 0 47.9 50H46.3A5.8 5.8 0 0 0 34.7 50H35Q34 50 34 49V40Q34 38.2 35.6 37.8L37.6 30.6Q38.1 29 39.7 29H46.3Q47.8 29 48.7 30.4L53.2 37.2L57.6 38Q60.5 38.6 60.5 41Z' + win, ' fill-rule="evenodd"');
  s += P('t-c', win);
  s += P('t-b', 'M34 45.5H35.8A5.8 5.8 0 0 0 34.7 50H35Q34 50 34 49ZM46.6 45.5H47.6A5.8 5.8 0 0 0 47.1 47H46.8A5.8 5.8 0 0 0 46.6 45.5ZM58.4 45.5H60.5V49Q60.5 50 59.5 50A5.8 5.8 0 0 0 58.4 45.5Z' + rpoly([[34, 39.6], [35.4, 39.6], [35.4, 42.4], [34, 42.4]], .4));
  s += L('M44.5 38V44.5', 1.2);
  // wheels
  for (const [x, r] of [[16, 5.2], [40.5, 4.8], [53.7, 4.8]]) {
    s += P('t-b', circ(x, 50, r) + circ(x, 50, r * .45), ' fill-rule="evenodd"');
    s += C('t-c', x, 50, r * .45);
    s += C('t-b', x, 50, 1);
  }
  s += L('M4 57.5H60', 1.2);
  s += P('t-c', spark(55, 13, 4) + spark(36, 16, 2.4));
  add('flatbed-trailer', 'car towing a flatbed trailer with strapped crates', s);
}

// ---------- car-ferry
{
  let s = '';
  // hull with the open vehicle deck, superstructure and funnel
  s += P('t-a', rpoly([[4.5, 27], [48.5, 27], [50, 31], [8.5, 31], [8.5, 41], [51, 41], [51, 43], [47, 50.5], [7.5, 50.5], [4.5, 46]], [.6, 1, .4, .8, .8, .4, 1, 2, 1.5, .6]));
  const ww = 'M25 20.2H28V23H25ZM29.5 20.2H32.5V23H29.5ZM34 20.2H37V23H34ZM38.5 20.2H40.2L42 23H38.5Z';
  s += P('t-a', rpoly([[22, 27.5], [22, 18], [40.5, 18], [45, 23.5], [45, 27.5]], [0, 1, 1, .8, 0]) + ww + rpoly([[12, 27.5], [10, 11], [18, 11], [20, 27.5]], [0, .8, .8, 0]), ' fill-rule="evenodd"');
  s += P('t-c', ww);
  s += P('t-b', 'M10 11H18L18.5 15H10.5ZM11 19H19L19.2 21H11.2Z' + 'M5.8 46H49.6L47 50.5H7.5Z');
  s += L('M33.5 18V11.5M30.5 13.5H36.5', 1.4);
  // two cars on the vehicle deck
  const car = x => `M${f(x)} 39.6V37.4Q${f(x)} 36.2 ${f(x + 1.2)} 36L${f(x + 3)} 33.4Q${f(x + 3.5)} 32.8 ${f(x + 4.3)} 32.8H${f(x + 8.6)}Q${f(x + 9.4)} 32.8 ${f(x + 9.9)} 33.5L${f(x + 11.6)} 36Q${f(x + 13.2)} 36.3 ${f(x + 13.2)} 37.6V39.6Z`;
  const cw = x => rpoly([[x + 3.9, 35.6], [x + 4.8, 34], [x + 6.5, 34], [x + 6.5, 35.6]], .3) + rpoly([[x + 7.6, 34], [x + 9, 34], [x + 10.1, 35.6], [x + 7.6, 35.6]], .3);
  s += P('t-a', car(13) + car(30.5) + cw(13) + cw(30.5), ' fill-rule="evenodd"');
  s += P('t-b', circ(16.3, 39.6, 1.9) + circ(23.3, 39.6, 1.9) + circ(33.8, 39.6, 1.9) + circ(40.8, 39.6, 1.9));
  // lowered bow ramp and its chain
  s += P('t-b', cap(50.5, 42, 59.5, 47.8, 2.6));
  s += L('M48.6 28L59 46.5', 1);
  s += L('M5 54.5Q8.5 52.5 12 54.5T19 54.5T26 54.5T33 54.5T40 54.5T47 54.5T54 54.5T59 54.5M12 58.5Q15.5 56.5 19 58.5T26 58.5T33 58.5T40 58.5T47 58.5T52 58.5', 1.8);
  s += P('t-c', spark(54, 12, 4) + spark(28, 9, 2.4));
  add('car-ferry', 'car ferry with a lowered bow ramp and cars on deck', s);
}

fs.writeFileSync(process.argv[2] || new URL('../../icons/part55.json', import.meta.url), JSON.stringify(icons, null, 1));
