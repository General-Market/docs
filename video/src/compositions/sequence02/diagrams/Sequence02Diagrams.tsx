/**
 * Sequence02 diagrams — tutorial grammar, sized for the content area next
 * to the webcam rect. Five scenes, each a self-contained card with 2-3
 * beats that land on the voice track.
 */

import React from "react";
import {
  AbsoluteFill,
  Easing,
  Sequence,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { COLOR, TYPE, PANEL, FONT } from "../../tutorial/designTokens";
import { Sfx } from "../../tutorial/components/Sfx";
import {
  PLOB,
  PLOB_BG,
  TEXT_IN,
  TICK,
  TICK_SOFT,
  COUNT,
  MONEY,
  LAND,
  REVEAL,
  IMPACT,
  RAPID_POP,
} from "../../tutorial/sfxMap";
import { getContentArea } from "../scenes";
import type { Rect } from "../../endcard/layout";
import { FPS, toFrames } from "../theme";

const sec = (s: number) => Math.round(s * FPS);
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1);

// ── Scene anchors ────────────────────────────────────────────────────────

const SCENE2_START = 4.56;
const SCENE2_END = 13.92;
const SCENE3_START = 13.92;
const SCENE3_END = 24.40;
const SCENE5_START = 30.08;
const SCENE5_END = 37.28;
const SCENE6_START = 37.28;
const SCENE6_END = 46.48;
const SCENE8_START = 52.00;
const SCENE8_END = 60.56;

// Delay each diagram's mount slightly after scene start so the webcam rect
// lerp settles before the card lands.
const MOUNT_OFFSET = 10; // frames

// ── ContentAreaCard ──────────────────────────────────────────────────────
// White panel positioned inside the scene's content-area rect. Mirrors
// tutorial's DiagramCard entrance — 16-frame rise, 3→0 blur, 0.97→1 scale.

const ContentAreaCard: React.FC<{
  area: Rect;
  duration: number;
  children: React.ReactNode;
  padding?: string;
}> = ({ area, duration, children, padding = "32px 36px" }) => {
  const frame = useCurrentFrame();

  const enter = interpolate(frame, [0, 16], [0, 1], {
    ...clamp,
    easing: EASE_OUT,
  });
  const y = interpolate(enter, [0, 1], [24, 0], clamp);
  const scale = interpolate(enter, [0, 1], [0.97, 1], clamp);
  const blur = interpolate(enter, [0, 1], [3, 0], clamp);

  const exit = interpolate(
    frame,
    [duration - 16, duration],
    [1, 0],
    clamp,
  );

  const opacity = enter * exit;

  const INSET = 12;
  return (
    <div
      style={{
        position: "absolute",
        left: area.x + INSET,
        top: area.y + INSET,
        width: area.w - INSET * 2,
        height: area.h - INSET * 2,
        background: COLOR.bg,
        borderRadius: 30,
        border: `1px solid ${COLOR.border}`,
        boxShadow:
          "rgba(14,15,12,0.12) 0px 0px 0px 1px, 0 40px 120px rgba(0,0,0,0.45)",
        padding,
        opacity,
        transform: `translateY(${y}px) scale(${scale})`,
        filter: blur > 0.05 ? `blur(${blur}px)` : "none",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        fontFamily: FONT.body,
      }}
    >
      {children}
    </div>
  );
};

// ── Header stanza ────────────────────────────────────────────────────────
// Matches tutorial's "big green word + gray subtitle" header.

const Header: React.FC<{
  big: string;
  small: string;
  bigSize?: number;
  smallSize?: number;
  marginBottom?: number;
}> = ({ big, small, bigSize = 72, smallSize = 30, marginBottom = 28 }) => (
  <div
    style={{
      display: "flex",
      alignItems: "baseline",
      gap: 18,
      marginBottom,
      flexWrap: "wrap",
    }}
  >
    <span
      style={{
        ...TYPE.sectionHeading,
        fontSize: bigSize,
        color: COLOR.wiseGreen,
      }}
    >
      {big}
    </span>
    <span
      style={{
        ...TYPE.cardTitle,
        fontSize: smallSize,
        color: COLOR.gray,
      }}
    >
      {small}
    </span>
  </div>
);

// ═════════════════════════════════════════════════════════════════════════
// Scene 2 — The 70% pyramid (right-medium, content on left)
// ═════════════════════════════════════════════════════════════════════════

const TOTAL_TRADERS = 2000;
const GRID_COLS = 10;
const GRID_ROWS = 8;
const INSIDER_IDX = 3; // second row, 4th col — reads top-left area
const POOL_START = 1_000_000;
const INSIDER_TAKE = 700_000;

