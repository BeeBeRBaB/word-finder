// Generates part53.json (round 4): falling-feather, sleep-mask, running-shoes, exercise-bike, hiking-boots, spa-candles.
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
const EO = ' fill-rule="evenodd"';
const poly = pts => 'M' + pts.map(p => `${f(p[0])} ${f(p[1])}`).join('L') + 'Z';
const area = p => p.reduce((s, q, i) => { const r = p[(i + 1) % p.length]; return s + q[0] * r[1] - r[0] * q[1]; }, 0);
// winding: 'ccw' matches circ()/cap() (area < 0), 'cw' is the opposite (a nonzero hole)
const wind = (pts, rad, dir) => {
  const flip = dir === 'ccw' ? area(pts) > 0 : area(pts) < 0;
  if (!flip) return [pts, rad];
  return [pts.slice().reverse(), Array.isArray(rad) ? rad.slice().reverse() : rad];
};
const rp = (pts, rad, dir = 'ccw') => rpoly(...wind(pts, rad, dir));
const pl = (pts, dir = 'ccw') => poly(wind(pts, 0, dir)[0]);
const ellP = (cx, cy, rx, ry) => `M${f(cx - rx)} ${f(cy)}a${f(rx)} ${f(ry)} 0 1 0 ${f(2 * rx)} 0a${f(rx)} ${f(ry)} 0 1 0 ${f(-2 * rx)} 0Z`;
// map every coordinate pair of an absolute M/L/Q/C/T path through fn
const tp = (d, fn) => d.replace(/(-?\d*\.?\d+)[ ,]+(-?\d*\.?\d+)/g, (m, a, b) => { const [x, y] = fn(+a, +b); return `${f(x)} ${f(y)}`; });
const rot = (deg, px, py, ox, oy, s = 1) => { const a = deg * Math.PI / 180, c = Math.cos(a), sn = Math.sin(a);
  return p => { const x = (p[0] - px) * s, y = (p[1] - py) * s; return [ox + x * c - y * sn, oy + x * sn + y * c]; }; };

// ---------- falling-feather
{
  let s = '';
  s += R('t-b', 4, 55.5, 56, 4, 2);
  // speed lines above the ball
  s += L('M39.5 10V15.5M45 6.5V15.5M50.5 10V15.5', 2);
  // heavy bowling ball
  const bx = 45, by = 31, br = 11.5;
  const hl = 'M35.8 28Q36.8 22.2 42.4 20.6Q38.6 23.6 38.3 28.6Q37 29.8 35.8 28Z';
  s += P('t-a', circ(bx, by, br) + hl, EO);
  const pa = d => `${f(bx + br * Math.cos(d * Math.PI / 180))} ${f(by + br * Math.sin(d * Math.PI / 180))}`;
  s += P('t-b', `M${pa(-35)}A${br} ${br} 0 0 1 ${pa(125)}A14 14 0 0 0 ${pa(-35)}Z`);
  s += P('t-b', circ(42.8, 25.8, 1.9) + circ(48.4, 24.6, 1.9) + circ(46.2, 30, 2.1));
  s += P('t-c', hl);
  // feather, drifting at a tilt
  const vane = 'M0 -20Q5.2 -15 5.8 -7L2 -5L5.6 -2.6Q5.8 2 5.2 4.5L1.8 5.8L4.2 7.6Q3 10.6 1.2 12.2L-1.2 12.2Q-6.4 7 -6.2 -2L-2.2 -4.4L-5.6 -7.4Q-4.8 -16 0 -20Z';
  const quill = 'M0 -17L0.7 11L-0.7 11Z';
  let g = '';
  g += P('t-a', cap(0, 11.5, 0, 19.5, 1.8));
  g += P('t-a', vane + quill, EO);
  g += P('t-b', 'M1.2 -2L5.6 -2.6Q5.8 2 5.2 4.5L1.8 5.8L4.2 7.6Q3 10.6 1.2 12.2Z');
  g += P('t-c', quill);
  g += L('M-0.5 2L-5 -0.6M-0.5 -9L-4.2 -12M0.5 -11L3.8 -13.6M-1 13L-3.4 15M1 13L3.2 14.8', 1.1);
  s += `<g transform="translate(17.5 24) rotate(25) scale(1.08)">${g}</g>`;
  // downward arrows: short for the feather, long for the ball
  const arrow = (x, y1, y2) => cap(x, y1, x, y2 - 4, 3) + `M${f(x + 4.5)} ${f(y2 - 5.5)}L${f(x - 4.5)} ${f(y2 - 5.5)}L${f(x)} ${f(y2)}Z`;
  s += P('t-c', arrow(23, 42, 50) + arrow(45, 45, 54.5));
  s += P('t-c', spark(7, 8, 3.6) + spark(57.5, 48, 3));
  add('falling-feather', 'feather and heavy ball falling side by side with arrows', s);
}

