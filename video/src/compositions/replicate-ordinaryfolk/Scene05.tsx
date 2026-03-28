import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  Easing,
  spring,
} from "remotion";
import { noise2D } from "@remotion/noise";
import { CameraMotionBlur } from "@remotion/motion-blur";

/* ═══════════════════════════════════════════════════════════════
   Scene 05 — Gemini Advanced Interface
   694 frames @ 30fps = 23.13s

   Sub-segments (frame ranges, local to this scene):
   A  0-30     Dark void + faint G logo + tilted phone emerges
   B  30-75    Phone 3D perspective, "Gemini Advanced" header
   C  75-130   Interface straightens, "Hello, Lisa." types in
   D  130-180  Full interface with cards + "How can I help you today?"
   E  180-220  "Our most capable AI" kinetic text
   F  220-260  "for reasoning" centered text
   G  260-310  Zoom into card: "Walk me through solving a problem"
   H  310-350  "coding" typewriter
   I  350-400  Pan to card: "Help me write HTML, CSS, and JS"
   J  400-430  "and more"
   K  430-480  Pan across cards 3 & 4: images + roleplay
   L  480-520  "With access to" — letters scatter
   M  520-570  "Ultra 1.0" inside gradient orb
   N  570-610  "Experience Gemini" + URL + devices rise
   O  610-660  Phone + desktop side by side
   P  660-694  Gemini sparkle -> Google G logo -> fade
  ═══════════════════════════════════════════════════════════════ */

const BG = "#0A0A0A";
const PURPLE = "#8B5CF6";
const PINK = "#EC4899";
const BLUE = "#3B82F6";
const GRADIENT_TEXT = `linear-gradient(135deg, ${PURPLE}, ${PINK})`;
const FONT = "'Google Sans', 'Product Sans', system-ui, -apple-system, sans-serif";

// ─── Helpers ───

const clamp = (opts = {}) => ({
  extrapolateLeft: "clamp" as const,
  extrapolateRight: "clamp" as const,
  ...opts,
});

const fadeIn = (frame: number, start: number, dur: number) =>
  interpolate(frame, [start, start + dur], [0, 1], clamp());

const fadeOut = (frame: number, start: number, dur: number) =>
  interpolate(frame, [start, start + dur], [1, 0], clamp());

const fadeInOut = (frame: number, inStart: number, inDur: number, outStart: number, outDur: number) =>
  Math.min(fadeIn(frame, inStart, inDur), fadeOut(frame, outStart, outDur));

// ─── Gradient text via background-clip ───

const GradientText: React.FC<{
  children: React.ReactNode;
  gradient?: string;
  style?: React.CSSProperties;
}> = ({ children, gradient = GRADIENT_TEXT, style }) => (
  <span
    style={{
      background: gradient,
      WebkitBackgroundClip: "text",
      WebkitTextFillColor: "transparent",
      backgroundClip: "text",
      ...style,
    }}
  >
    {children}
  </span>
);

// ─── Glow effect wrapper ───

const Glow: React.FC<{
  color?: string;
  spread?: number;
  children: React.ReactNode;
  style?: React.CSSProperties;
}> = ({ color = PURPLE, spread = 40, children, style }) => (
  <div
    style={{
      filter: `drop-shadow(0 0 ${spread}px ${color})`,
      ...style,
    }}
  >
    {children}
  </div>
);

// ─── Organic noise helpers ───

/** Smooth noise-based offset for position/scale jitter */
const organicOffset = (frame: number, seed: string, speed = 0.02, amplitude = 1): number => {
  const seedNum = seed.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return noise2D(seed, frame * speed, seedNum * 0.1) * amplitude;
};

/** Breathing glow: sine + noise for organic radius variation */
const breathingGlow = (frame: number, base: number, range: number, speed = 0.08): number => {
  const sine = Math.sin(frame * speed) * 0.5 + 0.5; // 0-1
  const noiseVal = noise2D("glow", frame * 0.03, 0) * 0.3 + 0.5; // ~0.2-0.8
  return base + range * (sine * 0.7 + noiseVal * 0.3);
};

// ─── Google "G" logo — MULTI-LAYER BREATHING GLOW ───

const GoogleG: React.FC<{ size?: number; opacity?: number; glowIntensity?: number; frame?: number }> = ({
  size = 60,
  opacity = 1,
  glowIntensity = 0,
  frame = 0,
}) => {
  const s = size;

  // Layer 1: slow sine — the inhale/exhale rhythm
  const sineBreath = Math.sin(frame * 0.09) * 0.5 + 0.5;
  // Layer 2: faster noise — irregularity
  const noiseBreath = noise2D("gBreath", frame * 0.04, 0) * 0.5 + 0.5;
  // Layer 3: ultra-slow drift — long-term intensity wander
  const driftBreath = Math.sin(frame * 0.025) * 0.3 + 0.7;
  // Composite: weighted blend, never mechanical
  const pulse = (sineBreath * 0.5 + noiseBreath * 0.3 + driftBreath * 0.2) * glowIntensity;

  // Each Google color breathes at its own noise frequency
  const blueGlow = pulse * 1.0;
  const redGlow = pulse * 0.7 + noise2D("gRed", frame * 0.035, 1) * 0.15 * glowIntensity;
  const yellowGlow = pulse * 0.5 + noise2D("gYlw", frame * 0.03, 2) * 0.12 * glowIntensity;
  const greenGlow = pulse * 0.6 + noise2D("gGrn", frame * 0.032, 3) * 0.1 * glowIntensity;

  const glowShadow = glowIntensity > 0
    ? [
        `0 0 ${20 * blueGlow}px rgba(66,133,244,0.6)`,
        `0 0 ${45 * blueGlow}px rgba(66,133,244,0.25)`,
        `0 0 ${35 * redGlow}px rgba(234,67,53,0.35)`,
        `0 0 ${70 * redGlow}px rgba(234,67,53,0.12)`,
        `0 0 ${50 * yellowGlow}px rgba(251,188,5,0.25)`,
        `0 0 ${90 * yellowGlow}px rgba(251,188,5,0.08)`,
        `0 0 ${40 * greenGlow}px rgba(52,168,83,0.3)`,
        `0 0 ${75 * greenGlow}px rgba(52,168,83,0.1)`,
      ].join(", ")
    : "none";

  const svgFilter = pulse > 0
    ? `drop-shadow(0 0 ${12 * blueGlow}px rgba(66,133,244,0.7)) drop-shadow(0 0 ${30 * pulse}px rgba(139,92,246,0.3))`
    : "none";

  return (
    <div style={{ width: s, height: s, opacity, position: "relative" }}>
      <svg viewBox="0 0 48 48" width={s} height={s} style={{ filter: svgFilter }}>
        <path
          d="M44.5 20H24v8.5h11.8C34.7 33.9 30.1 37 24 37c-7.2 0-13-5.8-13-13s5.8-13 13-13c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 4.1 29.6 2 24 2 11.8 2 2 11.8 2 24s9.8 22 22 22c11 0 21-8 21-22 0-1.3-.2-2.7-.5-4z"
          fill="#4285F4"
        />
        <path
          d="M3 12.5l7.3 5.3C12.2 13.5 17.6 10 24 10c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 4.1 29.6 2 24 2 14.8 2 6.7 6.2 3 12.5z"
          fill="#EA4335"
        />
        <path
          d="M24 46c5.4 0 10.3-1.8 14.1-5l-6.5-5.5C29.5 37.1 26.9 38 24 38c-6 0-10.6-3.9-12.4-9.3L4.3 34C8 40.3 15.2 46 24 46z"
          fill="#34A853"
        />
        <path
          d="M44.5 20H24v8.5h11.8c-1 3.1-2.8 5.5-5.3 7.1l6.5 5.5c3.8-3.5 6.5-8.8 6.5-15.1 0-1.3-.2-2.7-.5-4z"
          fill="#FBBC05"
        />
      </svg>
      {/* Inner glow ring — tight, bright */}
      <div
        style={{
          position: "absolute",
          inset: -6,
          borderRadius: "50%",
          boxShadow: glowShadow,
          pointerEvents: "none",
        }}
      />
      {/* Outer haze ring — wide, soft, phase-shifted */}
      <div
        style={{
          position: "absolute",
          inset: -20,
          borderRadius: "50%",
          background: `radial-gradient(circle, rgba(66,133,244,${0.08 * pulse}) 0%, rgba(139,92,246,${0.04 * pulse}) 40%, transparent 70%)`,
          pointerEvents: "none",
        }}
      />
    </div>
  );
};

// ─── Gemini sparkle (4-point star) ───

const GeminiSparkle: React.FC<{ size?: number; opacity?: number; color?: string }> = ({
  size = 30,
  opacity = 1,
  color = "#fff",
}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" style={{ opacity }}>
    <path
      d="M12 0C12 6.627 6.627 12 0 12c6.627 0 12 5.373 12 12 0-6.627 5.373-12 12-12-6.627 0-12-5.373-12-12z"
      fill={color}
    />
  </svg>
);

