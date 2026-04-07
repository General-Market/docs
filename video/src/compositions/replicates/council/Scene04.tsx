import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
} from "remotion";
import { loadFont } from "@remotion/google-fonts/SpaceMono";

const { fontFamily } = loadFont();
const DARK_BG = "#0B1426";
const CARD_BG = "#111C2E";
const GPT_GREEN = "#10A37F";
const GEMINI_BLUE = "#4285F4";
const OPUS_ORANGE = "#E07B39";
const TEAL = "#0FE8AE";
const TITLE_TEAL = "rgba(15,232,174,0.5)";
const MUTED = "#6B7B8D";
const ROW_HEIGHT = 30;

interface AgentRow {
  rank: number;
  name: string;
  gpt: string;
  gemini: string;
  opus: string;
  blend: string;
  allocation: string;
}

const AGENTS: AgentRow[] = [
  { rank: 1, name: "BenYorke | Starchild", gpt: "20%", gemini: "20%", opus: "20%", blend: "22.6%", allocation: "$22,641" },
  { rank: 2, name: "Argonaut AI", gpt: "13%", gemini: "15%", opus: "10%", blend: "14.3%", allocation: "$14,340" },
  { rank: 3, name: "Otto AI - Trade Exec", gpt: "15%", gemini: "—", opus: "14%", blend: "10.9%", allocation: "$10,943" },
  { rank: 4, name: "Miclaw Jordan", gpt: "7%", gemini: "15%", opus: "6%", blend: "10.6%", allocation: "$10,566" },
  { rank: 5, name: "Ethy AI", gpt: "8%", gemini: "10%", opus: "7%", blend: "9.4%", allocation: "$9,434" },
  { rank: 6, name: "ButlerLiquid", gpt: "10%", gemini: "—", opus: "15%", blend: "9.4%", allocation: "$9,434" },
  { rank: 7, name: "TaXerClaw", gpt: "10%", gemini: "—", opus: "11%", blend: "7.9%", allocation: "$7,925" },
  { rank: 8, name: "Pokedex", gpt: "7%", gemini: "—", opus: "8%", blend: "5.7%", allocation: "$5,660" },
  { rank: 9, name: "DegenerateTrader", gpt: "—", gemini: "10%", opus: "4%", blend: "5.3%", allocation: "$5,283" },
  { rank: 10, name: "DegenX", gpt: "5%", gemini: "5%", opus: "—", blend: "3.8%", allocation: "$3,774" },
];

const ANALYSIS_CARDS = [
  { color: GPT_GREEN, label: "GPT-5.4", text: "High conviction across all sectors. Overweight on DeFi protocols with strong TVL growth. Risk-adjusted Sharpe above 1.8." },
  { color: GEMINI_BLUE, label: "Gemini 3.1", text: "Consensus builder. Aligns with macro trends, hedges tail risk via options overlay. Conservative but consistent." },
  { color: OPUS_ORANGE, label: "Opus 4.6", text: "Contrarian positions on undervalued L2s. Identified mispricings 48h before market. Highest alpha but highest variance." },
];

const HEADERS = ["RANK", "AGENT", "GPT-5.4", "GEMINI 3.1", "OPUS 4.6", "BLEND", "ALLOCATION"];
const COL_WIDTHS = [50, 200, 75, 80, 75, 65, 90];

const HeaderRow: React.FC = () => (
  <div style={{ display: "flex", gap: 0, paddingBottom: 8, borderBottom: "1px solid rgba(107,123,141,0.2)" }}>
    {HEADERS.map((h, i) => (
      <div
        key={h}
        style={{
          width: COL_WIDTHS[i],
          fontSize: 9,
          color: MUTED,
          textTransform: "uppercase",
          letterSpacing: 1.2,
          fontWeight: 700,
          textAlign: i >= 2 ? "right" : "left",
        }}
      >
        {h}
      </div>
    ))}
  </div>
);

const CellValue: React.FC<{ value: string; color?: string }> = ({ value, color }) => {
  const isDash = value === "—";
  return (
    <span style={{ color: isDash ? "rgba(107,123,141,0.4)" : (color ?? "#fff"), fontWeight: isDash ? 400 : 600 }}>
      {value}
    </span>
  );
};

