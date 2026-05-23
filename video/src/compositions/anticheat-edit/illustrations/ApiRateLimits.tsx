import React from "react";
import { SceneFrame, StatDuel } from "../props";

export const ApiRateLimits: React.FC = () => (
  <SceneFrame kicker="MECHANISM 10 / 13" title="More calls, more sight">
    <StatDuel
      left={{ value: "10 / s", label: "Your limit", tone: "bad" }}
      right={{ value: "Unlimited", label: "Theirs" }}
    />
  </SceneFrame>
);
