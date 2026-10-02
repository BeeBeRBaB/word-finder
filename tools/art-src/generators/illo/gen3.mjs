// Generates group3.json (jobs, school, body, health, tech, vehicles).
import fs from 'node:fs';
const r = n => +n.toFixed(1);

// Thick polyline -> closed polygon (miter joins), used as an evenodd knockout.
function strokePoly(pts, h) {
  const n = pts.length, L = [], R = [];
  const norm = (a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy); return [-dy / l, dx / l]; };
  for (let i = 0; i < n; i++) {
    let nx, ny;
    if (i === 0) [nx, ny] = norm(pts[0], pts[1]);
    else if (i === n - 1) [nx, ny] = norm(pts[n - 2], pts[n - 1]);
    else {
      const a = norm(pts[i - 1], pts[i]), b = norm(pts[i], pts[i + 1]);
      const mx = a[0] + b[0], my = a[1] + b[1], ml = Math.hypot(mx, my);
      const cos = (mx / ml) * a[0] + (my / ml) * a[1];
      const k = 1 / cos; nx = (mx / ml) * k; ny = (my / ml) * k;
    }
    L.push([pts[i][0] + nx * h, pts[i][1] + ny * h]);
    R.push([pts[i][0] - nx * h, pts[i][1] - ny * h]);
  }
  const ring = [...L, ...R.reverse()];
  return 'M' + ring.map(p => `${r(p[0])},${r(p[1])}`).join('L') + 'Z';
}

const items = [];

// jobs: hard hat over a double open-end wrench
const wrenchHead = cx => `M${r(cx - 6.3)},-3H${cx - 2.5}A3,3 0 0 1 ${cx - 2.5},3H${r(cx - 6.3)}A7,7 0 1 0 ${r(cx - 6.3)},-3Z`;
items.push({ id: 'jobs', motif: 'hard hat and wrench', svg: [
  `<g transform="translate(32 53.5) rotate(-7)">`,
  `<rect class="t-b" x="-21" y="-3.2" width="42" height="6.4" rx="3.2"/>`,
  `<path class="t-b" d="${wrenchHead(-24)}"/>`,
  `<path class="t-b" transform="scale(-1 1)" d="${wrenchHead(-24)}"/>`,
  `<rect class="t-c" x="-15" y="-1" width="30" height="2" rx="1"/>`,
  `</g>`,
  `<path class="t-a" d="M10,37C10,17.5 19.5,6 32,6C44.5,6 54,17.5 54,37Z"/>`,
  `<path class="t-b" d="M42.5,8.8C50,13 54,23 54,37H45.5C45.5,25 45,15.5 42.5,8.8Z"/>`,
  `<path class="t-c" d="M16,29C16,20 20,13.5 25.5,10.5C23,15.5 21.5,22 21.5,29Z"/>`,
  `<rect class="t-a" x="26.5" y="5" width="11" height="32" rx="5.5"/>`,
  `<rect class="t-c" x="29.3" y="8" width="3.2" height="24" rx="1.6"/>`,
  `<rect class="t-a" x="3" y="34" width="58" height="9.5" rx="4.75"/>`,
  `<path class="t-b" d="M3.6,40.5C5,42.5 6.5,43.5 8.5,43.5H55.5C57.5,43.5 59,42.5 60.4,40.5Z"/>`,
  `<rect class="t-c" x="8" y="35.6" width="15" height="2.6" rx="1.3"/>`,
].join('') });

