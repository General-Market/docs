import React from "react";
import { SceneFrame, StatSolo } from "../props";

export const BatchPool: React.FC = () => (
  <SceneFrame title="Everyone in one pool">
    <StatSolo value="10,000" caption="assets, one pool, everyone together" />
  </SceneFrame>
);
