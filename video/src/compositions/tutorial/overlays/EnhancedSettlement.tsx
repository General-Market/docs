import React from "react";
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
import { font, monoFont } from "../../../common/fonts";
import { EASE } from "../../../common/easing";
import { FPS, BRAND_GREEN, PANEL } from "../theme";

// ---------------------------------------------------------------------------
// Timing — local seconds (overlay starts at 0, video time 89.84s)
// ---------------------------------------------------------------------------

const sec = (s: number) => Math.round(s * FPS);

// Element windows (local seconds)
const CLOCK_IN = sec(6.56);
const CLOCK_OUT = sec(30.52);

const SEALED_IN = sec(6.56);
const SEALED_OUT = sec(17.76);

const YESNO_IN = sec(17.76);
const YESNO_OUT = sec(23);

const ORACLE_IN = sec(23);
const ORACLE_OUT = sec(30.52);
const CONSENSUS_IN = sec(27); // label appears mid-oracle section

const SLAM_START = sec(37); // slight offset from NoPriceReveal at 36.36
const SLAM_STAGGER = sec(0.5);
const SLAM_HOLD = sec(2.5);

const COUNTER_IN = sec(45.88);
const COUNTER_OUT = sec(60.6);

const PAYOUT_IN = sec(69.88);
const PAYOUT_OUT = sec(71.5);

