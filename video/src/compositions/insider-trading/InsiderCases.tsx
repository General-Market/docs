import React from "react";
import {
  AbsoluteFill,
  Audio,
  Easing,
  Img,
  Sequence,
  Video,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { InsiderPitch, PITCH_DURATION } from "./InsiderPitch";

const interFamily = loadInter("normal", {
  subsets: ["latin"],
  weights: ["300", "400", "500", "600", "900"],
}).fontFamily;

const FPS = 30;
// Beat-synced anchors (articles-phase-local frames). Derived from the 143.5 BPM
// track; each value is a beat timestamp shifted by -PROLOGUE_DURATION (the
// articles phase lives in a Sequence from=PROLOGUE_DURATION, so its local
// frame 0 == music time 4.0s).
// Was 223 (music beat at 7.424s); cut 20 frames of dead hold on the last
// article so the articles → pitch handover snaps instead of waiting.
const PITCH_START = 203;

// ─── Prologue — 4s. Micro-onsets from librosa (first 3.65s of the track,
//     30fps comp frames). Each onset = a cut. Advance per cut = gap-since-
//     previous-onset × acceleration-weight, so drops (sparse onsets) push
//     the broll forward hard, while fast rolls (dense onsets) still nudge.
//     startFroms walk monotonically from frame 0 of the full source to
//     its tail; playbackRates bake in a harsh ramp so the broll itself
//     visibly accelerates, not just the cuts.
// Onsets from librosa on public/music/insider-cases.mp3 (30fps, first 4s).
// Uses the actual detected onsets — 13 transients — not a guessed subset.
// Cuts sit exactly on the onset; impact FX have been moved off frame 0 so
// the image is sharpest AT the cut, not blurriest.
// First onset pinned to 0 so the broll is present on frame 0 — otherwise
// the video opens on a black hold before the first beat.
const PROLOGUE_ONSETS = [0, 5, 16, 20, 32, 45, 58, 80, 96, 100, 103, 107, 109];
const PROLOGUE_DURATION = 120;
const PROLOGUE_SOURCE_TOTAL = 1780; // source frames to traverse (1836 total, margin)
const PROLOGUE_ACCEL_K = 2.2;

const computePrologueCuts = () => {
  const n = PROLOGUE_ONSETS.length;
  const weights: number[] = [];
  for (let i = 0; i < n; i++) {
    const prev = i === 0 ? 0 : PROLOGUE_ONSETS[i - 1];
    const gap = Math.max(1, PROLOGUE_ONSETS[i] - prev);
    const mult = 1 + PROLOGUE_ACCEL_K * (n === 1 ? 0 : i / (n - 1));
    weights.push(gap * mult);
  }
  const sumW = weights.reduce((a, b) => a + b, 0);
  const scale = PROLOGUE_SOURCE_TOTAL / sumW;

  const starts: number[] = [];
  const rates: number[] = [];
  let cum = 0;
  for (let i = 0; i < n; i++) {
    starts.push(Math.round(cum));
    const advance = weights[i] * scale;
    const nextOnset = i < n - 1 ? PROLOGUE_ONSETS[i + 1] : PROLOGUE_DURATION;
    const duration = Math.max(1, nextOnset - PROLOGUE_ONSETS[i]);
    rates.push(Math.max(0.4, Math.min(16, advance / duration)));
    cum += advance;
  }
  return { starts, rates };
};

const { starts: PROLOGUE_CUT_STARTS, rates: PROLOGUE_CUT_RATES } =
  computePrologueCuts();
const HARSH_EASE = Easing.bezier(0.88, 0, 0.08, 1);

// Comp ends exactly at pitch end (global frame 981 = 32:21 at 30fps).
// The outroFade runs [MAIN_DURATION - 18, MAIN_DURATION], so the last
// 18 frames of the closing taper to zero and the cut lands clean.
const MAIN_DURATION = PITCH_START + PITCH_DURATION;
const DURATION = PROLOGUE_DURATION + MAIN_DURATION;

// Character entry tone — white on white. The prologue is strict b&w; no
// lime flare, no green hot range. Chars fade in via the burst window only.
const TYPER_ENTRY: [number, number, number] = [255, 255, 255];
const easeInPow = (t: number, p: number): number =>
  Math.pow(Math.max(0, Math.min(1, t)), p);

type Brand =
  | { kind: "wordmark"; src: string; pad?: number }
  | { kind: "composite"; icon: string; name: string; accent: string };

type Highlight = { x: number; y: number; w: number; h: number };

type Article = {
  image: string;
  brand: Brand;
  highlights?: Highlight[];
  background: string;
};

const ARTICLES: Article[] = [
  {
    image: "insider-trading/articles/1.png",
    brand: { kind: "wordmark", src: "logos/exchanges/binance.svg", pad: 36 },
    highlights: [
      { x: 0.5737, y: 0.1383, w: 0.3183, h: 0.0453 },
    ],
    background: "insider-trading/backgrounds/binance.jpg",
  },
  {
    image: "insider-trading/articles/3.png",
    brand: {
      kind: "wordmark",
      src: "logos/exchanges/polymarket-black.svg",
      pad: 40,
    },
    highlights: [
      { x: 0.6467, y: 0.2828, w: 0.2445, h: 0.0273 },
      { x: 0.5126, y: 0.3313, w: 0.1197, h: 0.0281 },
    ],
    background: "insider-trading/backgrounds/polymarket.jpg",
  },
  {
    image: "insider-trading/articles/4.png",
    brand: {
      kind: "composite",
      icon: "logos/exchanges/pumpfun.png",
      name: "pump.fun",
      accent: "#18c27a",
    },
    highlights: [
      { x: 0.1253, y: 0.5158, w: 0.2653, h: 0.0487 },
    ],
    background: "insider-trading/backgrounds/pumpfun.jpg",
  },
  {
    image: "insider-trading/articles/6.png",
    brand: { kind: "wordmark", src: "logos/exchanges/kalshi.svg", pad: 22 },
    highlights: [
      { x: 0.4819, y: 0.176, w: 0.216, h: 0.0303 },
    ],
    background: "insider-trading/backgrounds/kalshi.jpg",
  },
  {
    image: "insider-trading/articles/7.png",
    brand: { kind: "wordmark", src: "logos/exchanges/coinbase.svg", pad: 40 },
    highlights: [
      { x: 0.2453, y: 0.4009, w: 0.3414, h: 0.0417 },
    ],
    background: "insider-trading/backgrounds/coinbase.png",
  },
  {
    image: "insider-trading/articles/8.png",
    brand: { kind: "wordmark", src: "logos/exchanges/nyse.svg", pad: 32 },
    highlights: [
      { x: 0.0522, y: 0.5101, w: 0.3917, h: 0.0519 },
    ],
    background: "insider-trading/backgrounds/nyse.jpg",
  },
  {
    image: "insider-trading/articles/9.png",
    brand: { kind: "wordmark", src: "logos/exchanges/robinhood.svg", pad: 40 },
    highlights: [
      { x: 0.4119, y: 0.1968, w: 0.2831, h: 0.042 },
    ],
    background: "insider-trading/backgrounds/robinhood.png",
  },
];

const INTRO_FRAMES = 10;
const STRIDE = 26;
const ON_STAGE = 34;

// Article entrances land every other beat (~0.84s apart). Stride between
// entries stays near the old STRIDE=26, but now snapped to the music.
const ARTICLE_STARTS = [4, 29, 55, 81, 106, 132, 158];
// Beats (articles-local frames) used for per-beat punch on the article row.
const ARTICLE_BEATS = [
  4, 17, 29, 42, 55, 68, 81, 94, 106, 119, 132, 145, 158, 170, 184,
];

const BrandPlate: React.FC<{ brand: Brand; appear: number }> = ({
  brand,
  appear,
}) => {
  if (brand.kind === "wordmark") {
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          padding: brand.pad ?? 32,
          boxSizing: "border-box",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Img
          src={staticFile(brand.src)}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
          }}
        />
      </div>
    );
  }

  // composite
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
        boxSizing: "border-box",
      }}
    >
      <Img
        src={staticFile(brand.icon)}
        style={{
          height: "64%",
          maxWidth: "36%",
          width: "auto",
          objectFit: "contain",
          display: "block",
        }}
      />
      <span
        style={{
          fontFamily: "'Inter', 'Helvetica Neue', system-ui, sans-serif",
          fontWeight: 800,
          fontSize: 54,
          lineHeight: 1,
          letterSpacing: "-0.03em",
          color: "#0a0a0a",
          opacity: appear,
          whiteSpace: "nowrap",
          transform: "translateY(-2px)",
        }}
      >
        {brand.name}
      </span>
    </div>
  );
};

