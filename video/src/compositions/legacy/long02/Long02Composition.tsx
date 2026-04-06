/**
 * Long02Composition — "AGI ARENA" wave/ribbon logo animation.
 *
 * Two words flow along interweaving 3D ribbon paths,
 * Bankless "BANK/LESS" style. White bg, red/brand fill text,
 * outlined rectangular cards trailing behind.
 *
 * Duration: ~8 seconds (240 frames at 30fps)
 */

import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
import { WaveTextRibbon } from "./WaveTextRibbon";

const FILL_COLOR = "#DC2626"; // bold red like the Bankless reference
const STROKE_COLOR = "rgba(180,40,40,0.30)";
const BG = "#fafafa";
const FPS = 30;
const DURATION_FRAMES = FPS * 8;

export const Long02Composition: React.FC = () => {
  const frame = useCurrentFrame();

  // Fade out last second
  const fadeOut = interpolate(
    frame,
    [DURATION_FRAMES - 30, DURATION_FRAMES],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  return (
    <AbsoluteFill style={{ backgroundColor: BG, overflow: "hidden", opacity: fadeOut }}>
      <WaveTextRibbon
        word1="AGI"
        word2="ARENA"
        fillColor={FILL_COLOR}
        strokeColor={STROKE_COLOR}
        copies={50}
        fontSize={130}
        amplitude={200}
        waveSpeed={0.035}
        fontFamily="'Inter', 'Helvetica Neue', Arial, sans-serif"
      />
    </AbsoluteFill>
  );
};

export const long02Meta = {
  id: "Long02",
  component: Long02Composition,
  durationInFrames: DURATION_FRAMES,
  fps: FPS as 30,
  width: 1920 as 1920,
  height: 1080 as 1080,
};
