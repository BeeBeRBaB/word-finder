// Pinball: a table seen from above plays itself. The ball is shot up the lane at the right, rolls
// down the sloping field off the rails, is kicked away by round bumpers that light up and slowly
// dim, and is batted back up by flippers that swing when it comes near; a ball that drains is
// served again. The seed picks the variant: one tall classic table with three bumpers in a
// triangle; a row of narrow tables, each its own ball and colour; or one table the size of the
// page, a field of bumpers and two balls in play.

import { stage, clamp } from './stage.js';

const UP = 0.45;       // radians a flipper's tip lifts above level
const DOWN = 0.5;      // radians it hangs below level at rest
const SLOPE = 0.6;     // radians the inlane guides fall toward the flippers

/** @typedef {{x:number, y:number, vx:number, vy:number, wait:number, still:number, trail:number[]}} Ball
 * wait: seconds until it is served again (it sits in the lane meanwhile); still: seconds slow. */
/** @typedef {{px:number, py:number, side:number, a:number, up:number, w:number}} Flipper
 * side: 1 left (tip to the right), -1 right; a: the tip's angle below level; up: seconds left
 * held up; w: angular speed, radians/s. */
/** @typedef {{x:number, y:number, r:number, c:number, lit:number, hit:number}} Bumper */
/** @typedef {{x0:number, y0:number, x1:number, y1:number, kick:boolean}} Seg */
/** @typedef {{x:number, y:number, on:number}} Light */
/** @typedef {{x:number, y:number, w:number, h:number, pw:number, segs:Seg[], bumpers:Bumper[],
 *   flips:Flipper[], balls:Ball[], lights:Light[], c:number, r:number, fl:number, g:number,
 *   lane:number, path:number[][], slings:number[][], reset:number}} Table
 * x, y, w, h: its box on the page; pw: the field's width left of the lane; r: ball radius; fl:
 * flipper length; g: the slope's pull; lane: the lane's width; path: the rail as one polyline;
 * slings: the two triangles; reset: seconds until lit lights go out together. */

