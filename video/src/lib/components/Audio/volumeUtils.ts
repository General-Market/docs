import type { Caption } from "../../types";
import { msToFrame } from "../../utils/frameConvert";

interface DuckingConfig {
  voiceVolume: number; // 0.14 when voice active
  gapVolume: number; // 0.35 in gaps
  rampFrames: number; // 10 frame smooth ramp
  fadeInFrames: number; // 30 frame fade-in
  fadeOutFrames: number; // 60 frame fade-out at end
}

const DEFAULT_DUCKING: DuckingConfig = {
  voiceVolume: 0.14,
  gapVolume: 0.35,
  rampFrames: 10,
  fadeInFrames: 30,
  fadeOutFrames: 60,
};

/**
 * Compute music volume at a given frame with voice-activity ducking.
 */
export const getMusicVolume = (
  frame: number,
  totalFrames: number,
  captions: Caption[],
  fps = 30,
  config: Partial<DuckingConfig> = {},
): number => {
  const c = { ...DEFAULT_DUCKING, ...config };

  // Check if voice is active at this frame (with a small buffer)
  const bufferMs = 100;
  let voiceActive = false;
  for (const cap of captions) {
    const start = msToFrame(cap.startMs - bufferMs, fps);
    const end = msToFrame(cap.endMs + bufferMs, fps);
    if (frame >= start && frame <= end) {
      voiceActive = true;
      break;
    }
  }

  const targetVol = voiceActive ? c.voiceVolume : c.gapVolume;

  // Apply fade envelope
  let envelope = 1;
  if (frame < c.fadeInFrames) {
    envelope = frame / c.fadeInFrames;
  } else if (frame > totalFrames - c.fadeOutFrames) {
    envelope = (totalFrames - frame) / c.fadeOutFrames;
  }

  return Math.max(0, targetVol * envelope);
};
