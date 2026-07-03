import React from "react";
import {
  AbsoluteFill,
  Audio,
  Img,
  interpolate,
  Loop,
  OffthreadVideo,
  staticFile,
  useCurrentFrame,
} from "remotion";
import { measureText } from "@remotion/layout-utils";
import {
  CAP_OFFSET,
  clamp,
  DURATION,
  FPS,
  FS,
  POPPINS,
  wordStyle,
  type WordSpec,
} from "./AnomaComposition";
import { CrxAppScenes } from "./CrxAppCards";

// ═══════════════════════════════════════════════════════════════
// CRX cut of the Anoma replica: same cards and motion physics; the
// silk plates are swapped for the bridge.xyz hero wave video and
// the copy changes. New lines are set at
// natural width (no ink-box scaleX — there is no reference ink to
// match), left-aligned at the original x positions or centered on
// the frame axis (640).
//
// The composition renders at 4K (3840×2160); the measured 1280×720
// coordinate system is preserved inside a 3× scaler so every frozen
// timing and position survives untouched. Text, cards and SVG marks
// rasterize at the full 4K raster. The wave video (1080p source,
// enhanced and lanczos-upscaled to 4K offline) mounts OUTSIDE the
// scaler, 1:1.
// ═══════════════════════════════════════════════════════════════

const CENTER = 640;
const HD_SCALE = 3;

// Bridge sets its own headline on this water in near-black ink, not
// white — the copy follows suit. Ink value from the Apple style table.
const INK = "#1D1D1F";

// ─── Wave background: the bridge.xyz hero water, looped. The 4K cut
// (bridge-wave-4k.mp4) is the 1080p source denoised, lanczos-scaled
// to 3840×2160, debanded, gently sharpened and re-grained — the
// grain hides what remains of the source compression without the
// softness of a blur. It mounts full-bleed outside the coordinate
// scaler, 1:1 with the 4K raster. The end fade-to-black is pulled
// into the empty beat after scene 12 (f851-864) so the end lockup
// lands on black, never on bright water.
const WAVE_SECONDS = 18; // source clip length

const WaveBackground: React.FC<{ frame: number }> = ({ frame }) => {
  const black = interpolate(frame, [851, 864], [0, 1], clamp);
  return (
    <AbsoluteFill>
      <Loop durationInFrames={WAVE_SECONDS * FPS}>
        <OffthreadVideo
          muted
          src={staticFile("crx-assets/bridge-wave-4k.mp4")}
          style={{
            position: "absolute",
            width: 1280 * HD_SCALE,
            height: 720 * HD_SCALE,
            objectFit: "cover",
          }}
        />
      </Loop>
      {/* Quiet vignette: settles the frame edges and lifts contrast
          under the left-anchored ink without touching the center. */}
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse 120% 100% at 50% 45%, rgba(0,0,0,0) 62%, rgba(0,0,0,0.10) 100%)",
        }}
      />
      {black > 0 && (
        <AbsoluteFill style={{ backgroundColor: "#000", opacity: black }} />
      )}
    </AbsoluteFill>
  );
};

type CrxLineSpec = {
  words: WordSpec[];
  x?: number; // left edge; omit to center on 640
  capTop: number;
  fs?: number;
  drop?: number;
  r?: number;
  rise?: boolean;
  out?: { cut?: number; fade?: [number, number] };
};

