import React from "react";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { MechanismChart } from "./MechanismChart";
import { TitleSlide } from "./TitleSlide";
import { ExchangeBreakdown } from "./ExchangeBreakdown";
import { MECHANISMS } from "./data";

// Two standalone scene lines for the studio:
//
//   AntiCheatEditCharts — the overview card, then all thirteen mechanism
//     charts, back to back on one timeline with a short cross-fade.
//   AntiCheatEditTitles — one blue title card per mechanism, vertical
//     dot field, on its own timeline.
//
// Each slide owns a fresh frame-0, so its entrance animation re-fires.

const FPS = 30;
const W = 1920;
const H = 1080;

const CHART_FRAMES = Math.round(5.5 * FPS); // 165
const TITLE_FRAMES = Math.round(3 * FPS); // 90
const FADE = 12;

// ─── Charts scene line ──────────────────────────────────────────────────────

export const AntiCheatEditCharts: React.FC = () => {
  return (
    <TransitionSeries>
      <TransitionSeries.Sequence durationInFrames={CHART_FRAMES}>
        <MechanismChart />
      </TransitionSeries.Sequence>
      {MECHANISMS.flatMap((m) => [
        <TransitionSeries.Transition
          key={`t-${m.slug}`}
          presentation={fade()}
          timing={linearTiming({ durationInFrames: FADE })}
        />,
        <TransitionSeries.Sequence key={`s-${m.slug}`} durationInFrames={CHART_FRAMES}>
          <MechanismChart highlightSlug={m.slug} />
        </TransitionSeries.Sequence>,
      ])}
    </TransitionSeries>
  );
};

const CHARTS_TOTAL =
  CHART_FRAMES * (MECHANISMS.length + 1) - FADE * MECHANISMS.length;

// ─── Titles scene line ──────────────────────────────────────────────────────

export const AntiCheatEditTitles: React.FC = () => {
  return (
    <TransitionSeries>
      <TransitionSeries.Sequence durationInFrames={TITLE_FRAMES}>
        <TitleSlide kicker="Thirteen mechanisms" title="The thirteen edges" />
      </TransitionSeries.Sequence>
      {MECHANISMS.flatMap((m) => [
        <TransitionSeries.Transition
          key={`t-${m.slug}`}
          presentation={fade()}
          timing={linearTiming({ durationInFrames: FADE })}
        />,
        <TransitionSeries.Sequence key={`s-${m.slug}`} durationInFrames={TITLE_FRAMES}>
          <TitleSlide
            kicker={`Mechanism ${String(m.rank).padStart(2, "0")} / 13`}
            title={m.name}
            sub={m.fix}
          />
        </TransitionSeries.Sequence>,
      ])}
    </TransitionSeries>
  );
};

const TITLES_TOTAL =
  TITLE_FRAMES * (MECHANISMS.length + 1) - FADE * MECHANISMS.length;

// ─── Exchange-breakdown scene line ──────────────────────────────────────────
// One subdiagram per mechanism, same order as the charts, so an editor can
// lay this track beside the charts track and slide each breakdown to land
// right after its parent diagram.

export const AntiCheatEditSubcharts: React.FC = () => {
  return (
    <TransitionSeries>
      <TransitionSeries.Sequence durationInFrames={CHART_FRAMES}>
        <ExchangeBreakdown mechanismSlug={MECHANISMS[0].slug} />
      </TransitionSeries.Sequence>
      {MECHANISMS.slice(1).flatMap((m) => [
        <TransitionSeries.Transition
          key={`t-${m.slug}`}
          presentation={fade()}
          timing={linearTiming({ durationInFrames: FADE })}
        />,
        <TransitionSeries.Sequence key={`s-${m.slug}`} durationInFrames={CHART_FRAMES}>
          <ExchangeBreakdown mechanismSlug={m.slug} />
        </TransitionSeries.Sequence>,
      ])}
    </TransitionSeries>
  );
};

const SUBCHARTS_TOTAL =
  CHART_FRAMES * MECHANISMS.length - FADE * (MECHANISMS.length - 1);

// ─── Metas ────────────────────────────────────────────────────────────────

export const chartsSceneMeta = {
  id: "AntiCheatEditCharts",
  component: AntiCheatEditCharts,
  durationInFrames: CHARTS_TOTAL,
  fps: FPS,
  width: W,
  height: H,
};

export const titlesSceneMeta = {
  id: "AntiCheatEditTitles",
  component: AntiCheatEditTitles,
  durationInFrames: TITLES_TOTAL,
  fps: FPS,
  width: W,
  height: H,
};

export const subchartsSceneMeta = {
  id: "AntiCheatEditSubcharts",
  component: AntiCheatEditSubcharts,
  durationInFrames: SUBCHARTS_TOTAL,
  fps: FPS,
  width: W,
  height: H,
};
