"use client";

import dynamic from "next/dynamic";

const Placeholder = ({ h = "300px" }: { h?: string }) => (
  <div
    className="border border-border-light bg-surface/50 animate-pulse"
    style={{ height: h }}
  />
);

export const FoundersStats = dynamic(
  () => import("./FoundersStats").then((m) => m.FoundersStats),
  { ssr: false, loading: () => <Placeholder h="140px" /> }
);

export const FoundersAgeTimeline = dynamic(
  () => import("./FoundersAgeTimeline").then((m) => m.FoundersAgeTimeline),
  { ssr: false, loading: () => <Placeholder h="400px" /> }
);

export const TGEAgePerformance = dynamic(
  () => import("./TGEPerformanceBars").then((m) => m.TGEAgePerformance),
  { ssr: false, loading: () => <Placeholder h="320px" /> }
);

export const TeamCompPerformanceGrid = dynamic(
  () =>
    import("./TeamCompPerformance").then((m) => m.TeamCompPerformanceGrid),
  { ssr: false, loading: () => <Placeholder h="500px" /> }
);

export const TeamGenderPerformance = dynamic(
  () =>
    import("./TeamCompPerformance").then((m) => m.TeamGenderPerformance),
  { ssr: false, loading: () => <Placeholder h="240px" /> }
);

export const TeamNatPerformance = dynamic(
  () =>
    import("./TeamCompPerformance").then((m) => m.TeamNatPerformance),
  { ssr: false, loading: () => <Placeholder h="240px" /> }
);

export const TeamAgeSpreadPerformance = dynamic(
  () =>
    import("./TeamCompPerformance").then((m) => m.TeamAgeSpreadPerformance),
  { ssr: false, loading: () => <Placeholder h="240px" /> }
);

export const TeamEduPerformance = dynamic(
  () =>
    import("./TeamCompPerformance").then((m) => m.TeamEduPerformance),
  { ssr: false, loading: () => <Placeholder h="240px" /> }
);
