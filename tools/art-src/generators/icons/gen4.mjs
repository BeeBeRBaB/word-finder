// Generator for part4.json (sports & games, music, art, movies & TV, books & writing).
import fs from 'node:fs';
const f = n => { const v = Math.round(n * 10) / 10; return (Object.is(v, -0) ? 0 : v).toString(); };
const P = (c, d, extra = '') => `<path class="${c}"${extra} d="${d}"/>`;
const C = (c, cx, cy, r) => `<circle class="${c}" cx="${f(cx)}" cy="${f(cy)}" r="${f(r)}"/>`;
const E = (c, cx, cy, rx, ry, rot) => `<ellipse class="${c}" cx="${f(cx)}" cy="${f(cy)}" rx="${f(rx)}" ry="${f(ry)}"${rot ? ` transform="rotate(${rot} ${f(cx)} ${f(cy)})"` : ''}/>`;
const R = (c, x, y, w, h, rx) => `<rect class="${c}" x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}"${rx ? ` rx="${f(rx)}"` : ''}/>`;
const G = (t, inner) => `<g transform="${t}">${inner}</g>`;
const PG = (c, pts) => `<polygon class="${c}" points="${pts.map(p => p.map(f).join(',')).join(' ')}"/>`;
const rr = (x, y, w, h, r) => `M${f(x + r)} ${f(y)}H${f(x + w - r)}Q${f(x + w)} ${f(y)} ${f(x + w)} ${f(y + r)}V${f(y + h - r)}Q${f(x + w)} ${f(y + h)} ${f(x + w - r)} ${f(y + h)}H${f(x + r)}Q${f(x)} ${f(y + h)} ${f(x)} ${f(y + h - r)}V${f(y + r)}Q${f(x)} ${f(y)} ${f(x + r)} ${f(y)}Z`;
const circ = (cx, cy, r) => `M${f(cx - r)} ${f(cy)}A${f(r)} ${f(r)} 0 1 0 ${f(cx + r)} ${f(cy)}A${f(r)} ${f(r)} 0 1 0 ${f(cx - r)} ${f(cy)}Z`;
const rad = d => d * Math.PI / 180;
const pol = (cx, cy, r, a) => [cx + r * Math.cos(rad(a)), cy + r * Math.sin(rad(a))];
const star = (cx, cy, R1, R2, rot = -90) => { const pts = []; for (let i = 0; i < 10; i++) pts.push(pol(cx, cy, i % 2 ? R2 : R1, rot + i * 36)); return pts; };

// Clip a convex polygon (clockwise on screen) to a circle, returning a path.
function clipToCircle(pts, cx, cy, r) {
  const inside = p => Math.hypot(p[0] - cx, p[1] - cy) <= r;
  let s = pts.findIndex(inside); const n = pts.length; const out = [];
  for (let k = 0; k < n; k++) {
    const A = pts[(s + k) % n], B = pts[(s + k + 1) % n];
    if (inside(A)) out.push({ p: A, arc: false });
    const dx = B[0] - A[0], dy = B[1] - A[1], fx = A[0] - cx, fy = A[1] - cy;
    const a = dx * dx + dy * dy, b = 2 * (fx * dx + fy * dy), c = fx * fx + fy * fy - r * r;
    const disc = b * b - 4 * a * c; if (disc < 0) continue;
    const ts = [(-b - Math.sqrt(disc)) / (2 * a), (-b + Math.sqrt(disc)) / (2 * a)].filter(t => t > 0 && t < 1).sort((x, y) => x - y);
    for (const t of ts) { const q = [A[0] + t * dx, A[1] + t * dy]; const entering = !inside(A) && out.length && out[out.length - 1].exit;
      const wasInside = inside([A[0] + (t - 1e-4) * dx, A[1] + (t - 1e-4) * dy]);
      out.push({ p: q, arc: !wasInside, exit: wasInside }); void entering; }
  }
  let d = `M${f(out[0].p[0])} ${f(out[0].p[1])}`;
  for (let i = 1; i < out.length; i++) { const o = out[i];
    d += o.arc ? `A${f(r)} ${f(r)} 0 0 1 ${f(o.p[0])} ${f(o.p[1])}` : `L${f(o.p[0])} ${f(o.p[1])}`; }
  return d + 'Z';
}


