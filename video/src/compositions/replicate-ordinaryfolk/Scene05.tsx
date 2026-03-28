import React, { useEffect, useLayoutEffect, useRef, useMemo, useCallback } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { noise2D } from "@remotion/noise";
import {
  gsap,
  MorphSVGPlugin,
  MotionPathPlugin,
} from "../../lib/useGsapTimeline";

/* ═══════════════════════════════════════════════════════════════
   Scene 05 — Gemini Advanced Interface
   694 frames @ 30fps = 23.13s

   GSAP-driven rewrite. All animations via paused GSAP timeline
   synced to Remotion frame clock.

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
   L  480-520  "With access to" — letters spiral inward
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
const FONT =
  "'Google Sans', 'Product Sans', system-ui, -apple-system, sans-serif";

// ─── Helpers ───

/** Smooth noise-based offset for position/scale jitter */
const organicOffset = (
  frame: number,
  seed: string,
  speed = 0.02,
  amplitude = 1
): number => {
  const seedNum = seed.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return noise2D(seed, frame * speed, seedNum * 0.1) * amplitude;
};

/** Breathing glow: sine + noise for organic radius variation */
const breathingGlow = (
  frame: number,
  base: number,
  range: number,
  speed = 0.08
): number => {
  const sine = Math.sin(frame * speed) * 0.5 + 0.5;
  const noiseVal = noise2D("glow", frame * 0.03, 0) * 0.3 + 0.5;
  return base + range * (sine * 0.7 + noiseVal * 0.3);
};

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

// ─── Google "G" logo — MULTI-LAYER BREATHING GLOW ───

