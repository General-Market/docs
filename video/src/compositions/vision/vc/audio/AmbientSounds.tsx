import React, { useCallback } from "react";
import { Audio, staticFile, useVideoConfig } from "remotion";

export type SceneType =
  | "db"
  | "mcdonalds"
  | "steam"
  | "twitch"
  | "fourchan"
  | "pumpfun"
  | "military"
  | "solar";

interface AmbientLayer {
  src: string;
  /** Per-layer volume — the scene's sonic fingerprint */
  mix: number;
}

const FADE_IN_FRAMES = 8;
const FADE_OUT_FRAMES = 5;

/**
 * Multi-layer ambient soundscapes.
 *
 * Each scene carries 3 layers at calibrated volumes:
 * a dominant texture, a mid-ground presence, and a subliminal detail.
 * The ear registers depth even when the mind does not.
 */
const SCENE_AMBIENT: Record<SceneType, AmbientLayer[]> = {
  // Train station — real railway station recording
  db: [
    { src: "compositions/vision-vc/sfx/railway-station.mp3", mix: 0.35 },
    { src: "sfx/crowd-murmur.mp3", mix: 0.04 },
  ],
  // McDonald's — real fast food ambience
  mcdonalds: [
    { src: "compositions/vision-vc/sfx/mcdonalds-ambience.mp3", mix: 0.35 },
    { src: "sfx/crowd-murmur.mp3", mix: 0.03 },
  ],
  // Gaming — real esports/gaming crowd
  steam: [
    { src: "compositions/vision-vc/sfx/gaming-crowd.mp3", mix: 0.35 },
    { src: "sfx/typing-keyboard.mp3", mix: 0.04 },
  ],
  // Twitch — real stream ambience with donation alerts
  twitch: [
    { src: "compositions/vision-vc/sfx/twitch-stream.mp3", mix: 0.35 },
    { src: "sfx/crowd-murmur.mp3", mix: 0.03 },
  ],
  // 4chan — real fast keyboard typing
  fourchan: [
    { src: "compositions/vision-vc/sfx/keyboard-typing-fast.mp3", mix: 0.35 },
    { src: "sfx/static-radio.mp3", mix: 0.03 },
    { src: "sfx/dramatic-suspense-drone.mp3", mix: 0.03 },
  ],
  // Trading anxiety — real crypto trading floor
  pumpfun: [
    { src: "compositions/vision-vc/sfx/crypto-trading.mp3", mix: 0.35 },
    { src: "sfx/heartbeat.mp3", mix: 0.04 },
  ],
  // Command center — real jet engine
  military: [
    { src: "compositions/vision-vc/sfx/jet-engine.mp3", mix: 0.35 },
    { src: "sfx/static-radio.mp3", mix: 0.04 },
  ],
  // Cosmic dread — real solar wind sonification
  solar: [
    { src: "compositions/vision-vc/sfx/solar-wind.mp3", mix: 0.35 },
    { src: "sfx/dramatic-suspense-drone.mp3", mix: 0.04 },
  ],
};

export interface AmbientSoundsProps {
  scene: SceneType;
  /** Master volume 0-1, default 0.15 — multiplied against each layer's mix */
  volume?: number;
}

export const AmbientSounds: React.FC<AmbientSoundsProps> = ({
  scene,
  volume = 0.15,
}) => {
  const { durationInFrames } = useVideoConfig();

  const layers = SCENE_AMBIENT[scene];

  const makeVolumeFn = useCallback(
    (mix: number) => {
      return (f: number) => {
        const base = volume * mix;

        // Fade in over first frames — presence arrives gradually
        if (f < FADE_IN_FRAMES) {
          return base * (f / FADE_IN_FRAMES);
        }

        // Fade out over final frames — presence departs faster than it came
        if (f > durationInFrames - FADE_OUT_FRAMES) {
          return base * Math.max(0, (durationInFrames - f) / FADE_OUT_FRAMES);
        }

        return base;
      };
    },
    [volume, durationInFrames],
  );

  return (
    <>
      {layers.map((layer) => (
        <Audio
          key={layer.src}
          src={staticFile(layer.src)}
          volume={makeVolumeFn(layer.mix)}
        />
      ))}
    </>
  );
};
