import React from "react";
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { measureText } from "@remotion/layout-utils";
import { loadFont as loadPoppins } from "@remotion/google-fonts/Poppins";

export const FPS = 30;
export const DURATION = 969; // 32.30s — matches reference anoma-original.mp4 (30fps/968f)

// ═══════════════════════════════════════════════════════════════
// All numbers measured from the reference video frame-by-frame by
// four measurement agents (scenes f0-205 / f205-465 / f460-715 /
// f715-968). Complex UI cards are extracted rasters from the
// reference (public/anoma-assets/); the drifting silk background
// is a crossfade chain of clean plates from the same video.
// ═══════════════════════════════════════════════════════════════

const { fontFamily: POPPINS } = loadPoppins("normal", {
  weights: ["300", "500"],
  subsets: ["latin"],
});

const WHITE = "#FCFCFC";
const FS = 55.6; // comparator-calibrated (ref ink height 56 vs 59 @58.5)
// Comparator-calibrated: rendered cap-top sits 0.065em below box top.
const CAP_OFFSET = 0.065;
// Reference is video-soft; match its stroke softness.
const TEXT_SOFT: React.CSSProperties = { filter: "blur(0.4px)", opacity: 0.97 };

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const asset = (n: string) => staticFile(`anoma-assets/${n}.png`);

// ─── Silk background: crossfade chain of clean plates ───
// Stops [frame, plate]; between two stops with different plates the
// pair crossfades linearly. Hard cut at f358 (scene detector cut).
const PLATES_A: [number, string][] = [
  [0, "plate-000"],
  [25, "plate-025"],
  [50, "plate-050"],
  [75, "plate-075"],
  [95, "plate-095"],
  [118, "plate-120"],
  [140, "plate-120"],
  [160, "plate-160"],
  [205, "plate-160"],
  [230, "plate-260"],
  [280, "plate-260"],
  [309, "plate-309"],
  [358, "plate-309"],
];
const PLATES_B: [number, string][] = [
  [358, "plate-360"],
  [380, "plate-360"],
  [411, "plate-411"],
  [430, "plate-411"],
  [462, "plate-462"],
  [490, "plate-462"],
  [566, "plate-566"],
  [600, "plate-566"],
  [651, "plate-651"],
  [662, "plate-651"],
  [680, "plate-680"],
  [684, "plate-680"],
  [712, "plate-712"],
  [716, "plate-712"],
  [728, "plate-730"],
  [758, "plate-730"],
  [790, "plate-764"],
  [860, "plate-860"],
  [969, "plate-860"],
];

const Silk: React.FC<{ frame: number }> = ({ frame }) => {
  const stops = frame < 358 ? PLATES_A : PLATES_B;
  let i = 0;
  while (i < stops.length - 2 && frame >= stops[i + 1][0]) i++;
  const [f0, a] = stops[i];
  const [f1, b] = stops[i + 1];
  const t = a === b ? 0 : interpolate(frame, [f0, f1], [0, 1], clamp);
  // Fade to black f861-901 (0.26 at f870 per comparator, black at 901).
  const black = interpolate(frame, [861, 870, 901], [0, 0.26, 1], clamp);
  return (
    <AbsoluteFill>
      <Img src={asset(a)} style={{ position: "absolute", width: 1280, height: 720 }} />
      {t > 0 && (
        <Img
          src={asset(b)}
          style={{ position: "absolute", width: 1280, height: 720, opacity: t }}
        />
      )}
      {black > 0 && (
        <AbsoluteFill style={{ backgroundColor: "#000", opacity: black }} />
      )}
    </AbsoluteFill>
  );
};