const GoogleG: React.FC<{
  size?: number;
  opacity?: number;
  glowIntensity?: number;
  frame?: number;
}> = ({ size = 60, opacity = 1, glowIntensity = 0, frame = 0 }) => {
  const s = size;

  const sineBreath = Math.sin(frame * 0.09) * 0.5 + 0.5;
  const noiseBreath = noise2D("gBreath", frame * 0.04, 0) * 0.5 + 0.5;
  const driftBreath = Math.sin(frame * 0.025) * 0.3 + 0.7;
  const pulse =
    (sineBreath * 0.5 + noiseBreath * 0.3 + driftBreath * 0.2) * glowIntensity;

  const blueGlow = pulse * 1.0;
  const redGlow =
    pulse * 0.7 +
    noise2D("gRed", frame * 0.035, 1) * 0.15 * glowIntensity;
  const yellowGlow =
    pulse * 0.5 +
    noise2D("gYlw", frame * 0.03, 2) * 0.12 * glowIntensity;
  const greenGlow =
    pulse * 0.6 +
    noise2D("gGrn", frame * 0.032, 3) * 0.1 * glowIntensity;

  const glowShadow =
    glowIntensity > 0
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

  const svgFilter =
    pulse > 0
      ? `drop-shadow(0 0 ${12 * blueGlow}px rgba(66,133,244,0.7)) drop-shadow(0 0 ${30 * pulse}px rgba(139,92,246,0.3))`
      : "none";

  return (
    <div style={{ width: s, height: s, opacity, position: "relative" }}>
      <svg
        viewBox="0 0 48 48"
        width={s}
        height={s}
        style={{ filter: svgFilter }}
      >
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
      <div
        style={{
          position: "absolute",
          inset: -6,
          borderRadius: "50%",
          boxShadow: glowShadow,
          pointerEvents: "none",
        }}
      />
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

// ─── Gemini sparkle (4-point star) with SVG path for morph ───

const SPARKLE_PATH =
  "M12 0C12 6.627 6.627 12 0 12c6.627 0 12 5.373 12 12 0-6.627 5.373-12 12-12-6.627 0-12-5.373-12-12z";

// Google G path data (simplified) for MorphSVG target
const GOOGLE_G_PATH =
  "M23.5 12C23.5 11.2 23.4 10.7 23.3 10H12v4.3h6.5c-.3 1.6-1.1 2.9-2.4 3.8l3.8 3c2.2-2 3.6-5 3.6-8.6 0-1.1-.1-2-.3-2.5zM12 24c3.2 0 5.9-1.1 7.9-2.9l-3.8-3c-1.1.7-2.4 1.1-4.1 1.1c-3.2 0-5.8-2.1-6.8-5l-3.9 3C3.4 20.6 7.3 24 12 24zM5.2 14.3c-.5-1.5-.5-3 0-4.5l-3.9-3c-1.7 3.5-1.7 7.5 0 11l3.9-3.5zM12 4.8c1.8 0 3.4.6 4.6 1.8l3.4-3.4C17.8 1.1 15.1 0 12 0 7.3 0 3.4 3.4 1.3 8.3l3.9 3C6.2 8.1 8.8 4.8 12 4.8z";

const GeminiSparkle: React.FC<{
  size?: number;
  opacity?: number;
  color?: string;
  id?: string;
}> = ({ size = 30, opacity = 1, color = "#fff", id }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" style={{ opacity }}>
    <path id={id} d={SPARKLE_PATH} fill={color} />
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
            <div
              style={{
                width: 30,
                height: 30,
                borderRadius: "50%",
                background: `radial-gradient(circle, #FFD700, ${PURPLE})`,
                position: "absolute" as const,
                top: 25,
                left: "30%",
                boxShadow: `0 0 15px ${PURPLE}`,
              }}
            />
            <div
              style={{
                width: 20,
                height: 20,
                borderRadius: "50%",
                background: "radial-gradient(circle, #60A5FA, #1E3A5F)",
                position: "absolute" as const,
                top: 40,
                left: "55%",
                boxShadow: "0 0 10px #60A5FA",
              }}
            />
          </>
        )}
        {card.title.includes("Role play") && (
          <div
            style={{
              width: 40,
              height: 50,
              borderRadius: 8,
              background: "linear-gradient(180deg, #8B4513, #D2691E)",
              boxShadow: "0 0 10px rgba(210,105,30,0.5)",
            }}
          />
        )}
      </div>
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
      {card.body.length > 0 && (
        <div
          style={{
            color: "rgba(255,255,255,0.5)",
            fontSize: 9,
            fontFamily: isCode
              ? "'Fira Code', 'SF Mono', monospace"
              : FONT,
            lineHeight: 1.5,
          }}
        >
          {card.body.map((line, i) => (
            <div key={i}>
              {isCode ? (
                <span
                  style={{
                    color:
                      line.startsWith("<") || line.startsWith(" ")
                        ? "#7DD3FC"
                        : "rgba(255,255,255,0.5)",
                  }}
                >
                  {line}
                </span>
              ) : (
                line
              )}
            </div>
          ))}
        </div>
      )}
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

// ─── Full interface mockup (uses frame for typing only) ───

const GeminiInterface: React.FC<{
  frame: number;
  fps: number;
  style?: React.CSSProperties;
  className?: string;
}> = ({ frame, fps, style, className }) => {
  // "Hello, Lisa." type-in with variable speed
  const helloText = "Hello, Lisa.";
  const handDelays = [3.5, 1.6, 1.4, 1.2, 1.8, 8, 5, 4, 1.5, 1.3, 1.7, 7];
  const charDelays: number[] = helloText
    .split("")
    .map((_, i) => handDelays[i] ?? 2);
  const charFrameThresholds: number[] = [];
  let cumFrames = 0;
  for (const d of charDelays) {
    cumFrames += d;
    charFrameThresholds.push(cumFrames);
  }
  const totalTypeFrames = cumFrames;
  const visibleChars = charFrameThresholds.filter((t) => frame >= t).length;
  const typedHello = helloText.slice(0, visibleChars);

  // Subtitle and cards appear after typing
  const subtitleProgress = Math.min(
    1,
    Math.max(0, (frame - totalTypeFrames - 8) / (fps * 0.5))
  );
  const cardsProgress = Math.min(
    1,
    Math.max(0, (frame - totalTypeFrames - 20) / (fps * 0.6))
  );

  return (
    <div
      className={className}
      style={{
        width: 820,
        height: 500,
        background: "#111118",
        borderRadius: 12,
        position: "relative",
        overflow: "hidden",
        boxShadow: `
          0 0 60px rgba(139,92,246,0.08),
          0 20px 60px rgba(0,0,0,0.6),
          inset 0 1px 0 rgba(255,255,255,0.04)
        `,
        ...style,
      }}
    >
      {/* Thin gradient border */}
      <div
        style={{
          position: "absolute",
          inset: -1,
          borderRadius: 13,
          padding: 1,
          background: `linear-gradient(135deg, ${BLUE}66, ${PURPLE}66, ${PINK}66)`,
          WebkitMask:
            "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
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
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <div
            style={{
              width: 16,
              height: 1.5,
              background: "rgba(255,255,255,0.4)",
            }}
          />
          <div
            style={{
              width: 16,
              height: 1.5,
              background: "rgba(255,255,255,0.4)",
            }}
          />
          <div
            style={{
              width: 16,
              height: 1.5,
              background: "rgba(255,255,255,0.4)",
            }}
          />
        </div>
        <span
          style={{
            color: "rgba(255,255,255,0.8)",
            fontFamily: FONT,
            fontSize: 14,
            fontWeight: 400,
          }}
        >
          Gemini{" "}
          <GradientText
            gradient={`linear-gradient(90deg, ${PURPLE}, ${PINK})`}
          >
            Advanced
          </GradientText>
          <span
            style={{
              color: "rgba(255,255,255,0.3)",
              marginLeft: 4,
              fontSize: 10,
            }}
          >
            {"\u25BE"}
          </span>
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
        <div
          style={{
            fontSize: 36,
            fontFamily: FONT,
            fontWeight: 400,
            marginBottom: 8,
          }}
        >
          <GradientText
            gradient={`linear-gradient(135deg, ${PURPLE}, ${PINK}, ${BLUE})`}
          >
            {typedHello}
          </GradientText>
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

        <div
          style={{
            fontSize: 22,
            fontFamily: FONT,
            fontWeight: 300,
            color: "rgba(255,255,255,0.5)",
            opacity: subtitleProgress,
            marginBottom: 36,
          }}
        >
          How can I help you today?
        </div>

        {/* Card grid */}
        <div
          style={{
            display: "flex",
            gap: 14,
            opacity: cardsProgress,
          }}
        >
          {CARDS.map((card, i) => (
            <div key={i} className={`interface-card interface-card-${i}`}>
              <PromptCard card={card} width={160} />
            </div>
          ))}
        </div>
      </div>

      {/* Input bar */}
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
          opacity: cardsProgress,
        }}
      >
        <span
          style={{
            color: "rgba(255,255,255,0.25)",
            fontFamily: FONT,
            fontSize: 13,
          }}
        >
          Enter a prompt here
        </span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 12 }}>
          <div
            style={{
              width: 20,
              height: 20,
              borderRadius: "50%",
              background: "rgba(255,255,255,0.08)",
            }}
          />
          <div
            style={{
              width: 20,
              height: 20,
              borderRadius: "50%",
              background: "rgba(255,255,255,0.08)",
            }}
          />
        </div>
      </div>

      {/* Disclaimer */}
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
          opacity: cardsProgress,
        }}
      >
        Gemini may display inaccurate info, including about people, so
        double-check its responses.{" "}
        <span
          style={{
            color: "rgba(139,92,246,0.4)",
            textDecoration: "underline",
          }}
        >
          Your privacy & Gemini
        </span>
      </div>

      {/* Avatar */}
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

// ─── Phone mockup (light mode) ───

const PhoneMockup: React.FC<{
  className?: string;
  style?: React.CSSProperties;
}> = ({ className, style }) => (
  <div
    className={className}
    style={{
      width: 180,
      height: 360,
      background: "#F5F5F5",
      borderRadius: 24,
      border: "3px solid #333",
      overflow: "hidden",
      boxShadow: "0 20px 60px rgba(0,0,0,0.4)",
      ...style,
    }}
  >
    <div
      style={{
        height: 24,
        background: "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 12px",
      }}
    >
      <span style={{ fontSize: 8, color: "#333", fontFamily: FONT }}>
        9:30
      </span>
      <span style={{ fontSize: 8, color: "#333", fontFamily: FONT }}>
        5G
      </span>
    </div>
    <div style={{ padding: 14, background: "#fff", height: "100%" }}>
      <div
        style={{
          fontSize: 20,
          fontWeight: 400,
          fontFamily: FONT,
          color: "#333",
          marginBottom: 12,
        }}
      >
        Good morning
      </div>
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
        <div
          style={{ width: 8, height: 12, borderRadius: 4, background: "#fff" }}
        />
      </div>
    </div>
  </div>
);