// school: backpack with a pencil tucked behind it
items.push({ id: 'school', motif: 'backpack and pencil', svg: [
  `<g transform="rotate(20 47 20)">`,
  `<rect class="t-a" x="43.5" y="8" width="7" height="22"/>`,
  `<path class="t-c" d="M43.5,8.2L47,1L50.5,8.2Z"/>`,
  `<path class="t-b" d="M45.7,4.5L47,1.5L48.3,4.5Z"/>`,
  `<rect class="t-b" x="47" y="8" width="3.5" height="22"/>`,
  `</g>`,
  `<path class="ln" stroke-width="3.5" d="M25,12C25,4.5 37,4.5 37,12"/>`,
  `<rect class="t-b" x="6" y="25" width="9" height="29" rx="4.5"/>`,
  `<rect class="t-b" x="49" y="25" width="9" height="29" rx="4.5"/>`,
  `<rect class="t-a" x="11" y="10" width="42" height="52" rx="13"/>`,
  `<path class="t-b" d="M53,36V49C53,56.2 48.2,62 40,62H24C18,62 13.5,59 12,55C22,57.5 42,55 53,36Z"/>`,
  `<path class="t-c" d="M14.5,36H18.5V50C18.5,51.5 17.5,52 16.5,52C15.5,52 14.5,51.5 14.5,50Z"/>`,
  `<path class="t-b" d="M11,23C11,15.5 17,10 24,10H40C47,10 53,15.5 53,23V30C53,32.5 51,34 48.5,34H15.5C13,34 11,32.5 11,30Z"/>`,
  `<path class="t-a" d="M11,23C11,15.5 17,10 24,10H40C47,10 53,15.5 53,23V27.5C53,30 51,31.5 48.5,31.5H15.5C13,31.5 11,30 11,27.5Z"/>`,
  `<path class="t-c" d="M16,23C16,17.5 19,14.5 24,14H30C24,15 21,18 21,23Z"/>`,
  `<rect class="t-c" x="28" y="27" width="8" height="8.5" rx="2.5"/>`,
  `<rect class="t-b" x="20" y="41" width="24" height="15" rx="5.5"/>`,
  `<rect class="t-a" x="20" y="39.5" width="24" height="14" rx="5.5"/>`,
  `<path class="ln" stroke-width="1.8" d="M23,45.5H41"/>`,
  `<rect class="t-c" x="30.5" y="44" width="3" height="5.5" rx="1.5"/>`,
].join('') });

// body: waving hand, drawn as one outline so faint overlaps don't show
function handPath() {
  const fs_ = [ // base, angle (deg), length to tip centre, radius
    { B: [21.5, 43.5], a: -54, len: 11, r: 4.4 },
    { B: [24, 34], a: -14, len: 17, r: 4 },
    { B: [31, 32], a: -3, len: 20, r: 4 },
    { B: [38, 33], a: 8, len: 18, r: 4 },
    { B: [44, 36.5], a: 21, len: 12.5, r: 3.7 },
  ].map(f => { const t = f.a * Math.PI / 180, d = [Math.sin(t), -Math.cos(t)], n = [-Math.cos(t), -Math.sin(t)];
    const T = [f.B[0] + f.len * d[0], f.B[1] + f.len * d[1]];
    return { ...f, d, n, TL: [T[0] + n[0] * f.r, T[1] + n[1] * f.r], TR: [T[0] - n[0] * f.r, T[1] - n[1] * f.r],
      BL: [f.B[0] + n[0] * f.r, f.B[1] + n[1] * f.r], BR: [f.B[0] - n[0] * f.r, f.B[1] - n[1] * f.r] }; });
  const X = (p1, d1, p2, d2) => { const den = d1[0] * d2[1] - d1[1] * d2[0];
    const t = ((p2[0] - p1[0]) * d2[1] - (p2[1] - p1[1]) * d2[0]) / den; return [p1[0] + t * d1[0], p1[1] + t * d1[1]]; };
  const P = p => `${r(p[0])},${r(p[1])}`;
  let d = `M25,66C23.5,59 20,55 ${P(fs_[0].BL)}`;
  fs_.forEach((f, i) => {
    d += `L${P(f.TL)}A${f.r},${f.r} 0 0 1 ${P(f.TR)}`;
    if (i < fs_.length - 1) { const g = fs_[i + 1]; d += `L${P(X(f.BR, f.d, g.BL, g.d))}`; }
    else d += `L${P(f.BR)}`;
  });
  d += 'C49,46 47,53 43,57L42,66Z';
  return d;
}
items.push({ id: 'body', motif: 'waving hand', svg: [
  `<path class="ln" stroke-width="2.5" d="M8,24C5.5,18.5 6,13 9.5,8.5M14,25.5C12.5,21.5 12.8,18 15,15"/>`,
  `<path class="ln" stroke-width="2.5" d="M56,23C58.5,17.5 58,12 54.5,7.5M50,24.5C51.5,20.5 51.2,17 49,14"/>`,
  `<g transform="rotate(-12 32 46)">`,
  `<path class="t-a" d="${handPath()}"/>`,
  `<path class="t-b" d="M48,41C48,49 46,54 43,57L42.5,60H24.5C24,58.5 23.5,57.5 22.5,56.5C33,56 44,51 48,41Z"/>`,
  `<path class="ln" d="M27,45.5C30,48 35,48 38,45.5"/>`,
  `<rect class="t-c" x="18.5" y="18" width="3" height="10" rx="1.5" transform="rotate(-14 20 23)"/>`,
  `<rect class="t-b" x="21" y="57" width="25" height="9" rx="3"/>`,
  `<rect class="t-c" x="24" y="59" width="9" height="2.2" rx="1.1"/>`,
  `</g>`,
].join('') });

