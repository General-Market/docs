import React from "react";
import { SceneFrame, StatDuel } from "../props";

export const OneVsTenThousand: React.FC = () => (
  <SceneFrame kicker="THE ANSWER" title="Who's best at ten thousand">
    <StatDuel
      left={{ value: "1", label: "Market · insiders win", tone: "bad" }}
      right={{ value: "10,000", label: "Markets · patterns win" }}
    />
  </SceneFrame>
);