// Translate an absolute-command path by (dx, dy).
function tp(d, dx, dy) {
  const toks = d.match(/[A-Za-z]|-?\d*\.?\d+(?:e-?\d+)?/g); let out = '', cmd = '', i = 0; const num = () => +toks[i++];
  const X = v => f(v + dx), Y = v => f(v + dy);
  while (i < toks.length) {
    if (/[A-Za-z]/.test(toks[i])) { cmd = toks[i++]; if (/[a-y]/.test(cmd)) throw new Error('relative cmd ' + cmd); out += cmd; if (cmd === 'Z') continue; }
    else out += ' ';
    if (cmd === 'H') out += X(num()); else if (cmd === 'V') out += Y(num());
    else if (cmd === 'A') { const a = [num(), num(), num(), num(), num()]; out += a.map(f).join(' ') + ' ' + X(num()) + ' ' + Y(num()); }
    else { const n = { M: 1, L: 1, T: 1, Q: 2, S: 2, C: 3 }[cmd]; const pr = []; for (let k = 0; k < n; k++) pr.push(X(num()) + ' ' + Y(num())); out += pr.join(' '); }
  }
  return out;
}
// Drop shadow that only shows outside the shape (offset copy XOR original), so faint renders keep inner detail.
const SH = (d, dx = 2, dy = 2.5) => P('t-b', tp(d, dx, dy) + d, ' fill-rule="evenodd"');
// Part of circle (cx,cy,r) outside the same circle moved by (ox,oy): a crescent bulging away from (ox,oy).
function moon(cx, cy, r, ox, oy) {
  const d = Math.hypot(ox, oy), h = Math.sqrt(r * r - d * d / 4), mx = cx + ox / 2, my = cy + oy / 2, nx = -oy / d, ny = ox / d;
  const P1 = [mx + h * nx, my + h * ny], P2 = [mx - h * nx, my - h * ny];
  const ang = (c, p) => Math.atan2(p[1] - c[1], p[0] - c[0]); const T = 2 * Math.PI; const mod = a => ((a % T) + T) % T;
  const sweep = (c, a, q, b) => mod(ang(c, q) - ang(c, a)) < mod(ang(c, b) - ang(c, a)) ? 1 : 0;
  const A = [cx, cy], B = [cx + ox, cy + oy], QA = [cx - r * ox / d, cy - r * oy / d], QB = [B[0] - r * ox / d, B[1] - r * oy / d];
  return `M${f(P1[0])} ${f(P1[1])}A${r} ${r} 0 1 ${sweep(A, P1, QA, P2)} ${f(P2[0])} ${f(P2[1])}A${r} ${r} 0 0 ${sweep(B, P2, QB, P1)} ${f(P1[0])} ${f(P1[1])}Z`;
}

const icons = [];
const add = (id, motif, svg) => icons.push({ id, motif, svg });

// ---------- soccer ball ----------
{
  const cx = 31, cy = 31, r = 27; let s = '';
  s += SH(circ(cx, cy, r), 2, 3) + C('t-c', cx, cy, r) + P('t-a', moon(cx, cy, r, -4, -5));
  const angs = [-90, -18, 54, 126, 198];
  const cp = angs.map(a => pol(cx, cy, 8.5, a));
  s += PG('t-b', cp);
  const D = 23.5, pr = 8.5; const outer = [];
  for (const a of angs) {
    const oc = pol(cx, cy, D, a); const v = []; for (let k = 0; k < 5; k++) v.push(pol(oc[0], oc[1], pr, a + 180 + k * 72));
    outer.push(v); s += P('t-b', clipToCircle(v, cx, cy, r));
  }
  let seams = '';
  angs.forEach((a, k) => { const inV = outer[k][0]; seams += `M${f(cp[k][0])} ${f(cp[k][1])}L${f(inV[0])} ${f(inV[1])}`; });
  // seams between neighbouring outer pentagons
  for (let k = 0; k < 5; k++) { const A = outer[k], B = outer[(k + 1) % 5]; let best = null;
    for (const p of A) for (const q of B) { const d = Math.hypot(p[0] - q[0], p[1] - q[1]); if (!best || d < best[0]) best = [d, p, q]; }
    const [, p, q] = best; if (Math.hypot(p[0] - cx, p[1] - cy) < r && Math.hypot(q[0] - cx, q[1] - cy) < r) seams += `M${f(p[0])} ${f(p[1])}L${f(q[0])} ${f(q[1])}`;
    else { // shorten to circle
      const mid = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2]; void mid; }
  }
  s += P('ln', seams);
  add('soccer-ball', 'patched football', s);
}

// ---------- medal ----------
{
  let s = '';
  s += PG('t-b', [[37, 3], [51, 3], [39, 31], [30, 28]]);
  s += PG('t-c', [[41.5, 3], [46, 3], [36.5, 25], [33.5, 24]]);
  s += PG('t-a', [[13, 3], [27, 3], [34, 28], [25, 31]]);
  s += PG('t-c', [[18, 3], [22.5, 3], [30.2, 27], [27, 28.4]]);
  s += R('t-b', 26, 27, 12, 6, 2);
  s += SH(circ(32, 44.5, 15.5), 1.5, 2) + C('t-a', 32, 44.5, 15.5);
  s += C('t-b', 32, 44.5, 10.5) + C('t-c', 32, 44.5, 8.5);
  s += PG('t-b', star(32, 45, 7, 3));
  s += P('t-c', 'M19.5 38A13.5 13.5 0 0 1 26 31.6A15 15 0 0 0 21.8 39Z');
  s += P('ln', 'M6 12V17M3.5 14.5H8.5M56 36V40M54 38H58M55 52.5V55.5M53.5 54H56.5');
  add('medal', 'prize medal on a ribbon', s);
}