// ─── Text engine ───
// Words appear at FULL opacity offset above rest, settling down with
// exponential decay (measured r≈0.74/frame). Scenes 6/7 instead rise
// from below with a 3-frame fade (measured by scene-B agent).
type WordSpec = { t: string; f: number };
type LineSpec = {
  words: WordSpec[];
  x: number; // measured ink-left
  capTop: number; // measured cap-top y
  inkW: number; // measured ink width
  fs?: number;
  drop?: number;
  r?: number;
  rise?: boolean;
  out?: { cut?: number; fade?: [number, number] };
};

const wordStyle = (
  frame: number,
  start: number,
  drop: number,
  r: number,
  rise: boolean,
): React.CSSProperties => {
  if (frame < start) return { opacity: 0 };
  const dt = frame - start;
  const off = drop * Math.pow(r, dt);
  if (rise) {
    // Scenes 6/7: word pops slightly larger and above the line, settles
    // down with a short fade (comparator-measured: +9px up, scale ~1.05
    // four frames into the reveal).
    const s = 1 + 0.06 * Math.pow(0.85, dt);
    return {
      transform: `translateY(${(-off).toFixed(2)}px) scale(${s.toFixed(4)})`,
      opacity: Math.min((dt + 1) / 2, 1),
    };
  }
  return { transform: `translateY(${(-off).toFixed(2)}px)`, opacity: 1 };
};

const Line: React.FC<LineSpec & { frame: number }> = ({
  words,
  x,
  capTop,
  inkW,
  fs = FS,
  drop = 53,
  r = 0.74,
  rise = false,
  out,
  frame,
}) => {
  if (frame < words[0].f) return null;
  if (out?.cut !== undefined && frame >= out.cut) return null;
  let opacity = 1;
  if (out?.fade) {
    opacity = interpolate(frame, out.fade, [1, 0], clamp);
    if (opacity <= 0) return null;
  }
  const text = words.map((w) => w.t).join(" ");
  const natural = measureText({
    text,
    fontFamily: POPPINS,
    fontSize: fs,
    fontWeight: "300",
  }).width;
  const scaleX = natural > 0 ? inkW / natural : 1;
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: capTop - CAP_OFFSET * fs,
        fontFamily: POPPINS,
        fontWeight: 300,
        fontSize: fs,
        lineHeight: 1,
        color: WHITE,
        whiteSpace: "pre",
        transform: `scaleX(${scaleX.toFixed(4)})`,
        transformOrigin: "left top",
        ...TEXT_SOFT,
        opacity: 0.97 * opacity,
      }}
    >
      {words.map((w, i) => (
        <span
          key={i}
          style={{
            display: "inline-block",
            whiteSpace: "pre",
            ...wordStyle(frame, w.f, drop, r, rise),
          }}
        >
          {w.t + (i < words.length - 1 ? " " : "")}
        </span>
      ))}
    </div>
  );
};

// ─── Scene 1: word drop-in, then per-character gaussian blur-out ───
// Chars blur out in place f49-65 with scattered stagger (measured).
const S1_WORDS: WordSpec[] = [
  { t: "Onchain", f: 1 },
  { t: "payroll", f: 5 },
  { t: "just", f: 9 },
  { t: "went", f: 13 },
];