// ---------- sleep-mask
{
  let s = '';
  const sc = (x, y) => [32 + (x - 32) * 1.12, 36 + (y - 36) * 1.12];
  const T = d => tp(d, sc);
  // elastic strap looping behind
  s += `<path class="ln" stroke-width="3.4" stroke-linecap="butt" d="M5.3 38.5C2 44 7 55 20 56.5Q32 58 44 56.5C57 55 62 44 58.7 38.5"/>`;
  const mask = 'M8 34C8 26 14 24 21 24.5Q27 25 32 27Q37 25 43 24.5C50 24 56 26 56 34C56 42 52 47 44 47.5Q38 48 35.5 43.5Q32 39.5 28.5 43.5Q26 48 20 47.5C12 47 8 42 8 34Z';
  const hl = 'M12.4 32Q13 27.6 18.6 27Q15 29 14.6 32.4Q13.4 33.4 12.4 32ZM36.4 31Q37.4 27.6 42 27.2Q38.8 29 38.4 31.6Q37.2 32.4 36.4 31Z';
  s += P('t-a', T(mask) + T(hl), EO);
  s += P('t-b', T('M9.5 40C12 45.5 15 47 20 47.5Q26 48 28.5 43.5Q32 39.5 35.5 43.5Q38 48 44 47.5C49 47 52 45.5 54.5 40C51 44 48 45 44 45Q39 45 36.5 41.2Q32 36.4 27.5 41.2Q25 45 20 45C16 45 13 44 9.5 40Z'));
  s += P('t-c', T(hl));
  // padded seam
  s += L(tp(mask, (x, y) => [32 + (x - 32) * .97, 35.6 + (y - 36) * .82]), 1.1);
  // closed eyes with lashes
  let e = '';
  for (const cx of [20, 44]) {
    e += `M${cx - 6} 35.5Q${cx} 41 ${cx + 6} 35.5`;
    for (const t of [.2, .5, .8]) {
      const x = (1 - t) * (1 - t) * (cx - 6) + 2 * t * (1 - t) * cx + t * t * (cx + 6), y = (1 - t) * (1 - t) * 35.5 + 2 * t * (1 - t) * 41 + t * t * 35.5;
      const dx = (t - .5) * 3.4;
      e += `M${f(x)} ${f(y)}L${f(x + dx)} ${f(y + 3)}`;
    }
  }
  s += L(T(e), 2);
  // Z z
  const Z = (x0, y0, w, h, t) => rpoly([[x0, y0], [x0 + w, y0], [x0 + w, y0 + t], [x0 + t * 1.5, y0 + h - t], [x0 + w, y0 + h - t], [x0 + w, y0 + h], [x0, y0 + h], [x0, y0 + h - t], [x0 + w - t * 1.5, y0 + t], [x0, y0 + t]], .7);
  s += P('t-a', Z(34, 4, 12, 12, 3.4) + Z(49.5, 11.5, 8, 8, 2.5));
  s += P('t-c', spark(9, 10, 3.8) + spark(25, 8, 2.6));
  add('sleep-mask', 'padded sleep mask with closed-eye lashes and Z z', s);
}