// ---------- dice ----------
{
  let s = '';
  const die = (x, y, w, pips, rot, face, pip, hi) => {
    let g = SH(rr(x, y, w, w, w * .22), 2, 3) + P(face, rr(x, y, w, w, w * .22));
    if (hi) g += P(hi, `M${f(x + 3.5)} ${f(y + w * .62)}V${f(y + w * .3)}Q${f(x + 3.5)} ${f(y + 3.5)} ${f(x + w * .3)} ${f(y + 3.5)}H${f(x + w * .42)}Q${f(x + 6)} ${f(y + 5.5)} ${f(x + 6)} ${f(y + w * .3)}V${f(y + w * .62)}Z`);
    for (const [u, v] of pips) g += C(pip, x + u * w, y + v * w, w * .1);
    return G(`rotate(${rot} ${f(x + w / 2)} ${f(y + w / 2)})`, g);
  };
  s += die(33, 5, 25, [[.28, .28], [.5, .5], [.72, .72]], 16, 't-a', 't-c', '');
  s += die(5, 24, 34, [[.27, .27], [.73, .27], [.5, .5], [.27, .73], [.73, .73]], -10, 't-c', 't-b', '');
  add('dice', 'pair of dice', s);
}

// ---------- chess knight ----------
{
  let s = '';
  const head = 'M17 47C17 40 20.5 36 25.5 33C21.5 34 17 35.5 13.5 34.5C9.5 33.5 8.5 29 11 26L20 15C22 12 25 10 28 9.5L30.5 3.5L34.5 9C44 12 49.5 22 48.5 34C48 40 47.5 44 47.5 47Z';
  s += SH(head, 2, 2);
  s += P('t-a', head);
  s += P('t-b', 'M34.5 9C44 12 49.5 22 48.5 34C48 40 47.5 44 47.5 47H42C43 42 43.5 38 43 32C42 22 38.5 15 33 11.5Z');
  s += P('t-c', 'M13.5 27.5L21 18C22.5 16 24 14.5 26 13.8L16 27.8C15 28.8 13.8 28.6 13.5 27.5Z');
  s += C('t-b', 27, 18.5, 2.3);
  s += P('ln', 'M14.5 30.5L16.5 30M22 33.5Q24 30 22 27');
  s += P('t-b', rr(9.5, 53.5, 45, 8.5, 3));
  s += P('t-a', rr(13, 46, 38, 8, 2.5));
  s += P('t-c', rr(16, 48.5, 14, 2.4, 1.2));
  s += P('t-a', rr(8, 53, 46, 7.5, 3));
  s += P('t-c', rr(12, 55.2, 10, 2.4, 1.2));
  add('chess-knight', 'chess knight piece', s);
}

// ---------- guitar ----------
{
  const body = 'M0 -17.5C7 -17.5 10.5 -12.5 10.5 -7.5C10.5 -3 7 -1 7.5 2C8 5 14 6.5 14 13.5C14 21.5 8 26 0 26C-8 26 -14 21.5 -14 13.5C-14 6.5 -8 5 -7.5 2C-7 -1 -10.5 -3 -10.5 -7.5C-10.5 -12.5 -7 -17.5 0 -17.5Z';
  let g = '';
  g += SH(body, 1.5, 2.5);
  g += P('t-b', rr(-3, -44, 6, 34, 1));
  g += P('t-a', 'M-4.5 -38.5H4.5L5.5 -50Q5.5 -52 3.5 -52H-3.5Q-5.5 -52 -5.5 -50Z');
  for (const y of [-49, -45, -41]) g += R('t-b', -8, y - 1.2, 3, 2.4, 1) + R('t-b', 5, y - 1.2, 3, 2.4, 1);
  g += P('t-a', body);
  g += P('t-b', 'M7.5 2C8 5 14 6.5 14 13.5C14 21.5 8 26 0 26C5 24 10 20 10 13.5C10 7.5 5.5 5 5.7 2Z');
  g += C('t-b', 0, 3, 5) + P('ln', circ(0, 3, 7.3));
  g += R('t-b', -2.5, -40, 5, 42, 1);
  g += P('t-c', 'M-10.5 13C-10.5 8.5 -7 7 -5.5 5.5C-6 8 -8 10 -8.2 14Z');
  g += P('t-c', 'M-7.5 -8C-7.5 -12 -5 -14.5 -2 -15C-4 -12.5 -5 -10 -5.2 -7Z');
  g += R('t-b', -6, 16, 12, 3.5, 1.5);
  g += P('ln', 'M-1 17.5V-39M1 17.5V-39', ' stroke-width=".7"');
  add('guitar', 'acoustic guitar', G('translate(25.5 38.5) rotate(45) scale(.87)', g));
}

