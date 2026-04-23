// Nearest zero-crossing search on a min/max peak stream.
// Peaks are pairs (mins[i], maxs[i]) per peak bucket. A zero-crossing happens
// where mins[i] <= 0 <= maxs[i] — i.e. the signal crossed zero inside the bucket.
// We prefer such buckets; among them we pick the one with smallest absolute
// midpoint (|min + max| / 2) — the deepest-looking crossing.
// If none found in radius, fall back to the bucket with smallest peak magnitude.
// On total ambiguity, return centerIdx.

export function nearestZeroCrossing(
  mins: Float32Array,
  maxs: Float32Array,
  centerIdx: number,
  searchRadius: number,
): number {
  const n = Math.min(mins.length, maxs.length);
  if (n === 0) return centerIdx;
  if (searchRadius <= 0) return Math.min(Math.max(centerIdx, 0), n - 1);

  const lo = Math.max(0, centerIdx - searchRadius);
  const hi = Math.min(n - 1, centerIdx + searchRadius);

  let bestCrossIdx = -1;
  let bestCrossScore = Infinity;
  let bestMagIdx = -1;
  let bestMag = Infinity;

  for (let i = lo; i <= hi; i++) {
    const mn = mins[i];
    const mx = maxs[i];
    const mag = Math.max(Math.abs(mn), Math.abs(mx));

    const crosses = mn <= 0 && mx >= 0;
    if (crosses) {
      // Midpoint magnitude — the closer to zero, the cleaner the crossing.
      const mid = Math.abs((mn + mx) * 0.5);
      const dist = Math.abs(i - centerIdx);
      // Prefer cleaner crossing; break ties by distance to center.
      const score = mid * 1000 + dist;
      if (score < bestCrossScore) {
        bestCrossScore = score;
        bestCrossIdx = i;
      }
    }

    if (mag < bestMag) {
      bestMag = mag;
      bestMagIdx = i;
    }
  }

  if (bestCrossIdx >= 0) return bestCrossIdx;
  if (bestMagIdx >= 0) return bestMagIdx;
  return centerIdx;
}