// Colors
const GREEN = BRAND_GREEN;
const RED = "#DC2626";
const ORACLE_BLUE = "#6366f1";
const DIM = "rgba(255,255,255,0.45)";
const BRIGHT = "#fafafa";

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function fadeEnterExit(
  frame: number,
  enterStart: number,
  exitEnd: number,
  fadeFrames = 10,
) {
  const enterOp = interpolate(frame, [enterStart, enterStart + fadeFrames], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const exitOp = interpolate(frame, [exitEnd - fadeFrames, exitEnd], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return Math.min(enterOp, exitOp);
}

// ---------------------------------------------------------------------------
// 1. Animated Clock — top-right, minute hand sweeps 360deg
// ---------------------------------------------------------------------------

const AnimatedClock: React.FC = () => {
  const frame = useCurrentFrame();

  const opacity = fadeEnterExit(frame, CLOCK_IN, CLOCK_OUT, 12);
  const progress = interpolate(frame, [CLOCK_IN, CLOCK_OUT], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const angle = progress * 360;

  const size = 80;
  const cx = size / 2;
  const cy = size / 2;
  const r = 34;
  const handLen = 28;

  // Minute hand endpoint
  const rad = ((angle - 90) * Math.PI) / 180;
  const hx = cx + handLen * Math.cos(rad);
  const hy = cy + handLen * Math.sin(rad);

  return (
    <AbsoluteFill
      style={{
        justifyContent: "flex-start",
        alignItems: "flex-end",
        padding: "48px 48px",
        opacity,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          width: size,
          height: size,
          background: "rgba(10, 10, 10, 0.75)",
          borderRadius: "50%",
          border: "2px solid rgba(255,255,255,0.2)",
          position: "relative",
        }}
      >
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {/* Clock face circle */}
          <circle
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke="rgba(255,255,255,0.15)"
            strokeWidth={1.5}
          />
          {/* 12 tick marks */}
          {Array.from({ length: 12 }).map((_, i) => {
            const tickAngle = ((i * 30 - 90) * Math.PI) / 180;
            const outer = r - 2;
            const inner = r - (i % 3 === 0 ? 8 : 5);
            return (
              <line
                key={i}
                x1={cx + inner * Math.cos(tickAngle)}
                y1={cy + inner * Math.sin(tickAngle)}
                x2={cx + outer * Math.cos(tickAngle)}
                y2={cy + outer * Math.sin(tickAngle)}
                stroke={i % 3 === 0 ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.25)"}
                strokeWidth={i % 3 === 0 ? 2 : 1}
              />
            );
          })}
          {/* Minute hand */}
          <line
            x1={cx}
            y1={cy}
            x2={hx}
            y2={hy}
            stroke={GREEN}
            strokeWidth={2.5}
            strokeLinecap="round"
          />
          {/* Center dot */}
          <circle cx={cx} cy={cy} r={3} fill={GREEN} />
        </svg>
        {/* "10 MIN" micro-label below clock */}
        <div
          style={{
            position: "absolute",
            bottom: -22,
            left: "50%",
            transform: "translateX(-50%)",
            fontFamily: monoFont,
            fontSize: 10,
            fontWeight: 700,
            color: DIM,
            letterSpacing: 2,
            whiteSpace: "nowrap",
          }}
        >
          10 MIN
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// 2. "SEALED BETS" stamp — top-left, rotated
// ---------------------------------------------------------------------------

const SealedBetsStamp: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const opacity = fadeEnterExit(frame, SEALED_IN, SEALED_OUT, 8);
  const s = spring({
    frame: Math.max(frame - SEALED_IN, 0),
    fps,
    config: { damping: 10, stiffness: 160, mass: 0.6 },
  });
  const scale = interpolate(s, [0, 1], [1.3, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        justifyContent: "flex-start",
        alignItems: "flex-start",
        padding: "52px 56px",
        opacity,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          transform: `rotate(-5deg) scale(${scale})`,
          border: `3px solid ${RED}`,
          borderRadius: 6,
          padding: "8px 18px",
          fontFamily: monoFont,
          fontSize: 18,
          fontWeight: 700,
          color: RED,
          letterSpacing: 4,
          textTransform: "uppercase",
          background: "rgba(220, 38, 38, 0.08)",
        }}
      >
        SEALED BETS
      </div>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// 3. YES / NO pulsing labels
// ---------------------------------------------------------------------------

const YesNoLabels: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const opacity = fadeEnterExit(frame, YESNO_IN, YESNO_OUT, 8);
  const localFrame = frame - YESNO_IN;

  // Alternating pulse: YES and NO scale slightly out of phase
  const yesScale = 1 + 0.08 * Math.sin((localFrame / fps) * Math.PI * 3);
  const noScale = 1 + 0.08 * Math.sin((localFrame / fps) * Math.PI * 3 + Math.PI);

  // Spring entrance
  const enterSpring = spring({
    frame: Math.max(localFrame, 0),
    fps,
    config: { damping: 12, stiffness: 140, mass: 0.6 },
  });
  const baseScale = interpolate(enterSpring, [0, 1], [0.5, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const labelStyle: React.CSSProperties = {
    fontFamily: font,
    fontSize: 72,
    fontWeight: 900,
    letterSpacing: -2,
    textShadow: "0 0 40px rgba(0,0,0,0.6)",
  };

  return (
    <AbsoluteFill
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "0 120px",
        opacity,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          ...labelStyle,
          color: GREEN,
          transform: `scale(${baseScale * yesScale})`,
        }}
      >
        YES
      </div>
      <div
        style={{
          ...labelStyle,
          color: RED,
          transform: `scale(${baseScale * noScale})`,
        }}
      >
        NO
      </div>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// 4. Oracle Labels with connection lines + CONSENSUS
// ---------------------------------------------------------------------------

const OracleLabels: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const opacity = fadeEnterExit(frame, ORACLE_IN, ORACLE_OUT, 10);
  const localFrame = frame - ORACLE_IN;

  // Stagger each oracle node
  const nodeOpacities = [0, 1, 2].map((i) => {
    const delay = i * 6; // ~0.2s stagger
    return interpolate(localFrame, [delay, delay + 8], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
  });

  // Connection line progress between nodes
  const lineProgress = interpolate(localFrame, [6, 24], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE.smooth,
  });

  // Pulse effect on nodes
  const pulse = 0.5 + 0.5 * Math.sin((localFrame / fps) * Math.PI * 4);

  // CONSENSUS label
  const consensusOpacity = fadeEnterExit(frame, CONSENSUS_IN, ORACLE_OUT, 10);
  const consensusSpring = spring({
    frame: Math.max(frame - CONSENSUS_IN, 0),
    fps,
    config: { damping: 14, stiffness: 120, mass: 0.7 },
  });
  const consensusScale = interpolate(consensusSpring, [0, 1], [0.8, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const nodeSize = 48;
  const gap = 60;
  const names = ["ORACLE 1", "ORACLE 2", "ORACLE 3"];

  return (
    <AbsoluteFill
      style={{
        justifyContent: "flex-end",
        alignItems: "center",
        paddingBottom: 80,
        opacity,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 16,
        }}
      >
        {/* Nodes row */}
        <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
          {names.map((name, i) => (
            <React.Fragment key={name}>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 6,
                  opacity: nodeOpacities[i],
                }}
              >
                <div
                  style={{
                    width: nodeSize,
                    height: nodeSize,
                    borderRadius: "50%",
                    background: ORACLE_BLUE,
                    border: `2px solid rgba(255,255,255,0.3)`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontFamily: monoFont,
                    fontSize: 18,
                    fontWeight: 700,
                    color: BRIGHT,
                    boxShadow: `0 0 ${12 + 8 * pulse}px rgba(99,102,241,${0.3 + 0.2 * pulse})`,
                  }}
                >
                  {i + 1}
                </div>
                <div
                  style={{
                    fontFamily: monoFont,
                    fontSize: 10,
                    fontWeight: 700,
                    color: DIM,
                    letterSpacing: 2,
                    whiteSpace: "nowrap",
                  }}
                >
                  {name}
                </div>
              </div>
              {/* Connection line between nodes */}
              {i < 2 && (
                <div
                  style={{
                    width: gap,
                    height: 3,
                    background: `rgba(99,102,241,${0.3 + 0.3 * pulse})`,
                    marginBottom: 22,
                    position: "relative",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: `${lineProgress * 100}%`,
                      height: "100%",
                      background: ORACLE_BLUE,
                      boxShadow: `0 0 8px ${ORACLE_BLUE}`,
                    }}
                  />
                </div>
              )}
            </React.Fragment>
          ))}
        </div>

        {/* CONSENSUS label */}
        <div
          style={{
            fontFamily: monoFont,
            fontSize: 16,
            fontWeight: 700,
            color: GREEN,
            letterSpacing: 4,
            opacity: consensusOpacity,
            transform: `scale(${consensusScale})`,
            background: "rgba(0,200,83,0.08)",
            border: `1px solid rgba(0,200,83,0.3)`,
            borderRadius: 4,
            padding: "4px 16px",
          }}
        >
          CONSENSUS
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// 5. $0 Slam Text — three items with stagger
// ---------------------------------------------------------------------------

const SlamItem: React.FC<{ text: string; index: number }> = ({ text, index }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const start = SLAM_START + index * SLAM_STAGGER;
  const end = SLAM_START + SLAM_HOLD;

  const opacity = fadeEnterExit(frame, start, end, 6);
  const localFrame = Math.max(frame - start, 0);

  const s = spring({
    frame: localFrame,
    fps,
    config: { damping: 10, stiffness: 200, mass: 0.5 },
  });
  const scale = interpolate(s, [0, 1], [2, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Vertical offset: stack them
  const yPos = 340 + index * 80;

  return (
    <AbsoluteFill
      style={{
        justifyContent: "flex-start",
        alignItems: "center",
        paddingTop: yPos,
        opacity,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          fontFamily: monoFont,
          fontSize: 38,
          fontWeight: 700,
          color: GREEN,
          letterSpacing: 2,
          transform: `scale(${scale})`,
          textShadow: `0 0 20px rgba(0,200,83,0.4)`,
        }}
      >
        {text}
      </div>
    </AbsoluteFill>
  );
};

const SlamSequence: React.FC = () => {
  const items = ["$0 SPREAD", "$0 FEES", "$0 SLIPPAGE"];
  return (
    <AbsoluteFill>
      {items.map((text, i) => (
        <SlamItem key={text} text={text} index={i} />
      ))}
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// 6. Running Total — "Submarket N/30" counter, bottom-right
// ---------------------------------------------------------------------------

const RunningTotal: React.FC = () => {
  const frame = useCurrentFrame();

  const opacity = fadeEnterExit(frame, COUNTER_IN, COUNTER_OUT, 10);
  const progress = interpolate(frame, [COUNTER_IN, COUNTER_OUT], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const count = Math.min(30, Math.ceil(progress * 30));

  return (
    <AbsoluteFill
      style={{
        justifyContent: "flex-end",
        alignItems: "flex-end",
        padding: "0 56px 56px 0",
        opacity,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          ...PANEL,
          padding: "10px 20px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 2,
        }}
      >
        <div
          style={{
            fontFamily: monoFont,
            fontSize: 10,
            fontWeight: 700,
            color: DIM,
            letterSpacing: 2,
            textTransform: "uppercase",
          }}
        >
          SUBMARKET
        </div>
        <div
          style={{
            fontFamily: monoFont,
            fontSize: 24,
            fontWeight: 700,
            color: BRIGHT,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {count}/30
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// 7. "INSTANT PAYOUT" flash — brief center flash
// ---------------------------------------------------------------------------

const InstantPayoutFlash: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const opacity = fadeEnterExit(frame, PAYOUT_IN, PAYOUT_OUT, 4);
  const s = spring({
    frame: Math.max(frame - PAYOUT_IN, 0),
    fps,
    config: { damping: 8, stiffness: 200, mass: 0.4 },
  });
  const scale = interpolate(s, [0, 1], [1.4, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        opacity,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          fontFamily: font,
          fontSize: 64,
          fontWeight: 900,
          color: GREEN,
          letterSpacing: -1,
          transform: `scale(${scale})`,
          textShadow: `0 0 60px rgba(0,200,83,0.5), 0 0 120px rgba(0,200,83,0.25)`,
        }}
      >
        INSTANT PAYOUT
      </div>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// Main Export — full-duration overlay, elements use their own timing
// ---------------------------------------------------------------------------

export const EnhancedSettlement: React.FC = () => {
  return (
    <AbsoluteFill>
      {/* 1. Animated clock — top-right during timeline */}
      <AnimatedClock />

      {/* 2. SEALED BETS stamp — top-left during betting window */}
      <SealedBetsStamp />

      {/* 3. YES / NO pulsing labels */}
      <YesNoLabels />

      {/* 4. Oracle labels with connection lines */}
      <OracleLabels />
      {/* SFX: metal-latch-unlock on consensus */}
      <Sequence from={CONSENSUS_IN}>
        <Audio src={staticFile("sfx/metal-latch-unlock.mp3")} volume={0.45} />
      </Sequence>

      {/* 5. $0 slam text */}
      <SlamSequence />
      {/* SFX: text-appear-blip for each slam */}
      {[0, 1, 2].map((i) => (
        <Sequence key={i} from={SLAM_START + i * SLAM_STAGGER}>
          <Audio src={staticFile("sfx/text-appear-blip.mp3")} volume={0.5} />
        </Sequence>
      ))}

      {/* 6. Running total counter */}
      <RunningTotal />

      {/* 7. INSTANT PAYOUT flash */}
      <InstantPayoutFlash />
    </AbsoluteFill>
  );
};
