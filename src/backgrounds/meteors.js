// Meteors: a night sky of slowly twinkling stars, crossed now and then by a long, slow shooting
// star whose tail grows behind it and fades out with it. The seed picks the variant: sporadic
// meteors from anywhere, slanting down either way; a shower, every streak flying out from one
// radiant point above the page; or a sky turning slowly round its pole star, with rare large
// fireballs that leave a glowing train hanging behind them for a few seconds.

import { stage, TAU, clamp } from './stage.js';

/** @typedef {{x:number, y:number, dx:number, dy:number, v:number, len:number, w:number, age:number, life:number, c:number, train:number}} Meteor
 * Start x, y and unit heading dx, dy (CSS px); speed v px/s, tail length len, width w; age and
 * life in seconds; colour c; train: seconds its train lingers after it burns out (0: none). */

const LEVELS = 6;       // twinkle brightness steps, one fill each

/** @param {HTMLElement} host @param {import('./stage.js').StageOptions} opts @returns {() => void} */
export function start(host, opts) {
  return stage(host, opts, (s) => {
    const { rng, layout } = s;
    const nc = s.colors.length;
    const tails = s.colors.map((c) => tail(c));
    const glows = s.colors.map((c) => glow(c));
    const starGlow = glow(s.ink);
    /** @type {Meteor[]} */
    const meteors = [];
    // Stars: position (fractions of the page, or of the pole's reach for the turning sky),
    // size, brightness, twinkle rate and phase, colour (nc for ink).
    let n = 0;
    let sx = new Float32Array(0), sy = new Float32Array(0), sz = new Float32Array(0), sb = new Float32Array(0);
    let sf = new Float32Array(0), sp = new Float32Array(0), sc = new Uint8Array(0);
    // This frame's place on the page and fill (colour * LEVELS + step, -1 off the page).
    let qx = new Float32Array(0), qy = new Float32Array(0), key = new Int16Array(0);
    let wait = 0.4;
    const radiant = { x: rng.random() < 0.5 ? 0.15 : 0.85, y: -0.15 };

    /** The turning sky's pole, and how far its stars reach. @returns {[number, number, number]} */
    const pole = () => {
      const px = s.W * 0.5, py = s.H * 0.1;
      return [px, py, Math.hypot(s.W / 2, s.H * 0.9) + 10];
    };

    /** @returns {Meteor} */
    function meteor() {
      const m0 = Math.min(s.W, s.H);
      const big = layout === 2, shower = layout === 1;
      const v = clamp(m0 * (big ? 0.32 : 0.42), 150, big ? 300 : 380) * (0.85 + rng.random() * 0.3);
      let x, y, a;
      if (shower) {
        // Away from the radiant, starting some way out from it.
        const rx = radiant.x * s.W, ry = radiant.y * s.H;
        x = rng.random() * s.W; y = rng.random() * s.H * 0.6;
        a = Math.atan2(y - ry, x - rx);
      } else {
        const side = rng.random() < 0.5 ? -1 : 1;
        a = side < 0 ? Math.PI - (0.3 + rng.random() * 0.5) : 0.3 + rng.random() * 0.5;
        x = s.W * (side < 0 ? 0.35 + rng.random() * 0.65 : rng.random() * 0.65);
        y = s.H * rng.random() * 0.45;
      }
      const life = big ? 3.6 + rng.random() * 1.2 : shower ? 1.8 + rng.random() * 0.8 : 2.4 + rng.random();
      return { x, y, dx: Math.cos(a), dy: Math.sin(a), v, len: v * (big ? 1.1 : shower ? 0.6 : 0.9),
        w: clamp(m0 * (big ? 0.018 : 0.012), big ? 8 : 5, big ? 18 : 12) * (shower ? 0.8 : 1),
        age: 0, life, c: rng.int(nc), train: big ? 4 : 0 };
    }

    return {
      lay() {
        const count = layout === 2
          ? clamp(Math.round(Math.PI * pole()[2] ** 2 / 3200), 200, 1600)
          : clamp(Math.round(s.W * s.H / 2600), 120, 700);
        if (count !== n) {
          n = count;
          sx = new Float32Array(n); sy = new Float32Array(n); sz = new Float32Array(n); sb = new Float32Array(n);
          sf = new Float32Array(n); sp = new Float32Array(n); sc = new Uint8Array(n);
          qx = new Float32Array(n); qy = new Float32Array(n); key = new Int16Array(n);
          for (let i = 0; i < n; i++) {
            if (layout === 2) { sx[i] = Math.sqrt(rng.random()); sy[i] = rng.random() * TAU; }
            else { sx[i] = rng.random(); sy[i] = rng.random(); }
            const r = rng.random();
            sz[i] = 1 + r * r * 1.8;
            sb[i] = 0.35 + rng.random() * 0.65;
            sf[i] = 0.08 + rng.random() * 0.22;
            sp[i] = rng.random() * TAU;
            sc[i] = rng.random() < 0.7 ? nc : rng.int(nc);
          }
        }
        // A meteor already on its way, so the still picture has one.
        if (!meteors.length) {
          const m = meteor();
          m.age = m.life * 0.5;
          meteors.push(m);
        }
      },
      step(dt) {
        for (const m of meteors) m.age += dt;
        for (let i = meteors.length - 1; i >= 0; i--) {
          if (meteors[i].age > meteors[i].life + meteors[i].train) meteors.splice(i, 1);
        }
        wait -= dt;
        if (wait <= 0 && meteors.length < 4) {
          meteors.push(meteor());
          wait = layout === 1 ? 0.5 + rng.random() * 0.8 : layout === 2 ? 4 + rng.random() * 3 : 1.2 + rng.random() * 1.6;
        }
      },
      draw() {
        const { ctx } = s;
        const [px, py, reach] = pole();
        const turn = s.t * 0.012;
        // Where each star is and how bright, then one fill per colour and brightness step.
        for (let i = 0; i < n; i++) {
          if (layout === 2) {
            const a = sy[i] + turn;
            qx[i] = px + Math.cos(a) * sx[i] * reach; qy[i] = py + Math.sin(a) * sx[i] * reach;
          } else { qx[i] = sx[i] * s.W; qy[i] = sy[i] * s.H; }
          const tw = sb[i] * (0.55 + 0.45 * Math.sin(s.t * sf[i] * TAU + sp[i]));
          const off = qx[i] < -3 || qy[i] < -3 || qx[i] > s.W + 3 || qy[i] > s.H + 3;
          key[i] = off ? -1 : sc[i] * LEVELS + Math.min(LEVELS - 1, Math.floor(tw * LEVELS));
        }
        for (let c = 0; c <= nc; c++) {
          ctx.fillStyle = c === nc ? s.ink : s.colors[c];
          for (let l = 0; l < LEVELS; l++) {
            const want = c * LEVELS + l;
            ctx.beginPath();
            let any = false;
            for (let i = 0; i < n; i++) {
              if (key[i] !== want) continue;
              const z = sz[i];
              ctx.rect(qx[i] - z / 2, qy[i] - z / 2, z, z);
              any = true;
            }
            if (!any) continue;
            ctx.globalAlpha = (s.dark ? 0.75 : 0.7) * (l + 1) / LEVELS;
            ctx.fill();
          }
        }
        // The largest stars get a soft halo.
        ctx.globalAlpha = s.dark ? 0.22 : 0.18;
        for (let i = 0; i < n; i++) {
          if (sz[i] < 2.4 || key[i] < 0) continue;
          const d = sz[i] * 3.5;
          ctx.drawImage(starGlow, qx[i] - d, qy[i] - d, d * 2, d * 2);
        }

        if (s.dark) ctx.globalCompositeOperation = 'lighter';
        for (const m of meteors) {
          const run = Math.min(m.age, m.life);
          const hx = m.x + m.dx * m.v * run, hy = m.y + m.dy * m.v * run;
          // Trains: the fireball's whole path, widening and fading after it burns out.
          if (m.train) {
            const after = Math.max(0, m.age - m.life), k = 1 - after / m.train;
            ctx.globalAlpha = (s.dark ? 0.16 : 0.2) * k * Math.min(1, m.age / 1.2);
            ctx.strokeStyle = s.colors[m.c];
            ctx.lineWidth = m.w * (0.5 + after * 0.5);
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(m.x + m.dx * m.v * 0.3, m.y + m.dy * m.v * 0.3);
            ctx.lineTo(hx, hy);
            ctx.stroke();
          }
          if (m.age > m.life) continue;
          // Brightens over its first half, fades over its second: never a flash.
          const env = Math.sin(Math.PI * m.age / m.life) ** 0.8;
          const len = Math.min(m.len, m.v * m.age);
          ctx.globalAlpha = (s.dark ? 0.78 : 0.72) * env;
          ctx.setTransform(s.dpr * m.dx, s.dpr * m.dy, -s.dpr * m.dy, s.dpr * m.dx, s.dpr * hx, s.dpr * hy);
          ctx.drawImage(tails[m.c], -len, -m.w / 2, len, m.w);
          ctx.setTransform(s.dpr, 0, 0, s.dpr, 0, 0);
          const d = m.w * 1.8;
          ctx.drawImage(glows[m.c], hx - d, hy - d, d * 2, d * 2);
        }
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1;
      },
    };
  });
}

