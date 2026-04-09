import React, { useMemo } from "react";
import {
  AbsoluteFill,
  Audio,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { font } from "../../../common/fonts";
import { FPS, BRAND_GREEN } from "../theme";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Position =
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right"
  | "mid-left"
  | "mid-right";

interface KeywordEntry {
  text: string;
  /** Seconds when the word is spoken */
  at: number;
  /** How long the pill stays visible (seconds) */
  hold?: number;
  position: Position;
  /** Font size in px */
  size?: number;
  /** Optional unicode icon prepended */
  icon?: string;
  /** Segments that should render in brand green */
  greenParts?: string[];
  /** If true, this is a repeat — no SFX */
  repeat?: boolean;
}

// ---------------------------------------------------------------------------
// Keyword definitions — timestamps from the user spec
// ---------------------------------------------------------------------------

const KEYWORDS: KeywordEntry[] = [
  // --- Hook / Intro ---
  { text: "PREDICTION MARKET", at: 13.36, position: "top-left", size: 32 },
  { text: "LIQUIDITY", at: 18.32, position: "top-right", size: 30 },
  { text: "CAPITAL LOCK", at: 19.28, position: "bottom-left", size: 28 },
  { text: "RISK MANAGEMENT", at: 20.32, position: "bottom-right", size: 28 },

  // --- Scale numbers ---
  { text: "500,000 MARKETS", at: 56.96, position: "top-left", size: 36, greenParts: ["500,000"] },
  { text: "5,000 STREAMERS", at: 60.88, position: "top-right", size: 34, greenParts: ["5,000"] },

  // --- Settlement / 10 minutes ---
  { text: "⏱ 10 MINUTES", at: 66.96, position: "bottom-right", size: 32, greenParts: ["10"] },
  { text: "⏱ 10 MINUTES", at: 92.64, position: "top-left", size: 30, repeat: true },
  { text: "⏱ 10 MINUTES", at: 107.04, position: "bottom-left", size: 30, repeat: true },
  { text: "⏱ 10 MINUTES", at: 115.2, position: "mid-right", size: 30, repeat: true },

  // --- Oracle ---
  { text: "ORACLE", at: 116.16, position: "top-right", size: 34 },
  { text: "ORACLE", at: 121.4, position: "bottom-left", size: 30, repeat: true },
  { text: "ORACLE", at: 179.56, position: "mid-left", size: 30, repeat: true },

  // --- Parimutuel ---
  { text: "NO PRICE", at: 128.84, position: "top-left", size: 32 },
  { text: "PARIMUTUEL", at: 132.84, position: "top-right", size: 34 },

  // --- Dollar comparison ---
  { text: "$1 vs $1,000,000", at: 154, position: "bottom-right", size: 34, greenParts: ["$1,000,000"] },

  // --- Privacy ---
  { text: "🔒 PRIVATE", at: 163.16, position: "top-left", size: 34 },

  // --- Scale ---
  { text: "1 BILLION", at: 174.2, position: "top-right", size: 36, greenParts: ["1 BILLION"] },
  { text: "1 BILLION", at: 266.24, position: "bottom-left", size: 34, greenParts: ["1 BILLION"], repeat: true },

  // --- Moat ---
  { text: "MOAT", at: 204, position: "mid-left", size: 36 },
  { text: "QUANTITY > QUALITY", at: 212.12, position: "top-right", size: 32 },

  // --- Era timeline ---
  { text: "1920s", at: 217, position: "bottom-left", size: 30, greenParts: ["1920s"] },
  { text: "1970s", at: 222, position: "bottom-right", size: 30, greenParts: ["1970s"] },
  { text: "2026", at: 227.68, position: "top-left", size: 34, greenParts: ["2026"] },

  // --- Source badges ---
  { text: "TRAIN", at: 255.36, position: "top-left", size: 30 },
  { text: "TWITCH", at: 256.88, position: "top-right", size: 30 },
  { text: "STEAM", at: 258.24, position: "bottom-left", size: 30 },
];

// ---------------------------------------------------------------------------
// Position mapping
// ---------------------------------------------------------------------------

const POSITION_STYLES: Record<Position, React.CSSProperties> = {
  "top-left": { top: 48, left: 48 },
  "top-right": { top: 48, right: 48 },
  "bottom-left": { bottom: 120, left: 48 },
  "bottom-right": { bottom: 120, right: 48 },
  "mid-left": { top: "40%", left: 48 },
  "mid-right": { top: "40%", right: 48 },
};

// ---------------------------------------------------------------------------
// Single keyword pill
// ---------------------------------------------------------------------------

const HOLD_DEFAULT = 2.5; // seconds
const FADE_OUT = 0.5; // seconds

const KeywordPill: React.FC<{
  entry: KeywordEntry;
}> = ({ entry }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const holdSec = entry.hold ?? HOLD_DEFAULT;
  const totalVisible = Math.round((holdSec + FADE_OUT) * fps);

  // Spring scale entrance
  const scaleSpring = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 180, mass: 0.8 },
    durationInFrames: 20,
  });
  const scale = interpolate(scaleSpring, [0, 1], [0.8, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Fade out near end
  const holdFrames = Math.round(holdSec * fps);
  const opacity = interpolate(
    frame,
    [0, 6, holdFrames, totalVisible],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  if (opacity <= 0) return null;

  const posStyle = POSITION_STYLES[entry.position];
  const fontSize = entry.size ?? 30;

  // Render text with optional green highlights
  const renderText = () => {
    if (!entry.greenParts || entry.greenParts.length === 0) {
      return (
        <span style={{ color: "#FAFAFA" }}>
          {entry.icon ? `${entry.icon} ` : ""}
          {entry.text}
        </span>
      );
    }

    let remaining = entry.text;
    const parts: React.ReactNode[] = [];

    for (const green of entry.greenParts) {
      const idx = remaining.indexOf(green);
      if (idx === -1) {
        continue;
      }
      if (idx > 0) {
        parts.push(
          <span key={`pre-${green}`} style={{ color: "#FAFAFA" }}>
            {remaining.slice(0, idx)}
          </span>,
        );
      }
      parts.push(
        <span key={`g-${green}`} style={{ color: BRAND_GREEN }}>
          {green}
        </span>,
      );
      remaining = remaining.slice(idx + green.length);
    }
    if (remaining.length > 0) {
      parts.push(
        <span key="tail" style={{ color: "#FAFAFA" }}>
          {remaining}
        </span>,
      );
    }
    return <>{parts}</>;
  };

  return (
    <div
      style={{
        position: "absolute",
        ...posStyle,
        opacity,
        transform: `scale(${scale})`,
        zIndex: 50,
      }}
    >
      <div
        style={{
          background: "rgba(10, 10, 10, 0.85)",
          borderRadius: 8,
          padding: "8px 16px",
          fontFamily: font,
          fontWeight: 800,
          fontSize,
          letterSpacing: "0.04em",
          textTransform: "uppercase",
          whiteSpace: "nowrap",
          display: "inline-block",
        }}
      >
        {renderText()}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Full-duration overlay
// ---------------------------------------------------------------------------

export const VoiceSyncKeywords: React.FC = () => {
  // Track which keyword texts have already appeared for SFX deduplication
  const sfxTriggerSet = useMemo(() => {
    const seen = new Set<string>();
    return KEYWORDS.map((kw) => {
      if (kw.repeat || seen.has(kw.text)) return false;
      seen.add(kw.text);
      return true;
    });
  }, []);

  return (
    <AbsoluteFill>
      {KEYWORDS.map((kw, i) => {
        const startFrame = Math.round(kw.at * FPS);
        const holdSec = kw.hold ?? HOLD_DEFAULT;
        const duration = Math.round((holdSec + FADE_OUT) * FPS) + 10; // extra buffer

        return (
          <Sequence key={`kw-${i}`} from={startFrame} durationInFrames={duration}>
            <KeywordPill entry={kw} />
            {sfxTriggerSet[i] && (
              <Audio
                src={staticFile("sfx/scroll-tick.mp3")}
                volume={0.3}
                startFrom={0}
              />
            )}
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