// ---------- microphone ----------
{
  let g = '';
  const handle = 'M-8.5 7H8.5L4.5 36Q4 39 0 39Q-4 39 -4.5 36Z';
  g += SH(handle, 2, 2.5) + SH(circ(0, -8, 14), 2, 2.5);
  g += P('t-a', handle);
  g += P('t-b', 'M3 7H8.5L4.5 36Q4 39 0 39Q2.5 37 2.5 34Z');
  g += P('t-c', 'M-4.8 11L-3.2 11L-1.9 30Q-2.5 31.5 -3 30Z');
  g += C('t-a', 0, -8, 14);
  let mesh = '';
  for (const v of [-9, -3, 3, 9]) { const h = Math.sqrt(196 - v * v) - .5; mesh += `M${f(v)} ${f(-8 - h)}V${f(-8 + h)}M${f(-h)} ${f(-8 + v)}H${f(h)}`; }
  g += P('ln', mesh, ' stroke-width="1.3"');
  g += P('t-c', 'M-11 -12A12 12 0 0 1 -4 -19.5A10 10 0 0 0 -8.5 -10.5Z');
  g += P('t-b', rr(-10.5, 3, 21, 7, 2.5));
  g += P('t-c', rr(-7.5, 5, 6, 2.2, 1.1));
  g += C('t-b', 5.5, 18, 1.8);
  let s = G('translate(35 23) rotate(-24)', g);
  s += P('ln', 'M8 20Q4 27 8 34M13.5 22.5Q11 27 13.5 31.5');
  s += P('t-c', 'M53 42Q53 46 57 46Q53 46 53 50Q53 46 49 46Q53 46 53 42Z');
  s += P('t-c', 'M12 4Q12 7 15 7Q12 7 12 10Q12 7 9 7Q12 7 12 4Z');
  add('microphone', 'handheld microphone', s);
}

// ---------- drum ----------
{
  let s = '';
  const cx = 32, rx = 24, ty = 26, by = 50, ry = 8;
  const body = `M${cx - rx} ${ty}V${by}A${rx} ${ry} 0 0 0 ${cx + rx} ${by}V${ty}Z`;
  s += SH(body, 2, 2.5);
  s += P('t-a', body);
  s += P('t-b', `M${cx + 14} ${ty}H${cx + rx}V${by}A${rx} ${ry} 0 0 1 ${cx + 14} ${f(by + ry * Math.sqrt(1 - (14 / 24) ** 2))}Z`);
  const band = y0 => `M${cx - rx} ${y0}A${rx} ${ry} 0 0 0 ${cx + rx} ${y0}V${y0 + 4.5}A${rx} ${ry} 0 0 1 ${cx - rx} ${y0 + 4.5}Z`;
  s += P('t-b', band(ty)) + P('t-b', band(by - 4.5));
  const sy = x => ry * Math.sqrt(Math.max(0, 1 - ((x - cx) / rx) ** 2));
  let z = ''; let i = 0;
  for (let x = 10; x <= 54.1; x += 5.5, i++) { const y = i % 2 ? by - 4.5 + sy(x) : ty + 4.5 + sy(x); z += (i ? 'L' : 'M') + f(x) + ' ' + f(y); }
  s += P('ln', z);
  s += P('t-c', `M11 ${ty + 9}Q13 ${ty + 11} 13 ${ty + 13}V${by - 8}Q11 ${by - 10} 11 ${by - 12}Z`);
  s += E('t-b', cx, ty, rx, ry) + E('t-c', cx, ty, rx - 2.5, ry - 2);
  const stick = (x1, y1, x2, y2) => { const a = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI, L = Math.hypot(x2 - x1, y2 - y1);
    return G(`translate(${f(x1)} ${f(y1)}) rotate(${f(a)})`, P('t-b', `M0 -2.2L${f(L)} -1.3V1.3L0 2.2Q-2.2 2.2 -2.2 0Q-2.2 -2.2 0 -2.2Z`) + E('t-a', L, 0, 3.2, 2.6)); };
  s += stick(7, 5, 38, 24) + stick(57, 5, 26, 24);
  add('drum', 'drum with crossed sticks', s);
}

