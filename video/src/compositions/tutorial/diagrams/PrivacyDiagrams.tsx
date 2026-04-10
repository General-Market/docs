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
import { COLOR, TYPE } from "../designTokens";
import { FPS } from "../theme";
import { SceneWrapper } from "../components/DiagramCard";
import { Sfx } from "../components/Sfx";
import { PLOB_ACCENT, LAND_SOFT } from "../sfxMap";

const sec = (s: number) => Math.round(s * FPS);
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const EASE_OUT_EXPO = Easing.bezier(0.16, 1, 0.3, 1);

const DISPUTE_IN = sec(19.8);
const DISPUTE_OUT = sec(32.6);
const CARD_RADIUS = 24;

const BEFORE_BORDER = "rgba(208, 50, 56, 0.2)";
const AFTER_BORDER = COLOR.wiseGreen;

// ── Orderbook rows (BEFORE visual) ─────────────────────────────────────────

interface OrderRow {
  price: string;
  size: string;
  side: "bid" | "ask";
}

const ORDERBOOK_BIDS: OrderRow[] = [
  { price: "0.62", size: "1,240", side: "bid" },
  { price: "0.61", size: "3,800", side: "bid" },
  { price: "0.59", size: "890", side: "bid" },
  { price: "0.57", size: "5,100", side: "bid" },
];

const ORDERBOOK_ASKS: OrderRow[] = [
  { price: "0.63", size: "2,100", side: "ask" },
  { price: "0.65", size: "1,750", side: "ask" },
  { price: "0.68", size: "4,200", side: "ask" },
  { price: "0.72", size: "960", side: "ask" },
];

// ── Pool bars (AFTER visual) ────────────────────────────────────────────────

interface PoolEntry {
  label: string;
  amount: string;
  width: number; // percentage
}

const POOL_ENTRIES: PoolEntry[] = [
  { label: "YES", amount: "$34,200", width: 62 },
  { label: "NO", amount: "$21,100", width: 38 },
];

// ── Components ──────────────────────────────────────────────────────────────

const OrderbookVisual: React.FC<{ frame: number; fps: number }> = ({
  frame,
  fps,
}) => {
  const allRows = [...ORDERBOOK_ASKS.reverse(), ...ORDERBOOK_BIDS];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          padding: "0 8px",
          marginBottom: 4,
        }}
      >
        <span style={{ ...TYPE.label, fontSize: 24, color: COLOR.gray }}>
          Price
        </span>
        <span style={{ ...TYPE.label, fontSize: 24, color: COLOR.gray }}>
          Size
        </span>
      </div>

      {allRows.map((row, i) => {
        const delay = sec(0.3) + i * 3;
        const rowSpring = spring({
          frame: Math.max(0, frame - delay),
          fps,
          config: { damping: 18, stiffness: 160, mass: 0.6 },
        });

        const isBid = row.side === "bid";
        const barColor = isBid
          ? "rgba(5, 77, 40, 0.15)"
          : "rgba(208, 50, 56, 0.12)";
        const textColor = isBid ? COLOR.positive : COLOR.danger;

        // Bar fills from left
        const barWidth = interpolate(rowSpring, [0, 1], [0, 100], clamp);

        return (
          <div
            key={i}
            style={{
              position: "relative",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "5px 8px",
              borderRadius: 4,
              overflow: "hidden",
              opacity: rowSpring,
            }}
          >
            {/* Fill bar */}
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: `${barWidth}%`,
                height: "100%",
                background: barColor,
                borderRadius: 4,
              }}
            />
            <span
              style={{
                ...TYPE.small,
                fontSize: 24,
                fontWeight: 600,
                color: textColor,
                fontVariantNumeric: "tabular-nums",
                position: "relative",
              }}
            >
              {row.price}
            </span>
            <span
              style={{
                ...TYPE.small,
                fontSize: 24,
                color: COLOR.gray,
                fontVariantNumeric: "tabular-nums",
                position: "relative",
              }}
            >
              {row.size}
            </span>
          </div>
        );
      })}

      {/* Eye icon + public label */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginTop: 12,
          opacity: interpolate(frame, [sec(1.2), sec(1.6)], [0, 1], clamp),
        }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path
            d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z"
            stroke={COLOR.danger}
            strokeWidth="1.5"
          />
          <circle cx="12" cy="12" r="3" stroke={COLOR.danger} strokeWidth="1.5" />
        </svg>
        <span
          style={{
            ...TYPE.caption,
            fontSize: 24,
            color: COLOR.danger,
            fontWeight: 600,
          }}
        >
          Visible to everyone
        </span>
      </div>
    </div>
  );
};

