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
import { C } from "../../../common/colors";
import { font, monoFont } from "../../../common/fonts";
import { EASE } from "../../../common/easing";
import { lerp } from "../../../common/utils";
import { Counter } from "../../general-market/components/Counter";
import { COMPARISONS } from "../proofData";
import { FPS, BRAND_GREEN, PANEL } from "../theme";

// ---------------------------------------------------------------------------
// Timing — local frames (frame 0 = 42.8s in video)
// Total scene duration: 57.8 - 42.8 = 15.0s
// ---------------------------------------------------------------------------
const s = (sec: number) => Math.round(sec * FPS);

// Phase 1: System Architecture (0–5.8s local = 42.8–48.6s video)
// Phase 2: FAQ Overview + Market Counter (5.8–15.0s local = 48.6–57.8s video)
const FAQ_START = s(5.8);
const COUNTER_START = s(6.2);
const COUNTER_DUR = s(3.0);

const SCENE_DUR = s(15.0);

// ---------------------------------------------------------------------------
// Architecture tiers
// ---------------------------------------------------------------------------
interface ArchTier {
  label: string;
  sublabel: string;
  y: number; // percent from top within the SVG
  tint: string; // subtle bg tint
  delay: number; // frames after ARCH_START
}

const TIERS: ArchTier[] = [
  { label: "YOUR BOT", sublabel: "(Claude)", y: 6, tint: "rgba(99,102,241,0.08)", delay: s(0.0) },
  { label: "GM API", sublabel: "/submit", y: 24, tint: "rgba(99,102,241,0.06)", delay: s(0.4) },
  { label: "BATCH ENGINE", sublabel: "(L3 chain)", y: 42, tint: "rgba(99,102,241,0.04)", delay: s(0.8) },
  { label: "ORACLE x3", sublabel: "(BLS)", y: 56, tint: "rgba(34,197,94,0.06)", delay: s(1.2) },
  { label: "SETTLEMENT", sublabel: "(10 min)", y: 76, tint: "rgba(0,200,83,0.08)", delay: s(1.6) },
];

// Connection lines between tiers
interface Connection {
  fromTier: number;
  toTier: number;
  label: string;
  delay: number; // frames after ARCH_START
  isBidirectional?: boolean;
}

const CONNECTIONS: Connection[] = [
  { fromTier: 0, toTier: 1, label: "AUTHENTICATED", delay: s(0.6) },
  { fromTier: 1, toTier: 2, label: "BATCH ID", delay: s(1.0) },
  { fromTier: 2, toTier: 3, label: "CONSENSUS", delay: s(1.4), isBidirectional: true },
  { fromTier: 3, toTier: 4, label: "PNL DISTRIBUTED", delay: s(1.8) },
  { fromTier: 2, toTier: 4, label: "", delay: s(2.0) },
];