// ─── Prompt card component ───

interface CardData {
  title: string;
  body: string[];
  thumbColor: string;
  accentColor: string;
}

const CARDS: CardData[] = [
  {
    title: "Walk me through\nsolving a problem",
    body: [
      "Step 1: Identify the chemical formula",
      "of cane sugar.",
      "Cane sugar, also known as sucrose,",
      "has the chemical formula C12H22O11.",
    ],
    thumbColor: "#2D1B4E",
    accentColor: PURPLE,
  },
  {
    title: "Help me write HTML,\nCSS, and JS",
    body: [
      "<!DOCTYPE html>",
      "<html>",
      "  <head>",
      "    <title>Image Slider</title>",
      '    <link rel="stylesheet"',
    ],
    thumbColor: "#1B2E4E",
    accentColor: BLUE,
  },
  {
    title: "Generate a set of\nfantastical images",
    body: [],
    thumbColor: "#3B1B4E",
    accentColor: "#A855F7",
  },
  {
    title: "Role play as a\ncharacter from a novel",
    body: [
      "Goodness, what a delightful day!",
      "The sun fairly beams upon us — I should",
      "say it's an exceptional day for a walk",
      "in the countryside. Wouldn't you",
    ],
    thumbColor: "#4E1B3B",
    accentColor: PINK,
  },
];

const PromptCard: React.FC<{
  card: CardData;
  width?: number;
  opacity?: number;
  scale?: number;
}> = ({ card, width = 200, opacity = 1, scale = 1 }) => {
  const isCode = card.title.includes("HTML");
  return (
    <div
      style={{
        width,
        background: "#1A1A2E",
        borderRadius: 16,
        padding: 16,
        opacity,
        transform: `scale(${scale})`,
        border: "1px solid rgba(255,255,255,0.08)",
        boxShadow: `0 0 20px ${card.accentColor}22, 0 4px 20px rgba(0,0,0,0.5)`,
        overflow: "hidden",
        position: "relative" as const,
      }}
    >
      {/* Thumbnail placeholder */}
      <div
        style={{
          width: "100%",
          height: 80,
          borderRadius: 10,
          background: `linear-gradient(135deg, ${card.thumbColor}, ${card.accentColor}33)`,
          marginBottom: 12,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
        }}
      >
        {card.title.includes("fantastical") && (
          <>
            <div style={{
              width: 30, height: 30, borderRadius: "50%",
              background: `radial-gradient(circle, #FFD700, ${PURPLE})`,
              position: "absolute" as const,
              top: 25, left: "30%",
              boxShadow: `0 0 15px ${PURPLE}`,
            }} />
            <div style={{
              width: 20, height: 20, borderRadius: "50%",
              background: `radial-gradient(circle, #60A5FA, #1E3A5F)`,
              position: "absolute" as const,
              top: 40, left: "55%",
              boxShadow: "0 0 10px #60A5FA",
            }} />
          </>
        )}
        {card.title.includes("Role play") && (
          <div style={{
            width: 40, height: 50, borderRadius: 8,
            background: `linear-gradient(180deg, #8B4513, #D2691E)`,
            boxShadow: "0 0 10px rgba(210,105,30,0.5)",
          }} />
        )}
      </div>
      {/* Title */}
      <div
        style={{
          color: "#fff",
          fontSize: 13,
          fontFamily: FONT,
          fontWeight: 600,
          lineHeight: 1.3,
          whiteSpace: "pre-line",
          marginBottom: 8,
        }}
      >
        {card.title}
      </div>
      {/* Body text */}
      {card.body.length > 0 && (
        <div
          style={{
            color: "rgba(255,255,255,0.5)",
            fontSize: 9,
            fontFamily: isCode ? "'Fira Code', 'SF Mono', monospace" : FONT,
            lineHeight: 1.5,
          }}
        >
          {card.body.map((line, i) => (
            <div key={i}>
              {isCode ? (
                <span style={{ color: line.startsWith("<") || line.startsWith(" ") ? "#7DD3FC" : "rgba(255,255,255,0.5)" }}>
                  {line}
                </span>
              ) : (
                line
              )}
            </div>
          ))}
        </div>
      )}
      {/* Bottom accent glow bar */}
      <div
        style={{
          position: "absolute" as const,
          bottom: 0,
          left: "10%",
          right: "10%",
          height: 2,
          background: `linear-gradient(90deg, transparent, ${card.accentColor}, transparent)`,
          boxShadow: `0 0 10px ${card.accentColor}`,
        }}
      />
    </div>
  );
};

// ─── Full interface mockup ───

