import type { Emotion } from "../../types";

export interface BackgroundPreset {
  particleCount: number;
  particleColor: string;
  shimmerTint: string;
  shimmerOpacity: number;
}

// IndexMaker DA — soft circles, brand-blue shimmer tint, restrained density
const presets: Record<Emotion, BackgroundPreset> = {
  neutral: {
    particleCount: 25,
    particleColor: "rgba(36,112,255,0.08)",
    shimmerTint: "rgba(36,112,255,0.02)",
    shimmerOpacity: 0.03,
  },
  excited: {
    particleCount: 35,
    particleColor: "rgba(62,220,235,0.12)",
    shimmerTint: "rgba(62,220,235,0.04)",
    shimmerOpacity: 0.05,
  },
  confused: {
    particleCount: 20,
    particleColor: "rgba(85,51,255,0.10)",
    shimmerTint: "rgba(85,51,255,0.03)",
    shimmerOpacity: 0.04,
  },
  panicking: {
    particleCount: 35,
    particleColor: "rgba(239,68,68,0.14)",
    shimmerTint: "rgba(239,68,68,0.04)",
    shimmerOpacity: 0.05,
  },
  happy: {
    particleCount: 30,
    particleColor: "rgba(165,254,202,0.10)",
    shimmerTint: "rgba(165,254,202,0.03)",
    shimmerOpacity: 0.04,
  },
  sad: {
    particleCount: 15,
    particleColor: "rgba(85,102,170,0.06)",
    shimmerTint: "rgba(85,102,170,0.02)",
    shimmerOpacity: 0.02,
  },
  angry: {
    particleCount: 35,
    particleColor: "rgba(255,34,68,0.16)",
    shimmerTint: "rgba(255,34,68,0.04)",
    shimmerOpacity: 0.05,
  },
};

export const getBackgroundPreset = (emotion: Emotion): BackgroundPreset =>
  presets[emotion];