const Scene1: React.FC<{ frame: number }> = ({ frame }) => {
  if (frame >= 66) return null;
  const text = S1_WORDS.map((w) => w.t).join(" ");
  const natural = measureText({
    text,
    fontFamily: POPPINS,
    fontSize: FS,
    fontWeight: "300",
  }).width;
  const scaleX = natural > 0 ? 726 / natural : 1;
  let ci = 0;
  return (
    <div
      style={{
        position: "absolute",
        left: 277,
        top: 331 - CAP_OFFSET * FS,
        fontFamily: POPPINS,
        fontWeight: 300,
        fontSize: FS,
        lineHeight: 1,
        color: WHITE,
        whiteSpace: "pre",
        transform: `scaleX(${scaleX.toFixed(4)})`,
        transformOrigin: "left top",
        ...TEXT_SOFT,
      }}
    >
      {S1_WORDS.map((w, wi) => {
        const ws = wordStyle(frame, w.f, 53, 0.74, false);
        const chars = (w.t + (wi < S1_WORDS.length - 1 ? " " : "")).split("");
        return (
          <span key={wi} style={{ display: "inline-block", whiteSpace: "pre", ...ws }}>
            {chars.map((c, k) => {
              // Scattered per-char blur-out f52-66 (comparator-retimed).
              const s = 52 + ((ci * 11 + 5) % 9);
              ci++;
              const blur = interpolate(frame, [s, s + 6], [0, 10], clamp);
              const op = interpolate(frame, [s, s + 6], [1, 0], clamp);
              return (
                <span
                  key={k}
                  style={{
                    display: "inline-block",
                    whiteSpace: "pre",
                    filter: blur > 0.2 ? `blur(${blur.toFixed(1)}px)` : undefined,
                    opacity: op,
                  }}
                >
                  {c}
                </span>
              );
            })}
          </span>
        );
      })}
    </div>
  );
};

// ─── Scene 2: PRIVATE — per-letter blur in / slow pre-roll / blur out ───
const PRIV: { ch: string; x: number }[] = [
  { ch: "P", x: 446 },
  { ch: "R", x: 508 },
  { ch: "I", x: 569 },
  { ch: "V", x: 588 },
  { ch: "A", x: 648 },
  { ch: "T", x: 711 },
  { ch: "E", x: 769 },
];
const PRIV_FS = 87; // cap-height 61px measured

const Scene2: React.FC<{ frame: number }> = ({ frame }) => {
  if (frame < 69 || frame >= 118) return null;
  return (
    <>
      {PRIV.map(({ ch, x }, i) => {
        const sIn = 69 + i;
        const sOut = 102 + i * 0.7;
        let blur: number;
        let op: number;
        if (frame < 89) {
          blur = interpolate(frame, [sIn, sIn + 3], [8, 0], clamp);
          op = interpolate(frame, [sIn, sIn + 2], [0, 1], clamp);
        } else if (frame < 102) {
          blur = interpolate(frame, [89, 101], [0, 2], clamp);
          op = 1;
        } else {
          blur = interpolate(frame, [sOut, sOut + 11], [2, 12], clamp);
          op = interpolate(frame, [sOut, sOut + 10], [1, 0], clamp);
        }
        if (op <= 0) return null;
        return (
          <span
            key={i}
            style={{
              position: "absolute",
              left: x - 6,
              top: 316 - CAP_OFFSET * PRIV_FS,
              fontFamily: POPPINS,
              fontWeight: 500,
              fontSize: PRIV_FS,
              lineHeight: 1,
              color: "#FDFDFD",
              filter: blur > 0.2 ? `blur(${blur.toFixed(1)}px)` : undefined,
              opacity: op,
            }}
          >
            {ch}
          </span>
        );
      })}
    </>
  );
};

