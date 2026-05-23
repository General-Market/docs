import React from "react";
import { SceneFrame, StatDuel } from "../props";

export const OrderFlowPfof: React.FC = () => (
  <SceneFrame kicker="MECHANISM 06 / 13" title="The zero-fee trap">
    <StatDuel
      left={{ value: "0%", label: "The fee they show" }}
      right={{ value: "+$0.09", label: "The spread they hide", tone: "bad" }}
    />
  </SceneFrame>
);
