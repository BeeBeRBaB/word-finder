// Generates part31.json (round 4).
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
const rr = (x, y, w, h, r) => `M${f(x + r)} ${f(y)}H${f(x + w - r)}Q${f(x + w)} ${f(y)} ${f(x + w)} ${f(y + r)}V${f(y + h - r)}Q${f(x + w)} ${f(y + h)} ${f(x + w - r)} ${f(y + h)}H${f(x + r)}Q${f(x)} ${f(y + h)} ${f(x)} ${f(y + h - r)}V${f(y + r)}Q${f(x)} ${f(y)} ${f(x + r)} ${f(y)}Z`;
const bez = (p0, p1, p2, p3, t) => { const u = 1 - t; return [0, 1].map(k => u * u * u * p0[k] + 3 * u * u * t * p1[k] + 3 * u * t * t * p2[k] + t * t * t * p3[k]); };

// ---------- plug-socket
{
  let s = '';
  const pl = [[5, 4], [41, 4], [41, 40], [5, 40]];
  const fc = [23, 22], fr = 11.5;
  s += P('t-b', rpoly(pl.map(([x, y]) => [x + 1.8, y + 1.8]), 7) + circ(fc[0], fc[1], fr), ' fill-rule="evenodd"');
  s += P('t-a', rpoly(pl, 7) + circ(fc[0], fc[1], fr), ' fill-rule="evenodd"');
  s += P('t-c', circ(fc[0], fc[1], fr - 1.6));
  // recess shadow + holes along the plug's axis
  s += P('t-b', `M${f(fc[0] - fr + 1.6)} ${f(fc[1])}A${f(fr - 1.6)} ${f(fr - 1.6)} 0 0 1 ${f(fc[0] + fr - 1.6)} ${f(fc[1])}A${f(fr - 3.4)} ${f(fr - 3.4)} 0 0 0 ${f(fc[0] - fr + 1.6)} ${f(fc[1])}Z`);
  const ax = Math.SQRT1_2;
  s += P('t-b', circ(fc[0] - 4 * ax, fc[1] + 4 * ax, 2.3) + circ(fc[0] + 4 * ax, fc[1] - 4 * ax, 2.3));
  // cable (behind plug)
  s += L('M55 51.5C57 57 52 61 46.5 60C40.5 59 40 52 44 52C48 52 48 59.5 41 60.5C35 61.3 30 60.5 24 60.5', 3.6);
  // plug, drawn pointing up then turned toward the socket
  let g = '';
  const cx = 45, cy = 41;
  g += R('t-b', cx - 5.5, cy - 18, 3, 10, 1.5) + R('t-b', cx + 2.5, cy - 18, 3, 10, 1.5);
  g += P('t-a', rpoly([[cx - 8.5, cy - 9], [cx + 8.5, cy - 9], [cx + 7, cy + 9], [cx - 7, cy + 9]], 3));
  g += P('t-b', `M${f(cx - 8.4)} ${f(cy - 7)}H${f(cx + 8.4)}L${f(cx + 8.2)} ${f(cy - 5)}H${f(cx - 8.2)}Z`);
  g += P('t-b', rr(cx - 5.5, cy - 1.5, 11, 1.8, .9) + rr(cx - 5.2, cy + 2, 10.4, 1.8, .9) + rr(cx - 4.9, cy + 5.5, 9.8, 1.8, .9));
  g += P('t-b', cap(cx, cy + 9, cx, cy + 14.5, 5.5));
  s += `<g transform="rotate(-45 ${cx} ${cy})">${g}</g>`;
  // bolt + sparkle
  s += P('t-a', 'M12 46L6 55H10.5L8 62L15.5 51.5H11L14 46Z');
  s += P('t-c', spark(55, 9, 4) + spark(58.5, 26, 2.2));
  add('plug-socket', 'wall power socket with a plug about to go in, cable curling', s);
}

