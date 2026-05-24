import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { font, monoFont } from "../../../common/fonts";
import { colors } from "../../anticheat/theme";
import { DotGrid, DotGridVignette } from "../../anticheat/DotGrid";
import { IdleZoom } from "../../anticheat/vibe";
import { VENUES } from "./logos";
import { TOPIC_BARS, type VenueBar } from "./venue-bars";

// A per-venue horizontal bar chart in the /anticheat-flags language — the
// "unfair matrix" rendered for the video. Each row is a venue: its brand logo
// as the label, a two-tone bar (faded = full edge, solid = the gated portion
// no rental can buy), and the value on the right. The General row sits at zero.
//
// Authored on a TALL canvas (CHART_W × CHART_H) that matches the side-panel's
// content-area aspect, so the rig's contain-scale fills the panel top to
// bottom — full height beside the 1/3 webcam, not a short letterboxed box.
// Chart components carry that native size as `panelSrcW/panelSrcH` statics so
// AntiCheatLayout scales them by the right aspect.

const ACCENT = colors.accent;
const FG = colors.fg;
const DIM = colors.dim;

// Matches the content area beside a 1/3 webcam (≈1118×952 → aspect 1.174).
export const CHART_W = 1180;
export const CHART_H = 1004;

const PAD_X = 72;
const PAD_TOP = 72;
const PAD_BOTTOM = 60;
const LABEL_W = 360;
const VALUE_W = 210;

export type LogoBarChartProps = {
  rows: VenueBar[];
  /** Short italic line under the General row — the payoff. */
  caption?: string;
};

export const LogoBarChart: React.FC<LogoBarChartProps> = ({ rows, caption }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const sorted = [...rows].sort((a, b) => b.full - a.full);
  const max = Math.max(...sorted.map((r) => r.full), 1);

  return (
    <AbsoluteFill style={{ backgroundColor: colors.bg, fontFamily: font }}>
      <IdleZoom durationInFrames={9999} from={1.0} to={1.02}>
        <DotGrid intensity={0.7} speed={0.9} />

        <div
          style={{
            position: "absolute",
            left: PAD_X,
            right: PAD_X,
            top: PAD_TOP,
            bottom: PAD_BOTTOM,
            display: "flex",
            flexDirection: "column",
          }}
        >
          {sorted.map((row, i) => {
            const local = frame - 8 - i * 2.5;
            const grow = spring({
              fps,
              frame: Math.max(0, local),
              config: { mass: 0.6, damping: 16, stiffness: 120 },
              durationInFrames: 26,
            });
            const op = interpolate(local, [0, 8], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            const fullPct = Math.max(row.full > 0 ? 2 : 0, (row.full / max) * 100);
            const solidPct = Math.max(row.solid > 0 ? 1.5 : 0, (row.solid / max) * 100);

            return (
              <div
                key={row.slug}
                style={{ flex: 1, display: "flex", alignItems: "center", opacity: op }}
              >
                <VenueLabel slug={row.slug} name={row.name} />
                <BarTrack fullPct={fullPct * grow} solidPct={solidPct * grow} />
                <BarValue top={row.valueTop} sub={row.valueSub} />
              </div>
            );
          })}

          {/* General baseline — zero edge, the chart's payoff */}
          <GeneralRow frame={frame} caption={caption} />
        </div>

        <DotGridVignette intensity={0.24} />
      </IdleZoom>
    </AbsoluteFill>
  );
};

const BarTrack: React.FC<{ fullPct: number; solidPct: number }> = ({
  fullPct,
  solidPct,
}) => {
  const H = 30;
  return (
    <div style={{ flex: 1, position: "relative", display: "flex", alignItems: "center" }}>
      <div
        style={{
          width: "100%",
          height: H,
          background: colors.surface,
          borderRadius: H / 3,
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 0,
            top: -4,
            bottom: -4,
            width: 0,
            borderLeft: `2px dashed color-mix(in srgb, ${DIM} 45%, transparent)`,
          }}
        />
        {fullPct > 0 ? (
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              bottom: 0,
              width: `${fullPct}%`,
              background: ACCENT,
              opacity: 0.3,
              borderRadius: H / 3,
            }}
          />
        ) : null}
        {solidPct > 0 ? (
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              bottom: 0,
              width: `${solidPct}%`,
              background: ACCENT,
              borderRadius: H / 3,
            }}
          />
        ) : null}
      </div>
    </div>
  );
};