// FAQ tabs
const FAQ_TABS = [
  { num: 1, label: "Liquidity" },
  { num: 2, label: "Settlement" },
  { num: 3, label: "Privacy" },
  { num: 4, label: "Edge" },
  { num: 5, label: "Sources" },
];

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Single architecture tier box — draws itself via strokeDashoffset */
const TierBox: React.FC<{
  tier: ArchTier;
  frame: number;
  fps: number;
  archOpacity: number;
}> = ({ tier, frame, fps, archOpacity }) => {
  const localFrame = frame - tier.delay;

  // Spring for scale entrance
  const enterSpring =
    localFrame >= 0
      ? spring({
          frame: localFrame,
          fps,
          config: { damping: 22, stiffness: 160, mass: 0.7 },
          durationInFrames: s(0.8),
        })
      : 0;

  // Stroke dash animation for box outline
  const PERIMETER = 2 * (200 + 52); // approx rect perimeter
  const dashOffset =
    localFrame >= 0
      ? interpolate(localFrame, [0, s(0.6)], [PERIMETER, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: EASE.out,
        })
      : PERIMETER;

  const opacity = enterSpring * archOpacity;
  const scale = 0.85 + enterSpring * 0.15;

  return (
    <g
      style={{
        opacity,
        transform: `scale(${scale})`,
        transformOrigin: "100px 26px",
      }}
    >
      {/* Background tint */}
      <rect
        x={0}
        y={0}
        width={200}
        height={52}
        rx={8}
        ry={8}
        fill={tier.tint}
      />
      {/* Stroke-drawing rect */}
      <rect
        x={0}
        y={0}
        width={200}
        height={52}
        rx={8}
        ry={8}
        fill="none"
        stroke={C.gray[500]}
        strokeWidth={2}
        strokeDasharray={PERIMETER}
        strokeDashoffset={dashOffset}
      />
      {/* Labels */}
      <text
        x={100}
        y={22}
        textAnchor="middle"
        fill={C.white}
        fontFamily={monoFont}
        fontSize={14}
        fontWeight={700}
        letterSpacing={0.8}
      >
        {tier.label}
      </text>
      <text
        x={100}
        y={40}
        textAnchor="middle"
        fill={C.gray[400]}
        fontFamily={monoFont}
        fontSize={11}
        letterSpacing={0.5}
      >
        {tier.sublabel}
      </text>
    </g>
  );
};

