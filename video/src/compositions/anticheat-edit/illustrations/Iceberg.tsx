import React from "react";
import { SceneFrame, StatDuel } from "../props";

export const Iceberg: React.FC = () => (
  <SceneFrame kicker="ONLY WHAT WENT TO COURT" title="The part you can see">
    <StatDuel
      left={{ value: "1", label: "Case made public", tone: "soft" }}
      right={{ value: "100x", label: "Never surfaced", tone: "bad" }}
    />
  </SceneFrame>
);
