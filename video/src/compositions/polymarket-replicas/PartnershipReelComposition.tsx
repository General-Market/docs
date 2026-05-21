import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { loadFont as loadInterTight } from "@remotion/google-fonts/InterTight";

const { fontFamily: INTER } = loadInterTight("normal", {
  weights: ["400", "500", "600", "700"],
});

const WIDTH = 2160;
const HEIGHT = 2160;
const FPS = 60;
const DURATION = FPS * 50;

const PALETTE = {
  bgTop: "#1A1E25",
  bgBottom: "#06080C",
  gridLine: "rgba(255, 255, 255, 0.055)",
  gridDot: "rgba(255, 255, 255, 0.13)",
  text: "#F5F6F8",
  textPrice: "#D8DCE3",
  textDim: "#8E939D",
  textVeryDim: "#5F6571",
  cardSurface: "#0F1218",
  cardBorder: "rgba(255, 255, 255, 0.05)",
  yesText: "#3AD686",
  yesBg: "rgba(58, 214, 134, 0.10)",
  noText: "#E45E70",
  noBg: "rgba(228, 94, 112, 0.10)",
  mark: "#F2F4F8",
};

type Tier = { price: string; percent: string };
type Card = {
  id: string;
  badge: React.ReactNode;
  question: string;
  tiers: [Tier, Tier];
};

type PartnershipReelProps = {
  brandA?: React.ReactNode;
  brandB?: React.ReactNode;
  headline?: string[];
  cards?: Card[];
  rowSpeed?: number;
};

