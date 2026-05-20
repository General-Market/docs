import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { GMLogo } from "../gm/brand/theme";

const WIDTH = 2160;
const HEIGHT = 2160;
const FPS = 60;
const DURATION = FPS * 50;

const PALETTE = {
  bg: "#0B0E12",
  bgEdge: "#05070A",
  gridDot: "rgba(255, 255, 255, 0.045)",
  text: "#F4F5F7",
  textDim: "#9097A1",
  cardSurface: "#10141A",
  cardBorder: "rgba(255, 255, 255, 0.06)",
  yesText: "#3AD68A",
  yesBg: "rgba(58, 214, 138, 0.14)",
  noText: "#E0586C",
  noBg: "rgba(224, 88, 108, 0.14)",
  partnerMark: "#E8EAEE",
};

type Card = {
  id: string;
  badge: React.ReactNode;
  title: string;
  rows: Array<{ left: string; right: string; verdict: "yes" | "no" }>;
};

type PartnershipReelProps = {
  brandA?: React.ReactNode;
  brandB?: React.ReactNode;
  headline?: string[];
  cards?: Card[];
  rowCount?: number;
  rowSpeeds?: number[];
};

const InitialBadge: React.FC<{ initials: string; tint: string }> = ({
  initials,
  tint,
}) => (
  <div
    style={{
      width: "100%",
      height: "100%",
      borderRadius: 22,
      background: tint,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: "#0B0E12",
      fontWeight: 700,
      fontSize: 56,
      letterSpacing: "-0.02em",
      fontFamily: "'Geist Sans', system-ui, sans-serif",
    }}
  >
    {initials}
  </div>
);

