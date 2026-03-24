import { useMemo } from "react";
import type { MusicAnalysis } from "../types";
import { secondsToFrame } from "../utils/frameConvert";

interface BeatSync {
  beatFrames: number[];
  isBeatFrame: (frame: number) => boolean;
  nearestBeatFrame: (frame: number, toleranceFrames?: number) => number | null;
}

export const useBeatSync = (analysis: MusicAnalysis | null, fps = 30): BeatSync => {
  const beatFrames = useMemo(() => {
    if (!analysis) return [];
    return analysis.beat_timestamps.map((t) => secondsToFrame(t, fps));
  }, [analysis, fps]);

  const beatSet = useMemo(() => new Set(beatFrames), [beatFrames]);

  const isBeatFrame = (frame: number): boolean => beatSet.has(frame);

  const nearestBeatFrame = (frame: number, toleranceFrames = 4): number | null => {
    let closest: number | null = null;
    let minDist = Infinity;
    for (const b of beatFrames) {
      const dist = Math.abs(b - frame);
      if (dist < minDist) {
        minDist = dist;
        closest = b;
      }
    }
    return closest !== null && minDist <= toleranceFrames ? closest : null;
  };

  return { beatFrames, isBeatFrame, nearestBeatFrame };
};
