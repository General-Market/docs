import React, { useMemo } from "react";
import {
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
  AbsoluteFill,
  Img,
  staticFile,
} from "remotion";
import { noise2D } from "@remotion/noise";
import { useShortContext } from "../ShortContext";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Props {
  delay?: number; // frames before animation starts
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CRUNCHYROLL_ORANGE = "#F47521";
const PARTICLE_COUNT = 60;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Seeded PRNG (mulberry32). Returns values in [0,1). */
function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Hex color to rgba string. */
function hexRgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// ---------------------------------------------------------------------------
// Convergence particle data
// ---------------------------------------------------------------------------

interface ConvergeParticle {
  startX: number; // scattered start position (absolute)
  startY: number;
  endX: number; // end position near logo center (offset from center)
  endY: number;
  size: number;
  delay: number; // staggered convergence delay in frames
  brightness: number; // 0-1, determines glow intensity
}

function buildConvergeParticles(count: number, LOGO_CX: number, LOGO_CY: number): ConvergeParticle[] {
  const rng = mulberry32(741);
  return Array.from({ length: count }, () => {
    // Start positions scattered across the full screen
    const angle = rng() * Math.PI * 2;
    const dist = 300 + rng() * 600; // 300-900px from center
    return {
      startX: LOGO_CX + Math.cos(angle) * dist,
      startY: LOGO_CY + Math.sin(angle) * dist,
      // End positions clustered tight around logo center
      endX: LOGO_CX + (rng() - 0.5) * 120,
      endY: LOGO_CY + (rng() - 0.5) * 80,
      size: 3 + rng() * 9,
      delay: rng() * 18, // 0-18 frame stagger
      brightness: 0.5 + rng() * 0.5,
    };
  });
}

// ---------------------------------------------------------------------------
// Scanlines overlay
// ---------------------------------------------------------------------------

const Scanlines: React.FC = () => (
  <AbsoluteFill
    style={{
      backgroundImage: `repeating-linear-gradient(
        0deg,
        transparent,
        transparent 2px,
        rgba(0,0,0,0.06) 2px,
        rgba(0,0,0,0.06) 4px
      )`,
      pointerEvents: "none",
      zIndex: 50,
    }}
  />
);

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export const CrunchyrollReveal: React.FC<Props> = ({ delay = 0 }) => {
  const { assetDir } = useShortContext();
  const rawFrame = useCurrentFrame();
  const { fps, width: W, height: H } = useVideoConfig();

  const LOGO_CX = W / 2;
  const LOGO_CY = H * 0.38;

  const frame = Math.max(0, rawFrame - delay);
  if (rawFrame < delay) return null;

  const particles = useMemo(() => buildConvergeParticles(PARTICLE_COUNT, LOGO_CX, LOGO_CY), [LOGO_CX, LOGO_CY]);

  // ── Phase 1: Particles converge (frames 0-40) ──────────────────────
  // Each particle springs from its scattered position to near the logo center

  // ── Phase 2: Logo reveal (starts at frame ~8, particles converge faster)
  const logoRevealStart = 8;
  const logoProgress = spring({
    frame: frame - logoRevealStart,
    fps,
    config: { damping: 16, stiffness: 100, mass: 1.0 },
    durationInFrames: 20,
  });
  const logoScale = interpolate(logoProgress, [0, 1], [0.5, 1]);
  const logoOpacity = interpolate(logoProgress, [0, 0.3], [0, 1], {
    extrapolateRight: "clamp",
  });

  // ── "FOR" text — fades in alongside early particles ──────────────
  const forOpacity = interpolate(frame, [0, 8], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // ── Background glow builds as particles converge ─────────────────
  const overallConverge = interpolate(frame, [5, 35], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const glowOpacity = interpolate(overallConverge, [0, 1], [0, 0.35]);
  const glowPulse =
    logoProgress > 0.5 ? Math.sin((frame - logoRevealStart) * 0.1) * 0.06 : 0;

  // ── Shockwave — triggers when logo lands ─────────────────────────
  const shockwaveStart = logoRevealStart + 6;
  const swFrame = Math.max(0, frame - shockwaveStart);
  const shockwaveActive = frame >= shockwaveStart;
  const shockwaveRadius = shockwaveActive
    ? interpolate(swFrame, [0, 18], [0, 700], { extrapolateRight: "clamp" })
    : 0;
  const shockwaveOpacity = shockwaveActive
    ? interpolate(swFrame, [0, 3, 18], [0, 0.5, 0], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      })
    : 0;

  // ── Screen shake — brief after logo lands ─────────────────────────
  const shakeActive = frame >= shockwaveStart && swFrame < 14;
  const shakeIntensity = shakeActive
    ? interpolate(swFrame, [0, 14], [4, 0], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      })
    : 0;
  const shakeX =
    shakeIntensity > 0
      ? noise2D("crShX", frame * 3, 42) * shakeIntensity
      : 0;
  const shakeY =
    shakeIntensity > 0
      ? noise2D("crShY", frame * 3, 77) * shakeIntensity
      : 0;

  // ── Light beams — appear after logo lands ─────────────────────────
  const beamCount = 7;
  const beamRotation = frame * 0.12;
  const beamOpacity =
    logoProgress > 0.5
      ? interpolate(logoProgress, [0.5, 1], [0, 0.12], {
          extrapolateRight: "clamp",
        })
      : 0;

  return (
    <AbsoluteFill
      style={{
        transform: `translate(${shakeX}px, ${shakeY}px)`,
        overflow: "hidden",
      }}
    >
      {/* Background radial glow — builds during convergence */}
      <div
        style={{
          position: "absolute",
          left: LOGO_CX - 600,
          top: LOGO_CY - 400,
          width: 1200,
          height: 900,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${hexRgba(CRUNCHYROLL_ORANGE, glowOpacity + glowPulse)} 0%, ${hexRgba(CRUNCHYROLL_ORANGE, (glowOpacity + glowPulse) * 0.3)} 40%, transparent 70%)`,
          filter: "blur(60px)",
          pointerEvents: "none",
          zIndex: 1,
        }}
      />

      {/* Light beams — appear after logo lands */}
      {beamOpacity > 0 && (
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: W,
            height: H,
            overflow: "hidden",
            pointerEvents: "none",
            zIndex: 2,
            opacity: beamOpacity,
          }}
        >
          <svg
            width={W}
            height={H}
            viewBox={`0 0 ${W} ${H}`}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              transform: `rotate(${beamRotation}deg)`,
              transformOrigin: `${LOGO_CX}px ${LOGO_CY}px`,
            }}
          >
            <defs>
              <filter id="beam-blur">
                <feGaussianBlur stdDeviation="12" />
              </filter>
            </defs>
            {Array.from({ length: beamCount }, (_, i) => {
              const angle = (i / beamCount) * Math.PI * 2;
              const beamLen = 900;
              const beamWidth = 50;
              const perpAngle = angle + Math.PI / 2;
              const endX = LOGO_CX + Math.cos(angle) * beamLen;
              const endY = LOGO_CY + Math.sin(angle) * beamLen;
              const sideX1 = endX + Math.cos(perpAngle) * beamWidth;
              const sideY1 = endY + Math.sin(perpAngle) * beamWidth;
              const sideX2 = endX - Math.cos(perpAngle) * beamWidth;
              const sideY2 = endY - Math.sin(perpAngle) * beamWidth;

              return (
                <polygon
                  key={`beam-${i}`}
                  points={`${LOGO_CX},${LOGO_CY} ${sideX1},${sideY1} ${sideX2},${sideY2}`}
                  fill={hexRgba(CRUNCHYROLL_ORANGE, 0.5)}
                  filter="url(#beam-blur)"
                />
              );
            })}
          </svg>
        </div>
      )}

      {/* Converging particles */}
      {particles.map((p, i) => {
        const pProgress = spring({
          frame: frame - p.delay,
          fps,
          config: { damping: 12, stiffness: 120, mass: 0.6 },
          durationInFrames: 16,
        });

        // Converge from scattered to center
        const px = interpolate(pProgress, [0, 1], [p.startX, p.endX]);
        const py = interpolate(pProgress, [0, 1], [p.startY, p.endY]);

        // Particles fade in as they appear, fade out after convergence
        const fadeIn = interpolate(pProgress, [0, 0.15], [0, 1], {
          extrapolateRight: "clamp",
        });
        const fadeOut = interpolate(pProgress, [0.75, 1], [1, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        const pOpacity = fadeIn * fadeOut * p.brightness;

        // Shrink as they arrive
        const pScale = interpolate(pProgress, [0, 0.8, 1], [1.2, 1, 0.4], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });

        if (pOpacity <= 0.01) return null;

        // Trail effect — faint line from current to start
        const trailOpacity = interpolate(pProgress, [0, 0.5, 0.8], [0, 0.3, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });

        return (
          <React.Fragment key={`particle-${i}`}>
            {/* Trail line */}
            {trailOpacity > 0.02 && (
              <svg
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  width: W,
                  height: H,
                  pointerEvents: "none",
                  zIndex: 5,
                }}
              >
                <line
                  x1={px}
                  y1={py}
                  x2={interpolate(pProgress, [0, 1], [p.startX, px])}
                  y2={interpolate(pProgress, [0, 1], [p.startY, py])}
                  stroke={hexRgba(
                    i % 3 === 0 ? CRUNCHYROLL_ORANGE : "#FF8C42",
                    trailOpacity
                  )}
                  strokeWidth={1.5}
                />
              </svg>
            )}
            {/* Particle dot */}
            <div
              style={{
                position: "absolute",
                left: px - p.size / 2,
                top: py - p.size / 2,
                width: p.size,
                height: p.size,
                borderRadius: "50%",
                backgroundColor: hexRgba(
                  i % 2 === 0 ? CRUNCHYROLL_ORANGE : "#FF8C42",
                  pOpacity
                ),
                boxShadow: `0 0 ${p.size * 1.5}px ${hexRgba(CRUNCHYROLL_ORANGE, pOpacity * 0.7)}`,
                transform: `scale(${pScale})`,
                pointerEvents: "none",
                zIndex: 11,
              }}
            />
          </React.Fragment>
        );
      })}

      {/* Shockwave ring — after logo lands */}
      {shockwaveOpacity > 0 && (
        <div
          style={{
            position: "absolute",
            left: LOGO_CX - shockwaveRadius,
            top: LOGO_CY - shockwaveRadius,
            width: shockwaveRadius * 2,
            height: shockwaveRadius * 2,
            borderRadius: "50%",
            border: `3px solid ${hexRgba(CRUNCHYROLL_ORANGE, shockwaveOpacity)}`,
            boxShadow: `0 0 20px ${hexRgba(CRUNCHYROLL_ORANGE, shockwaveOpacity * 0.5)}, inset 0 0 20px ${hexRgba(CRUNCHYROLL_ORANGE, shockwaveOpacity * 0.3)}`,
            pointerEvents: "none",
            zIndex: 10,
          }}
        />
      )}

      {/* "FOR" text */}
      <div
        style={{
          position: "absolute",
          top: LOGO_CY - 80,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
          fontFamily: "'Switzer', 'Inter', sans-serif",
          zIndex: 20,
          opacity: forOpacity,
        }}
      >
        <span
          style={{
            color: hexRgba("#FFFFFF", 0.85),
            fontSize: 24,
            fontWeight: 700,
            letterSpacing: 12,
            textTransform: "uppercase",
            fontVariant: "small-caps",
          }}
        >
          FOR
        </span>
      </div>

      {/* Logo — reveals after particles converge */}
      <div
        style={{
          position: "absolute",
          top: LOGO_CY - 200,
          left: 0,
          right: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transform: `scale(${logoScale})`,
          opacity: logoOpacity,
          zIndex: 20,
          pointerEvents: "none",
          filter: [
            `drop-shadow(0 0 20px ${hexRgba(CRUNCHYROLL_ORANGE, 0.6 * logoOpacity)})`,
            `drop-shadow(0 0 60px ${hexRgba(CRUNCHYROLL_ORANGE, 0.3 * logoOpacity)})`,
            `drop-shadow(0 4px 8px rgba(0,0,0,0.5))`,
          ].join(" "),
        }}
      >
        <Img
          src={staticFile(`${assetDir}/backgrounds/crunchyroll-logo.png`)}
          style={{
            width: 1400,
            height: "auto",
            objectFit: "contain",
          }}
        />
      </div>

      {/* Scanlines overlay */}
      <Scanlines />
    </AbsoluteFill>
  );
};
