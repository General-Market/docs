import React from "react";
import type { ShotDef } from "./types";
import { useSlotContext } from "./SlotContext";
import { BrollMosaic } from "./components/BrollMosaic";

interface Props {
  shot: ShotDef;
}

export const BrollSlot: React.FC<Props> = ({ shot }) => {
  if (!shot.brollMosaic) return null;

  const { assetDir } = useSlotContext();

  return (
    <BrollMosaic
      triggerFrame={shot.brollMosaic.triggerFrame}
      videos={shot.brollMosaic.videos}
      assetDir={assetDir}
    />
  );
};