const DataRow: React.FC<{ agent: AgentRow }> = ({ agent }) => {
  const isFirst = agent.rank === 1;
  return (
    <div
      style={{
        display: "flex",
        gap: 0,
        height: ROW_HEIGHT,
        alignItems: "center",
        borderRadius: 6,
        paddingLeft: 4,
        paddingRight: 4,
        background: isFirst ? "rgba(15,232,174,0.06)" : "transparent",
        boxShadow: isFirst ? `0 0 20px rgba(15,232,174,0.08), inset 0 0 12px rgba(15,232,174,0.04)` : "none",
      }}
    >
      {/* Rank */}
      <div style={{ width: COL_WIDTHS[0], display: "flex", alignItems: "center" }}>
        <div
          style={{
            width: 24,
            height: 24,
            borderRadius: 12,
            backgroundColor: isFirst ? TEAL : "rgba(107,123,141,0.15)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 12,
            fontWeight: 700,
            color: isFirst ? DARK_BG : MUTED,
          }}
        >
          {agent.rank}
        </div>
      </div>
      {/* Name */}
      <div style={{ width: COL_WIDTHS[1], fontSize: 11, color: "#fff", fontWeight: isFirst ? 700 : 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {agent.name}
      </div>
      {/* GPT */}
      <div style={{ width: COL_WIDTHS[2], fontSize: 11, textAlign: "right" }}>
        <CellValue value={agent.gpt} color={GPT_GREEN} />
      </div>
      {/* Gemini */}
      <div style={{ width: COL_WIDTHS[3], fontSize: 11, textAlign: "right" }}>
        <CellValue value={agent.gemini} color={GEMINI_BLUE} />
      </div>
      {/* Opus */}
      <div style={{ width: COL_WIDTHS[4], fontSize: 11, textAlign: "right" }}>
        <CellValue value={agent.opus} color={OPUS_ORANGE} />
      </div>
      {/* Blend */}
      <div style={{ width: COL_WIDTHS[5], fontSize: 11, textAlign: "right", color: "#fff", fontWeight: 600 }}>
        {agent.blend}
      </div>
      {/* Allocation */}
      <div style={{ width: COL_WIDTHS[6], fontSize: 11, textAlign: "right" }}>
        <CellValue value={agent.allocation} color={GPT_GREEN} />
      </div>
    </div>
  );
};

// Scene04 — 220-frame budget (frames 0-219)
//   0-15    leaderboard fade in (no row stagger — all rows instant)
//   30-70   overlay #1: "Each model's rationale displayed per agent"
//   65      row #1 collapses; analysis cards appear in its place
//   70-110  overlay #2: "Why they scored high"
//  110-160  overlay #3: "Why they got flagged"
//  160-210  overlay #4: "Full transparency."
//  210-220  fade out
const OVERLAY_TEXTS: { text: string; start: number; end: number }[] = [
  { text: "Each model's rationale displayed per agent", start: 30, end: 70 },
  { text: "Why they scored high", start: 70, end: 110 },
  { text: "Why they got flagged", start: 110, end: 160 },
  { text: "Full transparency.", start: 160, end: 210 },
];

const EXPAND_FRAME = 65;

export const Scene04: React.FC = () => {
  const frame = useCurrentFrame();
  useVideoConfig();

  // Card + leaderboard fade in (0-15)
  const cardOpacity = interpolate(frame, [0, 15], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Row #1 expansion: appears at frame 65
  const expandProgress = interpolate(frame, [EXPAND_FRAME, EXPAND_FRAME + 10], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const expanded = frame >= EXPAND_FRAME;

  // Active overlay
  const activeOverlay = OVERLAY_TEXTS.find((o) => frame >= o.start && frame < o.end);
  const overlayOpacity = activeOverlay
    ? interpolate(
        frame,
        [activeOverlay.start, activeOverlay.start + 5, activeOverlay.end - 5, activeOverlay.end],
        [0, 1, 1, 0],
        { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
      )
    : 0;

  // Final fade out (210-220)
  const fadeOut = interpolate(frame, [210, 220], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Visible rows: when expanded, hide row #1
  const visibleRows = expanded ? AGENTS.slice(1) : AGENTS;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#FFFFFF",
        fontFamily,
        opacity: fadeOut,
      }}
    >
      {/* Dark card container */}
      <div
        style={{
          position: "absolute",
          top: "5%",
          left: "8%",
          width: "84%",
          height: "90%",
          backgroundColor: DARK_BG,
          borderRadius: 20,
          padding: "20px 24px",
          overflow: "hidden",
          opacity: cardOpacity,
        }}
      >
        {/* Title — small monospace, top-left, muted teal */}
        <div
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: TITLE_TEAL,
            textAlign: "left",
            letterSpacing: 0.5,
            marginBottom: 18,
          }}
        >
          AI Council Top 10
        </div>

        {/* Content container */}
        <div
          style={{
            width: 700,
            margin: "0 auto",
          }}
        >
          {/* Analysis cards — replace row #1 when expanded */}
          {expanded && (
            <div
              style={{
                display: "flex",
                gap: 10,
                marginBottom: 10,
                opacity: expandProgress,
                transform: `translateY(${(1 - expandProgress) * -6}px)`,
              }}
            >
              {ANALYSIS_CARDS.map((card) => (
                <div
                  key={card.label}
                  style={{
                    flex: 1,
                    backgroundColor: CARD_BG,
                    borderRadius: 8,
                    padding: "10px 12px",
                    border: "1px solid rgba(107,123,141,0.15)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                    <div style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: card.color }} />
                    <span style={{ fontSize: 10, fontWeight: 700, color: card.color, letterSpacing: 0.5 }}>
                      {card.label}
                    </span>
                  </div>
                  <p style={{ fontSize: 9, color: "rgba(255,255,255,0.6)", lineHeight: 1.5, margin: 0 }}>
                    {card.text}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* Header */}
          <HeaderRow />

          {/* Rows — instant entry, no stagger */}
          <div style={{ marginTop: 6 }}>
            {visibleRows.map((agent) => (
              <DataRow key={agent.rank} agent={agent} />
            ))}
          </div>
        </div>

        {/* Overlay text — NO backdrop, white on top of leaderboard */}
        {activeOverlay && (
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              padding: "0 24px",
              pointerEvents: "none",
            }}
          >
            <span
              style={{
                fontSize: 28,
                fontWeight: 700,
                color: "#FFFFFF",
                opacity: overlayOpacity,
                letterSpacing: -0.4,
                whiteSpace: "nowrap",
                textAlign: "center",
                fontFamily,
                textShadow: "0 2px 8px rgba(0,0,0,0.6)",
              }}
            >
              {activeOverlay.text}
            </span>
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};

export const scene04Meta = {
  id: "Council-Scene04",
  component: Scene04,
  width: 1280,
  height: 720,
  fps: 30,
  durationInFrames: 220,
};