const GeminiInterface: React.FC<{
  frame: number;
  fps: number;
  perspectiveX?: number;
  perspectiveY?: number;
  scale?: number;
  opacity?: number;
  translateX?: number;
  translateY?: number;
}> = ({
  frame,
  fps,
  perspectiveX = 0,
  perspectiveY = 0,
  scale = 1,
  opacity = 1,
  translateX = 0,
  translateY = 0,
}) => {
  // "Hello, Lisa." type-in with ORGANIC variable speed
  // Hand-tuned per-character delays: hesitation before comma, burst through familiar letters,
  // micro-pause before the name (like the AI is looking you up), lingering period
  const helloText = "Hello, Lisa.";
  //                  H    e    l    l    o    ,    ' '  L    i    s    a    .
  const handDelays = [3.5, 1.6, 1.4, 1.2, 1.8, 8,   5,   4,   1.5, 1.3, 1.7, 7];
  const charDelays: number[] = helloText.split("").map((_, i) => handDelays[i] ?? 2);
  // Cumulative frame thresholds for each character
  const charFrameThresholds: number[] = [];
  let cumFrames = 0;
  for (const d of charDelays) {
    cumFrames += d;
    charFrameThresholds.push(cumFrames);
  }
  const totalTypeFrames = cumFrames;
  const visibleChars = charFrameThresholds.filter((t) => frame >= t).length;
  const typedHello = helloText.slice(0, visibleChars);

  const subtitleOpacity = fadeIn(frame, totalTypeFrames + 8, fps * 0.5);
  const cardsOpacity = fadeIn(frame, totalTypeFrames + 20, fps * 0.6);

  return (
    <div
      style={{
        width: 820,
        height: 500,
        background: "#111118",
        borderRadius: 12,
        position: "relative",
        overflow: "hidden",
        transform: `perspective(1200px) rotateX(${perspectiveX}deg) rotateY(${perspectiveY}deg) scale(${scale}) translate(${translateX}px, ${translateY}px)`,
        opacity,
        boxShadow: `
          0 0 60px rgba(139,92,246,0.08),
          0 20px 60px rgba(0,0,0,0.6),
          inset 0 1px 0 rgba(255,255,255,0.04)
        `,
      }}
    >
      {/* Thin gradient border (mask technique) */}
      <div
        style={{
          position: "absolute",
          inset: -1,
          borderRadius: 13,
          padding: 1,
          background: `linear-gradient(135deg, ${BLUE}66, ${PURPLE}66, ${PINK}66)`,
          WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
          WebkitMaskComposite: "xor" as any,
          maskComposite: "exclude" as any,
          pointerEvents: "none" as const,
          zIndex: 10,
        }}
      />

      {/* Header bar */}
      <div
        style={{
          padding: "16px 24px",
          display: "flex",
          alignItems: "center",
          gap: 12,
          borderBottom: "1px solid rgba(255,255,255,0.04)",
        }}
      >
        {/* Hamburger icon */}
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <div style={{ width: 16, height: 1.5, background: "rgba(255,255,255,0.4)" }} />
          <div style={{ width: 16, height: 1.5, background: "rgba(255,255,255,0.4)" }} />
          <div style={{ width: 16, height: 1.5, background: "rgba(255,255,255,0.4)" }} />
        </div>
        {/* Title */}
        <span style={{ color: "rgba(255,255,255,0.8)", fontFamily: FONT, fontSize: 14, fontWeight: 400 }}>
          Gemini{" "}
          <GradientText gradient={`linear-gradient(90deg, ${PURPLE}, ${PINK})`}>
            Advanced
          </GradientText>
          <span style={{ color: "rgba(255,255,255,0.3)", marginLeft: 4, fontSize: 10 }}>{"\u25BE"}</span>
        </span>
      </div>

      {/* Sidebar hint */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 50,
          width: 48,
          height: "calc(100% - 50px)",
          borderRight: "1px solid rgba(255,255,255,0.03)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          paddingTop: 16,
        }}
      >
        <div
          style={{
            width: 20,
            height: 20,
            borderRadius: "50%",
            border: "1.5px solid rgba(255,255,255,0.2)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "rgba(255,255,255,0.3)",
            fontSize: 14,
          }}
        >
          +
        </div>
      </div>

      {/* Main content area */}
      <div
        style={{
          paddingLeft: 70,
          paddingRight: 40,
          paddingTop: 30,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        {/* "Hello, Lisa." */}
        <div
          style={{
            fontSize: 36,
            fontFamily: FONT,
            fontWeight: 400,
            marginBottom: 8,
          }}
        >
          <GradientText gradient={`linear-gradient(135deg, ${PURPLE}, ${PINK}, ${BLUE})`}>
            {typedHello}
          </GradientText>
          {/* Blinking cursor during typing */}
          {visibleChars < helloText.length && (
            <span
              style={{
                display: "inline-block",
                width: 2,
                height: 32,
                background: `linear-gradient(180deg, ${PURPLE}, ${PINK})`,
                marginLeft: 2,
                verticalAlign: "middle",
                opacity: Math.floor(frame / 8) % 2 === 0 ? 0.8 : 0.15,
              }}
            />
          )}
        </div>

        {/* "How can I help you today?" */}
        <div
          style={{
            fontSize: 22,
            fontFamily: FONT,
            fontWeight: 300,
            color: "rgba(255,255,255,0.5)",
            opacity: subtitleOpacity,
            marginBottom: 36,
          }}
        >
          How can I help you today?
        </div>

        {/* Card grid — staggered with organic delays */}
        <div
          style={{
            display: "flex",
            gap: 14,
            opacity: cardsOpacity,
          }}
        >
          {CARDS.map((card, i) => {
            // Wider stagger spread — card 3 arrives noticeably late
            const staggerOffsets = [0, 6, 3, 12];
            const cardEnter = totalTypeFrames + 20 + staggerOffsets[i];
            const cardLocalFrame = Math.max(0, frame - cardEnter);
            // Each card has DISTINCT spring personality
            const springConfigs = [
              { damping: 10, stiffness: 140, mass: 0.5 },   // card 0: snappy, eager
              { damping: 14, stiffness: 80,  mass: 0.9 },   // card 1: heavy, deliberate
              { damping: 8,  stiffness: 160, mass: 0.4 },   // card 2: bouncy, light
              { damping: 16, stiffness: 60,  mass: 1.2 },   // card 3: glacial, weighty
            ];
            const cardScale = spring({
              frame: cardLocalFrame,
              fps,
              config: springConfigs[i],
            });
            // Entry rotation: alternating direction, different magnitudes
            const entryRotations = [-4, 2.5, -2, 5];
            const cardRotation = interpolate(
              cardLocalFrame,
              [0, springConfigs[i].damping + 4],
              [entryRotations[i], 0],
              { ...clamp(), easing: Easing.out(Easing.cubic) }
            );
            // Entry Y offset: cards rise from below at different distances
            const entryYOffsets = [15, 25, 12, 35];
            const cardEntryY = interpolate(
              cardLocalFrame,
              [0, 14],
              [entryYOffsets[i], 0],
              { ...clamp(), easing: Easing.out(Easing.cubic) }
            );
            // Noise-based micro-drift — different speeds per card
            const noiseSpeeds = [0.015, 0.012, 0.02, 0.01];
            const microX = organicOffset(frame, `cardX${i}`, noiseSpeeds[i], 0.8);
            const microY = organicOffset(frame, `cardY${i}`, noiseSpeeds[i] * 1.2, 0.6);
            return (
              <div
                key={i}
                style={{
                  transform: `scale(${0.85 + 0.15 * cardScale}) rotate(${cardRotation}deg) translate(${microX}px, ${cardEntryY + microY}px)`,
                  opacity: interpolate(cardLocalFrame, [0, 8], [0, 1], clamp()),
                }}
              >
                <PromptCard card={card} width={160} />
              </div>
            );
          })}
        </div>
      </div>

      {/* Input bar at bottom */}
      <div
        style={{
          position: "absolute",
          bottom: 40,
          left: 70,
          right: 40,
          height: 44,
          borderRadius: 24,
          border: "1px solid rgba(255,255,255,0.1)",
          background: "rgba(255,255,255,0.03)",
          display: "flex",
          alignItems: "center",
          padding: "0 20px",
          opacity: cardsOpacity,
        }}
      >
        <span style={{ color: "rgba(255,255,255,0.25)", fontFamily: FONT, fontSize: 13 }}>
          Enter a prompt here
        </span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 12 }}>
          <div style={{ width: 20, height: 20, borderRadius: "50%", background: "rgba(255,255,255,0.08)" }} />
          <div style={{ width: 20, height: 20, borderRadius: "50%", background: "rgba(255,255,255,0.08)" }} />
        </div>
      </div>

      {/* Disclaimer text */}
      <div
        style={{
          position: "absolute",
          bottom: 14,
          left: 0,
          right: 0,
          textAlign: "center",
          fontSize: 9,
          fontFamily: FONT,
          color: "rgba(255,255,255,0.2)",
          opacity: cardsOpacity,
        }}
      >
        Gemini may display inaccurate info, including about people, so double-check its responses.{" "}
        <span style={{ color: "rgba(139,92,246,0.4)", textDecoration: "underline" }}>Your privacy & Gemini</span>
      </div>

      {/* Avatar circle top-right */}
      <div
        style={{
          position: "absolute",
          top: 12,
          right: 16,
          width: 28,
          height: 28,
          borderRadius: "50%",
          background: `linear-gradient(135deg, ${PURPLE}, ${BLUE})`,
          opacity: 0.6,
        }}
      />
    </div>
  );
};

// ─── Phone mockup (light mode, "Good morning") ───

