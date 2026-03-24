import React from "react";
import type { ShotDef } from "./types";
import { ArchitectureDiagram } from "./components/ArchitectureDiagram";

interface Props {
  shot: ShotDef;
}

export const DiagramSlot: React.FC<Props> = ({ shot }) => {
  if (!shot.architectureDiagram) return null;

  return <ArchitectureDiagram config={shot.architectureDiagram} />;
};
