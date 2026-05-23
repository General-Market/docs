import React from "react";
import { SceneFrame, StatDuel } from "../props";

export const FeedLatency: React.FC = () => (
  <SceneFrame kicker="MECHANISM 07 / 13" title="The feed that arrives first">
    <StatDuel
      left={{ value: "Tick N", label: "Your feed", tone: "soft" }}
      right={{ value: "Tick N+1", label: "Their feed" }}
    />
  </SceneFrame>
);
