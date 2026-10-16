// Generates part22.json (round 4): tiger, gorilla, cycling-helmet, xylophone, pilot-cap, fruit-bowl.
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
// tapered stripe: base a..b, tip t, bowed by `bend` (perpendicular units)
const wedge = (a, b, t, bend = 0) => {
  const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, dx = t[0] - mx, dy = t[1] - my, l = Math.hypot(dx, dy) || 1;
  const px = -dy / l * bend, py = dx / l * bend;
  const c1 = [(a[0] + t[0]) / 2 + px, (a[1] + t[1]) / 2 + py], c2 = [(b[0] + t[0]) / 2 + px, (b[1] + t[1]) / 2 + py];
  return `M${f(a[0])} ${f(a[1])}Q${f(c1[0])} ${f(c1[1])} ${f(t[0])} ${f(t[1])}Q${f(c2[0])} ${f(c2[1])} ${f(b[0])} ${f(b[1])}Z`;
};
const cub = (p, t) => [0, 1].map(k => (1 - t) ** 3 * p[0][k] + 3 * (1 - t) ** 2 * t * p[1][k] + 3 * (1 - t) * t * t * p[2][k] + t ** 3 * p[3][k]);
const yAt = (p, x) => { let best = null; for (let i = 0; i <= 200; i++) { const q = cub(p, i / 200); if (!best || Math.abs(q[0] - x) < Math.abs(best[0] - x)) best = q; } return best[1]; };


// ---------- tiger (side-on, facing right)
{ let s = '';
  // far legs
  s += P('t-b', limb([[45, 35], [42, 46], [40, 53]], 6.5) + rpoly([[36, 52], [44, 52], [44.5, 56.5], [35.5, 56.5]], 2)
    + limb([[20, 37], [24, 46], [26, 53]], 6.5) + rpoly([[22.5, 52], [30, 52], [30.5, 56.5], [22, 56.5]], 2));
  // tail with ring cut-outs
  const tail = 'M16 23.5C10 22.5 5 19 5 13Q5 8 9 7.5Q11.5 7.8 11 10Q9 12 9 15C9.5 20 12.5 25 16 27.5Z';
  const rings = wedge([6, 18.2], [6.8, 20.6], [10, 18.4], .4) + wedge([5.6, 12.4], [5.4, 14.8], [9.2, 12.6], 0);
  s += P('t-a', tail + rings, ' fill-rule="evenodd"');
  // body + near legs, stripes cut out
  const back = [[44, 22], [36, 20], [22, 21], [15, 23.5]];
  const body = 'M44 22C36 20 22 21 15 23.5C9 26 7.5 33 10 38.5C9 42 7 47 5.5 52Q4.5 56 8 56L13.5 56Q15.5 55.5 14 53.5L13 50C14.5 46 17 43 21 41C26 42.5 34 42.5 40 40.5C42 46 44 51 45 53.5Q45.5 56.5 49 56.5L55 56.5Q57.5 56 56 53.8L53 51C51.5 46 51 40 50.5 34C50 29 48 24 44 22Z';
  let st = '';
  for (const [x, len, lean] of [[18.5, 10, 1], [24.5, 13, 1.5], [30.5, 12, 1.5], [36.5, 13, 1], [41.5, 8, 0]]) {
    const y = yAt(back, x) + 1.1; st += wedge([x - 1.7, y], [x + 1.7, y + .2], [x + lean, y + len], .8);
  }
  st += wedge([25.2, 41.3], [28.6, 41.6], [26, 35], -.6) + wedge([32, 41.6], [35.4, 41.2], [34.5, 35.5], .6);
  st += wedge([9.3, 29.5], [9.1, 32.5], [17, 31.5], -.8) + wedge([10, 35.5], [10.6, 38.5], [17.5, 37.5], -.8);
  st += wedge([8.4, 43.5], [7.8, 46.5], [12.8, 45.5], 0);
  st += wedge([50.9, 42.4], [51.2, 45.2], [45, 44.6], .5) + wedge([51.6, 47.2], [52.2, 49.8], [46.5, 49.4], .5);
  s += P('t-a', body + st, ' fill-rule="evenodd"');
  // ear behind head
  s += C('t-a', 44.5, 15.8, 3.4) + C('t-b', 44.5, 15.8, 1.7);
  // head: eye, face stripes and muzzle patch cut out
  const head = 'M40.5 30C39 22 42 15.5 48.5 15C53.5 14.6 57 17 58 20L60.5 21.8Q62.5 23.5 61.5 25.5Q61 28 58.5 29Q57.5 32 54.5 33L52.5 35.2L50.5 33.6L48 36L46.5 34L43.5 35L43 32.5Z';
  const eye = 'M50.6 20.8Q53 18.2 56 19.5Q53.8 22.6 50.6 20.8Z';
  const muz = 'M53.5 25.2Q56 23 59.5 24.2Q61.2 25.8 59.8 27.6Q58.3 30.6 55 31.2Q52.2 31 52 28.4Q52 26.4 53.5 25.2Z';
  const fst = wedge([45.4, 17.2], [47.4, 16.2], [47.6, 20.5], 0) + wedge([49.2, 15.7], [51.2, 15.8], [50.2, 18.8], 0)
    + wedge([41.4, 23.6], [41.2, 26.2], [47, 25.4], .3) + wedge([41.7, 28.2], [42.1, 30.8], [47, 30.4], .3);
  s += P('t-a', head + eye + muz + fst, ' fill-rule="evenodd"');
  s += P('t-c', muz);
  s += P('t-b', 'M58.4 22.3L61.6 22.5Q62 24.3 60.3 25.1Q58.8 24.4 58.4 22.3Z');
  s += L('M60.2 26.4Q58.2 27.9 56.4 26.8M56.4 26.8Q55.5 28.6 56.6 29.8', 1.1);
  s += C('t-c', 54.2, 20, .7);
  s += P('t-c', spark(29, 8.5, 3.2) + spark(58.5, 9, 2.4));
  add('tiger', 'striding tiger with bold stripes', s);
}

