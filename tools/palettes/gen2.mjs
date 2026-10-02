// Bold-duotone generator for set2.json. Colours are specified in OKLCH; text-bearing
// tokens are fitted by binary search to clear WCAG targets with a small margin.
import fs from 'node:fs';

// ---------- colour maths ----------
const toLin = v => { v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; };
const fromLin = v => 255 * (v <= .0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - .055);
function oklchToLinRgb(L, C, h) {
  const a = C * Math.cos(h * Math.PI / 180), b = C * Math.sin(h * Math.PI / 180);
  const l_ = L + .3963377774 * a + .2158037573 * b, m_ = L - .1055613458 * a - .0638541728 * b, s_ = L - .0894841775 * a - 1.2914855480 * b;
  const l = l_ ** 3, m = m_ ** 3, s = s_ ** 3;
  return [4.0767416621 * l - 3.3077115913 * m + .2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - .3413193965 * s, -.0041960863 * l - .7034186147 * m + 1.7076147010 * s];
}
const inGamut = rgb => rgb.every(v => v >= -1e-4 && v <= 1 + 1e-4);
// Gamut-map by reducing chroma at fixed L and h.
function oklch(L, C, h) {
  let lo = 0, hi = C, rgb = oklchToLinRgb(L, C, h);
  if (!inGamut(rgb)) { for (let i = 0; i < 30; i++) { const mid = (lo + hi) / 2; inGamut(oklchToLinRgb(L, mid, h)) ? lo = mid : hi = mid; } rgb = oklchToLinRgb(L, lo, h); }
  return rgb.map(v => Math.round(Math.min(255, Math.max(0, fromLin(Math.min(1, Math.max(0, v)))))));
}
const hex = rgb => '#' + rgb.map(v => v.toString(16).padStart(2, '0')).join('');
const H = (L, C, h) => hex(oklch(L, C, h));
const parse = c => c.startsWith('#') ? [...[1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16)), 1] : c.match(/[\d.]+/g).map(Number);
const over = (fg, bg) => { const [r, g, b, a] = parse(fg), B = parse(bg); return [r * a + B[0] * (1 - a), g * a + B[1] * (1 - a), b * a + B[2] * (1 - a), 1]; };
const lum = ([r, g, b]) => .2126 * toLin(r) + .7152 * toLin(g) + .0722 * toLin(b);
const cr = (a, b) => { const x = lum(typeof a === 'string' ? parse(a) : a), y = lum(typeof b === 'string' ? parse(b) : b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
const rgba = (c, a) => { const [r, g, b] = parse(c); return `rgba(${r},${g},${b},${a})`; };

// Fit lightness: 'dark' = the lightest L that still clears target against all refs
// (text on a light ground); 'light' = the darkest L that clears (text on a dark ground).
function fitL(C, h, refs, target, dir) {
  const ok = L => refs.every(r => cr(H(L, C, h), r) >= target);
  let lo = 0, hi = 1;
  for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; if (dir === 'dark') ok(mid) ? lo = mid : hi = mid; else ok(mid) ? hi = mid : lo = mid; }
  return H(dir === 'dark' ? lo : hi, C, h);
}
// Fit an alpha for `c` composited over `ground` so it clears target.
function fitAlpha(c, ground, target) { for (let a = .40; a <= 1.001; a += .02) if (cr(over(rgba(c, +a.toFixed(2)), ground), ground) >= target) return rgba(c, +a.toFixed(2)); return c; }

const T = 4.65, EDGE = 3.2; // margins over 4.5 / 3

// ---------- theme specs ----------
// g: ground hue/chroma; a: accent hue/chroma; lab: label hue/chroma; pills: hues.
// Light ground at OKLCH L~.80-.88 (mid-tone), dark ground at L~.26-.30 (dusky).
const specs = {
  phosphor: { // warm amber ground, deep-teal accent (amber CRT on a teal-glass bench)
    light: { g: [.80, .08, 52], surf: [.975, .022, 65], border: [.62, .09, 55], a: [195, .11], lab: [48, .13], pills: [[80, .15], [190, .11], [20, .13], [300, .11]], pillL: .83 },
    dark: { g: [.27, .055, 50], surf: [.325, .05, 52], border: [.44, .07, 52], a: [192, .12], lab: [68, .14], pills: [[75, .15], [185, .12], [22, .15], [305, .13]], pillL: .80, pillSolid: true },
  },
  broadsheet: { // highlighter yellow newsprint + ink navy, roles swap in the dark
    light: { g: [.90, .11, 104], surf: [.985, .012, 100], border: 'ink', a: [268, .09], aDark: true, lab: [28, .17], pills: [[100, .17], [225, .12], [350, .14], [140, .15]], pillL: .86 },
    dark: { g: [.27, .045, 268], surf: [.32, .045, 268], border: [.90, .03, 95], a: [104, .17], aL: .92, lab: [30, .15], pills: [[102, .17], [225, .12], [352, .14], [140, .15]], pillL: .86, pillSolid: true },
  },
  sticker: { // mint ground, grape-violet accent, candy pills, ink outline
    light: { g: [.86, .08, 170], surf: [.99, .012, 170], border: [.22, .09, 292], a: [295, .19], lab: [295, .17], pills: [[75, .15], [350, .13], [240, .12], [130, .15]], pillL: .84 },
    dark: { g: [.31, .05, 192], surf: [.36, .05, 192], border: [.12, .04, 292], a: [298, .15], lab: [160, .12], pills: [[75, .16], [350, .15], [290, .13], [155, .14]], pillL: .80, pillSolid: true },
  },
  drafting: { // blueprint cyan-blue ground, red-pencil orange accent
    light: { g: [.80, .065, 235], surf: [.975, .012, 230], border: [.58, .08, 240], a: [40, .17], lab: [245, .12], pills: [[75, .14], [210, .10], [30, .13], [130, .13]], pillL: .85 },
    dark: { g: [.30, .085, 250], surf: [.355, .085, 250], border: [.50, .09, 245], a: [50, .15], lab: [220, .11], pills: [[75, .16], [210, .13], [30, .17], [130, .16]], pillL: .72, pillSolid: false },
  },
  grove: { // sage ground, terracotta accent
    light: { g: [.80, .065, 130], surf: [.975, .016, 115], border: [.60, .07, 135], a: [40, .14], lab: [145, .09], pills: [[130, .12], [85, .13], [45, .12], [180, .09]], pillL: .85 },
    dark: { g: [.28, .05, 150], surf: [.335, .05, 148], border: [.46, .06, 148], a: [42, .14], lab: [135, .11], pills: [[132, .13], [88, .14], [40, .14], [185, .10]], pillL: .80, pillSolid: true },
  },
  plum: { // dusk-mauve ground, coral-sunset accent
    light: { g: [.78, .075, 330], surf: [.978, .018, 340], border: [.58, .09, 330], a: [18, .17], lab: [320, .14], pills: [[25, .13], [345, .12], [295, .11], [80, .12]], pillL: .85 },
    dark: { g: [.28, .07, 320], surf: [.335, .07, 322], border: [.46, .08, 322], a: [30, .15], lab: [345, .11], pills: [[35, .16], [355, .17], [300, .15], [85, .15]], pillL: .72, pillSolid: false },
  },
  graphite: { // cool steel ground, one electric-vermilion accent
    light: { g: [.80, .012, 250], surf: [.965, .004, 250], border: [.58, .012, 250], a: [35, .21], lab: [250, .015], pills: [[120, .19], [60, .15], [255, .13], [25, .16]], pillL: .86, neutral: true },
    dark: { g: [.27, .012, 260], surf: [.32, .012, 260], border: [.45, .012, 260], a: [38, .20], lab: [250, .015], pills: [[120, .19], [65, .16], [255, .14], [25, .17]], pillL: .80, pillSolid: true, neutral: true },
  },
};

function build(name, mode, s) {
  const [gL, gC, gh] = s.g, bg = H(gL, gC, gh), surface = H(...s.surf);
  const tc = s.neutral ? .008 : .035;
  const p = { bg, surface };
  if (mode === 'light') {
    const ink = H(.22, .06, 268);
    p.border = s.border === 'ink' ? ink : H(...s.border);
    p.text = H(.25, tc, gh); p.strong = H(.17, tc, gh);
    p.muted = fitL(tc * 1.4, gh, [bg, surface], T, 'dark');
    p.hint = fitL(tc, gh, [bg], T + .1, 'dark');
    p.label = fitL(s.lab[1], s.lab[0], [bg], T, 'dark');
    const [ah, ac] = s.a;
    p.accentInk = H(.99, .01, ah);
    p.accent = s.aDark ? H(.26, ac, ah) : fitL(ac, ah, [p.accentInk], T, 'dark');
    p.accentText = fitL(ac, ah, [bg, surface], T, 'dark');
    p.pills = s.pills.map(([h, c]) => H(s.pillL, c, h));
    p.foundText = H(.18, tc, gh);
    p.sel = rgba(p.accent, .24);
    p.done = fitAlpha(p.text, bg, T);
  } else {
    p.border = H(...s.border);
    p.text = H(.93, tc * .6, gh); p.strong = H(.985, tc * .3, gh);
    p.muted = fitL(tc * 1.6, gh, [bg, surface], T, 'light');
    p.hint = fitL(tc * 1.2, gh, [bg], T + .1, 'light');
    p.label = cr(H(.82, s.lab[1], s.lab[0]), bg) >= T ? H(.82, s.lab[1], s.lab[0]) : fitL(s.lab[1], s.lab[0], [bg], T, 'light');
    const [ah, ac] = s.a;
    p.accentInk = H(.20, s.neutral ? .01 : .05, gh);
    p.accent = H(s.aL ?? .78, ac, ah);
    if (cr(p.accent, surface) < EDGE || cr(p.accentInk, p.accent) < T) throw new Error(`${name}/dark accent ${p.accent} fails`);
    p.accentText = [bg, surface].every(r => cr(p.accent, r) >= T + .3) ? p.accent : fitL(ac, ah, [bg, surface], T + .3, 'light');
    if (s.pillSolid) { p.pills = s.pills.map(([h, c]) => H(s.pillL, c, h)); p.foundText = H(.18, s.neutral ? .01 : .05, gh); }
    else {
      p.foundText = H(.985, .01, gh);
      p.pills = s.pills.map(([h, c]) => { const base = H(s.pillL, c, h); for (let a = .80; a > .2; a -= .02) { const v = rgba(base, +a.toFixed(2)); if (cr(p.foundText, over(v, surface)) >= T) return v; } return rgba(base, .3); });
    }
    p.sel = rgba(p.accent, .26);
    p.done = fitAlpha(p.text, bg, T);
  }
  // key order to match current.json
  const order = ['bg', 'surface', 'border', 'text', 'strong', 'muted', 'label', 'hint', 'accent', 'accentText', 'accentInk', 'pills', 'sel', 'foundText', 'done'];
  return Object.fromEntries(order.map(k => [k, p[k]]));
}

const out = {};
for (const [name, modes] of Object.entries(specs)) out[name] = { dark: build(name, 'dark', modes.dark), light: build(name, 'light', modes.light) };
fs.writeFileSync(new URL('./set2.json', import.meta.url), JSON.stringify(out, null, 1) + '\n');
// quick report
for (const [n, m] of Object.entries(out)) for (const mode of ['light', 'dark']) {
  const p = m[mode];
  console.log(`${n.padEnd(10)} ${mode.padEnd(5)} bg ${p.bg} surf ${p.surface} acc ${p.accent} ink ${p.accentInk} pills ${p.pills.join(' ')} edge ${cr(p.accent, p.surface).toFixed(2)} pill-min ${Math.min(...p.pills.map(c => cr(p.foundText, over(c, p.surface)))).toFixed(2)}`);
}
