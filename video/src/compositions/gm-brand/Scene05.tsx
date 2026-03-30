import React, { useLayoutEffect, useRef, useMemo } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { noise2D } from "@remotion/noise";
import { CameraMotionBlur } from "@remotion/motion-blur";
import {
  gsap,
  MorphSVGPlugin,
  MotionPathPlugin,
} from "../../lib/useGsapTimeline";
import { useFloat3D } from "../../lib/tilt3d";
import { GM, GMLogo } from "./theme";

/* ═══════════════════════════════════════════════════════════════
   Scene 05 — GM Advanced Interface
   694 frames @ 30fps = 23.13s

   GSAP-driven rewrite. All animations via paused GSAP timeline
   synced to Remotion frame clock.

   Sub-segments (frame ranges, local to this scene):
   A  0-30     "GM Advanced" title zoomed in + tilted phone emerges
   B  0-45     Phone 3D perspective, title holds
   C  45-100   Interface straightens, "Hello, Lisa." types in
   D  100-150  Full interface with cards + "How can I help you today?"
   E  180-220  "Our most capable AI" kinetic text
   F  220-260  "for reasoning" centered text
   G  260-310  Zoom into card: "Walk me through solving a problem"
   H  310-350  "coding" typewriter
   I  350-400  Pan to card: "Help me write HTML, CSS, and JS"
   J  400-430  "and more"
   K  430-465  Pan across cards 3 & 4 (compressed -15f)
   L  465-490  "With access to" spiral (compressed -15f)
   M  490-540  "Ultra 1.0" inside gradient orb
   N  540-600  "Experience GM" + URL + devices rise
   O  600-640  Phone + desktop side by side
   P  610-694  GM Logo light show -> settle + fade
  ═══════════════════════════════════════════════════════════════ */

const BG = GM.bgDark;
const GM_GREEN = GM.green;
const GM_DARK_GREEN = GM.greenDark;
const GM_LIGHT_GREEN = GM.greenStatus;
const GRADIENT_TEXT = `linear-gradient(135deg, ${GM_GREEN}, ${GM_LIGHT_GREEN})`;
const FONT = GM.fontSans;
/* Legacy aliases for minimal diff — mapped to GM greens */
const PURPLE = GM_GREEN;
const PINK = GM_DARK_GREEN;
const BLUE = GM_LIGHT_GREEN;

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

// ─── GM Logo — LUMINOUS LIGHT SOURCE ───
// The G is NOT a flat SVG. It is a lamp projecting colored light in a dark room.

/** Tiny floating particles near the G — like dust caught in projected light */
const GParticles: React.FC<{ count: number; frame: number; spread: number; intensity: number }> = ({
  count,
  frame,
  spread,
  intensity,
}) => {
  const particles = useMemo(() => {
    const arr: { x: number; y: number; size: number; speed: number; seed: string; phase: number }[] = [];
    for (let i = 0; i < count; i++) {
      arr.push({
        x: (Math.random() - 0.5) * spread * 2,
        y: (Math.random() - 0.8) * spread * 1.6, // biased upward
        size: 1 + Math.random() * 2,
        speed: 0.008 + Math.random() * 0.015,
        seed: `gp${i}`,
        phase: Math.random() * Math.PI * 2,
      });
    }
    return arr;
  }, [count, spread]);

  return (
    <>
      {particles.map((p, i) => {
        const dx = noise2D(p.seed, frame * p.speed, 0) * 12;
        const dy = noise2D(p.seed, 0, frame * p.speed * 0.7) * 8 - frame * 0.04;
        const flickerOp =
          (Math.sin(frame * 0.1 + p.phase) * 0.3 + 0.7) *
          intensity *
          (0.4 + Math.random() * 0.2);
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `calc(50% + ${p.x + dx}px)`,
              top: `calc(50% + ${p.y + dy}px)`,
              width: p.size,
              height: p.size,
              borderRadius: "50%",
              background: i % 3 === 0
                ? "rgba(22,163,74,0.9)"
                : i % 3 === 1
                  ? "rgba(0,163,108,0.8)"
                  : "rgba(255,255,255,0.7)",
              opacity: flickerOp,
              pointerEvents: "none" as const,
              boxShadow: `0 0 ${p.size * 2}px rgba(22,163,74,0.3)`,
            }}
          />
        );
      })}
    </>
  );
};

// ─── GM Light Show — replaces sparkle→GMLightLogo finale ───

const LIGHT_SHOW_START = 610;
const LIGHT_SHOW_END = 694;

/** 12 primary rays + 8 secondary rays configuration */
const PRIMARY_RAYS = Array.from({ length: 12 }, (_, i) => ({
  angle: i * 30,
  length: 200 + (i % 3) * 100, // 200, 300, 400 alternating
  width: 2 + (i % 2),
  delay: i * 3, // stagger: 3 frames between each
}));

const SECONDARY_RAYS = Array.from({ length: 8 }, (_, i) => ({
  angle: i * 45 + 22.5, // offset from primary
  length: 100 + (i % 2) * 100, // 100 or 200
  width: 1.5,
  delay: i * 2 + 15, // start after primaries begin
}));

/** Particles: 35 tiny dots floating in the light cone */
const LIGHT_PARTICLES = Array.from({ length: 35 }, (_, i) => ({
  angle: Math.random() * 360,
  dist: 40 + Math.random() * 260,
  size: 1 + Math.random() * 2,
  speed: 0.01 + Math.random() * 0.015,
  seed: `lp${i}`,
  phase: Math.random() * Math.PI * 2,
  isWhite: i % 4 === 0,
}));

