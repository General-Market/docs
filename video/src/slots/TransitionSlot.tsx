import React from "react";
import type { ShotDef } from "./types";
import { ShotTransition } from "../shorts/short-01/components/ShotTransition";

interface Props {
  shot: ShotDef;
}

export const TransitionSlot: React.FC<Props> = ({ shot }) => {
  if (!shot.transitionIn || shot.transitionIn === "cut") return null;

  return (
    <ShotTransition
      type={shot.transitionIn}
      durationFrames={shot.transitionDuration ?? 9}
    />
  );
};