// ---------- violin ----------
{
  const body = 'M0 -10C8 -10 11 -7 11 -2C11 1.5 7.5 2.5 7.5 5.5C7.5 8.5 13.5 10 13.5 17C13.5 25 8 28.5 0 28.5C-8 28.5 -13.5 25 -13.5 17C-13.5 10 -7.5 8.5 -7.5 5.5C-7.5 2.5 -11 1.5 -11 -2C-11 -7 -8 -10 0 -10Z';
  let s = '';
  // bow behind, crossing the other diagonal
  s += G('translate(5 58) rotate(-44)', P('t-b', 'M0 -1.4H66L68 1.6L66 5H63.5L65 1.2H0Z') + R('t-c', 6, 2.6, 57, 1.6, .8) + P('t-b', rr(1, -.5, 7, 6.5, 1.5)) + R('t-c', 2.5, 1, 2.2, 3.4, .8));
  let g = '';
  g += SH(body, 1.5, 2.5);
  g += R('t-b', -1.8, -30, 3.6, 8, 1) + R('t-b', -5.2, -29, 3, 2.2, 1) + R('t-b', 2.2, -25.5, 3, 2.2, 1) + R('t-b', -5.2, -25.5, 3, 2.2, 1) + R('t-b', 2.2, -29, 3, 2.2, 1);
  g += R('t-a', -2.4, -22, 4.8, 13, 1);
  g += C('t-a', 0, -32.5, 4) + P('ln', 'M0 -32.5A1.6 1.6 0 1 1 1.6 -32.5', ' stroke-width="1.4"');
  g += P('t-a', body);
  g += P('t-b', 'M7.5 5.5C7.5 8.5 13.5 10 13.5 17C13.5 25 8 28.5 0 28.5C5 26.5 9.8 23 9.8 17C9.8 11 5.8 9 5.8 5.5Z');
  g += P('ln', 'M-6.5 5Q-4 8.5 -6.5 12.5Q-8.5 16 -5.5 18M6.5 5Q4 8.5 6.5 12.5Q8.5 16 5.5 18', ' stroke-width="1.5"');
  g += P('t-b', 'M-1.9 -22H1.9L2.8 12H-2.8Z');
  g += P('t-b', 'M-3.4 18.5H3.4L2 27Q0 28 -2 27Z');
  g += R('t-c', -5, 14.2, 10, 2.2, 1);
  g += P('t-c', 'M-10.5 13.5C-10.5 11 -8 9.5 -6.5 9.5C-8 11.5 -8.5 14 -8.3 17Z');
  g += P('t-c', 'M-8 -3C-8 -6 -6 -7.8 -3.5 -8.2C-5 -6.5 -5.8 -4.5 -5.8 -2Z');
  s += G('translate(33 33) rotate(-30) scale(.9)', g);
  add('violin', 'violin with bow', s);
}

// ---------- trumpet ----------
{
  let g = '';
  const bell = 'M39 27.3C47 27.3 54 23.5 61.5 15V45C54 36.5 47 32.7 39 32.7Z';
  const stad = (x, y, w, h) => `M${f(x + h / 2)} ${f(y)}H${f(x + w - h / 2)}A${f(h / 2)} ${f(h / 2)} 0 0 1 ${f(x + w - h / 2)} ${f(y + h)}H${f(x + h / 2)}A${f(h / 2)} ${f(h / 2)} 0 0 1 ${f(x + h / 2)} ${f(y)}Z`;
  const loop = stad(10, 28.3, 31, 16) + stad(13.8, 32.1, 23.4, 8.4);
  g += SH(bell, 1.5, 2.5) + SH(loop, 1.5, 2.5);
  g += P('t-a', loop, ' fill-rule="evenodd"');
  g += P('t-a', 'M6 28.3H40V32.7H6Z');
  g += P('t-b', 'M1.5 25.5Q4.5 27 7 28.3V32.7Q4.5 34 1.5 35.5Z');
  g += P('t-a', bell);
  g += P('t-b', 'M39 30.5C47 30.5 54 34.5 61.5 41.5V45C54 36.5 47 32.7 39 32.7Z');
  g += E('t-b', 61, 30, 3, 15.5) + E('t-c', 61.6, 30, 1.3, 12);
  const vx = [18, 24.5, 31];
  g += P('t-a', vx.map(x => `M${x} 23H${x + 4}V38H${x}Z`).join(''));
  g += P('t-b', vx.map(x => `M${x + .8} 17.5H${x + 3.2}V23H${x + .8}ZM${x + 2.6} 23H${x + 4}V38H${x + 2.6}Z` + `M${f(x - .6)} 21.8H${f(x + 4.6)}V24.4H${f(x - .6)}ZM${f(x - .6)} 36.5H${f(x + 4.6)}V39.1H${f(x - .6)}Z`).join(''));
  g += P('t-c', vx.map(x => `M${x - 1.4} 16.8A3.4 1.7 0 1 0 ${x + 5.4} 16.8A3.4 1.7 0 1 0 ${x - 1.4} 16.8Z`).join(''));
  g += P('t-c', 'M43 28.3C49 27.8 54 25 58.5 20.5C55 26 50 29 43 29.8Z');
  g += R('t-c', 7.5, 29.2, 9, 1.6, .8) + R('t-c', 18, 41.3, 18, 1.6, .8);
  add('trumpet', 'shiny trumpet', G('translate(32 32) rotate(-18) scale(.9) translate(-31.5 -30)', g));
}

