import React from "react";
import {
  AbsoluteFill,
  Easing,
  Img,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { WALL_PAPERS, PAPER_THUMBS } from "./liquidity-papers.data";

const interFamily = loadInter("normal", {
  subsets: ["latin"],
  weights: ["300", "400", "500", "600", "700", "900"],
}).fontFamily;

// ── Format ──────────────────────────────────────────────────────────────────
// Square reel, the house format for X (remotion.md: "reels = square (e.g.
// 2160² @60"). Palette borrowed from InsiderCases: white cards on black, Inter,
// the yellow highlighter on the word that carries the argument.
const FPS = 60;
const SIZE = 2160;

const YELLOW = "#FFE000";
const INK = "#0A0A0A";
const SUB = "#8A8A90";

// Beat lengths (frames @60). Paced to read once, then cut — never park.
const B1 = 198; // "An orderbook needs someone willing to quote."
const B2 = 210; // "Every quote is a bet against someone who knows more."
const B3 = 540; // the wall of papers
const B4 = 252; // the spread widens — that IS the cost
const B5 = 318; // insider flow · latency · fees
const DURATION = B1 + B2 + B3 + B4 + B5;

// ── Seeded RNG (same multiplicative congruential as SourceCardsWall) ─────────
function rng(seed: number) {
  let s = seed || 1;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s & 0x7fffffff) / 0x7fffffff;
  };
}

// ── Shared text primitives ───────────────────────────────────────────────────

