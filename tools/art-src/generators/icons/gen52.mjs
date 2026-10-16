// Generates part52.json (round 4): synthesizer, treble-clef, dragonfly, suburban-house, town-square, promenade.
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
const rr = (x, y, w, h) => `M${f(x)} ${f(y)}h${f(w)}v${f(h)}h${f(-w)}Z`;
// rotated ellipse as a path (for evenodd holes)
const ellP = (cx, cy, rx, ry, rot = 0) => {
  const a = rot * Math.PI / 180, ux = Math.cos(a) * rx, uy = Math.sin(a) * rx;
  return `M${f(cx - ux)} ${f(cy - uy)}A${f(rx)} ${f(ry)} ${f(rot)} 1 0 ${f(cx + ux)} ${f(cy + uy)}A${f(rx)} ${f(ry)} ${f(rot)} 1 0 ${f(cx - ux)} ${f(cy - uy)}Z`;
};
// Catmull-Rom through [x,y,w] points, n samples per segment
const crs = (pts, n) => {
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(i - 1, 0)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(i + 2, pts.length - 1)];
    for (let k = 0; k < n; k++) {
      const t = k / n, t2 = t * t, t3 = t2 * t;
      const q = j => 0.5 * (2 * p1[j] + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3);
      out.push([q(0), q(1), p1[2] + (p2[2] - p1[2]) * t]);
    }
  }
  out.push(pts[pts.length - 1]); return out;
};
const ribbon = s => {
  const L = [], Rt = [];
  s.forEach((p, i) => {
    const a = s[Math.max(i - 1, 0)], b = s[Math.min(i + 1, s.length - 1)];
    const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, nx = -dy / l * p[2] / 2, ny = dx / l * p[2] / 2;
    L.push([p[0] + nx, p[1] + ny]); Rt.push([p[0] - nx, p[1] - ny]);
  });
  return poly([...L, ...Rt.reverse()]);
};

// ---------- synthesizer
{
  let s = '', g = '';
  const X0 = 7, X1 = 57, Y0 = 16, YF = 45;
  // front edge (thickness)
  g += P('t-b', rpoly([[X0, YF - 2], [X1, YF - 2], [X1, 50], [X0, 50]], [0, 0, 2.5, 2.5]));
  // body: screen, slider caps and keybed cut out
  const scr = rr(10.5, 19, 12, 7.5);
  const caps = [[44, 21.6], [48.5, 24.6], [53, 19.6]];
  const capH = (x, y) => rr(x - 1.8, y - 1.1, 3.6, 2.2);
  const kb = rr(14, 30.5, 41.5, 13);
  g += P('t-a', rpoly([[X0, Y0], [X1, Y0], [X1, YF], [X0, YF]], 3) + scr + kb + caps.map(c => capH(...c)).join(''), ' fill-rule="evenodd"');
  // screen with waveform
  g += P('t-c', scr);
  g += L('M12 22.8q1.2 -3 2.4 0t2.4 0t2.4 0t2.4 0', 1.2);
  // knobs with notch
  let kn = '';
  for (const [x, y] of [[27, 20.6], [33, 20.6], [39, 20.6], [27, 26.4], [33, 26.4], [39, 26.4]].slice(0, 6)) kn += circ(x, y, 2.3) + rr(x - .45, y - 2, .9, 1.7);
  g += P('t-b', kn, ' fill-rule="evenodd"');
  // slider tracks around caps
  let tr = '';
  for (const [x, y] of caps) tr += rr(x - .6, 18.5, 1.2, y - 1.6 - 18.5) + rr(x - .6, y + 1.6, 1.2, 28 - y - 1.6);
  g += P('t-b', tr);
  g += P('t-c', caps.map(c => capH(...c)).join(''));
  // white keys
  const kw = 41.5 / 12; let wk = '', bk = '';
  for (let i = 0; i < 12; i++) wk += rr(14 + i * kw + .3, 30.5, kw - .6, 13);
  g += P('t-c', wk);
  for (const i of [0, 1, 3, 4, 5, 7, 8, 10]) bk += rr(14 + (i + 1) * kw - 1.15, 30.5, 2.3, 7.8);
  g += P('t-b', bk);
  // pitch and mod wheels
  g += P('t-b', rpoly([[8.6, 32], [10.6, 32], [10.6, 42], [8.6, 42]], .9) + rpoly([[11.2, 32], [13.2, 32], [13.2, 42], [11.2, 42]], .9));
  // feet
  g += P('t-b', rr(10, 49, 4, 2.5) + rr(50, 49, 4, 2.5));
  s += `<g transform="rotate(-13 32 34)">${g}</g>`;
  s += P('t-c', spark(8, 9, 3.5) + spark(57, 57, 3));
  add('synthesizer', 'synth keyboard at an angle with knobs, sliders and a waveform screen', s);
}