/** Single FAQ tab */
const FaqTab: React.FC<{
  tab: (typeof FAQ_TABS)[number];
  index: number;
  fps: number;
  faqLocalFrame: number;
}> = ({ tab, index, fps, faqLocalFrame }) => {
  const tabDelay = s(0.15) * index;
  const localFrame = faqLocalFrame - tabDelay;

  const enterSpring =
    localFrame >= 0
      ? spring({
          frame: localFrame,
          fps,
          config: { damping: 18, stiffness: 140, mass: 0.5 },
          durationInFrames: s(0.5),
        })
      : 0;

  const isActive = tab.num === 1;

  // Pulse for active tab (#1)
  const pulsePhase = isActive && faqLocalFrame > s(0.5)
    ? 0.7 + 0.3 * Math.sin((faqLocalFrame / fps) * Math.PI * 3)
    : 1;

  const tabWidth = 160;
  const tabHeight = 44;

  return (
    <div
      style={{
        width: tabWidth,
        height: tabHeight,
        borderRadius: 8,
        border: `1.5px solid ${isActive ? BRAND_GREEN : C.gray[700]}`,
        background: isActive
          ? `rgba(0, 200, 83, ${0.12 * pulsePhase})`
          : "rgba(10, 10, 10, 0.8)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        opacity: enterSpring,
        transform: `translateY(${(1 - enterSpring) * 20}px)`,
        boxShadow: isActive
          ? `0 0 ${12 * pulsePhase}px rgba(0, 200, 83, ${0.2 * pulsePhase})`
          : "none",
      }}
    >
      <span
        style={{
          fontFamily: monoFont,
          fontSize: 16,
          fontWeight: 700,
          color: isActive ? BRAND_GREEN : C.gray[400],
        }}
      >
        {tab.num}.
      </span>
      <span
        style={{
          fontFamily: font,
          fontSize: 14,
          fontWeight: 500,
          color: isActive ? C.white : C.gray[500],
          letterSpacing: 0.5,
          textTransform: "uppercase",
        }}
      >
        {tab.label}
      </span>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export const BotArchDiagram: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Architecture opacity: full until FAQ_START, then dims to 0.2
  const archOpacity =
    frame < FAQ_START
      ? lerp(frame, [0, s(0.3)], [0, 1], EASE.out)
      : lerp(frame, [FAQ_START, FAQ_START + s(0.8)], [1, 0.2], EASE.smooth);

  // FAQ section visibility
  const faqVisible = frame >= FAQ_START;
  const faqLocalFrame = frame - FAQ_START;

  return (
    <AbsoluteFill>
      {/* SFX: architecture swish omitted — ClaudeTerminal already plays cut-fast-swish at 42.8s */}

      {/* SFX: FAQ tab activation */}
      {faqVisible && (
        <Sequence from={FAQ_START} durationInFrames={SCENE_DUR - FAQ_START}>
          <Audio src={staticFile("sfx/scroll-tick.mp3")} volume={0.4} />
        </Sequence>
      )}

      {/* SFX: counter spin */}
      <Sequence from={COUNTER_START} durationInFrames={COUNTER_DUR}>
        <Audio src={staticFile("sfx/metric-count-up.mp3")} volume={0.25} />
      </Sequence>

      {/* ─── ZONE B: System Architecture (left 30%) ─── */}
      <div
        style={{
          position: "absolute",
          top: "10%",
          left: "2%",
          width: "30%",
          height: "70%",
          ...PANEL,
          padding: 20,
          opacity: archOpacity,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <svg
          viewBox="0 0 300 500"
          style={{ width: "100%", height: "100%", overflow: "visible" }}
        >
          {/* Tier boxes */}
          {TIERS.map((tier, i) => {
            // Position boxes: center normal tiers, offset ORACLE to the right
            const isOracle = i === 3;
            const isSettlement = i === 4;
            const xOffset = isOracle ? 80 : isSettlement ? 30 : 30;
            const yOffset = (tier.y / 100) * 500;

            return (
              <g key={tier.label} transform={`translate(${xOffset}, ${yOffset})`}>
                <TierBox
                  tier={tier}
                  frame={frame}
                  fps={fps}
                  archOpacity={1}
                />
              </g>
            );
          })}

          {/* Connection lines */}
          {CONNECTIONS.map((conn, i) => {
            const fromTier = TIERS[conn.fromTier];
            const toTier = TIERS[conn.toTier];
            const isSide = conn.fromTier === 2 && conn.toTier === 3;
            const isDiag = conn.fromTier === 2 && conn.toTier === 4;

            if (isSide) {
              // Horizontal from BATCH ENGINE to ORACLE
              const fromX = 30 + 200; // right edge of BATCH ENGINE box
              const fromYAbs = (fromTier.y / 100) * 500 + 26;
              const toX = 80; // left edge of ORACLE box
              const toYAbs = (toTier.y / 100) * 500 + 26;
              const localFrame = frame - conn.delay;
              if (localFrame < 0) return null;
              const drawProg = lerp(localFrame, [0, s(0.5)], [0, 1], EASE.out);
              const labelOp = lerp(localFrame, [s(0.3), s(0.6)], [0, 1], EASE.out);

              return (
                <g key={i} style={{ opacity: archOpacity }}>
                  <line
                    x1={fromX}
                    y1={fromYAbs}
                    x2={fromX + (toX - fromX) * drawProg}
                    y2={fromYAbs + (toYAbs - fromYAbs) * drawProg}
                    stroke={BRAND_GREEN}
                    strokeWidth={1}
                    strokeDasharray="4 3"
                    opacity={0.7}
                  />
                  {conn.label && (
                    <text
                      x={(fromX + toX) / 2}
                      y={Math.min(fromYAbs, toYAbs) - 8}
                      textAnchor="middle"
                      fill={BRAND_GREEN}
                      fontFamily={monoFont}
                      fontSize={8}
                      letterSpacing={0.6}
                      opacity={labelOp}
                    >
                      {conn.label}
                    </text>
                  )}
                </g>
              );
            }

            if (isDiag) {
              // Diagonal from BATCH ENGINE (bottom) to SETTLEMENT (top)
              const x1 = 30 + 80; // ~center-left of BATCH ENGINE
              const y1Abs = (fromTier.y / 100) * 500 + 52;
              const x2 = 30 + 100; // center of SETTLEMENT
              const y2Abs = (toTier.y / 100) * 500;
              const localFrame = frame - conn.delay;
              if (localFrame < 0) return null;
              const drawProg = lerp(localFrame, [0, s(0.5)], [0, 1], EASE.out);

              return (
                <g key={i} style={{ opacity: archOpacity * 0.4 }}>
                  <line
                    x1={x1}
                    y1={y1Abs}
                    x2={x1 + (x2 - x1) * drawProg}
                    y2={y1Abs + (y2Abs - y1Abs) * drawProg}
                    stroke={C.gray[600]}
                    strokeWidth={1}
                    strokeDasharray="3 4"
                  />
                </g>
              );
            }

            // Vertical connection
            const fromIsOracle = conn.fromTier === 3;
            const fromIsSett = conn.fromTier === 4;
            const toIsOracle = conn.toTier === 3;
            const toIsSett = conn.toTier === 4;

            const fromXBase = fromIsOracle ? 80 : fromIsSett ? 30 : 30;
            const toXBase = toIsOracle ? 80 : toIsSett ? 30 : 30;
            const x1 = fromXBase + 100;
            const x2 = toXBase + 100;
            const y1Abs = (fromTier.y / 100) * 500 + 52;
            const y2Abs = (toTier.y / 100) * 500;

            const localFrame = frame - conn.delay;
            if (localFrame < 0) return null;
            const drawProg = lerp(localFrame, [0, s(0.5)], [0, 1], EASE.out);
            const labelOp = lerp(localFrame, [s(0.3), s(0.6)], [0, 1], EASE.out);

            return (
              <g key={i} style={{ opacity: archOpacity }}>
                <line
                  x1={x1}
                  y1={y1Abs}
                  x2={x1 + (x2 - x1) * drawProg}
                  y2={y1Abs + (y2Abs - y1Abs) * drawProg}
                  stroke={C.gray[500]}
                  strokeWidth={1}
                  strokeDasharray="4 3"
                />
                {conn.label && (
                  <text
                    x={Math.max(x1, x2) + 10}
                    y={y1Abs + (y2Abs - y1Abs) * 0.5 + 4}
                    fill={C.gray[400]}
                    fontFamily={monoFont}
                    fontSize={8}
                    letterSpacing={0.6}
                    opacity={labelOp}
                  >
                    {conn.label}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* ─── ZONE A: Market Counter (top bar) ─── */}
      {faqVisible && (
        <div
          style={{
            position: "absolute",
            top: "2%",
            left: "35%",
            width: "30%",
            height: "14%",
            ...PANEL,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            opacity: lerp(faqLocalFrame, [0, s(0.5)], [0, 1], EASE.out),
            transform: `translateY(${lerp(faqLocalFrame, [0, s(0.5)], [-20, 0], EASE.out)}px)`,
          }}
        >
          <Counter
            target={500000}
            durationFrames={COUNTER_DUR}
            startFrame={COUNTER_START}
            label="EXCLUSIVE MARKETS"
            fontSize={48}
            color={BRAND_GREEN}
            formatWithCommas
          />
          <div
            style={{
              marginTop: 6,
              fontFamily: monoFont,
              fontSize: 12,
              color: C.gray[500],
              letterSpacing: 0.8,
              opacity: lerp(faqLocalFrame, [s(1.5), s(2.0)], [0, 1], EASE.out),
            }}
          >
            vs {COMPARISONS.polymarketMarkets} on Polymarket
          </div>
        </div>
      )}

      {/* ─── ZONE D: FAQ Tab Bar (bottom) ─── */}
      {faqVisible && (
        <div
          style={{
            position: "absolute",
            bottom: "3%",
            left: "5%",
            right: "5%",
            height: "10%",
            ...PANEL,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 16,
            opacity: lerp(faqLocalFrame, [0, s(0.4)], [0, 1], EASE.out),
          }}
        >
          {FAQ_TABS.map((tab, i) => (
            <FaqTab
              key={tab.num}
              tab={tab}
              index={i}
              fps={fps}
              faqLocalFrame={faqLocalFrame}
            />
          ))}
        </div>
      )}
    </AbsoluteFill>
  );
};
