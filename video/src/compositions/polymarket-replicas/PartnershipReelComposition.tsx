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
  bg: "#0A0D11",
  bgEdge: "#04060A",
  gridDot: "rgba(255, 255, 255, 0.05)",
  text: "#F7F8FA",
  textDim: "#9AA0AA",
  cardSurface: "#0E1218",
  cardBorder: "rgba(255, 255, 255, 0.055)",
  yesText: "#3FD489",
  yesBg: "rgba(63, 212, 137, 0.12)",
  noText: "#E66072",
  noBg: "rgba(230, 96, 114, 0.12)",
  mark: "#F2F4F8",
};

type CardRow = { price: string; percent: string; verdict: "yes" | "no" };
type Card = {
  id: string;
  badge: React.ReactNode;
  title: string;
  rows: [CardRow, CardRow];
};

type PartnershipReelProps = {
  brandA?: React.ReactNode;
  brandB?: React.ReactNode;
  headline?: string[];
  cards?: Card[];
  rowCount?: number;
  rowSpeeds?: number[];
};

const InitialBadge: React.FC<{
  initials: string;
  tint: string;
  glyph?: string;
}> = ({ initials, tint, glyph }) => (
  <div
    style={{
      width: "100%",
      height: "100%",
      borderRadius: 26,
      background: tint,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: "#0A0D11",
      fontWeight: 700,
      fontSize: glyph ? 88 : 64,
      letterSpacing: "-0.025em",
      fontFamily: "'Geist Sans', system-ui, sans-serif",
    }}
  >
    {glyph ?? initials}
  </div>
);

const PlaceholderMark: React.FC<{ label: string }> = ({ label }) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: 36,
      color: PALETTE.mark,
    }}
  >
    <div
      style={{
        width: 240,
        height: 240,
        borderRadius: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: PALETTE.mark,
      }}
    >
      <svg width="200" height="200" viewBox="0 0 200 200" fill="none">
        <path
          d="M30 100 L70 60 L110 100 L150 60 L190 100"
          stroke={PALETTE.mark}
          strokeWidth="22"
          strokeLinejoin="miter"
          fill="none"
        />
        <path
          d="M10 130 L50 90 L90 130 L130 90 L170 130"
          stroke={PALETTE.mark}
          strokeWidth="22"
          strokeLinejoin="miter"
          fill="none"
          opacity="0.95"
        />
      </svg>
    </div>
    <div
      style={{
        fontFamily: "'Geist Sans', system-ui, sans-serif",
        fontSize: 96,
        fontWeight: 600,
        letterSpacing: "-0.03em",
        lineHeight: 0.95,
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
      gap: 32,
      color: PALETTE.mark,
    }}
  >
    <div
      style={{
        width: 220,
        height: 220,
        borderRadius: 36,
        background: "#000",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <GMLogo size={170} bgColor="#000" barColor={PALETTE.mark} />
    </div>
    <div
      style={{
        fontFamily: "'Geist Sans', system-ui, sans-serif",
        fontSize: 110,
        fontWeight: 600,
        letterSpacing: "-0.03em",
        lineHeight: 0.95,
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
      { price: "Yes", percent: "63%", verdict: "yes" },
      { price: "No", percent: "37%", verdict: "no" },
    ],
  },
  {
    id: "btc-120k",
    badge: <InitialBadge initials="BTC" tint="#F4B73B" glyph="₿" />,
    title: "Bitcoin closes above $120k this Friday?",
    rows: [
      { price: "Yes", percent: "41%", verdict: "yes" },
      { price: "No", percent: "59%", verdict: "no" },
    ],
  },
  {
    id: "lakers-win",
    badge: <InitialBadge initials="LA" tint="#FFB36A" />,
    title: "Lakers favored in their next regular-season game?",
    rows: [
      { price: "Yes", percent: "57%", verdict: "yes" },
      { price: "No", percent: "43%", verdict: "no" },
    ],
  },
  {
    id: "jfk-delay",
    badge: <InitialBadge initials="JFK" tint="#A8E0C4" />,
    title: "JFK average departure delay over 20 min today?",
    rows: [
      { price: "Yes", percent: "28%", verdict: "yes" },
      { price: "No", percent: "72%", verdict: "no" },
    ],
  },
  {
    id: "eth-gas",
    badge: <InitialBadge initials="Ξ" tint="#9FA8FF" glyph="Ξ" />,
    title: "ETH average gas under 8 gwei this hour?",
    rows: [
      { price: "Yes", percent: "67%", verdict: "yes" },
      { price: "No", percent: "33%", verdict: "no" },
    ],
  },
  {
    id: "fed-hold",
    badge: <InitialBadge initials="FE" tint="#E3E6EB" />,
    title: "Fed holds rates at the next FOMC meeting?",
    rows: [
      { price: "Yes", percent: "74%", verdict: "yes" },
      { price: "No", percent: "26%", verdict: "no" },
    ],
  },
  {
    id: "ercot-load",
    badge: <InitialBadge initials="EG" tint="#FFC9A1" />,
    title: "ERCOT load peaks above 80 GW between 4 and 6 pm?",
    rows: [
      { price: "Yes", percent: "31%", verdict: "yes" },
      { price: "No", percent: "69%", verdict: "no" },
    ],
  },
  {
    id: "spx-day",
    badge: <InitialBadge initials="SP" tint="#B6F0D0" />,
    title: "S&P 500 closes green on Thursday?",
    rows: [
      { price: "Yes", percent: "55%", verdict: "yes" },
      { price: "No", percent: "45%", verdict: "no" },
    ],
  },
  {
    id: "binance-vol",
    badge: <InitialBadge initials="BN" tint="#F6E58D" />,
    title: "Binance BTC spot volume over $14B today?",
    rows: [
      { price: "Yes", percent: "48%", verdict: "yes" },
      { price: "No", percent: "52%", verdict: "no" },
    ],
  },
  {
    id: "mlb-runs",
    badge: <InitialBadge initials="MB" tint="#FFB6A2" />,
    title: "Yankees @ Red Sox combined runs over 8.5?",
    rows: [
      { price: "Yes", percent: "44%", verdict: "yes" },
      { price: "No", percent: "56%", verdict: "no" },
    ],
  },
  {
    id: "nyc-heat",
    badge: <InitialBadge initials="NY" tint="#9DD1FF" />,
    title: "NYC daytime high over 88°F on Saturday?",
    rows: [
      { price: "Yes", percent: "39%", verdict: "yes" },
      { price: "No", percent: "61%", verdict: "no" },
    ],
  },
  {
    id: "tsla-week",
    badge: <InitialBadge initials="TS" tint="#E8D7FF" />,
    title: "Tesla closes above $260 by Friday?",
    rows: [
      { price: "Yes", percent: "52%", verdict: "yes" },
      { price: "No", percent: "48%", verdict: "no" },
    ],
  },
];

const DotGrid: React.FC = () => {
  const cells: React.ReactNode[] = [];
  const spacing = 110;
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
            width: 5,
            height: 5,
            borderRadius: 3,
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
      background: `radial-gradient(circle at 50% 35%, transparent 0%, transparent 40%, ${PALETTE.bgEdge} 95%)`,
      pointerEvents: "none",
    }}
  />
);