// ---------- paintbrush ----------
{
  let g = '';
  const handle = 'M-3.6 -3H3.6L2.6 26Q2.6 29 0 29Q-2.6 29 -2.6 26Z';
  const brist = 'M-4.8 -12C-6.5 -18 -5 -25 0 -32C5 -25 6.5 -18 4.8 -12Z';
  g += SH(handle, 2, 1) + SH(brist, 2, 1);
  g += P('t-a', handle);
  g += P('t-b', 'M1.2 -3H3.6L2.6 26Q2.6 29 0 29Q1.4 27.5 1.4 25Z');
  g += P('t-c', 'M-2.4 1H-.8L-.9 20H-1.8Z');
  g += P('t-b', brist);
  g += P('t-a', 'M-4.6 -21C-4.2 -25.5 -2.4 -28.5 0 -32C2.4 -28.5 4.2 -25.5 4.6 -21C1.5 -19.5 -1.5 -19.5 -4.6 -21Z');
  g += P('t-c', 'M-2.6 -22.5C-2.4 -25 -1.4 -27 0 -29C-.6 -26.5 -.8 -24.5 -.8 -22.3Z');
  g += P('t-c', rr(-5, -13, 10, 11, 1.5));
  g += P('ln', 'M-4 -9H4M-4 -5.5H4', ' stroke-width="1.4"');
  let s = '';
  s += SH('M2 53C8 45 16 48 21 51C26 54 30 53 35 48C32 55 26 59 20 56.5C14 54 8 52 4 58Q1 57 2 53Z', 1, 2);
  s += P('t-a', 'M2 53C8 45 16 48 21 51C26 54 30 53 35 48C32 55 26 59 20 56.5C14 54 8 52 4 58Q1 57 2 53Z');
  s += P('t-c', 'M6 51.5C9 49 12 48.5 15.5 49.5C12 50 9 51 6.5 53Z');
  s += C('t-a', 41, 45, 2.4) + C('t-a', 46, 53, 1.6) + C('t-a', 10, 44, 1.5);
  s += G('translate(35.5 23.3) rotate(-135) scale(.95)', g);
  add('paintbrush', 'paintbrush with a paint swoosh', s);
}

// ---------- camera ----------
{
  let s = '';
  s += SH(rr(3, 18, 56, 38, 7), 2.5, 3);
  s += P('t-a', 'M20 20L24 11.5Q25 10 27 10H37Q39 10 40 11.5L44 20Z');
  s += P('t-c', 'M26 14H33L32 17H25Z');
  s += R('t-b', 46, 13, 9, 7, 1.5);
  s += P('t-a', rr(3, 18, 56, 38, 7));
  s += P('t-b', 'M3 29H59V36H3Z');
  s += R('t-c', 8, 22, 9, 5, 1.5);
  s += SH(circ(31, 37, 16), 2, 2.5) + C('t-b', 31, 37, 16) + C('t-c', 31, 37, 13) + C('t-b', 31, 37, 10.5) + C('t-a', 31, 37, 6) + C('t-b', 31, 37, 3.5);
  s += C('t-c', 27, 33, 2.8) + C('t-c', 35, 41, 1.3);
  s += C('t-c', 52, 23.5, 2);
  s += P('t-c', rr(6, 50, 10, 2.4, 1.2));
  add('camera', 'photo camera', s);
}

// ---------- popcorn ----------
{
  let s = '';
  const box = [[11, 28], [53, 28], [47, 61], [17, 61]];
  s += puffs(true);
  s += SH('M11 28H53L47 61H17Z', 2, 1.5);
  s += PG('t-a', box);
  // stripes: divide top 11..53 into 6, bottom 17..47 into 6
  for (const k of [1, 3, 5]) { const t0 = k / 7, t1 = (k + 1) / 7; const tx = t => 11 + 42 * t, bx = t => 17 + 30 * t;
    s += PG('t-c', [[tx(t0), 28], [tx(t1), 28], [bx(t1), 61], [bx(t0), 61]]); }
  s += PG('t-b', [[47, 28], [53, 28], [47, 61], [43, 61]]);
  s += P('t-b', rr(9, 25, 46, 6, 2));
  function puffs() {
    const P1 = [[16, 22, 6.5], [25, 17, 7], [35, 19, 7], [44, 21, 6.5], [20, 12, 5.5], [31, 10, 6], [41, 12, 5.5], [50, 24, 4.5]];
    let o = '';
    o += P('t-b', P1.map(([x, y, r]) => circ(x + 1, y + 1.5, r)).join(''));
    for (const [x, y, r] of P1) o += C('t-c', x, y, r);
    o += P('ln', 'M13 20Q16 17 19 20M22 15Q25 12 28 15M32 17Q35 14 38 17M18 10Q20 8 22 10M29 8Q31 6 33 8M41 19Q44 16 47 19M39 10Q41 8 43 10', ' stroke-width="1.5"');
    o += C('t-c', 7, 42, 3.5) + P('ln', 'M5 42Q7 40 9 42', ' stroke-width="1.3"') + C('t-c', 58.5, 44, 3) + C('t-c', 56, 12, 2.6);
    return o;
  }
  add('popcorn', 'striped popcorn box', s);
}