const InitialBadge: React.FC<{
  initials?: string;
  glyph?: string;
  tint: string;
  textColor?: string;
}> = ({ initials, glyph, tint, textColor = "#0A0D11" }) => (
  <div
    style={{
      width: "100%",
      height: "100%",
      borderRadius: 24,
      background: tint,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: textColor,
      fontWeight: 700,
      fontSize: glyph ? 90 : 60,
      letterSpacing: "-0.025em",
      fontFamily: INTER,
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
      gap: 30,
      color: PALETTE.mark,
    }}
  >
    <svg width="220" height="220" viewBox="0 0 200 200" fill="none">
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
      />
    </svg>
    <div
      style={{
        fontFamily: INTER,
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
    <svg width="240" height="240" viewBox="0 0 1024 1024" fill="none">
      <rect width="1024" height="1024" rx="232" ry="232" fill="#000000" />
      <rect
        x="256"
        y="462"
        width="512"
        height="100"
        rx="50"
        ry="50"
        fill="#FFFFFF"
      />
    </svg>
    <div
      style={{
        fontFamily: INTER,
        fontSize: 132,
        fontWeight: 600,
        letterSpacing: "-0.044em",
        lineHeight: 0.92,
        color: "#1D1D1F",
        WebkitTextFillColor: PALETTE.mark,
      }}
    >
      general
    </div>
  </div>
);

const DEFAULT_CARDS: Card[] = [
  {
    id: "weather-london",
    badge: <InitialBadge initials="LD" tint="#7CB7FF" />,
    question: "Will London record over ___ mm rain on July 14?",
    tiers: [
      { price: "5 mm", percent: "63%" },
      { price: "12 mm", percent: "37%" },
    ],
  },
  {
    id: "btc-friday",
    badge: <InitialBadge glyph="₿" tint="#F4B73B" />,
    question: "Will Bitcoin close above $ ___ this Friday?",
    tiers: [
      { price: "$110k", percent: "62%" },
      { price: "$120k", percent: "31%" },
    ],
  },
  {
    id: "lakers-game",
    badge: <InitialBadge initials="LA" tint="#FFB36A" />,
    question: "Will the Lakers win their next game by ___ pts?",
    tiers: [
      { price: "5 pts", percent: "57%" },
      { price: "10 pts", percent: "29%" },
    ],
  },
  {
    id: "jfk-delay",
    badge: <InitialBadge initials="JFK" tint="#A8E0C4" />,
    question: "Will JFK average departures be over ___ min today?",
    tiers: [
      { price: "15 min", percent: "48%" },
      { price: "25 min", percent: "21%" },
    ],
  },
  {
    id: "eth-gas",
    badge: <InitialBadge glyph="Ξ" tint="#9FA8FF" />,
    question: "Will ETH average gas stay under ___ gwei this hour?",
    tiers: [
      { price: "6 gwei", percent: "67%" },
      { price: "4 gwei", percent: "33%" },
    ],
  },
  {
    id: "fed-rates",
    badge: <InitialBadge initials="FE" tint="#E3E6EB" />,
    question: "Will the Fed cut by ___ bps at the next meeting?",
    tiers: [
      { price: "25 bps", percent: "74%" },
      { price: "50 bps", percent: "12%" },
    ],
  },
  {
    id: "ercot-load",
    badge: <InitialBadge initials="EG" tint="#FFC9A1" />,
    question: "Will ERCOT load peak above ___ GW between 4-6 pm?",
    tiers: [
      { price: "75 GW", percent: "52%" },
      { price: "82 GW", percent: "18%" },
    ],
  },
  {
    id: "spx-thursday",
    badge: <InitialBadge initials="SP" tint="#B6F0D0" />,
    question: "Will the S&P 500 close above ___ on Thursday?",
    tiers: [
      { price: "5,400", percent: "55%" },
      { price: "5,500", percent: "23%" },
    ],
  },
  {
    id: "binance-vol",
    badge: <InitialBadge initials="BN" tint="#F6E58D" />,
    question: "Will Binance BTC spot volume exceed $ ___ today?",
    tiers: [
      { price: "$10B", percent: "61%" },
      { price: "$15B", percent: "24%" },
    ],
  },
  {
    id: "mlb-runs",
    badge: <InitialBadge initials="MB" tint="#FFB6A2" />,
    question: "Will Yankees @ Red Sox combined runs go over ___ ?",
    tiers: [
      { price: "8.5", percent: "44%" },
      { price: "10.5", percent: "19%" },
    ],
  },
  {
    id: "nyc-heat",
    badge: <InitialBadge initials="NY" tint="#9DD1FF" />,
    question: "Will NYC high temperature go above ___ on Saturday?",
    tiers: [
      { price: "88°F", percent: "59%" },
      { price: "94°F", percent: "17%" },
    ],
  },
  {
    id: "tsla-week",
    badge: <InitialBadge initials="TS" tint="#E8D7FF" />,
    question: "Will Tesla close above $ ___ by Friday?",
    tiers: [
      { price: "$260", percent: "52%" },
      { price: "$280", percent: "21%" },
    ],
  },
];

const GridBackdrop: React.FC = () => {
  const spacing = 120;
  const cols = Math.ceil(WIDTH / spacing);
  const rows = Math.ceil(HEIGHT / spacing);
  return (
    <AbsoluteFill>
      <svg
        width={WIDTH}
        height={HEIGHT}
        style={{ position: "absolute", inset: 0 }}
      >
        <defs>
          <radialGradient id="grid-mask" cx="50%" cy="40%" r="60%">
            <stop offset="0%" stopColor="white" stopOpacity="1" />
            <stop offset="60%" stopColor="white" stopOpacity="0.7" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </radialGradient>
          <mask id="grid-fade">
            <rect width={WIDTH} height={HEIGHT} fill="url(#grid-mask)" />
          </mask>
        </defs>
        <g mask="url(#grid-fade)">
          {Array.from({ length: rows + 1 }).map((_, r) => (
            <line
              key={`h-${r}`}
              x1={0}
              y1={r * spacing}
              x2={WIDTH}
              y2={r * spacing}
              stroke={PALETTE.gridLine}
              strokeWidth={1.2}
            />
          ))}
          {Array.from({ length: cols + 1 }).map((_, c) => (
            <line
              key={`v-${c}`}
              x1={c * spacing}
              y1={0}
              x2={c * spacing}
              y2={HEIGHT}
              stroke={PALETTE.gridLine}
              strokeWidth={1.2}
            />
          ))}
          {Array.from({ length: rows + 1 }).flatMap((_, r) =>
            Array.from({ length: cols + 1 }).map((__, c) => (
              <circle
                key={`d-${r}-${c}`}
                cx={c * spacing}
                cy={r * spacing}
                r={2.5}
                fill={PALETTE.gridDot}
              />
            )),
          )}
        </g>
      </svg>
    </AbsoluteFill>
  );
};

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
    <svg width="170" height="170" viewBox="0 0 180 180" fill="none">
      <defs>
        <filter id="x-glow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="3.5" />
        </filter>
      </defs>
      <g filter="url(#x-glow)" opacity="0.8">
        <path
          d="M55 55 L125 125 M125 55 L55 125"
          stroke={PALETTE.mark}
          strokeWidth="6"
          strokeLinecap="round"
        />
      </g>
      <path
        d="M55 55 L125 125 M125 55 L55 125"
        stroke={PALETTE.mark}
        strokeWidth="3.5"
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
          gap: 56,
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
        top: 800,
        width: "100%",
        textAlign: "center",
        fontFamily: INTER,
        color: PALETTE.text,
        fontSize: 178,
        fontWeight: 700,
        letterSpacing: "-0.04em",
        lineHeight: 1.05,
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
      padding: "8px 22px",
      borderRadius: 12,
      fontSize: 36,
      fontWeight: 500,
      background: verdict === "yes" ? PALETTE.yesBg : PALETTE.noBg,
      color: verdict === "yes" ? PALETTE.yesText : PALETTE.noText,
      letterSpacing: "-0.005em",
      fontFamily: INTER,
      minWidth: 80,
      textAlign: "center",
    }}
  >
    {verdict === "yes" ? "Yes" : "No"}
  </div>
);

