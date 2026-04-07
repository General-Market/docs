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
const DARK_BG = "#0B1426";
const CARD_BG = "#111C2E";
const GPT_GREEN = "#10A37F";
const GEMINI_BLUE = "#4285F4";
const OPUS_ORANGE = "#E07B39";
const TEAL = "#4ECDC4";
const MUTED = "#6B7B8D";
const ROW_HEIGHT = 32;

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

const DataRow: React.FC<{
  agent: AgentRow;
  frame: number;
  fps: number;
  enterFrame: number;
  expandProgress: number;
}> = ({ agent, frame, fps, enterFrame, expandProgress }) => {
  const slideX = spring({
    frame: frame - enterFrame,
    fps,
    from: 80,
    to: 0,
    config: { damping: 14, stiffness: 100, mass: 0.6 },
  });
  const rowOpacity = interpolate(frame, [enterFrame, enterFrame + 8], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const isFirst = agent.rank === 1;

  return (
    <div
      style={{
        opacity: frame >= enterFrame ? rowOpacity : 0,
        transform: `translateX(${frame >= enterFrame ? slideX : 80}px)`,
      }}
    >
      <div
        style={{
          display: "flex",
          gap: 0,
          height: ROW_HEIGHT,
          alignItems: "center",
          borderRadius: 6,
          paddingLeft: 4,
          paddingRight: 4,
          background: isFirst ? "rgba(78,205,196,0.06)" : "transparent",
          boxShadow: isFirst ? `0 0 20px rgba(78,205,196,0.08), inset 0 0 12px rgba(78,205,196,0.04)` : "none",
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

      {/* Expanded analysis cards for row #1 */}
      {isFirst && expandProgress > 0 && (
        <div
          style={{
            display: "flex",
            gap: 10,
            marginTop: 8,
            marginBottom: 8,
            overflow: "hidden",
            maxHeight: expandProgress * 100,
            opacity: expandProgress,
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
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                <div style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: card.color }} />
                <span style={{ fontSize: 11, fontWeight: 700, color: card.color, letterSpacing: 0.5 }}>
                  {card.label}
                </span>
              </div>
              <p style={{ fontSize: 10, color: "rgba(255,255,255,0.6)", lineHeight: 1.5, margin: 0 }}>
                {card.text}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Overlay schedule (120-frame budget):
//   0-30   leaderboard slides in
//   30-45  row #1 expands with analysis cards
//   45-65  overlay #1: "Each model's rationale displayed per agent"
//   65-80  overlay #2: "Why they scored high"
//   80-95  overlay #3: "Why they got flagged"
//   95-110 overlay #4: "Full transparency."
//  110-120 fade out
const OVERLAY_TEXTS: { text: string; start: number; end: number }[] = [
  { text: "Each model's rationale displayed per agent", start: 45, end: 65 },
  { text: "Why they scored high", start: 65, end: 80 },
  { text: "Why they got flagged", start: 80, end: 95 },
  { text: "Full transparency.", start: 95, end: 110 },
];

export const Scene04: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Title slide down (0-10)
  const titleY = interpolate(frame, [0, 10], [-30, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const titleOpacity = interpolate(frame, [0, 10], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Row stagger: each row 2 frames apart, starting at frame 10 — 10 rows in by frame 30
  const rowEnterFrame = (idx: number) => 10 + idx * 2;

  // Row #1 expansion (30-45)
  const expandProgress = interpolate(frame, [30, 45], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Active overlay
  const activeOverlay = OVERLAY_TEXTS.find((o) => frame >= o.start && frame < o.end);
  const overlayOpacity = activeOverlay
    ? interpolate(
        frame,
        [activeOverlay.start, activeOverlay.start + 4, activeOverlay.end - 4, activeOverlay.end],
        [0, 1, 1, 0],
        { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
      )
    : 0;
  const overlayBgOpacity = activeOverlay
    ? interpolate(
        frame,
        [activeOverlay.start, activeOverlay.start + 4, activeOverlay.end - 4, activeOverlay.end],
        [0, 0.78, 0.78, 0],
        { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
      )
    : 0;

  // Final fade out (110-120)
  const fadeOut = interpolate(frame, [110, 120], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#f0f2f5",
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
          backgroundColor: "#0B1426",
          borderRadius: 20,
          padding: "20px 24px",
          overflow: "hidden",
        }}
      >
        {/* Content container */}
        <div
          style={{
            width: 700,
            margin: "0 auto",
          }}
        >
          {/* Title */}
          <div
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: "#fff",
              textAlign: "center",
              marginBottom: 24,
              opacity: titleOpacity,
              transform: `translateY(${titleY}px)`,
            }}
          >
            AI Council Top 10
          </div>

          {/* Table */}
          <HeaderRow />
          <div style={{ marginTop: 6 }}>
            {AGENTS.map((agent, idx) => (
              <DataRow
                key={agent.rank}
                agent={agent}
                frame={frame}
                fps={fps}
                enterFrame={rowEnterFrame(idx)}
                expandProgress={agent.rank === 1 ? expandProgress : 0}
              />
            ))}
          </div>
        </div>

        {/* Overlay — single line, above leaderboard */}
        {activeOverlay && (
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: `rgba(11,20,38,${overlayBgOpacity})`,
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              borderRadius: 20,
              padding: "0 24px",
            }}
          >
            <span
              style={{
                fontSize: 22,
                fontWeight: 700,
                color: "#fff",
                opacity: overlayOpacity,
                letterSpacing: -0.4,
                whiteSpace: "nowrap",
                textAlign: "center",
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
  durationInFrames: 120,
};
