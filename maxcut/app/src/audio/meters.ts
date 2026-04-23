// Running peak meter. Tracks peak absolute amplitude with exponential decay.
// τ = 300 ms at 60 Hz read → per-read decay factor exp(-16.667/300).
// `push` ratchets the peak up on new samples; `read` bleeds it down over time
// and returns dBFS clamped at -96.

const FLOOR_DBFS = -96;
// Decay applied once per read at the expected 60 Hz read rate.
const DECAY_PER_READ = Math.exp(-(1000 / 60) / 300);

export class PeakMeter {
  private peak = 0;

  push(samples: Float32Array): void {
    let p = this.peak;
    // Fast absolute max. No allocation.
    for (let i = 0; i < samples.length; i++) {
      const a = samples[i];
      const abs = a < 0 ? -a : a;
      if (abs > p) p = abs;
    }
    this.peak = p;
  }

  read(): number {
    const p = this.peak;
    // Decay AFTER reading so two reads in the same render tick return similar values.
    this.peak = p * DECAY_PER_READ;
    if (p <= 0) return FLOOR_DBFS;
    const db = 20 * Math.log10(p);
    return db < FLOOR_DBFS ? FLOOR_DBFS : db;
  }

  reset(): void {
    this.peak = 0;
  }
}