// health: heart with a pulse line knocked through it
const heart = 'M32,58C19,48.5 5,38 5,23.5C5,14 11.5,7 20,7C25.5,7 29.5,10 32,14.5C34.5,10 38.5,7 44,7C52.5,7 59,14 59,23.5C59,38 45,48.5 32,58Z';
const pulse = strokePoly([[1, 33], [16, 33], [21, 24], [27.5, 45], [33.5, 20], [39.5, 38], [43.5, 30], [47, 33], [63, 33]], 1.9);
items.push({ id: 'health', motif: 'heart with a pulse line', svg: [
  `<path class="t-a" fill-rule="evenodd" d="${heart}${pulse}"/>`,
  `<path class="t-b" d="M57.3,37C53,45 42.5,52 32,58C29,55.7 26,53.4 23,51C35,50 50,45 57.3,37Z"/>`,
  `<path class="t-c" d="M11,20C11.5,15 15,12 19.5,12C17,14 15.5,17 15.5,21C14,21.5 12,21.5 11,20Z"/>`,
  `<circle class="t-c" cx="13" cy="25" r="1.8"/>`,
].join('') });

// Path helpers for evenodd knockouts: a feature sits in a hole instead of on top, so the
// faint single-colour tint (where same-colour layers stack) still shows it lighter.
const rr = (x, y, w, h, k) => `M${x + k},${y}H${x + w - k}A${k},${k} 0 0 1 ${x + w},${y + k}V${y + h - k}A${k},${k} 0 0 1 ${x + w - k},${y + h}H${x + k}A${k},${k} 0 0 1 ${x},${y + h - k}V${y + k}A${k},${k} 0 0 1 ${x + k},${y}Z`;
const circ = (cx, cy, k) => `M${cx - k},${cy}A${k},${k} 0 1 0 ${cx + k},${cy}A${k},${k} 0 1 0 ${cx - k},${cy}Z`;

