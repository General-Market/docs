import React from "react";
import { SceneFrame, StatDuel } from "../props";

export const DealerFlowVisibility: React.FC = () => (
  <SceneFrame kicker="MECHANISM 05 / 13" title="Two views of one book">
    <StatDuel
      left={{ value: "1", label: "Orders you see", tone: "soft" }}
      right={{ value: "ALL", label: "Orders they see" }}
    />
  </SceneFrame>
);