// ---------- running-shoes
// one trainer in local coords (heel at 0 0, ground y 0, facing right); the back one drops the small details
const shoe = full => {
  const up = [[0.5, -7], [0, -14], [2, -20.5], [6, -21.5], [12, -17.5], [15.5, -21.5], [19, -21], [30, -13.5], [38, -10], [42.5, -7]];
  const stripe = 'M4 -13Q12 -7.5 27 -12.8Q12 -10.2 6.5 -15Z';
  let o = '';
  o += P('t-b', poly([[1.3, -19], [2.2, -23.5], [4.8, -23], [4.6, -20]]));
  o += P('t-a', rpoly(up, [1, 2, 2, 1.5, 3, 1.5, 2, 4, 4, 2]) + stripe, EO);
  o += P('t-c', stripe);
  o += P('t-b', poly([[3, -19.8], [6, -20.8], [12, -16.6], [14.8, -19.6], [13.8, -15], [11.6, -14.2], [6.4, -17.8], [3.2, -17.2]])
    + (full ? rpoly([[31, -7], [42.6, -7], [40.2, -9.6], [35, -9.2]], 1.5) : ''));
  o += P('t-c', rpoly([[-0.8, -7], [42.8, -7], [44, -4.6], [43, -2.5], [-0.3, -2.5]], [2, 2, 1.5, 1, 1.5]));
  // outsole and lugs (both wound like circ)
  o += P('t-b', 'M-0.3 -2.5L0.6 0H41.6L43 -2.5Z' + 'M2 -.5' + 'v1.6h2v-1.6zm3.4 0'.repeat(11) + 'v1.6h2v-1.6z');
  if (full) o += L('M2.5 -4.8Q8.5 -3.4 14.5 -4.8T26.5 -4.8T38.5 -4.8', 1.1);
  let la = '';
  for (const x of [20.5, 24, 27.5]) { const ty = -21 + (x - 19) * 7.5 / 11; la += `M${f(x - 1.2)} ${f(ty - 1.8)}L${f(x + 1.6)} ${f(ty + 2.6)}`; }
  o += L(la, 1.6);
  return o;
};
{
  let s = '';
  s += L('M4 42.5H12M2.5 47.5H11M5 52.5H12.5', 2);
  s += `<g transform="translate(16 56.4)">${shoe(1)}</g>`;
  s += `<g transform="translate(7 29) scale(.78)">${shoe(0)}</g>`;
  s += P('t-c', spark(56.5, 9, 3.8) + spark(48, 22, 2.4));
  add('running-shoes', 'pair of running trainers with stripe, laces and chunky tread', s);
}

