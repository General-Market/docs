// First-transient detector, for clap/slate alignment.
//
// Works on peak streams (mins, maxs) at whatever rate the caller supplies.
// Returns the sample index of the first point that meets BOTH:
//   (a) absolute peak ≥ thresholdDb (default −12 dBFS), and
//   (b) rise of more than riseDb over the preceding riseWindowSamples.
//
// The default riseWindow is 5 samples. At a 1 kHz peak rate that is 5 ms,
// which matches §8.4 of DESIGN.md. No DSP, no onset detector vocabulary —
// just a spike that exceeds a threshold after a quiet lead-in.

export type OnsetOpts = {
  thresholdDb?: number;
  riseDb?: number;
  riseWindowSamples?: number;
};

const DEFAULTS: Required<OnsetOpts> = {
  thresholdDb: -12,
  riseDb: 20,
  riseWindowSamples: 5,
};

// Convert a linear peak in [-1, 1] to dBFS. Zero maps to −∞; we floor at −120
// to keep differences finite.
function peakDb(mn: number, mx: number): number {
  const a = Math.max(Math.abs(mn), Math.abs(mx));
  if (a <= 0) return -120;
  return 20 * Math.log10(a);
}

export function detectFirstOnset(
  mins: Float32Array,
  maxs: Float32Array,
  opts: OnsetOpts = {},
): number | null {
  const { thresholdDb, riseDb, riseWindowSamples } = { ...DEFAULTS, ...opts };
  const n = Math.min(mins.length, maxs.length);
  if (n === 0) return null;

  // Precompute per-sample dB so the rise test is a simple max-minus-value.
  const db = new Float32Array(n);
  for (let i = 0; i < n; i++) db[i] = peakDb(mins[i], maxs[i]);

  const w = Math.max(1, Math.floor(riseWindowSamples));

  for (let i = w; i < n; i++) {
    if (db[i] < thresholdDb) continue;
    let floor = Infinity;
    for (let j = i - w; j < i; j++) {
      if (db[j] < floor) floor = db[j];
    }
    if (db[i] - floor > riseDb) return i;
  }
  return null;
}
