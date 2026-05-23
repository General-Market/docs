import React from "react";
import { MechanismChart } from "./MechanismChart";
import { MECHANISMS } from "./data";

// The opening card — every bar live, the whole ranking at once.
export const MechanismsOverview: React.FC = () => <MechanismChart />;

// One thin wrapper per mechanism, highlighting its bar in the ranking.
// Keyed by slug so the timeline can pull them by name.
export const MECHANISM_CHARTS: Record<string, React.FC> = Object.fromEntries(
  MECHANISMS.map((m) => [
    m.slug,
    function Chart() {
      return <MechanismChart highlightSlug={m.slug} />;
    },
  ]),
);

// Standalone compositions so each chart can be previewed and re-cut on
// its own in the studio. 5s each.
export const chartMetas = [
  {
    id: "ACE-Chart-00-overview",
    component: MechanismsOverview,
    durationInFrames: 180,
    fps: 30,
    width: 1920,
    height: 1080,
  },
  ...MECHANISMS.map((m) => ({
    id: `ACE-Chart-${String(m.rank).padStart(2, "0")}-${m.slug}`,
    component: MECHANISM_CHARTS[m.slug],
    durationInFrames: 165,
    fps: 30,
    width: 1920,
    height: 1080,
  })),
];
