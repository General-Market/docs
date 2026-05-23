import React from "react";
import { SceneFrame, StatDuel } from "../props";

export const CancelPriority: React.FC = () => (
  <SceneFrame kicker="MECHANISM 09 / 13" title="Pulling out first">
    <StatDuel
      left={{ value: "Filled", label: "Your order — hit", tone: "bad" }}
      right={{ value: "Cancelled", label: "Maker — in time" }}
    />
  </SceneFrame>
);
