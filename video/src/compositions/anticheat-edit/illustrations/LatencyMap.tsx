import React from "react";
import { SceneFrame, StatDuel } from "../props";

// Distance is a tax. You from Paris, the market maker from the same rack.
export const LatencyMap: React.FC = () => (
  <SceneFrame kicker="MOTIF · DISTANCE" title="Geography is a tax">
    <StatDuel
      left={{ value: "195 ms", label: "You · Paris → Tokyo", tone: "bad" }}
      right={{ value: "0 ms", label: "Maker · same rack" }}
    />
  </SceneFrame>
);
