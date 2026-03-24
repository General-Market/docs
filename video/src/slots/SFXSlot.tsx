import React from "react";
import type { ShotDef } from "./types";
import { useSlotContext } from "./SlotContext";
import { SFXTrigger } from "../lib/components/Audio/SFXTrigger";
import type { SFXEvent } from "../lib/components/Audio/SFXTrigger";

interface Props {
  shot: ShotDef;
  globalFrameOffset: number;
}

export const SFXSlot: React.FC<Props> = ({ shot, globalFrameOffset }) => {
  if (!shot.sfx || shot.sfx.length === 0) return null;

  const { assetDir } = useSlotContext();
  const sfxDir = `${assetDir}/sfx`;

  const events: SFXEvent[] = shot.sfx.map((cue) => ({
    frame: cue.frame,
    file: cue.file,
    volume: cue.volume,
  }));

  return (
    <SFXTrigger
      sfxDir={sfxDir}
      events={events}
      globalFrameOffset={globalFrameOffset}
    />
  );
};