// ---------- gorilla (front-on, standing on its knuckles)
{ let s = '';
  const mx = pts => pts.map(([x, y]) => [64 - x, y]);
  // short legs behind, between the arms
  const leg = [[21.5, 43], [31, 43], [30.5, 53], [31.5, 58.2], [19.5, 58.2], [21, 52]];
  s += P('t-b', rpoly(leg, 2) + rpoly(mx(leg), 2));
  // shoulders, long arms and chest as one silhouette (dips under the head so the face hole stays clear)
  const half = 'M32 34.5C36.5 34.5 40.5 31 41.6 25L42.5 17C47 16 52.5 17.5 56 21C59.5 24 60.2 29 59.8 34L59.4 50C59.8 53 59.8 57 57 58L48 58Q45.5 58 46 55L46.5 42C42 46 37 47.5 32 47.5';
  const mir = 'C27 47.5 22 46 17.5 42L18 55Q18.5 58 16 58L7 58C4.2 57 4.2 53 4.6 50L4.2 34C3.8 29 4.5 24 8 21C11.5 17.5 17 16 21.5 17L22.4 25C23.5 31 27.5 34.5 32 34.5Z';
  s += P('t-a', half + mir);
  // arm inner edges, pecs, knuckles
  s += L('M46.8 27C45.8 33 46 38 46.5 42M17.2 27C18.2 33 18 38 17.5 42', 1.6);
  s += L('M22 38Q27 41.5 32 39.5Q37 41.5 42 38', 1.5);
  s += L('M50.5 58V54.6M54 58V54.6M13.5 58V54.6M10 58V54.6', 1.3);
  // head: domed crest, heavy brow, lighter face cut out
  const head = 'M32 6C36.8 6.4 42 10.6 42.8 16.4C43.5 21.5 42.7 26.5 39.8 30C37.4 33 34.6 33.8 32 33.8C29.4 33.8 26.6 33 24.2 30C21.3 26.5 20.5 21.5 21.2 16.4C22 10.6 27.2 6.4 32 6Z';
  const face = 'M32 17.4Q35.2 14.6 38.6 15.8Q40.4 17 39.8 20.4C39.3 25.4 37 30.8 32 31.2C27 30.8 24.7 25.4 24.2 20.4Q23.6 17 25.4 15.8Q28.8 14.6 32 17.4Z';
  s += P('t-b', head + face, ' fill-rule="evenodd" transform="translate(32 19) scale(1.13) translate(-32 -19)"');
  s += C('t-b', 20.4, 21, 2.7) + C('t-b', 43.6, 21, 2.7) + C('t-a', 20.4, 21, 1.2) + C('t-a', 43.6, 21, 1.2);
  s += P('t-a', head + face, ' fill-rule="evenodd"');
  s += P('t-c', face);
  // brow shadow, eyes, nose, mouth
  s += P('t-b', 'M25 17.2Q28.6 15.8 31.4 18.4Q28.4 17.6 25.2 18.8ZM39 17.2Q35.4 15.8 32.6 18.4Q35.6 17.6 38.8 18.8Z');
  s += C('t-b', 28.4, 20.6, 1.3) + C('t-b', 35.6, 20.6, 1.3);
  s += E('t-b', 30.5, 25.6, 1.5, 1.05, 25) + E('t-b', 33.5, 25.6, 1.5, 1.05, -25);
  s += L('M30.6 21.8Q32 23.4 33.4 21.8', 1.1);
  s += L('M28 28.8Q32 30.2 36 28.8', 1.3);
  s += L('M29.5 10.2Q32 8.8 34.5 10.2', 1.2);
  s += P('t-c', spark(7, 8, 3.2) + spark(57.5, 7.5, 2.6));
  add('gorilla', 'gorilla front-on on its knuckles, lighter face under a heavy brow', s);
}

