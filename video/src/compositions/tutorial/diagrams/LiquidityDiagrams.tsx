import React, { useMemo } from "react";
import {
  AbsoluteFill,
  Audio,
  Sequence,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { evolvePath } from "@remotion/paths";
import { font, monoFont } from "../../../common/fonts";
import { EASE } from "../../../common/easing";
import { C } from "../../../common/colors";
import { lerp } from "../../../common/utils";
import { BRAND_GREEN, FPS, PANEL } from "../theme";

// ─── Timing ────────────────────────────────────────────────────────────────
// All frames LOCAL to the liquidityDiagram Sequence (starts at 48.64s video).
// My section: 57.8s–89.8s video → local 274–1236.
const SEC = FPS;

const T = {
  // Batch Anatomy Card: 57.8–62.4s video → local 274–414
  batchIn: Math.round((57.8 - 48.64) * FPS),
  batchOut: Math.round((62.4 - 48.64) * FPS),

  // Mandatory Fill Network: 62.4–72.1s → local 414–703
  fillIn: Math.round((62.4 - 48.64) * FPS),
  fillOut: Math.round((72.1 - 48.64) * FPS),

  // Coverage Heatmap: 72.1–84.8s → local 703–1085
  coverIn: Math.round((72.1 - 48.64) * FPS),
  coverOut: Math.round((84.8 - 48.64) * FPS),

  // Skill Bell Curve: 84.8–89.8s → local 1085–1235
  bellIn: Math.round((84.8 - 48.64) * FPS),
  bellOut: Math.round((89.84 - 48.64) * FPS),
} as const;

// ─── Shared styles ─────────────────────────────────────────────────────────
const parasiteStyle: React.CSSProperties = {
  fontFamily: monoFont,
  fontSize: 13,
  fontWeight: 500,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: C.gray[400],
};

const panelBg: React.CSSProperties = {
  ...PANEL,
  padding: 20,
};

// ─── Deterministic RNG ─────────────────────────────────────────────────────
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ─── Parasite Label ────────────────────────────────────────────────────────
const ParasiteLabel: React.FC<{
  text: string;
  x: number;
  y: number;
  frame: number;
  appearAt: number;
  color?: string;
  anchor?: "left" | "right" | "center";
}> = ({ text, x, y, frame, appearAt, color, anchor = "left" }) => {
  const localF = frame - appearAt;
  if (localF < 0) return null;

  const opacity = lerp(localF, [0, 9], [0, 1], EASE.out);
  // Subtle pulse on first appearance
  const pulse =
    localF < 20 ? 1 + Math.sin((localF / 20) * Math.PI) * 0.08 : 1;

  const textAlign =
    anchor === "right" ? "right" : anchor === "center" ? "center" : "left";

  return (
    <div
      style={{
        position: "absolute",
        left: anchor === "right" ? undefined : x,
        right: anchor === "right" ? 1920 - x : undefined,
        top: y,
        opacity,
        transform: `scale(${pulse})`,
        transformOrigin: anchor === "right" ? "right center" : "left center",
        ...parasiteStyle,
        color: color ?? C.gray[400],
        textAlign,
        whiteSpace: "nowrap",
      }}
    >
      {text}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// 1. BATCH ANATOMY CARD (57.8–62.4s)
// ═══════════════════════════════════════════════════════════════════════════
const STREAMER_NAMES = [
  "xQc",
  "pokimane",
  "shroud",
  "Amouranth",
  "HasanAbi",
  "Kai Cenat",
  "ibai",
  "Tarik",
  "summit1g",
  "NICKMERCS",
  "Sodapoppin",
  "Myth",
];

const BatchAnatomyCard: React.FC<{ frame: number; fps: number }> = ({
  frame,
  fps,
}) => {
  const localF = frame - T.batchIn;
  if (localF < 0) return null;

  const cardSpring = spring({
    frame: localF,
    fps,
    config: { damping: 16, stiffness: 100, mass: 0.9 },
  });

  const fadeOut = lerp(frame, [T.batchOut - 12, T.batchOut], [1, 0], EASE.smooth);

  // Progressive row reveal: stagger 3 frames per row
  const visibleRows = Math.min(
    STREAMER_NAMES.length,
    Math.floor((localF - 12) / 3),
  );

  // Scroll offset — once we have many rows, scroll upward
  const scrollOffset =
    visibleRows > 5 ? Math.min((visibleRows - 5) * 28, 180) : 0;

  return (
    <AbsoluteFill style={{ opacity: fadeOut }}>
      {/* Card — ZONE B+C wide, positioned top-heavy to sit above face vertical center */}
      <div
        style={{
          position: "absolute",
          left: "5%",
          right: "5%",
          top: "2%",
          display: "flex",
          justifyContent: "center",
          alignItems: "flex-start",
        }}
      >
        <div
          style={{
            ...panelBg,
            width: 680,
            maxHeight: 500,
            transform: `translateY(${lerp(cardSpring, [0, 1], [60, 0])}px)`,
            opacity: cardSpring,
            overflow: "hidden",
            border: `1px solid ${C.gray[700]}`,
          }}
        >
          {/* Header */}
          <div
            style={{
              fontFamily: font,
              fontWeight: 800,
              fontSize: 22,
              color: C.white,
              marginBottom: 14,
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: BRAND_GREEN,
                boxShadow: `0 0 8px ${BRAND_GREEN}80`,
              }}
            />
            BATCH: Twitch Viewers
          </div>

          {/* Config row */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 6,
              marginBottom: 14,
              padding: "10px 14px",
              background: "rgba(255,255,255,0.04)",
              borderRadius: 8,
            }}
          >
            {[
              ["Source", "Twitch API"],
              ["Assets", "5,000"],
              ["Tick", "10 min"],
              ["Type", "Viewer Count"],
            ].map(([k, v]) => (
              <div key={k} style={{ display: "flex", gap: 6 }}>
                <span
                  style={{
                    fontFamily: monoFont,
                    fontSize: 12,
                    color: C.gray[500],
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                  }}
                >
                  {k}:
                </span>
                <span
                  style={{
                    fontFamily: monoFont,
                    fontSize: 12,
                    color: C.gray[200],
                    fontWeight: 500,
                  }}
                >
                  {v}
                </span>
              </div>
            ))}
          </div>

          {/* Submarket rows */}
          <div
            style={{
              height: 170,
              overflow: "hidden",
              position: "relative",
            }}
          >
            <div
              style={{
                transform: `translateY(-${scrollOffset}px)`,
                transition: "transform 0.2s ease",
              }}
            >
              {STREAMER_NAMES.map((name, i) => {
                const rowOpacity = i < visibleRows ? 1 : 0;
                return (
                  <div
                    key={name}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "4px 10px",
                      opacity: rowOpacity,
                      borderBottom: `1px solid ${C.gray[800]}`,
                    }}
                  >
                    <span
                      style={{
                        fontFamily: monoFont,
                        fontSize: 13,
                        color: C.gray[300],
                      }}
                    >
                      #{i + 1} {name}
                    </span>
                    <div style={{ display: "flex", gap: 6 }}>
                      <span
                        style={{
                          fontFamily: monoFont,
                          fontSize: 11,
                          padding: "2px 8px",
                          borderRadius: 4,
                          backgroundColor: "rgba(34,197,94,0.15)",
                          color: C.success,
                          fontWeight: 600,
                        }}
                      >
                        YES
                      </span>
                      <span
                        style={{
                          fontFamily: monoFont,
                          fontSize: 11,
                          padding: "2px 8px",
                          borderRadius: 4,
                          backgroundColor: "rgba(239,68,68,0.15)",
                          color: C.danger,
                          fontWeight: 600,
                        }}
                      >
                        NO
                      </span>
                    </div>
                  </div>
                );
              })}
              {/* Ellipsis row */}
              {visibleRows >= STREAMER_NAMES.length && (
                <div
                  style={{
                    padding: "6px 10px",
                    fontFamily: monoFont,
                    fontSize: 12,
                    color: C.gray[600],
                  }}
                >
                  ... Submarket 5000: user_xyz
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div
            style={{
              marginTop: 12,
              padding: "8px 14px",
              background: "rgba(255,255,255,0.04)",
              borderRadius: 8,
              display: "flex",
              justifyContent: "space-between",
            }}
          >
            <span
              style={{
                fontFamily: monoFont,
                fontSize: 12,
                color: C.gray[400],
              }}
            >
              Settlement: Parimutuel
            </span>
            <span
              style={{
                fontFamily: monoFont,
                fontSize: 12,
                color: C.gray[400],
              }}
            >
              Oracle: 3-node BLS
            </span>
          </div>
        </div>
      </div>

      {/* Parasite labels — positioned outside card, around ZONE B+C edges */}
      <ParasiteLabel
        text="5000 SIMULTANEOUS MARKETS"
        x={100}
        y={540}
        frame={frame}
        appearAt={T.batchIn + 18}
        color={BRAND_GREEN}
      />
      <ParasiteLabel
        text="ONE BATCH = ONE BET"
        x={1820}
        y={540}
        frame={frame}
        appearAt={T.batchIn + 24}
        color={BRAND_GREEN}
        anchor="right"
      />
      <ParasiteLabel
        text="2.55M AVG CONCURRENT VIEWERS"
        x={100}
        y={580}
        frame={frame}
        appearAt={T.batchIn + 30}
      />
      <ParasiteLabel
        text="7.06M CHANNELS WENT LIVE IN 2026"
        x={1820}
        y={580}
        frame={frame}
        appearAt={T.batchIn + 36}
        anchor="right"
      />
    </AbsoluteFill>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// 2. MANDATORY FILL NETWORK (62.4–72.1s)
// ═══════════════════════════════════════════════════════════════════════════
const MARKET_LABELS_TRAD = [
  "Market A",
  "Market B",
  "Market C",
  "Market D",
  "Market E",
];

const MARKET_NODES_GM = 12; // visual count for the mesh

const MandatoryFillNetwork: React.FC<{ frame: number; fps: number }> = ({
  frame,
  fps,
}) => {
  const localF = frame - T.fillIn;
  if (localF < 0) return null;

  const fadeIn = lerp(localF, [0, 15], [0, 1], EASE.out);
  const fadeOut = lerp(frame, [T.fillOut - 15, T.fillOut], [1, 0], EASE.smooth);
  const opacity = Math.min(fadeIn, fadeOut);

  // Traditional side: arrows draw one-by-one (slow)
  const tradArrowProgress = (i: number) => {
    const stagger = i * 18; // 18 frames between each arrow
    return lerp(localF, [20 + stagger, 40 + stagger], [0, 1], EASE.out);
  };

  // GM side: ALL arrows draw simultaneously (fast flash at frame 60)
  const gmFlashFrame = 60;
  const gmArrowProgress = lerp(
    localF,
    [gmFlashFrame, gmFlashFrame + 6],
    [0, 1],
    EASE.snap,
  );

  // GM glow pulse
  const glowPulse =
    localF > gmFlashFrame
      ? 1 + Math.sin(((localF - gmFlashFrame) / FPS) * 4) * 0.3
      : 0;

  // Node positions for GM mesh (radial around center)
  const gmNodes = useMemo(() => {
    const cx = 150;
    const cy = 150;
    const r = 110;
    return Array.from({ length: MARKET_NODES_GM }, (_, i) => {
      const angle = (i / MARKET_NODES_GM) * Math.PI * 2 - Math.PI / 2;
      return {
        x: cx + Math.cos(angle) * r,
        y: cy + Math.sin(angle) * r,
      };
    });
  }, []);

  return (
    <AbsoluteFill style={{ opacity }}>
      {/* Split layout: B (left 2-33%) and C (right 67-98%), face center clear */}
      <div
        style={{
          position: "absolute",
          top: "10%",
          bottom: "15%",
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "space-between",
          padding: "0 2%",
        }}
      >
        {/* LEFT: Traditional — single exposure (ZONE B: 0-33%) */}
        <div
          style={{
            width: "31%",
            ...panelBg,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
          }}
        >
          <div
            style={{
              fontFamily: font,
              fontWeight: 700,
              fontSize: 16,
              color: C.gray[400],
              textTransform: "uppercase",
              letterSpacing: 2,
              marginBottom: 20,
            }}
          >
            Traditional
          </div>

          <svg width={300} height={300} viewBox="0 0 300 300">
            {/* Trader node at left */}
            <rect
              x={10}
              y={130}
              width={70}
              height={36}
              rx={6}
              fill={C.gray[800]}
              stroke={C.gray[600]}
              strokeWidth={1}
            />
            <text
              x={45}
              y={153}
              textAnchor="middle"
              fill={C.gray[300]}
              fontFamily={font}
              fontSize={12}
              fontWeight={600}
            >
              TRADER
            </text>

            {/* Market nodes stacked on right */}
            {MARKET_LABELS_TRAD.map((label, i) => {
              const y = 50 + i * 50;
              const isActive = i === 0;
              const arrowP = tradArrowProgress(i);

              return (
                <React.Fragment key={label}>
                  {/* Arrow line */}
                  <line
                    x1={80}
                    y1={148}
                    x2={190}
                    y2={y + 16}
                    stroke={isActive ? C.danger : C.gray[700]}
                    strokeWidth={isActive ? 2 : 1}
                    strokeDasharray={200}
                    strokeDashoffset={200 * (1 - arrowP)}
                    opacity={isActive ? 1 : 0.3}
                  />
                  {/* Arrow head */}
                  {arrowP > 0.9 && (
                    <circle
                      cx={190}
                      cy={y + 16}
                      r={3}
                      fill={isActive ? C.danger : C.gray[700]}
                      opacity={isActive ? 1 : 0.3}
                    />
                  )}
                  {/* Market box */}
                  <rect
                    x={195}
                    y={y}
                    width={90}
                    height={32}
                    rx={6}
                    fill={isActive ? "rgba(239,68,68,0.12)" : C.gray[900]}
                    stroke={isActive ? C.danger : C.gray[700]}
                    strokeWidth={1}
                  />
                  <text
                    x={240}
                    y={y + 20}
                    textAnchor="middle"
                    fill={isActive ? C.danger : C.gray[600]}
                    fontFamily={monoFont}
                    fontSize={11}
                    fontWeight={500}
                  >
                    {label}
                  </text>
                </React.Fragment>
              );
            })}
          </svg>

          {/* "Pick one" label */}
          <div
            style={{
              ...parasiteStyle,
              color: C.danger,
              fontSize: 14,
              marginTop: 8,
            }}
          >
            PICK ONE.
          </div>
        </div>

        {/* RIGHT: GM — mesh network, ALL at once (ZONE C: 67-100%) */}
        <div
          style={{
            width: "31%",
            ...panelBg,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
            boxShadow:
              gmArrowProgress > 0.5
                ? `inset 0 0 ${40 * glowPulse}px ${BRAND_GREEN}15`
                : "none",
          }}
        >
          <div
            style={{
              fontFamily: font,
              fontWeight: 700,
              fontSize: 16,
              color: BRAND_GREEN,
              textTransform: "uppercase",
              letterSpacing: 2,
              marginBottom: 20,
            }}
          >
            General Market
          </div>

          <svg width={300} height={300} viewBox="0 0 300 300">
            {/* Center trader node */}
            <circle
              cx={150}
              cy={150}
              r={22}
              fill={`${BRAND_GREEN}20`}
              stroke={BRAND_GREEN}
              strokeWidth={1.5}
            />
            <text
              x={150}
              y={155}
              textAnchor="middle"
              fill={BRAND_GREEN}
              fontFamily={font}
              fontSize={10}
              fontWeight={700}
            >
              TRADER
            </text>

            {/* Radiating arrows to all market nodes */}
            {gmNodes.map((node, i) => {
              const dashLen = Math.sqrt(
                (node.x - 150) ** 2 + (node.y - 150) ** 2,
              );
              return (
                <React.Fragment key={i}>
                  <line
                    x1={150}
                    y1={150}
                    x2={node.x}
                    y2={node.y}
                    stroke={BRAND_GREEN}
                    strokeWidth={1.5}
                    strokeDasharray={dashLen}
                    strokeDashoffset={dashLen * (1 - gmArrowProgress)}
                    opacity={0.7 * gmArrowProgress}
                  />
                  {/* Market dot */}
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r={8}
                    fill={`${BRAND_GREEN}${
                      gmArrowProgress > 0.5 ? "30" : "10"
                    }`}
                    stroke={BRAND_GREEN}
                    strokeWidth={1}
                    opacity={gmArrowProgress}
                  />
                  {/* Glow on dots */}
                  {gmArrowProgress > 0.8 && (
                    <circle
                      cx={node.x}
                      cy={node.y}
                      r={12 * glowPulse}
                      fill="none"
                      stroke={BRAND_GREEN}
                      strokeWidth={0.5}
                      opacity={0.3}
                    />
                  )}
                </React.Fragment>
              );
            })}
          </svg>

          {/* "Mandatory fill: ALL 5000" */}
          <div
            style={{
              ...parasiteStyle,
              color: BRAND_GREEN,
              fontSize: 14,
              marginTop: 8,
              opacity: gmArrowProgress,
            }}
          >
            MANDATORY FILL: ALL 5000
          </div>
        </div>
      </div>

      {/* Parasite labels — below each panel */}
      <ParasiteLabel
        text="SINGLE EXPOSURE"
        x={120}
        y={880}
        frame={frame}
        appearAt={T.fillIn + 30}
        color={C.danger}
      />
      <ParasiteLabel
        text="= GUARANTEED LIQUIDITY"
        x={1800}
        y={880}
        frame={frame}
        appearAt={T.fillIn + gmFlashFrame + 10}
        color={BRAND_GREEN}
        anchor="right"
      />
    </AbsoluteFill>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// 3. COVERAGE HEATMAP (72.1–84.8s)
// ═══════════════════════════════════════════════════════════════════════════
const GRID_SIZE = 10;
const CELL = 28;
const CELL_GAP = 3;

const CoverageHeatmap: React.FC<{ frame: number; fps: number }> = ({
  frame,
  fps,
}) => {
  const localF = frame - T.coverIn;
  if (localF < 0) return null;

  const fadeIn = lerp(localF, [0, 15], [0, 1], EASE.out);
  const fadeOut = lerp(
    frame,
    [T.coverOut - 15, T.coverOut],
    [1, 0],
    EASE.smooth,
  );
  const opacity = Math.min(fadeIn, fadeOut);

  // Traditional: 5 cells green (deterministic positions)
  const tradActive = useMemo(() => {
    const rng = mulberry32(99);
    const indices = new Set<number>();
    while (indices.size < 5) {
      indices.add(Math.floor(rng() * GRID_SIZE * GRID_SIZE));
    }
    return indices;
  }, []);

  // GM: all cells light up with stagger
  const gmStaggerComplete = lerp(localF, [20, 60], [0, 1], EASE.out);

  // Pulse time for GM grid
  const pulseTime = localF / FPS;

  // Counter animation
  const tradCounter = Math.round(
    lerp(localF, [20, 50], [0, 5]),
  );
  const gmCounter = Math.round(
    lerp(localF, [20, 60], [0, 5000]),
  );

  const gridW = GRID_SIZE * (CELL + CELL_GAP);

  const renderGrid = (
    isGM: boolean,
    activeSet: Set<number> | null,
    stagger: number,
  ) => {
    const rng = mulberry32(isGM ? 77 : 33);
    return (
      <div style={{ position: "relative", width: gridW, height: gridW }}>
        {Array.from({ length: GRID_SIZE * GRID_SIZE }, (_, idx) => {
          const row = Math.floor(idx / GRID_SIZE);
          const col = idx % GRID_SIZE;
          const phase = rng() * Math.PI * 2;

          let isActive: boolean;
          let cellColor: string;

          if (isGM) {
            // Stagger reveal: cell activates based on its position
            const cellT = (row * GRID_SIZE + col) / (GRID_SIZE * GRID_SIZE);
            isActive = stagger > cellT;
            const pulse = isActive
              ? 1 + Math.sin(phase + pulseTime * 3) * 0.15
              : 1;
            cellColor = isActive ? BRAND_GREEN : C.gray[800];
            return (
              <div
                key={idx}
                style={{
                  position: "absolute",
                  left: col * (CELL + CELL_GAP),
                  top: row * (CELL + CELL_GAP),
                  width: CELL,
                  height: CELL,
                  borderRadius: 4,
                  backgroundColor: cellColor,
                  transform: `scale(${isActive ? pulse : 1})`,
                  opacity: isActive ? 0.85 : 0.2,
                  boxShadow: isActive
                    ? `0 0 6px ${BRAND_GREEN}50`
                    : "none",
                }}
              />
            );
          }

          // Traditional
          isActive = activeSet?.has(idx) ?? false;
          cellColor = isActive ? C.success : C.gray[800];
          return (
            <div
              key={idx}
              style={{
                position: "absolute",
                left: col * (CELL + CELL_GAP),
                top: row * (CELL + CELL_GAP),
                width: CELL,
                height: CELL,
                borderRadius: 4,
                backgroundColor: cellColor,
                opacity: isActive ? 0.85 : 0.15,
              }}
            />
          );
        })}
      </div>
    );
  };

  return (
    <AbsoluteFill style={{ opacity }}>
      {/* ZONE D — lower third */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: "42%",
          ...panelBg,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
        }}
      >
        <div style={{ display: "flex", gap: 80, alignItems: "flex-start" }}>
          {/* Traditional grid */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 10,
            }}
          >
            <div
              style={{
                fontFamily: font,
                fontWeight: 600,
                fontSize: 15,
                color: C.gray[400],
                textTransform: "uppercase",
                letterSpacing: 1.5,
              }}
            >
              Traditional: ~5% coverage
            </div>
            {renderGrid(false, tradActive, 0)}
            <div
              style={{
                fontFamily: monoFont,
                fontSize: 16,
                color: C.gray[500],
                fontWeight: 500,
              }}
            >
              {tradCounter} / 100 markets active
            </div>
          </div>

          {/* GM grid */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 10,
            }}
          >
            <div
              style={{
                fontFamily: font,
                fontWeight: 600,
                fontSize: 15,
                color: BRAND_GREEN,
                textTransform: "uppercase",
                letterSpacing: 1.5,
              }}
            >
              GM: 100% coverage
            </div>
            {renderGrid(true, null, gmStaggerComplete)}
            <div
              style={{
                fontFamily: monoFont,
                fontSize: 16,
                color: BRAND_GREEN,
                fontWeight: 500,
              }}
            >
              {gmCounter.toLocaleString()} / 5,000 markets active
            </div>
          </div>
        </div>
      </div>

      {/* Parasite labels — above the lower-third panel */}
      <ParasiteLabel
        text="DEAD LIQUIDITY"
        x={300}
        y={600}
        frame={frame}
        appearAt={T.coverIn + 40}
        color={C.gray[600]}
      />
      <ParasiteLabel
        text="NO GAPS"
        x={1620}
        y={600}
        frame={frame}
        appearAt={T.coverIn + 50}
        color={BRAND_GREEN}
        anchor="right"
      />
      <ParasiteLabel
        text="EVERY STREAMER TRADED"
        x={960}
        y={600}
        frame={frame}
        appearAt={T.coverIn + 60}
        color={BRAND_GREEN}
        anchor="center"
      />
    </AbsoluteFill>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// 4. SKILL BELL CURVE (84.8–89.8s)
// ═══════════════════════════════════════════════════════════════════════════

// Bell curve path — standard normal approximation, 400px wide, 200px tall
function bellCurvePath(): string {
  const W = 600;
  const H = 220;
  const pts: string[] = [];
  const steps = 120;

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = t * W;
    // Standard normal bell: e^(-((x-mu)^2)/(2*sigma^2))
    const z = (t - 0.5) * 6; // -3 to +3 std devs
    const y = H - Math.exp((-z * z) / 2) * H * 0.95;
    pts.push(`${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`);
  }

  return pts.join(" ");
}

// Filled area path (closes to baseline)
function bellCurveArea(): string {
  const W = 600;
  const H = 220;
  const pts: string[] = [];
  const steps = 120;

  pts.push(`M 0 ${H}`);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = t * W;
    const z = (t - 0.5) * 6;
    const y = H - Math.exp((-z * z) / 2) * H * 0.95;
    pts.push(`L ${x.toFixed(1)} ${y.toFixed(1)}`);
  }
  pts.push(`L ${W} ${H} Z`);

  return pts.join(" ");
}

const SkillBellCurve: React.FC<{ frame: number; fps: number }> = ({
  frame,
  fps,
}) => {
  const localF = frame - T.bellIn;
  if (localF < 0) return null;

  const fadeIn = lerp(localF, [0, 12], [0, 1], EASE.out);
  const fadeOut = lerp(
    frame,
    [T.bellOut - 10, T.bellOut],
    [1, 0],
    EASE.smooth,
  );
  const opacity = Math.min(fadeIn, fadeOut);

  const curvePath = useMemo(() => bellCurvePath(), []);
  const areaPath = useMemo(() => bellCurveArea(), []);

  // Stroke draw animation via evolvePath
  const strokeProgress = lerp(localF, [5, 45], [0, 1], EASE.out);
  const evolved = evolvePath(strokeProgress, curvePath);

  // Fill fade — starts after stroke is mostly drawn
  const fillOpacity = lerp(localF, [35, 55], [0, 0.4], EASE.smooth);

  // Annotation slide
  const annotSpring = spring({
    frame: Math.max(0, localF - 50),
    fps,
    config: { damping: 14, stiffness: 120, mass: 0.7 },
  });

  const W = 600;
  const H = 220;
  const PAD = 60;

  return (
    <AbsoluteFill style={{ opacity }}>
      {/* ZONE B+C — wide, top strip to stay above face vertical center */}
      <div
        style={{
          position: "absolute",
          left: "5%",
          right: "5%",
          top: "3%",
          height: "45%",
          ...panelBg,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <svg
          width={W + PAD * 2}
          height={H + PAD * 2}
          viewBox={`${-PAD} ${-PAD} ${W + PAD * 2} ${H + PAD * 2}`}
        >
          {/* Axes */}
          <line
            x1={0}
            y1={H}
            x2={W}
            y2={H}
            stroke={C.gray[600]}
            strokeWidth={1.5}
          />
          <line
            x1={0}
            y1={0}
            x2={0}
            y2={H}
            stroke={C.gray[600]}
            strokeWidth={1.5}
          />

          {/* X-axis label */}
          <text
            x={W / 2}
            y={H + 35}
            textAnchor="middle"
            fill={C.gray[400]}
            fontFamily={font}
            fontSize={14}
            fontWeight={600}
          >
            PNL
          </text>

          {/* Y-axis label */}
          <text
            x={-35}
            y={H / 2}
            textAnchor="middle"
            fill={C.gray[400]}
            fontFamily={font}
            fontSize={14}
            fontWeight={600}
            transform={`rotate(-90 -35 ${H / 2})`}
          >
            TRADERS
          </text>

          {/* Fill under curve — split into red (left tail) and green (right tail) */}
          {/* Left tail fill (losers): 0–40% of width */}
          <clipPath id="leftTail">
            <rect x={0} y={0} width={W * 0.38} height={H + 10} />
          </clipPath>
          <path
            d={areaPath}
            fill={C.danger}
            opacity={fillOpacity * 0.7}
            clipPath="url(#leftTail)"
          />

          {/* Center fill */}
          <clipPath id="center">
            <rect x={W * 0.38} y={0} width={W * 0.24} height={H + 10} />
          </clipPath>
          <path
            d={areaPath}
            fill={C.gray[600]}
            opacity={fillOpacity * 0.4}
            clipPath="url(#center)"
          />

          {/* Right tail fill (winners): 62–100% of width */}
          <clipPath id="rightTail">
            <rect x={W * 0.62} y={0} width={W * 0.38} height={H + 10} />
          </clipPath>
          <path
            d={areaPath}
            fill={C.success}
            opacity={fillOpacity * 0.7}
            clipPath="url(#rightTail)"
          />

          {/* Curve stroke — animated draw */}
          <path
            d={curvePath}
            fill="none"
            stroke={C.white}
            strokeWidth={2.5}
            strokeDasharray={evolved.strokeDasharray}
            strokeDashoffset={evolved.strokeDashoffset}
            strokeLinecap="round"
          />

          {/* Tail labels */}
          {strokeProgress > 0.7 && (
            <>
              <text
                x={W * 0.15}
                y={H - 10}
                textAnchor="middle"
                fill={C.danger}
                fontFamily={monoFont}
                fontSize={11}
                fontWeight={600}
                opacity={annotSpring}
              >
                LOSERS
              </text>
              <text
                x={W * 0.85}
                y={H - 10}
                textAnchor="middle"
                fill={C.success}
                fontFamily={monoFont}
                fontSize={11}
                fontWeight={600}
                opacity={annotSpring}
              >
                WINNERS
              </text>
            </>
          )}

          {/* Annotation arrow pointing to right tail */}
          {annotSpring > 0.1 && (
            <>
              <line
                x1={W * 0.75}
                y1={40}
                x2={W * 0.82}
                y2={80}
                stroke={C.success}
                strokeWidth={1.5}
                strokeDasharray={60}
                strokeDashoffset={60 * (1 - annotSpring)}
                markerEnd="url(#arrowGreen)"
              />
              <defs>
                <marker
                  id="arrowGreen"
                  markerWidth={6}
                  markerHeight={6}
                  refX={5}
                  refY={3}
                  orient="auto"
                >
                  <path d="M0,0 L6,3 L0,6 Z" fill={C.success} />
                </marker>
              </defs>
              <text
                x={W * 0.74}
                y={34}
                textAnchor="end"
                fill={C.success}
                fontFamily={font}
                fontSize={13}
                fontWeight={600}
                opacity={annotSpring}
              >
                Skill edge separates winners
              </text>
            </>
          )}
        </svg>

        {/* Bottom annotation */}
        <div
          style={{
            ...parasiteStyle,
            color: C.gray[300],
            fontSize: 15,
            marginTop: 16,
            opacity: annotSpring,
            textAlign: "center",
          }}
        >
          SAME RULES FOR EVERYONE. SKILL IS THE ONLY VARIABLE.
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// MAIN EXPORT — composites all 4 diagrams
// ═══════════════════════════════════════════════════════════════════════════
export const LiquidityDiagrams: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill>
      <BatchAnatomyCard frame={frame} fps={fps} />
      <MandatoryFillNetwork frame={frame} fps={fps} />
      <CoverageHeatmap frame={frame} fps={fps} />
      <SkillBellCurve frame={frame} fps={fps} />

      {/* ── SFX ── */}
      {/* Whoosh on batch card entrance */}
      <Sequence from={T.batchIn} durationInFrames={SEC * 2}>
        <Audio
          src={staticFile("sfx/whoosh-scene-grid.mp3")}
          volume={0.6}
        />
      </Sequence>

      {/* GM arrows flash — all-at-once impact */}
      <Sequence from={T.fillIn + 60} durationInFrames={SEC * 2}>
        <Audio
          src={staticFile("sfx/whoosh-flyby-jet.mp3")}
          volume={0.5}
        />
      </Sequence>

      {/* Count-up on coverage heatmap counters */}
      <Sequence from={T.coverIn + 20} durationInFrames={SEC * 3}>
        <Audio
          src={staticFile("sfx/metric-count-up.mp3")}
          volume={0.45}
        />
      </Sequence>

      {/* Dramatic reveal on bell curve */}
      <Sequence from={T.bellIn} durationInFrames={SEC * 2}>
        <Audio
          src={staticFile("sfx/dramatic-reveal.mp3")}
          volume={0.4}
        />
      </Sequence>
    </AbsoluteFill>
  );
};
