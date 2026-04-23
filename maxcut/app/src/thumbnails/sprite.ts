// Sprite tile math. One thumbnail per source second, horizontal strip of 64 px tiles.
// Coordinates are pure arithmetic; the image itself arrives elsewhere.

export const SPRITE_TILE_W = 64;
export const SPRITE_TILE_H = 36; // 16:9 at 64 px wide. The ratio is a convention, not a law.

export type SpriteTile = {
  secondIndex: number;
  offsetX: number;
  width: number;
  height: number;
};

export function tileForFrame(frame: number, sourceFps: number): SpriteTile {
  const fps = sourceFps > 0 ? sourceFps : 60;
  const sec = Math.max(0, Math.floor(frame / fps));
  return {
    secondIndex: sec,
    offsetX: sec * SPRITE_TILE_W,
    width: SPRITE_TILE_W,
    height: SPRITE_TILE_H,
  };
}

// The seconds that fall within [inFrame, outFrame), inclusive at left, exclusive at right.
// Returns integer second indices in source time.
export function secondsInRange(inFrame: number, outFrame: number, sourceFps: number): number[] {
  const fps = sourceFps > 0 ? sourceFps : 60;
  if (outFrame <= inFrame) return [];
  const first = Math.floor(inFrame / fps);
  const lastExclusive = Math.ceil(outFrame / fps);
  const out: number[] = [];
  for (let s = first; s < lastExclusive; s++) out.push(s);
  return out;
}