// ---------- cycling-helmet (side view, front to the right)
{ let s = '';
  // straps behind the shell
  s += L('M50 37.5L37 47.5M21.5 35.5L37 47.5L41 56', 2.2);
  s += P('t-b', 'M34.3 45.3L39.8 45.3L37 50.5Z');
  s += P('t-b', rpoly([[37.5, 53.5], [43.5, 52], [44.8, 57], [38.8, 58.5]], 1));
  // shell with vents cut out
  const shell = 'M57.5 35C60 24.5 53 13 39.5 11.5C27 10.2 14.5 14.5 8 24L4.3 31.5Q3.5 34.5 6.5 34.8L18 36C23 36.5 26 33.2 31 33.2C36 33.2 39 38 45 38L55 37.8Q57.2 37.5 57.5 35Z';
  const vents = cap(11.5, 25.5, 19.5, 19.5, 3.4) + cap(23.5, 17.2, 34.5, 15.2, 3.6) + cap(39, 15.6, 48.5, 18.6, 3.4)
    + cap(16.5, 29.4, 26, 24.2, 3) + cap(30, 22.6, 41, 22.2, 3.2) + cap(45, 24.2, 52.5, 28.6, 3);
  s += P('t-a', shell + vents, ' fill-rule="evenodd"');
  // liner rim along the lower edge
  s += P('t-b', 'M5 32.2L18 33.4C23 33.6 26 30.4 31 30.4C36 30.4 39 35 45 35L57.9 34.3Q57.8 34.7 57.5 35Q57.2 37.5 55 37.8L45 38C39 38 36 33.2 31 33.2C26 33.2 23 36.5 18 36L6.5 34.8Q3.5 34.5 4.3 31.5Z');
  // rear dial, top highlight
  s += P('t-b', rpoly([[7.5, 34.6], [13, 35.2], [12.6, 38.6], [8, 38.2]], 1.2));
  s += P('t-c', 'M42 13.3Q51 15 55 22Q50.5 17.8 42 15Z');
  s += P('t-c', spark(8, 8, 3.4) + spark(58, 47, 2.6) + spark(14, 49, 2));
  add('cycling-helmet', 'vented road-cycling helmet with straps', s);
}