const CrxLine: React.FC<CrxLineSpec & { frame: number }> = ({
  words,
  x,
  capTop,
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
  const left = x ?? CENTER - natural / 2;
  return (
    <div
      style={{
        position: "absolute",
        left,
        top: capTop - CAP_OFFSET * fs,
        fontFamily: POPPINS,
        fontWeight: 300,
        fontSize: fs,
        lineHeight: 1,
        color: INK,
        whiteSpace: "pre",
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

// ─── Scene 1: "Managing FX risk just became" — word drop-in, then
// per-character gaussian blur-out (same physics as the reference).
// Words walk the 16th-note grid from the downbeat; "became" lands on
// the f19 snare. Beat map: docs/crx-anoma-beat-sync.md.
const S1_WORDS: WordSpec[] = [
  { t: "Managing", f: 1 },
  { t: "FX", f: 6 },
  { t: "risk", f: 10 },
  { t: "just", f: 15 },
  { t: "became", f: 19 },
];

const CrxScene1: React.FC<{ frame: number }> = ({ frame }) => {
  if (frame >= 66) return null;
  const text = S1_WORDS.map((w) => w.t).join(" ");
  const natural = measureText({
    text,
    fontFamily: POPPINS,
    fontSize: FS,
    fontWeight: "300",
  }).width;
  let ci = 0;
  return (
    <div
      style={{
        position: "absolute",
        left: CENTER - natural / 2,
        top: 331 - CAP_OFFSET * FS,
        fontFamily: POPPINS,
        fontWeight: 300,
        fontSize: FS,
        lineHeight: 1,
        color: INK,
        whiteSpace: "pre",
        opacity: 0.97,
      }}
    >
      {S1_WORDS.map((w, wi) => {
        const ws = wordStyle(frame, w.f, 53, 0.74, false);
        const chars = (w.t + (wi < S1_WORDS.length - 1 ? " " : "")).split("");
        return (
          <span key={wi} style={{ display: "inline-block", whiteSpace: "pre", ...ws }}>
            {chars.map((c, k) => {
              // Scatter centered on the f55 snare — the line dissolves on the hit.
              const s = 51 + ((ci * 11 + 5) % 9);
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

// ─── Scene 2: "Easy" — per-letter blur in / slow pre-roll / blur out,
// the PRIVATE beat of the reference. Letters laid out at natural
// advance widths, block centered on 640.
const EASY = "Easy".split("");
const EASY_FS = 87;

const CrxScene2: React.FC<{ frame: number }> = ({ frame }) => {
  if (frame < 69 || frame >= 118) return null;
  const widths = EASY.map(
    (ch) =>
      measureText({ text: ch, fontFamily: POPPINS, fontSize: EASY_FS, fontWeight: "500" })
        .width,
  );
  const total = widths.reduce((a, b) => a + b, 0);
  let cx = CENTER - total / 2;
  return (
    <>
      {EASY.map((ch, i) => {
        const x = cx;
        cx += widths[i];
        // Letter cascade rides the 16ths into the f74 beat ("a" on the hit).
        const sIn = 73 + i * 2;
        const sOut = 102 + i * 1.2;
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
              left: x,
              top: 316 - CAP_OFFSET * EASY_FS,
              fontFamily: POPPINS,
              fontWeight: 500,
              fontSize: EASY_FS,
              lineHeight: 1,
              color: INK,
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

// ─── All standard text lines (scene mount windows inherited from the
// reference cut; word entries quantized to the 97.97 BPM grid —
// first word on a beat/8th, cascades on 16ths, line-enders on the
// snare. Map: docs/crx-anoma-beat-sync.md) ───
const LINES: CrxLineSpec[] = [
  // Scene 3 — Introducing / CRX; "CRX" on the f128 snare (hard cut f209)
  { words: [{ t: "Introducing", f: 124 }], x: 91, capTop: 257, drop: 44, out: { cut: 209 } },
  { words: [{ t: "CRX", f: 128 }], x: 88, capTop: 328, drop: 44, out: { cut: 209 } },
  // Scene 4 — Access / rate locks (cut f258); "locks" on the f221 beat.
  // "In Any Corridor" walks quarters into the f277 snare (cut f308).
  { words: [{ t: "Access", f: 212 }], x: 71, capTop: 291, out: { cut: 258 } },
  { words: [{ t: "rate", f: 217 }, { t: "locks", f: 221 }], x: 71, capTop: 355, out: { cut: 258 } },
  { words: [{ t: "In", f: 267 }, { t: "Any", f: 272 }, { t: "Corridor", f: 277 }], x: 55, capTop: 330, out: { cut: 308 } },
  // Scene 5 — "your" on the f313 snare with the tenor click;
  // "notional" on the f332 beat as the typing starts. Cut f358.
  { words: [{ t: "At", f: 309 }, { t: "your", f: 313 }], x: 77, capTop: 275, out: { cut: 358 } },
  { words: [{ t: "preferred", f: 318 }], x: 77, capTop: 339, out: { cut: 358 } },
  { words: [{ t: "date", f: 322 }], x: 75, capTop: 396, out: { cut: 358 } },
  { words: [{ t: "and", f: 327 }, { t: "notional", f: 332 }], x: 75, capTop: 460, out: { cut: 358 } },
  // Scene 6 — centered, rise+fade; "paying" on the f368 beat (cut f409)
  { words: [{ t: "Without", f: 364 }, { t: "paying", f: 368 }], capTop: 299, drop: 24, rise: true, out: { cut: 409 } },
  { words: [{ t: "the", f: 373 }, { t: "middleman", f: 377 }], capTop: 366, drop: 24, rise: true, out: { cut: 409 } },
  // Scene 7 — centered, rise+fade; "infrastructure" on the f423 snare (cut f461)
  { words: [{ t: "From", f: 410 }, { t: "legacy", f: 412 }, { t: "banks,", f: 415 }], capTop: 295, drop: 24, rise: true, out: { cut: 461 } },
  { words: [{ t: "to", f: 419 }, { t: "modern", f: 421 }, { t: "infrastructure", f: 423 }], capTop: 364, drop: 24, rise: true, out: { cut: 461 } },
  // Scene 8 — Onboard / in days on the quarter grid (cut f565)
  { words: [{ t: "Onboard", f: 465 }], x: 72, capTop: 286, drop: 50, out: { cut: 565 } },
  { words: [{ t: "in", f: 469 }, { t: "days", f: 474 }], x: 73, capTop: 355, drop: 50, out: { cut: 565 } },
  // Scene 9 — "Access" on the f570 snare; "dealers" on the f589 beat
  // as the dealer quotes land (cut f650)
  { words: [{ t: "Access", f: 570 }, { t: "liquidity", f: 575 }], x: 55, capTop: 278, drop: 50, out: { cut: 650 } },
  { words: [{ t: "from", f: 579 }, { t: "multiple", f: 584 }], x: 55, capTop: 349, drop: 50, out: { cut: 650 } },
  { words: [{ t: "dealers", f: 589 }], x: 55, capTop: 420, drop: 50, out: { cut: 650 } },
  // Scene 10 — "confidence" on the f662 beat (fades f716-722)
  { words: [{ t: "Comply", f: 653 }, { t: "with", f: 657 }], x: 64, capTop: 269, drop: 50, out: { fade: [716, 722] } },
  { words: [{ t: "confidence", f: 662 }], x: 59, capTop: 334, drop: 50, out: { fade: [716, 722] } },
  // Scene 11 — centered; "simple." on the f736 beat (cut f764)
  { words: [{ t: "Cross-border", f: 722 }, { t: "business", f: 726 }], capTop: 305, drop: 26, out: { cut: 764 } },
  { words: [{ t: "risk,", f: 731 }, { t: "made", f: 733 }, { t: "simple.", f: 736 }], capTop: 373, drop: 26, out: { cut: 764 } },
  // Scene 12 — top-center; "Sandbox" on the f772 snare (fades f848-851)
  { words: [{ t: "CRX", f: 768 }, { t: "Sandbox", f: 772 }], capTop: 129, drop: 44, out: { fade: [848, 851] } },
  { words: [{ t: "is", f: 777 }, { t: "Live.", f: 782 }], capTop: 198, drop: 44, out: { fade: [848, 851] } },
];

// ─── End card lockup: the institutional reveal ───
// The mark arrives alone on the darkening water — it rolls in with a
// long exponential settle, no bounce — holds a beat on black, then
// glides left as the wordmark slides out from behind it to the
// right. Both movements share one curve, so the lockup opens like a
// single object. Everything holds to the end; there is no URL.
//
// Geometry is measured from crx-lockup-white.png (1600×484): mark
// x108–389 / y84–398, letters x563–1534. The mark itself is redrawn
// as SVG so the roll stays vector-crisp; the wordmark keeps the
// brand PNG, revealed through a clip window.
const LOCKUP_W = 520;
const LK = LOCKUP_W / 1600; // px-of-PNG → local px
const LOCKUP_H = 484 * LK; // 157.3
const MARK_CX = 248.5 * LK; // mark center, rel lockup left
const MARK_CY = 241 * LK; // mark center, rel lockup top
const MARK_SIZE = ((398 - 84) * LK) / 0.95; // SVG strokes span 95/100 units
const NAME_CLIP = 389 * LK + 2; // window left edge: mark's right edge
const NAME_SLIDE = 1534 * LK - NAME_CLIP + 6; // fully hidden → in place

const LOCKUP_TOP = 344.7 - MARK_CY; // mark rides the frame's optical center
const LEFT_FINAL = CENTER - LOCKUP_W / 2;
const LEFT_ALONE = CENTER - MARK_CX; // phase 1: mark alone, centered

// The mark arrives on the f864 snare — the first hit after the water
// has gone fully black — and the wordmark reveals on the f901 snare.
const MARK_IN = 864;
const REVEAL = 901;
const REVEAL_DUR = 20;

const EndMark: React.FC<{ size: number }> = ({ size }) => (
  <svg viewBox="0 0 100 100" width={size} height={size}>
    <defs>
      <linearGradient id="crxEndMarkV" gradientUnits="userSpaceOnUse" x1="50" y1="8" x2="50" y2="92">
        <stop offset="0" stopColor="#2AD4BB" />
        <stop offset="0.5" stopColor="#1CC8C6" />
        <stop offset="1" stopColor="#19B6DD" />
      </linearGradient>
    </defs>
    <g fill="none" stroke="url(#crxEndMarkV)" strokeWidth="11" strokeLinecap="round">
      <line x1="50" y1="8" x2="50" y2="92" />
      <line x1="13.6" y1="71" x2="86.4" y2="29" />
      <line x1="13.6" y1="29" x2="86.4" y2="71" />
    </g>
  </svg>
);

const EndLockup: React.FC<{ frame: number }> = ({ frame }) => {
  if (frame < MARK_IN) return null;
  const dt = frame - MARK_IN;
  const roll = -110 * Math.pow(0.86, dt); // degrees; settles, never bounces
  const markOp = Math.min(dt / 10, 1);
  const e =
    frame < REVEAL
      ? 0
      : 1 - Math.pow(1 - Math.min((frame - REVEAL) / REVEAL_DUR, 1), 3);
  const left = LEFT_ALONE + (LEFT_FINAL - LEFT_ALONE) * e;
  const tx = -NAME_SLIDE * (1 - e);
  return (
    <div
      style={{
        position: "absolute",
        left,
        top: LOCKUP_TOP,
        width: LOCKUP_W,
        height: LOCKUP_H,
      }}
    >
      <div
        style={{
          position: "absolute",
          left: MARK_CX - MARK_SIZE / 2,
          top: MARK_CY - MARK_SIZE / 2,
          width: MARK_SIZE,
          height: MARK_SIZE,
          opacity: markOp,
          transform: `rotate(${roll.toFixed(2)}deg)`,
          transformOrigin: "50% 50%",
        }}
      >
        <EndMark size={MARK_SIZE} />
      </div>
      {e > 0 && (
        <div
          style={{
            position: "absolute",
            left: NAME_CLIP,
            top: 0,
            width: LOCKUP_W - NAME_CLIP + 8,
            height: LOCKUP_H,
            overflow: "hidden",
          }}
        >
          <Img
            src={staticFile("crx-assets/crx-lockup-white.png")}
            style={{
              position: "absolute",
              left: -NAME_CLIP,
              top: 0,
              width: LOCKUP_W,
              height: LOCKUP_H,
              transform: `translateX(${tx.toFixed(2)}px)`,
            }}
          />
        </div>
      )}
    </div>
  );
};

export const CrxAnomaComposition: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <Audio
        src={staticFile("crx-assets/loosin-up.mp3")}
        volume={(f) =>
          interpolate(f, [0, 12, DURATION - 45, DURATION - 6], [0, 1, 1, 0], clamp)
        }
      />
      <WaveBackground frame={frame} />
      <AbsoluteFill
        style={{
          width: 1280,
          height: 720,
          transform: `scale(${HD_SCALE})`,
          transformOrigin: "top left",
        }}
      >
        <CrxAppScenes frame={frame} />
        <CrxScene1 frame={frame} />
        <CrxScene2 frame={frame} />
        {LINES.map((l, i) => (
          <CrxLine key={i} {...l} frame={frame} />
        ))}
        <EndLockup frame={frame} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export const crxAnomaMeta = {
  id: "CRX-Anoma",
  component: CrxAnomaComposition,
  width: 1280 * HD_SCALE,
  height: 720 * HD_SCALE,
  fps: FPS,
  durationInFrames: DURATION,
};
