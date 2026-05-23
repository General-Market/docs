import React from "react";
import { SceneFrame, StatDuel } from "../props";

// A sliver of traders takes most of the pot.
export const ParetoSplit: React.FC = () => (
  <SceneFrame kicker="POLYMARKET" title="Where the winnings go">
    <StatDuel
      left={{ value: "0.04%", label: "of traders" }}
      right={{ value: "70%", label: "of the wins", tone: "bad" }}
    />
  </SceneFrame>
);
