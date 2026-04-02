// Source: https://codepen.io/GreenSock/full/gagNeR
import React, { useMemo } from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  interpolate,
} from "remotion";

/**
 * 1:1 reproduction of GreenSock's SplitText character animation demo (gagNeR).
 *
 * The original: a dark canvas with centered quote text. SplitText splits each
 * quote into individual characters. A TimelineMax cycles through 4 quotes in
 * an infinite loop. Each quote animates IN with per-character stagger —
 * characters fly up from below with opacity: 0, rotationX: 80deg, y: 80,
 * using Back.easeOut. After a hold, characters animate OUT — opacity: 0,
 * rotationX: 80deg, y: -80, Back.easeIn. The next quote follows immediately.
 *
 * Font: bold sans-serif, white on near-black (#0e100f). Perspective on the
 * container gives the rotationX its 3D depth. Each character is display:
 * inline-block for independent transforms. Stagger: 0.01s per character in,
 * 0.008s per character out. The cycle repeats seamlessly.
 */

// ── Quotes (matching the original pen) ────────────────────────────────────────

const QUOTES = [
  "SplitText makes it easy to break apart the text in an HTML element so that each character, word, and/or line is wrapped in its own <div>.",
  "That means you can create all sorts of interesting animations using the stagger property in GSAP.",
  "Now you can easily animate text in ways that used to be extremely difficult.",
  "SplitText is a membership benefit of Club GreenSock.",
];

// ── Timing (frames at 30fps) ──────────────────────────────────────────────────

const CHAR_IN_DURATION = 18; // frames for each char to complete its entrance
const CHAR_OUT_DURATION = 14; // frames for each char to complete its exit
const STAGGER_IN = 0.6; // frames between each char start (entrance)
const STAGGER_OUT = 0.5; // frames between each char start (exit)
const HOLD_DURATION = 60; // frames to hold the fully visible text

// ── Colors & Typography ───────────────────────────────────────────────────────

const BG_COLOR = "#0e100f";
const TEXT_COLOR = "#ffffff";
const FONT_FAMILY = "'Signika Negative', 'Signika', Helvetica, Arial, sans-serif";
const FONT_SIZE = 50;
const LINE_HEIGHT = 1.4;
const MAX_TEXT_WIDTH = 960;
const PERSPECTIVE = 400;

// ── Easing functions matching GSAP ────────────────────────────────────────────

/** GSAP Back.easeOut: overshoot of 1.70158 */
function backEaseOut(t: number): number {
  const s = 1.70158;
  return (t = t - 1) * t * ((s + 1) * t + s) + 1;
}

/** GSAP Back.easeIn: overshoot of 1.70158 */
function backEaseIn(t: number): number {
  const s = 1.70158;
  return t * t * ((s + 1) * t - s);
}

// ── Character layout: split text into chars with word-break awareness ─────────

interface CharData {
  char: string;
  index: number;
  isSpace: boolean;
  wordIndex: number;
}

function splitIntoChars(text: string): CharData[] {
  const chars: CharData[] = [];
  let wordIndex = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const isSpace = ch === " ";
    if (isSpace && i > 0 && text[i - 1] !== " ") {
      wordIndex++;
    }
    chars.push({ char: ch, index: i, isSpace, wordIndex });
  }
  return chars;
}

// ── Compute phase timings for a given quote ───────────────────────────────────

interface QuoteTiming {
  totalFrames: number;
  chars: CharData[];
  inEnd: number; // frame when all chars have finished entering
  outStart: number; // frame when exit animation begins
}

function computeTiming(text: string): QuoteTiming {
  const chars = splitIntoChars(text);
  const nonSpaceCount = chars.filter((c) => !c.isSpace).length;

  // Entrance: last char starts at (nonSpaceCount - 1) * STAGGER_IN, finishes CHAR_IN_DURATION later
  const inEnd = Math.ceil(
    (nonSpaceCount - 1) * STAGGER_IN + CHAR_IN_DURATION,
  );

  // Hold
  const outStart = inEnd + HOLD_DURATION;

  // Exit: last char starts at (nonSpaceCount - 1) * STAGGER_OUT, finishes CHAR_OUT_DURATION later
  const outEnd = Math.ceil(
    outStart + (nonSpaceCount - 1) * STAGGER_OUT + CHAR_OUT_DURATION,
  );

  // Small gap between quotes
  const totalFrames = outEnd + 8;

  return { totalFrames, chars, inEnd, outStart };
}

// ── Per-character animation state ─────────────────────────────────────────────

interface CharAnimState {
  opacity: number;
  y: number;
  rotateX: number;
  scale: number;
}

function getCharState(
  charNonSpaceIndex: number,
  localFrame: number,
  timing: QuoteTiming,
): CharAnimState {
  // ── Entrance ──
  const inStart = charNonSpaceIndex * STAGGER_IN;
  const inProgress = Math.min(
    1,
    Math.max(0, (localFrame - inStart) / CHAR_IN_DURATION),
  );
  const inEased = backEaseOut(inProgress);

  // ── Exit ──
  const outStart =
    timing.outStart + charNonSpaceIndex * STAGGER_OUT;
  const outProgress = Math.min(
    1,
    Math.max(0, (localFrame - outStart) / CHAR_OUT_DURATION),
  );
  const outEased = backEaseIn(outProgress);

  // ── Compose ──
  // Entrance: from { opacity: 0, y: 80, rotateX: 80, scale: 0.8 } to { opacity: 1, y: 0, rotateX: 0, scale: 1 }
  // Exit: from { opacity: 1, y: 0, rotateX: 0, scale: 1 } to { opacity: 0, y: -80, rotateX: -80, scale: 0.8 }

  if (localFrame < inStart) {
    // Before entrance
    return { opacity: 0, y: 80, rotateX: 80, scale: 0.8 };
  }

  if (localFrame < timing.outStart) {
    // During or after entrance, before exit
    return {
      opacity: inEased,
      y: 80 * (1 - inEased),
      rotateX: 80 * (1 - inEased),
      scale: 0.8 + 0.2 * inEased,
    };
  }

  // During exit
  return {
    opacity: 1 - outEased,
    y: -80 * outEased,
    rotateX: -80 * outEased,
    scale: 1 - 0.2 * outEased,
  };
}

