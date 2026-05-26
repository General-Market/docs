// Source: CodePen "Animating Text Justification" (OKAY DEV) — SplitText headline
//
// Original: an Impact headline that GSAP SplitText breaks into lines + words.
// Each line slides up out of an overflow mask (yPercent 110 -> 0, stagger 0.14,
// expo); the words then justify into place (power4); finally the two
// [data-accent] words brighten from the base mint to white. The entrance plays
// ON SCREEN from frame 0 — the lines climb out of their masks in the first ~0.9s
// so the viewer watches the headline arrive, rather than it being pre-rolled or
// opening on a held blank. After the reveal a slow breathing keeps it alive.

import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  Easing,
} from "remotion";

// ── Palette (from the original :root) ────────────────────────────────────────

const COLORS = {
  bg: "#42ed91",
  panel: "#42ed91",
  text: "#ccffe4",
  accent: "#ffffff",
};

const FONT = 'Impact, "Haettenschweiler", "Arial Narrow Bold", sans-serif';

// ── Headline content — lines of words, accents flagged (BETTER, COMMUNITY) ───

interface Word {
  text: string;
  accent?: boolean;
}

const LINES: Word[][] = [
  [{ text: "BUILDING" }, { text: "A" }, { text: "BETTER", accent: true }],
  [{ text: "COMMUNITY", accent: true }, { text: "FOR" }, { text: "THE" }],
  [{ text: "CREATIVE" }, { text: "INDUSTRY" }],
];

// ── Easing helpers (matching GSAP expo / power4 / power2) ────────────────────

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const expoOut = Easing.out(Easing.exp);
const power4Out = Easing.out(Easing.poly(4));
const power2Out = Easing.out(Easing.poly(2));

const FONT_SIZE = 132; // ~8rem cap, sized to the 1180px board
const LINE_HEIGHT = 0.9;

// ── Word with a per-word justify slide + accent colour shift ─────────────────

const WordSpan: React.FC<{
  word: Word;
  justify: number; // 0..1
  accentP: number; // 0..1
  fromX: number; // px the word travels in from during justify
}> = ({ word, justify, accentP, fromX }) => {
  const x = interpolate(justify, [0, 1], [fromX, 0], { easing: power4Out });
  const color = word.accent
    ? interpolateColor(COLORS.text, COLORS.accent, word.accent ? accentP : 0)
    : COLORS.text;

  return (
    <span
      style={{
        display: "inline-block",
        whiteSpace: "nowrap",
        color,
        transform: `translateX(${x}px)`,
        willChange: "transform, color",
      }}
    >
      {word.text}
    </span>
  );
};

// Small hex colour lerp (text mint -> white accent).
function interpolateColor(from: string, to: string, t: number): string {
  const c = clamp01(t);
  const f = hex(from);
  const g = hex(to);
  const r = Math.round(f[0] + (g[0] - f[0]) * c);
  const gg = Math.round(f[1] + (g[1] - f[1]) * c);
  const b = Math.round(f[2] + (g[2] - f[2]) * c);
  return `rgb(${r}, ${gg}, ${b})`;
}
function hex(h: string): [number, number, number] {
  const s = h.replace("#", "");
  return [
    parseInt(s.substring(0, 2), 16),
    parseInt(s.substring(2, 4), 16),
    parseInt(s.substring(4, 6), 16),
  ];
}

// ── Main composition ─────────────────────────────────────────────────────────

