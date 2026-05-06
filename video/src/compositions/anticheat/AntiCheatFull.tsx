import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { FPS, H, W, colors } from "./theme";
import { antiCheatHookMeta } from "./AntiCheatHook";
import { antiCheatStatMeta, antiCheatBarsMeta } from "./AntiCheatStat";
import { antiCheatRiggedMeta } from "./AntiCheatRigged";
import { antiCheatSolutionMeta } from "./AntiCheatSolution";
import { antiCheatReassureMeta } from "./AntiCheatReassure";
import { antiCheatEndCardMeta } from "./AntiCheatEndCard";
import { LensPunch } from "./effects/LensPunch";
import { LiquidDistortion } from "./effects/LiquidDistortion";
import { HalftoneCollapse } from "./effects/HalftoneCollapse";
import { AnamorphicStreak } from "./effects/AnamorphicStreak";
import { PageTear } from "./effects/PageTear";
import { TapeRoll } from "./effects/TapeRoll";
import { InkBleed } from "./effects/InkBleed";

const SCENES = [
  antiCheatHookMeta,
  antiCheatBarsMeta,
  antiCheatRiggedMeta,
  antiCheatStatMeta,
  antiCheatSolutionMeta,
  antiCheatReassureMeta,
  antiCheatEndCardMeta,
] as const;

const SCENE_STARTS = SCENES.reduce<number[]>((acc, s, i) => {
  acc.push(i === 0 ? 0 : acc[i - 1] + SCENES[i - 1].durationInFrames);
  return acc;
}, []);

const TOTAL_FRAMES = SCENES.reduce(
  (sum, s) => sum + s.durationInFrames,
  0,
);

// LensPunch sits inside the Rigged Sequence, so its peakFrame is local
// to that sequence (frames 0..duration-1 of Rigged, not absolute).
const LENS_PUNCH_LOCAL_FRAME = Math.round(FPS * 0.25);

type CutEffect = (props: { startFrame: number }) => React.ReactElement;

// One transition vocabulary per cut, no repeats. Each component owns its
// timing window; we only feed it the absolute start frame.
const CUT_EFFECTS: Record<string, CutEffect> = {
  [antiCheatBarsMeta.id]: ({ startFrame }) => (
    <LiquidDistortion startFrame={startFrame} durationFrames={14} />
  ),
  [antiCheatRiggedMeta.id]: ({ startFrame }) => (
    <HalftoneCollapse startFrame={startFrame} durationFrames={16} cellSize={42} />
  ),
  [antiCheatStatMeta.id]: ({ startFrame }) => (
    <AnamorphicStreak startFrame={startFrame} durationFrames={12} yPercent={48} />
  ),
  [antiCheatSolutionMeta.id]: ({ startFrame }) => (
    <PageTear startFrame={startFrame} durationFrames={14} />
  ),
  [antiCheatReassureMeta.id]: ({ startFrame }) => (
    <TapeRoll startFrame={startFrame} durationFrames={16} bandHeightPx={200} />
  ),
  [antiCheatEndCardMeta.id]: ({ startFrame }) => (
    <InkBleed
      startFrame={startFrame}
      durationFrames={18}
      originX={50}
      originY={70}
    />
  ),
};

export const AntiCheatFull: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: colors.bg }}>
      {SCENES.map((scene, i) => {
        const Comp = scene.component;
        const startFrame = SCENE_STARTS[i];
        const isRigged = scene.id === antiCheatRiggedMeta.id;

        const sceneNode = isRigged ? (
          <LensPunch peakFrame={LENS_PUNCH_LOCAL_FRAME}>
            <Comp />
          </LensPunch>
        ) : (
          <Comp />
        );

        return (
          <Sequence
            key={scene.id}
            from={startFrame}
            durationInFrames={scene.durationInFrames}
            layout="none"
          >
            {sceneNode}
          </Sequence>
        );
      })}

      {/* Cut effects render at composition root so useCurrentFrame() inside
          each effect resolves to the absolute frame, not a sequence-local
          one. Each effect self-gates by checking startFrame against frame. */}
      {SCENES.slice(1).map((scene, i) => {
        const cutFrame = SCENE_STARTS[i + 1];
        const Effect = CUT_EFFECTS[scene.id];
        if (!Effect) return null;
        return <Effect key={`cut-${scene.id}`} startFrame={cutFrame} />;
      })}
    </AbsoluteFill>
  );
};

export const antiCheatFullMeta = {
  id: "AntiCheatFull",
  component: AntiCheatFull,
  durationInFrames: TOTAL_FRAMES,
  fps: FPS,
  width: W,
  height: H,
};