// ---------- exercise-bike
{
  let s = '';
  const dx = 47, dy = 40, dr = 10.5;
  const pa = (r, d) => `${f(dx + r * Math.cos(d * Math.PI / 180))} ${f(dy + r * Math.sin(d * Math.PI / 180))}`;
  // display screen, tilted toward the rider
  const dc = rot(-15, 0, 0, 36.5, 9.5);
  const disp = [[-5.4, -3.4], [5.4, -3.4], [5.4, 3.4], [-5.4, 3.4]].map(dc), scr = [[-3.8, -1.9], [3.8, -1.9], [3.8, 1.6], [-3.8, 1.6]].map(dc);
  // flywheel highlight, wound clockwise so it punches through under nonzero
  const hb = `M${pa(7.6, -75)}A7.6 7.6 0 0 1 ${pa(7.6, -22)}L${pa(5.8, -22)}A5.8 5.8 0 0 0 ${pa(5.8, -75)}Z`;
  let fr = '';
  fr += cap(13.5, 54.5, 21, 44, 5) + cap(21, 44, 18, 21, 4) + cap(20, 44, dx, dy, 5) + cap(33, 42, 32, 16, 4.6);
  fr += cap(32, 16, 43, 14, 3.4) + cap(43, 14, 47.5, 8.5, 3.4);
  fr += rp(disp, 1.4) + 'M35 12V15.5H37.5V12Z';
  fr += rp([[8.5, 19.5], [13, 16.8], [27, 18.2], [27.6, 20.6], [19, 22.6], [10.5, 22.6]], [2, 2.5, 1.5, 1.2, 2, 2]);
  fr += circ(dx, dy, dr);
  fr += 'M13.5 53.5Q11.5 53.5 11.5 55.5Q11.5 57.5 13.5 57.5H25Q27 57.5 27 55.5Q27 53.5 25 53.5Z' + 'M39 53.5Q37 53.5 37 55.5Q37 57.5 39 57.5H57Q59 57.5 59 55.5Q59 53.5 57 53.5Z';
  fr += pl(scr, 'cw') + hb;
  s += P('t-a', fr);
  s += P('t-c', poly(scr) + hb);
  // rim, fork, hub
  s += P('t-b', circ(dx, dy, dr) + circ(dx, dy, 8.3), EO);
  s += P('t-b', cap(dx, dy, 48, 54, 3.2) + circ(dx, dy, 2.8));
  // saddle underside, foot pads, grip, resistance knob, crank and pedal
  s += P('t-b', 'M10.6 21.2H19L27.4 19.6L27.6 20.6L19 22.6H10.5Z' + 'M12 57h4.5v2h-4.5zm10 0h4.5v2h-4.5zm15.5 0h4.5v2h-4.5zm16.5 0h4.5v2h-4.5z'
    + cap(45.2, 11.6, 47.5, 8.5, 3.4) + cap(32.6, 24, 37, 23, 2.8) + cap(27, 43, 30.5, 50, 2.4) + 'M27.3 49.4h6.5v2h-6.5z');
  s += P('t-b', circ(27, 43, 3.8) + circ(27, 43, 1.4), EO);
  // water bottle
  const hole = 'M4.4 42H5.8V45.5H4.4Z';
  s += P('t-a', 'M4.6 40.5L5 37.6H8.5L8.9 40.5Q10.5 40.5 10.5 42.1V56.2Q10.5 57.8 8.9 57.8H4.6Q3 57.8 3 56.2V42.1Q3 40.5 4.6 40.5Z' + hole, EO);
  s += P('t-c', hole);
  s += P('t-b', 'M4.6 34.6h4.3v3.2h-4.3zM3 47h7.5v5.5H3z');
  s += R('t-a', 5.6, 32, 2.3, 2.6, .8);
  s += P('t-c', spark(6.5, 8.5, 3.6) + spark(57, 18, 2.8));
  add('exercise-bike', 'stationary exercise bike with flywheel, display and water bottle', s);
}