const PhoneMockup: React.FC<{
  opacity?: number;
  scale?: number;
  translateX?: number;
  translateY?: number;
  rotateY?: number;
}> = ({ opacity = 1, scale = 1, translateX = 0, translateY = 0, rotateY = 0 }) => (
  <div
    style={{
      width: 180,
      height: 360,
      background: "#F5F5F5",
      borderRadius: 24,
      border: "3px solid #333",
      overflow: "hidden",
      opacity,
      transform: `perspective(800px) rotateY(${rotateY}deg) scale(${scale}) translate(${translateX}px, ${translateY}px)`,
      boxShadow: "0 20px 60px rgba(0,0,0,0.4)",
    }}
  >
    {/* Status bar */}
    <div style={{ height: 24, background: "#fff", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 12px" }}>
      <span style={{ fontSize: 8, color: "#333", fontFamily: FONT }}>9:30</span>
      <span style={{ fontSize: 8, color: "#333", fontFamily: FONT }}>5G</span>
    </div>
    {/* Content */}
    <div style={{ padding: 14, background: "#fff", height: "100%" }}>
      <div style={{ fontSize: 20, fontWeight: 400, fontFamily: FONT, color: "#333", marginBottom: 12 }}>
        Good morning
      </div>
      {/* Mini cards */}
      {[
        { bg: "#E8F0FE", color: "#1A73E8", text: "Find places to eat..." },
        { bg: "#FEF7E0", color: "#E37400", text: "Help me plan..." },
        { bg: "#E6F4EA", color: "#137333", text: "Tell me about..." },
      ].map((c, i) => (
        <div
          key={i}
          style={{
            background: c.bg,
            borderRadius: 12,
            padding: "8px 10px",
            marginBottom: 6,
            fontSize: 8,
            fontFamily: FONT,
            color: c.color,
          }}
        >
          {c.text}
        </div>
      ))}
      {/* Mic button */}
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: "50%",
          background: `linear-gradient(135deg, ${BLUE}, ${PURPLE})`,
          margin: "12px auto 0",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div style={{ width: 8, height: 12, borderRadius: 4, background: "#fff" }} />
      </div>
    </div>
  </div>
);

// ─── Ultra 1.0 orb ───

const UltraOrb: React.FC<{ frame: number; fps: number; opacity?: number; scale?: number }> = ({
  frame,
  fps,
  opacity = 1,
  scale = 1,
}) => {
  const rotation = interpolate(frame, [0, fps * 10], [0, 360]);
  const pulseScale = 1 + 0.02 * Math.sin((frame / fps) * Math.PI * 2);
  const orbSize = 320;

  return (
    <div
      style={{
        width: orbSize,
        height: orbSize,
        position: "relative",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        opacity,
        transform: `scale(${scale * pulseScale})`,
      }}
    >
      {/* Outer ring — thin conic gradient border */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "50%",
          padding: 2,
          background: `conic-gradient(from ${rotation}deg, ${BLUE}, ${PURPLE}, ${PINK}, ${BLUE})`,
          WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
          WebkitMaskComposite: "xor" as any,
          maskComposite: "exclude" as any,
        }}
      />
      {/* Sphere body — glass-like with multiple radial gradients */}
      <div
        style={{
          position: "absolute",
          inset: 4,
          borderRadius: "50%",
          background: `
            radial-gradient(ellipse at 35% 25%, rgba(60,70,120,0.4) 0%, transparent 50%),
            radial-gradient(ellipse at 65% 75%, rgba(100,50,80,0.2) 0%, transparent 50%),
            radial-gradient(circle at 50% 50%, #12122A 0%, #0A0A18 100%)
          `,
          boxShadow: `
            inset 0 -20px 40px rgba(0,0,0,0.5),
            inset 0 10px 30px rgba(80,80,160,0.08)
          `,
        }}
      />
      {/* Specular highlight — top-left glint */}
      <div
        style={{
          position: "absolute",
          top: 30,
          left: 60,
          width: 80,
          height: 50,
          borderRadius: "50%",
          background: "radial-gradient(ellipse, rgba(180,180,220,0.06) 0%, transparent 70%)",
          transform: "rotate(-20deg)",
        }}
      />
      {/* Inner purple glow */}
      <div
        style={{
          position: "absolute",
          inset: 30,
          borderRadius: "50%",
          background: "radial-gradient(circle at 45% 40%, rgba(139,92,246,0.12), transparent 65%)",
        }}
      />
      {/* Text */}
      <div
        style={{
          position: "relative",
          fontSize: 48,
          fontFamily: FONT,
          fontWeight: 400,
          color: "#fff",
          textShadow: "0 0 30px rgba(139,92,246,0.2)",
          zIndex: 1,
          letterSpacing: 1,
        }}
      >
        Ultra 1.0
      </div>
    </div>
  );
};

// ─── Kinetic text (centered, with colored accent word) ───

const KineticText: React.FC<{
  frame: number;
  fps: number;
  text: string;
  accentWord: string;
  enterFrame: number;
  holdFrames?: number;
  accentGradient?: string;
  glowColor?: string;
}> = ({ frame, fps, text, accentWord, enterFrame, holdFrames = 30, accentGradient = GRADIENT_TEXT, glowColor = PURPLE }) => {
  const localFrame = frame - enterFrame;
  if (localFrame < 0) return null;

  // Split into words, tag which belong to accent phrase
  const words = text.split(" ");
  const accentWords = new Set(accentWord.split(" "));

  // Variable burst timing per word — short words arrive fast, long words deliberate
  const wordFrames: number[] = [];
  let wCum = 0;
  for (let i = 0; i < words.length; i++) {
    const delay = i === 0 ? 0 : (words[i].length > 4 ? 5 : 3) + (i % 2 === 0 ? 2 : 0);
    wCum += delay;
    wordFrames.push(wCum);
  }

  // Smoothstep exit
  const exitRaw = interpolate(localFrame, [holdFrames, holdFrames + 10], [0, 1], clamp());
  const exitSmooth = exitRaw * exitRaw * (3 - 2 * exitRaw);
  const exitOpacity = 1 - exitSmooth;

  // Global entry Y — smoothstep
  const entryRaw = interpolate(localFrame, [0, 12], [0, 1], clamp());
  const entrySmooth = entryRaw * entryRaw * (3 - 2 * entryRaw);
  const entryY = 22 * (1 - entrySmooth);

  // Accent word glow animation
  const glowIntensity = interpolate(localFrame, [4, 15, holdFrames - 5], [0, 1, 0.6], clamp());

  return (
    <div
      style={{
        position: "absolute",
        top: "50%",
        left: "50%",
        transform: `translate(-50%, -50%) translateY(${entryY}px)`,
        fontSize: 42,
        fontFamily: FONT,
        fontWeight: 300,
        color: "#fff",
        opacity: exitOpacity,
        whiteSpace: "nowrap",
        letterSpacing: -0.5,
        display: "flex",
        gap: "0.3em",
      }}
    >
      {words.map((word, i) => {
        const wordLocal = localFrame - wordFrames[i];
        const isAccent = accentWords.has(word);

        // Per-word spring pop
        const wordSpring = wordLocal >= 0
          ? spring({ frame: wordLocal, fps, config: { damping: 10, stiffness: 200, mass: 0.4 } })
          : 0;
        const wordOp = interpolate(wordLocal, [-1, 0, 4], [0, 0.3, 1], clamp());
        const wordScale = 0.85 + 0.15 * wordSpring;
        const wordY = wordLocal >= 0
          ? interpolate(wordSpring, [0, 1], [8, 0])
          : 8;
        // Motion blur during word entrance + noise wobble
        const prevWordSpring = wordLocal > 0
          ? spring({ frame: wordLocal - 1, fps, config: { damping: 10, stiffness: 200, mass: 0.4 } })
          : 0;
        const prevWordY = wordLocal > 0 ? interpolate(prevWordSpring, [0, 1], [8, 0]) : 8;
        const wordBlur = Math.min(Math.abs(wordY - prevWordY) * 0.3, 4);
        const wNx = organicOffset(frame, `kt${i}x`, 0.02, 2);
        const wNy = organicOffset(frame, `kt${i}y`, 0.025, 1.5);

        return (
          <span
            key={i}
            style={{
              display: "inline-block",
              opacity: wordOp,
              transform: `scale(${wordScale}) translate(${wNx}px, ${wordY + wNy}px)`,
              ...(isAccent ? {
                background: accentGradient,
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text" as const,
                textShadow: "none",
                filter: `drop-shadow(0 0 ${12 * glowIntensity}px ${glowColor})${wordBlur > 0.3 ? ` blur(${wordBlur.toFixed(1)}px)` : ""}`,
              } : {
                filter: wordBlur > 0.3 ? `blur(${wordBlur.toFixed(1)}px)` : undefined,
              }),
            }}
          >
            {word}
          </span>
        );
      })}
    </div>
  );
};

// ─── Typewriter text — variable speed, space pauses, micro-bounce cursor ───

const TypewriterText: React.FC<{
  frame: number;
  fps: number;
  text: string;
  enterFrame: number;
  holdFrames?: number;
}> = ({ frame, fps, text, enterFrame, holdFrames = 30 }) => {
  const localFrame = frame - enterFrame;
  if (localFrame < 0) return null;

  // Variable per-character timing: spaces pause, punctuation lingers, consonants brisk
  const charDelays: number[] = text.split("").map((ch) => {
    if (ch === " ") return 5;          // perceptible pause at word boundary
    if (ch === "," || ch === ".") return 7; // punctuation dwells
    if (ch === ch.toUpperCase() && ch !== ch.toLowerCase()) return 4; // capitals deliberate
    if ("aeiou".includes(ch.toLowerCase())) return 2.2; // vowels quick
    return 2.8; // consonants standard
  });
  const charThresholds: number[] = [];
  let cum = 0;
  for (const d of charDelays) { cum += d; charThresholds.push(cum); }

  const charsVisible = Math.min(text.length, charThresholds.filter((t) => localFrame >= t).length);
  const isTyping = charsVisible < text.length;

  // Exit with smoothstep fade
  const exitRaw = interpolate(localFrame, [holdFrames, holdFrames + 10], [0, 1], clamp());
  const exitSmooth = exitRaw * exitRaw * (3 - 2 * exitRaw);
  const exitOpacity = 1 - exitSmooth;

  // Micro-bounce cursor: spring-based Y offset that fires on each new character
  const lastCharFrame = charsVisible > 0 ? charThresholds[charsVisible - 1] : 0;
  const sinceLastChar = localFrame - lastCharFrame;
  const cursorBounceY = isTyping
    ? spring({ frame: Math.min(sinceLastChar, 8), fps, config: { damping: 6, stiffness: 300, mass: 0.3 } }) * -3
    : 0;
  // Blink only when not actively typing
  const cursorOpacity = isTyping
    ? 1
    : (Math.sin(localFrame * 0.5) > 0 ? 0.9 : 0.15);

  // Subtle entry Y shift
  const entryY = interpolate(localFrame, [0, 12], [14, 0], { ...clamp(), easing: Easing.out(Easing.cubic) });

  const twWobX = organicOffset(frame, "twx", 0.02, 2);
  const twWobY = organicOffset(frame, "twy", 0.025, 1.5);

  return (
    <div
      style={{
        position: "absolute",
        top: "50%",
        left: "50%",
        transform: `translate(calc(-50% + ${twWobX}px), calc(-50% + ${entryY + twWobY}px))`,
        fontSize: 42,
        fontFamily: FONT,
        fontWeight: 300,
        color: "#fff",
        opacity: exitOpacity,
        whiteSpace: "nowrap",
      }}
    >
      {text.slice(0, charsVisible)}
      <span
        style={{
          display: "inline-block",
          opacity: cursorOpacity,
          color: "rgba(255,255,255,0.5)",
          transform: `translateY(${cursorBounceY}px)`,
        }}
      >
        _
      </span>
    </div>
  );
};

// ─── Card zoom (single card, larger, angled) — spring + arc + noise ───

const CardZoom: React.FC<{
  frame: number;
  fps: number;
  cardIndex: number;
  enterFrame: number;
  holdFrames: number;
  rotateY?: number;
  offsetX?: number;
}> = ({ frame, fps, cardIndex, enterFrame, holdFrames, rotateY = -8, offsetX = 0 }) => {
  const localFrame = frame - enterFrame;
  if (localFrame < 0 || localFrame > holdFrames + 15) return null;

  // Spring-based scale entrance — overshoots then settles
  const entrySpring = spring({
    frame: localFrame,
    fps,
    config: { damping: 11, stiffness: 110, mass: 0.7 },
  });
  const entryScale = 0.6 + 0.4 * entrySpring;

  // Smoothstep entry opacity
  const entryRaw = interpolate(localFrame, [0, 10], [0, 1], clamp());
  const entryOpacity = entryRaw * entryRaw * (3 - 2 * entryRaw);
  // Smoothstep exit opacity
  const exitRaw = interpolate(localFrame, [holdFrames, holdFrames + 12], [0, 1], clamp());
  const exitOpacity = 1 - exitRaw * exitRaw * (3 - 2 * exitRaw);
  const op = Math.min(entryOpacity, exitOpacity);

  // Arc entrance: card sweeps in on a curved path (parabolic Y)
  const entryProgress = interpolate(localFrame, [0, 18], [0, 1], clamp());
  const smoothEntry = entryProgress * entryProgress * (3 - 2 * entryProgress); // smoothstep
  const arcY = -45 * Math.sin(smoothEntry * Math.PI); // parabolic arc
  const arcX = interpolate(smoothEntry, [0, 1], [90, 0]); // smoothstep the X too

  // Exit arc sweep — card drifts upward and right as it fades
  const exitProgress = interpolate(localFrame, [holdFrames, holdFrames + 12], [0, 1], clamp());
  const exitSS = exitProgress * exitProgress * (3 - 2 * exitProgress);
  const exitArcY = -30 * exitSS;
  const exitArcX = 40 * exitSS;

  // Noise-based micro-drift during hold
  const noiseX = organicOffset(frame, `czX${cardIndex}`, 0.018, 1.5);
  const noiseY = organicOffset(frame, `czY${cardIndex}`, 0.02, 1.0);
  const noiseRot = organicOffset(frame, `czR${cardIndex}`, 0.015, 0.4);

  // Motion blur — entry AND exit phases
  const entryBlur = localFrame < 18 ? interpolate(localFrame, [0, 8, 18], [4, 2, 0], clamp()) : 0;
  const exitBlur = exitProgress > 0 ? interpolate(exitProgress, [0, 0.5, 1], [0, 2, 3], clamp()) : 0;
  const blurTotal = Math.max(entryBlur, exitBlur);

  return (
    <div
      style={{
        position: "absolute",
        top: "50%",
        left: "50%",
        transform: `translate(-50%, -50%) perspective(800px) rotateY(${rotateY + noiseRot}deg) scale(${entryScale * 1.8}) translateX(${offsetX + arcX + exitArcX + noiseX}px) translateY(${arcY + exitArcY + noiseY}px)`,
        opacity: op,
        filter: blurTotal > 0.1 ? `blur(${blurTotal}px)` : "none",
      }}
    >
      <PromptCard card={CARDS[cardIndex]} width={220} />
    </div>
  );
};

// ─── Cards pan (two cards side by side) — noise float + staggered springs ───

const CardsPan: React.FC<{
  frame: number;
  fps: number;
  cardIndices: number[];
  enterFrame: number;
  holdFrames: number;
}> = ({ frame, fps, cardIndices, enterFrame, holdFrames }) => {
  const localFrame = frame - enterFrame;
  if (localFrame < 0 || localFrame > holdFrames + 15) return null;

  // Smoothstep-based pan instead of cubic — feels weightier
  const panRaw = interpolate(localFrame, [0, holdFrames], [0, 1], clamp());
  const panSmooth = panRaw * panRaw * (3 - 2 * panRaw);
  const panX = interpolate(panSmooth, [0, 1], [120, -120]);

  // Smoothstep entry/exit opacity
  const entryRaw = interpolate(localFrame, [0, 12], [0, 1], clamp());
  const entryOpacity = entryRaw * entryRaw * (3 - 2 * entryRaw);
  const exitRaw = interpolate(localFrame, [holdFrames - 5, holdFrames + 8], [0, 1], clamp());
  const exitOpacity = 1 - exitRaw * exitRaw * (3 - 2 * exitRaw);
  const op = Math.min(entryOpacity, exitOpacity);

  // Noise-based ambient sway for the whole group
  const groupNoiseX = organicOffset(frame, "panGX", 0.012, 2);
  const groupNoiseY = organicOffset(frame, "panGY", 0.015, 1.2);

  // Motion blur during fast pan phases + exit
  const panVelocity = Math.abs(panRaw - interpolate(localFrame - 1, [0, holdFrames], [0, 1], clamp())) * 200;
  const exitBlur = exitRaw > 0 ? interpolate(exitRaw, [0, 0.5, 1], [0, 1.5, 2.5], clamp()) : 0;
  const blurAmt = Math.max(Math.min(panVelocity * 3, 3), exitBlur);

  return (
    <div
      style={{
        position: "absolute",
        top: "50%",
        left: "50%",
        transform: `translate(-50%, -50%) perspective(800px) rotateY(-5deg) translateX(${panX + groupNoiseX}px) translateY(${groupNoiseY}px)`,
        display: "flex",
        gap: 20,
        opacity: op,
        filter: blurAmt > 0.2 ? `blur(${blurAmt}px)` : "none",
      }}
    >
      {cardIndices.map((idx, i) => {
        // Staggered spring entrance per card
        const cardSpring = spring({
          frame: Math.max(0, localFrame - i * 4),
          fps,
          config: { damping: 13, stiffness: 100, mass: 0.6 + i * 0.15 },
        });
        // Individual noise float
        const cardNoiseY = organicOffset(frame, `panC${idx}Y`, 0.02, 1.5);
        const cardNoiseRot = organicOffset(frame, `panC${idx}R`, 0.018, 0.6);
        return (
          <div
            key={idx}
            style={{
              transform: `scale(${1.35 + 0.15 * cardSpring}) translateY(${cardNoiseY}px) rotate(${cardNoiseRot}deg)`,
            }}
          >
            <PromptCard card={CARDS[idx]} width={200} />
          </div>
        );
      })}
    </div>
  );
};

// ─── Scatter text ("With access to") ───

const ScatterText: React.FC<{
  frame: number;
  fps: number;
  enterFrame: number;
  holdFrames: number;
}> = ({ frame, fps, enterFrame, holdFrames }) => {
  const localFrame = frame - enterFrame;
  if (localFrame < 0 || localFrame > holdFrames + 15) return null;

  // Each letter gets its own scatter trajectory
  const allChars = "With access to".split("");

  // Smoothstep entry instead of linear
  const entryRaw = interpolate(localFrame, [0, 10], [0, 1], clamp());
  const entryOpacity = entryRaw * entryRaw * (3 - 2 * entryRaw);
  const entryY = 18 * (1 - entryOpacity);
  const scatterStart = holdFrames - 12;

  const isAccentChar = (idx: number) => idx >= 5 && idx <= 10;

  return (
    <div
      style={{
        position: "absolute",
        top: "50%",
        left: "50%",
        transform: `translate(-50%, -50%) translateY(${entryY}px)`,
        display: "flex",
        fontSize: 42,
        fontFamily: FONT,
        fontWeight: 300,
      }}
    >
      {allChars.map((ch, i) => {
        const scatterRaw = interpolate(
          localFrame,
          [scatterStart, holdFrames + 10],
          [0, 1],
          clamp()
        );
        // Smoothstep the scatter for organic deceleration at start
        const scatterProgress = scatterRaw * scatterRaw * (3 - 2 * scatterRaw);

        // Each character scatters in its own direction using seeded angle
        const seed = (i * 137.5) % 360; // golden angle spread
        const dist = (60 + (i % 3) * 40) * scatterProgress;
        const dx = Math.sin((seed * Math.PI) / 180) * dist;
        const dy = Math.cos((seed * Math.PI) / 180) * dist * 0.6;
        const rot = ((i - 7) * 25) * scatterProgress;
        const scatterOp = interpolate(scatterProgress, [0.3, 1], [1, 0], clamp());

        const accent = isAccentChar(i);
        const glowAmt = interpolate(localFrame, [4, 12], [0, 1], clamp());

        // Motion blur per character proportional to scatter velocity
        const charBlur = scatterProgress > 0.02 && scatterProgress < 0.8
          ? interpolate(scatterProgress, [0, 0.3, 0.8], [0, 2.5, 0], clamp())
          : 0;

        return (
          <span
            key={i}
            style={{
              display: "inline-block",
              color: accent ? undefined : "#fff",
              background: accent ? `linear-gradient(90deg, ${PURPLE}, ${PINK})` : undefined,
              WebkitBackgroundClip: accent ? "text" : undefined,
              WebkitTextFillColor: accent ? "transparent" : undefined,
              filter: accent
                ? `drop-shadow(0 0 ${12 * glowAmt}px ${PURPLE})${charBlur > 0.1 ? ` blur(${charBlur}px)` : ""}`
                : charBlur > 0.1 ? `blur(${charBlur}px)` : undefined,
              transform: scatterProgress > 0
                ? `translate(${dx}px, ${dy}px) rotate(${rot}deg)`
                : "none",
              opacity: Math.min(entryOpacity, scatterOp),
              width: ch === " " ? "0.3em" : undefined,
            }}
          >
            {ch}
          </span>
        );
      })}
    </div>
  );
};

// ─── Experience Gemini end card ───

const ExperienceGemini: React.FC<{
  frame: number;
  fps: number;
  enterFrame: number;
}> = ({ frame, fps, enterFrame }) => {
  const localFrame = frame - enterFrame;
  if (localFrame < 0) return null;

  // --- Title: smoothstep word-burst ---
  const titleRaw = interpolate(localFrame, [0, 12], [0, 1], clamp());
  const titleSmooth = titleRaw * titleRaw * (3 - 2 * titleRaw);
  const titleOp = titleSmooth;
  const titleY = 16 * (1 - titleSmooth);

  // --- URL: smoothstep delayed ---
  const urlRaw = interpolate(localFrame, [10, 22], [0, 1], clamp());
  const urlSmooth = urlRaw * urlRaw * (3 - 2 * urlRaw);
  const urlOp = urlSmooth;

  // --- Phone: ARC SWEEP entrance (rises on curved path from bottom-left) ---
  const phoneEntryRaw = interpolate(localFrame, [15, 38], [0, 1], clamp());
  const phoneSS = phoneEntryRaw * phoneEntryRaw * (3 - 2 * phoneEntryRaw); // smoothstep
  const phoneArcY = interpolate(phoneSS, [0, 1], [220, 0]);
  const phoneArcX = interpolate(phoneSS, [0, 1], [-60, 0]);
  // Parabolic arc overshoot — rises above target then settles
  const phoneArcBounce = -35 * Math.sin(phoneSS * Math.PI);
  const phoneRotZ = interpolate(phoneSS, [0, 1], [8, 0]); // slight tilt during sweep
  const phoneOp = interpolate(localFrame, [15, 22], [0, 1], clamp());
  // Organic drift during hold
  const phoneDriftX = organicOffset(frame, "expPhX", 0.012, 1.5);
  const phoneDriftY = organicOffset(frame, "expPhY", 0.015, 1.0);

  // --- Desktop: ARC SWEEP entrance (slides in on curved path from right) ---
  const desktopEntryRaw = interpolate(localFrame, [20, 42], [0, 1], clamp());
  const desktopSS = desktopEntryRaw * desktopEntryRaw * (3 - 2 * desktopEntryRaw);
  const desktopArcX = interpolate(desktopSS, [0, 1], [280, 0]);
  const desktopArcY = -25 * Math.sin(desktopSS * Math.PI); // arc upward
  const desktopRotZ = interpolate(desktopSS, [0, 1], [-4, 0]);
  const desktopOp = interpolate(localFrame, [20, 28], [0, 1], clamp());
  const desktopDriftX = organicOffset(frame, "expDkX", 0.01, 1.2);
  const desktopDriftY = organicOffset(frame, "expDkY", 0.013, 0.8);

  // Shrink as devices arrive — smoothstep
  const scaleRaw = interpolate(localFrame, [15, 42], [0, 1], clamp());
  const scaleSS = scaleRaw * scaleRaw * (3 - 2 * scaleRaw);
  const contentScale = 1 - 0.15 * scaleSS;

  // Motion blur during entrance phase — proportional to velocity
  const phoneBlur = phoneEntryRaw < 1
    ? interpolate(localFrame, [15, 22, 38], [3, 2, 0], clamp())
    : 0;
  const desktopBlur = desktopEntryRaw < 1
    ? interpolate(localFrame, [20, 28, 42], [2.5, 1.5, 0], clamp())
    : 0;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "flex-start",
        paddingTop: 60,
      }}
    >
      {/* Title — smoothstep Y entry */}
      <div
        style={{
          fontSize: 36,
          fontFamily: FONT,
          fontWeight: 400,
          color: "#fff",
          opacity: titleOp,
          transform: `translateY(${titleY}px)`,
          marginBottom: 8,
        }}
      >
        Experience{" "}
        <GradientText gradient={`linear-gradient(90deg, ${BLUE}, ${PURPLE})`}>
          Gemini
        </GradientText>
      </div>
      {/* URL */}
      <div
        style={{
          fontSize: 14,
          fontFamily: FONT,
          color: "rgba(255,255,255,0.4)",
          opacity: urlOp,
          marginBottom: 40,
        }}
      >
        gemini.google.com
      </div>

      {/* Devices — centered row */}
      <div
        style={{
          display: "flex",
          gap: 60,
          alignItems: "center",
          justifyContent: "center",
          transform: `scale(${contentScale})`,
          marginTop: 10,
        }}
      >
        {/* Phone — arc sweep from bottom-left */}
        <div
          style={{
            transform: `translateX(${phoneArcX + phoneDriftX}px) translateY(${phoneArcY + phoneArcBounce + phoneDriftY}px) rotate(${phoneRotZ}deg)`,
            opacity: phoneOp,
            filter: phoneBlur > 0.1 ? `blur(${phoneBlur}px)` : "none",
          }}
        >
          <PhoneMockup scale={0.85} rotateY={6} />
        </div>
        {/* Desktop — arc sweep from right */}
        <div
          style={{
            transform: `translateX(${desktopArcX + desktopDriftX}px) translateY(${desktopArcY + desktopDriftY}px) rotate(${desktopRotZ}deg)`,
            opacity: desktopOp,
            filter: desktopBlur > 0.1 ? `blur(${desktopBlur}px)` : "none",
          }}
        >
          <div style={{ transform: "scale(0.58)", transformOrigin: "top left" }}>
            <GeminiInterface frame={90} fps={fps} perspectiveY={-3} />
          </div>
        </div>
      </div>
    </div>
  );
};

