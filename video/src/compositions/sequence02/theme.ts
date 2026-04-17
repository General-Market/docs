export const FPS = 30;
export const W = 1920;
export const H = 1080;

// "Insider trading is booming." ends at 1.92s in the original take. A cutaway
// clip is spliced in at that point; everything downstream shifts by its
// length. The video file `sequence02_with_insert.mp4` carries the baked splice.
export const INSERT_SEC = 1.92;
export const INSERT_DUR = 2.901;

export const ORIGINAL_DURATION_SEC = 63.8;
export const DURATION_SEC = ORIGINAL_DURATION_SEC + INSERT_DUR;
export const TOTAL_FRAMES = Math.round(DURATION_SEC * FPS);

/** Transcript-time → composition-time. Anything past the splice shifts. */
export const T = (sec: number) =>
  sec > INSERT_SEC ? sec + INSERT_DUR : sec;

export const toFrames = (sec: number) => Math.round(T(sec) * FPS);

export const SRC = "sequence02/sequence02_with_insert.mp4";
/** Voice track — pipeline:
 *    mp4 → WAV
 *    → clean-voice preset (HPF + compressor + gain + limiter)   [base loudness]
 *    → apply_word_fx.py (echo / reverb / pitch-drop accents)    [per-word dynamism]
 *
 *  The accents layer ON TOP of the clean track so the original word hits
 *  first, then a processed tail or doubling trails for punch. */
export const VOICE_SRC = "sequence02/sequence02_dynamic.wav";
