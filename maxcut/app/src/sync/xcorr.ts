// Normalized cross-correlation on peak streams.
//
// Direct (FFT-free) implementation. For inputs of size N and maxLag L,
// complexity is O(N * L). At our intended scale — 2 s of peaks at 200 Hz
// = 400 samples, ±5 s of lag at 200 Hz = 1000 samples — this is ~4e5
// multiplies. Fine. An FFT would be faster in the large; not needed here.
//
// Inputs are peak streams — typically `maxs` or `|maxs - mins|` envelopes.
// Both arrays are mean-subtracted and variance-normalized before the dot
// product. The returned `correlation` is in [-1, 1].

export type XcorrResult = { lag: number; correlation: number };

function meanStd(a: Float32Array): { mean: number; std: number } {
  const n = a.length;
  if (n === 0) return { mean: 0, std: 0 };
  let sum = 0;
  for (let i = 0; i < n; i++) sum += a[i];
  const mean = sum / n;
  let ss = 0;
  for (let i = 0; i < n; i++) {
    const d = a[i] - mean;
    ss += d * d;
  }
  return { mean, std: Math.sqrt(ss / n) };
}

export function normalizedXcorr(
  a: Float32Array,
  b: Float32Array,
  maxLag: number,
): XcorrResult {
  const n = Math.min(a.length, b.length);
  if (n === 0) return { lag: 0, correlation: 0 };

  const { mean: aMean, std: aStd } = meanStd(a.subarray(0, n));
  const { mean: bMean, std: bStd } = meanStd(b.subarray(0, n));

  if (aStd === 0 || bStd === 0) return { lag: 0, correlation: 0 };

  const L = Math.max(0, Math.min(maxLag, n - 1));
  let bestLag = 0;
  let bestCorr = -Infinity;

  // Positive lag k: b is delayed by k relative to a  →  compare a[i+k] with b[i].
  // Negative lag k: a is delayed by |k| relative to b  →  compare a[i] with b[i-k].
  for (let k = -L; k <= L; k++) {
    const start = Math.max(0, -k);
    const end = Math.min(n, n - k);
    const len = end - start;
    if (len <= 1) continue;
    let dot = 0;
    for (let i = start; i < end; i++) {
      dot += (a[i + k] - aMean) * (b[i] - bMean);
    }
    // Normalize by full-window std * length. This is the Pearson-style
    // correlation of the overlapping window against the full-signal stats,
    // which is stable when lag << n. Refine with window-local stats if needed.
    const corr = dot / (len * aStd * bStd);
    if (corr > bestCorr) {
      bestCorr = corr;
      bestLag = k;
    }
  }

  if (!isFinite(bestCorr)) return { lag: 0, correlation: 0 };
  return { lag: bestLag, correlation: bestCorr };
}
