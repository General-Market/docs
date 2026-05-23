import React from "react";
import { SceneFrame, StatDuel } from "../props";

export const QueuePriority: React.FC = () => (
  <SceneFrame kicker="MECHANISM 08 / 13" title="Cutting the line">
    <StatDuel
      left={{ value: "2nd", label: "You fill", tone: "bad" }}
      right={{ value: "1st", label: "Maker fills" }}
    />
  </SceneFrame>
);
