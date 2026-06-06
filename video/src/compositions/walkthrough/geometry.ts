/**
 * Geometry — the one source for the canvas/window placement and the transform
 * from manifest image space (1440×900 CSS px) to 1920×1080 canvas space.
 * No Remotion imports, no cycles — both Screen and walkthroughData import it.
 *
 * Placement (chosen so left/right callouts never clip): scale 1.0, the 1440-wide
 * screenshot centered with 240px side margins, under an 80px browser chrome
 * (36px tab strip + 44px toolbar/address bar).
 */

export type Rect = { x: number; y: number; w: number; h: number };
export type Point = { x: number; y: number };

export const VIEWPORT = { width: 1440, height: 900 };

export const CANVAS_W = 1920;
export const CANVAS_H = 1080;

/** The toolbar row (nav glyphs + address bar). */
export const CHROME_BAR_HEIGHT = 44;
/** The Chrome tab strip above the toolbar. */
export const TAB_STRIP_HEIGHT = 36;
/** Full chrome height — tab strip + toolbar. The screenshot sits below this. */
export const CHROME_TOTAL_HEIGHT = TAB_STRIP_HEIGHT + CHROME_BAR_HEIGHT; // 80
export const WINDOW_RADIUS = 16;

export const SCREEN_SCALE = 1.0;
export const SCREEN_W = VIEWPORT.width * SCREEN_SCALE; // 1440
export const SCREEN_H = VIEWPORT.height * SCREEN_SCALE; // 900

export const WINDOW_LEFT = Math.round((CANVAS_W - SCREEN_W) / 2); // 240
// 20px above the tabs; with the 80px chrome the window bottom lands at 1000,
// keeping the 80px lower-third band clear of the screenshot.
export const WINDOW_TOP = 20;

export const SCREEN_LEFT = WINDOW_LEFT;
export const SCREEN_TOP = WINDOW_TOP + CHROME_TOTAL_HEIGHT; // 136

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