// tech: friendly robot
const smile = 'M26.5,29.5C29.5,32 34.5,32 37.5,29.5C35,33.8 29,33.8 26.5,29.5Z';
items.push({ id: 'tech', motif: 'friendly robot', svg: [
  `<path class="ln" stroke-width="2.5" d="M32,12V7"/>`,
  `<circle class="t-a" cx="32" cy="5.5" r="3.5"/>`,
  `<rect class="t-b" x="6.5" y="19" width="7" height="12" rx="3"/>`,
  `<rect class="t-b" x="50.5" y="19" width="7" height="12" rx="3"/>`,
  `<path class="t-a" fill-rule="evenodd" d="${rr(11, 11, 42, 29, 10)}${rr(17, 16.5, 30, 18, 6.5)}"/>`,
  `<path class="t-b" fill-rule="evenodd" d="${rr(16.5, 16, 31, 19, 7)}${circ(25, 24, 3.8)}${circ(39, 24, 3.8)}${smile}"/>`,
  `<circle class="t-c" cx="25" cy="24" r="3.8"/>`,
  `<circle class="t-c" cx="39" cy="24" r="3.8"/>`,
  `<path class="t-c" d="${smile}"/>`,
  `<rect class="t-c" x="14" y="13.5" width="8" height="2" rx="1"/>`,
  `<rect class="t-b" x="27" y="39" width="10" height="4"/>`,
  `<rect class="t-b" x="7" y="44" width="7" height="15" rx="3.5" transform="rotate(12 10.5 45)"/>`,
  `<rect class="t-b" x="50" y="44" width="7" height="15" rx="3.5" transform="rotate(-12 53.5 45)"/>`,
  `<path class="t-a" fill-rule="evenodd" d="${rr(14, 42, 36, 21, 7)}${rr(21, 47, 11, 8, 2.5)}${circ(45, 49, 2.4)}"/>`,
  `<path class="t-b" d="M50,50V56C50,60 47,63 43,63H21C17,63 14.8,61 14.2,58.5C24,59.5 40,58 50,50Z"/>`,
  `<rect class="t-c" x="21" y="47" width="11" height="8" rx="2.5"/>`,
  `<circle class="t-b" cx="39" cy="49" r="2.4"/>`,
  `<circle class="t-c" cx="45" cy="49" r="2.4"/>`,
].join('') });

// vehicles: bubbly cartoon car with wheel arches and knocked-out windows
const backWin = 'M25.5,31C28,24 31,19.5 36.5,19.5H37.5V31Z', frontWin = 'M41,19.5H42C46,19.5 48.5,23 50.5,31H41Z';
const wheel = cx => `<path class="t-b" fill-rule="evenodd" d="${circ(cx, 50, 8.5)}${circ(cx, 50, 4)}"/><circle class="t-a" cx="${cx}" cy="50" r="4"/><circle class="t-c" cx="${cx}" cy="50" r="1.6"/>`;
items.push({ id: 'vehicles', motif: 'cartoon car', svg: [
  `<path class="ln" stroke-width="2.5" d="M2,36H8M3,42H7"/>`,
  `<ellipse class="t-b" cx="35" cy="60.5" rx="26" ry="2"/>`,
  `<path class="t-a" fill-rule="evenodd" d="M8,43C8,37.5 11,34.5 16,33.5L21,32.5C24,22.5 29,15 37,15H42C48,15 52,20 55,30.5L58,31.2C61.5,32 63,35.5 63,40V45C63,48 62,50 60,50A10,10 0 0 0 40,50H31A10,10 0 0 0 11,50C9,50 8,48.5 8,46Z${backWin}${frontWin}"/>`,
  `<path class="t-c" d="${backWin}"/>`,
  `<path class="t-c" d="${frontWin}"/>`,
  `<path class="t-c" d="M12,38C13,36 15,35 18,35H24V37.5H17C15,37.5 13.5,38 12,38Z"/>`,
  `<path class="t-b" d="M8,44H13A10,10 0 0 0 11,50C9,50 8,48.5 8,46ZM29,44H42A10,10 0 0 0 40,50H31A10,10 0 0 0 29,44ZM58,44H63V45C63,48 62,50 60,50A10,10 0 0 0 58,44Z"/>`,
  `<rect class="t-b" x="41" y="35.5" width="5" height="2" rx="1"/>`,
  `<ellipse class="t-c" cx="60" cy="37.5" rx="2" ry="2.5"/>`,
  `<rect class="t-b" x="6.5" y="36" width="3" height="4.5" rx="1.5"/>`,
  wheel(21), wheel(50),
].join('') });

fs.writeFileSync(new URL('./group3.json', import.meta.url), JSON.stringify(items, null, 1));
console.log('wrote', items.length);