const GMLightShow: React.FC<{ frame: number; opacity: number; fps: number }> = ({
  frame,
  opacity,
  fps,
}) => {
  const localFrame = frame - LIGHT_SHOW_START;
  if (localFrame < 0 || frame > LIGHT_SHOW_END) return null;

  // ── Phase 1 (0-15): Emergence — logo fades in small, grows with spring ──
  const logoOpacity = interpolate(localFrame, [0, 8], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const logoSpring = spring({
    frame: localFrame,
    fps,
    config: { damping: 12, stiffness: 80, mass: 0.8 },
  });
  const logoSize = interpolate(logoSpring, [0, 1], [60, 120]);

  // Green point of light behind logo (emergence)
  const emergeGlow = interpolate(localFrame, [0, 15], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // ── Phase 2 (15-40): Light Rays extend outward ──
  const raysActive = localFrame >= 15;

  // ── Phase 3 (40-60): Full Bloom — rays rotate, secondary ring, particles ──
  const bloomProgress = interpolate(localFrame, [40, 50], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Rays slow rotation: 0.5° per frame after bloom starts
  const rayRotation = localFrame >= 40
    ? (localFrame - 40) * 0.5
    : 0;

  // Logo breathing (scale 1.0 → 1.05 → 1.0, 20-frame cycle)
  const breathe = localFrame >= 40
    ? 1 + 0.05 * Math.sin(((localFrame - 40) / 20) * Math.PI * 2)
    : 1;

  // ── Phase 4 (60-84): Settle + Fade ──
  const settleProgress = interpolate(localFrame, [60, 70], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Rays retract
  const rayRetract = interpolate(localFrame, [60, 80], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Glow reduces
  const glowFade = interpolate(localFrame, [60, 80], [1, 0.2], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Text appears
  const textOpacity = interpolate(localFrame, [60, 68], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const textY = interpolate(localFrame, [60, 68], [8, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Final fade to black (last 10 frames)
  const finalFade = interpolate(localFrame, [74, 84], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Background wash — faint green tint radiating from center (phase 3)
  const washOpacity = bloomProgress * glowFade;

  // Combined ray intensity: ramp up then retract in phase 4
  const rayIntensity = raysActive
    ? interpolate(localFrame, [15, 25], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      }) * (localFrame >= 60 ? rayRetract : 1)
    : 0;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        opacity: opacity * finalFade,
        pointerEvents: "none",
      }}
    >
      {/* Background wash — faint green tint */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(ellipse 120% 120% at 50% 50%,
            rgba(0,163,108,${0.15 * washOpacity}) 0%,
            rgba(0,138,90,${0.08 * washOpacity}) 30%,
            rgba(0,163,108,${0.03 * washOpacity}) 60%,
            transparent 90%)`,
        }}
      />

      {/* Central container */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
        }}
      >
        {/* Radial glow behind logo — 600px diameter at full bloom */}
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: interpolate(emergeGlow, [0, 1], [80, 600]),
            height: interpolate(emergeGlow, [0, 1], [80, 600]),
            borderRadius: "50%",
            background: `radial-gradient(circle,
              rgba(0,163,108,${0.35 * emergeGlow * glowFade}) 0%,
              rgba(0,138,90,${0.20 * emergeGlow * glowFade}) 25%,
              rgba(22,163,74,${0.10 * emergeGlow * glowFade}) 50%,
              transparent 80%)`,
          }}
        />

        {/* Primary light rays (12) */}
        {raysActive &&
          PRIMARY_RAYS.map((ray, i) => {
            const rayLocal = localFrame - 15 - ray.delay;
            if (rayLocal < 0) return null;
            const extend = interpolate(rayLocal, [0, 12], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            const rayLen = ray.length * extend * (localFrame >= 60 ? rayRetract : 1);
            const rayOp = interpolate(extend, [0, 0.3, 1], [0, 0.35, 0.15 + (i % 3) * 0.08], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            return (
              <div
                key={`pr-${i}`}
                style={{
                  position: "absolute",
                  top: "50%",
                  left: "50%",
                  width: ray.width,
                  height: rayLen,
                  background: `linear-gradient(to top, ${GM.green}, transparent)`,
                  opacity: rayOp * rayIntensity,
                  transform: `translate(-50%, -100%) rotate(${ray.angle + rayRotation}deg)`,
                  transformOrigin: "bottom center",
                }}
              />
            );
          })}

        {/* Secondary light rays (8) — appear at bloom */}
        {bloomProgress > 0 &&
          SECONDARY_RAYS.map((ray, i) => {
            const secLocal = localFrame - 40 - i * 2;
            if (secLocal < 0) return null;
            const extend = interpolate(secLocal, [0, 8], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            const rayLen = ray.length * extend * (localFrame >= 60 ? rayRetract : 1);
            return (
              <div
                key={`sr-${i}`}
                style={{
                  position: "absolute",
                  top: "50%",
                  left: "50%",
                  width: ray.width,
                  height: rayLen,
                  background: `linear-gradient(to top, rgba(0,163,108,0.6), transparent)`,
                  opacity: 0.2 * bloomProgress * (localFrame >= 60 ? rayRetract : 1),
                  transform: `translate(-50%, -100%) rotate(${ray.angle + rayRotation}deg)`,
                  transformOrigin: "bottom center",
                }}
              />
            );
          })}

        {/* Floating particles — appear gradually from phase 2 */}
        {localFrame >= 20 &&
          LIGHT_PARTICLES.map((p, i) => {
            const pLocal = localFrame - 20;
            const pAppear = interpolate(pLocal, [i * 0.5, i * 0.5 + 8], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            // Organic drift
            const dx = noise2D(p.seed, frame * p.speed, 0) * 15;
            const dy = noise2D(p.seed, 0, frame * p.speed * 0.8) * 12;
            const flicker = Math.sin(frame * 0.12 + p.phase) * 0.3 + 0.7;
            const px =
              Math.cos((p.angle * Math.PI) / 180) * p.dist + dx;
            const py =
              Math.sin((p.angle * Math.PI) / 180) * p.dist + dy;
            return (
              <div
                key={`lp-${i}`}
                style={{
                  position: "absolute",
                  left: `calc(50% + ${px}px)`,
                  top: `calc(50% + ${py}px)`,
                  width: p.size,
                  height: p.size,
                  borderRadius: "50%",
                  background: p.isWhite
                    ? "rgba(255,255,255,0.8)"
                    : i % 2 === 0
                      ? `rgba(0,163,108,0.9)`
                      : `rgba(22,163,74,0.85)`,
                  opacity: pAppear * flicker * (localFrame >= 60 ? rayRetract : 1),
                  boxShadow: `0 0 ${p.size * 3}px rgba(0,163,108,0.4)`,
                }}
              />
            );
          })}

        {/* GM Logo — centered, breathing */}
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: `translate(-50%, -50%) scale(${breathe})`,
            opacity: logoOpacity,
            filter: `drop-shadow(0 0 ${20 * emergeGlow * glowFade}px rgba(0,163,108,0.6)) drop-shadow(0 0 ${50 * emergeGlow * glowFade}px rgba(0,163,108,0.25))`,
          }}
        >
          <GMLogo size={logoSize} />
        </div>

        {/* Text: "General Market" + URL — phase 4 */}
        <div
          style={{
            position: "absolute",
            top: `calc(50% + ${logoSize / 2 + 24}px)`,
            left: "50%",
            transform: `translate(-50%, ${textY}px)`,
            textAlign: "center",
            opacity: textOpacity * finalFade,
          }}
        >
          <div
            style={{
              fontSize: 22,
              fontFamily: FONT,
              fontWeight: 900,
              color: GM.textInverse,
              letterSpacing: 0.5,
              whiteSpace: "nowrap",
            }}
          >
            General Market
          </div>
          <div
            style={{
              fontSize: 14,
              fontFamily: FONT,
              color: "#A1A1AA",
              marginTop: 6,
              letterSpacing: 0.3,
            }}
          >
            generalmarket.io
          </div>
        </div>
      </div>
    </div>
  );
};

const GMLightLogo: React.FC<{
  size?: number;
  opacity?: number;
  glowIntensity?: number;
  frame?: number;
  isLightSource?: boolean;
}> = ({ size = 60, opacity = 1, glowIntensity = 0, frame = 0, isLightSource = false }) => {
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

  // For light-source mode: dramatically amplified glow
  const lightMult = isLightSource ? 3.0 : 1.0;

  const glowShadow =
    glowIntensity > 0
      ? [
          `0 0 ${20 * blueGlow * lightMult}px rgba(0,163,108,${isLightSource ? 0.8 : 0.6})`,
          `0 0 ${45 * blueGlow * lightMult}px rgba(0,163,108,${isLightSource ? 0.4 : 0.25})`,
          `0 0 ${35 * redGlow * lightMult}px rgba(0,138,90,${isLightSource ? 0.5 : 0.35})`,
          `0 0 ${70 * redGlow * lightMult}px rgba(0,138,90,${isLightSource ? 0.2 : 0.12})`,
          `0 0 ${50 * yellowGlow * lightMult}px rgba(22,163,74,${isLightSource ? 0.5 : 0.25})`,
          `0 0 ${90 * yellowGlow * lightMult}px rgba(22,163,74,${isLightSource ? 0.15 : 0.08})`,
          `0 0 ${40 * greenGlow * lightMult}px rgba(0,163,108,${isLightSource ? 0.6 : 0.3})`,
          `0 0 ${75 * greenGlow * lightMult}px rgba(0,163,108,${isLightSource ? 0.2 : 0.1})`,
          ...(isLightSource
            ? [
                `0 0 ${120 * pulse}px rgba(0,163,108,0.25)`,
                `0 0 ${160 * pulse}px rgba(22,163,74,0.15)`,
                `0 0 ${200 * pulse}px rgba(0,163,108,0.08)`,
              ]
            : []),
        ].join(", ")
      : "none";

  const svgFilter =
    pulse > 0
      ? `drop-shadow(0 0 ${12 * blueGlow * lightMult}px rgba(0,163,108,0.7)) drop-shadow(0 0 ${30 * pulse * lightMult}px rgba(0,163,108,0.3))${isLightSource ? ` drop-shadow(0 0 ${50 * pulse}px rgba(0,163,108,0.4))` : ""}`
      : "none";

  // Animated gradient rotation — continuous rainbow flow
  const gradRotation = frame * (isLightSource ? 2.5 : 1.5);

  return (
    <div style={{ width: s, height: s, opacity, position: "relative" }}>
      {/* LIGHT SOURCE MODE: large warm green/gold radial glow BEHIND the G */}
      {isLightSource && (
        <>
          {/* Outermost warm light projection — 500px+ — the lamp's reach */}
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              width: 550,
              height: 550,
              borderRadius: "50%",
              background: `radial-gradient(circle,
                rgba(0,163,108,${0.35 * pulse}) 0%,
                rgba(0,138,90,${0.25 * pulse}) 15%,
                rgba(22,163,74,${0.18 * pulse}) 30%,
                rgba(0,163,108,${0.10 * pulse}) 50%,
                rgba(0,163,108,${0.04 * pulse}) 70%,
                transparent 88%)`,
              pointerEvents: "none",
            }}
          />
          {/* Inner warm halo — 350px — the bright core behind the G */}
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              width: 360,
              height: 360,
              borderRadius: "50%",
              background: `radial-gradient(circle,
                rgba(22,163,74,${0.45 * pulse}) 0%,
                rgba(0,163,108,${0.30 * pulse}) 25%,
                rgba(0,163,108,${0.15 * pulse}) 50%,
                transparent 75%)`,
              pointerEvents: "none",
            }}
          />
          {/* Hot core — tight bright spot right behind the G */}
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              width: 160,
              height: 160,
              borderRadius: "50%",
              background: `radial-gradient(circle,
                rgba(230,247,240,${0.15 * pulse}) 0%,
                rgba(22,163,74,${0.25 * pulse}) 30%,
                rgba(0,163,108,${0.10 * pulse}) 60%,
                transparent 85%)`,
              pointerEvents: "none",
            }}
          />
          {/* Floating particles */}
          <GParticles count={35} frame={frame} spread={200} intensity={pulse} />
        </>
      )}
      <svg
        viewBox="0 0 48 48"
        width={s}
        height={s}
        style={{ filter: svgFilter, position: "relative", zIndex: 2 }}
      >
        <defs>
          <linearGradient
            id={`g-rainbow-${s}-${isLightSource ? "ls" : "n"}`}
            gradientUnits="userSpaceOnUse"
            x1={24 + 22 * Math.cos((gradRotation * Math.PI) / 180)}
            y1={24 + 22 * Math.sin((gradRotation * Math.PI) / 180)}
            x2={24 - 22 * Math.cos((gradRotation * Math.PI) / 180)}
            y2={24 - 22 * Math.sin((gradRotation * Math.PI) / 180)}
          >
            <stop offset="0%" stopColor={GM.green} />
            <stop offset="25%" stopColor={GM.greenDark} />
            <stop offset="50%" stopColor={GM.greenStatus} />
            <stop offset="75%" stopColor={GM.green} />
            <stop offset="100%" stopColor={GM.greenDark} />
          </linearGradient>
        </defs>
        {/* Single G path with continuous rainbow gradient */}
        <path
          d="M44.5 20H24v8.5h11.8C34.7 33.9 30.1 37 24 37c-7.2 0-13-5.8-13-13s5.8-13 13-13c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 4.1 29.6 2 24 2 11.8 2 2 11.8 2 24s9.8 22 22 22c11 0 21-8 21-22 0-1.3-.2-2.7-.5-4z"
          fill={`url(#g-rainbow-${s}-${isLightSource ? "ls" : "n"})`}
        />
      </svg>
      <div
        style={{
          position: "absolute",
          inset: isLightSource ? -12 : -6,
          borderRadius: "50%",
          boxShadow: glowShadow,
          pointerEvents: "none",
          zIndex: 1,
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: isLightSource ? -40 : -20,
          borderRadius: "50%",
          background: `radial-gradient(circle, rgba(0,163,108,${(isLightSource ? 0.15 : 0.08) * pulse}) 0%, rgba(0,163,108,${(isLightSource ? 0.08 : 0.04) * pulse}) 40%, transparent 70%)`,
          pointerEvents: "none",
        }}
      />
    </div>
  );
};

// ─── GM sparkle (4-point star) with SVG path for morph ───

const SPARKLE_PATH =
  "M12 0C12 6.627 6.627 12 0 12c6.627 0 12 5.373 12 12 0-6.627 5.373-12 12-12-6.627 0-12-5.373-12-12z";

const GMSparkle: React.FC<{
  size?: number;
  opacity?: number;
  color?: string;
  id?: string;
}> = ({ size = 30, opacity = 1, color = GM.textInverse, id }) => (
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
    title: "Walk me through\nbuilding an ITP",
    body: [
      "Step 1: Select your target assets",
      "and weight distribution.",
      "An ITP is a fixed basket of assets,",
      "like an ETF. NAV floats with prices.",
    ],
    thumbColor: "#0A2E1F",
    accentColor: PURPLE,
  },
  {
    title: "Show me Vision\nmarket analytics",
    body: [
      "Top performers (24h):",
      "  BTC/USD  +4.2%",
      "  ETH/USD  +3.1%",
      "  SOL/USD  +7.8%",
      "  Total TVL: $2.4M",
    ],
    thumbColor: "#0A1F2E",
    accentColor: BLUE,
  },
  {
    title: "Generate a set of\nfantastical images",
    body: [],
    thumbColor: "#1B3B2E",
    accentColor: GM.greenStatus,
  },
  {
    title: "Role play as a\ncharacter from a novel",
    body: [
      "Goodness, what a delightful day!",
      "The sun fairly beams upon us — I should",
      "say it's an exceptional day for a walk",
      "in the countryside. Wouldn't you",
    ],
    thumbColor: "#1B4E3B",
    accentColor: PINK,
  },
];

const PromptCard: React.FC<{
  card: CardData;
  width?: number;
  opacity?: number;
  scale?: number;
  isActive?: boolean;
}> = ({ card, width = 200, opacity = 1, scale = 1, isActive = false }) => {
  const isCode = card.title.includes("Vision") || card.title.includes("analytics");
  return (
    <div
      style={{
        width,
        background: `linear-gradient(180deg, ${GM.bgDarkCard} 0%, ${GM.bgDarkCard} 95%, rgba(255,255,255,0.02) 100%)`,
        borderRadius: 12,
        padding: 14,
        opacity,
        transform: `scale(${scale})`,
        border: "0.5px solid rgba(255,255,255,0.06)",
        boxShadow: [
          `inset 0 1px 1px rgba(255,255,255,0.04)`,
          `inset 0 -1px 2px rgba(0,0,0,0.3)`,
          `0 4px 20px rgba(0,0,0,0.5)`,
          `0 0 20px ${card.accentColor}22`,
          ...(isActive
            ? [`0 0 20px rgba(0,163,108,0.15)`, `0 0 40px rgba(0,163,108,0.08)`]
            : []),
        ].join(", "),
        overflow: "hidden",
        position: "relative" as const,
      }}
    >
      {/* Glossy surface overlay */}
      <div
        style={{
          position: "absolute" as const,
          inset: 0,
          borderRadius: 12,
          background: "linear-gradient(180deg, rgba(255,255,255,0.05) 0%, transparent 40%, transparent 90%, rgba(255,255,255,0.02) 100%)",
          pointerEvents: "none" as const,
          zIndex: 1,
        }}
      />
      <div
        style={{
          width: "100%",
          height: 76,
          borderRadius: 8,
          background: `linear-gradient(135deg, ${card.thumbColor}, ${card.accentColor}33)`,
          marginBottom: 10,
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
                background: `radial-gradient(circle, ${GM.green}, ${PURPLE})`,
                position: "absolute" as const,
                top: 22,
                left: "30%",
                boxShadow: `0 0 15px ${PURPLE}`,
              }}
            />
            <div
              style={{
                width: 20,
                height: 20,
                borderRadius: "50%",
                background: `radial-gradient(circle, ${GM.greenStatus}, ${GM.bgDark})`,
                position: "absolute" as const,
                top: 37,
                left: "55%",
                boxShadow: `0 0 10px ${GM.greenStatus}`,
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
              background: `linear-gradient(180deg, #006644, ${GM.green})`,
              boxShadow: "0 0 10px rgba(0,163,108,0.5)",
            }}
          />
        )}
      </div>
      <div
        style={{
          color: GM.textInverse,
          fontSize: 12,
          fontFamily: FONT,
          fontWeight: 500,
          lineHeight: 1.35,
          whiteSpace: "pre-line",
          marginBottom: 6,
          letterSpacing: 0.1,
        }}
      >
        {card.title}
      </div>
      {card.body.length > 0 && (
        <div
          style={{
            color: "rgba(255,255,255,0.4)",
            fontSize: 8.5,
            fontFamily: isCode
              ? "'Fira Code', 'SF Mono', monospace"
              : FONT,
            lineHeight: 1.55,
            letterSpacing: 0.05,
          }}
        >
          {card.body.map((line, i) => (
            <div key={i}>
              {isCode ? (
                <span
                  style={{
                    color:
                      line.startsWith("<") || line.startsWith(" ")
                        ? "#86EFAC"
                        : "rgba(255,255,255,0.4)",
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
          height: 1.5,
          background: `linear-gradient(90deg, transparent, ${card.accentColor}88, transparent)`,
          boxShadow: `0 0 8px ${card.accentColor}66`,
        }}
      />
    </div>
  );
};

// ─── Full interface mockup (uses frame for typing only) ───

const GMInterface: React.FC<{
  frame: number;
  fps: number;
  style?: React.CSSProperties;
  className?: string;
}> = ({ frame, fps, style, className }) => {
  // "Welcome back." type-in with variable speed
  const helloText = "Welcome back.";
  const handDelays = [3.5, 1.6, 1.4, 1.2, 1.8, 8, 5, 4, 1.5, 1.3, 1.7, 7, 4];
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

  const darkCards = [
    {emoji:"\uD83D\uDCDA",title:"Walk me through building an ITP",sub:"Step-by-step guide"},
    {emoji:"\uD83D\uDCC8",title:"Show me Vision analytics",sub:"Market predictions"},
  ];

  return (
    <div
      className={className}
      style={{
        width: 820,
        height: 500,
        background: GM.bgDark,
        borderRadius: 12,
        position: "relative",
        overflow: "hidden",
        boxShadow: `
          0 0 60px rgba(0,163,108,0.08),
          0 20px 60px rgba(0,0,0,0.6),
          inset 0 1px 0 rgba(255,255,255,0.04)
        `,
        ...style,
      }}
    >
      {/* Subtle green gradient border */}
      <div
        style={{
          position: "absolute",
          inset: -1,
          borderRadius: 13,
          padding: 1,
          background: `linear-gradient(135deg, ${GM_GREEN}, ${GM_DARK_GREEN})`,
          WebkitMask:
            "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
          WebkitMaskComposite: "xor" as any,
          maskComposite: "exclude" as any,
          pointerEvents: "none" as const,
          zIndex: 10,
        }}
      />

      {/* Browser chrome — dark GM top bar */}
      <div
        style={{
          height: 64,
          backgroundColor: GM.bgDarkCard,
          borderBottom: "1px solid #333",
          display: "flex",
          alignItems: "center",
          padding: "0 24px",
        }}
      >
        {/* Left: GM logo (white on dark) + brand name */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <svg width="36" height="36" viewBox="0 0 102 102" fill="none">
            <rect width="102" height="102" fill="white"/>
            <rect x="15" y="48" width="15" height="6" rx="3" fill={GM.bgDarkCard}/>
            <rect x="27" y="48" width="15" height="6" rx="3" fill={GM.bgDarkCard}/>
            <rect x="38" y="48" width="15" height="6" rx="3" fill={GM.bgDarkCard}/>
            <rect x="49" y="48" width="15" height="6" rx="3" fill={GM.bgDarkCard}/>
            <rect x="61" y="48" width="9" height="6" rx="3" fill={GM.bgDarkCard}/>
            <rect x="66" y="48" width="15" height="6" rx="3" fill={GM.bgDarkCard}/>
            <rect x="78" y="48" width="9" height="6" rx="3" fill={GM.bgDarkCard}/>
          </svg>
          <span
            style={{
              fontSize: 22,
              fontFamily: FONT,
              fontWeight: 900,
              color: GM.textInverse,
              letterSpacing: "-0.03em",
            }}
          >
            General Market
          </span>
        </div>
        {/* Center nav */}
        <div style={{ flex: 1, display: "flex", justifyContent: "center", gap: 32 }}>
          {["Markets", "Portfolio", "Vision"].map((n) => (
            <span
              key={n}
              style={{
                fontSize: 14,
                fontFamily: FONT,
                fontWeight: 600,
                color: GM.textInverse,
              }}
            >
              {n}
            </span>
          ))}
        </div>
        {/* Right: Connect Wallet */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: "#22C55E" }} />
          <div
            style={{
              border: `2px solid ${GM.textInverse}`,
              borderRadius: 8,
              padding: "6px 16px",
              fontSize: 13,
              fontFamily: FONT,
              fontWeight: 600,
              color: GM.textInverse,
            }}
          >
            Connect Wallet
          </div>
        </div>
      </div>

      {/* Main content area */}
      <div
        style={{
          padding: "44px 60px 30px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          height: "calc(100% - 64px)",
          position: "relative",
        }}
      >
        <div
          style={{
            fontSize: 48,
            fontFamily: FONT,
            fontWeight: 900,
            letterSpacing: "-0.035em",
            lineHeight: 1.2,
            marginBottom: 8,
            textAlign: "center",
          }}
        >
          <GradientText
            gradient={`linear-gradient(135deg, ${GM_GREEN}, ${GM_DARK_GREEN})`}
          >
            {typedHello}
          </GradientText>
          {visibleChars < helloText.length && (
            <span
              style={{
                display: "inline-block",
                width: 2,
                height: 40,
                background: `linear-gradient(180deg, ${GM_GREEN}, ${GM_DARK_GREEN})`,
                marginLeft: 2,
                verticalAlign: "middle",
                opacity: Math.floor(frame / 8) % 2 === 0 ? 0.8 : 0.15,
              }}
            />
          )}
        </div>

        <div
          style={{
            fontSize: 20,
            fontFamily: FONT,
            fontWeight: 400,
            color: "rgba(255,255,255,0.5)",
            opacity: subtitleProgress,
            marginBottom: 32,
          }}
        >
          What would you like to trade?
        </div>

        {/* Dark suggestion cards */}
        <div
          style={{
            display: "flex",
            gap: 14,
            opacity: cardsProgress,
          }}
        >
          {darkCards.map((card, i) => (
            <div
              key={i}
              className={`interface-card interface-card-${i}`}
              style={{
                width: 220,
                backgroundColor: GM.bgDarkCard,
                border: "1px solid #333",
                borderRadius: 6,
                padding: "18px 16px",
              }}
            >
              <div
                style={{
                  fontSize: 14,
                  fontFamily: FONT,
                  fontWeight: 600,
                  color: GM.textInverse,
                  lineHeight: 1.3,
                  marginBottom: 4,
                }}
              >
                {card.emoji} {card.title}
              </div>
              <div
                style={{
                  fontSize: 12,
                  fontFamily: FONT,
                  fontWeight: 400,
                  color: "#A1A1AA",
                  lineHeight: 1.3,
                }}
              >
                {card.sub}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Input bar */}
      <div
        style={{
          position: "absolute",
          bottom: 40,
          left: 40,
          right: 40,
          height: 48,
          borderRadius: 12,
          border: "1px solid #333",
          background: GM.bgDarkCard,
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
            fontSize: 14,
          }}
        >
          Enter a prompt here...
        </span>
      </div>

      {/* Disclaimer */}
      <div
        style={{
          position: "absolute",
          bottom: 14,
          left: 0,
          right: 0,
          textAlign: "center",
          fontSize: 11,
          fontFamily: FONT,
          color: "rgba(255,255,255,0.2)",
          opacity: cardsProgress,
        }}
      >
        GM may display inaccurate info. Verify on-chain.
      </div>
    </div>
  );
};

// ─── Phone mockup (3D with depth) ───

const PhoneMockup: React.FC<{
  className?: string;
  style?: React.CSSProperties;
}> = ({ className, style }) => {
  const W = 180;
  const H = 360;
  const DEPTH = 12;
  const BR = 24;

  return (
    <div
      className={className}
      style={{
        width: W,
        height: H,
        position: "relative",
        transformStyle: "preserve-3d",
        ...style,
      }}
    >
      {/* Front face — the screen */}
      <div
        style={{
          position: "absolute",
          width: W,
          height: H,
          background: GM.bgSurface,
          borderRadius: BR,
          border: "3px solid #333",
          overflow: "hidden",
          transform: `translateZ(${DEPTH / 2}px)`,
          backfaceVisibility: "hidden",
          boxShadow: "0 0 20px rgba(0,0,0,0.3)",
        }}
      >
        <div
          style={{
            height: 24,
            background: GM.bgPage,
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
        <div style={{ padding: 14, background: GM.bgPage, height: "100%" }}>
          <div
            style={{
              fontSize: 20,
              fontWeight: 400,
              fontFamily: FONT,
              color: "#333",
              marginBottom: 12,
            }}
          >
            Portfolio
          </div>
          {[
            { bg: GM.greenLight, color: GM.green, text: "Show my positions..." },
            { bg: GM.greenLight, color: GM.greenDark, text: "Create new ITP..." },
            { bg: GM.greenLight, color: GM.greenStatus, text: "Vision markets..." },
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
              style={{ width: 8, height: 12, borderRadius: 4, background: GM.bgPage }}
            />
          </div>
        </div>
      </div>
      {/* Back face */}
      <div
        style={{
          position: "absolute",
          width: W,
          height: H,
          background: `linear-gradient(180deg, #2A2A2A, ${GM.textPrimary})`,
          borderRadius: BR,
          transform: `translateZ(-${DEPTH / 2}px) rotateY(180deg)`,
          backfaceVisibility: "hidden",
        }}
      />
      {/* Right edge */}
      <div
        style={{
          position: "absolute",
          width: DEPTH,
          height: H - BR,
          background: "linear-gradient(180deg, #444, #222)",
          transform: `rotateY(90deg) translateZ(${W / 2 - DEPTH / 2}px)`,
          top: BR / 2,
          left: W / 2 - DEPTH / 2,
        }}
      />
      {/* Left edge */}
      <div
        style={{
          position: "absolute",
          width: DEPTH,
          height: H - BR,
          background: "linear-gradient(180deg, #444, #222)",
          transform: `rotateY(-90deg) translateZ(${W / 2 - DEPTH / 2}px)`,
          top: BR / 2,
          left: W / 2 - DEPTH / 2,
        }}
      />
      {/* Top edge */}
      <div
        style={{
          position: "absolute",
          width: W - BR,
          height: DEPTH,
          background: "#3A3A3A",
          transform: `rotateX(90deg) translateZ(${DEPTH / 2}px)`,
          top: -DEPTH / 2,
          left: BR / 2,
          borderRadius: "2px 2px 0 0",
        }}
      />
      {/* Bottom edge */}
      <div
        style={{
          position: "absolute",
          width: W - BR,
          height: DEPTH,
          background: "#2A2A2A",
          transform: `rotateX(-90deg) translateZ(${H - DEPTH / 2}px)`,
          top: -DEPTH / 2,
          left: BR / 2,
          borderRadius: "0 0 2px 2px",
        }}
      />
    </div>
  );
};

// ─── Ultra 1.0 orb ───

const UltraOrb: React.FC<{
  frame: number;
  fps: number;
  className?: string;
  style?: React.CSSProperties;
}> = ({ frame, fps, className, style }) => {
  const rotation = (frame / (fps * 10)) * 360;
  const pulseScale = 1 + 0.015 * Math.sin((frame / fps) * Math.PI * 2);
  const orbSize = 480;

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
          background: `radial-gradient(circle, rgba(0,138,90,0.06) 30%, rgba(0,163,108,0.03) 50%, transparent 70%)`,
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
            radial-gradient(ellipse at 30% 20%, rgba(0,100,70,0.5) 0%, transparent 45%),
            radial-gradient(ellipse at 70% 80%, rgba(0,60,40,0.25) 0%, transparent 45%),
            radial-gradient(circle at 50% 50%, #0C1A14 0%, ${GM.bgDark} 100%)
          `,
          boxShadow: `
            inset 0 -30px 50px rgba(0,0,0,0.6),
            inset 0 15px 40px rgba(0,163,108,0.1),
            inset -10px 0 30px rgba(0,80,50,0.08)
          `,
        }}
      />
      {/* Text — 80px, dominates the orb interior */}
      <div
        style={{
          position: "relative",
          fontSize: 80,
          fontFamily: FONT,
          fontWeight: 400,
          color: GM.textInverse,
          textShadow: "0 0 30px rgba(0,163,108,0.25)",
          zIndex: 1,
          letterSpacing: 2,
        }}
      >
        GM Pro
      </div>
    </div>
  );
};

// ─── Spiral inward text chars ───
const SPIRAL_TEXT = "With access to";
const SPIRAL_CHARS = SPIRAL_TEXT.split("");
const SPIRAL_WORDS = ["Vision", "ITPs", "Analytics", "Oracles", "Markets", "Portfolio"];

// ─── Circular stamp text (coin/seal style) ───
const STAMP_TEXT = "Vision  ·  ITPs  ·  Analytics  ·  Oracles  ·  Markets  ·  Portfolio  ·  ";
const STAMP_CHARS = STAMP_TEXT.split("");

// ═══ MAIN SCENE — GSAP-DRIVEN ═══

export const Scene05: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const tl = useRef<gsap.core.Timeline>(gsap.timeline({ paused: true }));
  const containerRef = useRef<HTMLDivElement>(null);
  const builtRef = useRef(false);

  // Refs for GSAP-targeted elements
  const phoneARef = useRef<HTMLDivElement>(null);
  const interfaceWrapRef = useRef<HTMLDivElement>(null);
  const interfaceGlowRef = useRef<HTMLDivElement>(null);
  const kineticERefs = useRef<(HTMLSpanElement | null)[]>([]);
  const kineticFRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const cardZoomGRef = useRef<HTMLDivElement>(null);
  const typewriterHRef = useRef<HTMLDivElement>(null);
  const cardZoomIRef = useRef<HTMLDivElement>(null);
  const cardPeekRef = useRef<HTMLDivElement>(null);
  const kineticJRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const cardsPanRef = useRef<HTMLDivElement>(null);
  const cardPanItemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const spiralContainerRef = useRef<HTMLDivElement>(null);
  const spiralWordsRef = useRef<(HTMLDivElement | null)[]>([]);
  const spiralRingRef = useRef<HTMLDivElement>(null);
  const spiralTextRef = useRef<HTMLDivElement>(null);
  const spiralCharsRef = useRef<(HTMLDivElement | null)[]>([]);
  const spiralGlowRef = useRef<HTMLDivElement>(null);
  const orbWrapRef = useRef<HTMLDivElement>(null);
  const expTitleRef = useRef<HTMLDivElement>(null);
  const expUrlRef = useRef<HTMLDivElement>(null);
  const expPhoneRef = useRef<HTMLDivElement>(null);
  const expDesktopRef = useRef<HTMLDivElement>(null);
  const expDevicesRef = useRef<HTMLDivElement>(null);
  const sparkleWrapRef = useRef<HTMLDivElement>(null);
  // gFinalWrapRef removed — replaced by GMLightShow
  const interfaceBackdropRef = useRef<HTMLDivElement>(null);
  const disclaimerRef = useRef<HTMLDivElement>(null);
  const bgGlowRef = useRef<HTMLDivElement>(null);
  const expFadeRef = useRef<HTMLDivElement>(null);
  const sparkleDecoRef = useRef<HTMLDivElement>(null);
  const sparkleDecoCurvesRef = useRef<SVGSVGElement>(null);
  const expSectionRef = useRef<HTMLDivElement>(null);

  // Item 2: continuous 3D float for the interface — always drifting, never static
  const interfaceFloat = useFloat3D(frame, fps, {
    rotateX: { amplitude: 2.5, frequency: 0.18, noise: 0.25 },
    rotateY: { amplitude: 3, frequency: 0.14, noise: 0.3 },
    translateX: { amplitude: 4, frequency: 0.12 },
    translateY: { amplitude: 3, frequency: 0.15 },
    perspective: 1200,
  });

  // Compute interface local frame for typing animation
  const interfaceLocalFrame = Math.max(0, frame - 75);

  // Typewriter state for segment H
  const typewriterText = "market analysis";
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
  const kineticE = { text: "Our most powerful", accent: "most powerful" };
  const kineticF = { text: "for alpha generation", accent: "alpha generation" };
  const kineticJ = { text: "and more", accent: "more" };

  // Pre-compute char start X offsets for "With access to" at ~52px font
  const spiralCharParams = useMemo(() => {
    const charWidths = SPIRAL_CHARS.map(ch =>
      ch === " " ? 14 : ch === "W" ? 36 : ch.toLowerCase() === "m" ? 28 : 22
    );
    const totalWidth = charWidths.reduce((a, b) => a + b, 0);
    let cumX = -totalWidth / 2;
    return SPIRAL_CHARS.map((ch, i) => {
      const startX = cumX + charWidths[i] / 2;
      cumX += charWidths[i];
      return {
        ch,
        startX,
        isAccent: i >= 5 && i <= 10, // "access" highlighted
      };
    });
  }, []);

  // ─── Build GSAP timeline (useLayoutEffect = synchronous, before paint) ───
  useLayoutEffect(() => {
    if (!containerRef.current) return;
    const t = tl.current;
    t.clear();

    // Convert frame to seconds for GSAP
    const f = (fr: number) => fr / fps;

    // ═══ A: Dark void + phone (0-30) ═══
    // G logo removed — scene opens directly into GM Advanced title

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
      }, f(40)); // well past transition — no phone during S04→S05 crossfade
      t.to(phoneARef.current, {
        x: 0,
        y: 0,
        rotateY: 15,
        rotateX: -5,
        scale: 0.42,
        duration: f(28),
        ease: "power2.out",
      }, f(24)); // delay past transition
      t.to(phoneARef.current, {
        opacity: 0,
        duration: f(10),
        ease: "power2.in",
      }, f(46)); // shifted to match delayed start
    }

    // ═══ B+C+D: GM Interface (0-150) ═══
    // Faster dezoom so "Welcome back" is visible by frame 30.
    // Frame 0: scale=2.5, rotateY=-15°, rotateX=6°
    // Frame 20: scale=1.5, rotateY=-8°, rotateX=3°
    // Frame 40: scale=1.1, rotateY=-3°, rotateX=1.5°
    // Frame 60: scale=1.0, rotateY=-1°, rotateX=0.5° — settled
    if (interfaceWrapRef.current) {
      t.set(interfaceWrapRef.current, {
        opacity: 0,
        rotateX: 6,
        rotateY: -15,
        scale: 2.5,
        transformOrigin: "15% 7%",
        x: 0,
        y: 0,
      }, 0);
      // Fade in immediately — title visible during S04→S05 crossfade
      t.to(interfaceWrapRef.current, {
        opacity: 1,
        duration: f(8),
        ease: "power2.out",
      }, f(0));
      // Phase 1: frame 0→20 — scale 2.5→1.5, rotateY -15→-8, rotateX 6→3
      t.to(interfaceWrapRef.current, {
        rotateX: 3,
        rotateY: -8,
        scale: 1.5,
        duration: f(20),
        ease: "power2.out",
      }, f(0));
      // Phase 2: frame 20→40 — scale 1.5→1.1, rotateY -8→-3, rotateX 3→1.5
      t.to(interfaceWrapRef.current, {
        rotateX: 1.5,
        rotateY: -3,
        scale: 1.1,
        transformOrigin: "35% 30%",
        duration: f(20),
        ease: "power2.inOut",
      }, f(20));
      // Phase 3: frame 40→60 — scale 1.1→1.0, rotateY -3→-1, rotateX 1.5→0.5 — settled
      t.to(interfaceWrapRef.current, {
        rotateX: 0.5,
        rotateY: -1,
        scale: 1.0,
        transformOrigin: "50% 50%",
        duration: f(20),
        ease: "power1.out",
      }, f(40));
      // Phase 4: final rest (90-100) — settle to flat
      t.to(interfaceWrapRef.current, {
        rotateX: 0,
        rotateY: 0,
        scale: 0.95,
        duration: f(10),
        ease: "power1.out",
      }, f(90));
      // Fade out
      t.to(interfaceWrapRef.current, {
        opacity: 0,
        duration: f(15),
        ease: "power2.in",
      }, f(135));
    }

    // Rainbow border glow — bright during zoomed title, fades as interface settles
    if (interfaceGlowRef.current) {
      t.set(interfaceGlowRef.current, { opacity: 0 }, 0);
      t.to(interfaceGlowRef.current, {
        opacity: 1,
        duration: f(10),
        ease: "power2.out",
      }, f(0));
      // Hold glow during title phase, then fade as we pull back
      t.to(interfaceGlowRef.current, {
        opacity: 0,
        duration: f(30),
        ease: "power2.inOut",
      }, f(45));
    }

    // Disclaimer
    if (disclaimerRef.current) {
      t.set(disclaimerRef.current, { opacity: 0 }, 0);
      t.to(disclaimerRef.current, {
        opacity: 0.4,
        duration: f(10),
        ease: "power1.inOut",
      }, f(20));
      t.to(disclaimerRef.current, {
        opacity: 0,
        duration: f(10),
        ease: "power1.inOut",
      }, f(130));
    }

    // Interface backdrop (visible behind 3D rotating cards)
    if (interfaceBackdropRef.current) {
      t.set(interfaceBackdropRef.current, { opacity: 0, rotateX: 12, rotateY: -8 }, 0);
      // G segment — interface tilted in 3D behind rotating card
      t.to(interfaceBackdropRef.current, {
        opacity: 0.35,
        rotateX: 8,
        rotateY: -5,
        duration: f(12),
        ease: "power1.inOut",
      }, f(255));
      t.to(interfaceBackdropRef.current, {
        opacity: 0,
        duration: f(10),
        ease: "power1.inOut",
      }, f(302));
      // H segment — faint behind typewriter
      t.to(interfaceBackdropRef.current, {
        opacity: 0.15,
        rotateX: 5,
        rotateY: 3,
        duration: f(8),
        ease: "power1.inOut",
      }, f(310));
      t.to(interfaceBackdropRef.current, {
        opacity: 0,
        duration: f(8),
        ease: "power1.inOut",
      }, f(340));
      // I segment — interface behind code card
      t.to(interfaceBackdropRef.current, {
        opacity: 0.3,
        rotateX: 6,
        rotateY: 6,
        duration: f(10),
        ease: "power1.inOut",
      }, f(348));
      t.to(interfaceBackdropRef.current, {
        opacity: 0,
        duration: f(10),
        ease: "power1.inOut",
      }, f(393));
      // K segment — behind carousel pan
      t.to(interfaceBackdropRef.current, {
        opacity: 0.25,
        rotateX: 10,
        rotateY: -4,
        duration: f(10),
        ease: "power1.inOut",
      }, f(428));
      t.to(interfaceBackdropRef.current, {
        opacity: 0,
        duration: f(8),
        ease: "power1.inOut",
      }, f(472));
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
    // Dark mode card zoom: scale=1.8-2.0, rotateY=-10 entrance, ~2s hold
    if (cardZoomGRef.current) {
      t.set(cardZoomGRef.current, { opacity: 0, scale: 0.6, x: 200, rotateY: 15 }, 0);
      // Zoom in: scale to 1.9 with rotateY=-10 tilt (cinematic detail zoom)
      t.to(cardZoomGRef.current, {
        opacity: 1,
        scale: 1.9,
        x: 0,
        rotateY: -10,
        duration: f(18),
        ease: "power2.out",
      }, f(260));
      // Slow drift at scale — subtle rotation rock during 2s hold
      t.to(cardZoomGRef.current, {
        scale: 2.0,
        rotateY: 8,
        duration: f(30),
        ease: "sine.inOut",
      }, f(278));
      // Exit
      t.to(cardZoomGRef.current, {
        opacity: 0,
        scale: 1.6,
        x: -80,
        rotateY: -5,
        duration: f(10),
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

    // ═══ I: Card zoom 1 — "Help me write HTML" (350-400) ═══
    // Dark mode card zoom: scale=1.8-2.0, rotateY=10 entrance (mirrored from G)
    if (cardZoomIRef.current) {
      t.set(cardZoomIRef.current, { opacity: 0, scale: 0.6, x: -180, rotateY: -15 }, 0);
      // Zoom in: scale to 1.8 with rotateY=10 tilt
      t.to(cardZoomIRef.current, {
        opacity: 1,
        scale: 1.8,
        x: 0,
        rotateY: 10,
        duration: f(18),
        ease: "power2.out",
      }, f(350));
      // Slow drift at scale — subtle rotation rock during 2s hold
      t.to(cardZoomIRef.current, {
        scale: 2.0,
        rotateY: -8,
        duration: f(30),
        ease: "sine.inOut",
      }, f(368));
      // Exit
      t.to(cardZoomIRef.current, {
        opacity: 0,
        scale: 1.6,
        x: 120,
        rotateY: 5,
        duration: f(10),
        ease: "power2.in",
      }, f(395));
    }

    // Card peek (card 0 peeking from left during I, also rotating)
    if (cardPeekRef.current) {
      t.set(cardPeekRef.current, { opacity: 0, rotateY: -20 }, 0);
      t.to(cardPeekRef.current, {
        opacity: 0.5,
        rotateY: 15,
        duration: f(15),
        ease: "power1.out",
      }, f(350));
      t.to(cardPeekRef.current, {
        opacity: 0,
        rotateY: 30,
        duration: f(10),
        ease: "power1.in",
      }, f(390));
    }

    // ═══ K: Cards pan 2+3 (430-465) — compressed from 50→35 frames ═══
    if (cardsPanRef.current) {
      t.set(cardsPanRef.current, { opacity: 0, x: 200 }, 0);
      // Sweep container in
      t.to(cardsPanRef.current, {
        opacity: 1,
        x: 0,
        duration: f(12),
        ease: "power2.out",
      }, f(430));
      // Pan container left
      t.to(cardsPanRef.current, {
        x: -180,
        duration: f(30),
        ease: "power1.inOut",
      }, f(430));
      t.to(cardsPanRef.current, {
        opacity: 0,
        duration: f(6),
        ease: "power1.in",
      }, f(458));
    }
    // Each card in K rocks gently on its own Y-axis (NOT 360° spin)
    cardPanItemRefs.current.forEach((el, i) => {
      if (!el) return;
      const dir = i === 0 ? 1 : -1;
      t.set(el, { rotateY: dir * -15 }, 0);
      t.to(el, {
        rotateY: dir * 20,
        duration: f(24),
        ease: "sine.inOut",
      }, f(430));
      t.to(el, {
        rotateY: dir * -15,
        duration: f(24),
        ease: "sine.inOut",
      }, f(454));
    });

    // ═══ L: "With access to" — compressed from 40→25 frames (465-490) ═══
    // Phase 1: readable text appears
    if (spiralTextRef.current) {
      t.set(spiralTextRef.current, { opacity: 0 }, 0);
      t.to(spiralTextRef.current, {
        opacity: 1,
        duration: f(8),
        ease: "power2.out",
      }, f(465));
      // Hide readable text when chars start peeling
      t.to(spiralTextRef.current, {
        opacity: 0,
        duration: f(1),
      }, f(478));
    }

    // Phase 2: chars peel from right side, curving inward to center
    const totalChars = spiralCharsRef.current.length;
    spiralCharsRef.current.forEach((el, i) => {
      if (!el) return;
      const params = spiralCharParams[i];

      // Start invisible at text position
      t.set(el, { opacity: 0, x: params.startX, y: 0, rotation: 0, scale: 1 }, 0);
      // Make visible when readable text hides
      t.set(el, { opacity: 1 }, f(478));

      // Later chars (end of text) move first — "to" peels before "With"
      const reverseIdx = totalChars - 1 - i;
      const staggerFrame = 478 + reverseIdx * 0.5;

      // Each char curves through a control point before converging to center
      const arcDirX = params.startX > 0 ? 1 : -1;
      const arcDirY = params.startX > 0 ? -1 : 1;
      const arcMag = 90 + Math.abs(params.startX) * 0.4;

      const waypoints = [
        { x: params.startX, y: 0 },
        { x: params.startX * 0.7 + arcDirX * arcMag * 0.3, y: arcDirY * arcMag },
        { x: params.startX * 0.15 + arcDirX * arcMag * 0.1, y: arcDirY * arcMag * 0.5 },
        { x: 0, y: 0 },
      ];

      const dur = 16 + reverseIdx * 0.3;

      t.to(el, {
        motionPath: {
          path: waypoints,
          curviness: 2,
        },
        scale: 0.15,
        rotation: (i % 2 === 0 ? 1 : -1) * (12 + reverseIdx * 2.5),
        opacity: 0,
        duration: f(dur),
        ease: "power3.in",
      }, f(staggerFrame));
    });

    // Circular stamp text — rotation driven by frame*12 in JSX, GSAP controls opacity only
    if (spiralRingRef.current) {
      t.set(spiralRingRef.current, { opacity: 0, scale: 0.6 }, 0);
      // Snap visible
      t.to(spiralRingRef.current, {
        opacity: 1,
        scale: 1,
        duration: f(6),
        ease: "power2.out",
      }, f(465));
      // Exit — shrink and fade
      t.to(spiralRingRef.current, {
        scale: 0.15,
        opacity: 0,
        duration: f(8),
        ease: "power2.in",
      }, f(488));
    }

    // Spiral center glow
    if (spiralGlowRef.current) {
      t.set(spiralGlowRef.current, { opacity: 0 }, 0);
      t.to(spiralGlowRef.current, {
        opacity: 0.6,
        duration: f(14),
        ease: "power1.in",
      }, f(476));
      t.to(spiralGlowRef.current, {
        opacity: 1,
        duration: f(6),
        ease: "power1.in",
      }, f(486));
      t.to(spiralGlowRef.current, {
        opacity: 0,
        duration: f(4),
        ease: "power1.out",
      }, f(492));
    }

    // ═══ M: Ultra 1.0 orb (490-540) — shifted earlier by 30 frames ═══
    if (orbWrapRef.current) {
      t.set(orbWrapRef.current, { opacity: 0, scale: 0.4 }, 0);
      // Spring entrance
      t.to(orbWrapRef.current, {
        opacity: 1,
        scale: 1,
        duration: f(18),
        ease: "elastic.out(1, 0.45)",
      }, f(490));
      // Exit
      t.to(orbWrapRef.current, {
        opacity: 0,
        scale: 0.8,
        duration: f(14),
        ease: "power2.in",
      }, f(530));
    }

    // ═══ N: Experience GM + devices (540-610) ═══
    // Device Duo: phone (left, rotateY=30°) and laptop (right, rotateY=-30°)
    // Both slide in from offscreen-right with momentum, overshoot, settle by frame 585 (1.5s)
    if (expTitleRef.current) {
      t.set(expTitleRef.current, { opacity: 0, y: 20 }, 0);
      t.to(expTitleRef.current, {
        opacity: 1,
        y: 0,
        duration: f(12),
        ease: "power2.out",
      }, f(540));
    }
    if (expUrlRef.current) {
      t.set(expUrlRef.current, { opacity: 0, y: 10 }, 0);
      t.to(expUrlRef.current, {
        opacity: 1,
        y: 0,
        duration: f(10),
        ease: "power2.out",
      }, f(545));
    }
    // Phone — slides in from right, overshoots left, settles at left-third position
    if (expPhoneRef.current) {
      t.set(expPhoneRef.current, { opacity: 0, x: 600, y: 20 }, 0);
      // Fade in as it enters
      t.to(expPhoneRef.current, {
        opacity: 1,
        duration: f(8),
        ease: "power1.out",
      }, f(540));
      // Slide in with overshoot — arrives frame 540+45=585
      t.to(expPhoneRef.current, {
        x: -15,
        y: 0,
        duration: f(35),
        ease: "power3.out",
      }, f(540));
      // Settle from overshoot
      t.to(expPhoneRef.current, {
        x: 0,
        duration: f(10),
        ease: "elastic.out(1, 0.6)",
      }, f(575));
    }
    // Desktop — slides in from right (slightly delayed), overshoots, settles
    if (expDesktopRef.current) {
      t.set(expDesktopRef.current, { opacity: 0, x: 700, y: 15 }, 0);
      // Fade in
      t.to(expDesktopRef.current, {
        opacity: 1,
        duration: f(8),
        ease: "power1.out",
      }, f(543));
      // Slide in with overshoot — staggered 3 frames after phone
      t.to(expDesktopRef.current, {
        x: 12,
        y: 0,
        duration: f(35),
        ease: "power3.out",
      }, f(543));
      // Settle from overshoot
      t.to(expDesktopRef.current, {
        x: 0,
        duration: f(10),
        ease: "elastic.out(1, 0.6)",
      }, f(578));
    }
    // Devices container — hold at full scale
    if (expDevicesRef.current) {
      t.set(expDevicesRef.current, { scale: 1 }, 0);
    }

    // OUT = SWOOSH LEFT: translateX 0 -> -1400 in 8 frames, expo.out
    if (expSectionRef.current) {
      t.set(expSectionRef.current, { x: 0, opacity: 1 }, 0);
      t.to(expSectionRef.current, {
        x: -1400,
        duration: f(8),
        ease: "expo.out",
      }, f(600));
      // Snap invisible after swoosh
      t.set(expSectionRef.current, { opacity: 0 }, f(608));
    }
    // Experience fade overlay
    if (expFadeRef.current) {
      t.set(expFadeRef.current, { opacity: 0 }, 0);
      t.to(expFadeRef.current, {
        opacity: 1,
        duration: f(6),
        ease: "power1.inOut",
      }, f(606));
    }

    // ═══ O+P: GM Light Show (610-694) ═══
    // Light show is self-animated via interpolate() — just control wrapper opacity
    if (sparkleWrapRef.current) {
      t.set(sparkleWrapRef.current, { opacity: 0 }, 0);
      t.to(sparkleWrapRef.current, {
        opacity: 1,
        duration: f(8),
        ease: "power1.out",
      }, f(610));
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

  // Light show opacity (GSAP drives the wrapper, interpolate drives internals)

  // Orb local frame for internal animation (shifted -30)
  const orbLocalFrame = Math.max(0, frame - 490);

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
          fontSize: 52,
          fontFamily: FONT,
          fontWeight: 300,
          color: GM.textInverse,
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
            radial-gradient(ellipse at ${bgGlowX}% ${bgGlowY}%, rgba(0,163,108,${bgGlowIntensity}) 0%, transparent 55%),
            radial-gradient(ellipse at ${100 - bgGlowX}% ${100 - bgGlowY}%, rgba(0,138,90,${bgGlow2 * 0.6}) 0%, transparent 50%),
            radial-gradient(ellipse at ${bgGlow3X}% ${bgGlow3Y}%, rgba(0,163,108,${bgGlow2 * 0.4}) 0%, transparent 45%)
          `,
          pointerEvents: "none",
          zIndex: 0,
        }}
      />

      {/* A: Phone */}
      <div
        ref={phoneARef}
        style={{
          position: "absolute",
          top: "28%",
          left: "22%",
          opacity: 0,
          perspective: 800,
        }}
      >
        <PhoneMockup style={{ transform: "scale(0.6) rotateY(8deg)" }} />
      </div>

      {/* B+C+D: GM Interface — float wrapper adds continuous 3D drift */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: `translate(-50%, -50%) ${interfaceFloat.transform}`,
          pointerEvents: "none",
        }}
      >
        <div
          ref={interfaceWrapRef}
          style={{
            opacity: 0,
            perspective: 1200,
            transformStyle: "preserve-3d",
          }}
        >
          {/* Rainbow border glow — visible during zoomed title phase */}
          <div
            ref={interfaceGlowRef}
            style={{
              position: "absolute",
              inset: -4,
              borderRadius: 16,
              opacity: 0,
              pointerEvents: "none",
              boxShadow: [
                `0 0 30px ${BLUE}`,
                `0 0 60px ${PURPLE}88`,
                `0 0 90px ${PINK}55`,
                `0 0 120px ${BLUE}33`,
              ].join(", "),
              zIndex: 20,
            }}
          />
          <GMInterface
            frame={interfaceLocalFrame}
            fps={fps}
          />
        </div>
      </div>

      {/* Interface backdrop — 3D perspective behind rotating cards */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          perspective: 1000,
          pointerEvents: "none",
        }}
      >
        <div
          ref={interfaceBackdropRef}
          style={{
            transformStyle: "preserve-3d",
            opacity: 0,
          }}
        >
          <GMInterface frame={90} fps={fps} />
        </div>
      </div>

      {/* E: "Our most capable AI" + FULL-FRAME 4-point star outline */}
      <div
        ref={sparkleDecoRef}
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          opacity: 0,
          pointerEvents: "none",
        }}
      >
        <svg width={600} height={600} viewBox="0 0 600 600">
          <path
            d="M300 20 C300 165, 165 300, 20 300 C165 300, 300 435, 300 580 C300 435, 435 300, 580 300 C435 300, 300 165, 300 20Z"
            fill="none"
            stroke="url(#sparkle-grad)"
            strokeWidth={2.5}
            opacity={0.7}
          />
          <defs>
            <linearGradient id="sparkle-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={PURPLE} />
              <stop offset="50%" stopColor={PINK} />
              <stop offset="100%" stopColor={BLUE} />
            </linearGradient>
          </defs>
        </svg>
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
        "rgba(0,138,90,0.6)"
      )}

      {/* F: "for reasoning" — lavender, not gradient */}
      {(() => {
        const words = kineticF.text.split(" ");
        const accentWords = new Set(kineticF.accent.split(" "));
        return (
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              fontSize: 52,
              fontFamily: FONT,
              fontWeight: 300,
              color: GM.textInverse,
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
                  ref={(el) => { kineticFRefs.current[i] = el; }}
                  style={{
                    display: "inline-block",
                    opacity: 0,
                    ...(isAccent
                      ? {
                          color: "#86EFAC",
                          filter: "drop-shadow(0 0 8px rgba(134,239,172,0.3))",
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
      })()}

      {/* G: Card zoom 0 — 3D rotating card */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          perspective: 800,
        }}
      >
        <div
          ref={cardZoomGRef}
          style={{
            transformStyle: "preserve-3d",
            opacity: 0,
          }}
        >
          {/* Front face */}
          <div style={{ backfaceVisibility: "hidden" }}>
            <PromptCard card={CARDS[0]} width={240} />
          </div>
          {/* Back face */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              backfaceVisibility: "hidden",
              transform: "rotateY(180deg)",
            }}
          >
            <div
              style={{
                width: 240,
                height: "100%",
                background: `linear-gradient(135deg, ${CARDS[0].thumbColor}, ${CARDS[0].accentColor}44)`,
                borderRadius: 16,
                border: "1px solid rgba(255,255,255,0.1)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: `0 0 30px ${CARDS[0].accentColor}33`,
              }}
            >
              <GMSparkle size={40} color={CARDS[0].accentColor} />
            </div>
          </div>
        </div>
      </div>

      {/* H: "{ coding }" typewriter — monospace terminal aesthetic */}
      <div
        ref={typewriterHRef}
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          fontSize: 52,
          fontFamily: "'Source Code Pro', 'JetBrains Mono', 'Fira Code', 'SF Mono', monospace",
          fontWeight: 400,
          color: GM.textInverse,
          whiteSpace: "nowrap",
          opacity: 0,
        }}
      >
        <span style={{ color: "rgba(255,255,255,0.4)" }}>{"{ "}</span>
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
        {twCharsVisible >= typewriterText.length && (
          <span style={{ color: "rgba(255,255,255,0.4)" }}>{" }"}</span>
        )}
      </div>

      {/* I: Card zoom 1 — 3D rotating code card */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          perspective: 800,
        }}
      >
        <div
          ref={cardZoomIRef}
          style={{
            transformStyle: "preserve-3d",
            opacity: 0,
          }}
        >
          {/* Front face */}
          <div style={{ backfaceVisibility: "hidden" }}>
            <PromptCard card={CARDS[1]} width={240} />
          </div>
          {/* Back face */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              backfaceVisibility: "hidden",
              transform: "rotateY(180deg)",
            }}
          >
            <div
              style={{
                width: 240,
                height: "100%",
                background: `linear-gradient(135deg, ${CARDS[1].thumbColor}, ${CARDS[1].accentColor}44)`,
                borderRadius: 16,
                border: "1px solid rgba(255,255,255,0.1)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: `0 0 30px ${CARDS[1].accentColor}33`,
              }}
            >
              <GMSparkle size={40} color={CARDS[1].accentColor} />
            </div>
          </div>
        </div>
      </div>

      {/* Card 0 peeking from left during I — 3D tilted */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "8%",
          transform: "translateY(-50%)",
          perspective: 800,
        }}
      >
        <div
          ref={cardPeekRef}
          style={{
            transformStyle: "preserve-3d",
            transform: "scale(1.2)",
            opacity: 0,
          }}
        >
          <PromptCard card={CARDS[0]} width={160} />
        </div>
      </div>

      {/* J: "and more" */}
      {buildKineticWords(
        kineticJ,
        kineticJRefs,
        `linear-gradient(90deg, rgba(190,230,210,1), rgba(170,210,190,1))`,
        "rgba(0,163,108,0.2)"
      )}

      {/* K: Cards pan 2+3 — each card rotates on its OWN axis */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          perspective: 800,
        }}
      >
        <div
          ref={cardsPanRef}
          style={{
            display: "flex",
            gap: 24,
            transformStyle: "preserve-3d",
            opacity: 0,
          }}
        >
          {[2, 3].map((idx, i) => (
            <div
              key={idx}
              ref={(el) => { cardPanItemRefs.current[i] = el; }}
              style={{
                transform: "scale(1.35)",
                transformStyle: "preserve-3d",
              }}
            >
              {/* Front face */}
              <div style={{ backfaceVisibility: "hidden" }}>
                <PromptCard card={CARDS[idx]} width={200} />
              </div>
              {/* Back face */}
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  backfaceVisibility: "hidden",
                  transform: "rotateY(180deg)",
                }}
              >
                <div
                  style={{
                    width: 200,
                    height: "100%",
                    background: `linear-gradient(135deg, ${CARDS[idx].thumbColor}, ${CARDS[idx].accentColor}44)`,
                    borderRadius: 16,
                    border: "1px solid rgba(255,255,255,0.1)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    boxShadow: `0 0 30px ${CARDS[idx].accentColor}33`,
                  }}
                >
                  <GMSparkle size={40} color={CARDS[idx].accentColor} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* L: "With access to" — readable text, then chars peel inward to orb */}
      <div
        ref={spiralContainerRef}
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: 0,
          height: 0,
          perspective: 900,
          transformStyle: "preserve-3d",
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
            width: 260,
            height: 260,
            borderRadius: "50%",
            background: `radial-gradient(circle,
              rgba(0,163,108,0.4) 0%,
              rgba(0,138,90,0.2) 25%,
              rgba(0,138,90,0.12) 45%,
              transparent 70%)`,
            pointerEvents: "none",
            opacity: 0,
          }}
        />

        {/* Readable text — appears first, then hidden when chars take over */}
        <div
          ref={spiralTextRef}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            transform: "translate(-50%, -50%)",
            fontSize: 52,
            fontFamily: FONT,
            fontWeight: 300,
            color: GM.textInverse,
            whiteSpace: "nowrap",
            opacity: 0,
          }}
        >
          With{" "}
          <GradientText gradient={`linear-gradient(90deg, ${PURPLE}, ${BLUE})`}>
            access
          </GradientText>{" "}
          to
        </div>

        {/* Individual characters — peel inward from text positions to center */}
        {SPIRAL_CHARS.map((ch, i) => {
          const isAccent = i >= 5 && i <= 10;
          return (
            <div
              key={`spiral-char-${i}`}
              ref={(el) => { spiralCharsRef.current[i] = el; }}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                transform: "translate(-50%, -50%)",
                fontSize: 52,
                fontFamily: FONT,
                fontWeight: 300,
                color: isAccent ? undefined : GM.textInverse,
                ...(isAccent ? {
                  background: `linear-gradient(90deg, ${PURPLE}, ${BLUE})`,
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text" as const,
                } : {}),
                whiteSpace: "nowrap",
                opacity: 0,
              }}
            >
              {ch === " " ? "\u00A0" : ch}
            </div>
          );
        })}

        {/* Circular stamp/coin text — characters placed on circle circumference */}
        <div
          ref={spiralRingRef}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            transform: "translate(-50%, -50%)",
            width: 0,
            height: 0,
            opacity: 0,
          }}
        >
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              transform: `translate(-50%, -50%) rotate(${frame * 30}deg)`,
              width: 0,
              height: 0,
            }}
          >
            {STAMP_CHARS.map((ch, i) => {
              const angleDeg = (i / STAMP_CHARS.length) * 360;
              const radius = 260;
              return (
                <div
                  key={`stamp-${i}`}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    transform: `rotate(${angleDeg}deg) translateY(-${radius}px)`,
                    transformOrigin: "0 0",
                    fontSize: 16,
                    fontFamily: FONT,
                    fontWeight: 400,
                    color: "rgba(255,255,255,0.85)",
                    whiteSpace: "nowrap",
                    textShadow: "0 0 12px rgba(255,255,255,0.25)",
                    letterSpacing: "0.5px",
                  }}
                >
                  {ch === " " ? "\u00A0" : ch}
                </div>
              );
            })}
          </div>
        </div>
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

      {/* N: Experience GM + devices — swooshes LEFT at 1:07 with motion blur */}
      {(() => {
        const swooshActive = frame >= 598 && frame <= 610;
        const expContent = (
          <div
            ref={expSectionRef}
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "flex-start",
              paddingTop: "18%",
              pointerEvents: "none",
            }}
          >
            <div
              ref={expTitleRef}
              style={{
                fontSize: 46,
                fontFamily: FONT,
                fontWeight: 400,
                color: GM.textInverse,
                opacity: 0,
                marginBottom: 10,
              }}
            >
              Experience{" "}
              <GradientText
                gradient={`linear-gradient(90deg, ${GM_GREEN}, ${GM_DARK_GREEN})`}
              >
                General Market
              </GradientText>
            </div>
            <div
              ref={expUrlRef}
              style={{
                fontSize: 16,
                fontFamily: FONT,
                color: "rgba(255,255,255,0.45)",
                opacity: 0,
                marginBottom: 32,
                letterSpacing: 0.5,
              }}
            >
              generalmarket.io
            </div>
            <div
              ref={expDevicesRef}
              style={{
                display: "flex",
                gap: 80,
                alignItems: "center",
                justifyContent: "center",
                marginTop: 0,
              }}
            >
              {/* Phone LEFT — rotateY=30° toward viewer, continuous noise float */}
              <div ref={expPhoneRef} style={{ opacity: 0, perspective: 800 }}>
                <PhoneMockup style={{
                  transform: `scale(1.15) rotateY(30deg) rotateX(${frame >= 540 ? organicOffset(frame, "duoPhRx", 0.012, 1.5) : 0}deg) translateY(${frame >= 540 ? organicOffset(frame, "duoPhTy", 0.015, 2) : 0}px)`,
                  transformStyle: "preserve-3d" as const,
                }} />
              </div>
              {/* Desktop RIGHT — rotateY=-30° toward viewer, continuous noise float */}
              <div ref={expDesktopRef} style={{ opacity: 0, perspective: 800 }}>
                <div
                  style={{
                    transform: `scale(0.8) rotateY(-30deg) rotateX(${frame >= 540 ? organicOffset(frame, "duoDtRx", 0.01, 1.2) : 0}deg) translateY(${frame >= 540 ? organicOffset(frame, "duoDtTy", 0.013, 1.8) : 0}px)`,
                    transformOrigin: "center center",
                    transformStyle: "preserve-3d" as const,
                  }}
                >
                  <GMInterface frame={90} fps={fps} />
                </div>
              </div>
            </div>
          </div>
        );
        return swooshActive ? (
          <CameraMotionBlur samples={8} shutterAngle={180}>{expContent}</CameraMotionBlur>
        ) : expContent;
      })()}

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

      {/* O+P: GM Light Show (610-694) */}
      <div
        ref={sparkleWrapRef}
        style={{
          position: "absolute",
          inset: 0,
          opacity: 0,
        }}
      >
        <GMLightShow frame={frame} opacity={1} fps={fps} />
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
        GM Pro is available globally.
        No KYC required. Decentralized and permissionless.
      </div>
    </AbsoluteFill>
  );
};

export const scene05Meta = {
  id: "GMScene05",
  component: Scene05,
  width: 1280,
  height: 720,
  fps: 30,
  durationInFrames: 720,
};
