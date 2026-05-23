import React from "react";
import { SceneFrame, StatDuel } from "../props";

// Invisible per trade, fatal in aggregate.
export const SlowBleed: React.FC = () => (
  <SceneFrame kicker="MOTIF · THE TAX" title="A thousand small cuts">
    <StatDuel
      left={{ value: "-0.1 bps", label: "One trade" }}
      right={{ value: "-100 bps", label: "1,000 trades", tone: "bad" }}
    />
  </SceneFrame>
);
