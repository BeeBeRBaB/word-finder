// Heart monitor: patient-monitor traces, heartbeat, pulse and breathing, drawn by a moving pen with
// the older trace fading behind it. The seed picks the variant: a bedside monitor, three channels
// swept left to right over the last sweep with heart rate, oxygen and breathing readouts beside
// them; a paper rhythm strip, several leads inked by a fixed pen on gridded paper that feeds away
// to the left; or a ward's wall of small monitors, each patient's heartbeat on its own rate.

import { stage, TAU, clamp } from './stage.js';
import { roundRect } from './shapes.js';

const BANDS = 6;   // alpha steps along a trace's tail, each one stroked path

/** @typedef {{bpm:number, base:number, beat:number, breath:number, rr:number, spo2:number, shown:number,
 *   shownRr:number, last:number, kick:number, drift:number}} Patient
 * beat, breath: phases 0..1 of the current heartbeat and breath; shown: the rate on the readout,
 * updated every few seconds; kick: the heart symbol's swell after each beat.
 * @typedef {{p:Patient, wave:number, lead:number, color:string, x:number, y:number, w:number, h:number,
 *   n:number, buf:Float32Array, head:number, label:string, value:() => string, unit:string}} Trace
 * wave: 0 heartbeat, 1 pulse, 2 breathing; lead varies the heartbeat's shape; buf, one sample per
 * column (-1..1, up positive); head, the column the pen writes next. */

