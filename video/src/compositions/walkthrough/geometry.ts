/**
 * Geometry — the one source for the canvas/window placement and the transform
 * from manifest image space (1440×900 CSS px) to 1920×1080 canvas space.
 * No Remotion imports, no cycles — both Screen and walkthroughData import it.
 *
 * Placement (chosen so left/right callouts never clip): scale 1.0, the 1440-wide
 * screenshot centered with 240px side margins, under a 44px browser chrome bar.
 */

export type Rect = { x: number; y: number; w: number; h: number };
export type Point = { x: number; y: number };

export const VIEWPORT = { width: 1440, height: 900 };

export const CANVAS_W = 1920;
export const CANVAS_H = 1080;

export const CHROME_BAR_HEIGHT = 44;
export const WINDOW_RADIUS = 16;

export const SCREEN_SCALE = 1.0;
export const SCREEN_W = VIEWPORT.width * SCREEN_SCALE; // 1440
export const SCREEN_H = VIEWPORT.height * SCREEN_SCALE; // 900

export const WINDOW_LEFT = Math.round((CANVAS_W - SCREEN_W) / 2); // 240
export const WINDOW_TOP = 56;

export const SCREEN_LEFT = WINDOW_LEFT;
export const SCREEN_TOP = WINDOW_TOP + CHROME_BAR_HEIGHT; // 100

/** Map a manifest rect (image px) into canvas space. */
export const toCanvas = (rect: Rect): Rect => ({
  x: SCREEN_LEFT + rect.x * SCREEN_SCALE,
  y: SCREEN_TOP + rect.y * SCREEN_SCALE,
  w: rect.w * SCREEN_SCALE,
  h: rect.h * SCREEN_SCALE,
});

/** Center of a manifest rect, in canvas space — the cursor's target. */
export const toCanvasPoint = (rect: Rect): Point => {
  const c = toCanvas(rect);
  return { x: c.x + c.w / 2, y: c.y + c.h / 2 };
};

/** Where step 0's cursor rests before its first move. */
export const WINDOW_CENTER: Point = {
  x: SCREEN_LEFT + SCREEN_W / 2,
  y: SCREEN_TOP + SCREEN_H / 2,
};