// ---------- treble-clef
{
  let s = '';
  const A = [[21, 37.6, 2.6], [25, 34.8, 4], [29, 39, 5.4], [26.6, 45.4, 6], [20, 47.4, 6], [13.6, 43.4, 5.6], [12.4, 35.6, 5.2], [16, 28, 4.8], [23, 21.5, 4.6], [28.6, 15.4, 4.2], [28.8, 9, 3.8], [25.4, 5, 3.4]];
  const B = [[25.4, 5, 3.4], [21.4, 6.8, 3.6], [19.8, 13.6, 4], [20.8, 28, 4.4], [22.4, 41, 4.6], [23.4, 51, 4.6], [21.6, 56.4, 4.2], [17.4, 57.8, 3.8]];
  const ball = [14.6, 54.6, 4];
  const sa = crs(A, 3), sb = crs(B, 3);
  s += P('t-a', ribbon(sa)) + P('t-a', ribbon(sb)) + C('t-a', 25.4, 5, 1.7) + C('t-a', ...ball);
  // notes: beamed pair
  const heads = [[40.5, 41, -22], [52.5, 35, -22]];
  const stems = [[44, 40, 44, 16.5], [56, 34, 56, 13]];
  let nt = '';
  for (const [x, y, r] of heads) nt += ellP(x, y, 4.1, 3, r);
  for (const [x1, y1, x2, y2] of stems) nt += rr(x1 - .9, y2, 1.8, y1 - y2);
  nt += poly([[43.1, 13.5], [56.9, 9.5], [56.9, 14], [43.1, 18]]);
  s += P('t-a', nt);
  // staff lines with gaps where the clef and notes sit
  const dense = [...crs(A, 12), ...crs(B, 12)];
  const gap = 1.1;
  const covered = (x, y) => {
    for (let i = 0; i < dense.length - 1; i++) {
      const a = dense[i], b = dense[i + 1], dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy || 1;
      const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / l2));
      if (Math.hypot(x - a[0] - t * dx, y - a[1] - t * dy) < a[2] / 2 + gap) return true;
    }
    if (Math.hypot(x - ball[0], y - ball[1]) < ball[2] + gap) return true;
    for (const [hx, hy, r] of heads) {
      const c = Math.cos(-r * Math.PI / 180), sn = Math.sin(-r * Math.PI / 180), u = (x - hx) * c - (y - hy) * sn, v = (x - hx) * sn + (y - hy) * c;
      if ((u / (4.1 + gap)) ** 2 + (v / (3 + gap)) ** 2 < 1) return true;
    }
    for (const [x1, y1, , y2] of stems) if (Math.abs(x - x1) < .9 + gap && y > y2 - gap && y < y1) return true;
    return false;
  };
  let st = '';
  for (const y of [20, 26, 32, 38, 44]) {
    let run = null;
    for (let x = 5; x <= 59.01; x += .1) {
      const c = covered(x, y - .8) || covered(x, y + .8) || covered(x, y);
      if (!c && run === null) run = x;
      if ((c || x > 58.95) && run !== null) { if (x - run > .6) st += rr(run, y - .8, x - run, 1.6); run = null; }
    }
  }
  s += P('t-b', st);
  // highlight on the clef body
  s += P('t-c', spark(8, 10, 3.5) + spark(57, 54, 3));
  add('treble-clef', 'bold treble clef on a five-line staff with two beamed notes', s);
}