/** @param {HTMLElement} host @param {import('./stage.js').StageOptions} opts @returns {() => void} */
export function start(host, opts) {
  return stage(host, opts, (s) => {
    const { rng, layout } = s;
    const rgb = s.colors.map(rgbOf);
    // Monitor colours where the look has them: green beat, cyan pulse, amber breath, each its own.
    const iEcg = nearestHue(rgb, 130, []), iPleth = nearestHue(rgb, 195, [iEcg]), iResp = nearestHue(rgb, 50, [iEcg, iPleth]);
    const cEcg = s.colors[iEcg], cPleth = s.colors[iPleth], cResp = s.colors[iResp];
    const font = (/** @type {number} */ px) => `600 ${Math.round(px)}px 'Space Grotesk',system-ui,sans-serif`;
    /** @type {Patient[]} */
    let patients = [];
    /** @type {Trace[]} */
    let traces = [];
    let m = 1, colW = 2, speed = 100, panels = 0, cols = 1, scroll = 0, pen = 0, sq = 8, acc = 0;
    // Readout panels (bedside) or monitor frames (ward), as x, y, w, h.
    /** @type {number[][]} */
    let boxes = [];

    /** A patient, heart rate about bpm. @param {number} bpm @returns {Patient} */
    function patient(bpm) {
      return { bpm, base: bpm, beat: rng.random(), breath: rng.random(), rr: 12 + rng.int(7), spo2: 96 + rng.int(4),
        shown: bpm, shownRr: 14, last: 0, kick: 0, drift: rng.random() * TAU };
    }

    /** A trace over a box. @param {Patient} p @param {number} wave @param {string} color @param {number} x
     * @param {number} y @param {number} w @param {number} h @param {string} label @param {() => string} value
     * @param {string} unit @returns {Trace} */
    function trace(p, wave, color, x, y, w, h, label, value, unit) {
      const n = Math.max(8, Math.floor(w / colW));
      return { p, wave, lead: rng.int(3), color, x, y, w, h, n, buf: new Float32Array(n), head: 0, label, value, unit };
    }

    /** The wave's height now, -1..1. @param {Trace} t @returns {number} */
    function sample(t) {
      const { p } = t;
      if (t.wave === 2) return Math.sin(p.breath * TAU) * 0.8;
      if (t.wave === 1) {
        // Pulse: a quick rise a little after the beat, a slow fall with a small notch.
        const f = (p.beat + 0.6) % 1;
        return (gauss(f, 0.2, 0.08) + 0.38 * gauss(f, 0.46, 0.09)) * 1.5 - 0.75;
      }
      const f = p.beat;
      // Heartbeat: P wave, the sharp QRS spike, then the T wave; leads differ in size and sign.
      const sgn = t.lead === 1 ? -0.7 : 1, tw = t.lead === 2 ? 0.45 : 0.28;
      return 0.12 * gauss(f, 0.16, 0.022) - 0.1 * gauss(f, 0.345, 0.007) + sgn * 0.95 * gauss(f, 0.37, 0.009)
        - 0.22 * gauss(f, 0.393, 0.009) + tw * gauss(f, 0.6, 0.04) - 0.2;
    }

    /** Advances the patients by dt seconds. @param {number} dt @returns {void} */
    function live(dt) {
      for (const p of patients) {
        p.drift += dt * 0.05;
        p.bpm = p.base + 4 * Math.sin(p.drift) + 2 * Math.sin(p.drift * 2.7);
        const before = p.beat;
        p.beat = (p.beat + dt * p.bpm / 60) % 1;
        if (before < 0.37 && p.beat >= 0.37) p.kick = 1;
        p.kick = Math.max(0, p.kick - dt * 2.2);
        p.breath = (p.breath + dt * p.rr / 60) % 1;
        p.last += dt;
        if (p.last > 3) { p.last = 0; p.shown = Math.round(p.bpm); if (rng.random() < 0.15) p.spo2 = clamp(p.spo2 + (rng.random() < 0.5 ? -1 : 1), 95, 100); }
      }
    }

    /** Lays the screen out. @returns {void} */
    function build() {
      m = Math.min(s.W, s.H);
      colW = clamp(m / 400, 1.5, 3);
      speed = clamp(s.W / 7, 60, 200);
      const pad = clamp(m * 0.04, 12, 40);
      traces = []; boxes = [];
      if (layout === 0) {
        if (!patients.length) patients = [patient(62 + rng.int(22))];
        const p = patients[0];
        const side = s.W > 640;
        const nw = side ? clamp(s.W * 0.17, 110, 230) : 0;
        const tw = s.W - pad * 2 - nw - (side ? pad : 0);
        const rowH = (s.H - pad * 2) / 3;
        const specs = /** @type {[number, string, string, () => string, string][]} */ ([
          [0, cEcg, 'HR', () => String(p.shown), 'bpm'], [1, cPleth, 'SpO2', () => String(p.spo2), '%'], [2, cResp, 'RESP', () => String(p.rr), 'rpm']]);
        specs.forEach(([wave, c, label, value, unit], i) => {
          traces.push(trace(p, wave, c, pad, pad + rowH * i + rowH * 0.12, tw, rowH * 0.76, label, value, unit));
          boxes.push(side ? [s.W - pad - nw, pad + rowH * i, nw, rowH] : [pad, pad + rowH * i, tw, rowH]);
        });
      } else if (layout === 1) {
        const rows = clamp(Math.round((s.H - pad) / clamp(m * 0.3, 110, 220)), 3, 6);
        if (!patients.length) patients = [patient(58 + rng.int(30))];
        pen = s.W * 0.82;
        sq = clamp(m * 0.012, 5, 10);
        const rowH = (s.H - pad * 2) / rows;
        for (let i = 0; i < rows; i++) {
          const t = trace(patients[0], 0, cEcg, 0, pad + rowH * i + rowH * 0.1, pen, rowH * 0.8, '', () => '', '');
          t.lead = i % 3;
          traces.push(t);
        }
      } else {
        cols = s.W > 1000 ? 3 : s.W > 560 ? 2 : 1;
        const want = clamp(Math.round(s.H / clamp(m * 0.32, 120, 260)), 2, 5);
        panels = cols * want;
        while (patients.length < panels) patients.push(patient(56 + rng.int(42)));
        const gap = pad * 0.6, bw = (s.W - pad * 2 - gap * (cols - 1)) / cols, bh = (s.H - pad * 2 - gap * (want - 1)) / want;
        for (let i = 0; i < panels; i++) {
          const x = pad + (i % cols) * (bw + gap), y = pad + Math.floor(i / cols) * (bh + gap);
          const p = patients[i];
          boxes.push([x, y, bw, bh]);
          const t = trace(p, 0, s.colors[i % s.colors.length], x + bw * 0.05, y + bh * 0.32, bw * 0.9, bh * 0.56, `BED ${i + 1}`, () => String(p.shown), '');
          traces.push(t);
        }
      }
    }

    /** Writes the columns the pens have reached by now. @param {number} dt @returns {void} */
    function write(dt) {
      const per = colW / speed;
      acc += dt / per;
      let k = Math.floor(acc);
      acc -= k;
      // Step the patients column by column so the waves are sampled at the pen's pace.
      for (; k > 0; k--) {
        live(per);
        for (const t of traces) { t.buf[t.head] = sample(t); t.head = (t.head + 1) % t.n; }
        scroll += colW;
      }
    }

    /** Fills every trace's history, as if it had been running. @returns {void} */
    function warm() {
      const most = traces.reduce((a, t) => Math.max(a, t.n), 0);
      const lead = Math.floor(most * 0.6);
      for (let i = 0; i < most + lead; i++) {
        live(colW / speed);
        for (const t of traces) { t.buf[t.head] = sample(t); t.head = (t.head + 1) % t.n; }
      }
    }

    /** Strokes trace t, newest bright, fading back to the oldest. @param {CanvasRenderingContext2D} ctx
     * @param {Trace} t */
    function stroke(ctx, t) {
      const gap = layout === 1 ? 0 : Math.max(3, Math.round(t.n * 0.03));
      const len = t.n - gap, mid = t.y + t.h / 2, amp = t.h / 2;
      const band = Math.ceil(len / BANDS);
      ctx.strokeStyle = t.color;
      ctx.lineWidth = clamp(m / 420, 1.4, 2.2);
      for (let b = 0; b < BANDS; b++) {
        const a0 = b * band, a1 = Math.min(len - 1, (b + 1) * band);
        if (a0 >= a1) break;
        ctx.beginPath();
        for (let age = a0; age <= a1; age++) {
          const i = (t.head - 1 - age + t.n * 2) % t.n;
          // The sweep draws in place, so it wraps; the strip scrolls, so age is distance from the pen.
          const x = layout === 1 ? pen - age * colW : t.x + i * colW;
          const y = mid - t.buf[i] * amp;
          if (age === a0 || (layout !== 1 && i === t.n - 1)) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        const f = b / BANDS;
        ctx.globalAlpha = s.dark ? 0.62 * (1 - f * 0.85) : 0.85 * (1 - f * 0.75);
        ctx.stroke();
      }
    }

    /** The pen's bright point. @param {CanvasRenderingContext2D} ctx @param {Trace} t */
    function tip(ctx, t) {
      const i = (t.head - 1 + t.n) % t.n;
      const x = layout === 1 ? pen : t.x + i * colW, y = t.y + t.h / 2 - t.buf[i] * t.h / 2;
      ctx.globalAlpha = s.dark ? 0.22 : 0.16;
      ctx.fillStyle = t.color;
      ctx.beginPath(); ctx.arc(x, y, clamp(m / 120, 4, 8), 0, TAU); ctx.fill();
      ctx.globalAlpha = 0.75;
      ctx.beginPath(); ctx.arc(x, y, clamp(m / 400, 1.6, 2.8), 0, TAU); ctx.fill();
    }

    /** A small heart, swollen by k. @param {CanvasRenderingContext2D} ctx @param {number} x @param {number} y
     * @param {number} r @param {number} k */
    function heart(ctx, x, y, r, k) {
      const z = r * (1 + 0.14 * k);
      ctx.beginPath();
      ctx.moveTo(x, y + z * 0.9);
      ctx.bezierCurveTo(x - z * 1.3, y + z * 0.1, x - z * 0.9, y - z * 0.95, x, y - z * 0.35);
      ctx.bezierCurveTo(x + z * 0.9, y - z * 0.95, x + z * 1.3, y + z * 0.1, x, y + z * 0.9);
      ctx.fill();
    }

    return {
      lay() {
        // A new size means new columns, so the history is run in again to fill them.
        build();
        warm();
      },
      step(dt) { write(dt); },
      draw() {
        const { ctx } = s;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        if (layout === 1) {
          // Paper: fine squares and heavier ones every fifth, feeding left with the trace.
          const off = scroll % (sq * 5);
          ctx.strokeStyle = cEcg;
          for (const heavy of [false, true]) {
            const step = heavy ? sq * 5 : sq;
            ctx.globalAlpha = heavy ? (s.dark ? 0.12 : 0.16) : (s.dark ? 0.05 : 0.07);
            ctx.lineWidth = heavy ? 1.2 : 1;
            ctx.beginPath();
            for (let x = -off % step; x < s.W; x += step) { ctx.moveTo(Math.round(x) + 0.5, 0); ctx.lineTo(Math.round(x) + 0.5, s.H); }
            for (let y = 0; y < s.H; y += step) { ctx.moveTo(0, Math.round(y) + 0.5); ctx.lineTo(s.W, Math.round(y) + 0.5); }
            ctx.stroke();
          }
          // The pen bar the paper passes under.
          ctx.globalAlpha = s.dark ? 0.25 : 0.3;
          ctx.strokeStyle = s.ink;
          ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.moveTo(pen + 6, 0); ctx.lineTo(pen + 6, s.H); ctx.stroke();
        }
        for (const t of traces) stroke(ctx, t);
        for (const t of traces) tip(ctx, t);
        if (layout === 1) return;
        ctx.textBaseline = 'top';
        if (layout === 0) {
          boxes.forEach(([x, y, w, h], i) => {
            const t = traces[i];
            ctx.globalAlpha = s.dark ? 0.12 : 0.15;
            ctx.strokeStyle = s.ink;
            ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(x, y + h - 0.5); ctx.lineTo(x + w, y + h - 0.5); ctx.stroke();
            const big = clamp(Math.min(h * 0.38, w * 0.4), 18, 64);
            ctx.fillStyle = t.color;
            ctx.textAlign = 'left';
            ctx.globalAlpha = s.dark ? 0.5 : 0.6;
            ctx.font = font(big * 0.3);
            const right = x + w;
            ctx.fillText(t.label, x + 4, y + h * 0.12);
            ctx.textAlign = 'right';
            ctx.fillText(t.unit, right - 4, y + h * 0.12);
            ctx.globalAlpha = s.dark ? 0.62 : 0.7;
            ctx.font = font(big);
            ctx.fillText(t.value(), right - 4, y + h * 0.12 + big * 0.45);
            if (t.wave === 0) {
              ctx.globalAlpha = (s.dark ? 0.45 : 0.55) + 0.2 * t.p.kick;
              heart(ctx, x + 4 + big * 0.22, y + h * 0.12 + big * 0.95, big * 0.17, t.p.kick);
            }
          });
        } else {
          boxes.forEach(([x, y, w, h], i) => {
            const t = traces[i];
            ctx.globalAlpha = s.dark ? 0.18 : 0.22;
            ctx.strokeStyle = s.ink;
            ctx.lineWidth = 1;
            ctx.beginPath(); roundRect(ctx, x + 0.5, y + 0.5, w - 1, h - 1, clamp(m * 0.015, 4, 10)); ctx.stroke();
            const big = clamp(h * 0.22, 14, 40);
            ctx.fillStyle = t.color;
            ctx.globalAlpha = s.dark ? 0.45 : 0.55;
            ctx.textAlign = 'left';
            ctx.font = font(big * 0.42);
            ctx.fillText(t.label, x + w * 0.05, y + h * 0.08);
            ctx.textAlign = 'right';
            ctx.globalAlpha = s.dark ? 0.6 : 0.68;
            ctx.font = font(big);
            ctx.fillText(t.value(), x + w * 0.95, y + h * 0.06);
            ctx.globalAlpha = (s.dark ? 0.42 : 0.5) + 0.2 * t.p.kick;
            heart(ctx, x + w * 0.95 - ctx.measureText(t.value()).width - big * 0.4, y + h * 0.06 + big * 0.5, big * 0.2, t.p.kick);
          });
        }
      },
    };
  });
}

/** @param {number} x @param {number} c @param {number} w @returns {number} */
const gauss = (x, c, w) => Math.exp(-0.5 * ((x - c) / w) ** 2);

/** Which colour's hue is nearest `deg`, other than those taken while others remain.
 * @param {number[][]} cs @param {number} deg @param {number[]} taken @returns {number} */
function nearestHue(cs, deg, taken) {
  let best = taken.length < cs.length ? cs.findIndex((_, i) => !taken.includes(i)) : 0, bd = Infinity;
  cs.forEach((c, i) => {
    if (taken.includes(i) && taken.length < cs.length) return;
    const [r, g, b] = c.map((v) => v / 255), mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
    if (d < 0.05) return;
    let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h = (h * 60 + 360) % 360;
    const dist = Math.min(Math.abs(h - deg), 360 - Math.abs(h - deg));
    if (dist < bd) { bd = dist; best = i; }
  });
  return best;
}

/** A colour string's channels. @param {string} color @returns {number[]} */
function rgbOf(color) {
  const g = document.createElement('canvas').getContext('2d');
  if (!g) return [128, 128, 128];
  g.fillStyle = '#888';
  g.fillStyle = color;
  const v = String(g.fillStyle);
  if (v[0] === '#') { const n = parseInt(v.slice(1, 7), 16); return [n >> 16, (n >> 8) & 255, n & 255]; }
  const mm = v.match(/[\d.]+/g);
  return mm ? [Number(mm[0]), Number(mm[1]), Number(mm[2])] : [128, 128, 128];
}
