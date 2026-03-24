import { useEffect, useState } from "react";
import {
  cancelRender,
  continueRender,
  delayRender,
  staticFile,
} from "remotion";
import type { MusicAnalysis } from "../types";
import { secondsToFrame } from "../utils/frameConvert";

interface MusicAnalysisResult {
  analysis: MusicAnalysis | null;
  getBeatFrames: () => number[];
  getEnergyPeakFrames: () => number[];
  getSyncPointFrames: () => number[];
}

export const useMusicAnalysis = (
  analysisPath: string,
  fps = 30,
): MusicAnalysisResult => {
  const [analysis, setAnalysis] = useState<MusicAnalysis | null>(null);
  const [handle] = useState(() => delayRender("Loading music analysis"));

  useEffect(() => {
    fetch(staticFile(analysisPath))
      .then((r) => r.json())
      .then((data: MusicAnalysis) => {
        setAnalysis(data);
        continueRender(handle);
      })
      .catch((err) => cancelRender(err));
  }, [analysisPath, handle]);

  const getBeatFrames = () =>
    analysis?.beat_timestamps.map((t) => secondsToFrame(t, fps)) ?? [];

  const getEnergyPeakFrames = () =>
    analysis?.energy_peaks.map((t) => secondsToFrame(t, fps)) ?? [];

  const getSyncPointFrames = () =>
    analysis?.sync_points.map((t) => secondsToFrame(t, fps)) ?? [];

  return { analysis, getBeatFrames, getEnergyPeakFrames, getSyncPointFrames };
};