const QuestionWithBlank: React.FC<{ question: string }> = ({ question }) => {
  const parts = question.split("___");
  return (
    <span>
      {parts.map((part, idx) => (
        <React.Fragment key={idx}>
          {part}
          {idx < parts.length - 1 && (
            <span
              style={{
                display: "inline-block",
                width: 110,
                borderBottom: `3px solid ${PALETTE.text}`,
                verticalAlign: "8px",
                margin: "0 4px",
              }}
            />
          )}
        </React.Fragment>
      ))}
    </span>
  );
};

const MarketCard: React.FC<{ card: Card }> = ({ card }) => (
  <div
    style={{
      width: 1080,
      height: 700,
      flexShrink: 0,
      background: PALETTE.cardSurface,
      borderRadius: 48,
      border: `1px solid ${PALETTE.cardBorder}`,
      padding: "56px 60px",
      display: "flex",
      flexDirection: "column",
      gap: 40,
      boxShadow: "0 40px 100px -60px rgba(0, 0, 0, 0.9)",
      fontFamily: INTER,
    }}
  >
    <div style={{ display: "flex", gap: 32, alignItems: "flex-start" }}>
      <div style={{ width: 132, height: 132, flexShrink: 0 }}>{card.badge}</div>
      <div
        style={{
          color: PALETTE.text,
          fontSize: 48,
          fontWeight: 600,
          lineHeight: 1.18,
          letterSpacing: "-0.022em",
          flex: 1,
        }}
      >
        <QuestionWithBlank question={card.question} />
      </div>
    </div>
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 22,
        marginTop: "auto",
      }}
    >
      {card.tiers.map((tier, idx) => (
        <div
          key={idx}
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr auto",
            alignItems: "center",
            gap: 24,
            fontSize: 48,
            fontWeight: 500,
            fontFeatureSettings: '"tnum" 1, "cv11" 1',
          }}
        >
          <div
            style={{
              color: PALETTE.textPrice,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {tier.price}
          </div>
          <div
            style={{
              color: PALETTE.text,
              fontVariantNumeric: "tabular-nums",
              fontWeight: 600,
              textAlign: "right",
              paddingRight: 12,
            }}
          >
            {tier.percent}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <Pill verdict="yes" />
            <Pill verdict="no" />
          </div>
        </div>
      ))}
    </div>
  </div>
);

const CardCarousel: React.FC<{
  cards: Card[];
  topPx: number;
  pxPerSecond: number;
}> = ({ cards, topPx, pxPerSecond }) => {
  const frame = useCurrentFrame();
  const gap = 48;
  const cardWidth = 1080;
  const stride = cardWidth + gap;
  const loop = stride * cards.length;
  const seconds = frame / FPS;
  const raw = (seconds * pxPerSecond) % loop;
  const translate = -raw;
  const enter = spring({
    frame: frame - 26,
    fps: FPS,
    config: { damping: 200, mass: 0.8 },
    durationInFrames: 60,
  });
  const opacity = interpolate(enter, [0, 1], [0, 1]);
  const lift = interpolate(enter, [0, 1], [100, 0]);
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
  rowSpeed = 130,
}) => {
  const resolvedCards = cards && cards.length > 0 ? cards : DEFAULT_CARDS;
  const resolvedBrandA = brandA ?? <GMBrandMark />;
  const resolvedBrandB = brandB ?? <PlaceholderMark label="Your Partner" />;
  const resolvedHeadline =
    headline && headline.length > 0
      ? headline
      : ["Markets others", "won't make."];

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(ellipse 100% 70% at 50% 25%, ${PALETTE.bgTop} 0%, ${PALETTE.bgBottom} 100%)`,
      }}
    >
      <GridBackdrop />
      <AbsoluteFill
        style={{
          background: `radial-gradient(circle at 50% 45%, transparent 0%, transparent 50%, ${PALETTE.bgBottom} 100%)`,
          pointerEvents: "none",
        }}
      />
      <HeaderLockup brandA={resolvedBrandA} brandB={resolvedBrandB} />
      <Headline lines={resolvedHeadline} />
      <CardCarousel
        cards={resolvedCards}
        topPx={1640}
        pxPerSecond={rowSpeed}
      />
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
