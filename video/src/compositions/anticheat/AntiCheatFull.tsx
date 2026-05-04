import React from "react";
import { AbsoluteFill, Series } from "remotion";
import { FPS, H, W, colors, toFrames } from "./theme";
import { antiCheatHookMeta } from "./AntiCheatHook";
import { antiCheatStatMeta } from "./AntiCheatStat";
import { antiCheatRiggedMeta } from "./AntiCheatRigged";
import { antiCheatSolutionMeta } from "./AntiCheatSolution";
import { antiCheatReassureMeta } from "./AntiCheatReassure";
import { antiCheatEndCardMeta } from "./AntiCheatEndCard";

const TOTAL_SECONDS = 60;

// The chain. Hook (12s) + Stat (10s) + Rigged (12s) + Solution (8s) +
// Reassure (8s) + EndCard (10s) = 60s. The Series component places each
// scene's local frame 0 at the start of its slot, so each composition
// runs against its own clock.
const SCENES = [
  antiCheatHookMeta,
  antiCheatStatMeta,
  antiCheatRiggedMeta,
  antiCheatSolutionMeta,
  antiCheatReassureMeta,
  antiCheatEndCardMeta,
] as const;

export const AntiCheatFull: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: colors.bg }}>
      <Series>
        {SCENES.map((scene) => {
          const Comp = scene.component;
          return (
            <Series.Sequence
              key={scene.id}
              durationInFrames={scene.durationInFrames}
            >
              <Comp />
            </Series.Sequence>
          );
        })}
      </Series>
    </AbsoluteFill>
  );
};

export const antiCheatFullMeta = {
  id: "AntiCheatFull",
  component: AntiCheatFull,
  durationInFrames: toFrames(TOTAL_SECONDS),
  fps: FPS,
  width: W,
  height: H,
};