// ─── All standard text lines (measured ink boxes + word start frames) ───
const LINES: LineSpec[] = [
  // Scene 3 — Introducing / AnomaPay / Business (hard cut f209)
  { words: [{ t: "Introducing", f: 123 }], x: 91, capTop: 257, inkW: 317, drop: 44, out: { cut: 209 } },
  { words: [{ t: "AnomaPay", f: 128 }], x: 88, capTop: 328, inkW: 310, drop: 44, out: { cut: 209 } },
  { words: [{ t: "Business", f: 133 }], x: 91, capTop: 393, inkW: 245, drop: 44, out: { cut: 209 } },
  // Scene 4 — Pay anyone (cut f258), anywhere (cut f308)
  { words: [{ t: "Pay", f: 212 }, { t: "anyone", f: 220 }], x: 71, capTop: 323, inkW: 322, out: { cut: 258 } },
  { words: [{ t: "anywhere", f: 266 }], x: 88, capTop: 330, inkW: 275, out: { cut: 308 } },
  // Scene 5 — In your preffered asset (typo is in the reference; cut f358)
  { words: [{ t: "In", f: 311 }, { t: "your", f: 315 }], x: 77, capTop: 275, inkW: 193, out: { cut: 358 } },
  { words: [{ t: "preffered", f: 319 }], x: 77, capTop: 339, inkW: 251, out: { cut: 358 } },
  { words: [{ t: "asset", f: 323 }], x: 75, capTop: 396, inkW: 145, out: { cut: 358 } },
  // Scene 6 — centered, rise+fade (cut f409)
  { words: [{ t: "without", f: 362 }, { t: "exposing", f: 366 }], x: 382, capTop: 299, inkW: 484, drop: 24, rise: true, out: { cut: 409 } },
  { words: [{ t: "company", f: 370 }, { t: "finances.", f: 374 }], x: 358, capTop: 366, inkW: 534, drop: 24, rise: true, out: { cut: 409 } },
  // Scene 7 — centered, rise+fade (cut f461)
  { words: [{ t: "Your", f: 412 }, { t: "workflow", f: 414 }, { t: "just", f: 414 }, { t: "went", f: 418 }], x: 301, capTop: 295, inkW: 678, drop: 24, rise: true, out: { cut: 461 } },
  { words: [{ t: "from", f: 420 }, { t: "hours", f: 422 }, { t: "to", f: 424 }, { t: "minutes.", f: 426 }], x: 310, capTop: 364, inkW: 657, drop: 24, rise: true, out: { cut: 461 } },
  // Scene 8 — Onboard / in seconds. (cut f565)
  { words: [{ t: "Onboard", f: 464 }], x: 72, capTop: 286, inkW: 238, drop: 50, out: { cut: 565 } },
  { words: [{ t: "in", f: 469 }, { t: "seconds.", f: 474 }], x: 73, capTop: 355, inkW: 313, drop: 50, out: { cut: 565 } },
  // Scene 9 — Batch / transactions. (cut f650)
  { words: [{ t: "Batch", f: 568 }], x: 55, capTop: 278, inkW: 156, drop: 50, out: { cut: 650 } },
  { words: [{ t: "transactions.", f: 576 }], x: 55, capTop: 349, inkW: 355, drop: 50, out: { cut: 650 } },
  // Scene 10 — Easily review / your monthly / outlflows. (typo real; fades f717-720)
  { words: [{ t: "Easily", f: 653 }, { t: "review", f: 656 }], x: 64, capTop: 269, inkW: 362, drop: 50, out: { fade: [716, 722] } },
  { words: [{ t: "your", f: 659 }, { t: "monthly", f: 662 }], x: 59, capTop: 334, inkW: 388, drop: 50, out: { fade: [716, 722] } },
  { words: [{ t: "outlflows.", f: 665 }], x: 62, capTop: 400, inkW: 273, drop: 50, out: { fade: [716, 722] } },
  // Scene 11 — centered (cut f764)
  { words: [{ t: "Confidential", f: 720 }, { t: "onchain", f: 722 }], x: 347, capTop: 305, inkW: 581, drop: 26, out: { cut: 764 } },
  { words: [{ t: "payroll", f: 725 }, { t: "made", f: 728 }, { t: "easy.", f: 731 }], x: 373, capTop: 373, inkW: 532, drop: 26, out: { cut: 764 } },
  // Scene 12 — top-center (fades f848-851)
  { words: [{ t: "AnomaPay", f: 766 }, { t: "Business", f: 769 }], x: 348, capTop: 129, inkW: 580, drop: 44, out: { fade: [848, 851] } },
  { words: [{ t: "Beta", f: 772 }, { t: "is", f: 775 }, { t: "Live", f: 778 }], x: 482, capTop: 198, inkW: 314, drop: 44, out: { fade: [848, 851] } },
  // Scene 13 — URL (holds to end; slower settle r=0.76; comparator: 9px
  // left, smaller x-height than the headline size)
  { words: [{ t: "anomapay.app/business", f: 861 }], x: 281, capTop: 318, inkW: 698, drop: 44, r: 0.76, fs: 51 },
];

