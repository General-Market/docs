// Resample a peaks stream into a fixed pixel bucket count.
// Input: mins/maxs at rateHz. Clip: in..out in source frames at sourceFps.
// Output: mins/maxs of length pxCount. Each bucket holds the min/max over its span.
// No interpolation. Extrema are the truth of a peak stream; averages flatter it.

export type PeaksSource = {
  mins: Float32Array;
  maxs: Float32Array;
  rateHz: number;
};

export type ResampleInput = {
  peaks: PeaksSource;
  inFrame: number;
  outFrame: number;
  sourceFps: number;
  pxCount: number;
};

export type ResampleResult = {
  mins: Float32Array;
  maxs: Float32Array;
};

function framesToSampleIndex(frame: number, sourceFps: number, rateHz: number): number {
  return (frame / sourceFps) * rateHz;
}

export function resamplePeaks(input: ResampleInput): ResampleResult {
  const { peaks, inFrame, outFrame, sourceFps, pxCount } = input;
  const mins = new Float32Array(Math.max(0, pxCount));
  const maxs = new Float32Array(Math.max(0, pxCount));
  if (pxCount <= 0 || peaks.mins.length === 0 || outFrame <= inFrame) {
    return { mins, maxs };
  }

  const total = peaks.mins.length;
  const startIdxF = framesToSampleIndex(inFrame, sourceFps, peaks.rateHz);
  const endIdxF = framesToSampleIndex(outFrame, sourceFps, peaks.rateHz);
  const span = endIdxF - startIdxF;
  if (span <= 0) {
    return { mins, maxs };
  }
  const perBucket = span / pxCount;

  for (let i = 0; i < pxCount; i++) {
    const a = startIdxF + i * perBucket;
    const b = a + perBucket;
    let lo = Math.floor(a);
    let hi = Math.floor(b);
    if (b === hi) hi -= 1;
    if (lo < 0) lo = 0;
    if (hi >= total) hi = total - 1;
    if (hi < lo) {
      // sub-sample bucket: sample the nearest real index
      const nearest = Math.min(total - 1, Math.max(0, Math.round(a)));
      mins[i] = peaks.mins[nearest];
      maxs[i] = peaks.maxs[nearest];
      continue;
    }
    let mn = peaks.mins[lo];
    let mx = peaks.maxs[lo];
    for (let j = lo + 1; j <= hi; j++) {
      const v0 = peaks.mins[j];
      const v1 = peaks.maxs[j];
      if (v0 < mn) mn = v0;
      if (v1 > mx) mx = v1;
    }
    mins[i] = mn;
    maxs[i] = mx;
  }

  return { mins, maxs };
}

// Pick the tier to fetch based on pixels-per-source-frame zoom.
// At or above 2 px/frame, sample-accurate trim becomes legible; use the 1 kHz tier.
export function chooseTier(pxPerFrame: number): "low" | "high" {
  return pxPerFrame >= 2 ? "high" : "low";
}
