import React from "react";
import { SceneFrame, StatDuel } from "../props";

// The same trade, two fees — the gap is the discount you never reach.
export const FeeTiers: React.FC = () => (
  <SceneFrame kicker="MECHANISM 02 / 13" title="The fee ladder">
    <StatDuel
      left={{ value: "10 bps", label: "You · top tier", tone: "bad" }}
      right={{ value: "2.3 bps", label: "Maker · VIP 9" }}
    />
  </SceneFrame>
);
