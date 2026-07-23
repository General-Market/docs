import React from "react";
import { SceneFrame, StatDuel } from "../props";

export const Colocation: React.FC = () => (
  <SceneFrame title="Colocation">
    <StatDuel
      left={{ value: "10,000 km", label: "You · across the world", tone: "bad" }}
      right={{ value: "0.5 m", label: "Maker · same rack" }}
    />
  </SceneFrame>
);