// ─── Dashboard card (scene 3 = dash1 raster f203, scene 10 = dash10
// raster f712 — placeholder outline bars differ between the scenes).
// Bars: 5 bars x663-796 (video), w22, bottom y405, final heights
// [63,52,64,62,76], fill #53A88C, cap radius 6 (comparator-corrected).
// Cover patch shrunk to spare the chart label and y-axis ticks.
const DASH_BARS = { xs: [159, 187, 215, 243, 270], w: 22, bottom: 280, h: [63, 52, 64, 62, 76] };

const DashCard: React.FC<{ src: string; opacity: number; barsP: number; blur?: number }> = ({
  src,
  opacity,
  barsP,
  blur = 0,
}) => {
  if (opacity <= 0) return null;
  return (
    <div
      style={{
        position: "absolute",
        left: 504,
        top: 125,
        width: 710,
        height: 470,
        opacity,
        overflow: "hidden",
        filter: blur > 0.2 ? `blur(${blur.toFixed(1)}px)` : undefined,
      }}
    >
      <Img src={asset(src)} style={{ position: "absolute", width: 710, height: 470 }} />
      <div
        style={{ position: "absolute", left: 158, top: 197, width: 142, height: 85, backgroundColor: "#FCFCFC" }}
      />
      {DASH_BARS.xs.map((bx, i) => {
        const h = DASH_BARS.h[i] * barsP;
        if (h < 1) return null;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: bx,
              top: DASH_BARS.bottom - h,
              width: DASH_BARS.w,
              height: h,
              backgroundColor: "#53A88C",
              borderRadius: "6px 6px 0 0",
            }}
          />
        );
      })}
    </div>
  );
};

// Scene 3: linear fade-in f128-152 with resolving blur (ref content is
// still soft mid-fade — comparator), bars grow f137-203 (measured
// soft-S curve), fast blur+fade out f203-207 into scene 4.
const Scene3Dash: React.FC<{ frame: number }> = ({ frame }) => {
  if (frame < 128 || frame >= 208) return null;
  const opacity =
    interpolate(frame, [127, 152], [0, 1], clamp) *
    interpolate(frame, [203, 207], [1, 0], clamp);
  const barsP = interpolate(
    frame,
    [137, 140, 150, 160, 170, 180, 190, 200, 203],
    [0, 0.21, 0.29, 0.41, 0.57, 0.72, 0.87, 0.97, 1],
    clamp,
  );
  const blurIn = interpolate(frame, [128, 158], [3.5, 0], clamp);
  const blurOut = interpolate(frame, [203, 207], [0, 6], clamp);
  return <DashCard src="dash1" opacity={opacity} barsP={barsP} blur={Math.max(blurIn, blurOut)} />;
};

// Scene 10: crossfades in over the batch card f641-666 (linear), bars
// grow f663-719 (p=0.5@680, 0.945@712 measured), card fades out
// f716-722 (ref still at 26% opacity at f720 — comparator).
const Scene10Dash: React.FC<{ frame: number }> = ({ frame }) => {
  if (frame < 641 || frame >= 723) return null;
  const opacity =
    interpolate(frame, [641, 666], [0, 1], clamp) *
    interpolate(frame, [716, 722], [1, 0], clamp);
  const barsP = interpolate(frame, [663, 680, 712, 719], [0, 0.5, 0.945, 1], clamp);
  return <DashCard src="dash10" opacity={opacity} barsP={barsP} />;
};

