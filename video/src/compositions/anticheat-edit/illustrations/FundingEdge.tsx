import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { SceneFrame, font, monoFont, scene } from "../props";

// MECHANISM 11 / 13 — "The window you can't reach".
//
// A funding countdown ticks toward the flip. At the flip an arbitrage window
// opens — and two doors stand at it. The MARKET MAKER's door is "PRIORITY
// ACCESS" and stands open; yours reads "LOCKED". They step through and capture
// the edge while you watch the window close.

const STAGE_W = 1320;
const STAGE_LEFT = (1920 - STAGE_W) / 2;
const STAGE_TOP = 330;

// Countdown runs 02:00 → 00:00 across the hold, then the window opens.
const START_SEC = 120;
const FLIP_FRAME = 92; // when the window opens

const fmtClock = (sec: number): string => {
  const s = Math.max(0, Math.round(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
};

const Door: React.FC<{
  x: number;
  who: string;
  state: "open" | "locked";
  delay: number;
  openAmt: number;
}> = ({ x, who, state, delay, openAmt }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({
    fps,
    frame: Math.max(0, frame - delay),
    config: { mass: 0.6, damping: 15, stiffness: 120 },
    durationInFrames: 22,
  });
  const op = interpolate(pop, [0, 0.4], [0, 1], { extrapolateRight: "clamp" });
  const w = 200;
  const h = 280;
  const isOpen = state === "open";
  // Open door: the panel swings (skewed) by openAmt; locked stays shut.
  const swing = isOpen ? openAmt : 0;

  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: 0,
        width: w,
        transform: `translateX(-50%) scale(${(0.7 + 0.3 * pop).toFixed(3)})`,
        opacity: op,
      }}
    >
      {/* Frame */}
      <div
        style={{
          position: "relative",
          width: w,
          height: h,
          borderRadius: "12px 12px 0 0",
          border: `3px solid ${isOpen ? scene.accentSoft : scene.inkDim}`,
          background: isOpen ? "rgba(0,82,255,0.10)" : "rgba(255,255,255,0.04)",
          overflow: "hidden",
        }}
      >
        {/* The interior glow for the open door — the window behind it */}
        {isOpen ? (
          <div
            style={{
              position: "absolute",
              inset: 8,
              borderRadius: 6,
              background:
                "linear-gradient(180deg, rgba(91,121,255,0.55) 0%, rgba(0,82,255,0.18) 100%)",
              opacity: openAmt,
            }}
          />
        ) : null}
        {/* The door panel */}
        <div
          style={{
            position: "absolute",
            left: 6,
            top: 6,
            width: w - 12,
            height: h - 12,
            borderRadius: 6,
            background: isOpen ? "rgba(0,82,255,0.30)" : "rgba(255,255,255,0.10)",
            border: `2px solid ${isOpen ? scene.accentSoft : scene.inkDim}`,
            transformOrigin: "left center",
            transform: `perspective(700px) rotateY(${(-swing * 78).toFixed(1)}deg)`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {/* Lock glyph for the locked door */}
          {!isOpen ? (
            <svg width={56} height={64} viewBox="0 0 56 64">
              <rect x={8} y={28} width={40} height={30} rx={6} fill="none" stroke={scene.inkSoft} strokeWidth={4} />
              <path d="M16 28 V20 a12 12 0 0 1 24 0 V28" fill="none" stroke={scene.inkSoft} strokeWidth={4} />
              <circle cx={28} cy={42} r={4} fill={scene.inkSoft} />
            </svg>
          ) : (
            <div
              style={{
                width: 10,
                height: 60,
                borderRadius: 5,
                background: scene.accentSoft,
                opacity: 0.6,
              }}
            />
          )}
        </div>
      </div>

      {/* Door label */}
      <div
        style={{
          marginTop: 18,
          textAlign: "center",
          fontFamily: monoFont,
          fontSize: 16,
          fontWeight: 700,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: isOpen ? scene.accentSoft : scene.inkDim,
        }}
      >
        {state === "open" ? "PRIORITY ACCESS" : "LOCKED"}
      </div>
      <div
        style={{
          marginTop: 6,
          textAlign: "center",
          fontFamily: font,
          fontSize: 24,
          fontWeight: 800,
          letterSpacing: "-0.02em",
          color: scene.ink,
        }}
      >
        {who}
      </div>
    </div>
  );
};

export const FundingEdge: React.FC = () => {
  const frame = useCurrentFrame();

  // Clock counts down to the flip, then sits at 00:00.
  const sec = interpolate(frame, [10, FLIP_FRAME], [START_SEC, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const flipped = frame >= FLIP_FRAME;

  // The arbitrage window opens at the flip, then begins to close on the hold.
  const openAmt = interpolate(frame, [FLIP_FRAME, FLIP_FRAME + 18], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  // Window-closing meter: full at flip, shrinking after.
  const windowOpen = interpolate(frame, [FLIP_FRAME + 18, 165], [1, 0.18], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const clockOp = interpolate(frame, [4, 16], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  // Subtle pulse on the clock as it nears zero.
  const urgent = sec < 8 && !flipped ? 0.5 + 0.5 * Math.sin(frame * 0.9) : 1;

  return (
    <SceneFrame kicker="MECHANISM 11 / 13" title="The window you can't reach">
      <AbsoluteFill>
        <div
          style={{
            position: "absolute",
            left: STAGE_LEFT,
            top: STAGE_TOP,
            width: STAGE_W,
            height: 560,
          }}
        >
          {/* Funding countdown clock */}
          <div
            style={{
              position: "absolute",
              left: STAGE_W / 2,
              top: 0,
              transform: "translateX(-50%)",
              textAlign: "center",
              opacity: clockOp,
            }}
          >
            <div
              style={{
                fontFamily: monoFont,
                fontSize: 16,
                fontWeight: 600,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: flipped ? scene.accentSoft : scene.inkDim,
              }}
            >
              {flipped ? "FUNDING FLIP" : "FUNDING IN"}
            </div>
            <div
              style={{
                fontFamily: monoFont,
                fontSize: 78,
                fontWeight: 700,
                letterSpacing: "0.02em",
                color: flipped ? scene.accent : scene.ink,
                fontVariantNumeric: "tabular-nums",
                opacity: urgent,
                lineHeight: 1.05,
              }}
            >
              {fmtClock(sec)}
            </div>
          </div>

          {/* The arbitrage-window bar that opens at the flip and shrinks */}
          <div
            style={{
              position: "absolute",
              left: STAGE_W / 2 - 260,
              top: 168,
              width: 520,
              height: 26,
              borderRadius: 13,
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.12)",
              overflow: "hidden",
              opacity: openAmt,
            }}
          >
            <div
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                height: "100%",
                width: `${(windowOpen * 100).toFixed(1)}%`,
                background: `linear-gradient(90deg, ${scene.accent}, ${scene.accentSoft})`,
              }}
            />
          </div>
          <div
            style={{
              position: "absolute",
              left: STAGE_W / 2,
              top: 200,
              transform: "translateX(-50%)",
              fontFamily: monoFont,
              fontSize: 14,
              fontWeight: 600,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: scene.inkDim,
              opacity: openAmt,
              whiteSpace: "nowrap",
            }}
          >
            arbitrage window · closing
          </div>

          {/* Two doors at the window */}
          <div style={{ position: "absolute", left: 0, top: 248, width: STAGE_W }}>
            <Door x={STAGE_W * 0.32} who="YOU" state="locked" delay={20} openAmt={0} />
            <Door
              x={STAGE_W * 0.68}
              who="MARKET MAKER"
              state="open"
              delay={26}
              openAmt={openAmt}
            />
          </div>
        </div>
      </AbsoluteFill>
    </SceneFrame>
  );
};