// ---------- nurse-cap
{
  let s = '';
  s += P('t-b', 'M12 17Q11 7 21 7.5Q32 2.5 43 7.5Q53 7 52 17Z');
  const top = 'M5 12L20 18Q32 20.5 44 18L59 12';
  const cross = 'M29.8 20.6H34.2V23.4H37V27.8H34.2V30.6H29.8V27.8H27V23.4H29.8Z';
  s += P('t-a', top + 'L55 32Q32 39 9 32Z');
  s += P('t-b', 'M8.8 29Q32 36 55.2 29L55 32Q32 39 9 32Z');
  s += P('t-b', cross);
  s += P('t-c', 'M8.6 15.3L17.5 18.9L17.3 21.4L8.9 18.2Z');
  // stethoscope
  s += L('M10.5 27L9 31C9 44 20 49 32 49M53.5 27L55 31C55 44 44 49 32 49', 3);
  s += L('M32 49C32 58 36 60.5 41.5 57.5', 3.6);
  s += P('t-b', circ(11.3, 25.3, 2.7) + circ(52.7, 25.3, 2.7) + circ(32, 49, 2.6));
  s += P('t-b', cap(41, 57.8, 44.5, 56, 4));
  const hl = circ(50.5, 53, 2.8);
  s += P('t-a', circ(50.5, 53, 6.8) + hl, ' fill-rule="evenodd"');
  s += P('t-c', hl);
  s += P('t-b', 'M57.3 53A6.8 6.8 0 0 1 44.4 56A7.2 7.2 0 0 0 57.3 53Z');
  s += P('t-c', spark(55, 4.5, 3) + spark(7, 52, 3.4) + spark(20, 59, 2));
  add('nurse-cap', 'white nurse cap with a cross and a stethoscope looped in front', s);
}

// ---------- mailbox (side-on, facing right)
{
  let s = '';
  // post and ground
  s += P('t-b', 'M14 59.5Q27 55 40 59.5Z');
  s += P('t-a', rpoly([[23, 35], [31, 35], [31.5, 58], [22.5, 58]], 1));
  s += P('t-b', 'M28.5 35H31L31.5 58H29Z');
  s += R('t-b', 18, 35, 18, 3, 1);
  // letters sticking out of the open front (behind the box rim)
  const env = (cx, cy, w, h, a) => { const c = Math.cos(a * Math.PI / 180), sn = Math.sin(a * Math.PI / 180);
    const pt = (x, y) => [cx + x * c - y * sn, cy + x * sn + y * c];
    const q = [pt(-w / 2, -h / 2), pt(w / 2, -h / 2), pt(w / 2, h / 2), pt(-w / 2, h / 2)], m = pt(0, -h / 2 + h * .55);
    return { body: rpoly(q, 1), flap: `M${f(q[0][0])} ${f(q[0][1])}L${f(m[0])} ${f(m[1])}L${f(q[1][0])} ${f(q[1][1])}` }; };
  const e1 = env(51, 15, 13, 9, -28), e2 = env(56, 22, 12, 8.5, -8);
  s += P('t-c', e1.body) + L(e1.flap, 1.2);
  s += P('t-c', e2.body) + L(e2.flap, 1.2);
  // side of the box
  s += P('t-a', 'M7 36V23Q7 16 14 16H49V36Z');
  s += P('t-b', 'M7 32H49V36H7Z');
  s += L('M12 21H40', 1.2);
  // front rim with dark opening
  const op = 'M45 34V24.5A4.5 4.5 0 0 1 54 24.5V34Z';
  s += P('t-a', 'M42 36V23A7.5 7.5 0 0 1 57 23V36Z' + op, ' fill-rule="evenodd"');
  s += P('t-b', 'M54 24.5A4.5 4.5 0 0 0 51.8 20.6L53 18A7.5 7.5 0 0 1 57 23V36H54Z');
  // raised flag
  s += R('t-b', 13.5, 5, 3, 24, 1.5);
  s += P('t-a', rpoly([[16.5, 5], [30, 5], [27.5, 9], [30, 13], [16.5, 13]], .8));
  s += P('t-b', circ(15, 28, 2.4));
  s += P('t-c', spark(6, 8, 3.2) + spark(50, 49, 3.6) + spark(8, 50, 2.2));
  add('mailbox', 'curbside mailbox on a post with the flag up and letters sticking out', s);
}

