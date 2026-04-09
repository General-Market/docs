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
import { font, monoFont } from "../../../common/fonts";
import { EASE } from "../../../common/easing";
import { FPS, BRAND_GREEN, PANEL } from "../theme";
import { HFT, COMPARISONS } from "../proofData";

const sec = (s: number) => Math.round(s * FPS);

const RED = "#DC2626";
const GREEN = BRAND_GREEN;
const AMBER = "#F59E0B";

// Local timing (frame 0 = 161.40s in video)
const ORDERBOOK_IN = 0;
const ORDERBOOK_OUT = sec(11.4);

const SEALED_IN = sec(11.4);
const SEALED_OUT = sec(19.8);

const DISPUTE_IN = sec(19.8);
const DISPUTE_OUT = sec(32.6);

// ─────────────────────────────────────────────────────────────────────────────
// Parasite Label — mono uppercase with leader line
// ─────────────────────────────────────────────────────────────────────────────

interface ParasiteLabelProps {
  text: string;
  x: number;
  y: number;
  delay?: number;
  color?: string;
  anchor?: "left" | "right";
  lineFrom?: { x: number; y: number };
}

const ParasiteLabel: React.FC<ParasiteLabelProps> = ({
  text,
  x,
  y,
  delay = 0,
  color = "rgba(255,255,255,0.6)",
  anchor = "left",
  lineFrom,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const localFrame = Math.max(frame - delay, 0);

  const enterOpacity = interpolate(localFrame, [0, 9], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Subtle pulse on first appearance
  const pulseScale = spring({
    frame: localFrame,
    fps,
    config: { damping: 10, stiffness: 200, mass: 0.4 },
  });

  const scale = interpolate(pulseScale, [0, 1], [0.85, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <>
      {/* Leader line */}
      {lineFrom && (
        <svg
          width={1920}
          height={1080}
          style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none" }}
        >
          <line
            x1={lineFrom.x}
            y1={lineFrom.y}
            x2={x}
            y2={y + 8}
            stroke={color}
            strokeWidth={1}
            strokeDasharray="4 3"
            opacity={enterOpacity * 0.5}
          />
        </svg>
      )}
      <div
        style={{
          position: "absolute",
          left: anchor === "left" ? x : undefined,
          right: anchor === "right" ? 1920 - x : undefined,
          top: y,
          fontFamily: monoFont,
          fontSize: 13,
          fontWeight: 500,
          color,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          opacity: enterOpacity,
          transform: `scale(${scale})`,
          transformOrigin: anchor === "left" ? "left center" : "right center",
          whiteSpace: "nowrap",
        }}
      >
        {text}
      </div>
    </>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// 1. ORDER BOOK TRANSPARENCY PROBLEM (0s–11.4s local)
// ─────────────────────────────────────────────────────────────────────────────

interface OrderRow {
  bid: string;
  bidQty: number;
  ask: string;
  askQty: number;
}

const ORDER_ROWS: OrderRow[] = [
  { bid: "$0.52", bidQty: 200, ask: "$0.53", askQty: 150 },
  { bid: "$0.51", bidQty: 500, ask: "$0.54", askQty: 300 },
  { bid: "$0.50", bidQty: 800, ask: "$0.55", askQty: 100 },
];

interface TradeEntry {
  side: "Buy" | "Sell";
  qty: number;
  price: string;
  wallet: string;
}

const TRADES: TradeEntry[] = [
  { side: "Buy", qty: 100, price: "$0.53", wallet: "0x4a..f2" },
  { side: "Sell", qty: 50, price: "$0.52", wallet: "0xb7..1e" },
  { side: "Buy", qty: 75, price: "$0.53", wallet: "0x4a..f2" },
];

const OrderBookPanel: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const panelSlide = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 100, mass: 0.9 },
  });

  const x = interpolate(panelSlide, [0, 1], [-500, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const exitOpacity = interpolate(
    frame,
    [ORDERBOOK_OUT - 15, ORDERBOOK_OUT],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  return (
    <div
      style={{
        position: "absolute",
        left: 60,
        top: 160,
        width: 480,
        transform: `translateX(${x}px)`,
        opacity: exitOpacity,
      }}
    >
      <div
        style={{
          ...PANEL,
          padding: 0,
          overflow: "hidden",
          border: `1px solid rgba(220, 38, 38, 0.3)`,
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "14px 20px",
            borderBottom: "1px solid rgba(255,255,255,0.08)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span
            style={{
              fontFamily: monoFont,
              fontSize: 14,
              fontWeight: 700,
              color: RED,
              letterSpacing: 2,
              textTransform: "uppercase",
            }}
          >
            ORDER BOOK (public)
          </span>
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: RED,
              opacity: 0.5 + 0.5 * Math.sin(frame * 0.15),
            }}
          />
        </div>

        {/* Column headers */}
        <div
          style={{
            display: "flex",
            padding: "8px 20px",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <div
            style={{
              flex: 1,
              fontFamily: monoFont,
              fontSize: 11,
              fontWeight: 600,
              color: "rgba(255,255,255,0.35)",
              letterSpacing: 1,
            }}
          >
            BID
          </div>
          <div
            style={{
              flex: 1,
              fontFamily: monoFont,
              fontSize: 11,
              fontWeight: 600,
              color: "rgba(255,255,255,0.35)",
              letterSpacing: 1,
              textAlign: "right",
            }}
          >
            ASK
          </div>
        </div>

        {/* Order rows */}
        {ORDER_ROWS.map((row, i) => {
          const rowDelay = i * 6;
          const rowOpacity = interpolate(frame - rowDelay, [6, 14], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });

          const slideY = interpolate(frame - rowDelay, [6, 14], [20, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: EASE.out,
          });

          // Quantity ticking
          const tickOffset = Math.floor(Math.sin(frame * 0.07 + i * 2) * 15);

          return (
            <div
              key={i}
              style={{
                display: "flex",
                padding: "10px 20px",
                opacity: rowOpacity,
                transform: `translateY(${slideY}px)`,
                borderBottom: "1px solid rgba(255,255,255,0.04)",
              }}
            >
              <div style={{ flex: 1, display: "flex", gap: 8 }}>
                <span
                  style={{
                    fontFamily: monoFont,
                    fontSize: 16,
                    fontWeight: 600,
                    color: "#22c55e",
                  }}
                >
                  {row.bid}
                </span>
                <span
                  style={{
                    fontFamily: monoFont,
                    fontSize: 14,
                    color: "rgba(255,255,255,0.4)",
                  }}
                >
                  ({row.bidQty + tickOffset})
                </span>
              </div>
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  gap: 8,
                  justifyContent: "flex-end",
                }}
              >
                <span
                  style={{
                    fontFamily: monoFont,
                    fontSize: 16,
                    fontWeight: 600,
                    color: RED,
                  }}
                >
                  {row.ask}
                </span>
                <span
                  style={{
                    fontFamily: monoFont,
                    fontSize: 14,
                    color: "rgba(255,255,255,0.4)",
                  }}
                >
                  ({row.askQty + Math.abs(tickOffset)})
                </span>
              </div>
            </div>
          );
        })}

        {/* Trade tape */}
        <div
          style={{
            padding: "12px 20px 8px",
            borderTop: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <div
            style={{
              fontFamily: monoFont,
              fontSize: 11,
              fontWeight: 600,
              color: "rgba(255,255,255,0.35)",
              letterSpacing: 1,
              marginBottom: 8,
            }}
          >
            RECENT TRADES
          </div>
          {TRADES.map((trade, i) => {
            const tradeDelay = sec(1.5) + i * sec(0.8);
            const tradeOpacity = interpolate(
              frame - tradeDelay,
              [0, 8],
              [0, 1],
              { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
            );

            const slideIn = interpolate(
              frame - tradeDelay,
              [0, 8],
              [30, 0],
              {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
                easing: EASE.out,
              },
            );

            return (
              <div
                key={i}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "4px 0",
                  opacity: tradeOpacity,
                  transform: `translateY(${slideIn}px)`,
                }}
              >
                <span
                  style={{
                    fontFamily: monoFont,
                    fontSize: 13,
                    color:
                      trade.side === "Buy"
                        ? "rgba(34, 197, 94, 0.8)"
                        : "rgba(220, 38, 38, 0.8)",
                  }}
                >
                  {trade.side} {trade.qty} @ {trade.price}
                </span>
                <span
                  style={{
                    fontFamily: monoFont,
                    fontSize: 13,
                    color: AMBER,
                    opacity: 0.7,
                  }}
                >
                  {trade.wallet}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* HFT stat */}
      <div
        style={{
          marginTop: 16,
          opacity: interpolate(frame, [sec(3), sec(4)], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        <div
          style={{
            fontFamily: font,
            fontSize: 13,
            fontWeight: 500,
            color: "rgba(255,255,255,0.45)",
            lineHeight: 1.4,
          }}
        >
          In traditional markets, HFT captures{" "}
          <span style={{ color: RED, fontWeight: 700 }}>
            {HFT.usEquityShare}
          </span>{" "}
          of US equity volume.
        </div>
      </div>
    </div>
  );
};

// Magnifying glass + COPY TRADER reveal in ZONE C

const CopyTraderReveal: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Magnifying glass enters
  const glassEnter = spring({
    frame: Math.max(frame - sec(2), 0),
    fps,
    config: { damping: 12, stiffness: 120, mass: 0.7 },
  });

  const glassScale = interpolate(glassEnter, [0, 1], [0.3, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const glassOpacity = interpolate(glassEnter, [0, 1], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Zoom pulse
  const zoomPulse = interpolate(
    frame - sec(4),
    [0, sec(1.5)],
    [1, 1.3],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE.out },
  );

  // Warning text slam
  const warnEnter = spring({
    frame: Math.max(frame - sec(5.5), 0),
    fps,
    config: { damping: 8, stiffness: 200, mass: 0.5 },
  });

  const warnScale = interpolate(warnEnter, [0, 1], [2, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const warnOpacity = interpolate(warnEnter, [0, 1], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Red warning pulse
  const warnPulse = 0.7 + 0.3 * Math.sin((frame - sec(5.5)) * 0.12);

  const exitOpacity = interpolate(
    frame,
    [ORDERBOOK_OUT - 15, ORDERBOOK_OUT],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  return (
    <div
      style={{
        position: "absolute",
        right: 60,
        top: 180,
        width: 420,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 32,
        opacity: exitOpacity,
      }}
    >
      {/* Magnifying glass SVG */}
      <div
        style={{
          transform: `scale(${glassScale * zoomPulse})`,
          opacity: glassOpacity,
        }}
      >
        <svg width={120} height={120} viewBox="0 0 120 120">
          {/* Lens */}
          <circle
            cx={50}
            cy={50}
            r={36}
            fill="none"
            stroke="rgba(255,255,255,0.6)"
            strokeWidth={4}
          />
          <circle
            cx={50}
            cy={50}
            r={36}
            fill="rgba(220, 38, 38, 0.06)"
          />
          {/* Handle */}
          <line
            x1={78}
            y1={78}
            x2={110}
            y2={110}
            stroke="rgba(255,255,255,0.6)"
            strokeWidth={6}
            strokeLinecap="round"
          />
          {/* Eye icon inside lens */}
          <ellipse
            cx={50}
            cy={48}
            rx={16}
            ry={10}
            fill="none"
            stroke={RED}
            strokeWidth={2}
            opacity={0.8}
          />
          <circle cx={50} cy={48} r={5} fill={RED} opacity={0.8} />
        </svg>
      </div>

      {/* COPY TRADER FOLLOWING YOU */}
      <div
        style={{
          transform: `scale(${warnScale})`,
          opacity: warnOpacity,
          textAlign: "center",
        }}
      >
        <div
          style={{
            ...PANEL,
            padding: "18px 32px",
            border: `2px solid ${RED}`,
            background: `rgba(220, 38, 38, ${0.08 * warnPulse})`,
          }}
        >
          <div
            style={{
              fontFamily: monoFont,
              fontSize: 11,
              fontWeight: 600,
              color: "rgba(255,255,255,0.4)",
              letterSpacing: 2,
              marginBottom: 6,
            }}
          >
            WARNING
          </div>
          <div
            style={{
              fontFamily: font,
              fontSize: 22,
              fontWeight: 800,
              color: RED,
              opacity: warnPulse,
            }}
          >
            COPY TRADER FOLLOWING YOU
          </div>
        </div>
      </div>
    </div>
  );
};

const OrderBookDiagram: React.FC = () => {
  return (
    <AbsoluteFill>
      <OrderBookPanel />
      <CopyTraderReveal />

      {/* Parasite labels */}
      <ParasiteLabel
        text="your strategy: visible"
        x={80}
        y={640}
        delay={sec(3.5)}
        color={RED}
        lineFrom={{ x: 300, y: 550 }}
      />
      <ParasiteLabel
        text="wallet: traceable"
        x={80}
        y={670}
        delay={sec(4.2)}
        color={AMBER}
        lineFrom={{ x: 300, y: 550 }}
      />
      <ParasiteLabel
        text="front-runnable"
        x={80}
        y={700}
        delay={sec(4.9)}
        color={RED}
        lineFrom={{ x: 300, y: 550 }}
      />
    </AbsoluteFill>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// 2. GM SEALED ARCHITECTURE (11.4s–19.8s local)
// ─────────────────────────────────────────────────────────────────────────────

// Matrix-style scrambled text

const MATRIX_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";

const ScrambledText: React.FC<{ width: number }> = ({ width }) => {
  const frame = useCurrentFrame();

  const chars = useMemo(() => {
    const count = Math.floor(width / 9);
    return Array.from({ length: count }, () =>
      MATRIX_CHARS[Math.floor(Math.random() * MATRIX_CHARS.length)],
    );
  }, [width]);

  // Shift characters each frame
  const shifted = chars.map((c, i) => {
    const idx = (c.charCodeAt(0) + frame + i * 3) % MATRIX_CHARS.length;
    return MATRIX_CHARS[idx];
  });

  return (
    <span
      style={{
        fontFamily: monoFont,
        fontSize: 12,
        color: GREEN,
        opacity: 0.5,
        letterSpacing: 1,
      }}
    >
      {shifted.join("")}
    </span>
  );
};

const SealedArchitecture: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const localDuration = SEALED_OUT - SEALED_IN;

  const exitOpacity = interpolate(
    frame,
    [localDuration - 15, localDuration],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  // ── Left panel: Traditional flow (red) ──
  const leftEnter = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 100, mass: 0.9 },
  });

  const leftX = interpolate(leftEnter, [0, 1], [-500, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // ── Right panel: GM flow (green) ──
  const rightEnter = spring({
    frame: Math.max(frame - 4, 0),
    fps,
    config: { damping: 14, stiffness: 100, mass: 0.9 },
  });

  const rightX = interpolate(rightEnter, [0, 1], [500, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Flow step positions (vertical)
  const tradSteps = [
    "Your Bet",
    "Public Mempool",
    "Anyone Can Read",
    "Copy Trader Follows",
  ];

  const gmSteps = [
    "Your Bet",
    "ENCRYPTED",
    "Oracle (private)",
    "Only PNL Revealed",
  ];

  const flowBoxStyle = (
    color: string,
    isEncrypted = false,
  ): React.CSSProperties => ({
    ...PANEL,
    padding: "12px 20px",
    border: `1px solid ${color}`,
    borderRadius: 8,
    textAlign: "center",
    fontFamily: isEncrypted ? monoFont : font,
    fontSize: isEncrypted ? 14 : 16,
    fontWeight: 600,
    color: isEncrypted ? GREEN : "#fafafa",
    position: "relative",
    overflow: "hidden",
  });

  // Arrow connector
  const ArrowDown: React.FC<{ color: string; dashAnim?: boolean }> = ({
    color,
    dashAnim,
  }) => (
    <div style={{ display: "flex", justifyContent: "center", padding: "4px 0" }}>
      <svg width={24} height={28} viewBox="0 0 24 28">
        <line
          x1={12}
          y1={0}
          x2={12}
          y2={20}
          stroke={color}
          strokeWidth={2}
          strokeDasharray={dashAnim ? "4 3" : undefined}
          strokeDashoffset={dashAnim ? -frame * 1.5 : undefined}
          opacity={0.6}
        />
        <path
          d="M 6 18 L 12 26 L 18 18"
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
        />
      </svg>
    </div>
  );

  return (
    <AbsoluteFill
      style={{
        opacity: exitOpacity,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <div
        style={{
          display: "flex",
          gap: 80,
          width: 1100,
          maxWidth: "90%",
        }}
      >
        {/* Traditional flow (left, red) */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            transform: `translateX(${leftX}px)`,
          }}
        >
          <div
            style={{
              fontFamily: monoFont,
              fontSize: 13,
              fontWeight: 700,
              color: RED,
              letterSpacing: 2,
              textTransform: "uppercase",
              marginBottom: 16,
              textAlign: "center",
            }}
          >
            TRADITIONAL
          </div>
          {tradSteps.map((step, i) => {
            const stepDelay = i * 8;
            const stepOpacity = interpolate(
              frame - stepDelay,
              [4, 12],
              [0, 1],
              { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
            );

            return (
              <React.Fragment key={i}>
                {i > 0 && <ArrowDown color={RED} />}
                <div style={{ ...flowBoxStyle(RED), opacity: stepOpacity }}>
                  {step}
                </div>
              </React.Fragment>
            );
          })}
        </div>

        {/* GM flow (right, green) */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            transform: `translateX(${rightX}px)`,
          }}
        >
          <div
            style={{
              fontFamily: monoFont,
              fontSize: 13,
              fontWeight: 700,
              color: GREEN,
              letterSpacing: 2,
              textTransform: "uppercase",
              marginBottom: 16,
              textAlign: "center",
            }}
          >
            GENERAL MARKET
          </div>
          {gmSteps.map((step, i) => {
            const stepDelay = i * 8 + 4;
            const stepOpacity = interpolate(
              frame - stepDelay,
              [4, 12],
              [0, 1],
              { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
            );

            const isEncrypted = step === "ENCRYPTED";

            return (
              <React.Fragment key={i}>
                {i > 0 && <ArrowDown color={GREEN} dashAnim />}
                <div
                  style={{
                    ...flowBoxStyle(GREEN, isEncrypted),
                    opacity: stepOpacity,
                  }}
                >
                  {isEncrypted ? (
                    <div style={{ position: "relative" }}>
                      <ScrambledText width={200} />
                      <div
                        style={{
                          position: "absolute",
                          inset: 0,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontFamily: monoFont,
                          fontSize: 16,
                          fontWeight: 700,
                          color: GREEN,
                          textShadow: `0 0 12px rgba(0, 200, 83, 0.6)`,
                        }}
                      >
                        ENCRYPTED
                      </div>
                    </div>
                  ) : (
                    step
                  )}
                  {/* NEVER VISIBLE callout for encrypted block */}
                  {isEncrypted && (
                    <div
                      style={{
                        position: "absolute",
                        right: -140,
                        top: "50%",
                        transform: "translateY(-50%)",
                        fontFamily: monoFont,
                        fontSize: 11,
                        fontWeight: 600,
                        color: GREEN,
                        letterSpacing: 1,
                        opacity: interpolate(
                          frame,
                          [sec(2.5), sec(3.5)],
                          [0, 0.7],
                          {
                            extrapolateLeft: "clamp",
                            extrapolateRight: "clamp",
                          },
                        ),
                        whiteSpace: "nowrap",
                      }}
                    >
                      NEVER VISIBLE
                    </div>
                  )}
                </div>
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Parasite labels */}
      <ParasiteLabel
        text="sealed until settlement"
        x={1400}
        y={340}
        delay={sec(2)}
        color={GREEN}
        anchor="right"
      />
      <ParasiteLabel
        text="BLS threshold"
        x={1400}
        y={370}
        delay={sec(2.8)}
        color={GREEN}
        anchor="right"
      />
      <ParasiteLabel
        text="only aggregate revealed"
        x={1400}
        y={400}
        delay={sec(3.6)}
        color={GREEN}
        anchor="right"
      />
    </AbsoluteFill>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// 3. DISPUTE TIMELINE COMPARISON (19.8s–32.6s local)
// ─────────────────────────────────────────────────────────────────────────────

const DisputeTimeline: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const localDuration = DISPUTE_OUT - DISPUTE_IN;

  const exitOpacity = interpolate(
    frame,
    [localDuration - 15, localDuration],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  // Panel entrance
  const panelEnter = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 100, mass: 0.9 },
  });

  const panelY = interpolate(panelEnter, [0, 1], [80, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const panelOpacity = interpolate(panelEnter, [0, 1], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Traditional timeline stretches (90% width)
  const tradBarProgress = interpolate(frame, [sec(0.5), sec(3)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE.out,
  });

  // GM timeline (short — 10% width)
  const gmBarProgress = interpolate(frame, [sec(1.5), sec(2.5)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE.out,
  });

  // Traditional dispute fill animation (pulsing red)
  const disputePulse = 0.3 + 0.15 * Math.sin(frame * 0.1);

  // GM green glow
  const gmGlow = 0.6 + 0.2 * Math.sin(frame * 0.12);

  // Traditional: milestones
  const tradMilestones = [
    { label: "Order", pos: 0 },
    { label: "Trade", pos: 0.08 },
    { label: "Challenge: 7 DAYS", pos: 0.15, isDispute: true },
    { label: "Resolution", pos: 0.95 },
  ];

  // GM: milestones
  const gmMilestones = [
    { label: "Bet", pos: 0 },
    { label: "Settlement: 10 MIN", pos: 0.25, isGreen: true },
    { label: "PNL", pos: 0.55 },
    { label: "WITHDRAW", pos: 0.85 },
  ];

  // Polymarket annotation
  const annotationOpacity = interpolate(
    frame,
    [sec(4), sec(5)],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  return (
    <AbsoluteFill
      style={{
        opacity: Math.min(panelOpacity, exitOpacity),
        transform: `translateY(${panelY}px)`,
      }}
    >
      {/* Background panel in lower portion */}
      <div
        style={{
          position: "absolute",
          left: 40,
          right: 40,
          bottom: 60,
          height: 520,
          ...PANEL,
          padding: "36px 48px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: 48,
        }}
      >
        {/* TRADITIONAL timeline */}
        <div>
          <div
            style={{
              fontFamily: monoFont,
              fontSize: 13,
              fontWeight: 700,
              color: RED,
              letterSpacing: 2,
              textTransform: "uppercase",
              marginBottom: 16,
            }}
          >
            TRADITIONAL
          </div>

          {/* Timeline bar */}
          <div style={{ position: "relative", height: 50 }}>
            {/* Track */}
            <div
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                top: 20,
                height: 10,
                borderRadius: 5,
                background: "rgba(255,255,255,0.06)",
              }}
            />

            {/* Dispute fill (the massive red zone) */}
            <div
              style={{
                position: "absolute",
                left: `${0.15 * 100}%`,
                width: `${Math.max(0, (0.95 - 0.15) * tradBarProgress * 100)}%`,
                top: 16,
                height: 18,
                borderRadius: 9,
                background: `rgba(220, 38, 38, ${disputePulse})`,
              }}
            />

            {/* Milestones */}
            {tradMilestones.map((m, i) => {
              const mDelay = sec(0.5) + i * sec(0.4);
              const mOpacity = interpolate(
                frame - mDelay,
                [0, 8],
                [0, 1],
                { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
              );

              return (
                <div
                  key={i}
                  style={{
                    position: "absolute",
                    left: `${m.pos * 100}%`,
                    top: 0,
                    transform: "translateX(-50%)",
                    opacity: mOpacity,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                  }}
                >
                  {/* Dot */}
                  <div
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: "50%",
                      background: m.isDispute ? RED : "rgba(255,255,255,0.5)",
                      marginBottom: 4,
                    }}
                  />
                  {/* Label */}
                  <div
                    style={{
                      position: "absolute",
                      top: 36,
                      fontFamily: monoFont,
                      fontSize: 12,
                      fontWeight: m.isDispute ? 700 : 500,
                      color: m.isDispute ? RED : "rgba(255,255,255,0.5)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {m.label}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Parasite labels for traditional */}
          <div
            style={{
              display: "flex",
              gap: 32,
              marginTop: 32,
              opacity: interpolate(frame, [sec(3), sec(4)], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
            }}
          >
            {["dispute window", "manual review", "voter incentives"].map(
              (label, i) => (
                <div
                  key={i}
                  style={{
                    fontFamily: monoFont,
                    fontSize: 11,
                    fontWeight: 500,
                    color: "rgba(220, 38, 38, 0.6)",
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                  }}
                >
                  {label}
                </div>
              ),
            )}
          </div>
        </div>

        {/* GM timeline */}
        <div>
          <div
            style={{
              fontFamily: monoFont,
              fontSize: 13,
              fontWeight: 700,
              color: GREEN,
              letterSpacing: 2,
              textTransform: "uppercase",
              marginBottom: 16,
            }}
          >
            GENERAL MARKET
          </div>

          {/* Timeline bar — only 10% of width to show the dramatic difference */}
          <div style={{ position: "relative", height: 50, width: "15%" }}>
            {/* Track */}
            <div
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                top: 20,
                height: 10,
                borderRadius: 5,
                background: "rgba(255,255,255,0.06)",
              }}
            />

            {/* Green fill */}
            <div
              style={{
                position: "absolute",
                left: 0,
                width: `${gmBarProgress * 100}%`,
                top: 16,
                height: 18,
                borderRadius: 9,
                background: `rgba(0, 200, 83, ${gmGlow * 0.5})`,
                boxShadow: `0 0 16px rgba(0, 200, 83, ${gmGlow * 0.3})`,
              }}
            />

            {/* Milestones */}
            {gmMilestones.map((m, i) => {
              const mDelay = sec(1.5) + i * sec(0.3);
              const mOpacity = interpolate(
                frame - mDelay,
                [0, 8],
                [0, 1],
                { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
              );

              return (
                <div
                  key={i}
                  style={{
                    position: "absolute",
                    left: `${m.pos * 100}%`,
                    top: 0,
                    transform: "translateX(-50%)",
                    opacity: mOpacity,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                  }}
                >
                  <div
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: "50%",
                      background: GREEN,
                      boxShadow: m.isGreen
                        ? `0 0 8px rgba(0, 200, 83, 0.6)`
                        : undefined,
                    }}
                  />
                  <div
                    style={{
                      position: "absolute",
                      top: 36,
                      fontFamily: monoFont,
                      fontSize: 12,
                      fontWeight: m.isGreen ? 700 : 500,
                      color: GREEN,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {m.label}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Parasite labels for GM */}
          <div
            style={{
              display: "flex",
              gap: 32,
              marginTop: 32,
              opacity: interpolate(frame, [sec(3.5), sec(4.5)], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
            }}
          >
            {["automatic", "oracle consensus", "instant"].map((label, i) => (
              <div
                key={i}
                style={{
                  fontFamily: monoFont,
                  fontSize: 11,
                  fontWeight: 500,
                  color: `rgba(0, 200, 83, 0.7)`,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                }}
              >
                {label}
              </div>
            ))}
          </div>
        </div>

        {/* Polymarket annotation */}
        <div
          style={{
            position: "absolute",
            right: 48,
            top: 44,
            opacity: annotationOpacity,
            maxWidth: 280,
          }}
        >
          <div
            style={{
              fontFamily: font,
              fontSize: 13,
              fontWeight: 500,
              color: "rgba(255,255,255,0.4)",
              lineHeight: 1.5,
              textAlign: "right",
            }}
          >
            Polymarket disputes can take{" "}
            <span style={{ color: AMBER, fontWeight: 700 }}>weeks</span>.
            <br />
            GM settles in{" "}
            <span style={{ color: GREEN, fontWeight: 700 }}>
              {COMPARISONS.gmSettlement}
            </span>
            .
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Main composition — all local times, frame 0 = 161.40s in video
// ─────────────────────────────────────────────────────────────────────────────

export const PrivacyDiagrams: React.FC = () => {
  return (
    <AbsoluteFill>
      {/* 1. Order Book Transparency Problem: 0s – 11.4s */}
      <Sequence from={ORDERBOOK_IN} durationInFrames={ORDERBOOK_OUT - ORDERBOOK_IN}>
        <OrderBookDiagram />
        <Audio src={staticFile("sfx/whoosh-scene-grid.mp3")} volume={0.6} />
      </Sequence>

      {/* 2. GM Sealed Architecture: 11.4s – 19.8s */}
      <Sequence from={SEALED_IN} durationInFrames={SEALED_OUT - SEALED_IN}>
        <SealedArchitecture />
        <Audio src={staticFile("sfx/cut-fast-swish.mp3")} volume={0.55} />
      </Sequence>

      {/* 3. Dispute Timeline Comparison: 19.8s – 32.6s */}
      <Sequence from={DISPUTE_IN} durationInFrames={DISPUTE_OUT - DISPUTE_IN}>
        <DisputeTimeline />
        <Audio src={staticFile("sfx/metal-latch-unlock.mp3")} volume={0.5} />
      </Sequence>
    </AbsoluteFill>
  );
};
