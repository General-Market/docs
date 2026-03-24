import React from "react";
import type { ShotDef } from "./types";
import { useSlotContext } from "./SlotContext";
import { ProjectShowcase } from "./components/ProjectShowcase";

interface Props {
  shot: ShotDef;
}

export const ShowcaseSlot: React.FC<Props> = ({ shot }) => {
  if (!shot.projectShowcase) return null;

  const { assetDir } = useSlotContext();

  return <ProjectShowcase assetDir={assetDir} instant={shot.isFirstShot} />;
};
