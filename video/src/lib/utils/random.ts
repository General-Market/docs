/**
 * Deterministic pseudo-random number generator seeded by frame.
 * Produces the same output for the same seed every time (render-safe).
 */
export const seededRandom = (seed: number): number => {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
};

export const seededRange = (seed: number, min: number, max: number): number =>
  min + seededRandom(seed) * (max - min);

export const seededInt = (seed: number, min: number, max: number): number =>
  Math.floor(seededRange(seed, min, max + 1));

export const seededPick = <T>(seed: number, arr: T[]): T =>
  arr[seededInt(seed, 0, arr.length - 1)];
