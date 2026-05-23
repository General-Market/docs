import React from "react";
import { SceneFrame, StatDuel } from "../props";

export const MakerRebates: React.FC = () => (
  <SceneFrame kicker="MECHANISM 12 / 13" title="Paid to win">
    <StatDuel
      left={{ value: "-$3", label: "Your P&L", tone: "bad" }}
      right={{ value: "+$2", label: "Their P&L · same trade" }}
    />
  </SceneFrame>
);
