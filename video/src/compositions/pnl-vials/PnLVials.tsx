import React from "react";
import { AbsoluteFill, Sequence, useCurrentFrame } from "remotion";
import { FPS, H, SCENE_FRAMES, TOTAL_FRAMES, W } from "./theme";
import { SCENES } from "./scenes";
import { SceneLabel } from "./shared";

// Compilation: 20 scenes, 4s each, with persistent lower-third label.
export const PnLVials: React.FC = () => {
  const frame = useCurrentFrame();
  const idx = Math.min(SCENES.length - 1, Math.floor(frame / SCENE_FRAMES));
  const scene = SCENES[idx];

  return (
    <AbsoluteFill style={{ background: "#000" }}>
      {SCENES.map((s, i) => (
        <Sequence
          key={s.id}
          from={i * SCENE_FRAMES}
          durationInFrames={SCENE_FRAMES}
          layout="none"
        >
          <s.component />
        </Sequence>
      ))}
      <SceneLabel idx={idx + 1} title={scene.title} />
    </AbsoluteFill>
  );
};

export const pnlVialsMeta = {
  id: "PnLVials",
  component: PnLVials,
  durationInFrames: TOTAL_FRAMES,
  fps: FPS,
  width: W,
  height: H,
};

// Per-scene metas so each proposition can be previewed and rendered alone.
export const pnlVialSceneMetas = SCENES.map((s, i) => ({
  id: `PnLVials-${String(i + 1).padStart(2, "0")}-${s.id}`,
  component: () => (
    <>
      <s.component />
      <SceneLabel idx={i + 1} title={s.title} />
    </>
  ),
  durationInFrames: SCENE_FRAMES,
  fps: FPS,
  width: W,
  height: H,
}));