export const CommunityHeadline: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;

  // Reveal timeline (seconds). The entrance plays ON SCREEN, starting at frame
  // 0: the three lines climb up out of their overflow masks one after another
  // (stagger 0.14, each ~0.62, expo) so the viewer actually watches the text
  // arrive — no pre-rolled head-start, no long blank hold. Justify follows each
  // word in as it appears (power4). Accents brighten last (power2), after the
  // headline has settled.
  const HOLD_START = 2.0; // reveal is fully done by here; breathing takes over
  const lineReveal = (i: number): number => {
    // line 0 begins climbing at t=0; lines 1–2 cascade right behind. The whole
    // headline is up by ~0.9s, so the entrance reads clearly without dwelling.
    const start = i * 0.14;
    return clamp01((t - start) / 0.62);
  };
  const justifyOf = (lineIdx: number, wordIdx: number): number => {
    // global word index — words justify in just behind their line's climb
    const before = LINES.slice(0, lineIdx).reduce((n, l) => n + l.length, 0) + wordIdx;
    const start = before * 0.05;
    return clamp01((t - start) / 0.5);
  };
  const accentOf = (orderIdx: number): number => {
    const start = 1.05 + orderIdx * 0.18;
    return clamp01((t - start) / 0.7);
  };

  // Continuous breathing for the back half so it isn't static after the reveal.
  const breath = Math.sin((t - HOLD_START) * 0.9) * 0.5 + 0.5;
  const boardScale =
    1 + (t > HOLD_START ? interpolate(breath, [0, 1], [-0.004, 0.004]) : 0);
  const boardDriftY = t > HOLD_START ? Math.sin((t - HOLD_START) * 0.7) * 6 : 0;
  // Slow hue/glow pulse on the accents during the hold.
  const accentGlow = t > HOLD_START ? 8 + breath * 14 : 0;

  // Track accent order for staggered brighten (BETTER first, then COMMUNITY).
  let accentSeen = 0;

  const BOARD_W = 1180;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.bg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      {/* Subtle vignette so the flat mint reads as a designed board */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse at 50% 45%, rgba(255,255,255,0.10), transparent 60%), radial-gradient(ellipse at 50% 120%, rgba(0,80,40,0.18), transparent 55%)",
        }}
      />

      {/* Brand mark, top center (OKAY DEV style) */}
      <div
        style={{
          position: "absolute",
          top: 40,
          left: "50%",
          transform: "translateX(-50%)",
          textAlign: "center",
          opacity: interpolate(frame, [0, 14], [0.35, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
          zIndex: 10,
        }}
      >
        <div
          style={{
            fontFamily: FONT,
            fontSize: 26,
            letterSpacing: 1,
            color: COLORS.accent,
            textTransform: "uppercase",
          }}
        >
          OKAY DEV
        </div>
        <div
          style={{
            display: "inline-block",
            marginTop: 4,
            fontSize: 11,
            letterSpacing: 1.5,
            textTransform: "uppercase",
            color: "#000",
            background: "rgba(204,255,228,0.75)",
            padding: "3px 6px",
            borderRadius: 2,
            fontFamily: '"SF Pro Text", "Inter", system-ui, sans-serif',
          }}
        >
          A design + development community
        </div>
      </div>

      {/* The board */}
      <div
        style={{
          width: BOARD_W,
          padding: "0 40px",
          background: COLORS.panel,
          transform: `scale(${boardScale}) translateY(${boardDriftY}px)`,
        }}
      >
        <h1
          style={{
            margin: 0,
            color: COLORS.text,
            textTransform: "uppercase",
            fontFamily: FONT,
            fontSize: FONT_SIZE,
            lineHeight: LINE_HEIGHT,
            letterSpacing: "0.01em",
            fontWeight: 400,
          }}
        >
          {LINES.map((line, li) => {
            const lr = lineReveal(li);
            const yPct = interpolate(lr, [0, 1], [110, 0], { easing: expoOut });

            return (
              <span
                key={li}
                style={{
                  display: "block",
                  width: "100%",
                  overflow: "hidden",
                }}
              >
                <span
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    width: "100%",
                    transform: `translateY(${yPct}%)`,
                    willChange: "transform",
                  }}
                >
                  {line.map((w, wi) => {
                    const justify = justifyOf(li, wi);
                    // Words enter justify from a small offset to mimic SplitText power4 settle.
                    const fromX = (wi % 2 === 0 ? -1 : 1) * 26;
                    let accentP = 0;
                    if (w.accent) {
                      accentP = accentOf(accentSeen);
                      accentSeen += 1;
                    }
                    return (
                      <span
                        key={wi}
                        style={{
                          filter:
                            w.accent && accentGlow > 0
                              ? `drop-shadow(0 0 ${accentGlow}px rgba(255,255,255,0.55))`
                              : undefined,
                        }}
                      >
                        <WordSpan
                          word={w}
                          justify={justify}
                          accentP={accentP}
                          fromX={fromX}
                        />
                      </span>
                    );
                  })}
                </span>
              </span>
            );
          })}
        </h1>
      </div>

      {/* Bottom hairline progress mark, drawn as the reveal completes */}
      <div
        style={{
          position: "absolute",
          bottom: 60,
          left: "50%",
          transform: "translateX(-50%)",
          width: interpolate(frame, [30, 220], [0, 360], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: power2Out,
          }),
          height: 2,
          background: "rgba(255,255,255,0.5)",
          opacity: interpolate(frame, [30, 60, 560, 595], [0, 1, 1, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      />
    </AbsoluteFill>
  );
};