// ─── Scene 4/5 table card: raster state machine ───
// Zoom (f206-216), name typing (f219-252), category typing (f267-290)
// and column pan (f324-334) are 2-frame raster states cut in sequence;
// row swaps at f299/f314 are single-frame cuts in the reference.
const TABLE_STATES: [number, string][] = [
  [205, "t206"], [207, "t207"], [208, "t208"], [209, "t209"], [210, "t210"],
  [211, "t211"], [212, "t212"], [213, "t213"], [214, "t214"], [215, "t215"],
  [216, "t216"], [217, "t217"], [218, "t219"], [228, "t228"], [235, "t235"],
  [242, "t242"], [247, "t247"], [251, "t252"], [254, "table-a"], [266, "t267"],
  [270, "t270"], [272, "t272"], [274, "t274"], [276, "t276"], [278, "t278"],
  [280, "t280"], [282, "t282"], [284, "t284"], [286, "t286"], [288, "t288"],
  [290, "t290"], [291, "table-b"], [299, "table-2rows"], [314, "table-c"],
  [324, "t324"], [325, "t325"], [326, "t326"], [327, "t327"], [328, "t328"],
  [329, "t329"], [330, "t330"], [331, "t331"], [332, "t332"], [333, "t333"],
  [334, "t334"], [335, "t335"], [336, "table-token"],
];

const Scene4Table: React.FC<{ frame: number }> = ({ frame }) => {
  if (frame < 205 || frame >= 358) return null;
  let src = TABLE_STATES[0][1];
  for (const [f, s] of TABLE_STATES) {
    if (frame >= f) src = s;
    else break;
  }
  const opacity = interpolate(frame, [204, 207], [0, 1], clamp);
  return (
    <Img
      src={asset(src)}
      style={{ position: "absolute", left: 506, top: 120, width: 710, height: 475, opacity }}
    />
  );
};

// ─── Scene 8: onboarding card (f464-576) ───
// Sub-states crossfade in sequence over a fixed card frame; the green
// dot is drawn (scales in f541-549, expands into the panel f551-556),
// the SUCCESS raster fades in over it f552-556.
const OB_CHAIN: { src: string; fadeIn: [number, number] }[] = [
  { src: "ob-s1", fadeIn: [463, 464] },
  { src: "ob-s2a", fadeIn: [471, 474] },
  { src: "ob-s2mid", fadeIn: [491, 494] },
  { src: "ob-s2b", fadeIn: [495, 498] },
  { src: "ob-s3", fadeIn: [507, 510] },
  { src: "ob-s3e", fadeIn: [533, 536] },
];

const Scene8Onboard: React.FC<{ frame: number }> = ({ frame }) => {
  if (frame < 464 || frame >= 577) return null;
  const cardOpacity = interpolate(frame, [571, 576], [1, 0], clamp);
  if (cardOpacity <= 0) return null;
  const dotD = interpolate(
    frame,
    [541, 544, 547, 551, 552, 553, 554, 555, 556],
    [12, 44, 42, 42, 114, 168, 241, 260, 266],
    clamp,
  );
  const dotR = frame < 551 ? dotD / 2 : interpolate(frame, [551, 556], [dotD / 2, 16], clamp);
  const successOp = interpolate(frame, [552, 556], [0, 1], clamp);
  return (
    <div
      style={{ position: "absolute", left: 504, top: 122, width: 711, height: 477, opacity: cardOpacity }}
    >
      {OB_CHAIN.map(({ src, fadeIn }) => {
        const op = interpolate(frame, fadeIn, [0, 1], clamp);
        if (op <= 0) return null;
        return (
          <Img
            key={src}
            src={asset(src)}
            style={{ position: "absolute", width: 711, height: 477, opacity: op }}
          />
        );
      })}
      {frame >= 541 && successOp < 1 && (
        <div
          style={{
            position: "absolute",
            // dot center video (853,379) → card-local (349,257)
            left: 349 - dotD / 2,
            top: 257 - dotD / 2,
            width: dotD,
            height: dotD,
            borderRadius: dotR,
            backgroundColor: "#BCFF41",
          }}
        />
      )}
      {successOp > 0 && (
        <Img
          src={asset("ob-s5")}
          style={{ position: "absolute", width: 711, height: 477, opacity: successOp }}
        />
      )}
    </div>
  );
};

