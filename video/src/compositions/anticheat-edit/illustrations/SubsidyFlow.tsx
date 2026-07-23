import React from "react";
import { SceneFrame, StatSolo } from "../props";

// The crowd pays; one desk collects.
export const SubsidyFlow: React.FC = () => (
  <SceneFrame title="The loser funds the winner">
    <StatSolo value="$100M+" caption="a year to the top makers — paid by your fees" />
  </SceneFrame>
);