// ---------- typewriter
{
  let s = '';
  // paper
  s += P('t-c', 'M19 3.5H45V24H19Z');
  s += P('t-b', rr(23, 8, 18, 1.8, .9) + rr(23, 12, 14, 1.8, .9) + rr(23, 16, 16, 1.8, .9));
  // platen and knobs
  s += P('t-b', cap(9, 24.5, 55, 24.5, 6.5));
  s += P('t-a', circ(6.5, 24.5, 3.6) + circ(57.5, 24.5, 3.6));
  s += L('M7 21L4.5 13.5L10 11.5', 2);
  // body with key holes
  const keys = [], caps = [];
  const rows = [[39.8, 6, 14.5, 7], [45.6, 7, 11, 7], [51.4, 6, 14.5, 7]];
  const cc = (x, y, r) => `M${f(x - r)} ${f(y)}a${f(r)} ${f(r)} 0 1 0 ${f(2 * r)} 0a${f(r)} ${f(r)} 0 1 0-${f(2 * r)} 0`;
  for (const [y, n, x0, dx] of rows) for (let i = 0; i < n; i++) { keys.push(cc(x0 + i * dx, y, 2.75)); caps.push(cc(x0 + i * dx, y, 2)); }
  s += P('t-a', rpoly([[11, 28], [53, 28], [57, 36], [59.5, 57], [4.5, 57], [7, 36]], [3, 3, 2, 2.5, 2.5, 2]) + keys.join(''), ' fill-rule="evenodd"');
  s += P('t-c', caps.join(''));
  // typebar basket and ribbon spools
  s += P('t-b', 'M23 28A9 6 0 0 0 41 28Z' + circ(16, 31.5, 2.6) + circ(48, 31.5, 2.6));
  s += P('t-b', 'M5 55H59L59.5 57H4.5Z');
  s += P('t-c', spark(9, 6, 3.5) + spark(55, 8, 2.6));
  add('typewriter', 'vintage typewriter with a sheet of paper and round keys', s);
}

// ---------- caption-screen
{
  let s = '';
  const scr = [8.5, 12.5, 47, 33];
  s += P('t-a', rpoly([[4, 9], [60, 9], [60, 50], [4, 50]], 4) + rr(scr[0], scr[1], scr[2], scr[3], 1.5), ' fill-rule="evenodd"');
  s += P('t-b', 'M4.1 46.5H59.9V46Q60 50 56 50H8Q4 50 4.1 46Z');
  s += P('t-c', rr(scr[0], scr[1], scr[2], scr[3], 1.5));
  // scene
  s += P('t-a', circ(44.5, 20.5, 4));
  s += P('t-a', 'M8.5 36L19 23L26 30.5L32 25L44 36Z');
  s += P('t-b', 'M19 23L22 33L26 30.5Z' + 'M32 25L35.5 36H44Z');
  // subtitle bar with cut-out words
  const words = [[14, 37.4, 7], [22.7, 37.4, 6], [30.4, 37.4, 9], [41, 37.4, 9], [17.5, 41.4, 9.5], [28.5, 41.4, 8], [38, 41.4, 8.5]];
  s += P('t-b', rr(11, 35.2, 42, 9.2, 2) + words.map(([x, y, w]) => rr(x, y, w, 2.2, 1.1)).join(''), ' fill-rule="evenodd"');
  // stand
  s += R('t-b', 28.5, 50, 7, 4);
  s += P('t-a', rpoly([[20, 53.5], [44, 53.5], [47, 58.5], [17, 58.5]], 1.5));
  s += P('t-c', spark(55.5, 4.8, 3) + spark(8, 4.8, 2.2));
  add('caption-screen', 'screen showing a scene with a subtitle bar at the bottom', s);
}

