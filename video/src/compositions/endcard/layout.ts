/**
 * Layout system — 5 scenes with spring transitions, mirrored from Tutorial.
 *
 * Each scene names a layout (rectangle position & size). The animated rect
 * interpolates with a spring when moving between scenes. Everything in the
 * EndCard (ASCII border cutout, center color layer, text position) reads
 * this rect and adapts to the current frame.
 */

import { spring } from "remotion";
import { W, H } from "./theme";

export type SceneLayout =
  | "centered"
  | "centered-bottom"
  | "middle-banner"
  | "left-medium"
  | "right-medium"
  | "left-small"
  | "right-small";

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Scene {
  startSec: number;
  endSec: number;
  layout: SceneLayout;
}

/** Layout constants — match Tutorial's buildRects() */
const MARGIN = 48;
const MED_W = Math.round(W * 0.417); // ~800
const SM_W = Math.round(W * 0.281); // ~540
const C_INSET = Math.round(W * 0.052); // ~100
const C_W = W - 2 * C_INSET;
const FULL_H = H - 2 * MARGIN;
const BOTTOM_RESERVE = 160; // reserved label area below centered-bottom rect

export const CORNER_R = 24;

/**
 * Bottom reserve under centered-bottom (pixels). Read in EndCard to place
 * a label/subtitle below the rect.
 */
export const BOTTOM_LABEL_SPACE = BOTTOM_RESERVE;

/** Middle banner: full-width horizontal strip centered vertically, 1/5 frame height */
const BANNER_H = Math.round(H / 5); // 216
const MIDDLE_BANNER_Y = Math.round((H - BANNER_H) / 2);

export const LAYOUTS: Record<SceneLayout, Rect> = {
  centered: { x: C_INSET, y: MARGIN, w: C_W, h: FULL_H },
  "centered-bottom": {
    x: C_INSET,
    y: MARGIN,
    w: C_W,
    h: FULL_H - BOTTOM_RESERVE,
  },
  "middle-banner": { x: 0, y: MIDDLE_BANNER_Y, w: W, h: BANNER_H },
  "left-medium": { x: MARGIN, y: MARGIN, w: MED_W, h: FULL_H },
  "right-medium": { x: W - MARGIN - MED_W, y: MARGIN, w: MED_W, h: FULL_H },
  "left-small": { x: MARGIN, y: MARGIN, w: SM_W, h: FULL_H },
  "right-small": { x: W - MARGIN - SM_W, y: MARGIN, w: SM_W, h: FULL_H },
};

export function lerpRect(a: Rect, b: Rect, t: number): Rect {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    w: a.w + (b.w - a.w) * t,
    h: a.h + (b.h - a.h) * t,
  };
}

export function findSceneIndex(scenes: Scene[], sec: number): number {
  for (let i = 0; i < scenes.length; i++) {
    if (sec >= scenes[i].startSec && sec < scenes[i].endSec) return i;
  }
  if (scenes.length > 0 && sec >= scenes[scenes.length - 1].endSec) {
    return scenes.length - 1;
  }
  return 0;
}

/**
 * Compute the animated rect for the given frame, with spring interpolation
 * from the previous scene's layout to the current one.
 */
export function getAnimatedRect(
  scenes: Scene[],
  frame: number,
  fps: number,
  transitionFrames = 18,
): { rect: Rect; scene: Scene; framesIntoScene: number } {
  const sec = frame / fps;
  const idx = findSceneIndex(scenes, sec);
  const scene = scenes[idx];
  const prev = idx > 0 ? scenes[idx - 1] : null;

  const sceneStartFrame = Math.round(scene.startSec * fps);
  const framesIntoScene = frame - sceneStartFrame;

  const target = LAYOUTS[scene.layout];
  let rect = target;

  if (prev && framesIntoScene < transitionFrames) {
    const prevRect = LAYOUTS[prev.layout];
    const t = spring({
      frame: framesIntoScene,
      fps,
      config: { damping: 200 },
      durationInFrames: transitionFrames,
    });
    rect = lerpRect(prevRect, target, t);
  }

  return { rect, scene, framesIntoScene };
}
