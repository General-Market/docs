/**
 * cursorPath — pure geometry for the walkthrough cursor.
 *
 * The cursor must not slide on a dead straight line; a real hand swings. So we
 * bow the path: lay a quadratic Bézier between `from` and `to`, and push the
 * single control point off the midpoint, *perpendicular* to the from→to segment.
 * The bow scales with distance so short hops barely curve and long sweeps arc
 * generously. No Remotion import — this is math the component eases into.
 */

export type Point = { x: number; y: number };

/**
 * A point on a gentle quadratic arc between `from` and `to`.
 * @param t 0..1 along the curve (the caller may pass an already-eased t).
 */
export function bezierArc(from: Point, to: Point, t: number): Point {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dist = Math.hypot(dx, dy) || 1;

  // Perpendicular unit vector to the from→to segment (rotate the direction 90°).
  const nx = -dy / dist;
  const ny = dx / dist;

  // Bow magnitude: ~18% of the span, softened and capped so it never balloons
  // on a screen-spanning move. A 200px hop bows ~36px; a 1200px sweep ~150px.
  const bow = Math.min(dist * 0.18, 150);

  // Control point: the midpoint, pushed out along the perpendicular.
  const mx = (from.x + to.x) / 2 + nx * bow;
  const my = (from.y + to.y) / 2 + ny * bow;

  // Quadratic Bézier: B(t) = (1-t)²P0 + 2(1-t)t C + t²P1.
  const u = 1 - t;
  const a = u * u;
  const b = 2 * u * t;
  const c = t * t;

  return {
    x: a * from.x + b * mx + c * to.x,
    y: a * from.y + b * my + c * to.y,
  };
}