// ---------- dragonfly
{
  let s = '';
  // reed, broken where the tail crosses it, plus two leaf blades
  const ry = x => 53 - (x - 5) * 8 / 54;
  s += P('t-b', cap(5.5, ry(5.5), 27.6, ry(27.6), 2.4) + cap(36.4, ry(36.4), 47, ry(47), 2.4) + cap(46, ry(46), 56, ry(56), 4.6) + cap(55, ry(55), 59.4, ry(59.4), 1.2));
  // wings with panes cut out
  const wing = (cx, cy, rx, ry2, rot) => {
    const a = rot * Math.PI / 180, c = Math.cos(a), sn = Math.sin(a), M = (u, v) => [cx + u * c - v * sn, cy + u * sn + v * c];
    const base = cx < 32 ? 1 : -1; // base is at +u for left wings
    let d = ellP(cx, cy, rx, ry2, rot);
    const vm = u => ry2 * Math.sqrt(Math.max(0, 1 - (u / rx) ** 2)) - 1;
    const cols = [-.86, -.58, -.3, -.02].map(k => k * rx * base);
    const w = rx * .25;
    for (const u0 of cols) for (const sg of [-1, 1]) {
      const ua = u0 + .5, ub = u0 + w * base - .5 * base;
      const u1 = Math.min(ua, ub), u2 = Math.max(ua, ub);
      const pts = [[u1, sg * .7], [u2, sg * .7], [u2, sg * vm(u2)], [u1, sg * vm(u1)]];
      if (vm(u1) < 1.6 || vm(u2) < 1.6) continue;
      d += poly(pts.map(p => M(...p)));
    }
    return P('t-a', d, ' fill-rule="evenodd"');
  };
  s += wing(18.6, 15.6, 14, 4.4, 9) + wing(45.4, 15.6, 14, 4.4, -9);
  s += wing(19.2, 25.2, 13.2, 4.8, -13) + wing(44.8, 25.2, 13.2, 4.8, 13);
  // abdomen
  s += P('t-a', rpoly([[29.8, 23], [34.2, 23], [33.6, 57.5], [32, 59.5], [30.4, 57.5]], [1.5, 1.5, 1, .8, 1]));
  let bands = '';
  for (let y = 28; y < 57; y += 3.6) { const hw = 2.2 - (y - 23) * .018; bands += rr(32 - hw, y, hw * 2, 1.1); }
  s += P('t-b', bands);
  // thorax
  s += E('t-a', 32, 18.6, 4.6, 6.4);
  s += P('t-b', ellP(29.9, 19, 1, 4.2, 6) + ellP(34.1, 19, 1, 4.2, -6));
  // head and big round eyes with highlights cut out
  s += C('t-a', 32, 11, 3.6);
  s += P('t-b', circ(28.6, 9.2, 3.7) + circ(35.4, 9.2, 3.7) + circ(27.5, 8, 1.1) + circ(34.3, 8, 1.1), ' fill-rule="evenodd"');
  s += P('t-c', spark(6.5, 5.5, 3) + spark(57.5, 5.5, 2.6));
  add('dragonfly', 'dragonfly from above with four paned wings over a reed', s);
}