const VenueLabel: React.FC<{ slug: string; name: string }> = ({ slug, name }) => {
  const v = VENUES[slug];
  return (
    <div
      style={{
        flex: `0 0 ${LABEL_W}px`,
        display: "flex",
        alignItems: "center",
        gap: 20,
        paddingRight: 26,
        minWidth: 0,
      }}
    >
      {v?.icon ? (
        <>
          <img
            src={staticFile(v.icon)}
            alt=""
            draggable={false}
            style={{ width: 50, height: 50, objectFit: "contain", flexShrink: 0 }}
          />
          <span
            style={{
              fontFamily: font,
              fontSize: 31,
              fontWeight: 700,
              letterSpacing: "-0.016em",
              color: FG,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {name}
          </span>
        </>
      ) : v?.wordmark ? (
        <img
          src={staticFile(v.wordmark)}
          alt=""
          draggable={false}
          style={{ height: 40, maxWidth: LABEL_W - 26, objectFit: "contain", display: "block" }}
        />
      ) : (
        <span
          style={{
            fontFamily: font,
            fontSize: 31,
            fontWeight: 700,
            letterSpacing: "-0.016em",
            color: FG,
          }}
        >
          {name}
        </span>
      )}
    </div>
  );
};

const BarValue: React.FC<{ top: string; sub: string }> = ({ top, sub }) => (
  <div style={{ flex: `0 0 ${VALUE_W}px`, textAlign: "right", whiteSpace: "nowrap", paddingLeft: 22 }}>
    <div
      style={{
        fontFamily: font,
        fontSize: 38,
        fontWeight: 800,
        letterSpacing: "-0.02em",
        color: ACCENT,
        fontVariantNumeric: "tabular-nums",
        lineHeight: 1.0,
      }}
    >
      {top}
    </div>
    {sub ? (
      <div
        style={{
          fontFamily: monoFont,
          fontSize: 20,
          fontWeight: 500,
          letterSpacing: "0.01em",
          color: DIM,
          marginTop: 4,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {sub}
      </div>
    ) : null}
  </div>
);

const GeneralRow: React.FC<{ frame: number; caption?: string }> = ({ frame, caption }) => {
  const op = interpolate(frame, [22, 36], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", opacity: op }}>
      <div style={{ display: "flex", alignItems: "center" }}>
        <div
          style={{
            flex: `0 0 ${LABEL_W}px`,
            display: "flex",
            alignItems: "center",
            gap: 18,
            paddingRight: 26,
          }}
        >
          <div style={{ width: 38, height: 38, borderRadius: 9, background: ACCENT, flexShrink: 0 }} />
          <span
            style={{
              fontFamily: font,
              fontSize: 31,
              fontWeight: 800,
              letterSpacing: "-0.016em",
              color: FG,
            }}
          >
            General
          </span>
        </div>
        <div style={{ flex: 1, display: "flex", alignItems: "center" }}>
          <div
            style={{
              width: "100%",
              height: 30,
              background: colors.surface,
              borderRadius: 10,
              position: "relative",
            }}
          >
            <div
              style={{
                position: "absolute",
                left: 0,
                top: -4,
                bottom: -4,
                width: 0,
                borderLeft: `2px dashed color-mix(in srgb, ${DIM} 45%, transparent)`,
              }}
            />
          </div>
        </div>
        <div
          style={{
            flex: `0 0 ${VALUE_W}px`,
            textAlign: "right",
            paddingLeft: 22,
            fontFamily: font,
            fontSize: 38,
            fontWeight: 800,
            letterSpacing: "-0.02em",
            color: DIM,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          0
        </div>
      </div>
      {caption ? (
        <div
          style={{
            paddingLeft: LABEL_W,
            marginTop: 8,
            fontFamily: monoFont,
            fontSize: 18,
            fontWeight: 500,
            letterSpacing: "0.01em",
            color: colors.fgSoft,
            fontStyle: "italic",
            lineHeight: 1.3,
          }}
        >
          {caption}
        </div>
      ) : null}
    </div>
  );
};

// A chart component tagged with the native canvas the rig should scale from.
type PanelChart = React.FC & { panelSrcW?: number; panelSrcH?: number };

const tagPanel = (C: React.FC): PanelChart => {
  const T = C as PanelChart;
  T.panelSrcW = CHART_W;
  T.panelSrcH = CHART_H;
  return T;
};

// ── Topic charts ─────────────────────────────────────────────────────────────
//
// One tagged chart per /anticheat-flags topic, keyed by the video mechanism
// slug. The timeline pulls these by slug for each mechanism's subchart beat.

export function topicChart(key: string): PanelChart {
  return tagPanel(function TopicChart() {
    const topic = TOPIC_BARS[key];
    if (!topic) return null;
    return <LogoBarChart rows={topic.rows} caption={topic.caption} />;
  });
}
