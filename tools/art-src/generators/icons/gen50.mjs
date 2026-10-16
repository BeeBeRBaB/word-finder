// Generates part50.json (round 4: car-lift, school-desks, farmer, sitcom-tv, festival-laurel, haunted-house).
import fs from 'node:fs';
const f = n => { const s = (Math.round(n * 10) / 10).toString(); return s === '-0' ? '0' : s; };
const P = (c, d, extra = '') => `<path class="${c}"${extra} d="${d}"/>`;
const C = (c, x, y, r) => `<circle class="${c}" cx="${f(x)}" cy="${f(y)}" r="${f(r)}"/>`;
const E = (c, x, y, rx, ry, rot) => `<ellipse class="${c}" cx="${f(x)}" cy="${f(y)}" rx="${f(rx)}" ry="${f(ry)}"${rot ? ` transform="rotate(${rot} ${f(x)} ${f(y)})"` : ''}/>`;
const R = (c, x, y, w, h, r = 0, extra = '') => `<rect class="${c}" x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}"${r ? ` rx="${f(r)}"` : ''}${extra}/>`;
const L = (d, w) => `<path class="ln"${w ? ` stroke-width="${w}"` : ''} d="${d}"/>`;
// Compact relative path writer: cmds are [op, ...points/args]; output is relative, rounded to 0.1
// with the rounding error carried, so long paths stay short and exact.
const num = a => a.map((v, i) => (i && !String(v).startsWith('-') ? ' ' : '') + v).join('');
const rel = cmds => {
  let d = '', cx = 0, cy = 0, sx = 0, sy = 0;
  const pt = p => { const x = +f(p[0]), y = +f(p[1]); const o = [f(x - cx), f(y - cy)]; return [o, x, y]; };
  for (const c of cmds) {
    const op = c[0];
    if (op === 'Z') { d += 'Z'; cx = sx; cy = sy; continue; }
    if (op === 'M') { const x = +f(c[1][0]), y = +f(c[1][1]); d += 'M' + num([f(x), f(y)]); cx = sx = x; cy = sy = y; continue; }
    if (op === 'L') { const [o, x, y] = pt(c[1]); if (o[0] === '0' && o[1] === '0') continue; d += 'l' + num(o); cx = x; cy = y; continue; }
    if (op === 'Q') { const [o1] = pt(c[1]); const [o2, x, y] = pt(c[2]); d += 'q' + num([...o1, ...o2]); cx = x; cy = y; continue; }
    if (op === 'A') { const [o, x, y] = pt(c[6]); d += 'a' + num([f(c[1]), f(c[2]), c[3], c[4], c[5], ...o]); cx = x; cy = y; continue; }
  }
  return d;
};
// stadium between two points (winds counter-clockwise on screen)
const capC = (x1, y1, x2, y2, w) => {
  const r = w / 2, dx = x2 - x1, dy = y2 - y1, l = Math.hypot(dx, dy) || 1, nx = -dy / l * r, ny = dx / l * r;
  return [['M', [x1 + nx, y1 + ny]], ['L', [x2 + nx, y2 + ny]], ['A', r, r, 0, 0, 0, [x2 - nx, y2 - ny]], ['L', [x1 - nx, y1 - ny]], ['A', r, r, 0, 0, 0, [x1 + nx, y1 + ny]], ['Z']];
};
const cap = (...a) => rel(capC(...a));
const limb = (pts, w) => pts.slice(1).map((p, i) => cap(pts[i][0], pts[i][1], p[0], p[1], w)).join('');
// polygon with quadratic-rounded corners; rad number or array
const rpoly = (pts, rad) => {
  const n = pts.length, cm = [];
  for (let i = 0; i < n; i++) {
    const v = pts[i], a = pts[(i + n - 1) % n], b = pts[(i + 1) % n], r = Array.isArray(rad) ? rad[i] : rad;
    if (!r) { cm.push([i ? 'L' : 'M', v]); continue; }
    const la = Math.hypot(a[0] - v[0], a[1] - v[1]), lb = Math.hypot(b[0] - v[0], b[1] - v[1]);
    const ta = Math.min(r / la, .5), tb = Math.min(r / lb, .5);
    const p1 = [v[0] + (a[0] - v[0]) * ta, v[1] + (a[1] - v[1]) * ta], p2 = [v[0] + (b[0] - v[0]) * tb, v[1] + (b[1] - v[1]) * tb];
    cm.push([i ? 'L' : 'M', p1], ['Q', v, p2]);
  }
  cm.push(['Z']);
  return rel(cm);
};
const star = (cx, cy, R1, R2, n = 5, rot = -90) => Array.from({ length: n * 2 }, (_, i) => {
  const a = (rot + i * 180 / n) * Math.PI / 180, r = i % 2 ? R2 : R1; return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
});
const spark = (x, y, s) => `M${f(x)} ${f(y - s)}q0 ${f(s)} ${f(s)} ${f(s)}q${f(-s)} 0 ${f(-s)} ${f(s)}q0 ${f(-s)} ${f(-s)} ${f(-s)}q${f(s)} 0 ${f(s)} ${f(-s)}Z`;
const circ = (x, y, r) => `M${f(x - r)} ${f(y)}a${f(r)} ${f(r)} 0 1 0 ${f(2 * r)} 0a${f(r)} ${f(r)} 0 1 0 ${f(-2 * r)} 0Z`;
// winding helpers: fills wind like cap()/circ() (counter-clockwise), holes the other way,
// so a hole cuts under the default nonzero rule while overlapping fills still union.
const area = pts => pts.reduce((s, p, i) => { const q = pts[(i + 1) % pts.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0);
const orient = (pts, rad, want) => {
  const flip = want ? area(pts) > 0 : area(pts) < 0;
  return flip ? rpoly([...pts].reverse(), Array.isArray(rad) ? [...rad].reverse() : rad) : rpoly(pts, rad);
};
const rp = (pts, r = 0) => orient(pts, r, true), rpH = (pts, r = 0) => orient(pts, r, false);
// rects: fill goes down the left side first (ccw), hole goes up it first (cw)
const box = (x, y, w, h, r = 0) => r ? `M${f(x)} ${f(y + r)}v${f(h - 2 * r)}a${f(r)} ${f(r)} 0 0 0 ${f(r)} ${f(r)}h${f(w - 2 * r)}a${f(r)} ${f(r)} 0 0 0 ${f(r)} ${f(-r)}v${f(2 * r - h)}a${f(r)} ${f(r)} 0 0 0 ${f(-r)} ${f(-r)}h${f(2 * r - w)}a${f(r)} ${f(r)} 0 0 0 ${f(-r)} ${f(r)}Z`
  : `M${f(x)} ${f(y)}v${f(h)}h${f(w)}v${f(-h)}Z`;
const boxH = (x, y, w, h, r = 0) => r ? `M${f(x)} ${f(y + r)}a${f(r)} ${f(r)} 0 0 1 ${f(r)} ${f(-r)}h${f(w - 2 * r)}a${f(r)} ${f(r)} 0 0 1 ${f(r)} ${f(r)}v${f(h - 2 * r)}a${f(r)} ${f(r)} 0 0 1 ${f(-r)} ${f(r)}h${f(2 * r - w)}a${f(r)} ${f(r)} 0 0 1 ${f(-r)} ${f(-r)}Z`
  : `M${f(x)} ${f(y)}h${f(w)}v${f(h)}h${f(-w)}Z`;
const circH = (x, y, r) => `M${f(x - r)} ${f(y)}a${f(r)} ${f(r)} 0 1 1 ${f(2 * r)} 0a${f(r)} ${f(r)} 0 1 1 ${f(-2 * r)} 0Z`;
const ell = (x, y, rx, ry) => `M${f(x - rx)} ${f(y)}a${f(rx)} ${f(ry)} 0 1 0 ${f(2 * rx)} 0a${f(rx)} ${f(ry)} 0 1 0 ${f(-2 * rx)} 0Z`;
const arcPts = (cx, cy, r, a0, a1, n) => Array.from({ length: n + 1 }, (_, i) => {
  const a = (a0 + (a1 - a0) * i / n) * Math.PI / 180; return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
});
// pointed leaf from base b along unit dir u, length len, half-width w
const leaf = (b, u, len, w) => {
  const n = [-u[1], u[0]], t = [b[0] + u[0] * len, b[1] + u[1] * len], m = [b[0] + u[0] * len * .5, b[1] + u[1] * len * .5];
  const c1 = [m[0] + n[0] * w * 2, m[1] + n[1] * w * 2], c2 = [m[0] - n[0] * w * 2, m[1] - n[1] * w * 2];
  return rel([['M', b], ['Q', c2, t], ['Q', c1, b], ['Z']]);
};

const icons = [];
// shorten numbers inside d attributes: drop leading zeros and the space before a minus sign
const tight = svg => svg.replace(/ d="([^"]*)"/g, (m, d) => ` d="${d.replace(/(^|[^\d.])0\.(\d)/g, '$1.$2').replace(/ -/g, '-')}"`);
const add = (id, motif, svg) => icons.push({ id, motif, svg: tight(svg) });

// ---------- car-lift (side-on, facing right)
{
  let s = '';
  // posts with caps, carriages, base plates, lift arms and pads
  s += P('t-a', box(4.5, 9, 4.5, 47.5) + box(55, 9, 4.5, 47.5));
  s += P('t-b', box(4, 7, 5.5, 3) + box(54.5, 7, 5.5, 3) + box(3.5, 55.5, 7.5, 3.5, .8) + box(53, 55.5, 7.5, 3.5, .8) +
    box(3.8, 27.5, 6, 11) + box(54.2, 27.5, 6, 11) + box(9, 34.5, 20.5, 2.6) + box(36, 34.5, 19.5, 2.6) + box(26.8, 29.4, 3, 6) + box(36.2, 29.4, 3, 6));
  // car body with window and headlight holes
  const body = 'M12 20.5V27q0 2 2 2h2.6a4.9 4.9 0 0 1 9.8 0h13a4.9 4.9 0 0 1 9.8 0h2.3q2 0 2-2v-4.4q0-2-1.9-2.5L46 18.6l-5.4-6.5Q39.6 11 38.1 11H27q-1.4 0-2.4 1.1L20 18.5l-6 .6q-2 .2-2 1.4Z';
  s += P('t-a', body + rpH([[21.6, 18.2], [25.9, 13], [31.2, 13], [31.2, 18.2]], .8) + rpH([[33.2, 13], [38.6, 13], [43.4, 18.2], [33.2, 18.2]], .8) + boxH(50.4, 21.6, 2.3, 1.8));
  s += P('t-c', box(50.4, 21.6, 2.3, 1.8));
  // tail light, rocker shade, door handles
  s += P('t-b', box(12, 21, 1.8, 2.8) + box(26.4, 26.6, 13, 2.4) + box(29.4, 21.4, 2.6, 1.1) + box(40.4, 21.4, 2.6, 1.1));
  s += L('M32.2 18.8V26.2M14 24.5H26M39.6 24.5H52', 1);
  // wheels as rings
  s += P('t-b', circ(21.5, 29, 4.4) + circH(21.5, 29, 1.7) + circ(44.3, 29, 4.4) + circH(44.3, 29, 1.7));
  s += P('t-c', circ(21.5, 29, .9) + circ(44.3, 29, .9));
  // toolbox with drawer-pull holes and carry handle
  s += L('M19 43.6V40.6H29V43.6', 1.8);
  s += P('t-a', box(14, 45, 20, 13, 1.4) + boxH(21.6, 47.4, 4.8, 1.3) + boxH(21.6, 51.4, 4.8, 1.3) + boxH(21.6, 55.2, 4.8, 1.3));
  s += P('t-b', box(13, 43, 22, 3, .8) + box(14.5, 49.7, 19, 1) + box(14.5, 53.6, 19, 1));
  // wrench: box-end ring, shaft, open jaw head (all wound the same way)
  {
    const A = [38.5, 56.4], H = [49.6, 47.6], dx = H[0] - A[0], dy = H[1] - A[1], l = Math.hypot(dx, dy), u = [dx / l, dy / l], n = [-u[1], u[0]];
    const r = 3.9, hw = 1.5, sx = Math.sqrt(r * r - hw * hw), at = (a, b) => [H[0] + u[0] * a + n[0] * b, H[1] + u[1] * a + n[1] * b];
    const head = rel([['M', at(sx, -hw)], ['A', r, r, 0, 1, 0, at(sx, hw)], ['L', at(-.4, hw)], ['L', at(-.4, -hw)], ['Z']]);
    s += P('t-a', head + circ(A[0], A[1], 2.8) + circH(A[0], A[1], 1.3) + cap(A[0] + u[0] * 2.9, A[1] + u[1] * 2.9, H[0] - u[0] * 2.6, H[1] - u[1] * 2.6, 2.8));
  }
  s += P('t-c', spark(17, 5.5, 2.6) + spark(48, 5, 2.2));
  add('car-lift', 'car raised on a two-post garage lift above a toolbox and wrench', s);
}

// ---------- school-desks (seen from the back of the room, board at the top)
{
  let s = '';
  // board edge and chalk tray; chalk and eraser cut out of the board
  s += P('t-b', box(4, 2.5, 56, 4.5) + boxH(15, 4.8, 5, 1.7) + boxH(22, 5, 3.5, 1.5) + boxH(41, 3.4, 8, 3.1));
  s += P('t-c', box(15, 4.8, 5, 1.7) + box(22, 5, 3.5, 1.5));
  s += P('t-a', box(41, 3.4, 8, 3.1) + box(3.5, 7, 57, 2.6, 1));
  const VP = [32, -30];
  let a = '', b = '', c = '', l = '';
  const unit = (cx, yf, sc) => {
    const t = 7 / 76, back = x => VP[0] + (x - VP[0]) * (1 - t), hw = 11 * sc, cw2 = 6.6 * sc, ct = yf + 3.4 * sc;
    a += rp([[back(cx - hw), yf - 7 * sc], [back(cx + hw), yf - 7 * sc], [cx + hw, yf], [cx - hw, yf]]);
    b += box(cx - hw, yf, 2 * hw, 2 * sc);
    l += `M${f(cx - hw + 1.4 * sc)} ${f(yf + 2 * sc)}V${f(yf + 8.5 * sc)}M${f(cx + hw - 1.4 * sc)} ${f(yf + 2 * sc)}V${f(yf + 8.5 * sc)}`;
    c += rp([[cx - cw2, ct + 5 * sc], [cx - cw2, ct + 1.2 * sc], [cx, ct - .4 * sc], [cx + cw2, ct + 1.2 * sc], [cx + cw2, ct + 5 * sc]], [.8 * sc, 2 * sc, 6 * sc, 2 * sc, .8 * sc]) + boxH(cx - 3.4 * sc, ct + 1.8 * sc, 6.8 * sc, 1.4 * sc);
    l += `M${f(cx - cw2 + 1.3 * sc)} ${f(ct + 5 * sc)}l${f(-.4 * sc)} ${f(4.5 * sc)}M${f(cx + cw2 - 1.3 * sc)} ${f(ct + 5 * sc)}l${f(.4 * sc)} ${f(4.5 * sc)}`;
  };
  for (const yf of [17.5, 29, 44]) {
    const sc = (yf - VP[1]) / 76;
    unit(32 - 15 * sc, yf, sc); unit(32 + 15 * sc, yf, sc);
  }
  s += L(l, 1.4) + P('t-a', a) + P('t-b', b + c);
  // apple on the front desk, highlight cut out
  s += P('t-b', circ(46.2, 39.6, 3.8) + leaf([46.9, 36], [.7, -.72], 4.4, 1.15) + rpH([[43.8, 38.8], [44.9, 37.2], [45.4, 38.2], [44.5, 39.8]], .5));
  s += L('M46.2 36.4Q46 35 45.2 34.2', 1.2);
  s += P('t-c', spark(7, 16, 2.8) + spark(57.5, 15, 2.3));
  add('school-desks', 'rows of school desks and chairs below the chalk tray, apple on the front desk', s);
}

// ---------- farmer
{
  let s = '';
  // wheat stalks
  s += L('M7 59Q6 47 6.6 33M11.5 59Q11.6 46 12 29.5M9.2 59Q8.8 50 9 42', 1.3);
  let g = '';
  const wheat = (x, y, k, sc) => {
    for (let i = 0; i < k; i++) {
      const yy = y + i * 2.8 * sc;
      g += leaf([x, yy + 2], [-.55, -.83], 3.4 * sc, .85 * sc) + leaf([x, yy + 2], [.55, -.83], 3.4 * sc, .85 * sc);
    }
    g += leaf([x, y + .6], [0, -1], 3.6 * sc, .85 * sc);
  };
  wheat(6.6, 26.5, 2, 1); wheat(12, 23, 2, 1); wheat(9, 36.5, 2, .85);
  s += P('t-a', g);
  // pitchfork handle split around the hand
  s += P('t-b', cap(49, 58.6, 49, 36.4, 2.4) + cap(49, 29.6, 49, 16.4, 2.4) + box(43.4, 14.2, 11.2, 2.4) +
    cap(44.6, 15.4, 44.2, 5.5, 1.8) + cap(49, 15.4, 49, 4.8, 1.8) + cap(53.4, 15.4, 53.8, 5.5, 1.8));
  // face, then hat over it
  s += C('t-c', 29, 21.2, 5.6);
  s += P('t-a', rp([[22, 14.4], [23.6, 6.4], [34.4, 6.4], [36, 14.4]], 2.4) + ell(29, 14.6, 14, 3.3));
  s += P('t-b', box(22.5, 10.8, 13, 2.3) + 'M18.4 16.4Q29 21.2 39.6 16.4Q29 18.6 18.4 16.4Z');
  s += L('M17.5 14.5l-1.3 2.1M21 16.2l-.8 2M37 16.2l.8 2M40.5 14.5l1.3 2.1', 1);
  s += C('t-b', 26.8, 22.2, .95) + C('t-b', 31.2, 22.2, .95) + L('M26.6 24.4Q29 26.2 31.4 24.4', 1.2);
  // shirt and arms
  s += P('t-a', rp([[18.5, 30], [22.5, 27], [35.5, 27], [39.5, 30], [38.8, 44], [19.2, 44]], 3) +
    limb([[19.8, 30], [16.8, 37.5], [16.2, 42.5]], 5.4) + limb([[38.4, 30], [43, 35.2], [47.6, 33.2]], 5.4));
  // dungarees: bib, straps, legs, pocket and button holes
  s += P('t-b', box(23, 31.5, 12, 13) + cap(23.6, 31.4, 22.6, 27.4, 2.4) + cap(34.4, 31.4, 35.4, 27.4, 2.4) +
    rp([[20.8, 43], [37.2, 43], [37.6, 57], [30.6, 57], [29, 48.5], [27.4, 57], [20.4, 57]], [1, 1, 0, 0, .6, 0, 0]) +
    boxH(26, 36, 6, 4.4, .6) + circH(24.8, 34, .85) + circH(33.2, 34, .85));
  s += P('t-a', rp([[19.6, 57], [28.2, 57], [28.2, 59.8], [19.6, 59.8]], [0, 0, 1.2, 1.2]) + rp([[29.8, 57], [38.4, 57], [38.4, 59.8], [29.8, 59.8]], [0, 0, 1.2, 1.2]));
  // hands
  s += P('t-c', circ(16.2, 44.3, 2.6) + circ(49, 33, 2.9) + spark(8, 8, 3) + spark(59, 23, 2.2));
  add('farmer', 'farmer in a straw hat and dungarees with a pitchfork beside wheat stalks', s);
}

// ---------- sitcom-tv
{
  let s = '';
  // legs and cabinet base
  s += P('t-b', cap(14.5, 52, 11.5, 59.8, 2.8) + cap(45.5, 52, 48.5, 59.8, 2.8));
  // cabinet with screen hole
  const scr = rpH([[11, 28.5], [39.5, 28.5], [39.5, 49.5], [11, 49.5]], 5);
  s += P('t-a', box(7, 24.5, 46, 29, 5) + scr);
  s += P('t-b', box(9, 51, 42, 2.5, 1) + 'M11 34Q11 28.5 16.5 28.5L34 28.5Q39.5 28.5 39.5 34L39.5 31.5Q39 26.5 34 26.6L16.5 26.6Q11.5 26.5 11 31.5Z' +
    circ(46.5, 32.5, 2.9) + rpH([[46, 29.8], [47, 29.8], [47, 32.6], [46, 32.6]], .4) + circ(46.5, 40, 2.9) + rpH([[46, 37.3], [47, 37.3], [47, 40.1], [46, 40.1]], .4) +
    box(43, 44.6, 7, 1.2, .5) + box(43, 46.8, 7, 1.2, .5));
  // the scene: sofa, two heads, floor lamp
  s += L('M12.5 47.6H38.2', 1.2) + L('M35.5 33V47', 1.3);
  s += C('t-c', 19.6, 34.6, 2.2) + C('t-c', 26.4, 34.4, 2.2);
  s += P('t-a', box(14, 36.6, 16.5, 6, 2) + box(12.4, 40, 4.2, 6.6, 1.5) + box(28, 40, 4.2, 6.6, 1.5) + box(15.5, 41.5, 13.5, 3.8, .8));
  s += P('t-b', box(15.6, 45.2, 13.2, 1.2, .3)) + L('M22.3 37.6V41.4', 1);
  s += P('t-c', rp([[33.4, 33], [37.6, 33], [36.7, 30], [34.3, 30]], .5));
  // HA HA bubbles floating out of the screen
  const bubble = (cx, cy, rot, tail) => {
    const b = rp([[cx - 10.5, cy - 5.2], [cx + 10.5, cy - 5.2], [cx + 10.5, cy + 5.2], [cx - 10.5, cy + 5.2]], 4.5) + rp(tail, .4);
    const ha = x => `M${f(x)} ${f(cy + 2.6)}V${f(cy - 2.6)}M${f(x + 3.6)} ${f(cy + 2.6)}V${f(cy - 2.6)}M${f(x)} ${f(cy)}H${f(x + 3.6)}` +
      `M${f(x + 5.4)} ${f(cy + 2.6)}L${f(x + 7.4)} ${f(cy - 2.6)}L${f(x + 9.4)} ${f(cy + 2.6)}M${f(x + 6.2)} ${f(cy + .8)}H${f(x + 8.6)}`;
    return `<g transform="rotate(${rot} ${f(cx)} ${f(cy)})">` + P('t-c', b) + L(ha(cx - 4.7), 1.5) + '</g>';
  };
  s += bubble(17, 11.5, -7, [[12.5, 15], [17, 15], [16.6, 20.4]]);
  s += bubble(44.5, 9.5, 6, [[42, 13], [47, 13], [40.8, 18.6]]);
  s += P('t-c', circ(21, 23, 1.1) + circ(36, 21.6, 1) + spark(58.5, 56.5, 2.4) + spark(31, 5, 2));
  add('sitcom-tv', 'retro TV on legs showing a sofa scene with HA HA bubbles', s);
}

// ---------- festival-laurel
{
  let s = '';
  const cx = 32, cy = 33, R0 = 22;
  const side = (mir) => {
    const mp = p => mir ? [64 - p[0], p[1]] : p, mu = u => mir ? [-u[0], u[1]] : u;
    let o = '', i2 = '';
    const [s0, s1] = [arcPts(cx, cy, R0, 96, 238, 1)[0], arcPts(cx, cy, R0, 96, 238, 1)[1]].map(mp);
    const stem = `M${f(s0[0])} ${f(s0[1])}A${R0} ${R0} 0 0 ${mir ? 0 : 1} ${f(s1[0])} ${f(s1[1])}`;
    const angs = [112, 133, 154, 175, 196, 217];
    for (const a of angs) {
      const r = a * Math.PI / 180, p = [cx + R0 * Math.cos(r), cy + R0 * Math.sin(r)];
      const tg = [-Math.sin(r), Math.cos(r)], nm = [Math.cos(r), Math.sin(r)], c = Math.cos(.62), sn = Math.sin(.62);
      o += leaf(mp(p), mu([tg[0] * c + nm[0] * sn, tg[1] * c + nm[1] * sn]), 8, 1.75);
      i2 += leaf(mp(p), mu([tg[0] * c - nm[0] * sn, tg[1] * c - nm[1] * sn]), 6.8, 1.5);
    }
    const r = 238 * Math.PI / 180, p = [cx + R0 * Math.cos(r), cy + R0 * Math.sin(r)];
    o += leaf(mp(p), mu([-Math.sin(r), Math.cos(r)]), 7.5, 1.7);
    return { stem, o, i2 };
  };
  const Ls = side(false), Rs = side(true);
  s += L(Ls.stem + Rs.stem, 1.8);
  s += P('t-a', Ls.o + Rs.o);
  s += P('t-b', Ls.i2 + Rs.i2);
  // bow and ribbon tails where the stems cross
  s += P('t-b', rp([[30.6, 55.4], [26.2, 61], [28.8, 60.4], [30, 62], [32.6, 56.6]], .5) + rp([[33.4, 55.4], [37.8, 61], [35.2, 60.4], [34, 62], [31.4, 56.6]], .5) +
    circ(32, 55.4, 2.4));
  // film-strip frame with sprocket holes and a star window
  let fr = box(20.5, 18.5, 23, 27, 1.4);
  for (let k = 0; k < 6; k++) { const y = 20.3 + k * 4.2; fr += boxH(22, y, 2.4, 2.4) + boxH(39.6, y, 2.4, 2.4); }
  fr += boxH(26.4, 21.5, 11.2, 21, 1.2);
  s += P('t-a', fr);
  s += P('t-c', rp(star(32, 32.6, 5.2, 2.2)));
  s += P('t-c', spark(32, 9.5, 3.2) + spark(7, 7, 2.6) + spark(57, 7, 2.6));
  add('festival-laurel', 'laurel wreath around a film-strip frame with a star', s);
}

// ---------- haunted-house
{
  let s = '';
  // bare tree
  s += P('t-b', cap(10.8, 57, 12, 33, 4) + limb([[11.4, 42.5], [6.6, 35.5], [5.2, 30]], 2.2) + limb([[12, 37], [16.2, 30], [16.8, 24.5]], 2) +
    limb([[12, 34], [9.8, 26.5], [6.4, 21.5]], 2) + cap(10.2, 27, 12.4, 20.5, 1.5) + cap(16.2, 30, 19, 28.4, 1.4) + cap(6.4, 35.5, 4.6, 37, 1.3));
  // ground
  s += P('t-b', 'M4.2 60L4.2 57.6Q18 54.4 32 56Q46 57.6 59.8 55.4L59.8 60Z');
  // crooked house and side wing, lit window panes cut out
  const panes = [[24.4, 35.2], [28.2, 35], [24.6, 39.4], [28.4, 39.2]].map(([x, y]) => rpH([[x, y], [x + 3.2, y - .2], [x + 3.3, y + 3.6], [x + .1, y + 3.8]])).join('');
  s += P('t-a', rp([[22.2, 57], [21, 31], [46.6, 29], [47.6, 57]]) + rp([[46.6, 57], [46.8, 40.5], [56.6, 39.6], [57, 57]]) + panes);
  s += P('t-c', panes);
  // roofs, chimney, attic window
  s += P('t-b', rp([[39, 15], [43.6, 13.8], [44.6, 23], [40, 24]]) + box(38.2, 12.6, 6.6, 2.2));
  s += P('t-b', rp([[16, 32.8], [24.6, 19.6], [31.4, 5.6], [38.6, 17.6], [52, 29.8]], [1, .6, 1.2, .6, 1]) + circH(31.6, 21, 3));
  s += C('t-c', 31.6, 21, 3);
  s += L('M31.6 18V24M28.6 21H34.6', 1.1);
  s += P('t-b', rp([[44.8, 41.6], [51.6, 30.6], [58.6, 40.6]], [.8, 1, .8]));
  // dark window, wing window, door
  s += P('t-b', rp([[37, 34.6], [43.6, 34], [44.1, 42.4], [37.4, 43]]) + rp([[49.8, 44.6], [53.6, 44.2], [53.8, 49.6], [50, 50]]) +
    'M30.6 57V48.8Q30.6 45.2 34 45.2Q37.4 45.2 37.4 48.8V57Z' + 'M21 33.6L23.4 34.4L23.2 43L20.8 42.6Z');
  s += L('M23.4 44.8H32.2', 1.2);
  // crescent moon and bat
  {
    const c1 = [51.5, 12.5], r1 = 7, c2 = [55, 9.8], r2 = 6;
    const d = Math.hypot(c2[0] - c1[0], c2[1] - c1[1]), a = (r1 * r1 - r2 * r2 + d * d) / (2 * d), h = Math.sqrt(r1 * r1 - a * a);
    const ux = (c2[0] - c1[0]) / d, uy = (c2[1] - c1[1]) / d, mx = c1[0] + ux * a, my = c1[1] + uy * a;
    const p1 = [mx - uy * h, my + ux * h], p2 = [mx + uy * h, my - ux * h];
    s += P('t-c', `M${f(p1[0])} ${f(p1[1])}A${r1} ${r1} 0 1 1 ${f(p2[0])} ${f(p2[1])}A${r2} ${r2} 0 0 0 ${f(p1[0])} ${f(p1[1])}Z`);
  }
  const half = [[17, 7.6], [18.5, 5.4], [19, 7.8], [21.4, 7], [25, 6.2], [24.4, 9], [22.4, 9.4], [20.8, 11.2], [18.8, 10.4], [17, 12.8]];
  const bat = [...half, ...half.slice(1, -1).reverse().map(([x, y]) => [34 - x, y])];
  s += P('t-b', rp(bat, .35));
  s += P('t-c', spark(6, 15, 2.6) + spark(41.5, 6, 2.2));
  add('haunted-house', 'crooked haunted house with a lit window, bare tree, moon and bat', s);
}

fs.writeFileSync(process.argv[2] || new URL('../../icons/part50.json', import.meta.url), JSON.stringify(icons, null, 1));
console.log(icons.map(i => `${i.id} ${i.svg.length}`).join('\n'));