const PlaceholderMark: React.FC<{ label: string }> = ({ label }) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: 28,
      color: PALETTE.partnerMark,
    }}
  >
    <div
      style={{
        width: 130,
        height: 130,
        borderRadius: 32,
        border: `4px solid ${PALETTE.partnerMark}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "'Geist Sans', system-ui, sans-serif",
        fontWeight: 700,
        fontSize: 64,
        letterSpacing: "-0.04em",
      }}
    >
      ◇
    </div>
    <div
      style={{
        fontFamily: "'Geist Sans', system-ui, sans-serif",
        fontSize: 80,
        fontWeight: 600,
        letterSpacing: "-0.025em",
      }}
    >
      {label}
    </div>
  </div>
);

const GMBrandMark: React.FC = () => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: 28,
      color: PALETTE.partnerMark,
    }}
  >
    <div style={{ width: 130, height: 130 }}>
      <GMLogo size={130} />
    </div>
    <div
      style={{
        fontFamily: "'Geist Sans', system-ui, sans-serif",
        fontSize: 80,
        fontWeight: 600,
        letterSpacing: "-0.025em",
      }}
    >
      GeneralMarket
    </div>
  </div>
);

const DEFAULT_CARDS: Card[] = [
  {
    id: "rain-london",
    badge: <InitialBadge initials="LD" tint="#7CB7FF" />,
    title: "Will London record rain on July 14?",
    rows: [
      { left: "Yes", right: "63%", verdict: "yes" },
      { left: "No", right: "37%", verdict: "no" },
    ],
  },
  {
    id: "btc-100k",
    badge: <InitialBadge initials="₿" tint="#F4B73B" />,
    title: "Bitcoin above $120k on Friday close?",
    rows: [
      { left: "Yes", right: "41%", verdict: "yes" },
      { left: "No", right: "59%", verdict: "no" },
    ],
  },
  {
    id: "lakers-win",
    badge: <InitialBadge initials="LA" tint="#FFB36A" />,
    title: "Lakers favored next regular-season game?",
    rows: [
      { left: "Yes", right: "57%", verdict: "yes" },
      { left: "No", right: "43%", verdict: "no" },
    ],
  },
  {
    id: "flight-delay",
    badge: <InitialBadge initials="FR" tint="#A8E0C4" />,
    title: "JFK average departure delay over 20 min today?",
    rows: [
      { left: "Yes", right: "28%", verdict: "yes" },
      { left: "No", right: "72%", verdict: "no" },
    ],
  },
  {
    id: "eth-gas",
    badge: <InitialBadge initials="Ξ" tint="#9FA8FF" />,
    title: "ETH average gas under 8 gwei this hour?",
    rows: [
      { left: "Yes", right: "67%", verdict: "yes" },
      { left: "No", right: "33%", verdict: "no" },
    ],
  },
  {
    id: "fed-pause",
    badge: <InitialBadge initials="FE" tint="#E3E6EB" />,
    title: "Fed holds rates at next meeting?",
    rows: [
      { left: "Yes", right: "74%", verdict: "yes" },
      { left: "No", right: "26%", verdict: "no" },
    ],
  },
  {
    id: "elec-grid",
    badge: <InitialBadge initials="EG" tint="#FFC9A1" />,
    title: "ERCOT load above 80 GW between 4–6 pm?",
    rows: [
      { left: "Yes", right: "31%", verdict: "yes" },
      { left: "No", right: "69%", verdict: "no" },
    ],
  },
  {
    id: "spx-day",
    badge: <InitialBadge initials="$P" tint="#B6F0D0" />,
    title: "S&P 500 closes green on Thursday?",
    rows: [
      { left: "Yes", right: "55%", verdict: "yes" },
      { left: "No", right: "45%", verdict: "no" },
    ],
  },
  {
    id: "binance-vol",
    badge: <InitialBadge initials="BN" tint="#F6E58D" />,
    title: "Binance BTC volume over $14B today?",
    rows: [
      { left: "Yes", right: "48%", verdict: "yes" },
      { left: "No", right: "52%", verdict: "no" },
    ],
  },
  {
    id: "mlb-runs",
    badge: <InitialBadge initials="MB" tint="#FFB6A2" />,
    title: "Yankees @ Sox combined runs over 8.5?",
    rows: [
      { left: "Yes", right: "44%", verdict: "yes" },
      { left: "No", right: "56%", verdict: "no" },
    ],
  },
  {
    id: "weather-nyc",
    badge: <InitialBadge initials="NY" tint="#9DD1FF" />,
    title: "NYC high over 88°F on Saturday?",
    rows: [
      { left: "Yes", right: "39%", verdict: "yes" },
      { left: "No", right: "61%", verdict: "no" },
    ],
  },
  {
    id: "tsla-day",
    badge: <InitialBadge initials="TS" tint="#E8D7FF" />,
    title: "Tesla closes above $260 this week?",
    rows: [
      { left: "Yes", right: "52%", verdict: "yes" },
      { left: "No", right: "48%", verdict: "no" },
    ],
  },
];

const DotGrid: React.FC = () => {
  const cells: React.ReactNode[] = [];
  const spacing = 90;
  const cols = Math.ceil(WIDTH / spacing) + 1;
  const rows = Math.ceil(HEIGHT / spacing) + 1;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      cells.push(
        <div
          key={`${r}-${c}`}
          style={{
            position: "absolute",
            left: c * spacing,
            top: r * spacing,
            width: 4,
            height: 4,
            borderRadius: 2,
            background: PALETTE.gridDot,
          }}
        />,
      );
    }
  }
  return <AbsoluteFill>{cells}</AbsoluteFill>;
};

const Vignette: React.FC = () => (
  <AbsoluteFill
    style={{
      background: `radial-gradient(circle at 50% 40%, transparent 0%, transparent 35%, ${PALETTE.bgEdge} 90%)`,
      pointerEvents: "none",
    }}
  />
);

const HeaderLockup: React.FC<{
  brandA: React.ReactNode;
  brandB: React.ReactNode;
}> = ({ brandA, brandB }) => {
  const frame = useCurrentFrame();
  const config = useVideoConfig();
  const enter = spring({
    frame,
    fps: config.fps,
    config: { damping: 200, mass: 0.7 },
    durationInFrames: 38,
  });
  const opacity = interpolate(enter, [0, 1], [0, 1]);
  const lift = interpolate(enter, [0, 1], [42, 0]);
  return (
    <div
      style={{
        position: "absolute",
        top: 165,
        width: "100%",
        display: "flex",
        justifyContent: "center",
        opacity,
        transform: `translateY(${lift}px)`,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 90,
        }}
      >
        {brandA}
        <div
          style={{
            width: 80,
            height: 80,
            color: PALETTE.partnerMark,
            opacity: 0.45,
            fontFamily: "'Geist Sans', system-ui, sans-serif",
            fontSize: 96,
            fontWeight: 300,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            lineHeight: 1,
          }}
        >
          ×
        </div>
        {brandB}
      </div>
    </div>
  );
};

const Headline: React.FC<{ lines: string[] }> = ({ lines }) => {
  const frame = useCurrentFrame();
  const config = useVideoConfig();
  return (
    <div
      style={{
        position: "absolute",
        top: 460,
        width: "100%",
        textAlign: "center",
        fontFamily: "'Geist Sans', system-ui, sans-serif",
        color: PALETTE.text,
        fontSize: 156,
        fontWeight: 700,
        letterSpacing: "-0.035em",
        lineHeight: 1.05,
      }}
    >
      {lines.map((line, i) => {
        const enter = spring({
          frame: frame - 14 - i * 6,
          fps: config.fps,
          config: { damping: 200, mass: 0.7 },
          durationInFrames: 42,
        });
        const opacity = interpolate(enter, [0, 1], [0, 1]);
        const lift = interpolate(enter, [0, 1], [60, 0]);
        const blur = interpolate(enter, [0, 1], [8, 0]);
        return (
          <div
            key={i}
            style={{
              opacity,
              transform: `translateY(${lift}px)`,
              filter: `blur(${blur}px)`,
            }}
          >
            {line}
          </div>
        );
      })}
    </div>
  );
};

const MarketCard: React.FC<{ card: Card }> = ({ card }) => (
  <div
    style={{
      width: 760,
      height: 380,
      flexShrink: 0,
      background: PALETTE.cardSurface,
      borderRadius: 36,
      border: `1px solid ${PALETTE.cardBorder}`,
      padding: "44px 44px",
      display: "flex",
      flexDirection: "column",
      gap: 28,
      boxShadow: "0 30px 70px -50px rgba(0, 0, 0, 0.9)",
      fontFamily: "'Geist Sans', system-ui, sans-serif",
    }}
  >
    <div style={{ display: "flex", gap: 28, alignItems: "flex-start" }}>
      <div style={{ width: 108, height: 108, flexShrink: 0 }}>{card.badge}</div>
      <div
        style={{
          color: PALETTE.text,
          fontSize: 36,
          fontWeight: 600,
          lineHeight: 1.18,
          letterSpacing: "-0.015em",
        }}
      >
        {card.title}
      </div>
    </div>
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 14,
        marginTop: "auto",
      }}
    >
      {card.rows.map((row, idx) => (
        <div
          key={idx}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 28,
            fontSize: 38,
            fontWeight: 600,
            color: PALETTE.textDim,
          }}
        >
          <div style={{ color: PALETTE.text }}>{row.left}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <div
              style={{
                color: PALETTE.text,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {row.right}
            </div>
            <div
              style={{
                padding: "10px 26px",
                borderRadius: 14,
                fontSize: 32,
                fontWeight: 600,
                background:
                  row.verdict === "yes" ? PALETTE.yesBg : PALETTE.noBg,
                color: row.verdict === "yes" ? PALETTE.yesText : PALETTE.noText,
                letterSpacing: "-0.01em",
              }}
            >
              {row.verdict === "yes" ? "Yes" : "No"}
            </div>
          </div>
        </div>
      ))}
    </div>
  </div>
);

const CardRow: React.FC<{
  cards: Card[];
  topPx: number;
  direction: 1 | -1;
  pxPerSecond: number;
  offset: number;
}> = ({ cards, topPx, direction, pxPerSecond, offset }) => {
  const frame = useCurrentFrame();
  const gap = 36;
  const cardWidth = 760;
  const stride = cardWidth + gap;
  const loop = stride * cards.length;
  const seconds = frame / FPS;
  const raw = (seconds * pxPerSecond * direction + offset) % loop;
  const translate = raw <= 0 ? raw : raw - loop;
  const enter = spring({
    frame: frame - 20,
    fps: FPS,
    config: { damping: 200, mass: 0.8 },
    durationInFrames: 50,
  });
  const opacity = interpolate(enter, [0, 1], [0, 1]);
  const lift = interpolate(enter, [0, 1], [80, 0]);
  return (
    <div
      style={{
        position: "absolute",
        top: topPx,
        left: 0,
        right: 0,
        overflow: "visible",
        opacity,
        transform: `translateY(${lift}px)`,
      }}
    >
      <div
        style={{
          display: "flex",
          gap,
          transform: `translateX(${translate}px)`,
          willChange: "transform",
        }}
      >
        {[...cards, ...cards, ...cards].map((card, idx) => (
          <MarketCard key={`${card.id}-${idx}`} card={card} />
        ))}
      </div>
    </div>
  );
};

export const PartnershipReel: React.FC<PartnershipReelProps> = ({
  brandA,
  brandB,
  headline,
  cards,
  rowCount = 3,
  rowSpeeds,
}) => {
  const resolvedCards = cards && cards.length > 0 ? cards : DEFAULT_CARDS;
  const resolvedBrandA = brandA ?? <GMBrandMark />;
  const resolvedBrandB = brandB ?? <PlaceholderMark label="Your Partner" />;
  const resolvedHeadline =
    headline && headline.length > 0
      ? headline
      : ["Markets you couldn't trade.", "Until now."];
  const baseSpeeds = rowSpeeds ?? [110, 140, 95];
  const speeds = Array.from(
    { length: rowCount },
    (_, i) => baseSpeeds[i % baseSpeeds.length],
  );

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(circle at 50% 30%, ${PALETTE.bg} 0%, ${PALETTE.bgEdge} 85%)`,
      }}
    >
      <DotGrid />
      <Vignette />
      <HeaderLockup brandA={resolvedBrandA} brandB={resolvedBrandB} />
      <Headline lines={resolvedHeadline} />
      {Array.from({ length: rowCount }).map((_, i) => {
        const direction: 1 | -1 = i % 2 === 0 ? -1 : 1;
        const top = 980 + i * 420;
        const offset = (i * 280) % 760;
        const start = i * 4;
        const rowCards = [
          ...resolvedCards.slice(start),
          ...resolvedCards.slice(0, start),
        ];
        return (
          <CardRow
            key={i}
            cards={rowCards}
            topPx={top}
            direction={direction}
            pxPerSecond={speeds[i]}
            offset={offset}
          />
        );
      })}
    </AbsoluteFill>
  );
};

export const partnershipReelMeta = {
  id: "PartnershipReel",
  component: PartnershipReel,
  durationInFrames: DURATION,
  fps: FPS,
  width: WIDTH,
  height: HEIGHT,
};
