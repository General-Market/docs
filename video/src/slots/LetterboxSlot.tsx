import React from "react";
import type { ShotDef } from "./types";
import { LAYOUT } from "./types";
import { CinematicLetterbox } from "../shorts/short-01/components/CinematicLetterbox";

interface Props {
  shot: ShotDef;
}

export const LetterboxSlot: React.FC<Props> = ({ shot }) => {
  if (!shot.letterbox) return null;

  const durationFrames = Math.round(shot.durationSeconds * LAYOUT.FPS);

  if (typeof shot.letterbox === "boolean") {
    return <CinematicLetterbox durationFrames={durationFrames} />;
  }

  return (
    <CinematicLetterbox
      delay={shot.letterbox.delay}
      height={shot.letterbox.height}
      durationFrames={durationFrames}
    />
  );
};
