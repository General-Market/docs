import React from "react";
import { AbsoluteFill, Img, staticFile, useCurrentFrame } from "remotion";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { PAPER_THUMBS } from "./liquidity-papers.data";

const interFamily = loadInter("normal", {
  subsets: ["latin"],
  weights: ["400", "500", "600", "700", "800", "900"],
}).fontFamily;

// ── Format ──────────────────────────────────────────────────────────────────
// One scene, one idea: the whole corpus of ~200 papers, stacked into a deep
// tilted wall that scrolls forever, with a handful of real first-pages held
// large in front. Square reel, 10s seamless loop — every motion returns to its
// first frame at frame LOOP, so the clip repeats with no cut.
const FPS = 60;
const SIZE = 2160;
const LOOP = 600; // 10s @ 60fps

const THUMB_BY_N: Record<number, string> = {};
for (const t of PAPER_THUMBS) THUMB_BY_N[t.n] = t.file;
const thumbSrc = (file: string) => staticFile(`insider-trading/papers/${file}`);
const ALL_THUMBS = PAPER_THUMBS.map((t) => t.file);

// Organic-motion harmonics, fed a phase that completes whole turns over the
// loop (θ = 2π·k·p) so sin/cos return to their start at p=1 — organic AND
// seamless. From webgl-picks/OrganicMotion (the WP-OrganicMotion test sheet).
const sway = (theta: number, phase: number) =>
  0.72 * Math.sin(theta + phase) + 0.28 * Math.sin(2 * theta + phase * 1.7);
const tumble = (theta: number, phase: number) =>
  Math.cos(theta + phase) * Math.sin(theta * 0.5 + phase);

// ── The wall: a deep tilted mosaic of real first-pages, scrolling per-column ──
// Every cell is an actual paper page (the 53 real first-pages, cycled), so the
// wall reads unmistakably as papers — text and figures, not blank cards — and
// the mass sells "200". Each column draws from a different offset into a
// shuffled order so neighbours rarely repeat. Column c completes (c+1) full
// scroll cycles over the loop — leftmost slow, rightmost fast — so no two
// columns advance the same amount. Each strip is drawn twice; wrapping a whole
// strip lands on identical content, which keeps the scroll seamless.
const COLS = 14;
const PER_COL = 13;
const ROW_H = 180; // portrait cell ~ page aspect, so each shows a full first page
const ROW_GAP = 12;
const STRIP_UNIT = ROW_H + ROW_GAP;

const SHUFFLED = (() => {
  const a = [...ALL_THUMBS];
  let s = 1337;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 16807) % 2147483647;
    const j = s % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
})();

const COLUMNS = Array.from({ length: COLS }, (_, c) =>
  Array.from({ length: PER_COL }, (_, r) => SHUFFLED[(c * 7 + r) % SHUFFLED.length]),
);

const WallCell: React.FC<{ file: string }> = ({ file }) => (
  <div
    style={{
      height: ROW_H,
      background: "#FFFFFF",
      border: "1px solid #15151A",
      borderRadius: 2,
      overflow: "hidden",
      boxShadow: "0 4px 10px rgba(0,0,0,0.7)",
    }}
  >
    <Img
      src={thumbSrc(file)}
      style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top center" }}
    />
  </div>
);

const Wall: React.FC = () => {
  const frame = useCurrentFrame();
  const p = frame / LOOP;

  return (
    <AbsoluteFill style={{ background: "#040404", perspective: 2400, perspectiveOrigin: "50% 30%" }}>
      <AbsoluteFill
        style={{
          transform: "rotateX(27deg) scale(1.06) translateY(-9%)",
          transformStyle: "preserve-3d",
          filter: "saturate(0.98) brightness(0.84)",
          display: "flex",
          flexDirection: "row",
          gap: ROW_GAP,
          padding: `0 ${ROW_GAP}px`,
        }}
      >
        {COLUMNS.map((col, c) => {
          const stripH = col.length * STRIP_UNIT;
          const cycles = c + 1; // incremental speed, left → right
          const offset = ((p * cycles) % 1) * stripH;
          return (
            <div key={c} style={{ flex: 1, position: "relative" }}>
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  transform: `translateY(${-offset}px)`,
                  display: "flex",
                  flexDirection: "column",
                  gap: ROW_GAP,
                }}
              >
                {[...col, ...col].map((file, i) => (
                  <WallCell key={i} file={file} />
                ))}
              </div>
            </div>
          );
        })}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ── Heroes: a few real first-pages held large, floating in place ─────────────