// ---------- suburban-house
{
  let s = '';
  // tree
  s += P('t-a', circ(11, 23.5, 6.6) + circ(15.4, 30.4, 5.4) + circ(7.6, 31, 5));
  s += P('t-b', 'M5 33.6Q8 36.4 12 35.2Q9.2 34.4 7.6 31.6Z' + 'M14.4 35.4Q18.4 36.2 20.2 32.6Q17.6 33.8 15.4 33Z' + 'M14.6 22.8Q16.6 26 14.4 28.4Q18 26.4 17.4 22.4Z');
  s += P('t-b', rpoly([[10, 33], [12.8, 33], [13.2, 51], [9.6, 51]], .5) + cap(12, 36, 15.6, 32.4, 1.6));
  // walls with windows cut out
  const wins = [[24.5, 28.6], [34.5, 28.6], [24.5, 38.6]];
  s += P('t-a', poly([[22, 25], [42, 25], [42, 34], [57, 34], [57, 49], [22, 49]]) + wins.map(([x, y]) => rr(x, y, 5, 5)).join(''), ' fill-rule="evenodd"');
  s += P('t-c', wins.map(([x, y]) => rr(x, y, 5, 5)).join(''));
  s += L(wins.map(([x, y]) => `M${x + 2.5} ${y}v5M${x} ${y + 2.5}h5`).join(''), 1);
  // roofs
  s += P('t-b', rr(36.6, 12.6, 3.6, 9));
  s += P('t-b', rpoly([[18.6, 26.8], [32, 11.6], [45.4, 26.8]], [1, 1.4, 1]) + circ(32, 20.4, 2.3), ' fill-rule="evenodd"');
  s += C('t-c', 32, 20.4, 2.3);
  s += P('t-b', rpoly([[40.8, 35.6], [43.6, 30.4], [57, 30.4], [59.2, 35.6]], .8));
  // garage door with slats, front door
  s += P('t-b', rr(44.6, 37.6, 10, 11.4) + rr(45.6, 39.6, 8, 1.2) + rr(45.6, 42.4, 8, 1.2) + rr(45.6, 45.2, 8, 1.2), ' fill-rule="evenodd"');
  s += P('t-b', rr(34, 38, 5, 11) + circ(37.7, 44, .6), ' fill-rule="evenodd"');
  s += P('t-b', rr(21.4, 48.4, 36.2, 1.6));
  // lawn in three pieces around the path and driveway
  s += P('t-a', rpoly([[4, 50], [34.2, 50], [32.6, 59], [4, 59]], [1.5, 0, 0, 1.5]) + poly([[38.8, 50], [44.4, 50], [42.6, 59], [40.4, 59]]) + rpoly([[54.6, 50], [60, 50], [60, 59], [57.2, 59]], [0, 1.5, 1.5, 0]));
  s += P('t-c', poly([[34.6, 50], [38.4, 50], [40, 59], [33, 59]]) + poly([[44.8, 50], [54.2, 50], [56.8, 59], [43, 59]]));
  // picket fence
  let pk = '';
  for (let x = 4.6; x < 30; x += 3.1) pk += poly([[x, 47.2], [x + 1, 45.6], [x + 2, 47.2], [x + 2, 55.4], [x, 55.4]]);
  s += P('t-b', pk + rr(4.4, 48.6, 26.8, 1.3) + rr(4.4, 52.2, 26.8, 1.3));
  // mailbox
  s += P('t-b', 'M38.6 55.2V52.4A2.6 2.6 0 0 1 43.8 52.4V55.2Z' + rr(40.6, 55, 1.4, 4.2) + rr(44, 50.4, 1, 3.4) + rr(44, 50.4, 2.6, 1.4));
  s += P('t-c', spark(57, 8, 3.2) + spark(5.5, 8.5, 2.4));
  add('suburban-house', 'detached two-storey house with garage, picket fence, tree and mailbox', s);
}