const PyramidBeats: React.FC<{ area: Rect; duration: number }> = ({
  area,
  duration,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Beat milestones (scene-local seconds)
  const B2_START = sec(3.0);
  const B3_START = sec(5.2);

  // Beat 1 — swarm + pool count
  const gridCells = GRID_COLS * GRID_ROWS;
  const traderCount = interpolate(
    frame,
    [sec(0.6), sec(2.6)],
    [0, TOTAL_TRADERS],
    { ...clamp, easing: EASE_OUT },
  );
  const poolValue = interpolate(
    frame,
    [sec(0.9), sec(2.9)],
    [0, POOL_START],
    { ...clamp, easing: EASE_OUT },
  );

  // Beat 2 — the pick
  const pickProgress = spring({
    frame: Math.max(0, frame - B2_START),
    fps,
    config: { damping: 11, stiffness: 180, mass: 0.9 },
  });
  const dimFactor = interpolate(pickProgress, [0, 1], [1, 0.28], clamp);

  // Beat 3 — siphon + banner
  const siphon = interpolate(
    frame,
    [B3_START, B3_START + sec(1.8)],
    [0, 1],
    { ...clamp, easing: EASE_OUT },
  );
  const poolDrained = interpolate(
    siphon,
    [0, 1],
    [POOL_START, POOL_START - INSIDER_TAKE],
    clamp,
  );
  const insiderCounter = interpolate(
    siphon,
    [0, 1],
    [0, INSIDER_TAKE],
    clamp,
  );
  const bannerSpring = spring({
    frame: Math.max(0, frame - (B3_START + sec(1.4))),
    fps,
    config: { damping: 14, stiffness: 140, mass: 0.8 },
  });

  const CELL = 48;
  const GAP = 8;
  const gridW = GRID_COLS * CELL + (GRID_COLS - 1) * GAP;

  return (
    <ContentAreaCard area={area} duration={duration}>
      <Header big="2,000" small="traders · one market" bigSize={80} />

      <div
        style={{
          display: "flex",
          gap: 24,
          alignItems: "flex-start",
          flex: 1,
        }}
      >
        {/* Grid */}
        <div style={{ width: gridW }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${GRID_COLS}, ${CELL}px)`,
              gap: GAP,
            }}
          >
            {Array.from({ length: gridCells }).map((_, i) => {
              const s = spring({
                frame: Math.max(0, frame - i * 1.2),
                fps,
                config: { damping: 18, stiffness: 200, mass: 0.4 },
              });
              const isInsider = i === INSIDER_IDX;
              const bg = isInsider
                ? COLOR.wiseGreen
                : frame >= B2_START
                  ? COLOR.lightSurface
                  : COLOR.lightMint;
              const border = isInsider
                ? `2px solid ${COLOR.darkGreen}`
                : `1px solid ${COLOR.border}`;
              const insiderScale = isInsider
                ? interpolate(pickProgress, [0, 1], [1, 1.35], clamp)
                : 1;
              const cellOpacity = isInsider ? 1 : dimFactor;
              return (
                <div
                  key={i}
                  style={{
                    width: CELL,
                    height: CELL,
                    borderRadius: 10,
                    background: bg,
                    border,
                    opacity: s * cellOpacity,
                    transform: `scale(${interpolate(
                      s,
                      [0, 1],
                      [0.6, 1],
                      clamp,
                    )}) scale(${insiderScale})`,
                    boxShadow: isInsider
                      ? `0 6px 20px rgba(22,51,0,0.35)`
                      : "none",
                  }}
                />
              );
            })}
          </div>

          {/* Trader counter under grid */}
          <div
            style={{
              marginTop: 16,
              display: "flex",
              alignItems: "baseline",
              gap: 12,
            }}
          >
            <span
              style={{
                ...TYPE.statValue,
                fontSize: 48,
                color: COLOR.nearBlack,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {Math.round(traderCount).toLocaleString()}
            </span>
            <span style={{ ...TYPE.caption, fontSize: 22 }}>traders</span>
          </div>

          {/* Pick label */}
          {frame >= B2_START + sec(0.4) && (
            <div
              style={{
                marginTop: 14,
                ...TYPE.bodySemibold,
                fontSize: 26,
                color: COLOR.darkGreen,
                opacity: interpolate(
                  frame,
                  [B2_START + sec(0.4), B2_START + sec(0.9)],
                  [0, 1],
                  clamp,
                ),
              }}
            >
              The insider.
            </div>
          )}
        </div>

        {/* Pool side */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          <div
            style={{
              ...PANEL.greenAccent,
              padding: "20px 24px",
              textAlign: "center",
            }}
          >
            <div style={{ ...TYPE.label, fontSize: 20, marginBottom: 6 }}>
              Profit pool
            </div>
            <div
              style={{
                ...TYPE.statValue,
                fontSize: 52,
                color: COLOR.darkGreen,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              $
              {Math.round(
                frame < B3_START ? poolValue : poolDrained,
              ).toLocaleString()}
            </div>
          </div>

          {/* Insider take (beat 3) */}
          {frame >= B3_START && (
            <div
              style={{
                padding: "18px 22px",
                borderRadius: 22,
                background: COLOR.lightMint,
                border: `2px solid ${COLOR.wiseGreen}`,
                textAlign: "center",
                opacity: interpolate(
                  frame,
                  [B3_START, B3_START + sec(0.4)],
                  [0, 1],
                  clamp,
                ),
                transform: `translateY(${interpolate(
                  frame,
                  [B3_START, B3_START + sec(0.4)],
                  [12, 0],
                  clamp,
                )}px)`,
              }}
            >
              <div
                style={{
                  ...TYPE.label,
                  fontSize: 20,
                  marginBottom: 6,
                  color: COLOR.darkGreen,
                }}
              >
                To one trader
              </div>
              <div
                style={{
                  ...TYPE.statValue,
                  fontSize: 44,
                  color: COLOR.darkGreen,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                +${Math.round(insiderCounter).toLocaleString()}
              </div>
            </div>
          )}

          {/* Banner */}
          {bannerSpring > 0.01 && (
            <div
              style={{
                marginTop: "auto",
                padding: "18px 24px",
                borderRadius: 20,
                background: COLOR.nearBlack,
                color: COLOR.white,
                opacity: bannerSpring,
                transform: `scaleX(${interpolate(
                  bannerSpring,
                  [0, 1],
                  [0.82, 1],
                  clamp,
                )})`,
                textAlign: "center",
              }}
            >
              <span
                style={{
                  ...TYPE.displayHero,
                  fontSize: 64,
                  color: COLOR.wiseGreen,
                  lineHeight: 1,
                }}
              >
                70%
              </span>
              <span
                style={{
                  ...TYPE.cardTitle,
                  fontSize: 26,
                  color: COLOR.white,
                  marginLeft: 12,
                }}
              >
                to one.
              </span>
            </div>
          )}
        </div>
      </div>

      {/* SFX layer */}
      <Sfx sound={TEXT_IN} delay={0} />
      <Sfx sound={COUNT} delay={sec(0.6)} />
      <Sfx sound={MONEY} delay={sec(0.9)} />
      <Sfx sound={IMPACT} delay={B2_START} />
      <Sfx sound={REVEAL} delay={B3_START} />
      <Sfx sound={MONEY} delay={B3_START + sec(0.2)} />
      <Sfx sound={LAND} delay={B3_START + sec(1.4)} />
    </ContentAreaCard>
  );
};

// ═════════════════════════════════════════════════════════════════════════
// Scene 3 — The losses sankey → RIGGED stamp (left-medium, content on right)
// ═════════════════════════════════════════════════════════════════════════

const STREAMS = [
  { label: "Strategy", loss: 1200, color: "#868685" },
  { label: "Fees", loss: 400, color: "#868685" },
  { label: "Risk Mgmt", loss: 900, color: "#868685" },
];

const SankeyBeats: React.FC<{ area: Rect; duration: number }> = ({
  area,
  duration,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const B1_DRAW = interpolate(frame, [sec(0.4), sec(2.6)], [0, 1], {
    ...clamp,
    easing: EASE_OUT,
  });

  const B2_START = sec(3.8);
  const B2_REROUTE = interpolate(
    frame,
    [B2_START, B2_START + sec(1.8)],
    [0, 1],
    { ...clamp, easing: EASE_OUT },
  );
  const insidersCounter = interpolate(
    frame,
    [B2_START + sec(0.6), B2_START + sec(2.2)],
    [0, 2500],
    { ...clamp, easing: EASE_OUT },
  );

  const B3_START = sec(7.2);
  const redWash = interpolate(
    frame,
    [B3_START, B3_START + sec(0.5)],
    [0, 0.14],
    clamp,
  );
  const stampSpring = spring({
    frame: Math.max(0, frame - (B3_START + sec(0.3))),
    fps,
    config: { damping: 7, stiffness: 180, mass: 1.2 },
  });
  const stampBlur = interpolate(stampSpring, [0, 1], [8, 0], clamp);

  // SVG geometry — sankey within a 760×420 region
  const SVG_W = 760;
  const SVG_H = 420;
  const LEFT_X = 40;
  const MID_X = 380;
  const RIGHT_X = 680;
  const endpoints = [
    { y: 80 }, // Strategy
    { y: 210 }, // Fees
    { y: 340 }, // Risk Mgmt
  ];
  const convergedY = 210;
  const expectedBoxY = 190;
  const insidersBoxY = 190;

  const pathFor = (startY: number, endY: number) => {
    const c1x = MID_X - 60;
    const c2x = MID_X + 20;
    return `M ${LEFT_X + 180} ${startY} C ${c1x} ${startY}, ${c2x} ${endY}, ${RIGHT_X - 60} ${endY}`;
  };

  return (
    <ContentAreaCard area={area} duration={duration}>
      {/* Red wash behind everything (beat 3) */}
      {redWash > 0 && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `rgba(208, 50, 56, ${redWash})`,
            pointerEvents: "none",
          }}
        />
      )}

      <Header big="Your story" small="three culprits" bigSize={72} />

      <div
        style={{
          position: "relative",
          flex: 1,
        }}
      >
        <svg width={SVG_W} height={SVG_H} style={{ overflow: "visible" }}>
          <defs>
            <marker
              id="arrow-gray"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="8"
              markerHeight="8"
              orient="auto"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill={COLOR.gray} />
            </marker>
            <marker
              id="arrow-red"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="8"
              markerHeight="8"
              orient="auto"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill={COLOR.danger} />
            </marker>
          </defs>

          {/* Left: source labels + amount pills */}
          {STREAMS.map((s, i) => {
            const y = endpoints[i].y;
            const fadeIn = interpolate(
              frame,
              [sec(0.2 + i * 0.3), sec(0.6 + i * 0.3)],
              [0, 1],
              clamp,
            );
            return (
              <g key={s.label} opacity={fadeIn}>
                <rect
                  x={LEFT_X}
                  y={y - 26}
                  width={180}
                  height={52}
                  rx={12}
                  fill={COLOR.lightSurface}
                  stroke={COLOR.border}
                />
                <text
                  x={LEFT_X + 90}
                  y={y - 2}
                  textAnchor="middle"
                  fill={COLOR.nearBlack}
                  fontSize={22}
                  fontWeight={700}
                  fontFamily="Inter"
                >
                  {s.label}
                </text>
                <text
                  x={LEFT_X + 90}
                  y={y + 18}
                  textAnchor="middle"
                  fill={COLOR.danger}
                  fontSize={20}
                  fontWeight={700}
                  fontFamily="Inter"
                  style={{ fontVariantNumeric: "tabular-nums" }}
                >
                  −${s.loss}
                </text>
              </g>
            );
          })}

          {/* Flowing streams — gray during B1, lerp to converged+red in B2 */}
          {STREAMS.map((s, i) => {
            const srcY = endpoints[i].y;
            const destY = B2_REROUTE > 0 ? insidersBoxY + 30 : expectedBoxY + 30;
            const animY =
              B2_REROUTE > 0
                ? srcY + (destY - srcY) * B2_REROUTE
                : srcY + (convergedY - srcY) * B1_DRAW;
            const strokeW = interpolate(B2_REROUTE, [0, 1], [6, 14], clamp);
            const stroke = B2_REROUTE > 0.2 ? COLOR.danger : COLOR.gray;
            const drawOpacity = B1_DRAW;
            const d = pathFor(srcY, animY);
            return (
              <path
                key={`stream-${i}`}
                d={d}
                fill="none"
                stroke={stroke}
                strokeWidth={strokeW}
                strokeLinecap="round"
                opacity={drawOpacity * 0.65}
                markerEnd={
                  B2_REROUTE > 0.5 ? "url(#arrow-red)" : "url(#arrow-gray)"
                }
              />
            );
          })}

          {/* Right: "What you thought" box (fades during B2) */}
          <g
            opacity={interpolate(
              frame,
              [sec(2.0), sec(2.6), B2_START, B2_START + sec(0.8)],
              [0, 1, 1, 0],
              clamp,
            )}
            transform={`translate(${RIGHT_X - 60}, ${expectedBoxY})`}
          >
            <rect
              x={-40}
              y={0}
              width={180}
              height={60}
              rx={14}
              fill={COLOR.lightSurface}
              stroke={COLOR.gray}
              strokeDasharray="6 4"
            />
            <text
              x={50}
              y={36}
              textAnchor="middle"
              fill={COLOR.gray}
              fontSize={20}
              fontWeight={700}
              fontFamily="Inter"
            >
              What you thought
            </text>
          </g>

          {/* Right: "Insiders" box (beat 2+) */}
          {B2_REROUTE > 0.1 && (
            <g
              opacity={B2_REROUTE}
              transform={`translate(${RIGHT_X - 60}, ${insidersBoxY})`}
            >
              <rect
                x={-50}
                y={-4}
                width={210}
                height={68}
                rx={16}
                fill={COLOR.danger}
                opacity={0.95}
              />
              <text
                x={55}
                y={28}
                textAnchor="middle"
                fill={COLOR.white}
                fontSize={22}
                fontWeight={800}
                fontFamily="Inter"
              >
                Insiders
              </text>
              <text
                x={55}
                y={52}
                textAnchor="middle"
                fill={COLOR.white}
                fontSize={22}
                fontWeight={700}
                fontFamily="Inter"
                style={{ fontVariantNumeric: "tabular-nums" }}
              >
                −${Math.round(insidersCounter).toLocaleString()}
              </text>
            </g>
          )}
        </svg>

        {/* RIGGED stamp */}
        {stampSpring > 0.01 && (
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: "58%",
              transform: `translate(-50%, -50%) rotate(-7deg) scale(${interpolate(
                stampSpring,
                [0, 1],
                [2.1, 1],
                clamp,
              )})`,
              opacity: stampSpring,
              filter: `blur(${stampBlur}px)`,
              pointerEvents: "none",
            }}
          >
            <div
              style={{
                ...TYPE.displayHero,
                fontSize: 180,
                color: COLOR.danger,
                letterSpacing: "-0.04em",
                border: `10px solid ${COLOR.danger}`,
                padding: "8px 32px",
                borderRadius: 12,
                textShadow: "0 4px 24px rgba(208,50,56,0.4)",
                background: "rgba(255,255,255,0.88)",
                lineHeight: 0.85,
              }}
            >
              RIGGED
            </div>
            <div
              style={{
                ...TYPE.caption,
                fontSize: 22,
                textAlign: "center",
                color: COLOR.danger,
                marginTop: 12,
                letterSpacing: "0.2em",
                textTransform: "uppercase",
                fontWeight: 700,
              }}
            >
              since the start
            </div>
          </div>
        )}
      </div>

      {/* SFX */}
      <Sfx sound={TEXT_IN} delay={0} />
      <Sfx sound={TICK} delay={sec(0.4)} />
      <Sfx sound={TICK} delay={sec(0.7)} />
      <Sfx sound={TICK} delay={sec(1.0)} />
      <Sfx sound={REVEAL} delay={B2_START} />
      <Sfx sound={MONEY} delay={B2_START + sec(0.6)} />
      <Sfx sound={IMPACT} delay={B3_START + sec(0.3)} />
    </ContentAreaCard>
  );
};

// ═════════════════════════════════════════════════════════════════════════
// Scene 5 — Single-market exploit swimlane (right-small, content on left)
// ═════════════════════════════════════════════════════════════════════════

const MARKETS = ["AAPL", "TSLA", "NVDA", "GOOG", "NFLX", "MSFT"];
const INSIDER_COL = 3; // GOOG
const INSIDER_WIN = 12_400;
const YOU_LOSSES = [40, 120, 55, 300, 80, 60];

const SwimlaneBeats: React.FC<{ area: Rect; duration: number }> = ({
  area,
  duration,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const B2_START = sec(3.4);
  const pickSpring = spring({
    frame: Math.max(0, frame - B2_START),
    fps,
    config: { damping: 11, stiffness: 170, mass: 0.8 },
  });
  const insiderCount = interpolate(
    frame,
    [B2_START + sec(0.3), B2_START + sec(1.6)],
    [0, INSIDER_WIN],
    { ...clamp, easing: EASE_OUT },
  );

  const cellW = 150;
  const cellH = 74;
  const gap = 10;
  const labelW = 130;

  return (
    <ContentAreaCard area={area} duration={duration}>
      <Header big="One shot" small="normal exchange" bigSize={76} />

      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap }}>
        {/* Column headers */}
        <div style={{ display: "flex", alignItems: "center", gap, marginBottom: 6 }}>
          <div style={{ width: labelW }} />
          {MARKETS.map((m, i) => {
            const fadeIn = interpolate(
              frame,
              [sec(0.1 + i * 0.06), sec(0.3 + i * 0.06)],
              [0, 1],
              clamp,
            );
            return (
              <div
                key={m}
                style={{
                  width: cellW,
                  textAlign: "center",
                  ...TYPE.label,
                  fontSize: 22,
                  color: COLOR.gray,
                  opacity: fadeIn,
                }}
              >
                {m}
              </div>
            );
          })}
        </div>

        {/* Insider row */}
        <div style={{ display: "flex", alignItems: "center", gap }}>
          <div
            style={{
              width: labelW,
              ...TYPE.bodySemibold,
              fontSize: 26,
              color: COLOR.nearBlack,
            }}
          >
            Insider
          </div>
          {MARKETS.map((m, i) => {
            const cellDelay = sec(0.6 + i * 0.12);
            const s = spring({
              frame: Math.max(0, frame - cellDelay),
              fps,
              config: { damping: 16, stiffness: 180, mass: 0.5 },
            });
            const isTarget = i === INSIDER_COL;
            const isPicked = isTarget && frame >= B2_START;
            const background = isPicked ? COLOR.lightMint : COLOR.lightSurface;
            const border = isPicked
              ? `2px solid ${COLOR.wiseGreen}`
              : `1px solid ${COLOR.border}`;
            const scale = isPicked
              ? interpolate(pickSpring, [0, 1], [1, 1.12], clamp)
              : 1;
            return (
              <div
                key={m}
                style={{
                  width: cellW,
                  height: cellH,
                  borderRadius: 14,
                  background,
                  border,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: s,
                  transform: `translateY(${interpolate(
                    s,
                    [0, 1],
                    [10, 0],
                    clamp,
                  )}px) scale(${scale})`,
                  ...TYPE.bodySemibold,
                  fontSize: isPicked ? 30 : 28,
                  color: isPicked ? COLOR.darkGreen : COLOR.gray,
                  fontVariantNumeric: "tabular-nums",
                  boxShadow: isPicked
                    ? `0 6px 20px rgba(22,51,0,0.25)`
                    : "none",
                }}
              >
                {isPicked
                  ? `+$${Math.round(insiderCount).toLocaleString()}`
                  : "—"}
              </div>
            );
          })}
        </div>

        {/* You row */}
        <div style={{ display: "flex", alignItems: "center", gap }}>
          <div
            style={{
              width: labelW,
              ...TYPE.bodySemibold,
              fontSize: 26,
              color: COLOR.nearBlack,
            }}
          >
            You
          </div>
          {MARKETS.map((m, i) => {
            const cellDelay = sec(0.9 + i * 0.12);
            const s = spring({
              frame: Math.max(0, frame - cellDelay),
              fps,
              config: { damping: 16, stiffness: 180, mass: 0.5 },
            });
            const isTarget = i === INSIDER_COL;
            const pulseT =
              isTarget && frame >= B2_START + sec(0.1)
                ? interpolate(
                    frame,
                    [
                      B2_START + sec(0.1),
                      B2_START + sec(0.35),
                      B2_START + sec(0.6),
                    ],
                    [1, 1.08, 1],
                    clamp,
                  )
                : 1;
            return (
              <div
                key={m}
                style={{
                  width: cellW,
                  height: cellH,
                  borderRadius: 14,
                  background: "rgba(208,50,56,0.08)",
                  border: `1px solid rgba(208,50,56,0.35)`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: s,
                  transform: `translateY(${interpolate(
                    s,
                    [0, 1],
                    [10, 0],
                    clamp,
                  )}px) scale(${pulseT})`,
                  ...TYPE.bodySemibold,
                  fontSize: 26,
                  color: COLOR.danger,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                −${YOU_LOSSES[i]}
              </div>
            );
          })}
        </div>

        {/* Caption */}
        <div
          style={{
            marginTop: 28,
            padding: "16px 22px",
            background: COLOR.nearBlack,
            borderRadius: 18,
            opacity: interpolate(
              frame,
              [B2_START + sec(1.2), B2_START + sec(1.6)],
              [0, 1],
              clamp,
            ),
            transform: `translateY(${interpolate(
              frame,
              [B2_START + sec(1.2), B2_START + sec(1.6)],
              [10, 0],
              clamp,
            )}px)`,
          }}
        >
          <span
            style={{
              ...TYPE.bodySemibold,
              fontSize: 28,
              color: COLOR.white,
            }}
          >
            He picks.
          </span>
          <span
            style={{
              ...TYPE.bodySemibold,
              fontSize: 28,
              color: COLOR.wiseGreen,
              marginLeft: 14,
            }}
          >
            You cover.
          </span>
        </div>
      </div>

      {/* SFX */}
      <Sfx sound={TEXT_IN} delay={0} />
      {MARKETS.map((_, i) => (
        <Sfx
          key={`hdr-${i}`}
          sound={TICK_SOFT}
          delay={sec(0.1 + i * 0.06)}
        />
      ))}
      {MARKETS.map((_, i) => (
        <Sfx key={`ins-${i}`} sound={PLOB_BG} delay={sec(0.6 + i * 0.12)} />
      ))}
      {MARKETS.map((_, i) => (
        <Sfx key={`you-${i}`} sound={PLOB_BG} delay={sec(0.9 + i * 0.12)} />
      ))}
      <Sfx sound={IMPACT} delay={B2_START} />
      <Sfx sound={MONEY} delay={B2_START + sec(0.3)} />
      <Sfx sound={LAND} delay={B2_START + sec(1.4)} />
    </ContentAreaCard>
  );
};

// ═════════════════════════════════════════════════════════════════════════
// Scene 6 — Batch dilution grid (left-small, content on right)
// ═════════════════════════════════════════════════════════════════════════

const BATCH_GRID = 10; // 10×10 = 100 cells
const EDGE_CELLS = [17, 43, 81]; // indices with real edge

const BatchGridBeats: React.FC<{ area: Rect; duration: number }> = ({
  area,
  duration,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const B2_START = sec(3.0);
  const B3_START = sec(5.6);

  const CELL = 44;
  const GAP = 6;
  const gridW = BATCH_GRID * CELL + (BATCH_GRID - 1) * GAP;
  const gridH = BATCH_GRID * CELL + (BATCH_GRID - 1) * GAP;

  // Avg line sweep
  const avgSweep = interpolate(
    frame,
    [B2_START + sec(0.8), B2_START + sec(2.0)],
    [0, 1],
    { ...clamp, easing: EASE_OUT },
  );
  // Line sits at 0.55% / 18.2% = ~3% from top of "edge-space" visualization.
  // Visually: place it near bottom of grid (since near-zero).

  // Beat 3 math
  const mathLineSpring = (i: number) =>
    spring({
      frame: Math.max(0, frame - (B3_START + sec(0.3 * i))),
      fps,
      config: { damping: 14, stiffness: 140, mass: 0.7 },
    });

  return (
    <ContentAreaCard area={area} duration={duration}>
      <Header big="A batch" small="100 markets forced" bigSize={76} />

      <div style={{ display: "flex", gap: 28, flex: 1 }}>
        {/* Grid */}
        <div
          style={{
            width: gridW,
            position: "relative",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${BATCH_GRID}, ${CELL}px)`,
              gap: GAP,
            }}
          >
            {Array.from({ length: BATCH_GRID * BATCH_GRID }).map((_, i) => {
              const s = spring({
                frame: Math.max(0, frame - i * 1.0),
                fps,
                config: { damping: 20, stiffness: 220, mass: 0.35 },
              });
              const isEdge = EDGE_CELLS.includes(i);
              const showGreen = isEdge && frame >= B2_START;
              const dimOthers =
                frame >= B2_START + sec(0.4) && !isEdge
                  ? interpolate(
                      frame,
                      [B2_START + sec(0.4), B2_START + sec(1.0)],
                      [1, 0.55],
                      clamp,
                    )
                  : 1;
              const bg = showGreen
                ? COLOR.wiseGreen
                : COLOR.lightSurface;
              const border = showGreen
                ? `2px solid ${COLOR.darkGreen}`
                : `1px solid ${COLOR.border}`;
              const pulse = showGreen
                ? 1 +
                  0.06 *
                    Math.sin(((frame - B2_START) / fps) * 6 + i)
                : 1;
              return (
                <div
                  key={i}
                  style={{
                    width: CELL,
                    height: CELL,
                    borderRadius: 8,
                    background: bg,
                    border,
                    opacity: s * dimOthers,
                    transform: `scale(${interpolate(
                      s,
                      [0, 1],
                      [0.5, 1],
                      clamp,
                    )}) scale(${pulse})`,
                    boxShadow: showGreen
                      ? `0 4px 12px rgba(22,51,0,0.35)`
                      : "none",
                  }}
                />
              );
            })}
          </div>

          {/* Avg edge line (near bottom because diluted is tiny) */}
          {avgSweep > 0 && (
            <div
              style={{
                position: "absolute",
                left: 0,
                top: gridH - 14,
                width: gridW * avgSweep,
                height: 3,
                background: COLOR.nearBlack,
                borderRadius: 2,
              }}
            />
          )}
          {avgSweep > 0.7 && (
            <div
              style={{
                position: "absolute",
                left: gridW * 0.7,
                top: gridH - 46,
                ...TYPE.label,
                fontSize: 20,
                color: COLOR.nearBlack,
                opacity: interpolate(avgSweep, [0.7, 1], [0, 1], clamp),
              }}
            >
              avg edge · 0.55%
            </div>
          )}

          {/* +18% tags on the green cells */}
          {frame >= B2_START + sec(0.5) &&
            EDGE_CELLS.map((idx) => {
              const col = idx % BATCH_GRID;
              const row = Math.floor(idx / BATCH_GRID);
              return (
                <div
                  key={`tag-${idx}`}
                  style={{
                    position: "absolute",
                    left: col * (CELL + GAP) - 8,
                    top: row * (CELL + GAP) - 26,
                    padding: "2px 8px",
                    borderRadius: 6,
                    background: COLOR.darkGreen,
                    ...TYPE.label,
                    color: COLOR.wiseGreen,
                    fontSize: 16,
                    fontWeight: 800,
                    letterSpacing: "0.05em",
                    opacity: interpolate(
                      frame,
                      [B2_START + sec(0.5), B2_START + sec(0.9)],
                      [0, 1],
                      clamp,
                    ),
                    transform: `translateY(${interpolate(
                      frame,
                      [B2_START + sec(0.5), B2_START + sec(0.9)],
                      [6, 0],
                      clamp,
                    )}px)`,
                  }}
                >
                  +18%
                </div>
              );
            })}
        </div>

        {/* Math panel */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 14 }}>
          <div
            style={{
              ...TYPE.label,
              fontSize: 22,
              color: COLOR.gray,
              marginBottom: 4,
              opacity: mathLineSpring(0),
            }}
          >
            What actually happens
          </div>
          <div
            style={{
              ...TYPE.statValue,
              fontSize: 42,
              color: COLOR.nearBlack,
              fontVariantNumeric: "tabular-nums",
              opacity: mathLineSpring(0),
              transform: `translateX(${interpolate(
                mathLineSpring(0),
                [0, 1],
                [-12, 0],
                clamp,
              )}px)`,
            }}
          >
            18.2% × 3
          </div>
          <div
            style={{
              ...TYPE.cardTitle,
              fontSize: 22,
              color: COLOR.gray,
              opacity: mathLineSpring(1),
            }}
          >
            spread across 100 markets
          </div>
          <div
            style={{
              ...TYPE.statValue,
              fontSize: 42,
              color: COLOR.danger,
              fontVariantNumeric: "tabular-nums",
              opacity: mathLineSpring(1),
              transform: `translateX(${interpolate(
                mathLineSpring(1),
                [0, 1],
                [-12, 0],
                clamp,
              )}px)`,
            }}
          >
            0.55%
          </div>
          <div
            style={{
              marginTop: "auto",
              ...PANEL.greenAccent,
              padding: "18px 22px",
              textAlign: "center",
              opacity: mathLineSpring(2),
              transform: `scale(${interpolate(
                mathLineSpring(2),
                [0, 1],
                [0.9, 1],
                clamp,
              )})`,
            }}
          >
            <span
              style={{
                ...TYPE.bodySemibold,
                fontSize: 30,
                color: COLOR.darkGreen,
              }}
            >
              ≈ you
            </span>
          </div>
        </div>
      </div>

      {/* SFX */}
      <Sfx sound={TEXT_IN} delay={0} />
      {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
        <Sfx
          key={`row-${i}`}
          sound={PLOB_BG}
          delay={sec(0.1 + i * 0.18)}
        />
      ))}
      <Sfx sound={IMPACT} delay={B2_START} />
      {EDGE_CELLS.map((_, i) => (
        <Sfx
          key={`edge-${i}`}
          sound={PLOB}
          delay={B2_START + sec(0.1 + i * 0.2)}
        />
      ))}
      <Sfx sound={COUNT} delay={B2_START + sec(0.8)} />
      <Sfx sound={REVEAL} delay={B3_START} />
      <Sfx sound={LAND} delay={B3_START + sec(0.6)} />
    </ContentAreaCard>
  );
};

