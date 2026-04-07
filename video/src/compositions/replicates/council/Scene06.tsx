import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from "remotion";
import { loadFont } from "@remotion/google-fonts/SpaceMono";

const { fontFamily } = loadFont();

const GPT_GREEN = "#10A37F";
const GEMINI_BLUE = "#4285F4";
const OPUS_ORANGE = "#E07B39";
const TEAL = "#4ECDC4";

const BG = "#F5F5F7";
const PANEL_BG = "#1A2332";
const PANEL_BORDER = "#2A3548";

interface RankEntry {
  rank: number;
  name: string;
  pct: string;
  trophy?: boolean;
}

const GPT_LIST: RankEntry[] = [
  { rank: 1, name: "BenYorke | Starchild", pct: "20%" },
  { rank: 2, name: "Otto AI - Trade Execution Agent", pct: "13%" },
  { rank: 3, name: "Argonaut AI", pct: "13%" },
  { rank: 4, name: "ButlerLiquid", pct: "10%" },
  { rank: 5, name: "TaXerClaw", pct: "10%" },
  { rank: 6, name: "Ethy AI", pct: "9%" },
  { rank: 7, name: "Pokedex", pct: "8%" },
  { rank: 8, name: "Miclaw Jordan", pct: "7%", trophy: true },
  { rank: 9, name: "Degent", pct: "5%" },
  { rank: 10, name: "CloudBant", pct: "5%" },
];

const GEMINI_LIST: RankEntry[] = [
  { rank: 1, name: "BenYorke | Starchild", pct: "20%" },
  { rank: 2, name: "Argonaut AI", pct: "15%" },
  { rank: 3, name: "Miclaw Jordan", pct: "15%", trophy: true },
  { rank: 4, name: "Captain Dackie", pct: "10%" },
  { rank: 5, name: "Ethy AI", pct: "10%" },
  { rank: 6, name: "DegenerateTrader", pct: "10%" },
  { rank: 7, name: "Degent", pct: "5%" },
  { rank: 8, name: "UFX", pct: "5%" },
  { rank: 9, name: "Fat Tiger", pct: "5%" },
  { rank: 10, name: "ProfitReaper", pct: "5%" },
];

const OPUS_LIST: RankEntry[] = [
  { rank: 1, name: "BenYorke | Starchild", pct: "20%" },
  { rank: 2, name: "ButlerLiquid", pct: "15%" },
  { rank: 3, name: "Otto AI - Trade Execution Agent", pct: "13%" },
  { rank: 4, name: "TaXerClaw", pct: "11%" },
  { rank: 5, name: "Argonaut AI", pct: "10%" },
  { rank: 6, name: "Pokedex", pct: "8%" },
  { rank: 7, name: "Ethy AI", pct: "7%" },
  { rank: 8, name: "Miclaw Jordan", pct: "6%", trophy: true },
  { rank: 9, name: "CloudBant", pct: "5%" },
  { rank: 10, name: "DegenerateTrader", pct: "5%" },
];

interface PanelConfig {
  label: string;
  color: string;
  list: RankEntry[];
  stagger: number;
}

const PANELS: PanelConfig[] = [
  {
    label: "GPT-5.4",
    color: GPT_GREEN,
    list: GPT_LIST,
    stagger: 0,
  },
  {
    label: "Gemini 3.1 Pro",
    color: GEMINI_BLUE,
    list: GEMINI_LIST,
    stagger: 4,
  },
  {
    label: "Claude Opus 4.6",
    color: OPUS_ORANGE,
    list: OPUS_LIST,
    stagger: 8,
  },
];

// Timing budget (222 frames total)
// 0-22:    panels spring in
// 22-90:   rows fill staggered
// 90-130:  section markers fade in (Overall Rationale +, Notable Exclusions +)
// 130-180: hold
// 180-200: overlay "Final leaderboard renders" fades in
// 200-222: hold + soft fade out into Scene07

const ROW_BASE = 22;
const ROW_STEP = 2;
const SECTION_START = 90;
const OVERLAY_IN_START = 180;

