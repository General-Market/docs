import React from "react";
import { SceneFrame, StatDuel } from "../props";

// The edge that shows in the backtest and dies in the market.
export const BacktestVsLive: React.FC = () => (
  <SceneFrame kicker="MOTIF · THE GAP" title="The edge that vanishes">
    <StatDuel
      left={{ value: "+12%", label: "In backtest" }}
      right={{ value: "-3%", label: "Live", tone: "bad" }}
    />
  </SceneFrame>
);