const Separator: React.FC = () => (
  <div
    style={{
      width: 200,
      height: 240,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: PALETTE.mark,
      opacity: 0.55,
    }}
  >
    <svg width="180" height="180" viewBox="0 0 180 180" fill="none">
      <defs>
        <filter id="x-blur" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="4" />
        </filter>
      </defs>
      <g filter="url(#x-blur)" opacity="0.85">
        <path
          d="M50 50 L130 130 M130 50 L50 130"
          stroke={PALETTE.mark}
          strokeWidth="6"
          strokeLinecap="round"
        />
      </g>
      <path
        d="M50 50 L130 130 M130 50 L50 130"
        stroke={PALETTE.mark}
        strokeWidth="4"
        strokeLinecap="round"
      />
    </svg>
  </div>
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
    durationInFrames: 42,
  });
  const opacity = interpolate(enter, [0, 1], [0, 1]);
  const lift = interpolate(enter, [0, 1], [50, 0]);
  return (
    <div
      style={{
        position: "absolute",
        top: 230,
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
          gap: 64,
        }}
      >
        {brandA}
        <Separator />
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
        top: 820,
        width: "100%",
        textAlign: "center",
        fontFamily: "'Geist Sans', system-ui, sans-serif",
        color: PALETTE.text,
        fontSize: 178,
        fontWeight: 700,
        letterSpacing: "-0.038em",
        lineHeight: 1.04,
      }}
    >
      {lines.map((line, i) => {
        const enter = spring({
          frame: frame - 16 - i * 7,
          fps: config.fps,
          config: { damping: 200, mass: 0.7 },
          durationInFrames: 46,
        });
        const opacity = interpolate(enter, [0, 1], [0, 1]);
        const lift = interpolate(enter, [0, 1], [70, 0]);
        const blur = interpolate(enter, [0, 1], [10, 0]);
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

const Pill: React.FC<{ verdict: "yes" | "no" }> = ({ verdict }) => (
  <div
    style={{
      padding: "14px 30px",
      borderRadius: 18,
      fontSize: 42,
      fontWeight: 600,
      background: verdict === "yes" ? PALETTE.yesBg : PALETTE.noBg,
      color: verdict === "yes" ? PALETTE.yesText : PALETTE.noText,
      letterSpacing: "-0.01em",
      fontFamily: "'Geist Sans', system-ui, sans-serif",
      minWidth: 100,
      textAlign: "center",
    }}
  >
    {verdict === "yes" ? "Yes" : "No"}
  </div>
);

const MarketCard: React.FC<{ card: Card }> = ({ card }) => (
  <div
    style={{
      width: 1080,
      height: 500,
      flexShrink: 0,
      background: PALETTE.cardSurface,
      borderRadius: 44,
      border: `1px solid ${PALETTE.cardBorder}`,
      padding: "52px 58px",
      display: "flex",
      flexDirection: "column",
      gap: 36,
      boxShadow: "0 30px 90px -60px rgba(0, 0, 0, 0.9)",
      fontFamily: "'Geist Sans', system-ui, sans-serif",
    }}
  >
    <div style={{ display: "flex", gap: 32, alignItems: "flex-start" }}>
      <div style={{ width: 130, height: 130, flexShrink: 0 }}>{card.badge}</div>
      <div
        style={{
          color: PALETTE.text,
          fontSize: 50,
          fontWeight: 600,
          lineHeight: 1.16,
          letterSpacing: "-0.02em",
          flex: 1,
        }}
      >
        {card.title}
      </div>
    </div>
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 18,
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
            fontSize: 50,
            fontWeight: 500,
          }}
        >
          <div style={{ color: PALETTE.textDim }}>{row.price}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
            <div
              style={{
                color: PALETTE.text,
                fontVariantNumeric: "tabular-nums",
                fontWeight: 600,
                minWidth: 140,
                textAlign: "right",
              }}
            >
              {row.percent}
            </div>
            <Pill verdict={row.verdict} />
          </div>
        </div>
      ))}
    </div>
  </div>
);