// One primary line on the optical center, supporting line directly beneath.
// Springs up on entry; no cross-dissolve — beats hard-cut into each other.
const BeatLine: React.FC<{
  lead: React.ReactNode;
  sub?: React.ReactNode;
  delay?: number;
}> = ({ lead, sub, delay = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: frame - delay, fps, config: { damping: 200, mass: 0.7 } });
  const y = interpolate(s, [0, 1], [70, 0]);
  const scale = interpolate(s, [0, 1], [0.94, 1]);

  return (
    <AbsoluteFill
      style={{
        alignItems: "center",
        justifyContent: "center",
        transform: `translateY(${y}px) scale(${scale})`,
        opacity: s,
      }}
    >
      <div style={{ width: "82%", textAlign: "center" }}>
        <div
          style={{
            fontFamily: interFamily,
            fontWeight: 800,
            fontSize: 132,
            lineHeight: 1.05,
            letterSpacing: "-0.03em",
            color: "#FFFFFF",
          }}
        >
          {lead}
        </div>
        {sub ? (
          <div
            style={{
              marginTop: 44,
              fontFamily: interFamily,
              fontWeight: 500,
              fontSize: 60,
              lineHeight: 1.2,
              letterSpacing: "-0.02em",
              color: SUB,
            }}
          >
            {sub}
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};

// Highlighter sweep behind the word that carries the weight.
const Mark: React.FC<{ children: React.ReactNode; delay?: number; color?: string }> = ({
  children,
  delay = 0,
  color = YELLOW,
}) => {
  const frame = useCurrentFrame();
  const w = interpolate(frame, [delay, delay + 16], [0, 100], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  return (
    <span style={{ position: "relative", whiteSpace: "nowrap", color: INK }}>
      <span
        style={{
          position: "absolute",
          left: "-0.12em",
          right: "-0.12em",
          top: "0.08em",
          bottom: "0.06em",
          background: color,
          width: `${w}%`,
          borderRadius: 4,
          zIndex: -1,
        }}
      />
      {children}
    </span>
  );
};

// ── Beat 1 / Beat 2 ───────────────────────────────────────────────────────────

const BeatQuote: React.FC = () => (
  <AbsoluteFill style={{ background: "#000" }}>
    <BeatLine
      lead={
        <>
          An orderbook needs someone
          <br />
          willing to <Mark delay={26}>quote</Mark>.
        </>
      }
      sub="A maker posts a bid and an ask, and waits."
      delay={8}
    />
  </AbsoluteFill>
);

const BeatAdverse: React.FC = () => (
  <AbsoluteFill style={{ background: "#000" }}>
    <BeatLine
      lead={
        <>
          Every quote is a bet against
          <br />
          someone who <Mark delay={30} color="#FF453A">knows more</Mark>.
        </>
      }
      sub="The maker can be picked off. So the maker widens, to survive."
      delay={8}
    />
  </AbsoluteFill>
);

// ── Beat 3 · The wall of papers ──────────────────────────────────────────────

// Famous papers that get a named chip when their real thumbnail surfaces.
const HERO_LABELS: Record<number, string> = {
  1: "Grossman–Stiglitz · prices can’t be free",
  2: "Kyle 1985 · adverse selection",
  3: "Glosten–Milgrom · the spread is information",
  9: "Easley · information & the cost of capital",
  36: "Hasbrouck · trades move prices",
  38: "Easley–Hvidkjaer–O’Hara · PIN is priced",
  41: "Easley · flow toxicity, the flash crash",
  46: "Collin-Dufresne · informed trading hides",
  179: "Easley · from PIN to VPIN",
};

// Background: every paper in the corpus as a small white card, tilted and
// scrolling — the SourceCardsWall technique. Foreground: real first-page
// thumbnails slapped onto the pile, the famous ones labelled.
const PaperWall: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // The pile assembles, then the camera settles and pulls back a touch.
  const build = spring({ frame, fps, config: { damping: 200, mass: 1.4 } });
  const scrollY = interpolate(build, [0, 1], [220, -60]);
  const wallScale = interpolate(build, [0, 1], [1.32, 1.16]);

  const COLS = 7;
  const cards = WALL_PAPERS;

  // Headline lands after the pile reads as a pile.
  const head = spring({ frame: frame - 150, fps, config: { damping: 200 } });
  const headY = interpolate(head, [0, 1], [50, 0]);

  // Foreground thumbnails: deterministic scatter, staggered slap-in.
  const r = rng(99);
  // Pile sits in the upper ~62%; the thesis owns the bottom band.
  const thumbs = PAPER_THUMBS.map((t) => ({
    ...t,
    x: 8 + r() * 84, // vw%
    y: 6 + r() * 55, // vh%
    rot: (r() - 0.5) * 26,
    z: r(),
  })).sort((a, b) => a.z - b.z);

  return (
    <AbsoluteFill style={{ background: "#050505" }}>
      {/* Background wall of citation cards */}
      <AbsoluteFill style={{ perspective: 2400, perspectiveOrigin: "50% 42%" }}>
        <AbsoluteFill
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${COLS}, 1fr)`,
            gridAutoRows: "176px",
            gap: 14,
            padding: 14,
            transform: `rotateX(16deg) scale(${wallScale}) translateY(${-scrollY}px)`,
            transformStyle: "preserve-3d",
            filter: "saturate(0.9) brightness(0.82)",
          }}
        >
          {cards.map((p, i) => (
            <div
              key={i}
              style={{
                background: "#FFFFFF",
                border: "1px solid #E4E4E7",
                borderTop: "3px solid #C9C9CF",
                borderRadius: 4,
                padding: "14px 16px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                overflow: "hidden",
                fontFamily: interFamily,
                color: INK,
              }}
            >
              <div
                style={{
                  fontSize: 19,
                  fontWeight: 700,
                  lineHeight: 1.12,
                  letterSpacing: "-0.01em",
                  display: "-webkit-box",
                  WebkitLineClamp: 3,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }}
              >
                {p.title}
              </div>
              <div style={{ fontSize: 15, color: "#6B7280", fontWeight: 500 }}>
                {p.authors || "—"} {p.year ? `· ${p.year}` : ""}
              </div>
            </div>
          ))}
        </AbsoluteFill>
      </AbsoluteFill>

      {/* Black wash so the pile reads behind the foreground */}
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(120% 90% at 50% 40%, rgba(5,5,5,0) 0%, rgba(5,5,5,0.35) 55%, rgba(5,5,5,0.8) 100%)",
        }}
      />

      {/* Foreground: real first-page thumbnails slapped onto the pile */}
      {thumbs.map((t, i) => {
        const appear = spring({
          frame: frame - 10 - i * 6,
          fps,
          config: { damping: 18, mass: 0.5, stiffness: 120 },
        });
        if (appear <= 0.001) return null;
        const label = HERO_LABELS[t.n];
        const w = label ? 360 : 248;
        return (
          <div
            key={t.file}
            style={{
              position: "absolute",
              left: `${t.x}%`,
              top: `${t.y}%`,
              width: w,
              transform: `translate(-50%,-50%) rotate(${t.rot}deg) scale(${interpolate(
                appear,
                [0, 1],
                [1.25, 1]
              )})`,
              opacity: Math.min(1, appear * 1.4),
              zIndex: label ? 50 : 10 + Math.round(t.z * 20),
              filter: "drop-shadow(0 24px 48px rgba(0,0,0,0.7))",
            }}
          >
            <Img
              src={staticFile(`insider-trading/papers/${t.file}`)}
              style={{ width: "100%", display: "block", borderRadius: 3, background: "#fff" }}
            />
            {label ? (
              <div
                style={{
                  position: "absolute",
                  left: "50%",
                  bottom: -18,
                  transform: "translateX(-50%) rotate(0deg)",
                  background: YELLOW,
                  color: INK,
                  fontFamily: interFamily,
                  fontWeight: 800,
                  fontSize: 19,
                  letterSpacing: "-0.01em",
                  padding: "8px 14px",
                  borderRadius: 6,
                  whiteSpace: "nowrap",
                  boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
                }}
              >
                {label}
              </div>
            ) : null}
          </div>
        );
      })}

      {/* Bottom scrim so the thesis reads cleanly over the pile */}
      <AbsoluteFill
        style={{
          zIndex: 90,
          background:
            "linear-gradient(to top, rgba(4,4,4,0.97) 0%, rgba(4,4,4,0.9) 32%, rgba(4,4,4,0) 64%)",
        }}
      />
      {/* Headline overlay */}
      <AbsoluteFill
        style={{
          zIndex: 100,
          alignItems: "center",
          justifyContent: "flex-end",
          paddingBottom: 160,
          transform: `translateY(${headY}px)`,
          opacity: head,
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              fontFamily: interFamily,
              fontWeight: 900,
              fontSize: 168,
              letterSpacing: "-0.04em",
              color: "#FFFFFF",
              lineHeight: 0.95,
            }}
          >
            200+ papers.
          </div>
          <div
            style={{
              marginTop: 30,
              fontFamily: interFamily,
              fontWeight: 700,
              fontSize: 66,
              letterSpacing: "-0.02em",
              color: "#FFFFFF",
            }}
          >
            One finding: informed flow makes liquidity{" "}
            <Mark delay={170}>expensive</Mark>.
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ── Beat 4 · The spread widens ────────────────────────────────────────────────

const SpreadWidens: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = spring({ frame: frame - 8, fps, config: { damping: 200, mass: 0.7 } });
  const open = spring({ frame: frame - 30, fps, config: { damping: 200, mass: 1.3 } });

  const cx = SIZE / 2;
  const axisY = 1300;
  const gap = interpolate(open, [0, 1], [95, 540]); // half-gap, px
  const boxW = 220;
  const boxH = 156;
  const band = interpolate(open, [0.2, 1], [0, 1], { extrapolateLeft: "clamp" });

  return (
    <AbsoluteFill style={{ background: "#000" }}>
      {/* Title — upper third */}
      <div
        style={{
          position: "absolute",
          top: 372,
          left: 0,
          right: 0,
          textAlign: "center",
          transform: `translateY(${interpolate(t, [0, 1], [60, 0])}px)`,
          opacity: t,
        }}
      >
        <div
          style={{
            fontFamily: interFamily,
            fontWeight: 800,
            fontSize: 138,
            letterSpacing: "-0.03em",
            color: "#FFFFFF",
            lineHeight: 1.05,
          }}
        >
          The spread widens.
          <br />
          That <Mark delay={36}>is</Mark> the cost.
        </div>
      </div>

      {/* Bid / ask pushing apart, the spread growing between them */}
      <svg width={SIZE} height={SIZE} style={{ position: "absolute", inset: 0 }}>
        <line x1={140} y1={axisY} x2={SIZE - 140} y2={axisY} stroke="#262626" strokeWidth={3} />
        {/* spread band */}
        <rect
          x={cx - gap}
          y={axisY - boxH / 2}
          width={gap * 2}
          height={boxH}
          fill={YELLOW}
          opacity={band * 0.18}
        />
        <line
          x1={cx - gap}
          y1={axisY - boxH / 2 - 8}
          x2={cx + gap}
          y2={axisY - boxH / 2 - 8}
          stroke={YELLOW}
          strokeWidth={5}
          strokeDasharray="16 12"
          opacity={band}
        />
        <text
          x={cx}
          y={axisY - boxH / 2 - 44}
          fill={YELLOW}
          fontSize={52}
          fontWeight={800}
          fontFamily={interFamily}
          textAnchor="middle"
          opacity={band}
        >
          the toll you pay
        </text>
        {/* BID */}
        <g opacity={t}>
          <rect x={cx - gap - boxW} y={axisY - boxH / 2} width={boxW} height={boxH} rx={12} fill="#16A34A" />
          <text x={cx - gap - boxW / 2} y={axisY + 20} fill="#fff" fontSize={52} fontWeight={800}
            fontFamily={interFamily} textAnchor="middle">BID</text>
        </g>
        {/* ASK */}
        <g opacity={t}>
          <rect x={cx + gap} y={axisY - boxH / 2} width={boxW} height={boxH} rx={12} fill="#DC2626" />
          <text x={cx + gap + boxW / 2} y={axisY + 20} fill="#fff" fontSize={52} fontWeight={800}
            fontFamily={interFamily} textAnchor="middle">ASK</text>
        </g>
      </svg>
    </AbsoluteFill>
  );
};

// ── Beat 5 · Anaphora close ───────────────────────────────────────────────────

const CostsClose: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const lines = ["Insider flow.", "Latency.", "Fees."];
  const final = spring({ frame: frame - 168, fps, config: { damping: 200 } });

  return (
    <AbsoluteFill style={{ background: "#000", alignItems: "center", justifyContent: "center" }}>
      <div style={{ textAlign: "center" }}>
        {lines.map((t, i) => {
          const s = spring({ frame: frame - 14 - i * 36, fps, config: { damping: 200, mass: 0.6 } });
          return (
            <div
              key={t}
              style={{
                fontFamily: interFamily,
                fontWeight: 900,
                fontSize: 156,
                letterSpacing: "-0.04em",
                lineHeight: 1.04,
                color: "#FFFFFF",
                transform: `translateX(${interpolate(s, [0, 1], [-80, 0])}px)`,
                opacity: s,
              }}
            >
              {t}
            </div>
          );
        })}
        <div
          style={{
            marginTop: 56,
            fontFamily: interFamily,
            fontWeight: 600,
            fontSize: 64,
            letterSpacing: "-0.02em",
            color: SUB,
            transform: `translateY(${interpolate(final, [0, 1], [40, 0])}px)`,
            opacity: final,
          }}
        >
          The orderbook charges you for{" "}
          <span style={{ color: "#FFFFFF", fontWeight: 800 }}>all of it</span>.
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ── Composition ───────────────────────────────────────────────────────────────

export const WhyLiquidityIsHard: React.FC = () => {
  let at = 0;
  const seq = (dur: number, node: React.ReactNode) => {
    const el = (
      <Sequence key={at} from={at} durationInFrames={dur} layout="none">
        {node}
      </Sequence>
    );
    at += dur;
    return el;
  };
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      {seq(B1, <BeatQuote />)}
      {seq(B2, <BeatAdverse />)}
      {seq(B3, <PaperWall />)}
      {seq(B4, <SpreadWidens />)}
      {seq(B5, <CostsClose />)}
    </AbsoluteFill>
  );
};

export const whyLiquidityIsHardMeta = {
  id: "WhyLiquidityIsHard",
  component: WhyLiquidityIsHard,
  durationInFrames: DURATION,
  fps: FPS,
  width: SIZE,
  height: SIZE,
};