const LogoCard: React.FC<{ brand: Brand; appear: number }> = ({
  brand,
  appear,
}) => {
  return (
    <div
      style={{
        width: 560,
        height: 360,
        background: "#ffffff",
        borderRadius: 30,
        padding: 34,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: `0 0 0 1px rgba(14,15,12,0.12), 0 ${46 * appear}px ${
          90 * appear
        }px rgba(0,0,0,${0.5 * appear}), 0 2px 10px rgba(0,0,0,${
          0.3 * appear
        })`,
      }}
    >
      <BrandPlate brand={brand} appear={appear} />
    </div>
  );
};

const HighlightLayer: React.FC<{
  highlights: Highlight[];
  reveal: number;
}> = ({ highlights, reveal }) => {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
      }}
    >
      {highlights.map((h, idx) => {
        const stagger = idx * 0.18;
        const local = Math.max(
          0,
          Math.min(1, (reveal - stagger) / Math.max(0.01, 1 - stagger)),
        );
        const overshootX = 0.008;
        const overshootW = 0.016;
        const padY = h.h * 0.22;
        const top = h.y - padY;
        const heightPct = h.h + padY * 2;
        return (
          <React.Fragment key={idx}>
            <div
              style={{
                position: "absolute",
                left: `${(h.x - overshootX) * 100}%`,
                top: `${top * 100}%`,
                width: `${(h.w + overshootW) * local * 100}%`,
                height: `${heightPct * 100}%`,
                background:
                  "linear-gradient(180deg, rgba(255,241,82,0.55) 0%, rgba(255,224,38,0.72) 45%, rgba(255,224,38,0.72) 55%, rgba(255,241,82,0.55) 100%)",
                mixBlendMode: "multiply",
                borderRadius: 3,
                transform: "skewX(-5deg) rotate(-0.8deg)",
                transformOrigin: "left center",
              }}
            />
            <div
              style={{
                position: "absolute",
                left: `${(h.x - overshootX) * 100}%`,
                top: `${top * 100}%`,
                width: `${(h.w + overshootW) * local * 100}%`,
                height: `${heightPct * 100}%`,
                background:
                  "linear-gradient(180deg, rgba(255,241,82,0.45) 0%, rgba(255,224,38,0.55) 45%, rgba(255,224,38,0.55) 55%, rgba(255,241,82,0.45) 100%)",
                mixBlendMode: "screen",
                borderRadius: 3,
                transform: "skewX(-5deg) rotate(-0.8deg)",
                transformOrigin: "left center",
              }}
            />
            <div
              style={{
                position: "absolute",
                left: `${(h.x - overshootX * 0.6) * 100}%`,
                top: `${(h.y + h.h * 0.92) * 100}%`,
                width: `${(h.w + overshootW * 0.6) * local * 100}%`,
                height: `${Math.max(0.008, h.h * 0.22) * 100}%`,
                background: "#ff2b44",
                borderRadius: 2,
                transform: "skewX(-3deg) rotate(-0.4deg)",
                transformOrigin: "left center",
                boxShadow: "0 0 6px rgba(255,43,68,0.45)",
              }}
            />
          </React.Fragment>
        );
      })}
    </div>
  );
};