// ---------- hiking-boots
// one boot in local coords (heel at 0 0, ground y 0, facing right)
const boot = () => {
  const up = 'M0.6 -4Q0 -4 0 -4.6L-0.3 -14Q0.9 -24 0.3 -32.5Q0.3 -33.5 1.3 -33.5L9.2 -33.8L9.6 -36.4Q9.8 -37.4 10.8 -37.2L13 -36.8Q13.9 -36.6 13.6 -35.8L12.6 -32V-27Q12.8 -21 13.8 -18Q16 -14 23.8 -10.4Q26.6 -8.6 26.2 -4.6Q26.1 -4 25.4 -4Z';
  const hl = 'M2.6 -29.5Q2.1 -24 2.8 -17.5Q4.3 -23.5 4.2 -29.5Z';
  let o = '';
  o += P('t-a', up + hl, EO);
  o += P('t-c', hl);
  o += P('t-b', 'M0.6 -33.2L11.8 -33.6L12.2 -30.6L0.8 -30.2ZM-0.2 -4L-0.3 -11.5H3.5L6.5 -4ZM16 -4H26.1Q26.4 -7.4 23.4 -9.6Q20.6 -6.4 16 -4Z');
  o += P('t-b', 'M-0.8 -4.2L-0.6 -0.6H26.4L27.8 -2.4L26.3 -4.2Z' + 'M0.3 -1' + 'v1.9h2.2v-1.9zm3.3 0'.repeat(7) + 'v1.9h2.2v-1.9z');
  let z = '';
  for (let k = 0; k <= 6; k++) { const t = k / 6, p = k % 2 ? [9.5 + 2.7 * t, -29.5 + 12.5 * t] : [12.3 + 2 * t, -30 + 12.8 * t]; z += (k ? 'L' : 'M') + `${f(p[0])} ${f(p[1])}`; }
  o += L(z + 'M12.2 -30.5Q16 -34 16.8 -31Q15.5 -29.5 12.2 -30.5Q15 -27 17 -26', 1.3);
  o += L('M0.8 -20Q7 -18.5 13.2 -21', 1.1);
  return o;
};
{
  let s = '';
  s += L('M3.5 59H52', 1.6);
  // trail sign
  s += P('t-b', 'M55.5 13.5h3.2v45.5h-3.2zM55.5 3.8h3.2v2.4h-3.2z');
  const mtn = pl([[42, 12], [45.5, 7.8], [47.5, 10.2], [49, 8.8], [52, 12]], 'cw');
  s += P('t-a', rp([[39, 6], [59.5, 6], [59.5, 13.5], [39, 13.5], [35.5, 9.75]], [1, 1, 1, 1, .8]) + mtn, EO);
  s += P('t-c', mtn);
  const b = boot();
  s += `<g transform="translate(5 56) scale(.92)">${b}</g>`;
  s += `<g transform="translate(52 57.2) rotate(18) scale(.84) translate(-26.5 -.9)">${b}</g>`;
  s += P('t-c', spark(8, 9, 3.6) + spark(27, 7, 2.4));
  add('hiking-boots', 'pair of laced hiking boots with lug soles and a trail sign', s);
}

