// Geometry helpers for part2 icons. Absolute path commands only (M L H V C Q A Z).
const R = Math.PI / 180;
export const f = n => { let r = Math.round(n * 10) / 10; if (Object.is(r, -0)) r = 0; return String(r).replace(/^(-?)0\./, '$1.'); };
const P = (x, y) => `${f(x)} ${f(y)}`;

// ---------- parsing / serialising ----------
function parse(d) {
  const toks = d.match(/[A-Za-z]|-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/g) || [];
  const subs = []; let cur = null, i = 0, cmd = null, pen = [0, 0];
  const num = () => parseFloat(toks[i++]);
  while (i < toks.length) {
    if (/[A-Za-z]/.test(toks[i])) { cmd = toks[i++]; if (cmd !== cmd.toUpperCase()) throw new Error('relative cmd ' + cmd + ' in ' + d); }
    if (cmd === 'Z') { if (cur) { cur.closed = true; pen = cur.start.slice(); } cur = null; continue; }
    if (cmd === 'M') { cur = { start: [num(), num()], segs: [], closed: false }; subs.push(cur); pen = cur.start.slice(); cmd = 'L'; continue; }
    if (!cur) { cur = { start: pen.slice(), segs: [], closed: false }; subs.push(cur); }
    let s;
    if (cmd === 'L') s = { t: 'L', end: [num(), num()] };
    else if (cmd === 'H') s = { t: 'L', end: [num(), pen[1]] };
    else if (cmd === 'V') s = { t: 'L', end: [pen[0], num()] };
    else if (cmd === 'C') s = { t: 'C', c1: [num(), num()], c2: [num(), num()], end: [num(), num()] };
    else if (cmd === 'Q') s = { t: 'Q', c1: [num(), num()], end: [num(), num()] };
    else if (cmd === 'A') s = { t: 'A', rx: num(), ry: num(), rot: num(), la: num(), sw: num(), end: [num(), num()] };
    else throw new Error('cmd ' + cmd);
    cur.segs.push(s); pen = s.end.slice();
  }
  return subs;
}
function ser(subs) {
  let o = '';
  for (const sp of subs) {
    o += 'M' + P(...sp.start); let last = null;
    for (const s of sp.segs) {
      if (s.t === 'L') o += 'L' + P(...s.end);
      else if (s.t === 'C') o += 'C' + P(...s.c1) + ' ' + P(...s.c2) + ' ' + P(...s.end);
      else if (s.t === 'Q') o += 'Q' + P(...s.c1) + ' ' + P(...s.end);
      else o += 'A' + f(s.rx) + ' ' + f(s.ry) + ' ' + f(s.rot) + ' ' + s.la + ' ' + s.sw + ' ' + P(...s.end);
      last = s;
    }
    if (sp.closed) o += 'Z';
  }
  return o.replace(/ -/g, '-');
}
function arcPts(p1, s, n = 12) {
  let [x1, y1] = p1, [x2, y2] = s.end, rx = Math.abs(s.rx), ry = Math.abs(s.ry); const phi = s.rot * R;
  const c = Math.cos(phi), sn = Math.sin(phi); const dx = (x1 - x2) / 2, dy = (y1 - y2) / 2;
  const x1p = c * dx + sn * dy, y1p = -sn * dx + c * dy;
  const lam = x1p * x1p / (rx * rx) + y1p * y1p / (ry * ry); if (lam > 1) { rx *= Math.sqrt(lam); ry *= Math.sqrt(lam); }
  const num = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p, den = rx * rx * y1p * y1p + ry * ry * x1p * x1p;
  let co = Math.sqrt(Math.max(0, num / den)); if (s.la === s.sw) co = -co;
  const cxp = co * rx * y1p / ry, cyp = -co * ry * x1p / rx;
  const cx = c * cxp - sn * cyp + (x1 + x2) / 2, cy = sn * cxp + c * cyp + (y1 + y2) / 2;
  const ang = (ux, uy, vx, vy) => Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
  const t1 = ang(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
  let dt = ang((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
  if (!s.sw && dt > 0) dt -= 2 * Math.PI; else if (s.sw && dt < 0) dt += 2 * Math.PI;
  const out = []; for (let k = 1; k <= n; k++) { const t = t1 + dt * k / n; out.push([c * rx * Math.cos(t) - sn * ry * Math.sin(t) + cx, sn * rx * Math.cos(t) + c * ry * Math.sin(t) + cy]); }
  return out;
}
function samples(sp) {
  const pts = [sp.start]; let p = sp.start;
  for (const s of sp.segs) {
    if (s.t === 'L') pts.push(s.end);
    else if (s.t === 'C') for (const t of [.25, .5, .75, 1]) { const u = 1 - t; pts.push([0, 1].map(k => u * u * u * p[k] + 3 * u * u * t * s.c1[k] + 3 * u * t * t * s.c2[k] + t * t * t * s.end[k])); }
    else if (s.t === 'Q') for (const t of [.25, .5, .75, 1]) { const u = 1 - t; pts.push([0, 1].map(k => u * u * p[k] + 2 * u * t * s.c1[k] + t * t * s.end[k])); }
    else pts.push(...arcPts(p, s));
    p = s.end;
  }
  return pts;
}
const area = sp => { const q = samples(sp); let a = 0; for (let i = 0; i < q.length; i++) { const [x1, y1] = q[i], [x2, y2] = q[(i + 1) % q.length]; a += x1 * y2 - x2 * y1; } return a / 2; };
function reverse(sp) {
  const segs = sp.segs.slice();
  const last = segs.length ? segs[segs.length - 1].end : sp.start;
  if (sp.closed && (Math.abs(last[0] - sp.start[0]) > 1e-6 || Math.abs(last[1] - sp.start[1]) > 1e-6)) segs.push({ t: 'L', end: sp.start.slice() });
  const pts = [sp.start, ...segs.map(s => s.end)];
  const out = []; for (let k = segs.length - 1; k >= 0; k--) {
    const s = segs[k], to = pts[k];
    if (s.t === 'L') out.push({ t: 'L', end: to });
    else if (s.t === 'C') out.push({ t: 'C', c1: s.c2, c2: s.c1, end: to });
    else if (s.t === 'Q') out.push({ t: 'Q', c1: s.c1, end: to });
    else out.push({ ...s, sw: 1 - s.sw, end: to });
  }
  return { start: pts[pts.length - 1], segs: out, closed: sp.closed };
}
// orient every subpath: dir 1 = clockwise on screen, -1 = counter-clockwise
export function orient(d, dir) { return ser(parse(d).map(sp => (Math.sign(area(sp)) === dir ? sp : reverse(sp)))); }
export const cw = d => orient(d, 1), ccw = d => orient(d, -1);
export function xf(d, fn, flip = false) { // map every point; flip arc sweeps (for mirrors)
  return ser(parse(d).map(sp => ({ start: fn(sp.start), closed: sp.closed, segs: sp.segs.map(s => ({ ...s, end: fn(s.end), ...(s.c1 ? { c1: fn(s.c1) } : {}), ...(s.c2 ? { c2: fn(s.c2) } : {}), ...(s.t === 'A' && flip ? { sw: 1 - s.sw } : {}) })) })));
}
export const mirror = (d, cx = 32) => xf(d, ([x, y]) => [2 * cx - x, y], true);
export const move = (d, dx, dy) => xf(d, ([x, y]) => [x + dx, y + dy]);
export const rotd = (d, deg, cx = 32, cy = 32) => { const c = Math.cos(deg * R), s = Math.sin(deg * R); return xf(d, ([x, y]) => [cx + (x - cx) * c - (y - cy) * s, cy + (x - cx) * s + (y - cy) * c]); };

// ---------- shapes ----------
export const circle = (cx, cy, r) => `M${P(cx - r, cy)}A${f(r)} ${f(r)} 0 1 1 ${P(cx + r, cy)}A${f(r)} ${f(r)} 0 1 1 ${P(cx - r, cy)}Z`;
export function ellipse(cx, cy, rx, ry, rot = 0) {
  const c = Math.cos(rot * R), s = Math.sin(rot * R);
  const a = [cx + rx * c, cy + rx * s], b = [cx - rx * c, cy - rx * s];
  return `M${P(...a)}A${f(rx)} ${f(ry)} ${f(rot)} 1 1 ${P(...b)}A${f(rx)} ${f(ry)} ${f(rot)} 1 1 ${P(...a)}Z`;
}
export const poly = pts => 'M' + pts.map(p => P(...p)).join('L') + 'Z';
// polygon with rounded corners (r number or per-corner array)
export function rpoly(pts, r) {
  const n = pts.length, rr = Array.isArray(r) ? r : pts.map(() => r); let o = '';
  const u = (a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy); return [dx / l, dy / l, l]; };
  for (let i = 0; i < n; i++) {
    const p = pts[i], a = pts[(i - 1 + n) % n], b = pts[(i + 1) % n];
    const [ax, ay, la] = u(p, a), [bx, by, lb] = u(p, b); const k = Math.min(rr[i], la / 2, lb / 2);
    const A = [p[0] + ax * k, p[1] + ay * k], B = [p[0] + bx * k, p[1] + by * k];
    o += (i ? 'L' : 'M') + P(...A) + (k > 0 ? 'Q' + P(...p) + ' ' + P(...B) : '');
  }
  return o + 'Z';
}
function inter(a, b) {
  const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
  const l = (a.r * a.r - b.r * b.r + d * d) / (2 * d), h = Math.sqrt(Math.max(0, a.r * a.r - l * l));
  const mx = a.x + dx * l / d, my = a.y + dy * l / d;
  return [[mx - h * dy / d, my + h * dx / d], [mx + h * dy / d, my - h * dx / d]];
}
const mod = (a, m) => ((a % m) + m) % m;
// arc on circle c from p to q passing through m
function arcThrough(c, p, q, m) {
  const ap = Math.atan2(p[1] - c.y, p[0] - c.x), aq = Math.atan2(q[1] - c.y, q[0] - c.x), am = Math.atan2(m[1] - c.y, m[0] - c.x);
  const s = mod(aq - ap, 2 * Math.PI), mm = mod(am - ap, 2 * Math.PI);
  if (mm < s) return `A${f(c.r)} ${f(c.r)} 0 ${s > Math.PI ? 1 : 0} 1 ${P(...q)}`;
  return `A${f(c.r)} ${f(c.r)} 0 ${2 * Math.PI - s > Math.PI ? 1 : 0} 0 ${P(...q)}`;
}
// region of circle a outside circle b  ([x,y,r] arrays)
export function crescent(A, B) {
  const a = { x: A[0], y: A[1], r: A[2] }, b = { x: B[0], y: B[1], r: B[2] };
  const [i1, i2] = inter(a, b); const ux = a.x - b.x, uy = a.y - b.y, ul = Math.hypot(ux, uy);
  const far = [a.x + a.r * ux / ul, a.y + a.r * uy / ul], near = [b.x + b.r * ux / ul, b.y + b.r * uy / ul];
  return `M${P(...i1)}${arcThrough(a, i1, i2, far)}${arcThrough(b, i2, i1, near)}Z`;
}
// blob = union outline of circles listed clockwise around the shape ([x,y,r] arrays)
function outers(cs) {
  const cx = cs.reduce((s, c) => s + c.x, 0) / cs.length, cy = cs.reduce((s, c) => s + c.y, 0) / cs.length;
  return cs.map((c, i) => { const [p, q] = inter(c, cs[(i + 1) % cs.length]); return Math.hypot(p[0] - cx, p[1] - cy) > Math.hypot(q[0] - cx, q[1] - cy) ? p : q; });
}
const cwArc = (c, p, q) => { const ap = Math.atan2(p[1] - c.y, p[0] - c.x), aq = Math.atan2(q[1] - c.y, q[0] - c.x); return `A${f(c.r)} ${f(c.r)} 0 ${mod(aq - ap, 2 * Math.PI) > Math.PI ? 1 : 0} 1 ${P(...q)}`; };
export function blob(list) {
  const cs = list.map(([x, y, r]) => ({ x, y, r })), n = cs.length;
  if (n === 2) { const [a, b] = cs, [p, q] = inter(a, b), d = Math.hypot(a.x - b.x, a.y - b.y);
    const fa = [a.x + a.r * (a.x - b.x) / d, a.y + a.r * (a.y - b.y) / d], fb = [b.x + b.r * (b.x - a.x) / d, b.y + b.r * (b.y - a.y) / d];
    return `M${P(...p)}${arcThrough(a, p, q, fa)}${arcThrough(b, q, p, fb)}Z`; }
  const o = outers(cs);
  let d = 'M' + P(...o[n - 1]); for (let i = 0; i < n; i++) d += cwArc(cs[i], i ? o[i - 1] : o[n - 1], o[i]); return d + 'Z';
}
// outline piece: from angle a0 (deg) on circle i0 clockwise to angle a1 on circle i1; returns {d, start, end}
export function blobSeg(list, i0, a0, i1, a1) {
  const cs = list.map(([x, y, r]) => ({ x, y, r })), o = outers(cs), n = cs.length;
  const pt = (c, a) => [c.x + c.r * Math.cos(a * R), c.y + c.r * Math.sin(a * R)];
  const start = pt(cs[i0], a0), end = pt(cs[i1], a1); let d = 'M' + P(...start), p = start, i = i0;
  while (i !== i1) { d += cwArc(cs[i], p, o[i]); p = o[i]; i = (i + 1) % n; }
  d += cwArc(cs[i1], p, end); return { d, start, end };
}
// ellipse arc piece clockwise from param t0 to t1 (deg); returns {d, start, end}
export function ellSeg(cx, cy, rx, ry, rot, t0, t1) {
  const c = Math.cos(rot * R), s = Math.sin(rot * R);
  const pt = t => [cx + rx * Math.cos(t * R) * c - ry * Math.sin(t * R) * s, cy + rx * Math.cos(t * R) * s + ry * Math.sin(t * R) * c];
  const start = pt(t0), end = pt(t1), span = mod(t1 - t0, 360);
  return { d: `M${P(...start)}A${f(rx)} ${f(ry)} ${f(rot)} ${span > 180 ? 1 : 0} 1 ${P(...end)}`, start, end };
}
// crescent shade from a clockwise outline piece, closed by a same-way-bulging arc of radius rr
export const shade = (seg, rr) => `${seg.d}A${f(rr)} ${f(rr)} 0 0 0 ${P(...seg.start)}Z`;

// ---------- elements ----------
export const path = (cls, d, extra = '') => `<path class="${cls}"${extra} d="${d}"/>`;
// union of parts (all clockwise) with holes cut (counter-clockwise), nonzero fill
export const fill = (cls, parts, holes = []) => path(cls, cw([].concat(parts).join('')) + (holes.length ? ccw([].concat(holes).join('')) : ''));
// main tone with highlight holes filled by t-c
export const lit = (parts, holes = []) => fill('t-a', parts, holes) + (holes.length ? path('t-c', [].concat(holes).join('')) : '');
export const ln = (d, w) => `<path class="ln"${w && w !== 2 ? ` stroke-width="${w}"` : ''} d="${d}"/>`;
export const C = (cls, cx, cy, r) => `<circle class="${cls}" cx="${f(cx)}" cy="${f(cy)}" r="${f(r)}"/>`;
export const E = (cls, cx, cy, rx, ry, rot) => `<ellipse class="${cls}" cx="${f(cx)}" cy="${f(cy)}" rx="${f(rx)}" ry="${f(ry)}"${rot ? ` transform="rotate(${f(rot)} ${f(cx)} ${f(cy)})"` : ''}/>`;
export const g = (tf, inner) => `<g transform="${tf}">${inner}</g>`;
