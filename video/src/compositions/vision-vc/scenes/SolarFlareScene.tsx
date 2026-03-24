import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";

const SUN_COLOR = "#fff4e0";
const CORONA = "#ffcc44";
const FLARE = "#ff6b35";

const CX = 700;
const CY = 500;
const SUN_R = 120;

const KP_COLORS: Record<number, string> = {
  4: "#f59e0b",
  5: "#f97316",
  6: "#dc2626",
  7: "#991b1b",
};

// Deterministic pseudo-random from seed
const seeded = (seed: number): number => {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

// Pre-generate star field positions (150 stars)
const STAR_COUNT = 150;
const stars = Array.from({ length: STAR_COUNT }, (_, i) => ({
  x: seeded(i * 3 + 1) * 1920,
  y: seeded(i * 3 + 2) * 1080,
  size: 0.5 + seeded(i * 3 + 3) * 1.8,
  twinkleSpeed: 0.03 + seeded(i * 7) * 0.08,
  twinklePhase: seeded(i * 11) * Math.PI * 2,
}));

// Pre-generate solar wind particles (60 particles in a cone)
const WIND_COUNT = 60;
const windParticles = Array.from({ length: WIND_COUNT }, (_, i) => ({
  // Cone direction: roughly toward Earth (right side, slight upward)
  angle: -0.3 + seeded(i * 5 + 100) * 0.6, // narrow cone ~±17°
  speed: 0.4 + seeded(i * 5 + 101) * 0.6,
  offset: seeded(i * 5 + 102), // staggered start
  size: 1 + seeded(i * 5 + 103) * 2.5,
  brightness: 0.3 + seeded(i * 5 + 104) * 0.7,
}));

// Earth position
const EARTH_X = 1500;
const EARTH_Y = 420;
const EARTH_R = 12;

// Kp bar gauge segments
const KP_BAR_SEGMENTS = [
  { level: 1, color: "#22c55e" },
  { level: 2, color: "#22c55e" },
  { level: 3, color: "#84cc16" },
  { level: 4, color: "#f59e0b" },
  { level: 5, color: "#f97316" },
  { level: 6, color: "#dc2626" },
  { level: 7, color: "#991b1b" },
];

export const SolarFlareScene: React.FC = () => {
  const frame = useCurrentFrame();

  const kpRaw = interpolate(frame, [0, 150], [4, 7.4], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const kpValue = Math.min(Math.floor(kpRaw), 7);
  const kpColor = KP_COLORS[kpValue] || "#991b1b";

  // Flare eruption timing
  const flareProgress = interpolate(frame, [50, 130], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const flareScale = interpolate(flareProgress, [0, 0.3, 1], [0, 1.2, 1.6], {
    extrapolateRight: "clamp",
  });
  const flareOpacity = interpolate(
    flareProgress,
    [0, 0.2, 0.8, 1],
    [0, 0.9, 0.7, 0.4],
    { extrapolateRight: "clamp" }
  );

  // Corona pulse
  const coronaPulse = 1 + Math.sin(frame * 0.08) * 0.08;

  // CME ring expansion
  const cmeProgress = interpolate(frame, [70, 180], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const cmeRadius = interpolate(cmeProgress, [0, 1], [SUN_R * 1.1, 600], {
    extrapolateRight: "clamp",
  });
  const cmeOpacity = interpolate(cmeProgress, [0, 0.1, 0.5, 1], [0, 0.5, 0.3, 0], {
    extrapolateRight: "clamp",
  });

  // Lens flare intensity
  const lensFlareIntensity = interpolate(
    flareProgress,
    [0, 0.3, 0.6, 1],
    [0.05, 0.35, 0.25, 0.1],
    { extrapolateRight: "clamp" }
  );

  // Magnetic field wobble
  const fieldWobble = Math.sin(frame * 0.06) * 8 + flareProgress * 25;

  // Number of rays
  const rayCount = 24;

  // Data timestamp flicker
  const timestampSec = Math.floor(frame / 3) * 2;
  const tsMinute = 14 + Math.floor(timestampSec / 60);
  const tsSec = timestampSec % 60;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "transparent",
        fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
        overflow: "hidden",
      }}
    >

      <svg width={1920} height={1080} viewBox="0 0 1920 1080">
        <defs>
          <radialGradient id="sunGrad">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="40%" stopColor={SUN_COLOR} />
            <stop offset="80%" stopColor="#ffaa33" />
            <stop offset="100%" stopColor="#ff660044" />
          </radialGradient>
          <filter id="sunGlow">
            <feGaussianBlur stdDeviation="18" />
          </filter>
          <filter id="flareGlow">
            <feGaussianBlur stdDeviation="12" />
          </filter>
          <filter id="earthGlow">
            <feGaussianBlur stdDeviation="6" />
          </filter>
          <filter id="cmeBlur">
            <feGaussianBlur stdDeviation="8" />
          </filter>
          <filter id="lensBlur">
            <feGaussianBlur stdDeviation="3" />
          </filter>
        </defs>

        {/* ── Star field background ── */}
        {stars.map((s, i) => {
          const twinkle =
            0.3 +
            0.7 *
              (0.5 + 0.5 * Math.sin(frame * s.twinkleSpeed + s.twinklePhase));
          return (
            <circle
              key={`star-${i}`}
              cx={s.x}
              cy={s.y}
              r={s.size}
              fill="#ffffff"
              opacity={twinkle * 0.8}
            />
          );
        })}

        {/* ── Magnetic field lines — elliptical arcs that distort during flare ── */}
        {[1.8, 2.4, 3.2, 4.0].map((mult, i) => {
          const wobbleX =
            fieldWobble * (i + 1) * 0.3 +
            Math.sin(frame * 0.04 + i * 1.2) * 6;
          const wobbleRx = SUN_R * mult + fieldWobble * (i + 1) * 0.5;
          const wobbleRy =
            SUN_R * mult * 0.7 +
            Math.sin(frame * 0.05 + i * 0.9) * 4 * (1 + flareProgress);
          const tilt = Math.sin(frame * 0.03 + i) * 3 * (1 + flareProgress * 2);
          return (
            <ellipse
              key={`field-${i}`}
              cx={CX + wobbleX}
              cy={CY}
              rx={wobbleRx}
              ry={wobbleRy}
              fill="none"
              stroke="#4466aa"
              strokeWidth={0.8}
              opacity={interpolate(i, [0, 3], [0.25, 0.08])}
              strokeDasharray="6 8"
              transform={`rotate(${tilt} ${CX + wobbleX} ${CY})`}
            />
          );
        })}

        {/* ── CME direction line — sun to Earth ── */}
        {flareProgress > 0.05 && (
          <line
            x1={CX + SUN_R}
            y1={CY}
            x2={EARTH_X - EARTH_R - 10}
            y2={EARTH_Y}
            stroke="#ff884422"
            strokeWidth={1.5}
            strokeDasharray="8 6"
            opacity={interpolate(flareProgress, [0.05, 0.3, 1], [0, 0.4, 0.6], {
              extrapolateRight: "clamp",
            })}
          />
        )}

        {/* ── Corona rays ── */}
        {Array.from({ length: rayCount }).map((_, i) => {
          const angle = (i / rayCount) * Math.PI * 2;
          const rayPulse = Math.sin(frame * 0.1 + i * 0.8) * 0.3 + 0.7;
          const length = SUN_R * (1.3 + rayPulse * 0.6) * coronaPulse;
          const x1 = CX + Math.cos(angle) * SUN_R * 0.95;
          const y1 = CY + Math.sin(angle) * SUN_R * 0.95;
          const x2 = CX + Math.cos(angle) * length;
          const y2 = CY + Math.sin(angle) * length;
          return (
            <line
              key={`ray-${i}`}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke={CORONA}
              strokeWidth={interpolate(rayPulse, [0.4, 1], [1, 3])}
              opacity={rayPulse * 0.5}
              strokeLinecap="round"
            />
          );
        })}

        {/* ── Sun body — outer glow ── */}
        <circle
          cx={CX}
          cy={CY}
          r={SUN_R * 1.5}
          fill="#ffcc4422"
          filter="url(#sunGlow)"
        />
        {/* ── Sun disc ── */}
        <circle cx={CX} cy={CY} r={SUN_R} fill="url(#sunGrad)" />

        {/* ── Lens flare streaks — 4 diagonal lines pulsing from sun center ── */}
        {[45, 135, -45, -135].map((deg, i) => {
          const rad = (deg * Math.PI) / 180;
          const pulse =
            lensFlareIntensity *
            (0.7 + 0.3 * Math.sin(frame * 0.12 + i * 1.5));
          const len = 200 + flareProgress * 120;
          return (
            <line
              key={`lens-${i}`}
              x1={CX + Math.cos(rad) * SUN_R * 0.3}
              y1={CY + Math.sin(rad) * SUN_R * 0.3}
              x2={CX + Math.cos(rad) * len}
              y2={CY + Math.sin(rad) * len}
              stroke="#fffbe8"
              strokeWidth={1.5}
              opacity={pulse}
              filter="url(#lensBlur)"
              strokeLinecap="round"
            />
          );
        })}

        {/* ── Solar flare arc ── */}
        {flareProgress > 0 && (
          <g opacity={flareOpacity}>
            {/* Flare outer glow */}
            <ellipse
              cx={CX + SUN_R * 0.6 + flareScale * 80}
              cy={CY - SUN_R * 0.3}
              rx={40 + flareScale * 60}
              ry={20 + flareScale * 100}
              fill={FLARE}
              opacity={0.3}
              filter="url(#flareGlow)"
              transform={`rotate(-30 ${CX + SUN_R * 0.6} ${CY - SUN_R * 0.3})`}
            />
            {/* Flare body */}
            <path
              d={`M ${CX + SUN_R * 0.7} ${CY - SUN_R * 0.2}
                  Q ${CX + SUN_R + flareScale * 90} ${CY - SUN_R * 0.8 - flareScale * 40}
                    ${CX + SUN_R * 0.5} ${CY - SUN_R * 0.6 - flareScale * 20}
                  Q ${CX + SUN_R * 0.3} ${CY - SUN_R * 0.3}
                    ${CX + SUN_R * 0.7} ${CY - SUN_R * 0.2}`}
              fill={FLARE}
              opacity={0.7}
            />
          </g>
        )}

        {/* ── CME expanding ring ── */}
        {cmeProgress > 0 && cmeOpacity > 0 && (
          <circle
            cx={CX}
            cy={CY}
            r={cmeRadius}
            fill="none"
            stroke="#ff8c3a"
            strokeWidth={3 + cmeProgress * 8}
            opacity={cmeOpacity}
            filter="url(#cmeBlur)"
          />
        )}

        {/* ── Solar wind particles streaming in cone toward Earth ── */}
        {flareProgress > 0.1 &&
          windParticles.map((p, i) => {
            // Each particle cycles through the cone continuously
            const lifetime = 80; // frames per cycle
            const startFrame = 50 + p.offset * lifetime;
            const elapsed = frame - startFrame;
            if (elapsed < 0) return null;
            const t = (elapsed % lifetime) / lifetime;
            // Fade in early, fade out late
            const alpha = interpolate(t, [0, 0.1, 0.7, 1], [0, 1, 0.6, 0], {
              extrapolateRight: "clamp",
            });
            // Distance from sun: start at sun surface, travel toward Earth
            const maxDist = 800;
            const dist = SUN_R * 1.1 + t * maxDist * p.speed;
            // Vertical spread widens with distance
            const spread = p.angle * dist * 0.25;
            const px = CX + dist;
            const py = CY + spread;
            if (px > 1920 || py < 0 || py > 1080) return null;
            return (
              <circle
                key={`wind-${i}`}
                cx={px}
                cy={py}
                r={p.size * (0.5 + t * 0.5)}
                fill="#ffaa44"
                opacity={alpha * p.brightness * flareProgress}
              />
            );
          })}

        {/* ── Earth position marker ── */}
        {/* Outer glow */}
        <circle
          cx={EARTH_X}
          cy={EARTH_Y}
          r={EARTH_R * 2.5}
          fill="#4488ff11"
          filter="url(#earthGlow)"
        />
        {/* Earth body */}
        <circle cx={EARTH_X} cy={EARTH_Y} r={EARTH_R} fill="#4488ff" opacity={0.85} />
        <circle
          cx={EARTH_X}
          cy={EARTH_Y}
          r={EARTH_R}
          fill="none"
          stroke="#6699ff"
          strokeWidth={1.5}
          opacity={0.5}
        />
        {/* EARTH label */}
        <text
          x={EARTH_X}
          y={EARTH_Y + EARTH_R + 18}
          textAnchor="middle"
          fill="#6699cc"
          fontSize={11}
          letterSpacing={3}
          fontFamily="'Inter', 'Helvetica Neue', Arial, sans-serif"
        >
          EARTH
        </text>
      </svg>

      {/* ── NOAA GOES-18 satellite label — top left with data timestamp ── */}
      <div
        style={{
          position: "absolute",
          top: 40,
          left: 60,
          zIndex: 5,
        }}
      >
        <div
          style={{
            color: "#6688aa",
            fontSize: 13,
            letterSpacing: 3,
            fontWeight: 600,
          }}
        >
          NOAA GOES-18
        </div>
        <div
          style={{
            color: "#556677",
            fontSize: 11,
            letterSpacing: 2,
            marginTop: 4,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          2025-03-21 {String(tsMinute).padStart(2, "0")}:
          {String(tsSec).padStart(2, "0")} UTC
        </div>
        <div
          style={{
            color: "#445566",
            fontSize: 10,
            letterSpacing: 2,
            marginTop: 2,
            opacity: 0.6,
          }}
        >
          SOLAR X-RAY IMAGER
        </div>
      </div>

      {/* ── Kp Index with vertical bar gauge ── */}
      <div
        style={{
          position: "absolute",
          top: 80,
          right: 100,
          display: "flex",
          alignItems: "flex-start",
          gap: 24,
          zIndex: 5,
        }}
      >
        {/* Text side */}
        <div style={{ textAlign: "right" }}>
          <div
            style={{
              color: "#6688aa",
              fontSize: 14,
              letterSpacing: 3,
              marginBottom: 10,
            }}
          >
            Kp INDEX
          </div>
          <div
            style={{
              fontSize: 96,
              fontWeight: 800,
              color: kpColor,
              lineHeight: 1,
              fontVariantNumeric: "tabular-nums",
              textShadow: `0 0 40px ${kpColor}66`,
            }}
          >
            {kpValue}
          </div>
          <div
            style={{
              color: kpColor,
              fontSize: 16,
              marginTop: 8,
              letterSpacing: 2,
              fontWeight: 600,
            }}
          >
            {kpValue <= 4
              ? "ACTIVE"
              : kpValue <= 5
                ? "MINOR STORM"
                : kpValue <= 6
                  ? "MODERATE STORM"
                  : "STRONG STORM"}
          </div>
        </div>

        {/* Vertical bar gauge */}
        <div
          style={{
            display: "flex",
            flexDirection: "column-reverse",
            gap: 3,
            marginTop: 30,
          }}
        >
          {KP_BAR_SEGMENTS.map((seg) => {
            const active = kpRaw >= seg.level;
            const partialFill =
              kpRaw >= seg.level - 1 && kpRaw < seg.level
                ? (kpRaw - (seg.level - 1))
                : active
                  ? 1
                  : 0;
            return (
              <div
                key={seg.level}
                style={{
                  width: 18,
                  height: 14,
                  borderRadius: 2,
                  backgroundColor: active
                    ? seg.color
                    : partialFill > 0
                      ? seg.color
                      : "#1a1a2e",
                  opacity: active ? 1 : partialFill > 0 ? partialFill : 0.2,
                  boxShadow: active ? `0 0 8px ${seg.color}88` : "none",
                  transition: "opacity 0.1s",
                }}
              />
            );
          })}
        </div>
      </div>

      {/* ── NOAA bottom label ── */}
      <div style={{ position: "absolute", bottom: 60, left: 80, zIndex: 5 }}>
        <div
          style={{
            color: "#6688aa",
            fontSize: 14,
            letterSpacing: 3,
            marginBottom: 6,
          }}
        >
          NOAA SPACE WEATHER PREDICTION CENTER
        </div>
        <div
          style={{
            color: "#8899aa",
            fontSize: 12,
            letterSpacing: 2,
            opacity: 0.5,
          }}
        >
          GOES-18 SOLAR X-RAY IMAGER
        </div>
      </div>

      {/* ── Particle noise overlay / vignette ── */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          background:
            "radial-gradient(ellipse at 37% 46%, transparent 40%, rgba(5,5,16,0.3) 75%)",
        }}
      />
    </AbsoluteFill>
  );
};
