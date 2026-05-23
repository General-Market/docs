import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { SceneFrame, font, monoFont, scene } from "../props";

// MECHANISM 05 / 13 — "Two views of one book".
//
// A split screen. LEFT, YOUR VIEW: one lonely order on an otherwise blank
// book. RIGHT, DEALER VIEW: the whole order book lit up — every row tagged
// LONG / SHORT / LIQUIDATING, who is bleeding visible at a glance. The
// asymmetry of sight is the lesson: same book, one side sees everything.

const STAGE_W = 1620;
const STAGE_H = 520;
const STAGE_LEFT = (1920 - STAGE_W) / 2;
const STAGE_TOP = 356;

const PANEL_W = 760;
const PANEL_GAP = STAGE_W - PANEL_W * 2;

const GREEN = "#37D67A";
const RED = "#FF4D4D";
const AMBER = "#FFB020";

type Tag = "LONG" | "SHORT" | "LIQUIDATING";

const tagColor = (t: Tag): string =>
  t === "LONG" ? GREEN : t === "SHORT" ? RED : AMBER;

const DEALER_ROWS: { tag: Tag; depth: number }[] = [
  { tag: "LONG", depth: 0.92 },
  { tag: "SHORT", depth: 0.64 },
  { tag: "LONG", depth: 0.78 },
  { tag: "LIQUIDATING", depth: 0.5 },
  { tag: "SHORT", depth: 0.86 },
  { tag: "LONG", depth: 0.7 },
  { tag: "LIQUIDATING", depth: 0.42 },
  { tag: "SHORT", depth: 0.58 },
];

const ROW_H = 40;
const ROW_GAP = 8;
const ROWS_TOP = 96;

const Panel: React.FC<{
  left: number;
  title: string;
  side: "you" | "dealer";
}> = ({ left, title, side }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const delay = side === "you" ? 8 : 16;
  const pop = spring({
    fps,
    frame: Math.max(0, frame - delay),
    config: { mass: 0.7, damping: 15, stiffness: 110 },
    durationInFrames: 24,
  });
  const op = interpolate(pop, [0, 0.4], [0, 1], { extrapolateRight: "clamp" });

  return (
    <div
      style={{
        position: "absolute",
        left,
        top: 0,
        width: PANEL_W,
        height: STAGE_H,
        transform: `translateY(${((1 - pop) * 22).toFixed(1)}px)`,
        opacity: op,
        borderRadius: 22,
        background:
          side === "dealer" ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.035)",
        border: `1.5px solid ${side === "dealer" ? scene.gridLineBright : scene.gridLine}`,
        boxShadow: "0 22px 50px rgba(2,14,43,0.42)",
        overflow: "hidden",
      }}
    >
      {/* Panel header */}
      <div
        style={{
          position: "absolute",
          top: 26,
          left: 32,
          fontFamily: monoFont,
          fontSize: 16,
          fontWeight: 600,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          color: side === "dealer" ? scene.accentSoft : scene.inkDim,
        }}
      >
        {title}
      </div>
      <div
        style={{
          position: "absolute",
          top: 50,
          left: 32,
          fontFamily: font,
          fontSize: 34,
          fontWeight: 800,
          letterSpacing: "-0.02em",
          color: scene.ink,
        }}
      >
        ORDER BOOK
      </div>
      <div
        style={{
          position: "absolute",
          top: ROWS_TOP - 14,
          left: 0,
          right: 0,
          height: 1,
          background: scene.gridLine,
        }}
      />

      {side === "you" ? (
        <YourRows />
      ) : (
        <DealerRows />
      )}
    </div>
  );
};

const YourRows: React.FC = () => {
  const frame = useCurrentFrame();
  // Empty book rails plus the single lonely order at row 3.
  const rails = DEALER_ROWS.length;
  const orderRow = 3;
  const op = interpolate(frame, [30, 44], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const w = interpolate(frame, [30, 50], [0, 0.55], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <>
      {Array.from({ length: rails }).map((_, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: 32,
            right: 32,
            top: ROWS_TOP + i * (ROW_H + ROW_GAP),
            height: ROW_H,
            borderRadius: 8,
            border: `1px dashed ${scene.gridLine}`,
          }}
        />
      ))}
      {/* The one order you can see — yours */}
      <div
        style={{
          position: "absolute",
          left: 32,
          top: ROWS_TOP + orderRow * (ROW_H + ROW_GAP),
          height: ROW_H,
          width: `calc((100% - 64px) * ${w.toFixed(3)})`,
          borderRadius: 8,
          background: "rgba(255,255,255,0.16)",
          border: `1.5px solid ${scene.ink}`,
          opacity: op,
          display: "flex",
          alignItems: "center",
          paddingLeft: 14,
          fontFamily: monoFont,
          fontSize: 14,
          fontWeight: 600,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: scene.ink,
          whiteSpace: "nowrap",
          overflow: "hidden",
        }}
      >
        your order
      </div>
      {/* The rest is dark to you */}
      <div
        style={{
          position: "absolute",
          left: 32,
          bottom: 34,
          fontFamily: monoFont,
          fontSize: 14,
          fontWeight: 500,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: scene.inkDim,
          opacity: op,
        }}
      >
        everything else — dark
      </div>
    </>
  );
};

const DealerRows: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <>
      {DEALER_ROWS.map((row, i) => {
        const delay = 40 + i * 4;
        const reveal = interpolate(frame, [delay, delay + 12], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        const c = tagColor(row.tag);
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: 32,
              right: 32,
              top: ROWS_TOP + i * (ROW_H + ROW_GAP),
              height: ROW_H,
              opacity: reveal,
              transform: `translateX(${((1 - reveal) * 18).toFixed(1)}px)`,
            }}
          >
            {/* Depth bar */}
            <div
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                height: ROW_H,
                width: `${(row.depth * reveal * 100).toFixed(1)}%`,
                borderRadius: 8,
                background: `${c}26`,
                border: `1px solid ${c}`,
              }}
            />
            {/* Tag pill */}
            <div
              style={{
                position: "absolute",
                left: 12,
                top: "50%",
                transform: "translateY(-50%)",
                padding: "3px 12px",
                borderRadius: 999,
                background: c,
                fontFamily: monoFont,
                fontSize: 13,
                fontWeight: 700,
                letterSpacing: "0.1em",
                color: "#04205C",
                whiteSpace: "nowrap",
              }}
            >
              {row.tag}
            </div>
          </div>
        );
      })}
    </>
  );
};

export const DealerFlowVisibility: React.FC = () => {
  return (
    <SceneFrame kicker="MECHANISM 05 / 13" title="Two views of one book">
      <AbsoluteFill>
        <div
          style={{
            position: "absolute",
            left: STAGE_LEFT,
            top: STAGE_TOP,
            width: STAGE_W,
            height: STAGE_H,
          }}
        >
          <Panel left={0} title="Your view" side="you" />
          <Panel left={PANEL_W + PANEL_GAP} title="Dealer view" side="dealer" />
        </div>
      </AbsoluteFill>
    </SceneFrame>
  );
};