// ─── Scene 9: batch transactions card (f571-666) ───
// Hard state swaps measured: A (Edit/Process) → B f584 (Back-to-overview,
// card shrinks — baked in crop) → highlights f594 (all bars appear at
// once, fully formed, static). Dashboard crossfades over it f641-666.
const Scene9Batch: React.FC<{ frame: number }> = ({ frame }) => {
  if (frame < 571 || frame >= 666) return null;
  if (frame >= 594) {
    return (
      <Img
        src={asset("batch-hl")}
        style={{ position: "absolute", left: 505, top: 122, width: 711, height: 472 }}
      />
    );
  }
  const src = frame >= 584 ? "batch-b" : "batch-a";
  return (
    <Img
      src={asset(src)}
      style={{ position: "absolute", left: 504, top: 121, width: 712, height: 478 }}
    />
  );
};

// ─── Scene 12: full-width dashboard (f769-848) ───
// Linear fade-in over 25f, bars grow f780-844 (measured curve), the
// Overview-pill highlight arrives f810-817 (pill-off raster fades out).
const D12_BARS = { xs: [250, 296, 340, 384, 428], w: 32, h: [85, 65, 85, 83, 103] };

const Scene12Dash: React.FC<{ frame: number }> = ({ frame }) => {
  if (frame < 769 || frame >= 849) return null;
  const opacity =
    interpolate(frame, [769, 793], [0, 1], clamp) *
    interpolate(frame, [845, 848], [1, 0], clamp);
  if (opacity <= 0) return null;
  // Growth delayed ~3 frames vs first measurement (comparator: at f790
  // the reference bars are still tiny nubs).
  const p = interpolate(
    frame,
    [783, 789, 803, 813, 823, 833, 841, 846],
    [0, 0.12, 0.26, 0.46, 0.66, 0.82, 0.96, 1],
    clamp,
  );
  const pillOff = interpolate(frame, [810, 817], [1, 0], clamp);
  return (
    <div
      style={{ position: "absolute", left: 83, top: 291, width: 1114, height: 429, opacity, overflow: "hidden" }}
    >
      <Img src={asset("dash12")} style={{ position: "absolute", width: 1114, height: 429 }} />
      <div
        style={{ position: "absolute", left: 245, top: 317, width: 224, height: 112, backgroundColor: "#FCFCFC" }}
      />
      {D12_BARS.xs.map((bx, i) => {
        const h = D12_BARS.h[i] * p;
        if (h < 1) return null;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: bx,
              top: 429 - h,
              width: D12_BARS.w,
              height: h + 20,
              backgroundColor: "#4CA88B",
              borderRadius: "12px 12px 0 0",
            }}
          />
        );
      })}
      {pillOff > 0 && (
        <Img
          src={asset("pill-off")}
          style={{ position: "absolute", left: 15, top: 109, width: 141, height: 29, opacity: pillOff }}
        />
      )}
    </div>
  );
};

export const AnomaComposition: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <Silk frame={frame} />
      <Scene3Dash frame={frame} />
      <Scene4Table frame={frame} />
      <Scene8Onboard frame={frame} />
      <Scene9Batch frame={frame} />
      <Scene10Dash frame={frame} />
      <Scene12Dash frame={frame} />
      <Scene1 frame={frame} />
      <Scene2 frame={frame} />
      {LINES.map((l, i) => (
        <Line key={i} {...l} frame={frame} />
      ))}
    </AbsoluteFill>
  );
};

export const anomaReplicateMeta = {
  id: "Anoma-Replicate",
  component: AnomaComposition,
  width: 1280,
  height: 720,
  fps: FPS,
  durationInFrames: DURATION,
};