// ---------- film reel ----------
{
  let s = '';
  const x0 = 26, y0 = 43, qx = 46, qy = 40, x1 = 62.5, y1 = 49, W = 13;
  const top = t => [(1 - t) ** 2 * x0 + 2 * (1 - t) * t * qx + t * t * x1, (1 - t) ** 2 * y0 + 2 * (1 - t) * t * qy + t * t * y1];
  s += P('t-b', `M${x0} ${y0}Q${qx} ${qy} ${x1} ${y1}V${y1 + W}Q${qx} ${qy + W} ${x0} ${y0 + W}Z`);
  for (let t = .1; t < 1; t += .14) { const [x, y] = top(t); const dx = 2 * (1 - t) * (qx - x0) + 2 * t * (x1 - qx), dy = 2 * (1 - t) * (qy - y0) + 2 * t * (y1 - qy);
    s += G(`translate(${f(x)} ${f(y)}) rotate(${f(Math.atan2(dy, dx) * 180 / Math.PI)})`, R('t-c', -1.4, 2, 2.8, 2.6, .6) + R('t-c', -1.4, W - 4.6, 2.8, 2.6, .6)); }
  const cx = 25.5, cy = 26.5, r = 24;
  s += P('t-b', circ(cx + 2, cy + 2.5, r) + circ(cx, cy, r), ' fill-rule="evenodd"');
  let holes = ''; for (const a of [-90, -18, 54, 126, 198]) { const [x, y] = pol(cx, cy, 11.5, a); holes += circ(x, y, 5.6); }
  s += P('t-a', circ(cx, cy, r) + holes, ' fill-rule="evenodd"');
  s += P('ln', circ(cx, cy, 20.5), ' stroke-width="1.6"');
  s += C('t-c', cx, cy, 4) + C('t-b', cx, cy, 1.8);
  s += P('t-c', 'M6.5 21A20 20 0 0 1 14 10A18 18 0 0 0 9 22Z');
  add('film-reel', 'film reel with unspooling film', s);
}

// ---------- television ----------
{
  let s = '';
  s += P('t-b', 'M13 55L10 62H15L18 55ZM45 55L48 62H53L50 55Z');
  s += P('ln', 'M32 19L19 5M32 19L47 3', ' stroke-width="2"');
  s += C('t-a', 19, 5, 2.8) + C('t-a', 47, 3.2, 2.8);
  s += SH(rr(3, 18, 56, 37, 7), 2.5, 2.5);
  s += P('t-a', rr(3, 18, 56, 37, 7));
  s += E('t-b', 32, 18.5, 7, 3.5);
  s += P('t-c', rr(7, 22, 38, 29, 7));
  s += P('t-b', rr(9.5, 24.5, 33, 24, 5));
  s += P('t-c', 'M13.5 36V31.5Q13.5 28.5 16.5 28.5H24Q17.5 30 16 36Z');
  s += C('t-c', 17.5, 40, 1.4);
  s += C('t-b', 52, 29, 4) + R('t-c', 51.2, 25.6, 1.6, 4) + C('t-b', 52, 39.5, 3.2) + C('t-c', 52, 39.5, 1.2);
  s += P('ln', 'M48.5 46.5H55.5M48.5 50H55.5', ' stroke-width="1.6"');
  add('television', 'retro tv with antennae', s);
}

// ---------- theater masks ----------
{
  const face = 'M0 -17C10.5 -17 16.5 -13 16.5 -4.5C16.5 7.5 9 18.5 0 18.5C-9 18.5 -16.5 7.5 -16.5 -4.5C-16.5 -13 -10.5 -17 0 -17Z';
  let s = '';
  // tragedy (back)
  const sadEyes = 'M-11.5 -6Q-7 -1 -2.5 -5.5Q-7 -3.5 -11.5 -6ZM11.5 -6Q7 -1 2.5 -5.5Q7 -3.5 11.5 -6Z';
  const frown = 'M-8 12.5Q0 1 8 12.5Q0 7.5 -8 12.5Z';
  s += G('translate(42 25) rotate(16)', P('t-b', face + sadEyes.replace(/Z/g, 'Z') + frown, ' fill-rule="evenodd"') + P('ln', 'M-11 -11Q-7 -13 -3 -9.5M11 -11Q7 -13 3 -9.5', ' stroke-width="1.5"'));
  // comedy (front)
  const happyEyes = 'M-11.5 -3Q-7 -11.5 -2.5 -3Q-7 -6.5 -11.5 -3ZM11.5 -3Q7 -11.5 2.5 -3Q7 -6.5 11.5 -3Z';
  const smile = 'M-9.5 4Q0 19 9.5 4Q0 9 -9.5 4Z';
  let c = '';
  c += SH(face, 1.5, 2.5);
  c += P('t-a', face + happyEyes + smile, ' fill-rule="evenodd"');
  c += P('t-c', 'M-13 -6C-13 -11 -9 -14 -3 -14.5C-8 -12.5 -10.5 -10 -11 -6Z');
  c += E('t-c', -11, 6, 2.6, 1.8) + E('t-c', 11, 6, 2.6, 1.8);
  s += G('translate(22 38) rotate(-14)', c);
  s += P('ln', 'M7 30Q2 36 5 42Q8 47 4 53M58 16Q63 22 60 28');
  add('theater-masks', 'comedy and tragedy masks', s);
}

