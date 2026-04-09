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
import { DEUTSCHE_BAHN, COMPARISONS } from "../proofData";

// ---------------------------------------------------------------------------
// Timing — local seconds (component starts at 0 = video 89.84s)
// ---------------------------------------------------------------------------

const sec = (s: number) => Math.round(s * FPS);

// Diagram windows (local seconds, offset from 89.84s)
const MAP_IN = sec(4.96);
const MAP_OUT = sec(10.56);

const CYCLE_IN = sec(10.56);
const CYCLE_OUT = sec(23.96);

const ORACLE_IN = sec(23.96);
const ORACLE_OUT = sec(36.26);

const PRICE_IN = sec(36.36);
const PRICE_OUT = sec(41.66);

// Colors
const GREEN = BRAND_GREEN;
const RED = "#DC2626";
const ORACLE_BLUE = "#6366f1";
const DIM = "rgba(255,255,255,0.45)";
const BRIGHT = "#fafafa";
const RAIL_GREY = "rgba(255,255,255,0.15)";

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
// DIAGRAM 1: Germany Rail Map (ZONE C — right side)
// ---------------------------------------------------------------------------

interface Station {
  name: string;
  x: number;
  y: number;
  major: boolean;
}

const STATIONS: Station[] = [
  // Major stations (labeled)
  { name: "Hamburg", x: 180, y: 40, major: true },
  { name: "Berlin", x: 300, y: 95, major: true },
  { name: "Hannover", x: 160, y: 120, major: true },
  { name: "Köln", x: 60, y: 200, major: true },
  { name: "Frankfurt", x: 140, y: 240, major: true },
  { name: "Stuttgart", x: 140, y: 320, major: true },
  { name: "München", x: 200, y: 400, major: true },
  // Minor stations (dots only)
  { name: "Kiel", x: 160, y: 15, major: false },
  { name: "Bremen", x: 110, y: 75, major: false },
  { name: "Dortmund", x: 80, y: 160, major: false },
  { name: "Düsseldorf", x: 50, y: 180, major: false },
  { name: "Leipzig", x: 280, y: 155, major: false },
  { name: "Dresden", x: 330, y: 170, major: false },
  { name: "Nürnberg", x: 230, y: 300, major: false },
  { name: "Erfurt", x: 220, y: 190, major: false },
  { name: "Kassel", x: 155, y: 175, major: false },
  { name: "Mannheim", x: 100, y: 270, major: false },
  { name: "Würzburg", x: 185, y: 260, major: false },
  { name: "Augsburg", x: 195, y: 360, major: false },
  { name: "Freiburg", x: 70, y: 340, major: false },
  { name: "Rostock", x: 240, y: 20, major: false },
  { name: "Magdeburg", x: 250, y: 125, major: false },
  { name: "Ulm", x: 155, y: 350, major: false },
  { name: "Karlsruhe", x: 90, y: 295, major: false },
  { name: "Regensburg", x: 270, y: 310, major: false },
  { name: "Passau", x: 320, y: 350, major: false },
  { name: "Braunschweig", x: 210, y: 110, major: false },
  { name: "Münster", x: 80, y: 130, major: false },
  { name: "Aachen", x: 20, y: 195, major: false },
  { name: "Konstanz", x: 115, y: 385, major: false },
];

// Rail connections as index pairs
const RAILS: [number, number][] = [
  [0, 2], // Hamburg-Hannover
  [0, 1], // Hamburg-Berlin
  [2, 1], // Hannover-Berlin
  [2, 3], // Hannover-Köln
  [2, 4], // Hannover-Frankfurt
  [3, 4], // Köln-Frankfurt
  [4, 5], // Frankfurt-Stuttgart
  [5, 6], // Stuttgart-München
  [1, 11], // Berlin-Leipzig
  [11, 12], // Leipzig-Dresden
  [4, 16], // Frankfurt-Mannheim
  [16, 23], // Mannheim-Karlsruhe
  [2, 15], // Hannover-Kassel
  [15, 4], // Kassel-Frankfurt
  [13, 6], // Nürnberg-München
  [14, 11], // Erfurt-Leipzig
  [5, 22], // Stuttgart-Ulm
  [22, 6], // Ulm-München
];

