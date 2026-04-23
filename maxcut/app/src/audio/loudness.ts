// Loudness helpers. All the real work is ffmpeg on the server. We only describe it.

export type LoudnessPreset = "off" | "-16 LUFS" | "-14 LUFS";

export function lufsTargetForPreset(p: LoudnessPreset): number | null {
  switch (p) {
    case "off":
      return null;
    case "-16 LUFS":
      return -16;
    case "-14 LUFS":
      return -14;
  }
}

/**
 * ffmpeg CLI args for a two-pass `loudnorm` filter at the given LUFS target.
 * Matches ffmpeg's recommended parameters: TP=-1.5 dBFS, LRA=11.
 * The two-pass in practice is: run once with print_format=json to measure,
 * parse measured_I/TP/LRA/thresh/target_offset, then run again with those as inputs.
 * We emit a single-invocation arg list with `print_format=json` for pass one.
 */
export function ffmpegLoudnormArgs(targetLufs: number): string[] {
  const I = targetLufs.toFixed(2);
  return [
    "-af",
    `loudnorm=I=${I}:TP=-1.5:LRA=11:print_format=json`,
  ];
}