// ---------- book stack ----------
{
  let s = '';
  const book = (x, y, w, h, spine) => {
    let o = P('t-b', rr(x, y, w, h, 2.2));
    if (spine) { o += P('t-a', rr(x, y, w - 2.5, h - 2, 2)) + R('t-b', x + 5, y, 3, h - 2) + R('t-b', x + w - 12, y, 3, h - 2) + R('t-c', x + 11, y + 2.2, w - 26, 1.8, .9); }
    else { o += P('t-c', rr(x + 2, y + 2, w - 4, h - 4, 1.2)) + P('ln', `M${x + 4} ${f(y + h / 2)}H${x + w - 3}`, ' stroke-width="1.2"'); }
    return o;
  };
  s += book(7, 50, 50, 11, true);
  s += book(11, 40, 44, 10, false);
  s += G('rotate(-5 32 34)', book(5, 29, 48, 11, true));
  s += book(12, 18.5, 40, 10, true);
  // bookmark ribbon
  s += PG('t-c', [[40, 37], [44, 37], [44, 45.5], [42, 44], [40, 45.5]]);
  // reading glasses on top
  s += P('t-b', 'M19 12.5A6 6 0 1 0 31 12.5A6 6 0 1 0 19 12.5ZM21.5 12.5A3.5 3.5 0 1 1 28.5 12.5A3.5 3.5 0 1 1 21.5 12.5Z' + 'M35 12.5A6 6 0 1 0 47 12.5A6 6 0 1 0 35 12.5ZM37.5 12.5A3.5 3.5 0 1 1 44.5 12.5A3.5 3.5 0 1 1 37.5 12.5Z', ' fill-rule="evenodd"');
  s += P('t-c', 'M22 13.5A3.5 3.5 0 0 1 25 9.5L24.5 10.8A2.4 2.4 0 0 0 23.2 13.6Z');
  s += P('ln', 'M30.5 11Q33 9 35.5 11M19 12L14 17M47 12L52 17', ' stroke-width="1.8"');
  add('book-stack', 'stack of books with reading glasses', s);
}

// ---------- quill and inkwell ----------
{
  let s = '';
  let q = '';
  const vane = 'M1 -34C9 -27 11 -8 5 12L1 16L-4 11C-10 -6 -7 -25 1 -34Z';
  q += SH(vane, 1.5, 2);
  q += P('t-a', vane);
  q += P('t-b', 'M1 -34C9 -27 11 -8 5 12L1 16L1.5 -10C2 -20 1.8 -28 1 -34Z');
  q += P('ln', 'M-5.5 -8L-.5 -12M-6.5 0L-.5 -4M-5 8L0 4M6 -16L2 -19M6.5 -6L2.5 -9', ' stroke-width="1.4"');
  q += P('t-c', 'M.2 -30Q1.6 -10 .9 16L-.3 16Q.4 -10 .2 -30Z');
  q += P('t-b', 'M-.8 14H2.2L1.7 26L.7 30L-.3 26Z');
  s += G('translate(40.5 23) rotate(45) scale(.88)', q);
  s += SH(rr(6, 40, 30, 21, 6), 2, 2);
  s += P('t-a', rr(6, 40, 30, 21, 6));
  s += P('t-b', rr(13, 33, 16, 9, 2));
  s += P('t-a', rr(12, 31, 18, 5, 2));
  s += P('t-b', 'M29 40H30Q36 40 36 46V55Q36 61 30 61H29Q33 59 33 54V47Q33 42 29 40Z');
  s += P('t-c', rr(10, 45, 3, 11, 1.5));
  s += P('t-c', rr(16, 46, 12, 9, 2));
  s += P('ln', 'M18.5 49H25.5M18.5 52H23.5', ' stroke-width="1.3"');
  s += P('t-b', 'M14 36Q15 40 14.5 42Q13.5 44 12.5 42Q12 40 14 36Z');
  s += P('ln', 'M40 59C43 59 45 53 47 54C49 55 45 60 48 60C51 60 52 54 54 55C56 56 52 60 55 60H61', ' stroke-width="1.8"');
  add('quill', 'quill pen and inkwell', s);
}

// ---------- speech bubbles ----------
{
  let s = '';
  const back = 'M35 4H53Q61 4 61 12V20Q61 28 53 28H52L58 35L45 28H35Q27 28 27 20V12Q27 4 35 4Z';
  s += SH(back, 1.5, 2);
  s += P('t-a', back);
  s += R('t-c', 34, 11.5, 20, 2.8, 1.4) + R('t-c', 34, 17.5, 12, 2.8, 1.4);
  const front = 'M18 17H38C47 17 52 22 52 30.5C52 39 47 44 38 44H23L11 55L14 43.5C7 41.5 4 37 4 30.5C4 22 9 17 18 17Z';
  s += SH(front, 2, 2.5);
  s += P('t-c', front);
  s += C('t-b', 17, 31, 3.6) + C('t-b', 28, 31, 3.6) + C('t-b', 39, 31, 3.6);
  s += P('t-a', 'M44 42C48 40 50 36 50 31C51 35 50.5 40 46 43Z');
  add('speech-bubble', 'chatting speech bubbles', s);
}

const out = process.argv[2] || new URL('../../icons/part4.json', import.meta.url);
fs.writeFileSync(out, JSON.stringify(icons, null, 1));
for (const i of icons) if (i.svg.length > 2500) console.log('LONG', i.id, i.svg.length);
console.log(icons.length, 'icons');