// ---------- xylophone
{ let s = '';
  const cy = 41, bw = 6.4, xs = [7.5, 15.5, 23.5, 31.5, 39.5, 47.5], hs = xs.map((_, i) => 16 - 1.8 * i);
  const ry = (x, sgn) => { const k = (x - (xs[0] + bw / 2)) / (xs[5] - xs[0]); return cy + sgn * ((hs[0] - 3.4) + (hs[5] - hs[0]) * k); };
  // rails
  s += P('t-b', cap(4.5, ry(4.5, -1), 57, ry(57, -1), 4.4) + cap(4.5, ry(4.5, 1), 57, ry(57, 1), 4.4));
  // bars with nail holes (rail shows through)
  let bars = '', shade = '';
  xs.forEach((x, i) => {
    const h = hs[i], cx = x + bw / 2;
    bars += rpoly([[x, cy - h], [x + bw, cy - h], [x + bw, cy + h], [x, cy + h]], 1.6) + circ(cx, ry(cx, -1), 1) + circ(cx, ry(cx, 1), 1);
    shade += rpoly([[x, cy + h - 3], [x + bw, cy + h - 3], [x + bw, cy + h], [x, cy + h]], [0, 0, 1.6, 1.6]);
  });
  s += P('t-a', bars, ' fill-rule="evenodd"');
  s += P('t-b', shade);
  // mallets crossed above the short end
  s += P('t-b', cap(29, 26.5, 50.5, 9, 2.4) + cap(59, 26, 37, 9.5, 2.4));
  s += C('t-a', 52, 7.6, 4.2) + C('t-a', 35.5, 8, 4.2);
  s += P('t-b', 'M48.6 10A4.2 4.2 0 0 0 55.8 9.3A5 5 0 0 1 48.6 10ZM32 10.4A4.2 4.2 0 0 0 39.3 9.7A5 5 0 0 1 32 10.4Z');
  s += C('t-c', 50.6, 6.2, 1.1) + C('t-c', 34.1, 6.6, 1.1);
  s += P('t-c', spark(9, 10, 3.4) + spark(19, 18, 2));
  add('xylophone', 'toy xylophone with stepped bars and two mallets', s);
}

// ---------- pilot-cap (front, seen from slightly above)
{ let s = '';
  const med = circ(32, 33, 3.4);
  const wing = sg => [[[35.2, 30.8], [35.4, 32.6], [44.5, 29.6], -.5], [[35.4, 33.3], [35.2, 34.9], [43.5, 33.4], -.4], [[34.9, 35.5], [34.3, 36.7], [41, 36.3], -.3]]
    .map(([a, b, t, bd]) => sg > 0 ? wedge(a, b, t, bd) : wedge([64 - a[0], a[1]], [64 - b[0], b[1]], [64 - t[0], t[1]], -bd)).join('');
  const badge = med + wing(1) + wing(-1);
  // front of the crown under the overhanging top, badge cut out
  s += P('t-b', 'M11 24.9A28 12 0 0 0 53 24.9L52 31A20 7 0 0 1 12 31Z' + badge, ' fill-rule="evenodd"');
  s += P('t-c', badge);
  s += P('t-b', rpoly(star(32, 33.2, 2.1, .9), .15));
  // wide flat top
  s += E('t-a', 32, 17, 28, 12);
  s += L('M7 18.5A25 9.8 0 0 0 57 18.5', 1.2);
  s += P('t-c', 'M10.5 12Q19 6.8 32 6.2Q20 8.4 12.3 13.3Z');
  // band with gold chin cord and buttons
  s += P('t-b', 'M12 31A20 7 0 0 0 52 31L52 36A20 7 0 0 1 12 36Z');
  s += P('t-a', 'M12.4 32.4A19.6 6.8 0 0 0 51.6 32.4L51.6 34.6A19.6 6.8 0 0 1 12.4 34.6Z');
  s += C('t-a', 13.6, 33.6, 1.9) + C('t-a', 50.4, 33.6, 1.9);
  // glossy peak jutting towards the viewer: lit top with shine cut out, dark edge underneath
  const shine = 'M15.5 44Q24 49.5 34.5 50Q24 47.8 17 42.6Z';
  s += P('t-b', 'M7 38A25 14 0 0 0 57 38L56.6 40A24.6 14 0 0 1 7.4 40Z');
  s += P('t-a', 'M12 36A20 7 0 0 0 52 36L57 38A25 14 0 0 1 7 38Z' + shine, ' fill-rule="evenodd"');
  s += P('t-c', shine);
  s = `<g transform="translate(0 3.5)">${s}</g>`;
  s += P('t-c', spark(6, 5.8, 2.8) + spark(58, 57, 2.6) + spark(6.5, 56, 2));
  add('pilot-cap', "pilot's peaked cap with winged badge, seen from above", s);
}

