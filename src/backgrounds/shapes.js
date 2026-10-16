// Shared by the backgrounds, and not a background itself: paths that newer canvases have built
// in (roundRect, Safari 16 and Chrome 99), drawn here so older ones show them too.

/**
 * Adds a rounded rectangle to the current path, as ctx.roundRect(x, y, w, h, r) would.
 * @param {CanvasRenderingContext2D} ctx @param {number} x @param {number} y @param {number} w
 * @param {number} h @param {number} r corner radius, clamped to half the shorter side
 */
export function roundRect(ctx, x, y, w, h, r) {
  const k = Math.max(0, Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2));
  ctx.moveTo(x + k, y);
  ctx.arcTo(x + w, y, x + w, y + h, k);
  ctx.arcTo(x + w, y + h, x, y + h, k);
  ctx.arcTo(x, y + h, x, y, k);
  ctx.arcTo(x, y, x + w, y, k);
  ctx.closePath();
}
