import React from "react";
import { AbsoluteFill, Series } from "remotion";
import { FPS, H, W, colors } from "./theme";
import { antiCheatPitchHookMeta } from "./AntiCheatPitchHook";
import { antiCheatPitchStatMeta } from "./AntiCheatPitchStat";
import { antiCheatPitchRiggedMeta } from "./AntiCheatPitchRigged";
import { antiCheatPitchSolutionMeta } from "./AntiCheatPitchSolution";
import { antiCheatPitchReassureMeta } from "./AntiCheatPitchReassure";
import { antiCheatPitchEndCardMeta } from "./AntiCheatPitchEndCard";

// Six chapters, hard cuts, no transitions — like a deck advancing slide by slide.
const SCENES = [
  antiCheatPitchHookMeta,
  antiCheatPitchStatMeta,
  antiCheatPitchRiggedMeta,
  antiCheatPitchSolutionMeta,
  antiCheatPitchReassureMeta,
  antiCheatPitchEndCardMeta,
] as const;

const TOTAL_FRAMES = SCENES.reduce((sum, s) => sum + s.durationInFrames, 0);

export const AntiCheatPitchFull: React.FC = () => {
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

export const antiCheatPitchFullMeta = {
  id: "AntiCheatPitchFull",
  component: AntiCheatPitchFull,
  durationInFrames: TOTAL_FRAMES,
  fps: FPS,
  width: W,
  height: H,
};
