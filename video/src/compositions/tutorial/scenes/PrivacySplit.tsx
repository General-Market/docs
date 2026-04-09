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

const sec = (s: number) => Math.round(s * FPS);

// Local timing (frame 0 = 161.40s in video)
const Q_CARD_IN = 0;
const Q_CARD_OUT = sec(4.8);

const SPLIT_IN = sec(4.8);
const SPLIT_OUT = sec(11.4);

const ORACLE_IN = sec(11.4);
const ORACLE_OUT = sec(19.8);

const TABLE_IN = sec(19.8);
const TABLE_OUT = sec(32.6);

const RED = "#DC2626";
const GREEN = BRAND_GREEN;

// ---------------------------------------------------------------------------
// Q Card — "How is General Market private?"
// ---------------------------------------------------------------------------

const QCard: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const enterY = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 120, mass: 0.8 },
  });

  const y = interpolate(enterY, [0, 1], [80, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const enterOpacity = interpolate(frame, [0, 8], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const exitOpacity = interpolate(
    frame,
    [Q_CARD_OUT - 12, Q_CARD_OUT],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  return (
    <AbsoluteFill
      style={{
        justifyContent: "flex-end",
        alignItems: "center",
        paddingBottom: 140,
        opacity: Math.min(enterOpacity, exitOpacity),
        transform: `translateY(${y}px)`,
      }}
    >
      <div
        style={{
          ...PANEL,
          padding: "32px 56px",
          maxWidth: 900,
        }}
      >
        <div
          style={{
            fontFamily: font,
            fontSize: 44,
            fontWeight: 800,
            color: "#fafafa",
            textAlign: "center",
            lineHeight: 1.3,
          }}
        >
          How is <span style={{ color: GREEN }}>General Market</span> private?
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// Split Comparison — Traditional vs General Market
// ---------------------------------------------------------------------------

const OrderbookLines: React.FC = () => {
  const frame = useCurrentFrame();
  const widths = [0.7, 0.45, 0.85, 0.55, 0.65, 0.3, 0.75, 0.5];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {widths.map((w, i) => {
        const delay = i * 3;
        const barWidth = interpolate(frame - delay, [0, 12], [0, w * 100], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: EASE.out,
        });

        const shimmer = 0.4 + 0.15 * Math.sin((frame - delay) * 0.15 + i);

        return (
          <div
            key={i}
            style={{
              height: 8,
              width: `${barWidth}%`,
              background: `rgba(220, 38, 38, ${shimmer})`,
              borderRadius: 4,
            }}
          />
        );
      })}
    </div>
  );
};

const FrostedBlock: React.FC = () => {
  const frame = useCurrentFrame();
  const pulse = 0.6 + 0.1 * Math.sin(frame * 0.08);

  return (
    <div
      style={{
        width: "100%",
        height: 100,
        borderRadius: 8,
        background: `rgba(0, 200, 83, ${pulse * 0.15})`,
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Abstract shapes behind the frost */}
      {[0, 1, 2, 3, 4].map((i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            width: 40 + i * 12,
            height: 8,
            borderRadius: 4,
            background: `rgba(0, 200, 83, ${0.2 + i * 0.05})`,
            top: 10 + i * 18,
            left: 12 + (i % 3) * 30,
            filter: "blur(6px)",
          }}
        />
      ))}
    </div>
  );
};

const SplitComparison: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const leftSlide = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 100, mass: 0.9 },
  });

  const rightSlide = spring({
    frame: Math.max(frame - 4, 0),
    fps,
    config: { damping: 14, stiffness: 100, mass: 0.9 },
  });

  const leftX = interpolate(leftSlide, [0, 1], [-600, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const rightX = interpolate(rightSlide, [0, 1], [600, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const splitDuration = SPLIT_OUT - SPLIT_IN;
  const exitOpacity = interpolate(
    frame,
    [splitDuration - 15, splitDuration],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  const panelBase: React.CSSProperties = {
    flex: 1,
    ...PANEL,
    padding: "28px 32px",
    display: "flex",
    flexDirection: "column",
    gap: 16,
  };

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        opacity: exitOpacity,
      }}
    >
      <div
        style={{
          display: "flex",
          gap: 16,
          width: 1200,
          maxWidth: "90%",
        }}
      >
        {/* Traditional panel */}
        <div
          style={{
            ...panelBase,
            border: `2px solid ${RED}`,
            transform: `translateX(${leftX}px)`,
          }}
        >
          <div
            style={{
              fontFamily: monoFont,
              fontSize: 16,
              fontWeight: 700,
              color: RED,
              letterSpacing: 3,
              textTransform: "uppercase",
            }}
          >
            Traditional
          </div>
          <OrderbookLines />
          <div style={{ marginTop: 8 }}>
            <div
              style={{
                fontFamily: font,
                fontSize: 22,
                fontWeight: 700,
                color: "rgba(255,255,255,0.7)",
              }}
            >
              Order book visible
            </div>
            <div
              style={{
                fontFamily: font,
                fontSize: 16,
                fontWeight: 400,
                color: "rgba(255,255,255,0.4)",
                marginTop: 4,
              }}
            >
              Copy traders can see your strategy
            </div>
          </div>
        </div>

        {/* General Market panel */}
        <div
          style={{
            ...panelBase,
            border: `2px solid ${GREEN}`,
            transform: `translateX(${rightX}px)`,
          }}
        >
          <div
            style={{
              fontFamily: monoFont,
              fontSize: 16,
              fontWeight: 700,
              color: GREEN,
              letterSpacing: 3,
              textTransform: "uppercase",
            }}
          >
            General Market
          </div>
          <FrostedBlock />
          <div style={{ marginTop: 8 }}>
            <div
              style={{
                fontFamily: font,
                fontSize: 22,
                fontWeight: 700,
                color: "#fafafa",
              }}
            >
              Bets sealed until settlement
            </div>
            <div
              style={{
                fontFamily: font,
                fontSize: 16,
                fontWeight: 400,
                color: "rgba(255,255,255,0.5)",
                marginTop: 4,
              }}
            >
              No one sees your positions
            </div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// Oracle Network — 3 nodes in triangle formation with BLS consensus
// ---------------------------------------------------------------------------

interface NodePosition {
  x: number;
  y: number;
}

const NODES: NodePosition[] = [
  { x: 960, y: 360 },  // top center
  { x: 780, y: 560 },  // bottom left
  { x: 1140, y: 560 }, // bottom right
];

const OracleNetwork: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const oracleDuration = ORACLE_OUT - ORACLE_IN;

  const exitOpacity = interpolate(
    frame,
    [oracleDuration - 15, oracleDuration],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  // Node entrance stagger
  const nodeScales = NODES.map((_, i) => {
    return spring({
      frame: Math.max(frame - i * 6, 0),
      fps,
      config: { damping: 12, stiffness: 160, mass: 0.6 },
    });
  });

  // Pulsing line opacity
  const linePulse = 0.4 + 0.3 * Math.sin(frame * 0.12);
  const lineProgress = interpolate(frame, [12, 30], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE.out,
  });

  // Label entrance
  const labelOpacity = interpolate(frame, [20, 32], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE.out,
  });

  const labelY = interpolate(frame, [20, 32], [16, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE.out,
  });

  // Connecting lines between nodes
  const lines: [number, number][] = [
    [0, 1],
    [1, 2],
    [2, 0],
  ];

  return (
    <AbsoluteFill style={{ opacity: exitOpacity }}>
      {/* Dark backdrop */}
      <AbsoluteFill
        style={{
          ...PANEL,
          borderRadius: 0,
          opacity: 0.92,
        }}
      />

      {/* SVG lines */}
      <svg
        width={1920}
        height={1080}
        style={{ position: "absolute", top: 0, left: 0 }}
      >
        {lines.map(([a, b], i) => {
          const from = NODES[a];
          const to = NODES[b];

          // Animated dash for data flow
          const dashOffset = -frame * 2;

          return (
            <line
              key={i}
              x1={from.x}
              y1={from.y}
              x2={from.x + (to.x - from.x) * lineProgress}
              y2={from.y + (to.y - from.y) * lineProgress}
              stroke={GREEN}
              strokeOpacity={linePulse}
              strokeWidth={2}
              strokeDasharray="8 6"
              strokeDashoffset={dashOffset}
            />
          );
        })}
      </svg>

      {/* Nodes */}
      {NODES.map((pos, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: pos.x - 20,
            top: pos.y - 20,
            width: 40,
            height: 40,
            borderRadius: "50%",
            border: `2px solid #fafafa`,
            background: GREEN,
            transform: `scale(${nodeScales[i]})`,
            boxShadow: `0 0 ${12 + 6 * Math.sin(frame * 0.1 + i)}px rgba(0, 200, 83, 0.4)`,
          }}
        />
      ))}

      {/* Labels */}
      <div
        style={{
          position: "absolute",
          top: 620,
          left: 0,
          right: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 8,
          opacity: labelOpacity,
          transform: `translateY(${labelY}px)`,
        }}
      >
        <div
          style={{
            fontFamily: monoFont,
            fontSize: 28,
            fontWeight: 700,
            color: GREEN,
            letterSpacing: 4,
          }}
        >
          BLS CONSENSUS
        </div>
        <div
          style={{
            fontFamily: font,
            fontSize: 20,
            fontWeight: 400,
            color: "rgba(255,255,255,0.6)",
          }}
        >
          Specialized Scalable Oracle
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// Comparison Table — Traditional vs General Market
// ---------------------------------------------------------------------------

interface TableRow {
  label: string;
  traditional: string;
  gm: string;
}

const TABLE_ROWS: TableRow[] = [
  { label: "Settlement", traditional: "Days", gm: "10 minutes" },
  { label: "Disputes", traditional: "Yes", gm: "None" },
  { label: "Trade visibility", traditional: "Public", gm: "Private" },
];

const ROW_STAGGER = sec(0.4);

const ComparisonTable: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const tableDuration = TABLE_OUT - TABLE_IN;

  const exitOpacity = interpolate(
    frame,
    [tableDuration - 15, tableDuration],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  const headerOpacity = interpolate(frame, [0, 12], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE.out,
  });

  const cellStyle: React.CSSProperties = {
    padding: "16px 24px",
    fontFamily: monoFont,
    fontSize: 22,
    fontWeight: 500,
    borderBottom: "1px solid rgba(255,255,255,0.08)",
  };

  const headerCell: React.CSSProperties = {
    ...cellStyle,
    fontFamily: font,
    fontSize: 16,
    fontWeight: 700,
    letterSpacing: 3,
    textTransform: "uppercase",
    borderBottom: "2px solid rgba(255,255,255,0.15)",
  };

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        opacity: exitOpacity,
      }}
    >
      <div
        style={{
          ...PANEL,
          padding: "0",
          overflow: "hidden",
          width: 900,
        }}
      >
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
          }}
        >
          <thead>
            <tr style={{ opacity: headerOpacity }}>
              <th style={{ ...headerCell, color: "rgba(255,255,255,0.5)", textAlign: "left" }}>
                &nbsp;
              </th>
              <th style={{ ...headerCell, color: "rgba(255,255,255,0.5)", textAlign: "center" }}>
                Traditional
              </th>
              <th style={{ ...headerCell, color: GREEN, textAlign: "center" }}>
                General Market
              </th>
            </tr>
          </thead>
          <tbody>
            {TABLE_ROWS.map((row, i) => {
              const rowLocal = frame - sec(0.6) - i * ROW_STAGGER;

              const rowSlide = spring({
                frame: Math.max(rowLocal, 0),
                fps,
                config: { damping: 16, stiffness: 130, mass: 0.7 },
              });

              const rowOpacity = interpolate(rowLocal, [0, 6], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              });

              const rowY = interpolate(rowSlide, [0, 1], [20, 0], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              });

              return (
                <tr
                  key={row.label}
                  style={{
                    opacity: rowOpacity,
                    transform: `translateY(${rowY}px)`,
                  }}
                >
                  <td
                    style={{
                      ...cellStyle,
                      color: "rgba(255,255,255,0.6)",
                      textAlign: "left",
                      fontFamily: font,
                      fontWeight: 600,
                    }}
                  >
                    {row.label}
                  </td>
                  <td
                    style={{
                      ...cellStyle,
                      color: "rgba(255,255,255,0.35)",
                      textAlign: "center",
                    }}
                  >
                    {row.traditional}
                  </td>
                  <td
                    style={{
                      ...cellStyle,
                      color: GREEN,
                      textAlign: "center",
                      fontWeight: 700,
                    }}
                  >
                    {row.gm}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// Main composition
// ---------------------------------------------------------------------------

export const PrivacySplit: React.FC = () => {
  return (
    <AbsoluteFill>
      {/* Q Card: 0s – 4.8s */}
      <Sequence from={Q_CARD_IN} durationInFrames={Q_CARD_OUT - Q_CARD_IN}>
        <QCard />
        <Audio src={staticFile("sfx/whoosh-scene-grid.mp3")} volume={0.65} />
      </Sequence>

      {/* Split comparison: 4.8s – 11.4s */}
      <Sequence from={SPLIT_IN} durationInFrames={SPLIT_OUT - SPLIT_IN}>
        <SplitComparison />
        <Audio src={staticFile("sfx/cut-fast-swish.mp3")} volume={0.6} />
      </Sequence>

      {/* Oracle network: 11.4s – 19.8s */}
      <Sequence from={ORACLE_IN} durationInFrames={ORACLE_OUT - ORACLE_IN}>
        <OracleNetwork />
        {NODES.map((_, i) => (
          <Sequence key={i} from={i * sec(0.2)}>
            <Audio src={staticFile("sfx/cursor-click-soft.mp3")} volume={0.45} />
          </Sequence>
        ))}
      </Sequence>

      {/* Comparison table: 19.8s – 32.6s */}
      <Sequence from={TABLE_IN} durationInFrames={TABLE_OUT - TABLE_IN}>
        <ComparisonTable />
        {TABLE_ROWS.map((_, i) => (
          <Sequence key={i} from={sec(0.6) + i * ROW_STAGGER}>
            <Audio src={staticFile("sfx/scroll-tick.mp3")} volume={0.4} />
          </Sequence>
        ))}
      </Sequence>
    </AbsoluteFill>
  );
};