// ~3× the wall card. They drift and tilt on the organic harmonics but stay put
// — never leaving the frame — so the eye can rest on real evidence over the
// stack. Anchored away from the title band at the top.
const HERO_DEFS = [
  { n: 2, x: 21, y: 52, w: 660, sc: 1, amp: 30, rot: -7, rotAmp: 5, ph: 0.4 },
  { n: 3, x: 79, y: 50, w: 640, sc: 2, amp: 34, rot: 6, rotAmp: 5, ph: 1.7 },
  { n: 36, x: 31, y: 80, w: 680, sc: 1, amp: 26, rot: -5, rotAmp: 6, ph: 3.0 },
  { n: 41, x: 71, y: 78, w: 620, sc: 2, amp: 32, rot: 5, rotAmp: 5, ph: 4.5 },
];

const Heroes: React.FC = () => {
  const frame = useCurrentFrame();
  const p = frame / LOOP;

  return (
    <AbsoluteFill style={{ zIndex: 100 }}>
      {HERO_DEFS.map((h, i) => {
        const file = THUMB_BY_N[h.n];
        if (!file) return null;
        const theta = p * 2 * Math.PI * h.sc;
        const dx = h.amp * sway(theta, h.ph);
        const dy = h.amp * tumble(theta, h.ph);
        const rot = h.rot + h.rotAmp * sway(theta, h.ph * 1.3);
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `${h.x}%`,
              top: `${h.y}%`,
              width: h.w,
              transform: `translate(-50%,-50%) translate(${dx}px,${dy}px) rotate(${rot}deg)`,
              filter: "drop-shadow(0 34px 64px rgba(0,0,0,0.8))",
            }}
          >
            <Img
              src={thumbSrc(file)}
              style={{ width: "100%", display: "block", borderRadius: 4, background: "#fff" }}
            />
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

// ── Title ─────────────────────────────────────────────────────────────────────

const TitleBar: React.FC = () => (
  <AbsoluteFill
    style={{ alignItems: "center", justifyContent: "flex-start", paddingTop: 132, zIndex: 200 }}
  >
    <div
      style={{
        width: "86%",
        textAlign: "center",
        background: "rgba(4,4,4,0.66)",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
        borderRadius: 28,
        padding: "40px 56px",
      }}
    >
      <div
        style={{
          fontFamily: interFamily,
          fontWeight: 900,
          fontSize: 92,
          lineHeight: 1.04,
          letterSpacing: "-0.035em",
          color: "#FFFFFF",
        }}
      >
        200 papers on why the orderbook isn’t sustainable under insider trading.
      </div>
    </div>
  </AbsoluteFill>
);

// ── Composition ───────────────────────────────────────────────────────────────

export const WhyLiquidityIsHard: React.FC = () => (
  <AbsoluteFill style={{ background: "#000" }}>
    <Wall />
    {/* gentle vignette so the title and heroes read over the stack */}
    <AbsoluteFill
      style={{
        background:
          "radial-gradient(135% 105% at 50% 42%, rgba(4,4,4,0) 0%, rgba(4,4,4,0.16) 64%, rgba(4,4,4,0.46) 100%)",
      }}
    />
    <Heroes />
    <TitleBar />
  </AbsoluteFill>
);

export const whyLiquidityIsHardMeta = {
  id: "WhyLiquidityIsHard",
  component: WhyLiquidityIsHard,
  durationInFrames: LOOP,
  fps: FPS,
  width: SIZE,
  height: SIZE,
};