// ---------- spa-candles
{
  let s = '';
  const G = 58, tw = { x0: 4, x1: 27, y0: 46, rx: 4.2 }, st = { cx: 48.5, cy: 52.5, rx: 11.5, ry: 5.5 };
  const stoneTop = x => st.cy - st.ry * Math.sqrt(Math.max(0, 1 - ((x - st.cx) / st.rx) ** 2));
  const ry = 1.8;
  const flame = (cx, fb, h, w) => `M${f(cx)} ${f(fb - h)}C${f(cx + w * .4)} ${f(fb - h * .6)} ${f(cx + w)} ${f(fb - h * .45)} ${f(cx + w)} ${f(fb - w)}A${f(w)} ${f(w)} 0 0 1 ${f(cx - w)} ${f(fb - w)}C${f(cx - w)} ${f(fb - h * .45)} ${f(cx - w * .4)} ${f(fb - h * .6)} ${f(cx)} ${f(fb - h)}Z`;
  // candle silhouettes, each cut along whatever stands in front of it
  const cA = { x: 7, w: 12.5, top: 32 }, cB = { x: 22, w: 13.5, top: 15 }, cC = { x: 39, w: 11.5, top: 24 };
  const topArc = c => `A${f(c.w / 2)} ${ry} 0 0 0 ${f(c.x)} ${c.top}Z`;
  const bodyA = `M${cA.x} ${cA.top}V${tw.y0}H${f(cA.x + cA.w)}V${cA.top}` + topArc(cA);
  const ex = 27 + tw.rx * Math.sqrt(1 - ((G - .4 - 52) / 6) ** 2);
  const bodyB = `M${cB.x} ${cB.top}V${tw.y0}H27A${tw.rx} 6 0 0 1 ${f(ex)} ${G - .4}H${f(cB.x + cB.w - 1.5)}Q${f(cB.x + cB.w)} ${G - .4} ${f(cB.x + cB.w)} ${G - 1.9}V${cB.top}` + topArc(cB);
  const xC1 = cC.x + cC.w;
  const bodyC = `M${cC.x} ${cC.top}V${f(stoneTop(cC.x))}A${st.rx} ${st.ry} 0 0 1 ${f(xC1)} ${f(stoneTop(xC1))}V${cC.top}` + topArc(cC);
  const pool = c => ellP(c.x + c.w / 2, c.top + .2, c.w / 2 - 1.7, ry * .62);
  s += P('t-a', bodyA + pool(cA) + bodyB + pool(cB) + bodyC + pool(cC), EO);
  s += P('t-c', pool(cA) + pool(cB) + pool(cC));
  // shaded right sides
  const sh = (c, bot) => `M${f(c.x + c.w - 3)} ${f(c.top + 1.4)}Q${f(c.x + c.w - .6)} ${f(c.top + 1)} ${f(c.x + c.w)} ${c.top}` + bot;
  s += P('t-b', sh(cA, `V${tw.y0}H${f(cA.x + cA.w - 3)}Z`)
    + sh(cB, `V${G - 1.9}Q${f(cB.x + cB.w)} ${G - .4} ${f(cB.x + cB.w - 1.5)} ${G - .4}H${f(cB.x + cB.w - 3)}Z`)
    + sh(cC, `V${f(stoneTop(xC1))}A${st.rx} ${st.ry} 0 0 0 ${f(xC1 - 3)} ${f(stoneTop(xC1 - 3))}Z`));
  // wicks and flames
  let wk = '', fl = '', fi = '';
  for (const c of [cA, cB, cC]) {
    const cx = c.x + c.w / 2;
    wk += `M${f(cx)} ${c.top}V${c.top - 2.6}`;
    fl += flame(cx, c.top - 1.6, 9, 3.2); fi += flame(cx, c.top - 2.6, 5, 1.5);
  }
  s += L(wk, 1.4);
  s += P('t-a', fl + fi, EO) + P('t-c', fi);
  // rolled towel with a flower tucked in
  const fcx = 15.8, fcy = 52;
  // five round petals: arcs bulging out between points on a small inner ring
  let flower = '';
  for (let k = 0; k <= 5; k++) {
    const a = (-90 + 36 + k * 72) * Math.PI / 180, x = fcx + 1.6 * Math.cos(a), y = fcy + 1.6 * Math.sin(a);
    flower += k ? `A2.1 2.1 0 1 1 ${f(x)} ${f(y)}` : `M${f(x)} ${f(y)}`;
  }
  flower += 'Z';
  const towel = `M8 ${tw.y0}H27A${tw.rx} 6 0 0 0 27 ${G}H8Q4 ${G} 4 ${G - 4}V${tw.y0 + 4}Q4 ${tw.y0} 8 ${tw.y0}Z`;
  s += P('t-a', towel + flower, EO);
  s += P('t-b', `M8.6 ${tw.y0}h2.2v12h-2.2ZM21.2 ${tw.y0}h2.2v12h-2.2Z`);
  s += P('t-c', flower + ellP(27, 52, tw.rx, 6));
  s += C('t-a', fcx, fcy, 1.5);
  s += L('M27 52A.7 1 0 0 0 28.4 52A1.3 1.9 0 0 0 25.8 52A2 2.9 0 0 0 29.8 52', 1.2);
  // smooth stone
  const shl = 'M40.5 50.4Q43.5 48.2 49 48.1Q45 49.3 42.4 51.4Q41 51.6 40.5 50.4Z';
  s += P('t-a', ellP(st.cx, st.cy, st.rx, st.ry) + shl, EO);
  s += P('t-b', `M${st.cx - st.rx} ${st.cy}A${st.rx} ${st.ry} 0 0 0 ${st.cx + st.rx} ${st.cy}A${st.rx} 3.6 0 0 1 ${st.cx - st.rx} ${st.cy}Z`);
  s += P('t-c', shl);
  s += P('t-c', spark(8.5, 10, 3.6) + spark(56, 13, 3) + spark(56.5, 34, 2.2));
  add('spa-candles', 'three pillar candles with a rolled towel, flower and stone', s);
}

fs.writeFileSync(process.argv[2] || new URL('../../icons/part53.json', import.meta.url), JSON.stringify(icons, null, 1));
console.log(icons.map(i => `${i.id} ${i.svg.length}`).join('\n'));
