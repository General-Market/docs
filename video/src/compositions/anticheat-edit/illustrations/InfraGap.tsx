import React from "react";
import { SceneFrame, StatDuel } from "../props";

export const InfraGap: React.FC = () => (
  <SceneFrame kicker="THE PRICE OF THE EDGE" title="A million dollars of wires">
    <StatDuel
      left={{ value: "$0", label: "Your infra", tone: "soft" }}
      right={{ value: "$1M+", label: "Theirs", tone: "bad" }}
    />
  </SceneFrame>
);
