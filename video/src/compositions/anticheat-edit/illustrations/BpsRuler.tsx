import React from "react";
import { SceneFrame, StatDuel } from "../props";

// When the fee floor sits above your edge, the strategy drowns.
export const BpsRuler: React.FC = () => (
  <SceneFrame kicker="MOTIF · UNDERWATER" title="When the floor eats the edge">
    <StatDuel
      left={{ value: "3 bps", label: "Your edge" }}
      right={{ value: "10 bps", label: "The fee floor", tone: "bad" }}
    />
  </SceneFrame>
);