// ═════════════════════════════════════════════════════════════════════════
// Scene 8 — Market roster tiles (right-medium, content on left)
// ═════════════════════════════════════════════════════════════════════════

const MARKET_TILES = [
  { icon: "🎮", name: "Twitch", q: "xQc > 120k at 21:00?", yes: 0.62 },
  { icon: "📉", name: "Meme shorts", q: "$WIF < $1.10 in 10m?", yes: 0.41 },
  { icon: "🐾", name: "Animals", q: "Koko video > 2M views today?", yes: 0.77 },
  { icon: "🎬", name: "Box office", q: "Dune 3 opens > $85M?", yes: 0.55 },
  { icon: "🌧️", name: "Weather", q: "Paris rain next 10m?", yes: 0.23 },
  { icon: "🗳️", name: "Elections", q: "Poll lead narrows?", yes: 0.49 },
  { icon: "🚆", name: "Rail", q: "DB on time > 65%?", yes: 0.52 },
  { icon: "🎵", name: "Streams", q: "Song #1 hits 5M?", yes: 0.38 },
  { icon: "⛏️", name: "Hashrate", q: "BTC hashrate new ATH?", yes: 0.29 },
  { icon: "⚽", name: "Sport", q: "PSG–OM over 2.5 goals?", yes: 0.47 },
];