// Simplified Germany outline (SVG path — very simplified polygon)
const GERMANY_OUTLINE =
  "M60,5 L100,0 L180,5 L250,10 L340,15 L360,55 L350,100 L360,160 " +
  "L340,200 L345,250 L310,310 L330,360 L280,400 L220,420 L160,410 " +
  "L110,390 L70,360 L40,330 L20,280 L10,230 L20,190 L15,150 " +
  "L25,100 L40,50 Z";

const GermanyRailMap: React.FC = () => {
  const frame = useCurrentFrame();

  const opacity = fadeEnterExit(frame, MAP_IN, MAP_OUT, 12);
  const localFrame = frame - MAP_IN;
  const totalDuration = MAP_OUT - MAP_IN;

  // Staggered station light-up
  const stationProgress = interpolate(localFrame, [0, totalDuration * 0.8], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE.out,
  });

  // Rail lines draw progress
  const railProgress = interpolate(localFrame, [0, totalDuration * 0.6], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE.smooth,
  });

  // Outline draw
  const outlineProgress = interpolate(localFrame, [0, totalDuration * 0.3], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE.out,
  });

  // Proof data labels fade in
  const proofOpacity = interpolate(localFrame, [totalDuration * 0.5, totalDuration * 0.7], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const mapW = 380;
  const mapH = 440;

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "flex-end",
        paddingRight: 40,
        opacity,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          ...PANEL,
          padding: "24px 28px 32px",
          width: mapW + 56,
          position: "relative",
        }}
      >
        {/* Map title */}
        <div
          style={{
            fontFamily: monoFont,
            fontSize: 11,
            fontWeight: 700,
            color: DIM,
            letterSpacing: 3,
            marginBottom: 12,
            textTransform: "uppercase",
          }}
        >
          DEUTSCHE BAHN — 30 SUBMARKETS
        </div>

        <svg width={mapW} height={mapH} viewBox={`0 0 ${mapW} ${mapH}`}>
          {/* Germany outline */}
          <path
            d={GERMANY_OUTLINE}
            fill="none"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth={1.5}
            strokeDasharray={2000}
            strokeDashoffset={2000 * (1 - outlineProgress)}
          />

          {/* Rail lines */}
          {RAILS.map(([a, b], i) => {
            const sa = STATIONS[a];
            const sb = STATIONS[b];
            const lineDelay = i / RAILS.length;
            const lineOp = interpolate(railProgress, [lineDelay, lineDelay + 0.3], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            return (
              <line
                key={`${a}-${b}`}
                x1={sa.x}
                y1={sa.y}
                x2={sa.x + (sb.x - sa.x) * lineOp}
                y2={sa.y + (sb.y - sa.y) * lineOp}
                stroke={RAIL_GREY}
                strokeWidth={1.2}
              />
            );
          })}

          {/* Station dots */}
          {STATIONS.map((st, i) => {
            const delay = i / STATIONS.length;
            const dotOp = interpolate(stationProgress, [delay, delay + 0.15], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            const r = st.major ? 5 : 3;
            const glowR = st.major ? 12 : 0;

            return (
              <g key={st.name}>
                {/* Glow for major stations */}
                {st.major && dotOp > 0.5 && (
                  <circle cx={st.x} cy={st.y} r={glowR} fill={GREEN} opacity={0.15 * dotOp} />
                )}
                <circle
                  cx={st.x}
                  cy={st.y}
                  r={r}
                  fill={dotOp > 0.5 ? GREEN : "rgba(255,255,255,0.2)"}
                  opacity={Math.max(0.3, dotOp)}
                />
                {/* Label for major stations */}
                {st.major && (
                  <text
                    x={st.x + 9}
                    y={st.y + 4}
                    fontFamily={monoFont}
                    fontSize={9}
                    fontWeight={700}
                    fill={BRIGHT}
                    opacity={dotOp}
                  >
                    {st.name}
                  </text>
                )}
              </g>
            );
          })}
        </svg>

        {/* Parasite labels */}
        <div
          style={{
            position: "absolute",
            bottom: 36,
            left: 28,
            right: 28,
            display: "flex",
            flexDirection: "column",
            gap: 6,
            opacity: proofOpacity,
          }}
        >
          <ParasiteLabel text="30 SUBMARKETS" color={GREEN} />
          <ParasiteLabel text="DELAY DATA EVERY 10 MIN" color={DIM} />
          <ParasiteLabel text={`${DEUTSCHE_BAHN.onTimeRate2025} ON TIME — WORST EVER`} color={RED} />
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// DIAGRAM 2: 10-Min Cycle Timeline (ZONE D — full-width lower third)
// ---------------------------------------------------------------------------

interface BetBlock {
  x: number;
  color: string;
  label: string;
}

const CycleTimeline: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const opacity = fadeEnterExit(frame, CYCLE_IN, CYCLE_OUT, 15);
  const localFrame = frame - CYCLE_IN;
  const totalDuration = CYCLE_OUT - CYCLE_IN;

  // Overall progress through the 3 phases
  const progress = interpolate(localFrame, [0, totalDuration], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE.smooth,
  });

  // Phase boundaries (relative)
  const PHASE_BETTING_END = 0.55;
  const PHASE_ORACLE_END = 0.78;

  const currentPhase = progress < PHASE_BETTING_END ? 0 : progress < PHASE_ORACLE_END ? 1 : 2;

  const barWidth = 1100;
  const barHeight = 16;
  const filledWidth = progress * barWidth;

  // Betting blocks (Tetris-like)
  const bettingProgress = interpolate(progress, [0, PHASE_BETTING_END], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const blocks: BetBlock[] = [
    { x: 80, color: GREEN, label: "YES" },
    { x: 200, color: RED, label: "NO" },
    { x: 340, color: GREEN, label: "YES" },
    { x: 460, color: GREEN, label: "YES" },
    { x: 580, color: RED, label: "NO" },
    { x: 700, color: GREEN, label: "YES" },
    { x: 820, color: RED, label: "NO" },
    { x: 940, color: GREEN, label: "YES" },
  ];

  // Oracle pulse
  const oracleActive = currentPhase >= 1;
  const oraclePulse = oracleActive ? 0.5 + 0.5 * Math.sin((localFrame / fps) * Math.PI * 5) : 0;

  // Settle $ flow
  const settleActive = currentPhase === 2;
  const settleProgress = interpolate(progress, [PHASE_ORACLE_END, 1], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Bar color
  const barColor = currentPhase === 0 ? GREEN : currentPhase === 1 ? ORACLE_BLUE : BRIGHT;

  // Phase labels
  const phaseLabels = [
    { label: "BETTING", sub: "10 min", color: GREEN },
    { label: "ORACLE", sub: "consensus", color: ORACLE_BLUE },
    { label: "SETTLE", sub: "payout", color: BRIGHT },
  ];

  // Parasite label stagger
  const parasiteLabels = [
    { text: "SEALED BETS", delay: 0.1, color: GREEN },
    { text: "BLS CONSENSUS", delay: 0.55, color: ORACLE_BLUE },
    { text: "PARIMUTUEL ENGINE", delay: 0.6, color: DIM },
    { text: "INSTANT WITHDRAWAL", delay: 0.8, color: BRIGHT },
  ];

  return (
    <AbsoluteFill
      style={{
        justifyContent: "flex-end",
        alignItems: "center",
        paddingBottom: 40,
        opacity,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          ...PANEL,
          padding: "28px 48px 36px",
          width: barWidth + 96,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 12,
        }}
      >
        {/* Current phase label */}
        <div
          style={{
            fontFamily: monoFont,
            fontSize: 20,
            fontWeight: 700,
            color: phaseLabels[currentPhase].color,
            letterSpacing: 4,
          }}
        >
          {phaseLabels[currentPhase].label}
        </div>

        {/* Bet blocks dropping area */}
        <div style={{ position: "relative", width: barWidth, height: 36, overflow: "hidden" }}>
          {currentPhase === 0 &&
            blocks.map((block, i) => {
              const blockDelay = i / blocks.length;
              const blockProg = interpolate(bettingProgress, [blockDelay, blockDelay + 0.15], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              });
              const blockY = interpolate(blockProg, [0, 1], [-30, 4], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
                easing: EASE.out,
              });
              return (
                <div
                  key={i}
                  style={{
                    position: "absolute",
                    left: block.x,
                    top: blockY,
                    opacity: blockProg,
                    width: 32,
                    height: 28,
                    borderRadius: 4,
                    background: block.color === GREEN ? "rgba(0,200,83,0.25)" : "rgba(220,38,38,0.25)",
                    border: `1.5px solid ${block.color}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontFamily: monoFont,
                    fontSize: 8,
                    fontWeight: 700,
                    color: block.color,
                  }}
                >
                  {block.label}
                </div>
              );
            })}

          {/* Oracle pulse nodes */}
          {oracleActive && currentPhase === 1 && (
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                gap: 24,
                width: "100%",
                height: "100%",
              }}
            >
              {[1, 2, 3].map((n) => (
                <div
                  key={n}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: "50%",
                    background: ORACLE_BLUE,
                    opacity: 0.6 + 0.4 * oraclePulse,
                    boxShadow: `0 0 ${8 + 6 * oraclePulse}px rgba(99,102,241,${0.4 + 0.3 * oraclePulse})`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontFamily: monoFont,
                    fontSize: 11,
                    fontWeight: 700,
                    color: BRIGHT,
                  }}
                >
                  {n}
                </div>
              ))}
            </div>
          )}

          {/* Settle $ signs */}
          {settleActive &&
            Array.from({ length: 6 }).map((_, i) => {
              const dollarDelay = i * 0.12;
              const dollarOp = interpolate(settleProgress, [dollarDelay, dollarDelay + 0.3], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              });
              const dollarX = 200 + i * 140;
              const dollarY = interpolate(dollarOp, [0, 1], [20, 0], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              });
              return (
                <div
                  key={i}
                  style={{
                    position: "absolute",
                    left: dollarX,
                    top: dollarY,
                    opacity: dollarOp,
                    fontFamily: monoFont,
                    fontSize: 18,
                    fontWeight: 700,
                    color: GREEN,
                  }}
                >
                  $
                </div>
              );
            })}
        </div>

        {/* Progress bar */}
        <div
          style={{
            width: barWidth,
            height: barHeight,
            borderRadius: barHeight / 2,
            background: "rgba(255,255,255,0.06)",
            overflow: "hidden",
            position: "relative",
          }}
        >
          <div
            style={{
              width: filledWidth,
              height: "100%",
              borderRadius: barHeight / 2,
              background: barColor,
              transition: "background 0.3s",
            }}
          />
          {/* Phase dividers */}
          <div
            style={{
              position: "absolute",
              left: `${PHASE_BETTING_END * 100}%`,
              top: 0,
              width: 1.5,
              height: "100%",
              background: "rgba(255,255,255,0.15)",
            }}
          />
          <div
            style={{
              position: "absolute",
              left: `${PHASE_ORACLE_END * 100}%`,
              top: 0,
              width: 1.5,
              height: "100%",
              background: "rgba(255,255,255,0.15)",
            }}
          />
        </div>

        {/* Phase labels below bar */}
        <div style={{ width: barWidth, display: "flex", position: "relative", height: 16 }}>
          <div
            style={{
              position: "absolute",
              left: 0,
              width: `${PHASE_BETTING_END * 100}%`,
              textAlign: "center",
              fontFamily: monoFont,
              fontSize: 9,
              color: GREEN,
              letterSpacing: 2,
              fontWeight: 700,
            }}
          >
            BETTING (10 min)
          </div>
          <div
            style={{
              position: "absolute",
              left: `${PHASE_BETTING_END * 100}%`,
              width: `${(PHASE_ORACLE_END - PHASE_BETTING_END) * 100}%`,
              textAlign: "center",
              fontFamily: monoFont,
              fontSize: 9,
              color: ORACLE_BLUE,
              letterSpacing: 2,
              fontWeight: 700,
            }}
          >
            ORACLE
          </div>
          <div
            style={{
              position: "absolute",
              left: `${PHASE_ORACLE_END * 100}%`,
              width: `${(1 - PHASE_ORACLE_END) * 100}%`,
              textAlign: "center",
              fontFamily: monoFont,
              fontSize: 9,
              color: BRIGHT,
              letterSpacing: 2,
              fontWeight: 700,
            }}
          >
            SETTLE
          </div>
        </div>

        {/* Parasite labels row */}
        <div style={{ display: "flex", gap: 20, flexWrap: "wrap", justifyContent: "center", marginTop: 4 }}>
          {parasiteLabels.map((pl) => {
            const plOp = interpolate(progress, [pl.delay, pl.delay + 0.08], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            return (
              <ParasiteLabel key={pl.text} text={pl.text} color={pl.color} style={{ opacity: plOp }} />
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// DIAGRAM 3: Oracle Architecture (ZONE B+C — wide)
// ---------------------------------------------------------------------------

const OracleArchitecture: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const opacity = fadeEnterExit(frame, ORACLE_IN, ORACLE_OUT, 15);
  const localFrame = frame - ORACLE_IN;
  const totalDuration = ORACLE_OUT - ORACLE_IN;

  // Tier stagger — each tier draws top-down
  const tier1Progress = interpolate(localFrame, [0, totalDuration * 0.2], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE.out,
  });
  const tier2Progress = interpolate(localFrame, [totalDuration * 0.2, totalDuration * 0.45], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE.out,
  });
  const tier3Progress = interpolate(localFrame, [totalDuration * 0.45, totalDuration * 0.65], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE.out,
  });
  const tier4Progress = interpolate(localFrame, [totalDuration * 0.65, totalDuration * 0.85], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE.out,
  });

  // BLS convergence lines
  const blsProgress = interpolate(localFrame, [totalDuration * 0.5, totalDuration * 0.7], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE.smooth,
  });

  // Oracle node pulse
  const pulse = 0.5 + 0.5 * Math.sin((localFrame / fps) * Math.PI * 3);

  // Parasite labels
  const parasites = [
    { text: "INDEPENDENT COMPUTATION", delay: 0.25, color: DIM },
    { text: "THRESHOLD CONSENSUS", delay: 0.5, color: ORACLE_BLUE },
    { text: "ON-CHAIN VERIFICATION", delay: 0.65, color: DIM },
    { text: "ATOMIC SETTLEMENT", delay: 0.85, color: GREEN },
  ];

  const parasiteProgress = interpolate(localFrame, [0, totalDuration], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const dataFeeds = ["Twitch API", "DB API", "Steam API", "Pump.fun"];
  const oracleNodes = ["Oracle 1", "Oracle 2", "Oracle 3"];

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
          ...PANEL,
          padding: "36px 56px 44px",
          width: 900,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 0,
        }}
      >
        {/* TIER 1: DATA FEEDS */}
        <div style={{ opacity: tier1Progress, marginBottom: 8 }}>
          <div
            style={{
              fontFamily: monoFont,
              fontSize: 10,
              fontWeight: 700,
              color: DIM,
              letterSpacing: 3,
              textAlign: "center",
              marginBottom: 10,
            }}
          >
            DATA FEEDS
          </div>
          <div style={{ display: "flex", gap: 16, justifyContent: "center" }}>
            {dataFeeds.map((feed, i) => {
              const feedOp = interpolate(tier1Progress, [i * 0.2, i * 0.2 + 0.4], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              });
              return (
                <div
                  key={feed}
                  style={{
                    opacity: feedOp,
                    padding: "8px 16px",
                    borderRadius: 6,
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    fontFamily: monoFont,
                    fontSize: 11,
                    fontWeight: 500,
                    color: BRIGHT,
                    whiteSpace: "nowrap",
                  }}
                >
                  {feed}
                </div>
              );
            })}
          </div>
        </div>

        {/* Connection lines: feeds → oracles */}
        <svg width={800} height={30} style={{ opacity: tier2Progress * 0.6 }}>
          {[160, 300, 440, 580].map((x, i) => (
            <line
              key={i}
              x1={x}
              y1={0}
              x2={200 + i * 150 - (i > 1 ? (i - 1) * 50 : 0)}
              y2={30}
              stroke="rgba(255,255,255,0.12)"
              strokeWidth={1}
              strokeDasharray="4 3"
            />
          ))}
        </svg>

        {/* TIER 2: ORACLE NODES */}
        <div style={{ opacity: tier2Progress, marginBottom: 0 }}>
          <div
            style={{
              fontFamily: monoFont,
              fontSize: 10,
              fontWeight: 700,
              color: DIM,
              letterSpacing: 3,
              textAlign: "center",
              marginBottom: 12,
            }}
          >
            ORACLE NODES
          </div>
          <div style={{ display: "flex", gap: 48, justifyContent: "center" }}>
            {oracleNodes.map((name, i) => {
              const nodeOp = interpolate(tier2Progress, [i * 0.25, i * 0.25 + 0.5], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              });
              return (
                <div
                  key={name}
                  style={{
                    opacity: nodeOp,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <div
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: "50%",
                      background: ORACLE_BLUE,
                      border: "2px solid rgba(255,255,255,0.25)",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      boxShadow: `0 0 ${10 + 8 * pulse}px rgba(99,102,241,${0.25 + 0.2 * pulse})`,
                    }}
                  >
                    <div
                      style={{
                        fontFamily: monoFont,
                        fontSize: 16,
                        fontWeight: 700,
                        color: BRIGHT,
                      }}
                    >
                      {i + 1}
                    </div>
                  </div>
                  <div
                    style={{
                      fontFamily: monoFont,
                      fontSize: 9,
                      fontWeight: 700,
                      color: DIM,
                      letterSpacing: 1.5,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {name}
                  </div>
                  <div
                    style={{
                      fontFamily: monoFont,
                      fontSize: 8,
                      color: "rgba(255,255,255,0.3)",
                      letterSpacing: 1,
                    }}
                  >
                    Compute + Sign (BLS)
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* BLS convergence SVG */}
        <svg width={400} height={40} style={{ opacity: blsProgress }}>
          {/* Three lines converging to center bottom */}
          {[100, 200, 300].map((x, i) => {
            const lineLen = interpolate(blsProgress, [0, 1], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            return (
              <line
                key={i}
                x1={x}
                y1={0}
                x2={x + (200 - x) * lineLen}
                y2={35 * lineLen}
                stroke={ORACLE_BLUE}
                strokeWidth={1.5}
                opacity={0.6 + 0.4 * pulse}
              />
            );
          })}
          {/* Aggregation point */}
          <circle
            cx={200}
            cy={35}
            r={4}
            fill={GREEN}
            opacity={blsProgress}
          />
        </svg>

        {/* "Aggregated BLS Signature" label */}
        <div
          style={{
            fontFamily: monoFont,
            fontSize: 9,
            color: ORACLE_BLUE,
            letterSpacing: 2,
            opacity: blsProgress,
            marginBottom: 8,
          }}
        >
          AGGREGATED BLS SIGNATURE
        </div>

        {/* TIER 3: SMART CONTRACT */}
        <div
          style={{
            opacity: tier3Progress,
            padding: "12px 32px",
            borderRadius: 8,
            background: "rgba(0,200,83,0.08)",
            border: `1.5px solid rgba(0,200,83,0.3)`,
            fontFamily: monoFont,
            fontSize: 13,
            fontWeight: 700,
            color: GREEN,
            letterSpacing: 2,
            textAlign: "center",
            marginBottom: 12,
          }}
        >
          SMART CONTRACT — VERIFY + SETTLE
        </div>

        {/* Arrow down */}
        <svg width={20} height={20} style={{ opacity: tier4Progress }}>
          <path d="M10,0 L10,14 M5,10 L10,16 L15,10" stroke={GREEN} strokeWidth={1.5} fill="none" />
        </svg>

        {/* TIER 4: PNL DISTRIBUTED */}
        <div
          style={{
            opacity: tier4Progress,
            marginTop: 4,
            padding: "10px 28px",
            borderRadius: 6,
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.1)",
            fontFamily: monoFont,
            fontSize: 13,
            fontWeight: 700,
            color: BRIGHT,
            letterSpacing: 2,
          }}
        >
          PNL DISTRIBUTED
        </div>

        {/* Parasite labels */}
        <div
          style={{
            display: "flex",
            gap: 16,
            flexWrap: "wrap",
            justifyContent: "center",
            marginTop: 16,
          }}
        >
          {parasites.map((p) => {
            const pOp = interpolate(parasiteProgress, [p.delay, p.delay + 0.1], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            return <ParasiteLabel key={p.text} text={p.text} color={p.color} style={{ opacity: pOp }} />;
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// DIAGRAM 4: Price Comparison (ZONE B+C split)
// ---------------------------------------------------------------------------

const PriceComparison: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const opacity = fadeEnterExit(frame, PRICE_IN, PRICE_OUT, 10);
  const localFrame = frame - PRICE_IN;
  const totalDuration = PRICE_OUT - PRICE_IN;

  // Candle chart animation
  const candleProgress = interpolate(localFrame, [0, totalDuration * 0.4], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE.out,
  });

  // Settlement dot
  const dotProgress = interpolate(localFrame, [totalDuration * 0.2, totalDuration * 0.5], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE.out,
  });

  // "NO ORDERBOOK. NO PRICE." overlay
  const overlayProgress = interpolate(localFrame, [totalDuration * 0.45, totalDuration * 0.6], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const overlaySpring = spring({
    frame: Math.max(localFrame - Math.round(totalDuration * 0.45), 0),
    fps,
    config: { damping: 10, stiffness: 160, mass: 0.6 },
  });
  const overlayScale = interpolate(overlaySpring, [0, 1], [1.2, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Fees comparison
  const feesOpacity = interpolate(localFrame, [totalDuration * 0.65, totalDuration * 0.8], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Candle data (open, close, high, low — normalized 0-1)
  const candles = [
    { o: 0.45, c: 0.55, h: 0.65, l: 0.35 },
    { o: 0.55, c: 0.42, h: 0.62, l: 0.38 },
    { o: 0.42, c: 0.58, h: 0.7, l: 0.35 },
    { o: 0.58, c: 0.48, h: 0.65, l: 0.4 },
    { o: 0.48, c: 0.62, h: 0.72, l: 0.42 },
    { o: 0.62, c: 0.52, h: 0.68, l: 0.45 },
  ];

  const chartH = 140;
  const chartW = 180;
  const candleW = 16;
  const candleGap = 12;

  // Parasite labels
  const parasiteLabels = [
    { text: "NO FRONT-RUNNING", delay: 0.5, color: GREEN },
    { text: "NO MEV", delay: 0.6, color: GREEN },
    { text: "NO MANIPULATION", delay: 0.7, color: GREEN },
    { text: "$0 FEES", delay: 0.8, color: GREEN },
  ];

  const parasiteP = interpolate(localFrame, [0, totalDuration], [0, 1], {
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
          ...PANEL,
          padding: "36px 48px 44px",
          width: 880,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 20,
        }}
      >
        {/* Two-column split */}
        <div style={{ display: "flex", gap: 48, width: "100%", justifyContent: "center" }}>
          {/* LEFT: Traditional candle chart */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, flex: 1 }}>
            <div
              style={{
                fontFamily: monoFont,
                fontSize: 10,
                fontWeight: 700,
                color: RED,
                letterSpacing: 2,
              }}
            >
              TRADITIONAL
            </div>
            <svg width={chartW} height={chartH} viewBox={`0 0 ${chartW} ${chartH}`}>
              {candles.map((c, i) => {
                const candleDelay = i / candles.length;
                const cOp = interpolate(candleProgress, [candleDelay, candleDelay + 0.3], [0, 1], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                });
                const x = 10 + i * (candleW + candleGap);
                const bullish = c.c > c.o;
                const bodyTop = (1 - Math.max(c.o, c.c)) * chartH;
                const bodyBot = (1 - Math.min(c.o, c.c)) * chartH;
                const bodyH = bodyBot - bodyTop;
                const wickTop = (1 - c.h) * chartH;
                const wickBot = (1 - c.l) * chartH;
                const color = bullish ? GREEN : RED;

                return (
                  <g key={i} opacity={cOp}>
                    {/* Wick */}
                    <line
                      x1={x + candleW / 2}
                      y1={wickTop}
                      x2={x + candleW / 2}
                      y2={wickBot}
                      stroke={color}
                      strokeWidth={1.5}
                    />
                    {/* Body */}
                    <rect
                      x={x}
                      y={bodyTop}
                      width={candleW}
                      height={Math.max(2, bodyH)}
                      fill={bullish ? color : "transparent"}
                      stroke={color}
                      strokeWidth={1.5}
                      rx={2}
                    />
                  </g>
                );
              })}
            </svg>
            <div
              style={{
                fontFamily: font,
                fontSize: 13,
                fontWeight: 600,
                color: DIM,
              }}
            >
              Continuous price
            </div>
            {/* Fees label */}
            <div
              style={{
                fontFamily: monoFont,
                fontSize: 11,
                color: RED,
                opacity: feesOpacity,
                letterSpacing: 1,
              }}
            >
              Polymarket: {COMPARISONS.polymarketFees} fees
            </div>
          </div>

          {/* Divider */}
          <div style={{ width: 1, background: "rgba(255,255,255,0.1)", alignSelf: "stretch" }} />

          {/* RIGHT: Flat line + settlement dot */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, flex: 1 }}>
            <div
              style={{
                fontFamily: monoFont,
                fontSize: 10,
                fontWeight: 700,
                color: GREEN,
                letterSpacing: 2,
              }}
            >
              GENERAL MARKET
            </div>
            <svg width={chartW} height={chartH} viewBox={`0 0 ${chartW} ${chartH}`}>
              {/* Flat line */}
              <line
                x1={10}
                y1={chartH / 2}
                x2={10 + (chartW - 30) * dotProgress}
                y2={chartH / 2}
                stroke="rgba(255,255,255,0.2)"
                strokeWidth={2}
                strokeDasharray="6 4"
              />
              {/* Settlement dot */}
              {dotProgress > 0.8 && (
                <circle
                  cx={chartW - 20}
                  cy={chartH / 2}
                  r={8}
                  fill={GREEN}
                  opacity={interpolate(dotProgress, [0.8, 1], [0, 1], {
                    extrapolateLeft: "clamp",
                    extrapolateRight: "clamp",
                  })}
                >
                  <animate
                    attributeName="r"
                    values="6;9;6"
                    dur="1s"
                    repeatCount="indefinite"
                  />
                </circle>
              )}
              {/* "?" marks along the line */}
              {[0.2, 0.4, 0.6].map((pos, i) => (
                <text
                  key={i}
                  x={10 + pos * (chartW - 30)}
                  y={chartH / 2 - 14}
                  fontFamily={monoFont}
                  fontSize={10}
                  fill="rgba(255,255,255,0.15)"
                  textAnchor="middle"
                  opacity={dotProgress > pos ? 1 : 0}
                >
                  ?
                </text>
              ))}
            </svg>
            <div
              style={{
                fontFamily: font,
                fontSize: 13,
                fontWeight: 600,
                color: DIM,
              }}
            >
              Result at settlement
            </div>
            {/* Fees label */}
            <div
              style={{
                fontFamily: monoFont,
                fontSize: 11,
                color: GREEN,
                opacity: feesOpacity,
                letterSpacing: 1,
              }}
            >
              GM: {COMPARISONS.gmFees} fees
            </div>
          </div>
        </div>

        {/* Big overlay text */}
        <div
          style={{
            fontFamily: font,
            fontSize: 36,
            fontWeight: 900,
            color: BRIGHT,
            letterSpacing: -1,
            textAlign: "center",
            opacity: overlayProgress,
            transform: `scale(${overlayScale})`,
            textShadow: `0 0 40px rgba(0,200,83,0.3)`,
            lineHeight: 1.3,
          }}
        >
          NO ORDERBOOK.{" "}
          <span style={{ color: GREEN }}>NO PRICE.</span>
        </div>

        {/* Parasite labels */}
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", justifyContent: "center" }}>
          {parasiteLabels.map((pl) => {
            const plOp = interpolate(parasiteP, [pl.delay, pl.delay + 0.1], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            return <ParasiteLabel key={pl.text} text={pl.text} color={pl.color} style={{ opacity: plOp }} />;
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// Parasite Label — reusable floating annotation
// ---------------------------------------------------------------------------

const ParasiteLabel: React.FC<{
  text: string;
  color: string;
  style?: React.CSSProperties;
}> = ({ text, color, style }) => (
  <div
    style={{
      fontFamily: monoFont,
      fontSize: 9,
      fontWeight: 700,
      color,
      letterSpacing: 2.5,
      textTransform: "uppercase",
      whiteSpace: "nowrap",
      ...style,
    }}
  >
    {text}
  </div>
);

// ---------------------------------------------------------------------------
// Main Export
// ---------------------------------------------------------------------------

export const SettlementDiagrams: React.FC = () => {
  return (
    <AbsoluteFill>
      {/* 1. Germany Rail Map */}
      <GermanyRailMap />
      <Sequence from={MAP_IN}>
        <Audio src={staticFile("sfx/whoosh-scene-grid.mp3")} volume={0.5} />
      </Sequence>

      {/* 2. 10-Min Cycle Timeline */}
      <CycleTimeline />
      <Sequence from={CYCLE_IN}>
        <Audio src={staticFile("sfx/scroll-tick.mp3")} volume={0.4} />
      </Sequence>
      <Sequence from={Math.round(CYCLE_IN + (CYCLE_OUT - CYCLE_IN) * 0.55)}>
        <Audio src={staticFile("sfx/scroll-tick.mp3")} volume={0.4} />
      </Sequence>
      <Sequence from={Math.round(CYCLE_IN + (CYCLE_OUT - CYCLE_IN) * 0.78)}>
        <Audio src={staticFile("sfx/scroll-tick.mp3")} volume={0.4} />
      </Sequence>

      {/* 3. Oracle Architecture */}
      <OracleArchitecture />

      {/* 4. Price Comparison */}
      <PriceComparison />
      <Sequence from={Math.round(PRICE_IN + (PRICE_OUT - PRICE_IN) * 0.45)}>
        <Audio src={staticFile("sfx/boom-cinematic.mp3")} volume={0.5} />
      </Sequence>
    </AbsoluteFill>
  );
};
