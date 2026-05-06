import React from "react";
import { AbsoluteFill } from "remotion";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { FPS, H, W, colors } from "./theme";
import { antiCheatHookMeta } from "./AntiCheatHook";
import { antiCheatStatMeta, antiCheatBarsMeta } from "./AntiCheatStat";
import { antiCheatRiggedMeta } from "./AntiCheatRigged";
import { antiCheatSolutionMeta } from "./AntiCheatSolution";
import { antiCheatReassureMeta } from "./AntiCheatReassure";
import { antiCheatEndCardMeta } from "./AntiCheatEndCard";
import { LensPunch } from "./effects/LensPunch";
import { liquidBlend } from "./effects/transitions/liquidBlend";
import { halftoneBlend } from "./effects/transitions/halftoneBlend";

// Two transitions only — both inside the first 17s. Everything after
// hard-cuts as before.
const TRANSITION_FRAMES = 14;
const LENS_PUNCH_LOCAL_FRAME = Math.round(FPS * 0.25);

const SCENES = [
  antiCheatHookMeta,
  antiCheatBarsMeta,
  antiCheatRiggedMeta,
  antiCheatStatMeta,
  antiCheatSolutionMeta,
  antiCheatReassureMeta,
  antiCheatEndCardMeta,
] as const;

// In TransitionSeries, each transition consumes its duration from the
// adjacent sequences (overlap), so the total composition shrinks by
// transition_count × transition_duration.
const TOTAL_FRAMES =
  SCENES.reduce((sum, s) => sum + s.durationInFrames, 0) -
  2 * TRANSITION_FRAMES;

const AntiCheatRiggedWithLensPunch: React.FC = () => {
  const Comp = antiCheatRiggedMeta.component;
  return (
    <LensPunch peakFrame={LENS_PUNCH_LOCAL_FRAME}>
      <Comp />
    </LensPunch>
  );
};

export const AntiCheatFull: React.FC = () => {
  const Hook = antiCheatHookMeta.component;
  const Bars = antiCheatBarsMeta.component;
  const Stat = antiCheatStatMeta.component;
  const Solution = antiCheatSolutionMeta.component;
  const Reassure = antiCheatReassureMeta.component;
  const EndCard = antiCheatEndCardMeta.component;

  return (
    <AbsoluteFill style={{ backgroundColor: colors.bg }}>
      <TransitionSeries>
        <TransitionSeries.Sequence
          durationInFrames={antiCheatHookMeta.durationInFrames}
        >
          <Hook />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          timing={linearTiming({ durationInFrames: TRANSITION_FRAMES })}
          presentation={liquidBlend()}
        />

        <TransitionSeries.Sequence
          durationInFrames={antiCheatBarsMeta.durationInFrames}
        >
          <Bars />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          timing={linearTiming({ durationInFrames: TRANSITION_FRAMES })}
          presentation={halftoneBlend()}
        />

        <TransitionSeries.Sequence
          durationInFrames={antiCheatRiggedMeta.durationInFrames}
        >
          <AntiCheatRiggedWithLensPunch />
        </TransitionSeries.Sequence>

        <TransitionSeries.Sequence
          durationInFrames={antiCheatStatMeta.durationInFrames}
        >
          <Stat />
        </TransitionSeries.Sequence>

        <TransitionSeries.Sequence
          durationInFrames={antiCheatSolutionMeta.durationInFrames}
        >
          <Solution />
        </TransitionSeries.Sequence>

        <TransitionSeries.Sequence
          durationInFrames={antiCheatReassureMeta.durationInFrames}
        >
          <Reassure />
        </TransitionSeries.Sequence>

        <TransitionSeries.Sequence
          durationInFrames={antiCheatEndCardMeta.durationInFrames}
        >
          <EndCard />
        </TransitionSeries.Sequence>
      </TransitionSeries>
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