// ---------- town-square
{
  let s = '';
  // three gabled fronts behind, windows cut out
  const front = (x0, x1, wy, ay, wins) => P('t-a', rpoly([[x0, 40], [x0, wy], [(x0 + x1) / 2, ay], [x1, wy], [x1, 40]], [.6, .6, 1.2, .6, .6]) + wins.map(([x, y]) => rr(x, y, 3, 3.6)).join(''), ' fill-rule="evenodd"');
  s += front(5.4, 22.6, 24, 14.4, [[8.4, 26.4], [15.6, 26.4], [8.4, 33], [15.6, 33], [12, 18.8]]);
  s += front(23.4, 40.6, 27.4, 19.6, [[25.8, 29.6], [35.2, 29.6], [25.8, 35], [35.2, 35]]);
  s += front(41.4, 58.6, 24, 14.4, [[44.4, 26.4], [51.6, 26.4], [44.4, 33], [51.6, 33], [48, 18.8]]);
  // round paved circle with two ring joints and radial joints
  s += P('t-a', ellP(32, 50, 27.6, 9.2) + ellP(32, 50, 19.4, 6.5) + ellP(32, 50, 18.2, 6.1), ' fill-rule="evenodd"');
  let rd = '';
  for (const a of [45, 90, 135]) { const c = Math.cos(a * Math.PI / 180), sn = Math.sin(a * Math.PI / 180); rd += `M${f(32 + 19.4 * c)} ${f(50 + 6.5 * sn)}L${f(32 + 25.4 * c)} ${f(50 + 8 * sn)}`; }
  s += L(rd, 1);
  // ornate clock post
  s += P('t-b', rpoly([[30.6, 17], [33.4, 17], [34, 44], [30, 44]], .4) + rr(29.2, 22.4, 5.6, 1.6) + rr(28.6, 41.6, 6.8, 2) + rpoly([[27.6, 43.4], [36.4, 43.4], [37.4, 47.6], [26.6, 47.6]], .6) + rr(25.4, 47.2, 13.2, 2.6, 1));
  s += E('t-b', 32, 31.6, 2.8, 3.4);
  s += L('M31 19.6q-4.4 .2 -4.4 3.8q0 1.8 1.8 1.6M33 19.6q4.4 .2 4.4 3.8q0 1.8 -1.8 1.6', 1.3);
  s += P('t-b', circ(32, 10.4, 6.6) + circ(32, 10.4, 4.8) + 'M30.6 3.4L32 1.6L33.4 3.4L33 4.6H31Z', ' fill-rule="evenodd"');
  s += C('t-c', 32, 10.4, 4.8);
  s += L('M32 7.2V10.4L34.4 11.8', 1.2);
  // bench (left)
  s += P('t-b', rr(8.6, 42.6, 13.6, 4.4) + rr(9.6, 44.3, 11.6, 1), ' fill-rule="evenodd"');
  s += P('t-b', rr(7.6, 48.2, 15.6, 2.2) + rr(8.8, 50, 1.7, 4) + rr(20.3, 50, 1.7, 4) + rr(9.6, 46.6, 1.3, 2) + rr(19.9, 46.6, 1.3, 2));
  // one pigeon (side-on, facing right)
  const x = 47.6, y = 46.6, sc = 1.15, T = (u, v) => `${f(x + u * sc)} ${f(y + v * sc)}`;
  s += P('t-b', `M${T(-6.4, .6)}L${T(-3, -1.4)}Q${T(-1, -2.8)} ${T(2, -2.4)}Q${T(4.4, -1.4)} ${T(4, .8)}Q${T(3, 2.8)} ${T(-.6, 2.6)}L${T(-3, 1.6)}Z` + `M${T(4.8, -3.9)}L${T(6.6, -3.2)}L${T(4.8, -2.6)}Z`);
  s += P('t-b', circ(x + 3.2 * sc, y - 3.4 * sc, 1.9 * sc) + circ(x + 3.7 * sc, y - 3.9 * sc, .5 * sc), ' fill-rule="evenodd"');
  s += L(`M${T(-.4, 2.4)}v${f(1.8 * sc)}M${T(1.4, 2.4)}v${f(1.8 * sc)}`, 1);
  s += P('t-c', spark(6.5, 7, 3.2) + spark(57.5, 7.5, 2.6));
  add('town-square', 'town square with ornate clock post on a round paved circle, gabled fronts, bench and pigeon', s);
}
// ---------- promenade
{
  let s = '';
  const B = t => [(1 - t) ** 2 * 4 + 2 * t * (1 - t) * 34 + t * t * 60, (1 - t) ** 2 * 50 + 2 * t * (1 - t) * 50 + t * t * 40];
  // sea, with wave glints cut out
  const sg = i => i % 2 ? 1 : -1, wave = (x, y, n) => { let d = `M${x} ${y}`;
    for (let i = 0; i < n; i++) d += `q1.6 ${sg(i)} 3.2 0`;
    d += 'v1.2'; for (let i = n - 1; i >= 0; i--) d += `q-1.6 ${sg(i)} -3.2 0`; return d + 'Z'; };
  const glints = [wave(17, 29.4, 4), wave(38, 29, 3), wave(25, 33.6, 4), wave(46, 33.2, 3), wave(14, 38, 3)];
  s += P('t-a', 'M4 26.4Q4 25 5.4 25H58.6Q60 25 60 26.4V40Q34 50 4 50Z' + glints.join(''), ' fill-rule="evenodd"');
  // boat on the horizon
  s += P('t-b', 'M42.6 22.6H54.6L52.6 25.6H44.8Z' + rr(48.2, 11.6, .9, 11.2));
  s += P('t-a', poly([[49.6, 12.4], [49.6, 21.6], [55, 21.6]]) + poly([[47.6, 14], [47.6, 21.6], [43.4, 21.6]]));
  // promenade deck
  s += P('t-a', 'M4 50Q34 50 60 40V57.4Q60 59 58.4 59H5.6Q4 59 4 57.4Z');
  s += L('M4.4 50Q34 50 59.6 40.2', 2.4);
  // curved railing in perspective
  let posts = '', top = [], mid = [];
  for (let i = 0; i <= 10; i++) {
    const t = .03 + i * .094, [x, y] = B(t), h = 9.6 - 5 * t;
    posts += rr(x - .7, y - h, 1.4, h);
    top.push([x, y - h]); mid.push([x, y - h * .5]);
  }
  s += P('t-b', posts);
  s += L('M' + top.map(p => `${f(p[0])} ${f(p[1])}`).join('L'), 1.8);
  s += L('M' + mid.map(p => `${f(p[0])} ${f(p[1])}`).join('L'), 1.1);
  // street lamp
  s += P('t-b', rr(11.2, 15, 1.6, 39) + rpoly([[9.4, 52.6], [14.6, 52.6], [15.4, 57.6], [8.6, 57.6]], .6) + rr(10.2, 31, 3.6, 1.8) + rr(9.6, 16.4, 4.8, 1.6));
  s += P('t-b', poly([[8.2, 9.4], [12, 5], [15.8, 9.4]]) + rr(8.8, 9.2, 6.4, 7.4) + rr(10, 10.4, 4, 5) + circ(12, 4.4, 1.1), ' fill-rule="evenodd"');
  s += P('t-c', rr(10, 10.4, 4, 5));
  // bench facing the sea (back to us)
  s += P('t-b', rr(25, 49.6, 20, 4.2) + rr(26, 51.2, 18, 1), ' fill-rule="evenodd"');
  s += P('t-b', rr(24, 54.6, 22, 1.8) + rr(25.4, 56, 1.6, 2.6) + rr(43, 56, 1.6, 2.6) + rr(26.2, 53.4, 1.2, 1.4) + rr(42.6, 53.4, 1.2, 1.4));
  // gull
  s += L('M24 12.6q2.4 -2.4 4.8 0q2.4 -2.4 4.8 0', 1.3);
  s += P('t-c', spark(57.5, 6.5, 3) + spark(22, 5.5, 2.2));
  add('promenade', 'seaside promenade with curved railing, lamp, bench and a sailboat on the sea', s);
}

fs.writeFileSync(process.argv[2] || new URL('../../icons/part52.json', import.meta.url), JSON.stringify(icons, null, 1));
console.log(icons.map(i => `${i.id} ${i.svg.length}`).join('\n'));