const ParimutuelVisual: React.FC<{ frame: number; fps: number }> = ({
  frame,
  fps,
}) => {
  const baseDelay = sec(2.2);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Pool label */}
      <div
        style={{
          ...TYPE.label,
          fontSize: 24,
          color: COLOR.darkGreen,
          opacity: interpolate(
            frame,
            [baseDelay, baseDelay + sec(0.3)],
            [0, 1],
            clamp,
          ),
        }}
      >
        Pool
      </div>

      {/* Pool bars */}
      {POOL_ENTRIES.map((entry, i) => {
        const entryDelay = baseDelay + sec(0.3) + i * sec(0.4);
        const barSpring = spring({
          frame: Math.max(0, frame - entryDelay),
          fps,
          config: { damping: 14, stiffness: 120, mass: 0.8 },
        });

        const barWidth = interpolate(barSpring, [0, 1], [0, entry.width], clamp);
        const isYes = entry.label === "YES";

        return (
          <div key={i} style={{ opacity: barSpring }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: 6,
              }}
            >
              <span
                style={{
                  ...TYPE.small,
                  fontSize: 24,
                  fontWeight: 700,
                  color: isYes ? COLOR.darkGreen : COLOR.nearBlack,
                }}
              >
                {entry.label}
              </span>
              <span
                style={{
                  ...TYPE.small,
                  fontSize: 24,
                  fontVariantNumeric: "tabular-nums",
                  color: COLOR.gray,
                }}
              >
                {entry.amount}
              </span>
            </div>
            <div
              style={{
                width: "100%",
                height: 12,
                borderRadius: 6,
                background: "rgba(22, 51, 0, 0.08)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${barWidth}%`,
                  height: "100%",
                  borderRadius: 6,
                  background: isYes ? COLOR.wiseGreen : COLOR.warmDark,
                }}
              />
            </div>
          </div>
        );
      })}

      {/* Sealed icon + private label */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginTop: 8,
          opacity: interpolate(
            frame,
            [baseDelay + sec(1.2), baseDelay + sec(1.6)],
            [0, 1],
            clamp,
          ),
        }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <rect
            x="3"
            y="11"
            width="18"
            height="11"
            rx="2"
            stroke={COLOR.darkGreen}
            strokeWidth="1.5"
          />
          <path
            d="M7 11V7a5 5 0 0 1 10 0v4"
            stroke={COLOR.darkGreen}
            strokeWidth="1.5"
          />
        </svg>
        <span
          style={{
            ...TYPE.caption,
            fontSize: 24,
            color: COLOR.darkGreen,
            fontWeight: 600,
          }}
        >
          Sealed until settlement
        </span>
      </div>
    </div>
  );
};

// ── Main Diagram ────────────────────────────────────────────────────────────