// ═══ MAIN SCENE ═══

export const Scene05: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // ─── Sub-segment timing (frame offsets) ───
  // A: 0-30       G logo + phone emerges from dark
  // B: 30-75      Phone tilts, "Gemini Advanced" header visible
  // C: 75-130     Interface straightens, "Hello, Lisa." types in
  // D: 130-180    Full interface with cards visible
  // E: 180-220    "Our most capable AI"
  // F: 220-260    "for reasoning"
  // G: 260-310    Zoom card 0 (solving a problem)
  // H: 310-350    "coding" typewriter
  // I: 350-400    Zoom card 1 (HTML/CSS/JS) + pan to card 0
  // J: 400-430    "and more"
  // K: 430-480    Pan cards 2+3 (images + roleplay)
  // L: 480-520    "With access to" scatter
  // M: 520-570    Ultra 1.0 orb
  // N: 570-640    "Experience Gemini" + devices
  // O: 640-670    Gemini sparkle
  // P: 670-694    Google G logo + fade

  // ─── A: Dark void + G logo materializes with organic pulsing glow ───
  const gLogoInitialOp = fadeInOut(frame, 0, 15, 20, 15);
  const gLogoInitialScale = interpolate(frame, [0, 30], [0.4, 0.6], clamp());

  // ─── B+C: Interface on CURVED ARC with spring oscillation ───
  const interfacePhase = frame >= 30 && frame < 180;
  const interfaceOpacity = interfacePhase
    ? Math.min(fadeIn(frame, 30, 12), fadeOut(frame, 165, 15))
    : 0;
  const ifLocalFrame = Math.max(0, frame - 30);
  // Slow spring — starts dramatically tilted, settles with visible oscillation
  const interfaceSpringY = spring({
    frame: ifLocalFrame,
    fps,
    config: { damping: 7, stiffness: 30, mass: 1.4 },
  });
  const interfaceSpringX = spring({
    frame: ifLocalFrame,
    fps,
    config: { damping: 8, stiffness: 35, mass: 1.2 },
  });
  // Steep initial angles — nearly edge-on from below-left, matching reference
  const interfacePerspectiveY = interpolate(interfaceSpringY, [0, 1], [50, 0]);
  const interfacePerspectiveX = interpolate(interfaceSpringX, [0, 1], [22, 0]);
  const interfaceScaleSpring = spring({
    frame: ifLocalFrame,
    fps,
    config: { damping: 9, stiffness: 35, mass: 1.0 },
  });
  // Starts zoomed in (close up on header like ref), zooms out to full view
  const interfaceScale = interpolate(interfaceScaleSpring, [0, 1], [1.3, 0.95]);
  // Vertical sweep: enters from below
  const interfaceTranslateYSpring = spring({
    frame: ifLocalFrame,
    fps,
    config: { damping: 9, stiffness: 40, mass: 1.1 },
  });
  const interfaceTranslateY = interpolate(interfaceTranslateYSpring, [0, 1], [80, 0]);
  // Local frame for interface typing (starts at frame 75)
  const interfaceLocalFrame = Math.max(0, frame - 75);
  // Noise-based micro-drift for the interface panel
  const ifaceDriftX = organicOffset(frame, "ifaceX", 0.01, 1.2);
  const ifaceDriftY = organicOffset(frame, "ifaceY", 0.012, 0.8);

  // ─── D: Hold on full interface ───
  // (same as C, just holding)

  // ─── O: Gemini sparkle — smoothstep + spring scale ───
  const sparklePhase = frame >= 640 && frame < 670;
  const sparkleLocal = frame - 640;
  const sparkleEntryRaw = sparklePhase ? interpolate(sparkleLocal, [0, 10], [0, 1], clamp()) : 0;
  const sparkleEntrySS = sparkleEntryRaw * sparkleEntryRaw * (3 - 2 * sparkleEntryRaw);
  const sparkleExitRaw = sparklePhase ? interpolate(sparkleLocal, [20, 30], [0, 1], clamp()) : 0;
  const sparkleExitSS = 1 - sparkleExitRaw * sparkleExitRaw * (3 - 2 * sparkleExitRaw);
  const sparkleOp = Math.min(sparkleEntrySS, sparkleExitSS);
  const sparkleScaleSpring = sparklePhase
    ? spring({ frame: sparkleLocal, fps, config: { damping: 8, stiffness: 120, mass: 0.5 } })
    : 0;
  const sparkleScale = 0.15 + 0.85 * sparkleScaleSpring;
  const sparkleGlow = sparklePhase
    ? interpolate(sparkleLocal, [0, 8, 25], [0, 1, 0.3], clamp())
    : 0;
  const sparkleRotation = sparklePhase ? organicOffset(frame, "spkRot", 0.04, 15) : 0;

  // ─── P: Google G finale — smoothstep + spring + organic drift ───
  const gFinalPhase = frame >= 660;
  const gFinalLocal = frame - 660;
  const gEntryRaw = gFinalPhase ? interpolate(gFinalLocal, [0, 12], [0, 1], clamp()) : 0;
  const gEntrySS = gEntryRaw * gEntryRaw * (3 - 2 * gEntryRaw);
  const gExitRaw = gFinalPhase ? interpolate(gFinalLocal, [28, 34], [0, 1], clamp()) : 0;
  const gExitSS = 1 - gExitRaw * gExitRaw * (3 - 2 * gExitRaw);
  const gFinalOp = Math.min(gEntrySS, gExitSS);
  const gFinalGlow = gFinalPhase
    ? interpolate(gFinalLocal, [0, 15, 30], [0, 1, 0.5], clamp())
    : 0;
  const gFinalScaleSpring = gFinalPhase
    ? spring({ frame: gFinalLocal, fps, config: { damping: 10, stiffness: 100, mass: 0.6 } })
    : 0;
  const gFinalScale = 0.5 + 0.5 * gFinalScaleSpring;
  const gDriftX = gFinalPhase ? organicOffset(frame, "gFinX", 0.015, 1.5) : 0;
  const gDriftY = gFinalPhase ? organicOffset(frame, "gFinY", 0.018, 1.0) : 0;

  // ─── Bottom disclaimer (visible during interface phases) ───
  const disclaimerOp = interfacePhase
    ? interpolate(frame, [50, 60, 160, 170], [0, 0.4, 0.4, 0], clamp())
    : 0;

  return (
    <AbsoluteFill style={{ backgroundColor: BG }}>
      {/* AMBIENT PURPLE GLOW — multi-source pulsing, stronger in first half (frames 0-350) */}
      {(() => {
        // Primary purple pulse: sine + noise, boosted in frames 0-350
        const firstHalfBoost = frame < 350 ? 1.6 : 1.0;
        const bgGlowIntensity = breathingGlow(frame, 0.035, 0.025, 0.06) * firstHalfBoost;
        // Secondary pulse at different frequency — creates interference pattern
        const bgGlow2 = breathingGlow(frame, 0.02, 0.015, 0.045) * firstHalfBoost;
        // Wandering glow positions — the light source drifts
        const bgGlowOffsetX = 50 + organicOffset(frame, "bgX", 0.008, 5);
        const bgGlowOffsetY = 50 + organicOffset(frame, "bgY", 0.009, 4);
        // Third source wanders independently
        const bgGlow3X = 30 + organicOffset(frame, "bg3X", 0.006, 8);
        const bgGlow3Y = 70 + organicOffset(frame, "bg3Y", 0.007, 6);
        return (
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: `
                radial-gradient(ellipse at 50% 50%, transparent 40%, rgba(0,0,0,0.3) 100%),
                radial-gradient(ellipse at ${bgGlowOffsetX}% ${bgGlowOffsetY}%, rgba(139,92,246,${bgGlowIntensity}) 0%, transparent 55%),
                radial-gradient(ellipse at ${100 - bgGlowOffsetX}% ${100 - bgGlowOffsetY}%, rgba(59,130,246,${bgGlow2 * 0.6}) 0%, transparent 50%),
                radial-gradient(ellipse at ${bgGlow3X}% ${bgGlow3Y}%, rgba(168,85,247,${bgGlow2 * 0.4}) 0%, transparent 45%)
              `,
              pointerEvents: "none",
              zIndex: 0,
            }}
          />
        );
      })()}

      {/* A: G logo materializes with multi-layer breathing glow + phone ARC SWEEP */}
      {frame < 35 && (
        <>
          {/* Phone: parabolic arc sweep from bottom-left to upper-center-left.
              The arc is parametric: t goes 0->1, x sweeps right, y follows a parabola (rises then levels).
              Rotation CHANGES during the arc — starts nearly edge-on, pivots mid-arc, settles angled. */}
          {(() => {
            const arcT = interpolate(frame, [0, 28], [0, 1], { ...clamp(), easing: Easing.out(Easing.quad) });
            // Parametric arc: phone sweeps from (-120, 180) to (0, 0) relative to anchor
            const arcX = interpolate(arcT, [0, 1], [-120, 0]);
            const arcY = -180 * Math.sin(arcT * Math.PI * 0.55) + interpolate(arcT, [0, 1], [180, 0]);
            // Rotation pivots: starts rotateY=35deg (nearly edge-on), hits 5deg at midpoint, settles at 15deg
            const rotY = interpolate(arcT, [0, 0.4, 0.7, 1], [35, 5, 10, 15]);
            // rotateX tilts forward initially, relaxes
            const rotX = interpolate(arcT, [0, 0.5, 1], [-14, -2, -5]);
            // Scale blooms slightly mid-arc then settles
            const arcScale = interpolate(arcT, [0, 0.5, 1], [0.25, 0.5, 0.42]);
            const noiseX = organicOffset(frame, "phoneAx", 0.02, 1.5);
            const noiseY = organicOffset(frame, "phoneAy", 0.025, 1.0);
            return (
              <div
                style={{
                  position: "absolute",
                  top: "28%",
                  left: "22%",
                  transform: `perspective(600px) rotateY(${rotY}deg) rotateX(${rotX}deg) scale(${arcScale}) translate(${arcX + noiseX}px, ${arcY + noiseY}px)`,
                  opacity: interpolate(frame, [0, 6, 22, 32], [0, 0.3, 0.3, 0], clamp()),
                }}
              >
                <PhoneMockup scale={0.6} rotateY={0} />
              </div>
            );
          })()}
          {/* G logo — materializes with MULTI-LAYER breathing glow */}
          <div
            style={{
              position: "absolute",
              top: "38%",
              left: "35%",
              transform: `scale(${gLogoInitialScale}) translate(${organicOffset(frame, "glogoX", 0.02, 2)}px, ${organicOffset(frame, "glogoY", 0.025, 1.5)}px)`,
              opacity: gLogoInitialOp,
            }}
          >
            <Glow color={PURPLE} spread={breathingGlow(frame, 25, 20, 0.15)}>
              <GoogleG size={50} glowIntensity={0.8} frame={frame} />
            </Glow>
          </div>
        </>
      )}

      {/* B+C+D: Gemini interface — motion blur during fast tilt, clean after */}
      {interfacePhase && frame < 65 && (
        <CameraMotionBlur samples={6} shutterAngle={120}>
          <AbsoluteFill>
            <div
              style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
              }}
            >
              <GeminiInterface
                frame={interfaceLocalFrame}
                fps={fps}
                perspectiveX={interfacePerspectiveX}
                perspectiveY={interfacePerspectiveY}
                scale={interfaceScale}
                opacity={interfaceOpacity}
                translateX={ifaceDriftX}
                translateY={interfaceTranslateY + ifaceDriftY}
              />
            </div>
          </AbsoluteFill>
        </CameraMotionBlur>
      )}
      {interfacePhase && frame >= 65 && (
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
          }}
        >
          <GeminiInterface
            frame={interfaceLocalFrame}
            fps={fps}
            perspectiveX={interfacePerspectiveX}
            perspectiveY={interfacePerspectiveY}
            scale={interfaceScale}
            opacity={interfaceOpacity}
            translateX={ifaceDriftX}
            translateY={interfaceTranslateY + ifaceDriftY}
          />
        </div>
      )}

      {/* E: "Our most capable AI" + Gemini sparkle behind */}
      {frame >= 180 && frame < 220 && (
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
          }}
        >
          {/* Faint sparkle below text */}
          <div
            style={{
              position: "absolute",
              top: 30,
              left: "50%",
              transform: "translateX(-50%)",
              opacity: interpolate(frame, [183, 195, 210, 218], [0, 0.4, 0.3, 0], clamp()),
            }}
          >
            <GeminiSparkle size={35} opacity={1} color="rgba(139,92,246,0.6)" />
          </div>
          {/* Curved decorative lines at edges */}
          <svg
            width={800}
            height={400}
            viewBox="0 0 800 400"
            style={{
              position: "absolute",
              top: -150,
              left: -370,
              opacity: interpolate(frame, [182, 192, 210, 218], [0, 0.2, 0.15, 0], clamp()),
              pointerEvents: "none",
            }}
          >
            <path
              d="M 50 200 Q 150 50, 400 200"
              fill="none"
              stroke={BLUE}
              strokeWidth={1.5}
              opacity={0.4}
            />
            <path
              d="M 750 200 Q 650 350, 400 200"
              fill="none"
              stroke={PINK}
              strokeWidth={1.5}
              opacity={0.4}
            />
          </svg>
        </div>
      )}
      <KineticText
        frame={frame}
        fps={fps}
        text="Our most capable AI"
        accentWord="most capable"
        enterFrame={180}
        holdFrames={35}
        accentGradient={`linear-gradient(90deg, ${PURPLE}cc, ${BLUE}cc)`}
        glowColor="rgba(139,92,246,0.4)"
      />

      {/* F: "for reasoning" */}
      <KineticText
        frame={frame}
        fps={fps}
        text="for reasoning"
        accentWord="reasoning"
        enterFrame={220}
        holdFrames={35}
        accentGradient={`linear-gradient(90deg, ${PURPLE}aa, ${BLUE}aa)`}
        glowColor="rgba(99,102,241,0.3)"
      />

      {/* G-K: Faint interface backdrop during card zoom sections only (not text sections) */}
      {((frame >= 255 && frame < 310) || (frame >= 345 && frame < 400) || (frame >= 425 && frame < 480)) && (
        <div
          style={{
            position: "absolute",
            top: "-15%",
            left: "50%",
            transform: "translate(-50%, 0) scale(1.1)",
            opacity: (() => {
              if (frame >= 255 && frame < 310)
                return interpolate(frame, [255, 265, 300, 310], [0, 0.12, 0.12, 0], clamp());
              if (frame >= 345 && frame < 400)
                return interpolate(frame, [345, 355, 390, 400], [0, 0.10, 0.10, 0], clamp());
              return interpolate(frame, [425, 435, 470, 480], [0, 0.10, 0.10, 0], clamp());
            })(),
            filter: "blur(1px)",
            pointerEvents: "none",
          }}
        >
          <GeminiInterface frame={90} fps={fps} />
        </div>
      )}

      {/* G: Card zoom — "Walk me through solving a problem" */}
      <CardZoom
        frame={frame}
        fps={fps}
        cardIndex={0}
        enterFrame={260}
        holdFrames={45}
        rotateY={-6}
        offsetX={-30}
      />

      {/* H: "coding" typewriter — variable speed, micro-bounce cursor */}
      <TypewriterText
        frame={frame}
        fps={fps}
        text="coding"
        enterFrame={310}
        holdFrames={35}
      />

      {/* I: Card zoom — "Help me write HTML, CSS, and JS" + cards in perspective */}
      <CardZoom
        frame={frame}
        fps={fps}
        cardIndex={1}
        enterFrame={350}
        holdFrames={45}
        rotateY={-5}
        offsetX={20}
      />

      {/* Also show card 0 peeking from left during I */}
      {frame >= 350 && frame < 400 && (
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "8%",
            transform: `translateY(-50%) perspective(800px) rotateY(8deg) scale(1.2)`,
            opacity: interpolate(frame, [350, 360, 390, 400], [0, 0.4, 0.4, 0], clamp()),
          }}
        >
          <PromptCard card={CARDS[0]} width={160} />
        </div>
      )}

      {/* J: "and more" */}
      <KineticText
        frame={frame}
        fps={fps}
        text="and more"
        accentWord="more"
        enterFrame={400}
        holdFrames={25}
        accentGradient={`linear-gradient(90deg, rgba(200,190,220,1), rgba(180,170,210,1))`}
        glowColor="rgba(139,92,246,0.2)"
      />

      {/* K: Pan across cards 2+3 */}
      <CardsPan
        frame={frame}
        fps={fps}
        cardIndices={[2, 3]}
        enterFrame={430}
        holdFrames={45}
      />

      {/* L: "With access to" scatter */}
      <ScatterText
        frame={frame}
        fps={fps}
        enterFrame={480}
        holdFrames={35}
      />

      {/* M: Ultra 1.0 orb — smoothstep entry/exit + motion blur */}
      {frame >= 520 && frame < 575 && (() => {
        const orbLocal = frame - 520;
        // Smoothstep entry
        const orbEntryRaw = interpolate(orbLocal, [0, 12], [0, 1], clamp());
        const orbEntrySS = orbEntryRaw * orbEntryRaw * (3 - 2 * orbEntryRaw);
        // Smoothstep exit
        const orbExitRaw = interpolate(orbLocal, [40, 54], [0, 1], clamp());
        const orbExitSS = 1 - orbExitRaw * orbExitRaw * (3 - 2 * orbExitRaw);
        const orbOp = Math.min(orbEntrySS, orbExitSS);
        // Scale with spring overshoot
        const orbScaleSpring = spring({
          frame: orbLocal,
          fps,
          config: { damping: 9, stiffness: 80, mass: 0.8 },
        });
        const orbScale = 0.4 + 0.6 * orbScaleSpring;
        // Motion blur during scale-up phase
        const orbBlur = orbLocal < 15 ? interpolate(orbLocal, [0, 6, 15], [3, 1.5, 0], clamp()) : 0;
        return (
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: `translate(calc(-50% + ${organicOffset(frame, "orbX", 0.015, 3)}px), calc(-50% + ${organicOffset(frame, "orbY", 0.018, 2)}px)) scale(${orbScale})`,
              opacity: orbOp,
              filter: orbBlur > 0.1 ? `blur(${orbBlur}px)` : "none",
            }}
          >
            <UltraOrb
              frame={orbLocal}
              fps={fps}
              opacity={1}
              scale={1}
            />
          </div>
        );
      })()}

      {/* N: "Experience Gemini" + devices */}
      {frame >= 570 && frame < 645 && (
        <ExperienceGemini frame={frame} fps={fps} enterFrame={570} />
      )}

      {/* Fade out the experience section */}
      {frame >= 630 && frame < 645 && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: BG,
            opacity: interpolate(frame, [630, 645], [0, 1], clamp()),
          }}
        />
      )}

      {/* O: Gemini sparkle — organic rotation + smoothstep */}
      {sparklePhase && (
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: `translate(calc(-50% + ${organicOffset(frame, "spkX", 0.03, 3)}px), calc(-50% + ${organicOffset(frame, "spkY", 0.035, 2)}px)) scale(${sparkleScale}) rotate(${sparkleRotation}deg)`,
          }}
        >
          <Glow color={PURPLE} spread={60 * sparkleGlow}>
            <GeminiSparkle size={50} opacity={sparkleOp} />
          </Glow>
          {/* Radial glow behind sparkle */}
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              width: 200,
              height: 200,
              borderRadius: "50%",
              background: `radial-gradient(circle, rgba(139,92,246,${0.15 * sparkleGlow}), transparent 70%)`,
              pointerEvents: "none",
            }}
          />
        </div>
      )}

      {/* P: Google G finale — spring scale + organic drift */}
      {gFinalPhase && (
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: `translate(calc(-50% + ${gDriftX}px), calc(-50% + ${gDriftY}px)) scale(${gFinalScale})`,
            opacity: gFinalOp,
          }}
        >
          {/* Multi-color radial glow behind G */}
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              width: 180,
              height: 180,
              borderRadius: "50%",
              background: `radial-gradient(circle,
                rgba(66,133,244,${0.12 * gFinalGlow}),
                rgba(234,67,53,${0.06 * gFinalGlow}) 40%,
                rgba(251,188,5,${0.04 * gFinalGlow}) 60%,
                transparent 80%)`,
              pointerEvents: "none",
            }}
          />
          <GoogleG size={60} glowIntensity={gFinalGlow * 1.2} />
        </div>
      )}

      {/* Bottom disclaimer during interface */}
      <div
        style={{
          position: "absolute",
          bottom: 16,
          left: 0,
          right: 0,
          textAlign: "center",
          fontSize: 11,
          fontFamily: FONT,
          color: "rgba(255,255,255,0.35)",
          opacity: disclaimerOp,
        }}
      >
        Gemini Advanced with Ultra 1.0 is only available in English and for ages 18+. Subscription required.
      </div>
    </AbsoluteFill>
  );
};

export const scene05Meta = {
  id: "OFScene05",
  component: Scene05,
  width: 1280,
  height: 720,
  fps: 30,
  durationInFrames: 695,
};