/** A tail sprite, bright at its right end and thin along a bright core. @param {string} color
 * @returns {HTMLCanvasElement} */
function tail(color) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 16;
  const g = c.getContext('2d');
  if (!g) return c;
  g.fillStyle = color;
  g.fillRect(0, 0, 256, 16);
  g.globalCompositeOperation = 'destination-in';
  const along = g.createLinearGradient(0, 0, 256, 0);
  along.addColorStop(0, 'rgba(0,0,0,0)');
  along.addColorStop(0.5, 'rgba(0,0,0,.45)');
  along.addColorStop(1, 'rgba(0,0,0,1)');
  g.fillStyle = along;
  g.fillRect(0, 0, 256, 16);
  const across = g.createLinearGradient(0, 0, 0, 16);
  across.addColorStop(0, 'rgba(0,0,0,0)');
  across.addColorStop(0.4, 'rgba(0,0,0,.6)');
  across.addColorStop(0.5, 'rgba(0,0,0,1)');
  across.addColorStop(0.6, 'rgba(0,0,0,.6)');
  across.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = across;
  g.fillRect(0, 0, 256, 16);
  return c;
}

/** A round glow with a bright core, as a sprite. @param {string} color @returns {HTMLCanvasElement} */
function glow(color) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  if (!g) return c;
  g.fillStyle = color;
  g.fillRect(0, 0, 64, 64);
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(0,0,0,1)');
  grad.addColorStop(0.2, 'rgba(0,0,0,.85)');
  grad.addColorStop(0.5, 'rgba(0,0,0,.2)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.globalCompositeOperation = 'destination-in';
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return c;
}
