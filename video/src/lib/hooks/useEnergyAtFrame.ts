import { useMemo } from "react";
import type { MusicAnalysis } from "../types";
import { frameToSeconds } from "../utils/frameConvert";

export const useEnergyAtFrame = (analysis: MusicAnalysis | null, fps = 30) => {
  const curve = useMemo(() => analysis?.energy_curve ?? [], [analysis]);

  const getEnergy = (frame: number): number => {
    if (curve.length === 0) return 0.5;
    const t = frameToSeconds(frame, fps);
    // Find surrounding points and interpolate
    let lo = 0;
    let hi = curve.length - 1;
    if (t <= curve[lo].time) return curve[lo].energy;
    if (t >= curve[hi].time) return curve[hi].energy;
    for (let i = 0; i < curve.length - 1; i++) {
      if (t >= curve[i].time && t <= curve[i + 1].time) {
        lo = i;
        hi = i + 1;
        break;
      }
    }
    const ratio =
      (t - curve[lo].time) / (curve[hi].time - curve[lo].time || 1);
    return curve[lo].energy + ratio * (curve[hi].energy - curve[lo].energy);
  };

  return { getEnergy };
};