const Panel: React.FC<{
  config: PanelConfig;
  frame: number;
  fps: number;
}> = ({ config, frame, fps }) => {
  const { label, color, list, stagger } = config;

  // Card springs in
  const localFrame = Math.max(0, frame - stagger);
  const cardScale = spring({
    frame: localFrame,
    fps,
    from: 0.88,
    to: 1,
    durationInFrames: 22,
  });
  const cardOpacity = interpolate(frame, [stagger, stagger + 10], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Section markers fade in
  const sectionOpacity = interpolate(
    frame,
    [SECTION_START + stagger, SECTION_START + stagger + 14],
    [0, 1],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }
  );

  // Final fade out — soft, overlapping with overlay text
  const fadeOut = interpolate(frame, [205, 222], [1, 0.55], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        width: 240,
        backgroundColor: PANEL_BG,
        border: `1px solid ${color}`,
        borderRadius: 10,
        transform: `scale(${cardScale})`,
        opacity: cardOpacity * fadeOut,
        display: "flex",
        flexDirection: "column",
        padding: "14px 14px 12px",
        boxShadow: `0 4px 24px rgba(0,0,0,0.18)`,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 7,
          marginBottom: 10,
          paddingBottom: 8,
          borderBottom: `1px solid ${PANEL_BORDER}`,
        }}
      >
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            backgroundColor: color,
            flexShrink: 0,
          }}
        />
        <span
          style={{
            fontSize: 12,
            fontWeight: 700,
            color,
            fontFamily,
            whiteSpace: "nowrap",
          }}
        >
          {label}
        </span>
      </div>

      {/* Ranked list */}
      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        {list.map((entry, i) => {
          const rowStart = ROW_BASE + i * ROW_STEP + stagger;
          const rowOpacity = interpolate(
            frame,
            [rowStart, rowStart + 5],
            [0, 1],
            {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }
          );
          const rowY = spring({
            frame: Math.max(0, frame - rowStart),
            fps,
            from: 6,
            to: 0,
            durationInFrames: 12,
          });

          // Color-code percentages — high green, mid white, low dim
          const pctNum = parseInt(entry.pct, 10);
          const pctColor =
            pctNum >= 15 ? color : pctNum >= 10 ? "#FFFFFF" : "rgba(255,255,255,0.55)";

          return (
            <div
              key={entry.rank}
              style={{
                display: "flex",
                alignItems: "center",
                fontSize: 8,
                fontFamily,
                color: "#FFFFFF",
                opacity: rowOpacity,
                transform: `translateY(${rowY}px)`,
                lineHeight: "1.55",
              }}
            >
              <span
                style={{
                  opacity: 0.45,
                  marginRight: 6,
                  minWidth: 12,
                  textAlign: "right",
                }}
              >
                {entry.rank}.
              </span>
              <span
                style={{
                  flex: 1,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {entry.name}
                {entry.trophy ? " " : ""}
                {entry.trophy ? (
                  <span style={{ color: "#F5C518" }}>♦</span>
                ) : null}
              </span>
              <span
                style={{
                  color: pctColor,
                  marginLeft: 6,
                  flexShrink: 0,
                  fontWeight: pctNum >= 15 ? 700 : 500,
                }}
              >
                {entry.pct}
              </span>
            </div>
          );
        })}
      </div>

      {/* Section markers */}
      <div
        style={{
          marginTop: 12,
          opacity: sectionOpacity,
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            paddingTop: 8,
            borderTop: `1px solid ${PANEL_BORDER}`,
            fontSize: 9,
            fontFamily,
            color: "rgba(255,255,255,0.78)",
          }}
        >
          <span>Overall Rationale</span>
          <span style={{ color, fontWeight: 700 }}>+</span>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            paddingTop: 8,
            borderTop: `1px solid ${PANEL_BORDER}`,
            fontSize: 9,
            fontFamily,
            color: "rgba(255,255,255,0.78)",
          }}
        >
          <span>Notable Exclusions</span>
          <span style={{ color, fontWeight: 700 }}>+</span>
        </div>
      </div>
    </div>
  );
};

export const Scene06: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Overlay text "Final leaderboard renders"
  const overlayOpacity = interpolate(
    frame,
    [OVERLAY_IN_START, OVERLAY_IN_START + 14, 215, 222],
    [0, 1, 1, 0.6],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }
  );
  const overlayY = spring({
    frame: Math.max(0, frame - OVERLAY_IN_START),
    fps,
    from: 8,
    to: 0,
    durationInFrames: 16,
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: BG,
        justifyContent: "center",
        alignItems: "center",
        fontFamily,
      }}
    >
      {/* Overlay headline above panels */}
      <div
        style={{
          fontSize: 30,
          fontFamily,
          color: "#1A1A2E",
          opacity: overlayOpacity,
          transform: `translateY(${overlayY}px)`,
          marginBottom: 36,
          whiteSpace: "nowrap",
          letterSpacing: 0.5,
        }}
      >
        Final <span style={{ color: TEAL, fontWeight: 700 }}>leaderboard</span>{" "}
        renders
      </div>

      <div
        style={{
          display: "flex",
          gap: 24,
          justifyContent: "center",
          alignItems: "flex-start",
        }}
      >
        {PANELS.map((panel) => (
          <Panel key={panel.label} config={panel} frame={frame} fps={fps} />
        ))}
      </div>
    </AbsoluteFill>
  );
};

export const scene06Meta = {
  id: "Council-Scene06",
  component: Scene06,
  width: 1280,
  height: 720,
  fps: 30,
  durationInFrames: 222,
};
