import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from "remotion";
import { AnimatedText, COUNCIL_TITLE_FONT_SIZE } from "./AnimatedText";
import { GM_BRAND, GM_DARK_BG, GM_DARK_CARD, GM_MONO_FONT } from "./gmTheme";

const fontFamily = GM_MONO_FONT;
const DARK_BG = GM_DARK_BG;
const CARD_BG = GM_DARK_CARD;
const GPT_GREEN = "#10A37F";
const GEMINI_BLUE = "#4285F4";
const OPUS_ORANGE = "#E07B39";
const TEAL = GM_BRAND;
const TITLE_TEAL = "rgba(0,163,108,0.6)";
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
        background: isFirst ? "rgba(0,163,108,0.06)" : "transparent",
        boxShadow: isFirst ? `0 0 20px rgba(0,163,108,0.08), inset 0 0 12px rgba(0,163,108,0.04)` : "none",
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
//  160-220  overlay #4: "Full transparency."
//  210-220  fade out
const EXPAND_FRAME = 65;

const OVERLAY_TEXT_SHADOW: React.CSSProperties = {
  textShadow: "0 2px 8px rgba(0,0,0,0.6)",
};

export const Scene04: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Card slide-in (0-15) — mirrors AnimatedText word entry: rises from below + fades in.
  const cardEnterProgress = spring({
    frame,
    fps,
    config: { damping: 22, stiffness: 120, mass: 0.8, overshootClamping: true },
    durationInFrames: 14,
  });
  const cardTranslateY = (1 - cardEnterProgress) * 60;
  const cardOpacity = cardEnterProgress;

  // Row #1 expansion: appears at frame 65
  const expandProgress = interpolate(frame, [EXPAND_FRAME, EXPAND_FRAME + 10], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const expanded = frame >= EXPAND_FRAME;

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
      {/* Dark card container — slides in from below, like text reveals */}
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
          transform: `translateY(${cardTranslateY}px)`,
          willChange: "transform, opacity",
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
      </div>

      {/*
        Overlay texts live OUTSIDE the sliding card so the slide-in transition
        only moves the leaderboard. Overlays appear later (frames 30+), once
        the card has settled, and rest on top of it without sliding themselves.
      */}
      <AnimatedText
        text="Each model's rationale displayed per agent"
        startFrame={30}
        fadeOutAt={62}
        fontSize={COUNCIL_TITLE_FONT_SIZE}
        color="#FFFFFF"
        highlightColor="#FFFFFF"
        highlightLastN={0}
        style={OVERLAY_TEXT_SHADOW}
      />
      <AnimatedText
        text="Why they scored high"
        startFrame={70}
        fadeOutAt={102}
        fontSize={COUNCIL_TITLE_FONT_SIZE}
        color="#FFFFFF"
        highlightColor="#FFFFFF"
        highlightLastN={0}
        style={OVERLAY_TEXT_SHADOW}
      />
      <AnimatedText
        text="Why they got flagged"
        startFrame={110}
        fadeOutAt={152}
        fontSize={COUNCIL_TITLE_FONT_SIZE}
        color="#FFFFFF"
        highlightColor="#FFFFFF"
        highlightLastN={0}
        style={OVERLAY_TEXT_SHADOW}
      />
      <AnimatedText
        text="Full transparency."
        startFrame={160}
        fadeOutAt={212}
        fontSize={COUNCIL_TITLE_FONT_SIZE}
        color="#FFFFFF"
        highlightColor="#FFFFFF"
        highlightLastN={0}
        style={OVERLAY_TEXT_SHADOW}
      />
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
