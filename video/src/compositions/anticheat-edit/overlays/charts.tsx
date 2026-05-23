import React from "react";
import { MechanismChart } from "./MechanismChart";
import { MECHANISMS } from "./data";

// The opening card — every bar live, the whole ranking at once.
export const MechanismsOverview: React.FC = () => <MechanismChart />;

// One thin wrapper per mechanism, highlighting its bar in the ranking.
// Keyed by slug so the video-overlay timeline can pull them by name.
export const MECHANISM_CHARTS: Record<string, React.FC> = Object.fromEntries(
  MECHANISMS.map((m) => [
    m.slug,
    function Chart() {
      return <MechanismChart highlightSlug={m.slug} />;
    },
  ]),
);