const ArticleFrame: React.FC<{
  article: Article;
  appear: number;
  tilt: number;
  highlightReveal: number;
  index: number;
  total: number;
}> = ({ article, appear, tilt, highlightReveal }) => {
  const maxH = 960;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 68,
        transform: `rotate(${tilt * 0.25}deg)`,
      }}
    >
      <div
        style={{
          position: "relative",
          background: "#ffffff",
          padding: 20,
          borderRadius: 30,
          boxShadow: `0 0 0 1px rgba(14,15,12,0.12), 0 ${46 * appear}px ${
            92 * appear
          }px rgba(0,0,0,${0.55 * appear}), 0 2px 10px rgba(0,0,0,${
            0.3 * appear
          })`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div style={{ position: "relative", display: "block" }}>
          <Img
            src={staticFile(article.image)}
            style={{
              height: maxH,
              width: "auto",
              maxWidth: 1180,
              objectFit: "contain",
              display: "block",
              borderRadius: 4,
            }}
          />
          {article.highlights && article.highlights.length > 0 ? (
            <HighlightLayer
              highlights={article.highlights}
              reveal={highlightReveal}
            />
          ) : null}
        </div>
      </div>
      <LogoCard brand={article.brand} appear={appear} />
    </div>
  );
};

const InsiderArticlesPhase: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Entry whip — the prologue exits by zoom-blurring out, the articles
  // enter by zoom-blurring in. Reads as a single camera punch through the
  // boundary instead of two cuts separated by black.
  const entryT = interpolate(frame, [0, 10], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const entryScale = interpolate(entryT, [0, 1], [1.14, 1]);
  // Large-radius blur on a 1920×1080 element is expensive. Keep the
  // entry blur modest so the first second of the articles phase doesn't
  // choke the GPU on every playback.
  const entryBlur = interpolate(entryT, [0, 1], [8, 0]);

  const outroFade = interpolate(frame, [MAIN_DURATION - 18, MAIN_DURATION], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  // Articles push away (scale + blur) while the pitch scales in from
  // slight over-zoom. Both phases are travelling the same axis — a single
  // sustained forward motion instead of a crossfade.
  const articleExitT = interpolate(
    frame,
    [PITCH_START, PITCH_START + 14],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const articleExitScale = 1 - articleExitT * 0.10;
  const articleExitBlur = articleExitT * 6;
  const articleHide = interpolate(
    frame,
    [PITCH_START + 4, PITCH_START + 14],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const pitchEntryScale = interpolate(
    frame,
    [PITCH_START, PITCH_START + 14],
    [1.08, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const pitchFadeIn = interpolate(
    frame,
    [PITCH_START + 2, PITCH_START + 14],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  // Per-beat punch on the articles backdrop: find the most recent beat
  // still within a short decay window and raise contrast/brightness. Subtle
  // enough not to fight the entrance springs; enough to feel the music.
  let beatPunch = 0;
  for (let i = ARTICLE_BEATS.length - 1; i >= 0; i--) {
    const b = ARTICLE_BEATS[i];
    if (frame >= b) {
      const d = frame - b;
      if (d < 6) beatPunch = Math.pow(1 - d / 6, 1.4);
      break;
    }
  }

  return (
    <AbsoluteFill
      style={{
        background: "#000000",
        opacity: outroFade,
      }}
    >
      <AbsoluteFill
        style={{
          filter: `saturate(${1.04 + beatPunch * 0.15}) contrast(${1.08 + beatPunch * 0.08}) brightness(${0.96 + beatPunch * 0.09}) blur(${entryBlur + articleExitBlur}px)`,
          transform: `scale(${(1 + beatPunch * 0.006) * entryScale * articleExitScale})`,
          transformOrigin: "50% 50%",
        }}
      >
      {ARTICLES.map((article, i) => {
        const start = ARTICLE_STARTS[i] ?? (INTRO_FRAMES + i * STRIDE);
        const local = frame - start;
        const isLast = i === ARTICLES.length - 1;

        if (local < -20) return null;
        if (!isLast && local > ON_STAGE + 20) return null;

        const bgOpacity = isLast
          ? interpolate(local, [-10, 4], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            })
          : interpolate(
              local,
              [-10, 4, ON_STAGE - 4, ON_STAGE + 14],
              [0, 1, 1, 0],
              {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              },
            );

        if (bgOpacity <= 0) return null;

        const kenBurns = interpolate(
          local,
          [-10, isLast ? MAIN_DURATION : ON_STAGE + 14],
          [1.0, 1.03],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
        );

        const bgBrightness = 0.85;

        return (
          <AbsoluteFill
            key={`bg-${i}`}
            style={{
              opacity: bgOpacity * (isLast ? articleHide : 1),
              background: "#0a0a0a",
            }}
          >
            <Img
              src={staticFile(article.background)}
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "cover",
                transform: `scale(${kenBurns})`,
                transformOrigin: "center",
                filter: `grayscale(1) blur(2px) saturate(0.9) brightness(${bgBrightness})`,
              }}
            />
          </AbsoluteFill>
        );
      })}

      <AbsoluteFill
        style={{
          pointerEvents: "none",
          background:
            "linear-gradient(180deg, rgba(10,10,10,0.18) 0%, rgba(10,10,10,0.05) 40%, rgba(10,10,10,0.30) 100%)",
        }}
      />

      {ARTICLES.map((article, i) => {
        const start = ARTICLE_STARTS[i] ?? (INTRO_FRAMES + i * STRIDE);
        const local = frame - start;
        const isLast = i === ARTICLES.length - 1;

        if (local < -10) return null;
        if (!isLast && local > ON_STAGE + 10) return null;

        const entrance = spring({
          frame: local,
          fps,
          config: { damping: 16, mass: 0.9, stiffness: 130 },
          durationInFrames: 22,
        });

        const opacity = isLast
          ? interpolate(local, [0, 8], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            })
          : interpolate(local, [0, 6, ON_STAGE, ON_STAGE + 8], [0, 1, 1, 0], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });

        const lift = interpolate(
          local,
          [0, isLast ? MAIN_DURATION : ON_STAGE + 8],
          [28, -14],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
        );

        // Idle breath on the held shot. Big-co films never leave a frame
        // static — tiny continuous motion keeps the eye engaged while the
        // headline is read. Phase-offset per article so they don't all
        // drift in lockstep.
        const idlePhase = i * 1.37;
        const idleY = Math.sin(local * 0.075 + idlePhase) * 2.8;
        const tilt =
          (i % 2 === 0 ? 1 : -1) *
          (0.6 + 0.5 * Math.sin(local * 0.055 + idlePhase));
        const scale = 0.92 + 0.08 * entrance;
        const breath = 1 + 0.004 * Math.sin(local * 0.065 + idlePhase);

        const highlightReveal = interpolate(local, [10, 22], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });

        // Detail push — after the highlight lands at local 22, camera
        // moves into the article. For non-final articles it ramps for
        // the remaining on-stage window; for the last it holds past the
        // fade so the handoff to the pitch feels continuous.
        const detailWindowEnd = isLast
          ? Math.max(28, PITCH_START - start)
          : ON_STAGE;
        const detailZoom = interpolate(
          local,
          [22, 28, detailWindowEnd],
          [1, 1.28, 1.42],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
        );

        // Bias the scale origin toward the average highlight position —
        // the camera pushes INTO the damning phrase rather than the
        // middle of the page.
        const hs = article.highlights ?? [];
        const avgXFrac = hs.length
          ? hs.reduce((s, h) => s + h.x + h.w / 2, 0) / hs.length
          : 0.5;
        const avgYFrac = hs.length
          ? hs.reduce((s, h) => s + h.y + h.h / 2, 0) / hs.length
          : 0.5;
        // Image card sits left of comp centre (logo card takes the right
        // half of the frame). These constants match ArticleFrame's
        // 1180×960 image + 20px card padding within a flex row of total
        // ≈1848px, centred in a 1920×1080 comp.
        const originXPct = ((36 + 20 + avgXFrac * 1180) / 1920) * 100;
        const originYPct = ((60 + avgYFrac * 960) / 1080) * 100;

        return (
          <AbsoluteFill
            key={i}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              opacity: opacity * (isLast ? articleHide : 1),
              transform: `translateY(${lift + idleY}px) scale(${scale * detailZoom * breath})`,
              transformOrigin: `${originXPct}% ${originYPct}%`,
            }}
          >
            <ArticleFrame
              article={article}
              appear={opacity}
              tilt={tilt}
              highlightReveal={highlightReveal}
              index={i}
              total={ARTICLES.length}
            />
          </AbsoluteFill>
        );
      })}

      <AbsoluteFill
        style={{
          pointerEvents: "none",
          background:
            "radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.45) 100%)",
          opacity: articleHide,
        }}
      />

      </AbsoluteFill>

      {/* Shared-element bleed — the last prologue line rides through the
          cut. Broll zoom-blurs out, articles zoom-blur in, but the text
          stays sharp and continues its own scale, so the boundary reads
          as a single thought rather than two stitched sequences. */}
      <PrologueEcho />

      {frame >= PITCH_START ? (
        <AbsoluteFill
          style={{
            opacity: pitchFadeIn,
            transform: `scale(${pitchEntryScale})`,
            transformOrigin: "50% 50%",
          }}
        >
          <InsiderPitch startFrame={PITCH_START} />
        </AbsoluteFill>
      ) : null}
    </AbsoluteFill>
  );
};