// ---------- fruit-bowl
{ let s = '';
  // banana arching behind
  s += P('t-c', 'M7 36C6 21 18 9.5 35 9.5L38.5 8.8Q40.6 9.2 39.3 11.4C26 12.5 15.5 21 12.5 36Z');
  s += P('t-b', 'M12.5 36C15.5 21 26 12.5 39.3 11.4L38.8 13.4C27 14.8 18.5 22 15.6 36Z');
  s += R('t-b', 37.6, 7.6, 3.4, 2.6, .8);
  // pear (right)
  s += L('M47.5 16.5Q47.5 13.5 49.5 11', 1.6);
  s += P('t-a', 'M53 13Q57.5 10 61 11.5Q57.8 15.5 53 13Z');
  s += P('t-a', 'M47 15.8C51 15.8 52 19.8 52.5 22.8C57 25.3 58.5 29.3 57.5 33.3C56.5 38.3 52.5 40.8 48.5 40.8C44 40.8 40.5 37.8 40.5 33.3C40.5 28.8 42.5 25.8 43.5 22.3C44 18.8 44 15.8 47 15.8Z');
  s += P('t-b', 'M41 30.5C40 36 43.5 40.8 48.5 40.8C52.5 40.8 55.5 38.6 56.8 35.6C53.5 38.6 47.5 39 44.2 36C42.4 34.4 41.4 32.6 41 30.5Z');
  s += P('t-c', 'M53.5 26.5Q56 28.5 56 31.5Q54.4 29.6 53.5 26.5Z');
  // apple (left)
  s += L('M18 24.5Q18 21 20 18.5', 1.6);
  s += E('t-b', 23.6, 19.2, 3.4, 1.7, -28);
  s += P('t-a', 'M18 24C21 22.5 26.5 22.5 27.5 28.5C28.5 34.5 25 41.5 18 41.5C11 41.5 7.5 34.5 8.5 28.5C9.5 22.5 15 22.5 18 24Z');
  s += P('t-b', 'M27.3 31.5C27 36.8 23.5 41.5 18 41.5C14.5 41.5 11.8 39.8 10.2 37.2C14 39.6 19.5 40 23 37.5C25.2 36 26.6 34 27.3 31.5Z');
  s += P('t-c', 'M11.8 27.5Q12.6 25 15.4 24.6Q13.6 26.4 13.4 28.6Q12.4 29.2 11.8 27.5Z');
  // grapes: separate berries, gaps show through
  let g = '';
  for (const [x, y] of [[30.6, 24.5], [37.4, 24.5], [27.2, 30.5], [34, 30.5], [40.8, 30.5], [30.6, 36.5], [37.4, 36.5]]) g += circ(x, y, 3.2);
  s += P('t-b', g);
  s += L('M34 21.5Q34 18.5 36.5 16.5', 1.5);
  // bowl
  s += P('t-b', 'M3.5 40Q32 45.5 60.5 40L60.2 43.4Q32 49 3.8 43.4Z');
  s += P('t-a', 'M3.8 43.4Q32 49 60.2 43.4C59 52 47 57 32 57C17 57 5 52 3.8 43.4Z');
  s += P('t-b', 'M6.8 49.5C12 54.6 22 55.6 32 55.6C42 55.6 52 54.6 57.2 49.5C53.5 54.6 44 57 32 57C20 57 10.5 54.6 6.8 49.5Z');
  s += P('t-b', 'M24 56.4H40L42 59.6Q42 60.6 41 60.6H23Q22 60.6 22 59.6Z');
  s += P('t-c', spark(6, 8, 3) + spark(58, 5.5, 2.4) + spark(28, 4.5, 1.8));
  add('fruit-bowl', 'bowl heaped with banana, apple, grapes and a pear', s);
}

fs.writeFileSync(process.argv[2] || new URL('../../icons/part22.json', import.meta.url), JSON.stringify(icons, null, 1));
console.log(icons.map(i => `${i.id} ${i.svg.length}`).join('\n'));
