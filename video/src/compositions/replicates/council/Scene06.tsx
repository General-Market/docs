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
const GEMINI_BLUE = "#4285F4";
const OPUS_ORANGE = "#E07B39";

const BG = "#F5F5F7";

interface RankEntry {
  rank: number;
  name: string;
  pct: string;
}

const GEMINI_LIST: RankEntry[] = [
  { rank: 1, name: "BenYorke | Starchild", pct: "20%" },
  { rank: 2, name: "Argonaut AI", pct: "15%" },
  { rank: 3, name: "Miclaw Jordan", pct: "15%" },
  { rank: 4, name: "Captain Dackie", pct: "10%" },
  { rank: 5, name: "Ethy AI", pct: "10%" },
  { rank: 6, name: "DegenerateTrader", pct: "10%" },
  { rank: 7, name: "DegenX", pct: "5%" },
  { rank: 8, name: "UFX", pct: "5%" },
  { rank: 9, name: "Fat Tiger", pct: "5%" },
  { rank: 10, name: "ProfitReaper", pct: "5%" },
];

const OPUS_LIST: RankEntry[] = [
  { rank: 1, name: "BenYorke | Starchild", pct: "20%" },
  { rank: 2, name: "ButlerLiquid", pct: "15%" },
  { rank: 3, name: "Otto AI", pct: "14%" },
  { rank: 4, name: "TaXerClaw", pct: "11%" },
  { rank: 5, name: "Argonaut AI", pct: "10%" },
  { rank: 6, name: "Pokedex", pct: "8%" },
  { rank: 7, name: "Ethy AI", pct: "7%" },
  { rank: 8, name: "Miclaw Jordan", pct: "6%" },
  { rank: 9, name: "CloudBant", pct: "5%" },
  { rank: 10, name: "DegenerateTrader", pct: "4%" },
];

interface PanelConfig {
  label: string;
  color: string;
  bgColor: string;
  textColor: string;
  list: RankEntry[];
  stagger: number;
}

const PANELS: PanelConfig[] = [
  {
    label: "Gemini 3.1 Pro",
    color: GEMINI_BLUE,
    bgColor: "#1A2332",
    textColor: "#FFFFFF",
    list: GEMINI_LIST,
    stagger: 0,
  },
  {
    label: "Claude Opus 4.6",
    color: OPUS_ORANGE,
    bgColor: "#1A2332",
    textColor: "#FFFFFF",
    list: OPUS_LIST,
    stagger: 5,
  },
];

const Panel: React.FC<{
  config: PanelConfig;
  frame: number;
  fps: number;
}> = ({ config, frame, fps }) => {
  const { label, color, bgColor, textColor, list, stagger } = config;

  // Card springs in
  const cardScale = spring({
    frame: Math.max(0, frame - stagger),
    fps,
    from: 0.85,
    to: 1,
    durationInFrames: 20,
  });
  const cardOpacity = interpolate(frame, [stagger, stagger + 8], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Row stagger starts at frame 20
  const rowBaseFrame = 20;

  // Final fade out (frames 80-95)
  const fadeOut = interpolate(frame, [80, 95], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        width: "35%",
        backgroundColor: bgColor,
        borderRadius: 12,
        transform: `scale(${cardScale})`,
        opacity: cardOpacity * fadeOut,
        display: "flex",
        flexDirection: "column",
        padding: "20px 16px",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 14,
        }}
      >
        <div
          style={{
            width: 10,
            height: 10,
            borderRadius: "50%",
            backgroundColor: color,
            flexShrink: 0,
          }}
        />
        <span
          style={{
            fontSize: 15,
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
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {list.map((entry, i) => {
          const rowStart = rowBaseFrame + i * 3;
          const rowOpacity = interpolate(frame, [rowStart, rowStart + 5], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          const rowY = spring({
            frame: Math.max(0, frame - rowStart),
            fps,
            from: 8,
            to: 0,
            durationInFrames: 12,
          });

          return (
            <div
              key={entry.rank}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                fontSize: 13,
                fontFamily,
                color: textColor,
                opacity: rowOpacity,
                transform: `translateY(${rowY}px)`,
                lineHeight: "1.65",
              }}
            >
              <span style={{ opacity: 0.5, marginRight: 6, minWidth: 18 }}>
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
              </span>
              <span style={{ opacity: 0.6, marginLeft: 6, flexShrink: 0 }}>
                {entry.pct}
              </span>
            </div>
          );
        })}
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
        justifyContent: "flex-end",
        alignItems: "center",
        fontFamily,
        paddingBottom: "10%",
      }}
    >
      <div
        style={{
          display: "flex",
          gap: 20,
          justifyContent: "center",
          alignItems: "flex-start",
        }}
      >
        {PANELS.map((panel) => (
          <Panel
            key={panel.label}
            config={panel}
            frame={frame}
            fps={fps}
          />
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
  durationInFrames: 95,
};
