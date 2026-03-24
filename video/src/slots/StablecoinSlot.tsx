import React from "react";
import type { ShotDef } from "./types";
import { useSlotContext } from "./SlotContext";
import { StablecoinCards } from "./components/StablecoinCards";

interface Props {
  shot: ShotDef;
}

export const StablecoinSlot: React.FC<Props> = ({ shot }) => {
  if (!shot.stablecoinCards) return null;

  const { assetDir } = useSlotContext();

  return <StablecoinCards assetDir={assetDir} />;
};