/** @param {HTMLElement} host @param {import('./stage.js').StageOptions} opts @returns {() => void} */
export function start(host, opts) {
  return stage(host, opts, (s) => {
    const { rng } = s;
    const nc = s.colors.length;
    const L = s.layout;
    const cache = document.createElement('canvas');
    /** @type {HTMLCanvasElement[]} */
    const glows = s.colors.map(glow);
    /** @type {Table[]} */
    let tables = [];
    let key = '';

    /**
     * @param {number} x @param {number} y @param {number} w @param {number} h @param {number} n
     * bumpers, 0 for the classic triangle @param {number} balls @param {number} c colour
     * @returns {Table}
     */
    function table(x, y, w, h, n, balls, c) {
      const m = Math.min(s.W, s.H);
      const r = L === 2 ? clamp(m * 0.016, 5, 11) : clamp(w * 0.024, 4.5, 11);
      const lane = r * 3.2, pw = w - lane;
      const fl = clamp(Math.min(pw * 0.17, m * 0.11), r * 5, 140);
      const gap = r * 1.4, py = h - r * 5;
      const lx = pw / 2 - gap / 2 - fl, rx = pw / 2 + gap / 2 + fl;
      const t = Math.tan(SLOPE);
      const rc = Math.min(w / 2, h * 0.28);
      /** @type {Table} */
      const tb = { x, y, w, h, pw, segs: [], bumpers: [], flips: [], balls: [], lights: [], c, r, fl,
        g: h * 0.55, lane, path: [], slings: [], reset: 0 };
      // The rail: up the left side, over the top in two quarter arcs, down the lane's outer side.
      const path = [[0, py - lx * t]];
      for (let i = 0; i <= 10; i++) { const a = Math.PI + i / 10 * Math.PI / 2; path.push([rc + Math.cos(a) * rc, rc + Math.sin(a) * rc]); }
      for (let i = 0; i <= 10; i++) { const a = Math.PI * 1.5 + i / 10 * Math.PI / 2; path.push([w - rc + Math.cos(a) * rc, rc + Math.sin(a) * rc]); }
      path.push([w, h], [pw, h], [pw, rc + r * 6]);
      tb.path = path.map(([px, qy]) => [x + px, y + qy]);
      for (let i = 0; i + 1 < tb.path.length; i++) seg(tb, tb.path[i], tb.path[i + 1], false);
      // Inlane guides down to the flipper pivots.
      seg(tb, [x, y + py - lx * t], [x + lx, y + py], false);
      seg(tb, [x + pw, y + py - (pw - rx) * t], [x + rx, y + py], false);
      // Slingshots above them: the long face kicks.
      for (const sd of [1, -1]) {
        const bx = sd > 0 ? lx - fl * 0.15 : rx + fl * 0.15;
        const B = [x + bx, y + py - fl * 0.6], T = [x + bx, y + py - fl * 1.6], C = [x + bx + sd * fl * 0.55, y + py - fl * 0.78];
        seg(tb, B, T, false); seg(tb, T, C, true); seg(tb, C, B, false);
        tb.slings.push([...B, ...T, ...C]);
      }
      for (const sd of [1, -1]) tb.flips.push({ px: x + (sd > 0 ? lx : rx), py: y + py, side: sd, a: DOWN, up: 0, w: 0 });
      // Bumpers: the classic triangle, or scattered over the upper field.
      const br = clamp(pw * (L === 1 ? 0.075 : n ? 0.05 : 0.09), r * 2, 40);
      if (!n) {
        for (const [u, v] of [[0.3, 0.3], [0.7, 0.3], [0.5, 0.41]]) tb.bumpers.push({ x: x + pw * u, y: y + h * v, r: br, c: tb.bumpers.length + c, lit: 0, hit: 0 });
      } else {
        const top = rc * 0.7 + br, bot = py - fl * 2.4 - br;
        for (let k = 0; k < 400 && tb.bumpers.length < n; k++) {
          const bx = x + br + r * 3 + rng.random() * (pw - 2 * br - r * 6), by = y + top + rng.random() * Math.max(1, bot - top);
          if (tb.bumpers.some((b) => Math.hypot(b.x - bx, b.y - by) < br * 2 + r * 4)) continue;
          tb.bumpers.push({ x: bx, y: by, r: br * (0.8 + rng.random() * 0.4), c: tb.bumpers.length + c, lit: 0, hit: 0 });
        }
      }
      for (let i = 0; i < 3; i++) tb.lights.push({ x: x + pw / 2 + (i - 1) * r * 4.5, y: y + Math.max(rc * 0.6, r * 8), on: 0 });
      for (let i = 0; i < balls; i++) {
        tb.balls.push({ x: 0, y: 0, vx: 0, vy: 0, wait: 0, still: 0, trail: [] });
        serve(tb, tb.balls[i]);
        tb.balls[i].wait = 0.6 + i * 3;
      }
      return tb;
    }

    /** @param {Table} tb @param {number[]} a @param {number[]} b @param {boolean} kick */
    function seg(tb, a, b, kick) { tb.segs.push({ x0: a[0], y0: a[1], x1: b[0], y1: b[1], kick }); }

    /** Puts the ball at the foot of the lane. @param {Table} tb @param {Ball} b */
    function serve(tb, b) {
      b.x = tb.x + tb.pw + tb.lane / 2; b.y = tb.y + tb.h - tb.r - 1;
      b.vx = 0; b.vy = 0; b.wait = 1; b.still = 0; b.trail.length = 0;
    }

    /** Pushes ball b off the capsule round a..c (radius k) and bounces it, the surface moving
     * at (ux, uy). @returns {boolean} whether they touched
     * @param {Ball} b @param {number} r @param {number} ax @param {number} ay @param {number} cx
     * @param {number} cy @param {number} k @param {number} e restitution @param {number} ux @param {number} uy */
    function hit(b, r, ax, ay, cx, cy, k, e, ux, uy) {
      const dx = cx - ax, dy = cy - ay, ll = dx * dx + dy * dy;
      const u = ll ? clamp(((b.x - ax) * dx + (b.y - ay) * dy) / ll, 0, 1) : 0;
      const qx = ax + dx * u, qy = ay + dy * u;
      let nx = b.x - qx, ny = b.y - qy;
      const d = Math.hypot(nx, ny);
      if (d >= r + k || d < 1e-6) return false;
      nx /= d; ny /= d;
      b.x = qx + nx * (r + k); b.y = qy + ny * (r + k);
      const rx = b.vx - ux, ry = b.vy - uy, vn = rx * nx + ry * ny;
      if (vn < 0) { b.vx = rx - (1 + e) * vn * nx + ux; b.vy = ry - (1 + e) * vn * ny + uy; }
      return true;
    }

    /** @param {Table} tb @param {Ball} b @param {number} dt */
    function move(tb, b, dt) {
      const r = tb.r;
      b.vy += tb.g * dt;
      b.x += b.vx * dt; b.y += b.vy * dt;
      for (const sg of tb.segs) {
        if (hit(b, r, sg.x0, sg.y0, sg.x1, sg.y1, 0, sg.kick ? 0.9 : 0.45, 0, 0) && sg.kick) {
          // A slingshot kicks out along its face's normal.
          const dx = sg.x1 - sg.x0, dy = sg.y1 - sg.y0, l = Math.hypot(dx, dy);
          const nx = dy / l, ny = -dx / l, side = (b.x - sg.x0) * nx + (b.y - sg.y0) * ny > 0 ? 1 : -1;
          b.vx += nx * side * tb.h * 0.35; b.vy += ny * side * tb.h * 0.35;
        }
      }
      for (const bm of tb.bumpers) {
        if (!hit(b, r, bm.x, bm.y, bm.x, bm.y, bm.r, 1, 0, 0)) continue;
        const nx = (b.x - bm.x) / (bm.r + r), ny = (b.y - bm.y) / (bm.r + r);
        b.vx += nx * tb.h * 0.45; b.vy += ny * tb.h * 0.45;
        bm.hit = 0.3;
      }
      for (const f of tb.flips) {
        const tx = f.px + f.side * Math.cos(f.a) * tb.fl, ty = f.py + Math.sin(f.a) * tb.fl;
        // The surface's speed where the ball meets it: the swing about the pivot.
        const ox = b.x - f.px, oy = b.y - f.py, wv = f.w * f.side;
        hit(b, r, f.px, f.py, tx, ty, r * 0.7, 0.3, -oy * wv, ox * wv);
      }
      // A calm game: the ball never goes faster than this.
      const sp = Math.hypot(b.vx, b.vy), max = tb.h * 1.5;
      if (sp > max) { b.vx *= max / sp; b.vy *= max / sp; }
      for (const lt of tb.lights) if (Math.hypot(b.x - lt.x, b.y - lt.y) < r * 2.2 && !lt.on) lt.on = 0.001;
    }

    /** @param {Table} tb @param {number} dt */
    function tick(tb, dt) {
      for (const f of tb.flips) {
        // Swing for a moment when a ball is about to touch, then rest a moment.
        if (f.up <= -0.25) {
          const tx = f.px + f.side * Math.cos(DOWN) * tb.fl, ty = f.py + Math.sin(DOWN) * tb.fl;
          for (const b of tb.balls) {
            if (b.wait > 0 || b.vy < -tb.r * 4) continue;
            const dx = tx - f.px, dy = ty - f.py;
            const u = ((b.x - f.px) * dx + (b.y - f.py) * dy) / (dx * dx + dy * dy);
            if (u < 0.2 || u > 1.05) continue;
            const d = Math.hypot(b.x - f.px - dx * u, b.y - f.py - dy * u);
            if (d < tb.r * 3.4 && b.y < f.py + dy * u) f.up = 0.2 + rng.random() * 0.1;
          }
        }
        f.up -= dt;
      }
      // Small steps, so neither a fast ball nor a swinging flipper passes through anything.
      let n = 1;
      for (const b of tb.balls) n = Math.max(n, Math.ceil(Math.hypot(b.vx, b.vy) * dt / (tb.r * 0.5)));
      for (const f of tb.flips) if (f.a !== (f.up > 0 ? -UP : DOWN)) n = Math.max(n, Math.ceil(16 * dt * tb.fl / (tb.r * 0.5)));
      for (let k = 0; k < n; k++) {
        const h = dt / n;
        for (const f of tb.flips) {
          const goal = f.up > 0 ? -UP : DOWN, sp = (f.up > 0 ? 16 : 9) * h, was = f.a;
          f.a = goal < f.a ? Math.max(goal, f.a - sp) : Math.min(goal, f.a + sp);
          f.w = h > 0 ? (f.a - was) / h : 0;
        }
        for (const b of tb.balls) if (b.wait <= 0) move(tb, b, h);
      }
      for (const b of tb.balls) {
        if (b.wait > 0) {
          b.wait -= dt;
          // Shot up the lane, hard enough to reach the top.
          if (b.wait <= 0) b.vy = -Math.sqrt(2 * tb.g * tb.h * 0.92) * (1 + rng.random() * 0.12);
          continue;
        }
        b.trail.push(b.x, b.y);
        if (b.trail.length > 10) b.trail.splice(0, 2);
        b.still = Math.hypot(b.vx, b.vy) < tb.r * 3 ? b.still + dt : 0;
        if (b.y > tb.y + tb.h + tb.r * 3 || b.still > 3 || b.x < tb.x - tb.r * 4 || b.x > tb.x + tb.w + tb.r * 4) serve(tb, b);
      }
      for (const bm of tb.bumpers) {
        if (bm.hit > 0) { bm.hit -= dt; bm.lit = Math.min(1, bm.lit + dt / 0.25); }
        else bm.lit = Math.max(0, bm.lit - dt / 1.6);
      }
      // All three lights lit: a moment, then they go out together.
      for (const lt of tb.lights) if (lt.on) lt.on = Math.min(1, lt.on + dt / 0.4);
      if (tb.lights.every((lt) => lt.on >= 1)) tb.reset += dt;
      if (tb.reset > 1.5) {
        for (const lt of tb.lights) lt.on = -1;
        tb.reset = 0;
      }
      for (const lt of tb.lights) if (lt.on < 0) lt.on = Math.min(0, lt.on + dt / 1.2);
    }

    function build() {
      const m = Math.min(s.W, s.H);
      tables = [];
      if (L === 0) {
        const h = s.H * 0.94, w = Math.min(s.W * 0.92, h * 0.56);
        tables.push(table((s.W - w) / 2, (s.H - h) / 2, w, h, 0, 1, 0));
      } else if (L === 1) {
        const n = clamp(Math.floor(s.W / (s.H * 0.5)), 2, 4);
        const w = s.W / n * 0.88, h = Math.min(s.H * 0.92, w * 2.4), gx = (s.W - n * w) / (n + 1);
        for (let i = 0; i < n; i++) tables.push(table(gx + i * (w + gx), (s.H - h) / 2, w, h, 2 + rng.int(3), 1, i));
      } else {
        const p = clamp(m * 0.04, 10, 40);
        tables.push(table(p, p, s.W - 2 * p, s.H - 2 * p, clamp(Math.round(s.W * s.H / 75000), 5, 14), 2, 0));
      }
      // A game under way: each ball somewhere in the field.
      for (const tb of tables) {
        tb.balls.forEach((b, i) => {
          b.x = tb.x + tb.pw * (0.25 + rng.random() * 0.5); b.y = tb.y + tb.h * (0.2 + i * 0.3 + rng.random() * 0.2);
          b.vx = (rng.random() - 0.5) * tb.h * 0.5; b.vy = -tb.h * 0.3; b.wait = 0;
        });
        for (let k = 0; k < 40; k++) tick(tb, 1 / 30);
      }
    }

    function render() {
      cache.width = Math.round(s.W * s.dpr); cache.height = Math.round(s.H * s.dpr);
      const g = cache.getContext('2d');
      if (!g) return;
      g.setTransform(s.dpr, 0, 0, s.dpr, 0, 0);
      g.lineJoin = 'round'; g.lineCap = 'round';
      for (const tb of tables) {
        const col = s.colors[tb.c % nc];
        // The field, faintly, inside the rail.
        g.beginPath();
        tb.path.slice(0, 23).forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
        g.lineTo(tb.x + tb.w, tb.y + tb.h); g.lineTo(tb.x, tb.y + tb.h); g.closePath();
        g.fillStyle = col; g.globalAlpha = s.dark ? 0.05 : 0.07; g.fill();
        g.strokeStyle = s.ink; g.lineWidth = Math.max(2, tb.r * 0.4);
        g.globalAlpha = s.dark ? 0.3 : 0.34;
        g.beginPath();
        for (const sg of tb.segs) { if (sg.kick) continue; g.moveTo(sg.x0, sg.y0); g.lineTo(sg.x1, sg.y1); }
        g.stroke();
        for (const [bx, by, tx, ty, cx, cy] of tb.slings) {
          g.beginPath(); g.moveTo(bx, by); g.lineTo(tx, ty); g.lineTo(cx, cy); g.closePath();
          g.fillStyle = col; g.globalAlpha = s.dark ? 0.2 : 0.24; g.fill();
          g.globalAlpha = s.dark ? 0.45 : 0.5; g.strokeStyle = col; g.stroke();
        }
        // Arrows up the field toward the bumpers, as painted on a playfield.
        g.globalAlpha = s.dark ? 0.12 : 0.14; g.fillStyle = s.ink;
        const ax = tb.x + tb.pw / 2, ay = tb.y + tb.h * 0.62, k = tb.r * 1.6;
        for (let i = 0; i < 3; i++) {
          const y = ay - i * k * 2.2;
          g.beginPath(); g.moveTo(ax, y - k); g.lineTo(ax + k, y + k * 0.4); g.lineTo(ax - k, y + k * 0.4); g.closePath(); g.fill();
        }
      }
    }

    return {
      lay() {
        const k = `${s.W}x${s.H}`;
        if (k !== key) { key = k; build(); }
        render();
      },
      step(dt) { for (const tb of tables) tick(tb, dt); },
      draw() {
        const { ctx } = s;
        ctx.drawImage(cache, 0, 0, s.W, s.H);
        for (const tb of tables) {
          // Bumpers: a ring, a cap that brightens when struck, and a soft glow.
          for (const bm of tb.bumpers) {
            const ci = bm.c % nc, col = s.colors[ci];
            if (bm.lit > 0.01) {
              ctx.globalCompositeOperation = s.dark ? 'lighter' : 'source-over';
              ctx.globalAlpha = (s.dark ? 0.32 : 0.22) * bm.lit;
              const d = bm.r * 2.6;
              ctx.drawImage(glows[ci], bm.x - d, bm.y - d, d * 2, d * 2);
              ctx.globalCompositeOperation = 'source-over';
            }
            ctx.fillStyle = col; ctx.strokeStyle = col;
            ctx.globalAlpha = (s.dark ? 0.2 : 0.24) + 0.3 * bm.lit;
            ctx.beginPath(); ctx.arc(bm.x, bm.y, bm.r, 0, Math.PI * 2); ctx.fill();
            ctx.globalAlpha = 0.5; ctx.lineWidth = Math.max(1.5, bm.r * 0.14);
            ctx.beginPath(); ctx.arc(bm.x, bm.y, bm.r * 0.62, 0, Math.PI * 2); ctx.stroke();
          }
          // The top lights, lit as the ball rolls over them.
          for (const lt of tb.lights) {
            const v = lt.on > 0 ? lt.on : -lt.on;
            ctx.fillStyle = s.colors[(tb.c + 2) % nc];
            ctx.globalAlpha = 0.16 + 0.4 * v;
            ctx.beginPath(); ctx.arc(lt.x, lt.y, tb.r * 0.9, 0, Math.PI * 2); ctx.fill();
          }
          // Flippers.
          ctx.lineCap = 'round';
          ctx.strokeStyle = s.colors[(tb.c + 1) % nc];
          ctx.lineWidth = tb.r * 1.4;
          ctx.globalAlpha = s.dark ? 0.55 : 0.6;
          ctx.beginPath();
          for (const f of tb.flips) {
            ctx.moveTo(f.px, f.py);
            ctx.lineTo(f.px + f.side * Math.cos(f.a) * tb.fl, f.py + Math.sin(f.a) * tb.fl);
          }
          ctx.stroke();
          // Balls, with a short fading trail; one waiting sits in the lane.
          ctx.fillStyle = s.ink;
          for (const b of tb.balls) {
            const t = b.trail;
            for (let i = 0; i + 2 < t.length; i += 2) {
              ctx.globalAlpha = 0.12 * (i + 2) / t.length;
              ctx.beginPath(); ctx.arc(t[i], t[i + 1], tb.r * 0.8, 0, Math.PI * 2); ctx.fill();
            }
            ctx.globalAlpha = 0.62;
            ctx.beginPath(); ctx.arc(b.x, b.y, tb.r, 0, Math.PI * 2); ctx.fill();
          }
        }
      },
    };
  });
}

/** A round glow, as a sprite. @param {string} color @returns {HTMLCanvasElement} */
function glow(color) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  if (!g) return c;
  g.fillStyle = color;
  g.fillRect(0, 0, 64, 64);
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(0,0,0,1)');
  grad.addColorStop(0.4, 'rgba(0,0,0,.5)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.globalCompositeOperation = 'destination-in';
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return c;
}
