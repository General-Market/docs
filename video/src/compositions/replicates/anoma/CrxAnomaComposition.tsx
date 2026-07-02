import React from "react";
import {
  AbsoluteFill,
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
  Scene10Dash,
  Scene12Dash,
  Scene3Dash,
  Scene4Table,
  Scene8Onboard,
  Scene9Batch,
  TEXT_SOFT,
  WHITE,
  wordStyle,
  type WordSpec,
} from "./AnomaComposition";

// ═══════════════════════════════════════════════════════════════
// CRX cut of the Anoma replica: same cards and motion physics; the
// silk plates are swapped for the bridge.xyz hero wave video and
// the copy changes. New lines are set at
// natural width (no ink-box scaleX — there is no reference ink to
// match), left-aligned at the original x positions or centered on
// the frame axis (640).
// ═══════════════════════════════════════════════════════════════

const CENTER = 640;

// ─── Wave background: the bridge.xyz hero water, looped, shown raw.
// The end fade-to-black (f861-901) is inherited from the Silk timing
// so the white end lockup still lands on black.
const WAVE_SECONDS = 18; // source clip length

const WaveBackground: React.FC<{ frame: number }> = ({ frame }) => {
  const black = interpolate(frame, [861, 870, 901], [0, 0.26, 1], clamp);
  return (
    <AbsoluteFill>
      <Loop durationInFrames={WAVE_SECONDS * FPS}>
        <OffthreadVideo
          muted
          src={staticFile("crx-assets/bridge-wave.mp4")}
          style={{
            position: "absolute",
            width: 1280,
            height: 720,
            objectFit: "cover",
          }}
        />
      </Loop>
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
        color: WHITE,
        whiteSpace: "pre",
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

// ─── Scene 1: "Managing FX risk just became" — word drop-in, then
// per-character gaussian blur-out (same physics as the reference).
const S1_WORDS: WordSpec[] = [
  { t: "Managing", f: 1 },
  { t: "FX", f: 5 },
  { t: "risk", f: 9 },
  { t: "just", f: 13 },
  { t: "became", f: 17 },
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
        color: WHITE,
        whiteSpace: "pre",
        ...TEXT_SOFT,
      }}
    >
      {S1_WORDS.map((w, wi) => {
        const ws = wordStyle(frame, w.f, 53, 0.74, false);
        const chars = (w.t + (wi < S1_WORDS.length - 1 ? " " : "")).split("");
        return (
          <span key={wi} style={{ display: "inline-block", whiteSpace: "pre", ...ws }}>
            {chars.map((c, k) => {
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
        const sIn = 69 + i * 2;
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

// ─── All standard text lines (scene timings inherited from the
// reference cut; copy remapped to the CRX script) ───
const LINES: CrxLineSpec[] = [
  // Scene 3 — Introducing / CRX (hard cut f209)
  { words: [{ t: "Introducing", f: 123 }], x: 91, capTop: 257, drop: 44, out: { cut: 209 } },
  { words: [{ t: "CRX", f: 128 }], x: 88, capTop: 328, drop: 44, out: { cut: 209 } },
  // Scene 4 — Access / rate locks (cut f258), In Any Corridor (cut f308)
  { words: [{ t: "Access", f: 212 }], x: 71, capTop: 291, out: { cut: 258 } },
  { words: [{ t: "rate", f: 216 }, { t: "locks", f: 220 }], x: 71, capTop: 355, out: { cut: 258 } },
  { words: [{ t: "In", f: 266 }, { t: "Any", f: 270 }, { t: "Corridor", f: 274 }], x: 88, capTop: 330, out: { cut: 308 } },
  // Scene 5 — At your preferred date; "and notional" lands with the
  // table's token-column swap (pan f324-336). Cut f358.
  { words: [{ t: "At", f: 311 }, { t: "your", f: 315 }], x: 77, capTop: 275, out: { cut: 358 } },
  { words: [{ t: "preferred", f: 319 }], x: 77, capTop: 339, out: { cut: 358 } },
  { words: [{ t: "date", f: 323 }], x: 75, capTop: 396, out: { cut: 358 } },
  { words: [{ t: "and", f: 326 }, { t: "notional", f: 330 }], x: 75, capTop: 460, out: { cut: 358 } },
  // Scene 6 — centered, rise+fade (cut f409)
  { words: [{ t: "Without", f: 362 }, { t: "paying", f: 366 }], capTop: 299, drop: 24, rise: true, out: { cut: 409 } },
  { words: [{ t: "the", f: 370 }, { t: "middleman", f: 374 }], capTop: 366, drop: 24, rise: true, out: { cut: 409 } },
  // Scene 7 — centered, rise+fade (cut f461)
  { words: [{ t: "From", f: 412 }, { t: "legacy", f: 414 }, { t: "banks,", f: 416 }], capTop: 295, drop: 24, rise: true, out: { cut: 461 } },
  { words: [{ t: "to", f: 420 }, { t: "modern", f: 422 }, { t: "infrastructure", f: 424 }], capTop: 364, drop: 24, rise: true, out: { cut: 461 } },
  // Scene 8 — Onboard / in days (cut f565)
  { words: [{ t: "Onboard", f: 464 }], x: 72, capTop: 286, drop: 50, out: { cut: 565 } },
  { words: [{ t: "in", f: 469 }, { t: "days", f: 474 }], x: 73, capTop: 355, drop: 50, out: { cut: 565 } },
  // Scene 9 — Access liquidity / from multiple / dealers (cut f650)
  { words: [{ t: "Access", f: 568 }, { t: "liquidity", f: 572 }], x: 55, capTop: 278, drop: 50, out: { cut: 650 } },
  { words: [{ t: "from", f: 576 }, { t: "multiple", f: 580 }], x: 55, capTop: 349, drop: 50, out: { cut: 650 } },
  { words: [{ t: "dealers", f: 584 }], x: 55, capTop: 420, drop: 50, out: { cut: 650 } },
  // Scene 10 — Comply with / confidence (fades f716-722)
  { words: [{ t: "Comply", f: 653 }, { t: "with", f: 656 }], x: 64, capTop: 269, drop: 50, out: { fade: [716, 722] } },
  { words: [{ t: "confidence", f: 659 }], x: 59, capTop: 334, drop: 50, out: { fade: [716, 722] } },
  // Scene 11 — centered (cut f764)
  { words: [{ t: "Cross-border", f: 720 }, { t: "business", f: 722 }], capTop: 305, drop: 26, out: { cut: 764 } },
  { words: [{ t: "risk,", f: 725 }, { t: "made", f: 728 }, { t: "simple.", f: 731 }], capTop: 373, drop: 26, out: { cut: 764 } },
  // Scene 12 — top-center (fades f848-851)
  { words: [{ t: "CRX", f: 766 }, { t: "Sandbox", f: 769 }], capTop: 129, drop: 44, out: { fade: [848, 851] } },
  { words: [{ t: "is", f: 772 }, { t: "Live.", f: 775 }], capTop: 198, drop: 44, out: { fade: [848, 851] } },
  // Scene 13 — URL (holds to end; slower settle, smaller size)
  { words: [{ t: "app.crx.com/swap", f: 861 }], capTop: 318, drop: 44, r: 0.76, fs: 51 },
];

// ─── End card lockup: settles in above the URL with the same word
// physics (drop 44, r 0.76) as the wave fades to black.
const LOGO_W = 380;
const LOGO_H = 115; // 6605:2000 source aspect

const EndLogo: React.FC<{ frame: number }> = ({ frame }) => {
  const start = 864;
  if (frame < start) return null;
  const dt = frame - start;
  const off = 44 * Math.pow(0.76, dt);
  const opacity = Math.min((dt + 1) / 3, 1);
  return (
    <Img
      src={staticFile("crx-assets/crx-lockup-white.png")}
      style={{
        position: "absolute",
        left: CENTER - LOGO_W / 2,
        top: 155,
        width: LOGO_W,
        height: LOGO_H,
        transform: `translateY(${(-off).toFixed(2)}px)`,
        opacity,
      }}
    />
  );
};

export const CrxAnomaComposition: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <WaveBackground frame={frame} />
      <Scene3Dash frame={frame} />
      <Scene4Table frame={frame} />
      <Scene8Onboard frame={frame} />
      <Scene9Batch frame={frame} />
      <Scene10Dash frame={frame} />
      <Scene12Dash frame={frame} />
      <CrxScene1 frame={frame} />
      <CrxScene2 frame={frame} />
      {LINES.map((l, i) => (
        <CrxLine key={i} {...l} frame={frame} />
      ))}
      <EndLogo frame={frame} />
    </AbsoluteFill>
  );
};

export const crxAnomaMeta = {
  id: "CRX-Anoma",
  component: CrxAnomaComposition,
  width: 1280,
  height: 720,
  fps: FPS,
  durationInFrames: DURATION,
};
