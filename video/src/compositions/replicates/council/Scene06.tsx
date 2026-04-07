import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from "remotion";
import { loadFont } from "@remotion/google-fonts/SpaceMono";
import { AnimatedText, COUNCIL_DARK, COUNCIL_TEAL } from "./AnimatedText";

const { fontFamily } = loadFont();

const GPT_GREEN = "#10A37F";
const GEMINI_BLUE = "#4285F4";
const OPUS_ORANGE = "#E07B39";

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
  id: "gpt" | "gemini" | "opus";
  label: string;
  color: string;
  list: RankEntry[];
}

const PANELS: PanelConfig[] = [
  { id: "gpt", label: "GPT-5.4", color: GPT_GREEN, list: GPT_LIST },
  { id: "gemini", label: "Gemini 3.1 Pro", color: GEMINI_BLUE, list: GEMINI_LIST },
  { id: "opus", label: "Claude Opus 4.6", color: OPUS_ORANGE, list: OPUS_LIST },
];

// Timing budget — 70 frames total. The original is 2.3 seconds, no more.
// 0-12:  panels spring in side-by-side, all three at once
// 0-15:  "Final leaderboard renders" overlay fades in with the panels
// 12-25: rows fill in, fast staggered
// 25-35: "Overall Rationale +" / "Notable Exclusions +" sections appear
// 35-55: hold
// 55-65: GPT and Gemini fade out, Opus holds alone
// 65-70: Opus fades, hand-off to Scene07

const ROW_BASE = 12;
const ROW_STEP = 1;
const SECTION_START = 25;

const Panel: React.FC<{
  config: PanelConfig;
  frame: number;
  fps: number;
}> = ({ config, frame, fps }) => {
  const { id, label, color, list } = config;

  const cardScale = spring({
    frame,
    fps,
    from: 0.9,
    to: 1,
    durationInFrames: 12,
  });
  const cardOpacity = interpolate(frame, [0, 10], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const sectionOpacity = interpolate(
    frame,
    [SECTION_START, SECTION_START + 8],
    [0, 1],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }
  );

  // Staggered collapse — GPT and Gemini exit first, Opus lingers.
  const fadeOut =
    id === "opus"
      ? interpolate(frame, [65, 70], [1, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })
      : interpolate(frame, [55, 65], [1, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });

  return (
    <div
      style={{
        width: 130,
        backgroundColor: PANEL_BG,
        border: `1px solid ${color}`,
        borderRadius: 6,
        transform: `scale(${cardScale})`,
        opacity: cardOpacity * fadeOut,
        display: "flex",
        flexDirection: "column",
        padding: "8px 8px 7px",
        boxShadow: `0 3px 16px rgba(0,0,0,0.18)`,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 5,
          marginBottom: 6,
          paddingBottom: 5,
          borderBottom: `1px solid ${PANEL_BORDER}`,
        }}
      >
        <div
          style={{
            width: 5,
            height: 5,
            borderRadius: "50%",
            backgroundColor: color,
            flexShrink: 0,
          }}
        />
        <span
          style={{
            fontSize: 7,
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
      <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
        {list.map((entry, i) => {
          const rowStart = ROW_BASE + i * ROW_STEP;
          const rowOpacity = interpolate(
            frame,
            [rowStart, rowStart + 4],
            [0, 1],
            {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }
          );
          const rowY = spring({
            frame: Math.max(0, frame - rowStart),
            fps,
            from: 4,
            to: 0,
            durationInFrames: 8,
          });

          const pctNum = parseInt(entry.pct, 10);
          const pctColor =
            pctNum >= 15 ? color : pctNum >= 10 ? "#FFFFFF" : "rgba(255,255,255,0.55)";

          return (
            <div
              key={entry.rank}
              style={{
                display: "flex",
                alignItems: "center",
                fontSize: 5,
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
                  marginRight: 4,
                  minWidth: 8,
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
                  marginLeft: 4,
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
          marginTop: 7,
          opacity: sectionOpacity,
          display: "flex",
          flexDirection: "column",
          gap: 4,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            paddingTop: 5,
            borderTop: `1px solid ${PANEL_BORDER}`,
            fontSize: 6,
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
            paddingTop: 5,
            borderTop: `1px solid ${PANEL_BORDER}`,
            fontSize: 6,
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

  return (
    <AbsoluteFill
      style={{
        backgroundColor: BG,
        justifyContent: "center",
        alignItems: "center",
        fontFamily,
      }}
    >
      {/* Panels centered in the scene. */}
      <div
        style={{
          display: "flex",
          gap: 14,
          justifyContent: "center",
          alignItems: "flex-start",
        }}
      >
        {PANELS.map((panel) => (
          <Panel key={panel.id} config={panel} frame={frame} fps={fps} />
        ))}
      </div>

      {/*
        Overlay headline above the panels.
        Wrapper highlights TRAILING words — so with highlightLastN=2 both
        "leaderboard renders" read teal. The original painted only
        "leaderboard" teal; we accept the drift in exchange for one wrapper
        everywhere.
      */}
      <AnimatedText
        text="Final leaderboard renders"
        highlightLastN={2}
        startFrame={0}
        framesPerWord={5}
        fadeOutAt={55}
        fadeOutFrames={6}
        fontSize={22}
        color={COUNCIL_DARK}
        highlightColor={COUNCIL_TEAL}
        letterSpacing={0.5}
        style={{ inset: "auto", top: "15%", left: 0, right: 0, height: 40 }}
      />
    </AbsoluteFill>
  );
};

export const scene06Meta = {
  id: "Council-Scene06",
  component: Scene06,
  width: 1280,
  height: 720,
  fps: 30,
  durationInFrames: 70,
};
