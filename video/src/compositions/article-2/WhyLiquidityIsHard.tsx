import React from "react";
import { AbsoluteFill, Easing, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { CameraMotionBlur } from "@remotion/motion-blur";
import { loadFont as loadGeist } from "@remotion/google-fonts/Geist";
import { loadFont as loadMono } from "@remotion/google-fonts/JetBrainsMono";
import { PAPER_THUMBS } from "./liquidity-papers.data";
import { FPS, H, W } from "./theme";

const geist = loadGeist("normal", {
  subsets: ["latin"],
  weights: ["400", "500", "600", "700", "900"],
}).fontFamily;
const mono = loadMono("normal", { subsets: ["latin"], weights: ["500", "700"] }).fontFamily;

const BLUE = "#2D5BFF";
const INK = "#0A0A0C";

// ── The piece ─────────────────────────────────────────────────────────────────
// A market is mimetic desire made liquid: everyone wants the same trade. That
// rivalry resolves the way Girard says it always does — all-against-one. The
// crowd needs a loser, the structure picks him, and his loss becomes the
// "liquidity" everyone praises. 200 papers are 200 witnesses. They measure the
// cut five ways; it lands on one victim, at ~8¢ per dollar. 16:9 for YouTube.
const TOTAL = 390; // 13s @ 30fps

const DECK = PAPER_THUMBS; // sorted by paper number n
const ORDER = DECK.map((p) => p.n);
const NTH = DECK.length;
const LAST = NTH - 1;

// Each streaming first-page, sorted into one of the five (computed from titles).
const THUMB_CAT: Record<number, number> = {
  1: 0, 2: 0, 3: 0, 8: 3, 9: 0, 12: 0, 23: 1, 24: 1, 25: 1, 27: 1, 28: 1, 29: 0, 33: 1,
  35: 0, 36: 1, 37: 0, 38: 0, 41: 0, 42: 4, 46: 1, 49: 3, 51: 3, 61: 3, 68: 2, 71: 2, 74: 2,
  75: 2, 78: 3, 92: 2, 110: 2, 112: 2, 117: 1, 131: 4, 132: 1, 133: 4, 135: 3, 137: 4, 138: 4,
  140: 4, 141: 4, 145: 4, 153: 4, 155: 4, 156: 4, 161: 1, 162: 1, 163: 1, 166: 3, 168: 1,
  169: 1, 179: 0, 185: 3, 195: 0,
};
const CAT_OF = ORDER.map((n) => THUMB_CAT[n] ?? 1);

type Cat = { name: string; sub: string; target: number; fmt: (v: number) => string; corpus: number };
const CATS: Cat[] = [
  { name: "Priced into the spread", sub: "of every spread is the cut", target: 60, fmt: (v) => `${v}%`, corpus: 48 },
  { name: "Insiders win", sub: "abnormal return in 21 days", target: 35, fmt: (v) => `+${v}%`, corpus: 36 },
  { name: "The leak beats the news", sub: "of the move, before it breaks", target: 50, fmt: (v) => `${v}%`, corpus: 36 },
  { name: "The law arrives late", sub: "of 103 countries ever prosecute", target: 38, fmt: (v) => `${v}/103`, corpus: 49 },
  { name: "The new venues", sub: "of prediction-market traders lose", target: 84, fmt: (v) => `${v}%`, corpus: 31 },
];
const THUMBS_IN = CATS.map((_, c) => CAT_OF.filter((x) => x === c).length);
const MAX_CORPUS = Math.max(...CATS.map((c) => c.corpus));

const thumbSrc = (file: string) => staticFile(`insider-trading/papers/${file}`);

// ── Timeline ──────────────────────────────────────────────────────────────────
const STREAM_START = 55;
const STREAM_END = 250; // last paper sorted; every bar full
const CONVERGE_IN = 252;
const CONVERGE_LAND = 312;
const TAKE_IN = 316; // the 8¢ stamps

// Incremental cadence: each paper dwells a steady fraction less than the last.
const RATIO = 0.93;
const CENTER_FRAMES: number[] = (() => {
  const cf = new Array<number>(NTH);
  cf[0] = STREAM_START;
  let w = 0;
  for (let i = 1; i < NTH; i++) w += Math.pow(RATIO, i - 1);
  const base = (STREAM_END - STREAM_START) / w;
  for (let i = 1; i < NTH; i++) cf[i] = cf[i - 1] + base * Math.pow(RATIO, i - 1);
  return cf;
})();
const activeAt = (frame: number): number => {
  if (frame <= CENTER_FRAMES[0]) return 0;
  if (frame >= CENTER_FRAMES[LAST]) return LAST;
  let i = 0;
  while (i < LAST && CENTER_FRAMES[i + 1] <= frame) i++;
  return i + (frame - CENTER_FRAMES[i]) / (CENTER_FRAMES[i + 1] - CENTER_FRAMES[i]);
};
const passedIn = (cat: number, frame: number) =>
  CAT_OF.reduce((acc, c, i) => acc + (c === cat && CENTER_FRAMES[i] <= frame ? 1 : 0), 0);

// ── The crowd: real first-pages streaming past, below the bars ────────────────
const CARD_W = 236;
const CARD_H = 306;
const PITCH = 198;
const STREAM_Y = H * 0.76;
const WINDOW = 8;

const Card: React.FC<{ file: string; d: number }> = ({ file, d }) => {
  const ad = Math.abs(d);
  const scale = interpolate(ad, [0, 1, 3], [1, 0.78, 0.62], { extrapolateRight: "clamp", extrapolateLeft: "clamp" });
  const opacity = interpolate(ad, [0, 0.5, 1, 4], [1, 1, 0.34, 0.08], { extrapolateRight: "clamp", extrapolateLeft: "clamp" });
  if (opacity < 0.01) return null;
  return (
    <div
      style={{
        position: "absolute",
        left: W / 2 + d * PITCH,
        top: STREAM_Y,
        width: CARD_W,
        height: CARD_H,
        marginLeft: -CARD_W / 2,
        marginTop: -CARD_H / 2,
        transform: `scale(${scale})`,
        opacity,
        zIndex: Math.round(100 - ad * 5),
        background: "#fff",
        borderRadius: 3,
        overflow: "hidden",
        border: "1px solid #15151A",
        boxShadow: "0 12px 30px rgba(0,0,0,0.6)",
      }}
    >
      <Img src={thumbSrc(file)} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top center" }} />
    </div>
  );
};

const Crowd: React.FC = () => {
  const frame = useCurrentFrame();
  const active = activeAt(frame);
  const op = interpolate(frame, [CONVERGE_IN, CONVERGE_IN + 26], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  if (op < 0.01) return null;
  return (
    <AbsoluteFill style={{ opacity: op }}>
      {DECK.map((p, i) => {
        const d = i - active;
        if (Math.abs(d) > WINDOW) return null;
        return <Card key={i} file={p.file} d={d} />;
      })}
    </AbsoluteFill>
  );
};

// ── The five charges, filling as the crowd is sorted ──────────────────────────
const ROW_H = 84;
const ROWS_TOP = 150;
const LABEL_X = 150;
const BAR_X = 720;
const BAR_MAXW = 560;
const NUM_X = BAR_X + BAR_MAXW + 44;

const CatRow: React.FC<{ cat: number }> = ({ cat }) => {
  const frame = useCurrentFrame();
  const c = CATS[cat];
  const fill = THUMBS_IN[cat] ? passedIn(cat, frame) / THUMBS_IN[cat] : 0;
  const eased = interpolate(fill, [0, 1], [0, 1], { easing: Easing.out(Easing.cubic) });
  const barW = (c.corpus / MAX_CORPUS) * BAR_MAXW * eased;
  const shown = Math.round(c.target * eased);
  const y = ROWS_TOP + cat * ROW_H;
  const lit = fill > 0.02;

  // the row pulses the instant one of its papers lands at center
  const a = activeAt(frame);
  const nearest = Math.min(LAST, Math.max(0, Math.round(a)));
  const pulse = CAT_OF[nearest] === cat ? 1 - Math.min(1, Math.abs(a - nearest) * 2) : 0;

  return (
    <>
      <div
        style={{
          position: "absolute",
          left: LABEL_X,
          top: y,
          width: BAR_X - LABEL_X - 40,
          fontFamily: geist,
          fontWeight: 600,
          fontSize: 34,
          letterSpacing: "-0.02em",
          color: lit ? "#FFFFFF" : "rgba(255,255,255,0.34)",
          textAlign: "right",
        }}
      >
        {c.name}
      </div>
      <div style={{ position: "absolute", left: BAR_X, top: y + 6, width: BAR_MAXW, height: 30 }}>
        <div style={{ position: "absolute", inset: 0, background: "rgba(255,255,255,0.06)", borderRadius: 4 }} />
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            height: 30,
            width: barW,
            background: BLUE,
            borderRadius: 4,
            boxShadow: pulse > 0.05 ? `0 0 ${18 * pulse}px ${BLUE}` : "none",
          }}
        />
      </div>
      <div
        style={{
          position: "absolute",
          left: NUM_X,
          top: y - 14,
          width: 320,
          fontFamily: mono,
          fontWeight: 700,
          fontSize: 58,
          lineHeight: 1,
          letterSpacing: "-0.03em",
          color: lit ? BLUE : "rgba(45,91,255,0.28)",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {c.fmt(shown)}
        <span style={{ display: "block", fontFamily: geist, fontWeight: 500, fontSize: 19, letterSpacing: 0, color: "rgba(255,255,255,0.5)", marginTop: 4 }}>
          {c.sub}
        </span>
      </div>
    </>
  );
};

const Charges: React.FC = () => {
  const frame = useCurrentFrame();
  const op = interpolate(frame, [10, 36, CONVERGE_IN, CONVERGE_IN + 30], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  if (op < 0.01) return null;
  return (
    <AbsoluteFill style={{ opacity: op, zIndex: 60 }}>
      {CATS.map((_, c) => (
        <CatRow key={c} cat={c} />
      ))}
    </AbsoluteFill>
  );
};

// ── All-against-one: the witnesses converge on a single victim ────────────────
const rng = (seed: number) => {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
};
const VX = W / 2;
const VY = H * 0.46;
const MARKS = (() => {
  const r = rng(20260527);
  return Array.from({ length: 40 }, () => {
    const edge = r();
    // start from the frame's outer ring
    const sx = edge < 0.5 ? (r() < 0.5 ? -120 : W + 120) : r() * W;
    const sy = edge < 0.5 ? r() * H : r() < 0.5 ? -120 : H + 120;
    return { sx, sy, delay: Math.floor(r() * 18), rot: (r() - 0.5) * 60, w: 26 + r() * 14 };
  });
})();

const Converge: React.FC = () => {
  const frame = useCurrentFrame();
  if (frame < CONVERGE_IN - 2) return null;
  return (
    <AbsoluteFill style={{ zIndex: 80 }}>
      {MARKS.map((m, i) => {
        const t = interpolate(frame, [CONVERGE_IN + m.delay, CONVERGE_LAND], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.in(Easing.cubic),
        });
        const x = m.sx + (VX - m.sx) * t;
        const y = m.sy + (VY - m.sy) * t;
        const op = interpolate(t, [0, 0.1, 0.85, 1], [0, 0.9, 0.9, 0]) * 1;
        if (op < 0.01) return null;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x,
              top: y,
              width: m.w,
              height: m.w * 1.3,
              marginLeft: -m.w / 2,
              marginTop: -(m.w * 1.3) / 2,
              transform: `rotate(${m.rot}deg) scale(${1 - 0.5 * t})`,
              opacity: op,
              background: "#EDEDED",
              borderRadius: 2,
              boxShadow: "0 4px 10px rgba(0,0,0,0.5)",
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

const Victim: React.FC = () => {
  const frame = useCurrentFrame();
  const youOp = interpolate(frame, [CONVERGE_LAND - 18, CONVERGE_LAND], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const takeOp = interpolate(frame, [TAKE_IN, TAKE_IN + 14], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const takeScale = interpolate(frame, [TAKE_IN, TAKE_IN + 20], [1.3, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  const capOp = interpolate(frame, [TAKE_IN + 22, TAKE_IN + 42], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  if (youOp < 0.01) return null;
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", zIndex: 100 }}>
      <div style={{ position: "absolute", top: VY - 150, textAlign: "center", width: "100%" }}>
        <div style={{ fontFamily: geist, fontWeight: 700, fontSize: 40, letterSpacing: "0.18em", color: "rgba(255,255,255,0.7)", opacity: youOp }}>
          THE LOSER IS YOU
        </div>
      </div>
      <div
        style={{
          fontFamily: mono,
          fontWeight: 700,
          fontSize: 250,
          lineHeight: 1,
          letterSpacing: "-0.04em",
          color: BLUE,
          opacity: takeOp,
          transform: `scale(${takeScale})`,
        }}
      >
        −8¢
      </div>
      <div style={{ fontFamily: geist, fontWeight: 600, fontSize: 44, letterSpacing: "-0.02em", color: "#FFFFFF", opacity: takeOp, marginTop: 6 }}>
        taken from every $1 you trade
      </div>
      <div
        style={{
          position: "absolute",
          top: VY + 210,
          width: 1320,
          textAlign: "center",
          fontFamily: geist,
          fontWeight: 500,
          fontSize: 30,
          lineHeight: 1.4,
          letterSpacing: "-0.01em",
          color: "rgba(255,255,255,0.66)",
          opacity: capOp,
        }}
      >
        They say you lost because you were dumb. The papers say someone had to.
      </div>
    </AbsoluteFill>
  );
};

const TitleBar: React.FC = () => {
  const frame = useCurrentFrame();
  const op = interpolate(frame, [0, 24], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "flex-start", paddingTop: 44, zIndex: 200 }}>
      <div
        style={{
          fontFamily: geist,
          fontWeight: 900,
          fontSize: 60,
          letterSpacing: "-0.04em",
          color: "#FFFFFF",
          opacity: op,
        }}
      >
        Every market needs a loser.
      </div>
    </AbsoluteFill>
  );
};

export const WhyLiquidityIsHard: React.FC = () => (
  <AbsoluteFill style={{ background: INK }}>
    <CameraMotionBlur shutterAngle={180} samples={10}>
      <Crowd />
    </CameraMotionBlur>
    <Charges />
    <Converge />
    <Victim />
    <TitleBar />
  </AbsoluteFill>
);

export const whyLiquidityIsHardMeta = {
  id: "WhyLiquidityIsHard",
  component: WhyLiquidityIsHard,
  durationInFrames: TOTAL,
  fps: FPS,
  width: W,
  height: H,
};
