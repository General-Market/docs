import React from "react";
import type { ShotDef } from "./types";
import { useSlotContext } from "./SlotContext";
import { FloatingCryptoLogos } from "./components/FloatingCryptoLogos";

interface Props {
  shot: ShotDef;
}

export const LogosSlot: React.FC<Props> = ({ shot }) => {
  if (!shot.floatingLogos) return null;

  const { assetDir } = useSlotContext();

  return <FloatingCryptoLogos assetDir={assetDir} />;
};