/* ─── Beat-stepped typewriter — chars hold still between onsets, then burst
       in via the same harsh bezier that drives the broll cuts. Each beat
       lifts the visible char count from charsAtBeat[i-1] to charsAtBeat[i]
       over burstFrames. The rose→final color age is derived from the per-
       char appearance frame, so later chars stay warmer longer. ──────── */
const BeatTypewriter: React.FC<{
  text: string;
  revealBeats: number[];
  charsAtBeat: number[];
  burstFrames?: number;
  wipeStart?: number;
  wipeEnd?: number;
  fontSize?: number;
}> = ({
  text,
  revealBeats,
  charsAtBeat,
  burstFrames = 4,
  wipeStart,
  wipeEnd,
  fontSize = 64,
}) => {
  const frame = useCurrentFrame();
  const len = text.length;
  const ws = wipeStart ?? 9999;
  const we = wipeEnd ?? 9999;
  if (frame < revealBeats[0] || frame > we) return null;

  // Monochrome only — every char lands on white.
  const finalRGB = (): [number, number, number] => [255, 255, 255];

  const appearFrame = (i: number): number => {
    for (let b = 0; b < revealBeats.length; b++) {
      const prev = b === 0 ? 0 : charsAtBeat[b - 1];
      const target = charsAtBeat[b];
      if (i >= prev && i < target) {
        const span = Math.max(1, target - prev);
        const fraction = (i - prev + 0.5) / span;
        return revealBeats[b] + fraction * burstFrames;
      }
    }
    return revealBeats[revealBeats.length - 1] + burstFrames;
  };

  let beatIdx = 0;
  for (let i = revealBeats.length - 1; i >= 0; i--) {
    if (frame >= revealBeats[i]) {
      beatIdx = i;
      break;
    }
  }
  const prevTarget = beatIdx === 0 ? 0 : charsAtBeat[beatIdx - 1];
  const target = charsAtBeat[beatIdx];
  const timeIn = frame - revealBeats[beatIdx];
  const tBurst = Math.max(0, Math.min(1, timeIn / burstFrames));
  const harshT = HARSH_EASE(tBurst);
  let visibleEnd = Math.round(prevTarget + (target - prevTarget) * harshT);
  let visibleStart = 0;
  let wiping = false;

  if (frame >= ws) {
    wiping = true;
    const t = (frame - ws) / Math.max(1, we - ws);
    visibleStart = Math.min(len, Math.round(len * easeInPow(t, 2.4)));
    visibleEnd = len;
  }

  if (visibleEnd <= visibleStart) return null;

  return (
    <AbsoluteFill
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        padding: "0 140px",
      }}
    >
      <div
        style={{
          fontFamily: interFamily,
          fontFeatureSettings: '"calt" 1',
          fontSize,
          fontWeight: 900,
          letterSpacing: "-0.03em",
          textAlign: "center",
          lineHeight: 0.9,
          color: "white",
          textShadow: "0 6px 30px rgba(0,0,0,0.78)",
          maxWidth: 1560,
        }}
      >
        {text.split("").map((ch, i) => {
          if (i < visibleStart || i >= visibleEnd) return null;
          const display = ch === " " ? " " : ch;
          const [fr, fg, fb] = finalRGB();

          if (wiping) {
            const dist = i - visibleStart;
            const op = interpolate(dist, [0, 2], [0.2, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            return (
              <span
                key={i}
                style={{ color: `rgba(${fr},${fg},${fb},${op})` }}
              >
                {display}
              </span>
            );
          }

          const age = frame - appearFrame(i);
          const colorT = interpolate(age, [0, 4], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          const r = interpolate(colorT, [0, 1], [TYPER_ENTRY[0], fr]);
          const g = interpolate(colorT, [0, 1], [TYPER_ENTRY[1], fg]);
          const b = interpolate(colorT, [0, 1], [TYPER_ENTRY[2], fb]);
          return (
            <span key={i} style={{ color: `rgb(${r},${g},${b})` }}>
              {display}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};


/* ─── Two-line zoomed finale for the prologue. Line 1 reveals at line1Beat,
       line 2 at line2Beat (both HARSH_EASE char-burst over revealBurst
       frames). From zoomStart to zoomEnd the whole stack scales from 1.0
       to ~2.4 on a smoothstep — the Ember "on" move, retuned for a longer
       string. White chars, same drop-shadow the typewriter uses. */
const PrologueZoomFinale: React.FC<{
  line1: string;
  line2: string;
  line1Beat: number;
  line2Beat: number;
  zoomStart: number;
  zoomEnd: number;
  revealBurst: number;
  fontSize: number;
}> = ({
  line1,
  line2,
  line1Beat,
  line2Beat,
  zoomStart,
  zoomEnd,
  revealBurst,
  fontSize,
}) => {
  const frame = useCurrentFrame();
  if (frame < line1Beat) return null;

  const charsRevealed = (text: string, beat: number): number => {
    if (frame < beat) return 0;
    const t = Math.max(0, Math.min(1, (frame - beat) / revealBurst));
    return Math.round(text.length * HARSH_EASE(t));
  };

  const count1 = charsRevealed(line1, line1Beat);
  const count2 = charsRevealed(line2, line2Beat);

  const zoomT = Math.max(
    0,
    Math.min(1, (frame - zoomStart) / Math.max(1, zoomEnd - zoomStart)),
  );
  const smooth = zoomT * zoomT * (3 - 2 * zoomT);
  // Anticipation — the stack pulls back (scales down ~5%) in the 6
  // frames before the forward zoom, then snaps back to 1.0 at zoomStart
  // and commits to the scale-up. Any UI moving toward the viewer first
  // recoils the opposite direction.
  const anticipation = interpolate(
    frame,
    [zoomStart - 6, zoomStart - 2, zoomStart],
    [1, 0.95, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const scale = anticipation * (1 + 1.4 * smooth);

  return (
    <AbsoluteFill
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <div
        style={{
          fontFamily: interFamily,
          fontFeatureSettings: '"calt" 1',
          fontSize,
          fontWeight: 900,
          letterSpacing: "-0.03em",
          textAlign: "center",
          lineHeight: 1,
          color: "white",
          textShadow: "0 6px 30px rgba(0,0,0,0.78)",
          transform: `scale(${scale})`,
          transformOrigin: "50% 50%",
          whiteSpace: "nowrap",
        }}
      >
        <div>{line1.slice(0, count1)}</div>
        <div style={{ marginTop: fontSize * 0.12 }}>
          {line2.slice(0, count2)}
        </div>
      </div>
    </AbsoluteFill>
  );
};

/* ─── Echo of the final prologue pair, rendered at the head of the
       articles phase. Matches PrologueZoomFinale's layout so the text
       appears to continue its own motion unimpeded. Line 1 ("~$50,000")
       fades first, line 2 ("per trader") holds a beat longer. The scale
       continues from the finale's 2.4× up to 3.6× as the whole thing
       fades. Pointer-events off — pure visual bleed. */
const PrologueEcho: React.FC = () => {
  const frame = useCurrentFrame();
  if (frame > 16) return null;

  const t = Math.max(0, Math.min(1, frame / 16));
  const scale = 2.4 + t * 1.2;
  const line1Opacity = interpolate(frame, [0, 8], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const line2Opacity = interpolate(frame, [0, 10, 16], [1, 0.9, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const fontSize = 88;
  return (
    <AbsoluteFill
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          fontFamily: interFamily,
          fontFeatureSettings: '"calt" 1',
          fontSize,
          fontWeight: 900,
          letterSpacing: "-0.03em",
          textAlign: "center",
          lineHeight: 1,
          color: "white",
          textShadow: "0 6px 30px rgba(0,0,0,0.78)",
          transform: `scale(${scale})`,
          transformOrigin: "50% 50%",
          whiteSpace: "nowrap",
        }}
      >
        <div style={{ opacity: line1Opacity }}>~$50,000</div>
        <div style={{ marginTop: fontSize * 0.12, opacity: line2Opacity }}>
          per trader
        </div>
      </div>
    </AbsoluteFill>
  );
};

/* ─── Per-onset broll shot — harsh bezier decay on cut: tremble, jitter,
       scale punch, heavy Gaussian blur snap, chromatic fringe. Each cut
       carries its own playbackRate so the broll itself accelerates. ─── */
const BeatShot: React.FC<{
  startFromFrame: number;
  playbackRate: number;
}> = ({ startFromFrame, playbackRate }) => {
  const frame = useCurrentFrame();

  // Two independent curves:
  //  slam   — 1 at t=0, decays fast (3 frames). Bright flash AT the cut.
  //  echo   — 0 at t=0, rises to 1 at t=1 and then decays by t=5. Motion
  //           artefacts (jitter, blur) live here, so they read as the *echo*
  //           of the hit, not its precursor. This is the fix for "lag":
  //           the image is SHARPEST on the cut frame.
  const slam = Math.max(0, 1 - frame / 3);
  const echo = frame <= 0 ? 0 : Math.max(0, 1 - (frame - 1) / 4);

  const seed = startFromFrame;
  const jx = echo * Math.sin(frame * 19.1 + seed * 0.37) * 8;
  const jy = echo * Math.cos(frame * 15.3 + seed * 0.52) * 8;
  const rot = echo * Math.sin(frame * 22.7 + seed * 0.11) * 0.7;
  // Scale pulse — subtle, only on slam, so the image doesn't zoom at impact.
  const scale = 1.02 + slam * 0.03;
  // Light blur on the echo frames only — never on the cut itself.
  const blur = echo * 3;
  const contrast = 1.08 + slam * 0.18;
  const brightness = 0.82 + slam * 0.26;
  const saturation = 0.9 + slam * 0.2;

  const filter = [
    "grayscale(0.28)",
    `contrast(${contrast})`,
    `brightness(${brightness})`,
    `saturate(${saturation})`,
    `blur(${blur}px)`,
  ].join(" ");

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <Video
        src={staticFile("insider-trading/broll/dezoom.mp4")}
        startFrom={startFromFrame}
        playbackRate={playbackRate}
        muted
        style={{
          position: "absolute",
          width: "100%",
          height: "100%",
          objectFit: "cover",
          transform: `translate(${jx}px, ${jy}px) scale(${scale}) rotate(${rot}deg)`,
          transformOrigin: "50% 50%",
          filter,
        }}
      />
    </AbsoluteFill>
  );
};

/* ─── Animated film grain via SVG turbulence — reseeds every frame so the
       noise texture crawls. feTurbulence is expensive at 1920×1080 so we
       reseed every 6 frames, not every one — the eye does not distinguish
       between 30fps and 5fps noise churn, and the filter rebuild cost is
       cut by six. */
const PrologueGrain: React.FC = () => {
  const frame = useCurrentFrame();
  const seedStep = Math.floor(frame / 6);
  const filterId = `prologue-grain-${seedStep}`;
  return (
    <svg
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        mixBlendMode: "overlay",
        opacity: 0.22,
      }}
    >
      <filter id={filterId}>
        <feTurbulence
          type="fractalNoise"
          baseFrequency="0.92"
          numOctaves="2"
          seed={seedStep}
          stitchTiles="stitch"
        />
        <feColorMatrix
          values="0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 1.2 0"
        />
      </filter>
      <rect width="100%" height="100%" filter={`url(#${filterId})`} />
    </svg>
  );
};

const InsiderPrologue: React.FC = () => {
  const frame = useCurrentFrame();

  // No opening curtain. The broll fires on frame 0; starting on black
  // would be theatre without payoff. Exit is handled by zoom-blur.

  // Exit ramp on the broll layer only. Text layers stay sharp so they can
  // bleed through the phase cut.
  const exitT = interpolate(
    frame,
    [PROLOGUE_DURATION - 10, PROLOGUE_DURATION],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const exitScale = 1 + exitT * 0.38;
  const exitBlur = exitT * 16;
  const exitBrollOpacity = 1 - exitT * 0.45;

  return (
    <AbsoluteFill style={{ background: "#000000" }}>
      <AbsoluteFill
        style={{
          transform: `scale(${exitScale})`,
          transformOrigin: "50% 50%",
          filter: `blur(${exitBlur}px)`,
          opacity: exitBrollOpacity,
        }}
      >
        {PROLOGUE_ONSETS.map((start, i) => {
          const end = PROLOGUE_ONSETS[i + 1] ?? PROLOGUE_DURATION;
          const len = Math.max(end - start + 3, 4);
          return (
            <Sequence
              key={`onset-${i}`}
              from={start}
              durationInFrames={len}
            >
              <BeatShot
                startFromFrame={PROLOGUE_CUT_STARTS[i] ?? 0}
                playbackRate={PROLOGUE_CUT_RATES[i] ?? 1}
              />
            </Sequence>
          );
        })}

        <AbsoluteFill
          style={{
            pointerEvents: "none",
            background:
              "linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.22) 44%, rgba(0,0,0,0.82) 100%)",
          }}
        />

        {/* Radial vignette — crushes the corners, pushes focus to centre */}
        <AbsoluteFill
          style={{
            pointerEvents: "none",
            background:
              "radial-gradient(ellipse 95% 75% at 50% 50%, transparent 28%, rgba(0,0,0,0.35) 70%, rgba(0,0,0,0.75) 100%)",
          }}
        />

        {/* Animated film grain */}
        <PrologueGrain />
      </AbsoluteFill>

      {/* Stmt 1 — "1 in 2500 trader is an insider". Three onsets carry
          the 30 chars, wipe clears before stmt 2 starts typing at 32. */}
      <BeatTypewriter
        text="1 in 2500 trader is an insider"
        revealBeats={[1, 5, 16]}
        charsAtBeat={[10, 20, 30]}
        burstFrames={4}
        wipeStart={22}
        wipeEnd={30}
        fontSize={62}
      />

      {/* Stmt 2 — "Collecting 70% profits of the 2499". Onsets 32, 45, 58
          carry the 34 chars; wipe clears just before stmt 3 begins at 80. */}
      <BeatTypewriter
        text="Collecting 70% profits of the 2499"
        revealBeats={[32, 45, 58]}
        charsAtBeat={[12, 24, 34]}
        burstFrames={4}
        wipeStart={64}
        wipeEnd={78}
        fontSize={62}
      />

      {/* Stmt 3 — "~$50,000 / per trader" on two lines, the whole stack
          scales up as the closing ramp. The drop cluster (100,103,107,
          109) powers the zoom; curtain at 116 swallows it. */}
      <PrologueZoomFinale
        line1="~$50,000"
        line2="per trader"
        line1Beat={80}
        line2Beat={96}
        zoomStart={100}
        zoomEnd={116}
        revealBurst={6}
        fontSize={88}
      />

    </AbsoluteFill>
  );
};

// Global grade — one consistent LUT across the whole piece. Cool and
// slightly crushed through the prologue (anxiety of reported fact),
// neutral through the case montage, warmer into the pitch (resolution).
// Uniformity of grade is most of what separates "cinematic" from "made
// in a browser".
//
// After the night→day cut, the scenes render on a pure-white ground —
// any hue-rotate tints it, any contrast/brightness drift greys it.
// So past the boundary we flatten: no hue shift, neutral contrast and
// brightness, a whisper of saturation. A 12-frame crossfade around the
// cut keeps the transition from snapping.
const LIGHT_GRADE_BOUNDARY = PROLOGUE_DURATION + PITCH_START + 66;
const GlobalGrade: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const frame = useCurrentFrame();
  const t = Math.max(0, Math.min(1, frame / DURATION));
  const darkHue = interpolate(t, [0, 0.3, 0.7, 1], [-6, -2, 3, 7]);
  const darkSat = interpolate(t, [0, 0.4, 1], [0.92, 1.02, 1.06]);
  const darkContrast = interpolate(t, [0, 0.5, 1], [1.06, 1.02, 1.03]);
  const darkBrightness = interpolate(t, [0, 0.5, 1], [0.98, 1.0, 1.02]);
  const lightHue = 0;
  const lightSat = 1.02;
  const lightContrast = 1.0;
  const lightBrightness = 1.0;
  const blend = interpolate(
    frame,
    [LIGHT_GRADE_BOUNDARY - 6, LIGHT_GRADE_BOUNDARY + 6],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const hueShift = darkHue + (lightHue - darkHue) * blend;
  const sat = darkSat + (lightSat - darkSat) * blend;
  const contrast = darkContrast + (lightContrast - darkContrast) * blend;
  const brightness = darkBrightness + (lightBrightness - darkBrightness) * blend;
  return (
    <AbsoluteFill
      style={{
        filter: `hue-rotate(${hueShift}deg) saturate(${sat}) contrast(${contrast}) brightness(${brightness})`,
      }}
    >
      {children}
    </AbsoluteFill>
  );
};

export const InsiderCases: React.FC = () => {
  return (
    <AbsoluteFill style={{ background: "#000000" }}>
      <Audio src={staticFile("music/insider-cases.mp3")} volume={0.85} />
      <GlobalGrade>
        <Sequence durationInFrames={PROLOGUE_DURATION}>
          <InsiderPrologue />
        </Sequence>
        <Sequence from={PROLOGUE_DURATION} durationInFrames={MAIN_DURATION}>
          <InsiderArticlesPhase />
        </Sequence>
      </GlobalGrade>
    </AbsoluteFill>
  );
};

export const insiderCasesMeta = {
  id: "InsiderCases",
  component: InsiderCases,
  durationInFrames: DURATION,
  fps: FPS,
  width: 1920,
  height: 1080,
};