const MarketTilesBeats: React.FC<{ area: Rect; duration: number }> = ({
  area,
  duration,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const B2_START = sec(3.2);
  const B3_START = sec(6.0);

  const TILE_W = 176;
  const TILE_H = 150;
  const GAP = 14;

  const clockAngle = interpolate(
    frame,
    [B3_START, B3_START + sec(2.0)],
    [0, 360],
    { ...clamp, easing: EASE_OUT },
  );
  const tickerPulse =
    frame >= B3_START
      ? 1 + 0.04 * Math.sin(((frame - B3_START) / fps) * 6)
      : 1;

  return (
    <ContentAreaCard area={area} duration={duration}>
      <Header big="500 markets" small="10 examples" bigSize={68} />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(5, ${TILE_W}px)`,
          gap: GAP,
          justifyContent: "flex-start",
          perspective: 1600,
        }}
      >
        {MARKET_TILES.map((t, i) => {
          const delay = sec(0.1 + i * 0.17);
          const s = spring({
            frame: Math.max(0, frame - delay),
            fps,
            config: { damping: 15, stiffness: 150, mass: 0.6 },
          });
          const flipStart = B2_START + i * sec(0.06);
          const flipRaw = interpolate(
            frame,
            [flipStart, flipStart + sec(0.5)],
            [0, 1],
            clamp,
          );
          const flipDeg = flipRaw * 180;
          const yesPct = Math.round(t.yes * 100);

          return (
            <div
              key={t.name}
              style={{
                width: TILE_W,
                height: TILE_H,
                opacity: s,
                transform: `translateY(${interpolate(
                  s,
                  [0, 1],
                  [16, 0],
                  clamp,
                )}px)`,
                transformStyle: "preserve-3d",
                position: "relative",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  transformStyle: "preserve-3d",
                  transform: `rotateY(${flipDeg}deg)`,
                  transition: "none",
                }}
              >
                {/* Front */}
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    background: COLOR.bg,
                    border: `1px solid ${COLOR.border}`,
                    borderRadius: 18,
                    boxShadow: "rgba(14,15,12,0.08) 0px 0px 0px 1px",
                    padding: "14px 16px",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    backfaceVisibility: "hidden",
                    WebkitBackfaceVisibility: "hidden",
                  }}
                >
                  <div style={{ fontSize: 42, lineHeight: 1 }}>{t.icon}</div>
                  <div>
                    <div
                      style={{
                        ...TYPE.bodySemibold,
                        fontSize: 22,
                        color: COLOR.nearBlack,
                        marginBottom: 4,
                      }}
                    >
                      {t.name}
                    </div>
                    <div
                      style={{
                        ...TYPE.caption,
                        fontSize: 16,
                        color: COLOR.gray,
                        lineHeight: 1.3,
                      }}
                    >
                      {t.q}
                    </div>
                  </div>
                </div>

                {/* Back — odds chip */}
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    background: COLOR.nearBlack,
                    borderRadius: 18,
                    padding: "14px 16px",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    backfaceVisibility: "hidden",
                    WebkitBackfaceVisibility: "hidden",
                    transform: "rotateY(180deg)",
                  }}
                >
                  <div
                    style={{
                      ...TYPE.label,
                      fontSize: 16,
                      color: "rgba(255,255,255,0.55)",
                    }}
                  >
                    {t.name}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "baseline",
                      gap: 6,
                    }}
                  >
                    <span
                      style={{
                        ...TYPE.statValue,
                        fontSize: 52,
                        color: COLOR.wiseGreen,
                        fontVariantNumeric: "tabular-nums",
                        lineHeight: 1,
                      }}
                    >
                      {yesPct}
                    </span>
                    <span
                      style={{
                        ...TYPE.bodySemibold,
                        fontSize: 22,
                        color: "rgba(255,255,255,0.7)",
                      }}
                    >
                      ¢ YES
                    </span>
                  </div>
                  {/* Mini bar */}
                  <div
                    style={{
                      width: "100%",
                      height: 6,
                      borderRadius: 3,
                      background: "rgba(255,255,255,0.12)",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: `${yesPct}%`,
                        background: COLOR.wiseGreen,
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom strip — 10-minute clock */}
      <div
        style={{
          marginTop: "auto",
          padding: "18px 24px",
          borderRadius: 22,
          background: frame >= B3_START ? COLOR.nearBlack : COLOR.lightSurface,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          transition: "none",
          transform: `scale(${tickerPulse})`,
          opacity: interpolate(
            frame,
            [B3_START - sec(0.4), B3_START],
            [0.5, 1],
            clamp,
          ),
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          {/* Clock SVG */}
          <svg width={56} height={56} viewBox="0 0 56 56">
            <circle
              cx={28}
              cy={28}
              r={24}
              fill="none"
              stroke={frame >= B3_START ? COLOR.wiseGreen : COLOR.gray}
              strokeWidth={3}
            />
            <line
              x1={28}
              y1={28}
              x2={28 + 18 * Math.sin((clockAngle * Math.PI) / 180)}
              y2={28 - 18 * Math.cos((clockAngle * Math.PI) / 180)}
              stroke={frame >= B3_START ? COLOR.wiseGreen : COLOR.gray}
              strokeWidth={3}
              strokeLinecap="round"
            />
            <circle
              cx={28}
              cy={28}
              r={2.5}
              fill={frame >= B3_START ? COLOR.wiseGreen : COLOR.gray}
            />
          </svg>
          <div>
            <div
              style={{
                ...TYPE.label,
                fontSize: 20,
                color:
                  frame >= B3_START
                    ? "rgba(255,255,255,0.6)"
                    : COLOR.gray,
              }}
            >
              Settlement
            </div>
            <div
              style={{
                ...TYPE.sectionHeading,
                fontSize: 44,
                color:
                  frame >= B3_START ? COLOR.wiseGreen : COLOR.nearBlack,
                lineHeight: 1,
              }}
            >
              Every 10 min
            </div>
          </div>
        </div>
        <div
          style={{
            ...TYPE.bodySemibold,
            fontSize: 22,
            color:
              frame >= B3_START ? "rgba(255,255,255,0.75)" : COLOR.gray,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          T−{Math.max(
            0,
            Math.round(
              10 - ((((frame - B3_START) / fps) * 5) % 10),
            ),
          )}
          m
        </div>
      </div>

      {/* SFX */}
      <Sfx sound={TEXT_IN} delay={0} />
      {MARKET_TILES.map((_, i) => (
        <Sfx
          key={`tile-${i}`}
          sound={PLOB_BG}
          delay={sec(0.1 + i * 0.17)}
        />
      ))}
      <Sfx sound={RAPID_POP} delay={B2_START} />
      <Sfx sound={LAND} delay={B3_START} />
      <Sfx sound={TICK} delay={B3_START + sec(0.5)} />
      <Sfx sound={TICK} delay={B3_START + sec(1.2)} />
    </ContentAreaCard>
  );
};

// ═════════════════════════════════════════════════════════════════════════
// Main export — mounts one Sequence per scene
// ═════════════════════════════════════════════════════════════════════════

export const Sequence02Diagrams: React.FC = () => {
  const area2 = getContentArea("right-medium")!;
  const area3 = getContentArea("left-medium")!;
  const area5 = getContentArea("right-small")!;
  const area6 = getContentArea("left-small")!;
  const area8 = getContentArea("right-medium")!;

  const dur = (startSec: number, endSec: number) =>
    toFrames(endSec) - toFrames(startSec) - MOUNT_OFFSET;

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {/* Scene 2 */}
      <Sequence
        from={toFrames(SCENE2_START) + MOUNT_OFFSET}
        durationInFrames={dur(SCENE2_START, SCENE2_END)}
      >
        <PyramidBeats
          area={area2}
          duration={dur(SCENE2_START, SCENE2_END)}
        />
      </Sequence>

      {/* Scene 3 */}
      <Sequence
        from={toFrames(SCENE3_START) + MOUNT_OFFSET}
        durationInFrames={dur(SCENE3_START, SCENE3_END)}
      >
        <SankeyBeats
          area={area3}
          duration={dur(SCENE3_START, SCENE3_END)}
        />
      </Sequence>

      {/* Scene 5 */}
      <Sequence
        from={toFrames(SCENE5_START) + MOUNT_OFFSET}
        durationInFrames={dur(SCENE5_START, SCENE5_END)}
      >
        <SwimlaneBeats
          area={area5}
          duration={dur(SCENE5_START, SCENE5_END)}
        />
      </Sequence>

      {/* Scene 6 */}
      <Sequence
        from={toFrames(SCENE6_START) + MOUNT_OFFSET}
        durationInFrames={dur(SCENE6_START, SCENE6_END)}
      >
        <BatchGridBeats
          area={area6}
          duration={dur(SCENE6_START, SCENE6_END)}
        />
      </Sequence>

      {/* Scene 8 */}
      <Sequence
        from={toFrames(SCENE8_START) + MOUNT_OFFSET}
        durationInFrames={dur(SCENE8_START, SCENE8_END)}
      >
        <MarketTilesBeats
          area={area8}
          duration={dur(SCENE8_START, SCENE8_END)}
        />
      </Sequence>
    </AbsoluteFill>
  );
};