// ── Subtitle text animation ───────────────────────────────────────────────────

const SUBTITLE = "Animate text like a pro.";

// ── Main component ────────────────────────────────────────────────────────────

export const TextGsap: React.FC = () => {
  const frame = useCurrentFrame();

  // Pre-compute all quote timings
  const quoteTimings = useMemo(
    () => QUOTES.map((q) => computeTiming(q)),
    [],
  );

  // Total frames for one full cycle of all quotes
  const cycleDuration = useMemo(
    () => quoteTimings.reduce((sum, t) => sum + t.totalFrames, 0),
    [quoteTimings],
  );

  // Current position within the cycle (loops)
  const cycleFrame = frame % cycleDuration;

  // Determine which quote is active and the local frame within it
  let accumulated = 0;
  let activeQuoteIndex = 0;
  let localFrame = 0;
  for (let i = 0; i < quoteTimings.length; i++) {
    if (cycleFrame < accumulated + quoteTimings[i].totalFrames) {
      activeQuoteIndex = i;
      localFrame = cycleFrame - accumulated;
      break;
    }
    accumulated += quoteTimings[i].totalFrames;
  }

  const activeTiming = quoteTimings[activeQuoteIndex];
  const activeChars = activeTiming.chars;

  // Track non-space character index for stagger
  let nonSpaceIdx = 0;

  // ── Subtitle: gentle fade in at the start, stays visible ──
  const subtitleOpacity = interpolate(frame, [0, 30], [0, 0.4], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
  });

  // ── Quote counter indicator ──
  const counterOpacity = interpolate(frame, [0, 20], [0, 0.3], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: BG_COLOR,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      {/* Subtle radial gradient overlay for depth */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse at center, rgba(30, 35, 30, 0.3) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />

      {/* Quote counter dots */}
      <div
        style={{
          position: "absolute",
          bottom: 80,
          left: "50%",
          transform: "translateX(-50%)",
          display: "flex",
          gap: 12,
          opacity: counterOpacity,
        }}
      >
        {QUOTES.map((_, i) => (
          <div
            key={i}
            style={{
              width: i === activeQuoteIndex ? 24 : 8,
              height: 8,
              borderRadius: 4,
              background:
                i === activeQuoteIndex
                  ? "rgba(255,255,255,0.6)"
                  : "rgba(255,255,255,0.15)",
              transition: "width 0.3s",
            }}
          />
        ))}
      </div>

      {/* GreenSock branding nod — top left */}
      <div
        style={{
          position: "absolute",
          top: 40,
          left: 50,
          display: "flex",
          alignItems: "center",
          gap: 10,
          opacity: 0.25,
        }}
      >
        <div
          style={{
            width: 24,
            height: 24,
            borderRadius: 6,
            background: "linear-gradient(135deg, #88ce02, #6ab700)",
          }}
        />
        <span
          style={{
            color: "#88ce02",
            fontFamily: "'Signika Negative', sans-serif",
            fontSize: 14,
            fontWeight: 600,
            letterSpacing: "0.05em",
          }}
        >
          GSAP SplitText
        </span>
      </div>

      {/* Main text container with 3D perspective */}
      <div
        style={{
          perspective: PERSPECTIVE,
          perspectiveOrigin: "50% 50%",
          maxWidth: MAX_TEXT_WIDTH,
          textAlign: "center",
          padding: "0 60px",
        }}
      >
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "center",
            lineHeight: LINE_HEIGHT,
          }}
        >
          {activeChars.map((charData, i) => {
            if (charData.isSpace) {
              return (
                <span
                  key={`${activeQuoteIndex}-${i}`}
                  style={{
                    display: "inline-block",
                    width: FONT_SIZE * 0.3,
                  }}
                />
              );
            }

            const state = getCharState(nonSpaceIdx, localFrame, activeTiming);
            nonSpaceIdx++;

            return (
              <span
                key={`${activeQuoteIndex}-${i}`}
                style={{
                  display: "inline-block",
                  color: TEXT_COLOR,
                  fontFamily: FONT_FAMILY,
                  fontSize: FONT_SIZE,
                  fontWeight: 300,
                  opacity: state.opacity,
                  transform: `translateY(${state.y}px) rotateX(${state.rotateX}deg) scale(${state.scale})`,
                  transformStyle: "preserve-3d",
                  backfaceVisibility: "hidden",
                  willChange: "transform, opacity",
                }}
              >
                {charData.char}
              </span>
            );
          })}
        </div>
      </div>

      {/* Subtitle */}
      <div
        style={{
          position: "absolute",
          bottom: 130,
          left: "50%",
          transform: "translateX(-50%)",
          opacity: subtitleOpacity,
          color: "#88ce02",
          fontFamily: "'Signika Negative', sans-serif",
          fontSize: 16,
          fontWeight: 400,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
        }}
      >
        {SUBTITLE}
      </div>
    </AbsoluteFill>
  );
};