const CardRowScroller: React.FC<{
  cards: Card[];
  topPx: number;
  direction: 1 | -1;
  pxPerSecond: number;
  offset: number;
}> = ({ cards, topPx, direction, pxPerSecond, offset }) => {
  const frame = useCurrentFrame();
  const gap = 44;
  const cardWidth = 1080;
  const stride = cardWidth + gap;
  const loop = stride * cards.length;
  const seconds = frame / FPS;
  const raw = (seconds * pxPerSecond * direction + offset) % loop;
  const translate = raw <= 0 ? raw : raw - loop;
  const enter = spring({
    frame: frame - 24,
    fps: FPS,
    config: { damping: 200, mass: 0.8 },
    durationInFrames: 60,
  });
  const opacity = interpolate(enter, [0, 1], [0, 1]);
  const lift = interpolate(enter, [0, 1], [90, 0]);
  return (
    <div
      style={{
        position: "absolute",
        top: topPx,
        left: 0,
        right: 0,
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
  rowCount = 2,
  rowSpeeds,
}) => {
  const resolvedCards = cards && cards.length > 0 ? cards : DEFAULT_CARDS;
  const resolvedBrandA = brandA ?? <GMBrandMark />;
  const resolvedBrandB = brandB ?? <PlaceholderMark label="Your Partner" />;
  const resolvedHeadline =
    headline && headline.length > 0
      ? headline
      : ["Markets you couldn't trade.", "Until now."];
  const baseSpeeds = rowSpeeds ?? [120, 95];
  const speeds = Array.from(
    { length: rowCount },
    (_, i) => baseSpeeds[i % baseSpeeds.length],
  );

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(circle at 50% 28%, ${PALETTE.bg} 0%, ${PALETTE.bgEdge} 90%)`,
      }}
    >
      <DotGrid />
      <Vignette />
      <HeaderLockup brandA={resolvedBrandA} brandB={resolvedBrandB} />
      <Headline lines={resolvedHeadline} />
      {Array.from({ length: rowCount }).map((_, i) => {
        const direction: 1 | -1 = i % 2 === 0 ? -1 : 1;
        const top = 1520 + i * 560;
        const offset = (i * 360) % 1080;
        const rowCards = [
          ...resolvedCards.slice(i * 4),
          ...resolvedCards.slice(0, i * 4),
        ];
        return (
          <CardRowScroller
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
