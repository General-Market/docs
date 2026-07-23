import React from "react";
import { SceneFrame, StatDuel } from "../props";

export const MaxingOut: React.FC = () => (
  <SceneFrame title="Paying for the edge">
    <StatDuel
      left={{ value: "$0", label: "You spend", tone: "soft" }}
      right={{ value: "$100M", label: "They spend", tone: "bad" }}
    />
  </SceneFrame>
);
