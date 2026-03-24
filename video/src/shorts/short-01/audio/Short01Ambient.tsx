import React, { useCallback } from "react";
import { Audio, staticFile, useVideoConfig } from "remotion";
import type { SilenceWindow } from "../types";

interface Props {
  /** Path to ambient hum audio file */
  ambientPath: string;
  /** Windows where ambient cuts to zero */
  muteRanges: SilenceWindow[];
  baseVolume?: number;
}

/**
 * Low-frequency ambient hum for "fullness".
 * Runs at -30dB (very low), cuts to zero during silence moments.
 * Gives the audio mix body without being noticeable.
 */
export const Short01Ambient: React.FC<Props> = ({
  ambientPath,
  muteRanges,
  baseVolume = 0.03, // -30dB equivalent
}) => {
  const { durationInFrames } = useVideoConfig();

  const volume = useCallback(
    (f: number) => {
      // Check mute ranges
      for (const w of muteRanges) {
        if (f >= w.startFrame && f < w.endFrame) return 0;
      }

      // Smooth ramp near mute edges (10 frames)
      const ramp = 10;
      for (const w of muteRanges) {
        if (f >= w.startFrame - ramp && f < w.startFrame) {
          return baseVolume * ((w.startFrame - f) / ramp);
        }
        if (f >= w.endFrame && f < w.endFrame + ramp) {
          return baseVolume * ((f - w.endFrame) / ramp);
        }
      }

      // Fade in/out
      if (f < 60) return baseVolume * (f / 60);
      if (f > durationInFrames - 30) {
        return baseVolume * ((durationInFrames - f) / 30);
      }

      return baseVolume;
    },
    [muteRanges, baseVolume, durationInFrames],
  );

  return (
    <Audio
      src={staticFile(ambientPath)}
      volume={volume}
      startFrom={0}
      loop
    />
  );
};
