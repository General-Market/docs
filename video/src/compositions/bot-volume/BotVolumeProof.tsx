import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { DataProofScreen } from "./DataProofScreen";
import { SCREENS, SCREEN_DUR } from "./screens";
import { FPS, H, W } from "../article-2/theme";
import { colors } from "../anticheat/theme";
import { DotGrid, DotGridVignette } from "../anticheat/DotGrid";
import { BrandMark } from "../../components/BrandMark";

/** All three data→proof screens, hard-cut back to back. */
export const BotVolumeProof: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: colors.bg }}>
    <DotGrid />
    <DotGridVignette intensity={0.22} />
    {SCREENS.map((screen, i) => (
      <Sequence key={screen.id} from={i * SCREEN_DUR} durationInFrames={SCREEN_DUR}>
        <DataProofScreen screen={screen} />
      </Sequence>
    ))}
    <BrandMark surface="light" />
  </AbsoluteFill>
);

const base = { width: W, height: H, fps: FPS };

export const botVolumeProofMeta = {
  id: "BotVolumeProof",
  component: BotVolumeProof,
  durationInFrames: SCREENS.length * SCREEN_DUR,
  ...base,
};

// Standalone segments — drop any one into a larger edit.
export const botVolumeScreenMetas = SCREENS.map((screen) => ({
  id: screen.id,
  component: () => (
    <AbsoluteFill style={{ backgroundColor: colors.bg }}>
      <DotGrid />
      <DotGridVignette intensity={0.22} />
      <DataProofScreen screen={screen} />
      <BrandMark surface="light" />
    </AbsoluteFill>
  ),
  durationInFrames: SCREEN_DUR,
  ...base,
}));