// ---------- pirate-hat
{
  let s = '';
  s += P('t-b', 'M12.5 25C12 10 20 6.5 32 6.5C44 6.5 52 10 51.5 25Z');
  const A0 = [5, 14], A1 = [10, 26], A2 = [22, 26], A3 = [32, 22];
  const B1 = [42, 26], B2 = [54, 26], B3 = [59, 14];
  const face = `M5 14C10 26 22 26 32 22C42 26 54 26 59 14C61 26 59.5 40 54.5 46Q44 53 32 53Q20 53 9.5 46C4.5 40 3 26 5 14Z`;
  // gold trim band just under the top edge
  const up = [], lo = [];
  for (let i = 0; i <= 10; i++) { const t = .18 + .82 * i / 10; up.push(bez(A0, A1, A2, A3, t)); }
  for (let i = 1; i <= 10; i++) { const t = (i / 10) * .82; up.push(bez(A3, B1, B2, B3, t)); }
  const band = up.map(([x, y], i) => `${i ? 'L' : 'M'}${f(x)} ${f(y + 1.8)}`).join('') + up.slice().reverse().map(([x, y]) => `L${f(x)} ${f(y + 3.6)}`).join('') + 'Z';
  // skull (cut out)
  const skull = 'M26.4 31.8A5.6 5.6 0 1 1 37.6 31.8Q37.6 34 36.2 35V37Q36.2 38 35.2 38H28.8Q27.8 38 27.8 37V35Q26.4 34 26.4 31.8Z';
  // crossbones outline as one shape
  const bx = 32, by = 44.9, a = 6.2, h = 1.25;
  let xb = '';
  for (let k = 0; k < 4; k++) {
    const th = (45 + 90 * k) * Math.PI / 180, d = [Math.cos(th), Math.sin(th)], p = [-d[1], d[0]];
    const ic = (ang) => [bx + h * Math.SQRT2 * Math.cos(ang), by + h * Math.SQRT2 * Math.sin(ang)];
    const c0 = ic(th - Math.PI / 4);
    const e1 = [bx + a * d[0] - h * p[0], by + a * d[1] - h * p[1]], em = [bx + a * d[0], by + a * d[1]], e2 = [bx + a * d[0] + h * p[0], by + a * d[1] + h * p[1]];
    const r = h * .95;
    xb += `${k ? 'L' : 'M'}${f(c0[0])} ${f(c0[1])}L${f(e1[0])} ${f(e1[1])}A${f(r)} ${f(r)} 0 1 0 ${f(em[0])} ${f(em[1])}A${f(r)} ${f(r)} 0 1 0 ${f(e2[0])} ${f(e2[1])}`;
  }
  xb += 'Z';
  s += P('t-a', face + band + skull + xb, ' fill-rule="evenodd"');
  s += P('t-c', band + skull + xb);
  s += P('t-b', 'M6.8 39Q8 43.5 9.5 46Q20 53 32 53Q44 53 54.5 46Q56 43.5 57.2 39Q56 47 44 50.2Q32 52.4 20 50.2Q8 47 6.8 39Z');
  s += P('t-b', 'M5.4 16C7.5 21 10 23.5 14.5 25C9.5 25.5 6 22 5.4 16Z' + 'M58.6 16C56.5 21 54 23.5 49.5 25C54.5 25.5 58 22 58.6 16Z');
  s += P('t-b', circ(29.6, 31.8, 1.7) + circ(34.4, 31.8, 1.7) + 'M32 33.6L33 35.3H31Z');
  s += L('M30.4 35.8V37.6M32 35.8V37.6M33.6 35.8V37.6', .8);
  s += P('t-c', spark(6, 6, 3.2) + spark(58, 5.5, 2.4) + spark(58, 56, 2.4) + spark(6, 55, 2));
  add('pirate-hat', 'pirate tricorn hat with skull and crossbones', s);
}

fs.writeFileSync(process.argv[2] || new URL('../../icons/part31.json', import.meta.url), JSON.stringify(icons, null, 1));
console.log(icons.map(i => `${i.id} ${i.svg.length}`).join('\n'));
