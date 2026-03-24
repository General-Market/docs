// TEMPLATE — Copy /src/shorts/_template/ to /src/shorts/your-short/
// Then: replace __TEMPLATE__ with your short ID

import React, { useCallback } from "react";
import { Audio, staticFile, useVideoConfig } from "remotion";
import type { SilenceWindow } from "../types";

interface Props {
  ambientPath: string;
  muteRanges: SilenceWindow[];
  baseVolume?: number;
}

export const Ambient: React.FC<Props> = ({
  ambientPath,
  muteRanges,
  baseVolume = 0.03,
}) => {
  const { durationInFrames } = useVideoConfig();

  const volume = useCallback(
    (f: number) => {
      for (const w of muteRanges) {
        if (f >= w.startFrame && f < w.endFrame) return 0;
      }

      const ramp = 10;
      for (const w of muteRanges) {
        if (f >= w.startFrame - ramp && f < w.startFrame) {
          return baseVolume * ((w.startFrame - f) / ramp);
        }
        if (f >= w.endFrame && f < w.endFrame + ramp) {
          return baseVolume * ((f - w.endFrame) / ramp);
        }
      }

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