const BeforeAfterDiagram: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const localDuration = DISPUTE_OUT - DISPUTE_IN;

  // Global entrance
  const enterOpacity = interpolate(frame, [0, 8], [0, 1], {
    ...clamp,
    easing: EASE_OUT_EXPO,
  });

  // Exit fade
  const exitOpacity = interpolate(
    frame,
    [localDuration - 15, localDuration],
    [1, 0],
    clamp,
  );

  // BEFORE quadrant spring
  const beforeSpring = spring({
    frame,
    fps,
    config: { damping: 16, stiffness: 130, mass: 0.8 },
  });

  // AFTER quadrant spring (delayed)
  const afterSpring = spring({
    frame: Math.max(0, frame - sec(1.8)),
    fps,
    config: { damping: 16, stiffness: 130, mass: 0.8 },
  });

  // BEFORE dims when AFTER arrives
  const beforeDim = interpolate(
    frame,
    [sec(1.8), sec(2.6)],
    [1, 0.7],
    clamp,
  );

  // Webcam spring (enters with BEFORE)
  const camSpring = spring({
    frame: Math.max(0, frame - 4),
    fps,
    config: { damping: 18, stiffness: 140, mass: 0.7 },
  });

  // B-roll spring (enters with AFTER)
  const brollSpring = spring({
    frame: Math.max(0, frame - sec(1.6)),
    fps,
    config: { damping: 18, stiffness: 140, mass: 0.7 },
  });

  const beforeContent = (
    <div
      style={{
        width: "100%",
        height: "100%",
        background: "rgba(255, 255, 255, 0.95)",
        backdropFilter: "blur(16px)",
        borderBottom: `1.5px solid ${BEFORE_BORDER}`,
        borderRight: `1.5px solid ${BEFORE_BORDER}`,
        borderBottomRightRadius: CARD_RADIUS,
        padding: "40px 44px",
        display: "flex",
        flexDirection: "column",
        gap: 16,
      }}
    >
      <div style={{ ...TYPE.subHeading, color: COLOR.danger }}>
        Before
      </div>
      <div style={{ ...TYPE.cardTitle, fontSize: 32, fontWeight: 700, color: COLOR.nearBlack, marginBottom: 4 }}>
        Orderbook + Public Oracle
      </div>
      <OrderbookVisual frame={frame} fps={fps} />
    </div>
  );

  const afterContent = (
    <div
      style={{
        width: "100%",
        height: "100%",
        background: "rgba(226, 246, 213, 0.94)",
        backdropFilter: "blur(16px)",
        borderTop: `1.5px solid ${AFTER_BORDER}`,
        borderLeft: `1.5px solid ${AFTER_BORDER}`,
        borderTopLeftRadius: CARD_RADIUS,
        padding: "40px 44px",
        display: "flex",
        flexDirection: "column",
        gap: 16,
      }}
    >
      <div style={{ ...TYPE.subHeading, color: COLOR.darkGreen }}>
        After
      </div>
      <div style={{ ...TYPE.cardTitle, fontSize: 32, fontWeight: 700, color: COLOR.nearBlack, marginBottom: 4 }}>
        Parimutuel + Private Oracles
      </div>
      <ParimutuelVisual frame={frame} fps={fps} />
    </div>
  );

  return (
    <AbsoluteFill style={{ opacity: enterOpacity * exitOpacity }}>
      <SceneWrapper
        layout="quadrant"
        topLeft={beforeContent}
        bottomRight={afterContent}
        topLeftStyle={{
          opacity: beforeSpring * beforeDim,
          transform: `scale(${interpolate(beforeSpring, [0, 1], [0.96, 1], clamp)})`,
          transformOrigin: "top left",
        }}
        webcamStyle={{
          opacity: camSpring,
          transform: `scale(${interpolate(camSpring, [0, 1], [0.96, 1], clamp)})`,
          transformOrigin: "top right",
        }}
        brollStyle={{
          opacity: brollSpring,
          transform: `scale(${interpolate(brollSpring, [0, 1], [0.96, 1], clamp)})`,
          transformOrigin: "bottom left",
        }}
        bottomRightStyle={{
          opacity: afterSpring,
          transform: `scale(${interpolate(afterSpring, [0, 1], [0.96, 1], clamp)})`,
          transformOrigin: "bottom right",
        }}
      />
    </AbsoluteFill>
  );
};

export const PrivacyDiagrams: React.FC = () => {
  return (
    <AbsoluteFill>
      <Sequence from={DISPUTE_IN} durationInFrames={DISPUTE_OUT - DISPUTE_IN}>
        <BeforeAfterDiagram />
        {/* Before panel appearing */}
        <Sfx sound={PLOB_ACCENT} />
        {/* After panel appearing (delayed with afterSpring) */}
        <Sfx sound={PLOB_ACCENT} delay={sec(1.8)} />
        {/* Camera/webcam quadrant landing */}
        <Sfx sound={LAND_SOFT} delay={4} />
        {/* B-roll quadrant landing */}
        <Sfx sound={LAND_SOFT} delay={sec(1.6)} />
      </Sequence>
    </AbsoluteFill>
  );
};