// ─── Ultra 1.0 orb ───

const UltraOrb: React.FC<{
  frame: number;
  fps: number;
  className?: string;
  style?: React.CSSProperties;
}> = ({ frame, fps, className, style }) => {
  const rotation = (frame / (fps * 10)) * 360;
  const pulseScale = 1 + 0.015 * Math.sin((frame / fps) * Math.PI * 2);
  const orbSize = 420;

  return (
    <div
      className={className}
      style={{
        width: orbSize,
        height: orbSize,
        position: "relative",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transform: `scale(${pulseScale})`,
        ...style,
      }}
    >
      {/* Outer glow halo */}
      <div
        style={{
          position: "absolute",
          inset: -30,
          borderRadius: "50%",
          background: `radial-gradient(circle, rgba(59,130,246,0.06) 30%, rgba(139,92,246,0.03) 50%, transparent 70%)`,
          pointerEvents: "none",
        }}
      />
      {/* Rotating conic gradient border — thicker */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "50%",
          padding: 3,
          background: `conic-gradient(from ${rotation}deg, ${BLUE}, ${PURPLE}, ${PINK}, ${BLUE})`,
          WebkitMask:
            "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
          WebkitMaskComposite: "xor" as any,
          maskComposite: "exclude" as any,
        }}
      />
      {/* 3D sphere surface — stronger shading */}
      <div
        style={{
          position: "absolute",
          inset: 5,
          borderRadius: "50%",
          background: `
            radial-gradient(ellipse at 30% 20%, rgba(70,80,140,0.5) 0%, transparent 45%),
            radial-gradient(ellipse at 70% 80%, rgba(80,40,70,0.25) 0%, transparent 45%),
            radial-gradient(circle at 50% 50%, #14142E 0%, #0A0A18 100%)
          `,
          boxShadow: `
            inset 0 -30px 50px rgba(0,0,0,0.6),
            inset 0 15px 40px rgba(80,80,180,0.1),
            inset -10px 0 30px rgba(60,30,90,0.08)
          `,
        }}
      />
      {/* Specular highlight — top left */}
      <div
        style={{
          position: "absolute",
          top: 35,
          left: 65,
          width: 100,
          height: 60,
          borderRadius: "50%",
          background:
            "radial-gradient(ellipse, rgba(200,200,240,0.09) 0%, transparent 70%)",
          transform: "rotate(-20deg)",
        }}
      />
      {/* Inner purple atmosphere */}
      <div
        style={{
          position: "absolute",
          inset: 40,
          borderRadius: "50%",
          background:
            "radial-gradient(circle at 42% 38%, rgba(139,92,246,0.16), transparent 60%)",
        }}
      />
      {/* Text */}
      <div
        style={{
          position: "relative",
          fontSize: 54,
          fontFamily: FONT,
          fontWeight: 400,
          color: "#fff",
          textShadow: "0 0 30px rgba(139,92,246,0.25)",
          zIndex: 1,
          letterSpacing: 1,
        }}
      >
        Ultra 1.0
      </div>
    </div>
  );
};

// ─── Spiral inward text chars ───
const SPIRAL_TEXT = "With access to";
const SPIRAL_CHARS = SPIRAL_TEXT.split("");

// ═══ MAIN SCENE — GSAP-DRIVEN ═══

