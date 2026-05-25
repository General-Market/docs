import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { loadFont as loadInterTight } from "@remotion/google-fonts/InterTight";
import { MARKETS_CONCENTRATION, type Snapshot } from "./data";

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
  gold: "#F4B73B",
  goldSoft: "rgba(244, 183, 59, 0.16)",
  fairLine: "rgba(255, 255, 255, 0.14)",
};

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
          <radialGradient id="rpc-grid-mask" cx="50%" cy="40%" r="60%">
            <stop offset="0%" stopColor="white" stopOpacity="1" />
            <stop offset="60%" stopColor="white" stopOpacity="0.7" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </radialGradient>
          <mask id="rpc-grid-fade">
            <rect width={WIDTH} height={HEIGHT} fill="url(#rpc-grid-mask)" />
          </mask>
        </defs>
        <g mask="url(#rpc-grid-fade)">
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

const Headline: React.FC<{ lines: string[] }> = ({ lines }) => {
  const frame = useCurrentFrame();
  const config = useVideoConfig();
  return (
    <div
      style={{
        position: "absolute",
        top: 300,
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

const Subhead: React.FC<{ text: string }> = ({ text }) => {
  const frame = useCurrentFrame();
  const config = useVideoConfig();
  const enter = spring({
    frame: frame - 30,
    fps: config.fps,
    config: { damping: 200, mass: 0.7 },
    durationInFrames: 46,
  });
  const opacity = interpolate(enter, [0, 1], [0, 1]);
  const lift = interpolate(enter, [0, 1], [40, 0]);
  return (
    <div
      style={{
        position: "absolute",
        top: 740,
        width: "100%",
        textAlign: "center",
        fontFamily: INTER,
        color: PALETTE.textDim,
        fontSize: 46,
        fontWeight: 500,
        letterSpacing: "-0.018em",
        opacity,
        transform: `translateY(${lift}px)`,
      }}
    >
      {text}
    </div>
  );
};

// Mini Lorenz curve — the diagonal "fair" line faint, the venue's actual
// curve in glowing gold. The further the gold bows below the diagonal, the
// more the profit pot is captured by the few. Mirrors ChartEngine's xAt/yAt.
const MiniLorenz: React.FC<{ values: number[] }> = ({ values }) => {
  const w = 960;
  const h = 380;
  const padL = 8;
  const padR = 8;
  const padT = 18;
  const padB = 18;
  const plotW = w - padL - padR;
  const plotH = h - padT - padB;

  const xAt = (i: number) =>
    padL + (i / Math.max(1, values.length - 1)) * plotW;
  const yAt = (v: number) => padT + (1 - v / 100) * plotH;

  const curvePts = values.map((v, i) => `${xAt(i).toFixed(1)},${yAt(v).toFixed(1)}`);
  const areaPath =
    `M ${padL},${padT + plotH} ` +
    curvePts.map((p) => `L ${p}`).join(" ") +
    ` L ${padL + plotW},${padT + plotH} Z`;

  const x0 = padL;
  const y0 = padT + plotH;
  const x1 = padL + plotW;
  const y1 = padT;

  return (
    <svg
      width="100%"
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      style={{ display: "block" }}
    >
      <defs>
        <linearGradient id="rpc-area" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(244, 183, 59, 0.30)" />
          <stop offset="100%" stopColor="rgba(244, 183, 59, 0.02)" />
        </linearGradient>
        <filter id="rpc-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="5" />
        </filter>
      </defs>

      {/* Fair reference diagonal */}
      <line
        x1={x0}
        y1={y0}
        x2={x1}
        y2={y1}
        stroke={PALETTE.fairLine}
        strokeWidth={2.5}
        strokeDasharray="10 10"
      />

      {/* Area under the venue curve */}
      <path d={areaPath} fill="url(#rpc-area)" />

      {/* Glow pass */}
      <polyline
        points={curvePts.join(" ")}
        fill="none"
        stroke={PALETTE.gold}
        strokeWidth={9}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.55}
        filter="url(#rpc-glow)"
      />
      {/* Crisp gold line */}
      <polyline
        points={curvePts.join(" ")}
        fill="none"
        stroke={PALETTE.gold}
        strokeWidth={6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

const findStat = (
  stats: Snapshot["stats"],
  needle: string,
): { label: string; value: string } | undefined =>
  stats?.find((s) => s.label.toLowerCase().includes(needle));

const findProfitStat = (
  stats: Snapshot["stats"],
): { label: string; value: string } | undefined =>
  stats?.find((s) => {
    const l = s.label.toLowerCase();
    return (
      l.includes("profitable") ||
      l.includes("losing") ||
      l.includes("median") ||
      l.includes("expected return") ||
      l.includes("house edge")
    );
  });

const SecondaryStat: React.FC<{ label: string; value: string }> = ({
  label,
  value,
}) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
    <div
      style={{
        color: PALETTE.text,
        fontSize: 54,
        fontWeight: 600,
        letterSpacing: "-0.02em",
        fontVariantNumeric: "tabular-nums",
      }}
    >
      {value}
    </div>
    <div
      style={{
        color: PALETTE.textVeryDim,
        fontSize: 28,
        fontWeight: 500,
        letterSpacing: "-0.005em",
      }}
    >
      {label}
    </div>
  </div>
);

const VenueCard: React.FC<{ snapshot: Snapshot }> = ({ snapshot }) => {
  const top1 = findStat(snapshot.stats, "top 1%");
  // Online lottery has no "top 1%" stat — fall back to its top-0.001% figure.
  const headlineStat =
    top1 ?? findStat(snapshot.stats, "top 0.001%") ?? snapshot.stats?.[0];
  const profitStat = findProfitStat(snapshot.stats);
  const typeStat = findStat(snapshot.stats, "type");

  const headlineValue = headlineStat?.value ?? "—";
  const headlineLabel = top1
    ? "the top 1% takes"
    : headlineStat?.label
      ? `${headlineStat.label}`
      : "the top takes";

  return (
    <div
      style={{
        width: 980,
        height: 1080,
        flexShrink: 0,
        background: PALETTE.cardSurface,
        borderRadius: 48,
        border: `1px solid ${PALETTE.cardBorder}`,
        padding: "60px 64px",
        display: "flex",
        flexDirection: "column",
        boxShadow: "0 40px 100px -60px rgba(0, 0, 0, 0.9)",
        fontFamily: INTER,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div
          style={{
            color: PALETTE.text,
            fontSize: 78,
            fontWeight: 700,
            lineHeight: 1.02,
            letterSpacing: "-0.03em",
          }}
        >
          {snapshot.label}
        </div>
        {snapshot.sublabel ? (
          <div
            style={{
              color: PALETTE.textDim,
              fontSize: 27,
              fontWeight: 500,
              letterSpacing: "-0.005em",
              lineHeight: 1.3,
              maxWidth: 820,
              overflow: "hidden",
              display: "-webkit-box",
              WebkitBoxOrient: "vertical",
              WebkitLineClamp: 2,
            }}
          >
            {snapshot.sublabel}
          </div>
        ) : null}
      </div>

      <div style={{ marginTop: 48, marginBottom: 14 }}>
        <MiniLorenz values={snapshot.values} />
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: 22,
          fontWeight: 500,
          color: PALETTE.textVeryDim,
          letterSpacing: "0.01em",
        }}
      >
        <span>No one</span>
        <span>Everyone</span>
      </div>

      <div
        style={{
          marginTop: "auto",
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        <div
          style={{
            color: PALETTE.textDim,
            fontSize: 32,
            fontWeight: 500,
            letterSpacing: "-0.01em",
          }}
        >
          {headlineLabel}
        </div>
        <div
          style={{
            color: PALETTE.gold,
            fontSize: 168,
            fontWeight: 700,
            lineHeight: 0.9,
            letterSpacing: "-0.045em",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {headlineValue}
        </div>
        <div
          style={{
            color: PALETTE.textVeryDim,
            fontSize: 28,
            fontWeight: 500,
            letterSpacing: "-0.005em",
            marginTop: 2,
          }}
        >
          of all the profit
        </div>

        {(profitStat || typeStat) && (
          <div
            style={{
              display: "flex",
              gap: 64,
              marginTop: 28,
              paddingTop: 28,
              borderTop: `1px solid ${PALETTE.cardBorder}`,
            }}
          >
            {profitStat ? (
              <SecondaryStat
                label={profitStat.label}
                value={profitStat.value}
              />
            ) : null}
            {typeStat ? (
              <SecondaryStat label={typeStat.label} value={typeStat.value} />
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
};

const CardCarousel: React.FC<{
  snapshots: Snapshot[];
  topPx: number;
  pxPerSecond: number;
}> = ({ snapshots, topPx, pxPerSecond }) => {
  const frame = useCurrentFrame();
  const gap = 56;
  const cardWidth = 980;
  const stride = cardWidth + gap;
  const loop = stride * snapshots.length;
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
        {[...snapshots, ...snapshots, ...snapshots].map((snapshot, idx) => (
          <VenueCard key={`${snapshot.label}-${idx}`} snapshot={snapshot} />
        ))}
      </div>
    </div>
  );
};

export const RetailPnLMarketsCards: React.FC = () => {
  const snapshots = MARKETS_CONCENTRATION.snapshots;
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
      <Headline lines={["Who takes the", "profit pot."]} />
      <Subhead text="Share of all profit captured by the bottom N% of wallets" />
      <CardCarousel snapshots={snapshots} topPx={920} pxPerSecond={150} />
    </AbsoluteFill>
  );
};

export const retailPnLMarketsCardsMeta = {
  id: "RetailPnLMarketsCards",
  component: RetailPnLMarketsCards,
  durationInFrames: DURATION,
  fps: FPS,
  width: WIDTH,
  height: HEIGHT,
};