export const Scene05: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const tl = useRef<gsap.core.Timeline>(gsap.timeline({ paused: true }));
  const containerRef = useRef<HTMLDivElement>(null);
  const builtRef = useRef(false);

  // Refs for GSAP-targeted elements
  const gLogoRef = useRef<HTMLDivElement>(null);
  const phoneARef = useRef<HTMLDivElement>(null);
  const interfaceWrapRef = useRef<HTMLDivElement>(null);
  const kineticERefs = useRef<(HTMLSpanElement | null)[]>([]);
  const kineticFRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const cardZoomGRef = useRef<HTMLDivElement>(null);
  const typewriterHRef = useRef<HTMLDivElement>(null);
  const cardZoomIRef = useRef<HTMLDivElement>(null);
  const cardPeekRef = useRef<HTMLDivElement>(null);
  const kineticJRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const cardsPanRef = useRef<HTMLDivElement>(null);
  const spiralContainerRef = useRef<HTMLDivElement>(null);
  const spiralTextRef = useRef<HTMLDivElement>(null);
  const spiralCharsRef = useRef<(HTMLSpanElement | null)[]>([]);
  const spiralGlowRef = useRef<HTMLDivElement>(null);
  const orbWrapRef = useRef<HTMLDivElement>(null);
  const expTitleRef = useRef<HTMLDivElement>(null);
  const expUrlRef = useRef<HTMLDivElement>(null);
  const expPhoneRef = useRef<HTMLDivElement>(null);
  const expDesktopRef = useRef<HTMLDivElement>(null);
  const expDevicesRef = useRef<HTMLDivElement>(null);
  const sparkleWrapRef = useRef<HTMLDivElement>(null);
  const gFinalWrapRef = useRef<HTMLDivElement>(null);
  const interfaceBackdropRef = useRef<HTMLDivElement>(null);
  const disclaimerRef = useRef<HTMLDivElement>(null);
  const bgGlowRef = useRef<HTMLDivElement>(null);
  const expFadeRef = useRef<HTMLDivElement>(null);
  const sparkleDecoRef = useRef<HTMLDivElement>(null);
  const sparkleDecoCurvesRef = useRef<SVGSVGElement>(null);

  // Compute interface local frame for typing animation
  const interfaceLocalFrame = Math.max(0, frame - 75);

  // Typewriter state for segment H
  const typewriterText = "coding";
  const twCharDelays = useMemo(
    () =>
      typewriterText.split("").map((ch) => {
        if (ch === " ") return 5;
        if (ch === "," || ch === ".") return 7;
        if (ch === ch.toUpperCase() && ch !== ch.toLowerCase()) return 4;
        if ("aeiou".includes(ch.toLowerCase())) return 2.2;
        return 2.8;
      }),
    []
  );
  const twThresholds = useMemo(() => {
    const t: number[] = [];
    let c = 0;
    for (const d of twCharDelays) {
      c += d;
      t.push(c);
    }
    return t;
  }, [twCharDelays]);
  const twLocalFrame = Math.max(0, frame - 310);
  const twCharsVisible = Math.min(
    typewriterText.length,
    twThresholds.filter((t) => twLocalFrame >= t).length
  );
  const twIsTyping = twCharsVisible < typewriterText.length;
  const twCursorOp = twIsTyping
    ? 1
    : Math.sin(twLocalFrame * 0.5) > 0
      ? 0.9
      : 0.15;

  // Kinetic text word arrays
  const kineticE = { text: "Our most capable AI", accent: "most capable" };
  const kineticF = { text: "for reasoning", accent: "reasoning" };
  const kineticJ = { text: "and more", accent: "more" };

  // Pre-compute spiral parameters
  const spiralParams = useMemo(
    () =>
      SPIRAL_CHARS.map((ch, i) => ({
        ch,
        goldenAngle: i * 137.508,
        baseRadius: 220 + (i % 3) * 60,
        spiralSpeed: 0.6 + (i % 4) * 0.15,
        isAccent: i >= 5 && i <= 10,
      })),
    []
  );

  // ─── Build GSAP timeline (useLayoutEffect = synchronous, before paint) ───
  useLayoutEffect(() => {
    if (!containerRef.current) return;
    const t = tl.current;
    t.clear();

    // Convert frame to seconds for GSAP
    const f = (fr: number) => fr / fps;

    // ═══ A: Dark void + G logo + phone (0-30) ═══

    // G logo: fade in → fade out
    if (gLogoRef.current) {
      t.set(gLogoRef.current, { opacity: 0, scale: 0.4 }, 0);
      t.to(gLogoRef.current, {
        opacity: 1,
        scale: 0.6,
        duration: f(15),
        ease: "power2.out",
      }, 0);
      t.to(gLogoRef.current, {
        opacity: 0,
        duration: f(15),
        ease: "power2.in",
      }, f(20));
    }

    // Phone A: arc sweep from bottom-left
    if (phoneARef.current) {
      t.set(phoneARef.current, {
        opacity: 0,
        x: -120,
        y: 180,
        rotateY: 35,
        rotateX: -14,
        scale: 0.25,
      }, 0);
      t.to(phoneARef.current, {
        opacity: 0.3,
        duration: f(6),
        ease: "power1.out",
      }, 0);
      t.to(phoneARef.current, {
        x: 0,
        y: 0,
        rotateY: 15,
        rotateX: -5,
        scale: 0.42,
        duration: f(28),
        ease: "power2.out",
      }, 0);
      t.to(phoneARef.current, {
        opacity: 0,
        duration: f(10),
        ease: "power2.in",
      }, f(22));
    }

    // ═══ B+C+D: Gemini Interface (30-180) ═══
    if (interfaceWrapRef.current) {
      t.set(interfaceWrapRef.current, {
        opacity: 0,
        rotateX: 22,
        rotateY: 50,
        scale: 1.3,
        y: 80,
      }, 0);
      // Fade in
      t.to(interfaceWrapRef.current, {
        opacity: 1,
        duration: f(12),
        ease: "power2.out",
      }, f(30));
      // Spring-like settle (using elastic ease)
      t.to(interfaceWrapRef.current, {
        rotateX: 0,
        rotateY: 0,
        scale: 0.95,
        y: 0,
        duration: f(60),
        ease: "elastic.out(1, 0.4)",
      }, f(30));
      // Fade out
      t.to(interfaceWrapRef.current, {
        opacity: 0,
        duration: f(15),
        ease: "power2.in",
      }, f(165));
    }

    // Disclaimer
    if (disclaimerRef.current) {
      t.set(disclaimerRef.current, { opacity: 0 }, 0);
      t.to(disclaimerRef.current, {
        opacity: 0.4,
        duration: f(10),
        ease: "power1.inOut",
      }, f(50));
      t.to(disclaimerRef.current, {
        opacity: 0,
        duration: f(10),
        ease: "power1.inOut",
      }, f(160));
    }

    // Interface backdrop (faint behind card zooms)
    if (interfaceBackdropRef.current) {
      t.set(interfaceBackdropRef.current, { opacity: 0 }, 0);
      // G segment backdrop
      t.to(interfaceBackdropRef.current, { opacity: 0.12, duration: f(10), ease: "power1.inOut" }, f(255));
      t.to(interfaceBackdropRef.current, { opacity: 0, duration: f(10), ease: "power1.inOut" }, f(300));
      // I segment backdrop
      t.to(interfaceBackdropRef.current, { opacity: 0.10, duration: f(10), ease: "power1.inOut" }, f(345));
      t.to(interfaceBackdropRef.current, { opacity: 0, duration: f(10), ease: "power1.inOut" }, f(390));
      // K segment backdrop
      t.to(interfaceBackdropRef.current, { opacity: 0.10, duration: f(10), ease: "power1.inOut" }, f(425));
      t.to(interfaceBackdropRef.current, { opacity: 0, duration: f(10), ease: "power1.inOut" }, f(470));
    }

    // ═══ E: "Our most capable AI" (180-220) ═══
    // Sparkle decoration behind kinetic text E
    if (sparkleDecoRef.current) {
      t.set(sparkleDecoRef.current, { opacity: 0 }, 0);
      t.to(sparkleDecoRef.current, { opacity: 0.4, duration: f(12), ease: "power1.out" }, f(183));
      t.to(sparkleDecoRef.current, { opacity: 0, duration: f(8), ease: "power1.in" }, f(210));
    }
    if (sparkleDecoCurvesRef.current) {
      t.set(sparkleDecoCurvesRef.current, { opacity: 0 }, 0);
      t.to(sparkleDecoCurvesRef.current, { opacity: 0.2, duration: f(10), ease: "power1.out" }, f(182));
      t.to(sparkleDecoCurvesRef.current, { opacity: 0, duration: f(8), ease: "power1.in" }, f(210));
    }

    const animateKineticWords = (
      refs: React.MutableRefObject<(HTMLSpanElement | null)[]>,
      enterFrame: number,
      holdFrames: number,
      words: string[]
    ) => {
      refs.current.forEach((el, i) => {
        if (!el) return;
        const delay = i === 0 ? 0 : (words[i]?.length > 4 ? 5 : 3) + (i % 2 === 0 ? 2 : 0);
        const wordDelay = words.slice(0, i).reduce((sum, w, idx) => {
          const d = idx === 0 ? 0 : (w.length > 4 ? 5 : 3) + (idx % 2 === 0 ? 2 : 0);
          return sum + d;
        }, 0);
        t.set(el, { opacity: 0, scale: 0.85, y: 8 }, 0);
        // Pop in with spring-like overshoot
        t.to(el, {
          opacity: 1,
          scale: 1,
          y: 0,
          duration: f(10),
          ease: "back.out(2.5)",
        }, f(enterFrame + wordDelay));
        // Exit
        t.to(el, {
          opacity: 0,
          y: -6,
          duration: f(10),
          ease: "power2.in",
        }, f(enterFrame + holdFrames));
      });
    };

    animateKineticWords(kineticERefs, 180, 35, kineticE.text.split(" "));
    animateKineticWords(kineticFRefs, 220, 35, kineticF.text.split(" "));
    animateKineticWords(kineticJRefs, 400, 25, kineticJ.text.split(" "));

    // ═══ G: Card zoom 0 — "Walk me through solving a problem" (260-310) ═══
    if (cardZoomGRef.current) {
      t.set(cardZoomGRef.current, { opacity: 0, scale: 0.6 * 1.8, x: 90, y: 0 }, 0);
      // Arc entrance with spring
      t.to(cardZoomGRef.current, {
        opacity: 1,
        scale: 1.8,
        x: -30,
        y: 0,
        duration: f(18),
        ease: "elastic.out(1, 0.5)",
      }, f(260));
      // Exit sweep
      t.to(cardZoomGRef.current, {
        opacity: 0,
        x: 10,
        y: -30,
        duration: f(12),
        ease: "power2.in",
      }, f(300));
    }

    // ═══ H: "coding" typewriter (310-350) ═══
    if (typewriterHRef.current) {
      t.set(typewriterHRef.current, { opacity: 0, y: 14 }, 0);
      t.to(typewriterHRef.current, {
        opacity: 1,
        y: 0,
        duration: f(12),
        ease: "power2.out",
      }, f(310));
      t.to(typewriterHRef.current, {
        opacity: 0,
        duration: f(10),
        ease: "power2.in",
      }, f(345));
    }

    // ═══ I: Card zoom 1 (350-400) ═══
    if (cardZoomIRef.current) {
      t.set(cardZoomIRef.current, { opacity: 0, scale: 0.6 * 1.8, x: 90 }, 0);
      t.to(cardZoomIRef.current, {
        opacity: 1,
        scale: 1.8,
        x: 20,
        duration: f(18),
        ease: "elastic.out(1, 0.5)",
      }, f(350));
      t.to(cardZoomIRef.current, {
        opacity: 0,
        x: 60,
        y: -30,
        duration: f(12),
        ease: "power2.in",
      }, f(395));
    }

    // Card peek (card 0 peeking from left during I)
    if (cardPeekRef.current) {
      t.set(cardPeekRef.current, { opacity: 0 }, 0);
      t.to(cardPeekRef.current, {
        opacity: 0.4,
        duration: f(10),
        ease: "power1.out",
      }, f(350));
      t.to(cardPeekRef.current, {
        opacity: 0,
        duration: f(10),
        ease: "power1.in",
      }, f(390));
    }

    // ═══ K: Cards pan 2+3 (430-480) ═══
    if (cardsPanRef.current) {
      t.set(cardsPanRef.current, { opacity: 0, x: 120 }, 0);
      t.to(cardsPanRef.current, {
        opacity: 1,
        duration: f(12),
        ease: "power1.out",
      }, f(430));
      t.to(cardsPanRef.current, {
        x: -120,
        duration: f(45),
        ease: "power1.inOut",
      }, f(430));
      t.to(cardsPanRef.current, {
        opacity: 0,
        duration: f(8),
        ease: "power1.in",
      }, f(470));
    }

    // ═══ L: Spiral inward text (480-520) ═══
    // Phase 1: text appears readable
    if (spiralTextRef.current) {
      t.set(spiralTextRef.current, { opacity: 0 }, 0);
      t.to(spiralTextRef.current, {
        opacity: 1,
        duration: f(10),
        ease: "power2.out",
      }, f(480));
      // Hide readable text when spiral begins
      t.to(spiralTextRef.current, {
        opacity: 0,
        duration: f(1),
      }, f(495));
    }

    // Phase 2+3: individual chars spiral inward using keyframed waypoints
    spiralCharsRef.current.forEach((el, i) => {
      if (!el) return;
      const params = spiralParams[i];
      const baseRadius = params.baseRadius;
      const goldenAngle = params.goldenAngle;
      const spiralSpeed = params.spiralSpeed;
      const startAngle = (goldenAngle * Math.PI) / 180;
      const endAngle = startAngle + Math.PI * 2 * spiralSpeed;

      // Start invisible
      t.set(el, { opacity: 0, x: 0, y: 0, rotation: 0, scale: 1 }, 0);

      // At spiral start: snap to outer position
      t.to(el, {
        opacity: 1,
        x: baseRadius * Math.cos(startAngle),
        y: baseRadius * Math.sin(startAngle) * 0.7,
        scale: 1,
        duration: f(10),
        ease: "power2.out",
      }, f(495));

      // Spiral inward using MotionPathPlugin with pre-computed waypoints
      const STEPS = 12;
      const waypoints: { x: number; y: number }[] = [];
      for (let s = 0; s <= STEPS; s++) {
        const p = s / STEPS;
        const r = baseRadius * (1 - p);
        const theta = startAngle + (endAngle - startAngle) * p;
        waypoints.push({
          x: r * Math.cos(theta),
          y: r * Math.sin(theta) * 0.7,
        });
      }

      t.to(el, {
        motionPath: {
          path: waypoints,
          curviness: 1.5,
        },
        scale: 0.1,
        rotation: (i - 7) * 40 + 180,
        opacity: 0,
        duration: f(20),
        ease: "power2.in",
      }, f(505));
    });

    // Spiral center glow
    if (spiralGlowRef.current) {
      t.set(spiralGlowRef.current, { opacity: 0 }, 0);
      t.to(spiralGlowRef.current, {
        opacity: 0.6,
        duration: f(20),
        ease: "power1.in",
      }, f(500));
      t.to(spiralGlowRef.current, {
        opacity: 1,
        duration: f(10),
        ease: "power1.in",
      }, f(515));
      t.to(spiralGlowRef.current, {
        opacity: 0,
        duration: f(5),
        ease: "power1.out",
      }, f(525));
    }

    // ═══ M: Ultra 1.0 orb (520-570) ═══
    if (orbWrapRef.current) {
      t.set(orbWrapRef.current, { opacity: 0, scale: 0.4 }, 0);
      // Spring entrance
      t.to(orbWrapRef.current, {
        opacity: 1,
        scale: 1,
        duration: f(18),
        ease: "elastic.out(1, 0.45)",
      }, f(520));
      // Exit
      t.to(orbWrapRef.current, {
        opacity: 0,
        scale: 0.8,
        duration: f(14),
        ease: "power2.in",
      }, f(560));
    }

    // ═══ N: Experience Gemini + devices (570-640) ═══
    if (expTitleRef.current) {
      t.set(expTitleRef.current, { opacity: 0, y: 16 }, 0);
      t.to(expTitleRef.current, {
        opacity: 1,
        y: 0,
        duration: f(12),
        ease: "power2.out",
      }, f(570));
    }
    if (expUrlRef.current) {
      t.set(expUrlRef.current, { opacity: 0 }, 0);
      t.to(expUrlRef.current, {
        opacity: 1,
        duration: f(12),
        ease: "power2.out",
      }, f(580));
    }
    // Phone arc sweep from bottom-left
    if (expPhoneRef.current) {
      t.set(expPhoneRef.current, { opacity: 0, x: -60, y: 220, rotation: 8 }, 0);
      t.to(expPhoneRef.current, {
        opacity: 1,
        x: 0,
        y: 0,
        rotation: 0,
        duration: f(23),
        ease: "power2.out",
      }, f(585));
    }
    // Desktop arc sweep from right
    if (expDesktopRef.current) {
      t.set(expDesktopRef.current, { opacity: 0, x: 280, rotation: -4 }, 0);
      t.to(expDesktopRef.current, {
        opacity: 1,
        x: 0,
        rotation: 0,
        duration: f(22),
        ease: "power2.out",
      }, f(590));
    }
    // Devices container scale
    if (expDevicesRef.current) {
      t.set(expDevicesRef.current, { scale: 1 }, 0);
      t.to(expDevicesRef.current, {
        scale: 0.85,
        duration: f(27),
        ease: "power1.inOut",
      }, f(585));
    }

    // Experience section fade overlay
    if (expFadeRef.current) {
      t.set(expFadeRef.current, { opacity: 0 }, 0);
      t.to(expFadeRef.current, {
        opacity: 1,
        duration: f(15),
        ease: "power1.inOut",
      }, f(630));
    }

    // ═══ O+P: Sparkle → Google G morph (640-694) ═══
    if (sparkleWrapRef.current) {
      t.set(sparkleWrapRef.current, { opacity: 0, scale: 0.15 }, 0);
      // Sparkle enters with spring
      t.to(sparkleWrapRef.current, {
        opacity: 1,
        scale: 1,
        duration: f(15),
        ease: "elastic.out(1, 0.5)",
      }, f(640));
      // Sparkle exits
      t.to(sparkleWrapRef.current, {
        opacity: 0,
        scale: 0.5,
        duration: f(10),
        ease: "power2.in",
      }, f(660));
    }

    // SVG morph: sparkle path → G path
    const sparklePathEl = containerRef.current?.querySelector("#sparkle-morph-path");
    if (sparklePathEl) {
      t.to(sparklePathEl, {
        morphSVG: GOOGLE_G_PATH,
        duration: f(15),
        ease: "power2.inOut",
      }, f(652));
    }

    // Google G finale
    if (gFinalWrapRef.current) {
      t.set(gFinalWrapRef.current, { opacity: 0, scale: 0.5 }, 0);
      t.to(gFinalWrapRef.current, {
        opacity: 1,
        scale: 1,
        duration: f(12),
        ease: "elastic.out(1, 0.5)",
      }, f(660));
      // Final fade out
      t.to(gFinalWrapRef.current, {
        opacity: 0,
        duration: f(6),
        ease: "power2.in",
      }, f(688));
    }

    builtRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Seek timeline to current frame — runs every frame, after build
  useLayoutEffect(() => {
    if (builtRef.current) {
      tl.current.seek(frame / fps);
    }
  }, [frame, fps]);

  // ─── Organic noise applied per-frame (can't go in GSAP timeline) ───
  const noiseX = organicOffset(frame, "orbX", 0.015, 3);
  const noiseY = organicOffset(frame, "orbY", 0.018, 2);

  // Background glow (per-frame noise-driven)
  const firstHalfBoost = frame < 350 ? 1.6 : 1.0;
  const bgGlowIntensity =
    breathingGlow(frame, 0.035, 0.025, 0.06) * firstHalfBoost;
  const bgGlow2 =
    breathingGlow(frame, 0.02, 0.015, 0.045) * firstHalfBoost;
  const bgGlowX = 50 + organicOffset(frame, "bgX", 0.008, 5);
  const bgGlowY = 50 + organicOffset(frame, "bgY", 0.009, 4);
  const bgGlow3X = 30 + organicOffset(frame, "bg3X", 0.006, 8);
  const bgGlow3Y = 70 + organicOffset(frame, "bg3Y", 0.007, 6);

  // G final glow computation
  const gFinalLocal = Math.max(0, frame - 660);
  const gFinalGlow =
    frame >= 660
      ? Math.min(1, gFinalLocal / 15) * (gFinalLocal > 30 ? 0.5 : 1)
      : 0;

  // Sparkle glow
  const sparkleLocal = Math.max(0, frame - 640);
  const sparkleGlow =
    frame >= 640 && frame < 670
      ? sparkleLocal < 8
        ? sparkleLocal / 8
        : sparkleLocal < 25
          ? 1
          : Math.max(0, 1 - (sparkleLocal - 25) / 5) * 0.3 + 0.3
      : 0;

  // Orb local frame for internal animation
  const orbLocalFrame = Math.max(0, frame - 520);

  // Helper to build kinetic word elements
  const buildKineticWords = (
    config: { text: string; accent: string },
    refs: React.MutableRefObject<(HTMLSpanElement | null)[]>,
    gradientOverride?: string,
    glowColorOverride?: string
  ) => {
    const words = config.text.split(" ");
    const accentWords = new Set(config.accent.split(" "));
    const gradient = gradientOverride || GRADIENT_TEXT;
    const glowColor = glowColorOverride || PURPLE;

    return (
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          fontSize: 42,
          fontFamily: FONT,
          fontWeight: 300,
          color: "#fff",
          whiteSpace: "nowrap",
          display: "flex",
          gap: "0.3em",
        }}
      >
        {words.map((word, i) => {
          const isAccent = accentWords.has(word);
          return (
            <span
              key={i}
              ref={(el) => { refs.current[i] = el; }}
              style={{
                display: "inline-block",
                opacity: 0,
                ...(isAccent
                  ? {
                      background: gradient,
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                      backgroundClip: "text" as const,
                      filter: `drop-shadow(0 0 12px ${glowColor}) drop-shadow(0 0 4px ${glowColor})`,
                    }
                  : {}),
              }}
            >
              {word}
            </span>
          );
        })}
      </div>
    );
  };

  return (
    <AbsoluteFill style={{ backgroundColor: BG }} ref={containerRef}>
      {/* AMBIENT PURPLE GLOW */}
      <div
        ref={bgGlowRef}
        style={{
          position: "absolute",
          inset: 0,
          background: `
            radial-gradient(ellipse at 50% 50%, transparent 40%, rgba(0,0,0,0.3) 100%),
            radial-gradient(ellipse at ${bgGlowX}% ${bgGlowY}%, rgba(139,92,246,${bgGlowIntensity}) 0%, transparent 55%),
            radial-gradient(ellipse at ${100 - bgGlowX}% ${100 - bgGlowY}%, rgba(59,130,246,${bgGlow2 * 0.6}) 0%, transparent 50%),
            radial-gradient(ellipse at ${bgGlow3X}% ${bgGlow3Y}%, rgba(168,85,247,${bgGlow2 * 0.4}) 0%, transparent 45%)
          `,
          pointerEvents: "none",
          zIndex: 0,
        }}
      />

      {/* A: G logo */}
      <div
        ref={gLogoRef}
        style={{
          position: "absolute",
          top: "38%",
          left: "35%",
          opacity: 0,
        }}
      >
        <Glow
          color={PURPLE}
          spread={breathingGlow(frame, 25, 20, 0.15)}
        >
          <GoogleG size={50} glowIntensity={0.8} frame={frame} />
        </Glow>
      </div>

      {/* A: Phone */}
      <div
        ref={phoneARef}
        style={{
          position: "absolute",
          top: "28%",
          left: "22%",
          opacity: 0,
        }}
      >
        <PhoneMockup style={{ transform: "scale(0.6)" }} />
      </div>

      {/* B+C+D: Gemini Interface */}
      <div
        ref={interfaceWrapRef}
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          opacity: 0,
          perspective: 1200,
        }}
      >
        <GeminiInterface
          frame={interfaceLocalFrame}
          fps={fps}
        />
      </div>

      {/* Interface backdrop for card zoom segments */}
      <div
        ref={interfaceBackdropRef}
        style={{
          position: "absolute",
          top: "-15%",
          left: "50%",
          transform: "translate(-50%, 0) scale(1.1)",
          opacity: 0,
          filter: "blur(1px)",
          pointerEvents: "none",
        }}
      >
        <GeminiInterface frame={90} fps={fps} />
      </div>

      {/* E: "Our most capable AI" + decorations */}
      <div
        ref={sparkleDecoRef}
        style={{
          position: "absolute",
          top: "calc(50% + 30px)",
          left: "50%",
          transform: "translateX(-50%)",
          opacity: 0,
        }}
      >
        <GeminiSparkle
          size={35}
          opacity={1}
          color="rgba(139,92,246,0.6)"
        />
      </div>
      <svg
        ref={sparkleDecoCurvesRef}
        width={800}
        height={400}
        viewBox="0 0 800 400"
        style={{
          position: "absolute",
          top: "calc(50% - 150px)",
          left: "calc(50% - 370px)",
          opacity: 0,
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
      {buildKineticWords(
        kineticE,
        kineticERefs,
        `linear-gradient(90deg, ${PINK}, ${PURPLE})`,
        "rgba(236,72,153,0.6)"
      )}

      {/* F: "for reasoning" */}
      {buildKineticWords(
        kineticF,
        kineticFRefs,
        `linear-gradient(90deg, ${PURPLE}, ${BLUE})`,
        "rgba(139,92,246,0.5)"
      )}

      {/* G: Card zoom 0 */}
      <div
        ref={cardZoomGRef}
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          opacity: 0,
          perspective: 800,
        }}
      >
        <div style={{ transform: "rotateY(-6deg)" }}>
          <PromptCard card={CARDS[0]} width={220} />
        </div>
      </div>

      {/* H: "coding" typewriter */}
      <div
        ref={typewriterHRef}
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          fontSize: 42,
          fontFamily: FONT,
          fontWeight: 300,
          color: "#fff",
          whiteSpace: "nowrap",
          opacity: 0,
        }}
      >
        {typewriterText.slice(0, twCharsVisible)}
        <span
          style={{
            display: "inline-block",
            opacity: twCursorOp,
            color: "rgba(255,255,255,0.5)",
          }}
        >
          _
        </span>
      </div>

      {/* I: Card zoom 1 */}
      <div
        ref={cardZoomIRef}
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          opacity: 0,
          perspective: 800,
        }}
      >
        <div style={{ transform: "rotateY(-5deg)" }}>
          <PromptCard card={CARDS[1]} width={220} />
        </div>
      </div>

      {/* Card 0 peeking from left during I */}
      <div
        ref={cardPeekRef}
        style={{
          position: "absolute",
          top: "50%",
          left: "8%",
          transform: "translateY(-50%) perspective(800px) rotateY(8deg) scale(1.2)",
          opacity: 0,
        }}
      >
        <PromptCard card={CARDS[0]} width={160} />
      </div>

      {/* J: "and more" */}
      {buildKineticWords(
        kineticJ,
        kineticJRefs,
        `linear-gradient(90deg, rgba(200,190,220,1), rgba(180,170,210,1))`,
        "rgba(139,92,246,0.2)"
      )}

      {/* K: Cards pan 2+3 */}
      <div
        ref={cardsPanRef}
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%) perspective(800px) rotateY(-5deg)",
          display: "flex",
          gap: 20,
          opacity: 0,
        }}
      >
        {[2, 3].map((idx) => (
          <div key={idx} style={{ transform: "scale(1.35)" }}>
            <PromptCard card={CARDS[idx]} width={200} />
          </div>
        ))}
      </div>

      {/* L: Spiral inward text */}
      <div
        ref={spiralContainerRef}
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: 0,
          height: 0,
        }}
      >
        {/* Central convergence glow */}
        <div
          ref={spiralGlowRef}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            transform: "translate(-50%, -50%)",
            width: 200,
            height: 200,
            borderRadius: "50%",
            background: `radial-gradient(circle,
              rgba(139,92,246,0.3) 0%,
              rgba(236,72,153,0.15) 30%,
              transparent 70%)`,
            pointerEvents: "none",
            opacity: 0,
          }}
        />

        {/* Readable text (phase 1) */}
        <div
          ref={spiralTextRef}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            transform: "translate(-50%, -50%)",
            display: "flex",
            fontSize: 42,
            fontFamily: FONT,
            fontWeight: 300,
            whiteSpace: "nowrap",
            opacity: 0,
          }}
        >
          {spiralParams.map(({ ch, isAccent }, i) => (
            <span
              key={i}
              style={{
                display: "inline-block",
                color: isAccent ? undefined : "#fff",
                background: isAccent
                  ? `linear-gradient(90deg, ${PURPLE}, ${PINK})`
                  : undefined,
                WebkitBackgroundClip: isAccent ? "text" : undefined,
                WebkitTextFillColor: isAccent ? "transparent" : undefined,
                filter: isAccent
                  ? `drop-shadow(0 0 8px ${PURPLE})`
                  : undefined,
                width: ch === " " ? "0.3em" : undefined,
              }}
            >
              {ch}
            </span>
          ))}
        </div>

        {/* Individual spiral chars (phase 2+3) */}
        {spiralParams.map(({ ch, isAccent }, i) => (
          <span
            key={`spiral-${i}`}
            ref={(el) => { spiralCharsRef.current[i] = el; }}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              display: "inline-block",
              fontSize: 42,
              fontFamily: FONT,
              fontWeight: 300,
              color: isAccent ? undefined : "#fff",
              background: isAccent
                ? `linear-gradient(90deg, ${PURPLE}, ${PINK})`
                : undefined,
              WebkitBackgroundClip: isAccent ? "text" : undefined,
              WebkitTextFillColor: isAccent ? "transparent" : undefined,
              filter: isAccent
                ? `drop-shadow(0 0 8px ${PURPLE})`
                : undefined,
              whiteSpace: "nowrap",
              opacity: 0,
            }}
          >
            {ch}
          </span>
        ))}
      </div>

      {/* M: Ultra 1.0 orb */}
      <div
        ref={orbWrapRef}
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: `translate(calc(-50% + ${noiseX}px), calc(-50% + ${noiseY}px))`,
          opacity: 0,
        }}
      >
        <UltraOrb frame={orbLocalFrame} fps={fps} />
      </div>

      {/* N: Experience Gemini + devices */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "flex-start",
          paddingTop: 60,
          pointerEvents: "none",
        }}
      >
        <div
          ref={expTitleRef}
          style={{
            fontSize: 36,
            fontFamily: FONT,
            fontWeight: 400,
            color: "#fff",
            opacity: 0,
            marginBottom: 8,
          }}
        >
          Experience{" "}
          <GradientText
            gradient={`linear-gradient(90deg, ${BLUE}, ${PURPLE})`}
          >
            Gemini
          </GradientText>
        </div>
        <div
          ref={expUrlRef}
          style={{
            fontSize: 14,
            fontFamily: FONT,
            color: "rgba(255,255,255,0.4)",
            opacity: 0,
            marginBottom: 40,
          }}
        >
          gemini.google.com
        </div>
        <div
          ref={expDevicesRef}
          style={{
            display: "flex",
            gap: 60,
            alignItems: "center",
            justifyContent: "center",
            marginTop: 10,
          }}
        >
          <div ref={expPhoneRef} style={{ opacity: 0 }}>
            <PhoneMockup style={{ transform: "scale(0.85) perspective(800px) rotateY(6deg)" }} />
          </div>
          <div ref={expDesktopRef} style={{ opacity: 0 }}>
            <div
              style={{
                transform: "scale(0.58)",
                transformOrigin: "top left",
              }}
            >
              <GeminiInterface frame={90} fps={fps} style={{ perspective: "800px", transform: "rotateY(-3deg)" }} />
            </div>
          </div>
        </div>
      </div>

      {/* Experience fade overlay */}
      <div
        ref={expFadeRef}
        style={{
          position: "absolute",
          inset: 0,
          background: BG,
          opacity: 0,
          pointerEvents: "none",
        }}
      />

      {/* O: Gemini sparkle with MorphSVG */}
      <div
        ref={sparkleWrapRef}
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: `translate(-50%, -50%) rotate(${frame >= 640 ? organicOffset(frame, "spkRot", 0.04, 15) : 0}deg)`,
          opacity: 0,
        }}
      >
        <Glow color={PURPLE} spread={60 * sparkleGlow}>
          <svg width={50} height={50} viewBox="0 0 24 24">
            <path
              id="sparkle-morph-path"
              d={SPARKLE_PATH}
              fill="#fff"
            />
          </svg>
        </Glow>
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

      {/* P: Google G finale */}
      <div
        ref={gFinalWrapRef}
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: `translate(calc(-50% + ${frame >= 660 ? organicOffset(frame, "gFinX", 0.015, 1.5) : 0}px), calc(-50% + ${frame >= 660 ? organicOffset(frame, "gFinY", 0.018, 1.0) : 0}px))`,
          opacity: 0,
        }}
      >
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
        <GoogleG size={60} glowIntensity={gFinalGlow * 1.2} frame={frame} />
      </div>

      {/* Bottom disclaimer during interface */}
      <div
        ref={disclaimerRef}
        style={{
          position: "absolute",
          bottom: 16,
          left: 0,
          right: 0,
          textAlign: "center",
          fontSize: 11,
          fontFamily: FONT,
          color: "rgba(255,255,255,0.35)",
          opacity: 0,
        }}
      >
        Gemini Advanced with Ultra 1.0 is only available in English and for
        ages 18+. Subscription required.
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
