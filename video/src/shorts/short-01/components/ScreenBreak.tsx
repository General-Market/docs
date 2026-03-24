import React, { useMemo } from "react";
import {
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
  AbsoluteFill,
} from "remotion";
import { noise2D } from "@remotion/noise";

interface ScreenBreakProps {
  impactFrame?: number;
  color?: string;
  durationFrames?: number;
}

// Impact point is computed from W/H inside the component

// --- Deterministic crack generation ---

interface CrackPoint {
  x: number;
  y: number;
}

interface CrackLine {
  points: CrackPoint[];
  branches: CrackPoint[][];
}

function generateCrackLines(count: number, seed: number, impactX: number, impactY: number): CrackLine[] {
  const cracks: CrackLine[] = [];
  const angleSpread = Math.PI * 2;
  const startAngleOffset = -Math.PI * 0.1; // slight bias toward right side

  for (let i = 0; i < count; i++) {
    // Distribute cracks radially, with slight clustering toward right side
    const baseAngle =
      startAngleOffset + (i / count) * angleSpread + (i % 2 === 0 ? 0.15 : -0.15);
    const maxLen = 600 + noise2D("len", i * 7.3, seed) * 400; // 200-1000px range
    const steps = 18 + Math.floor(Math.abs(noise2D("steps", i * 3.1, seed)) * 10);

    const points: CrackPoint[] = [{ x: impactX, y: impactY }];
    let angle = baseAngle;

    for (let s = 1; s <= steps; s++) {
      // Noise-based angle deviation for organic feel
      const deviation = noise2D("crack" + i, s * 0.35, seed * 2.7) * 0.45;
      angle = baseAngle + deviation;

      const stepLen = (maxLen / steps) * (1 + noise2D("slen", i + s * 0.5, seed) * 0.3);
      const prev = points[points.length - 1];
      points.push({
        x: prev.x + Math.cos(angle) * stepLen,
        y: prev.y + Math.sin(angle) * stepLen,
      });
    }

    // Generate 0-2 sub-branches per crack
    const branches: CrackPoint[][] = [];
    const branchCount = Math.floor(Math.abs(noise2D("bc", i * 5, seed)) * 2.5);
    for (let b = 0; b < branchCount; b++) {
      const startIdx = 3 + Math.floor(Math.abs(noise2D("bi", i + b * 9, seed)) * (points.length - 4));
      const clampedIdx = Math.min(startIdx, points.length - 1);
      const origin = points[clampedIdx];
      const branchAngle =
        baseAngle + (noise2D("ba", i + b * 4, seed) > 0 ? 1 : -1) * (0.4 + Math.abs(noise2D("ba2", b, seed)) * 0.6);
      const branchLen = 80 + Math.abs(noise2D("bl", i + b, seed)) * 200;
      const branchSteps = 6;
      const branchPts: CrackPoint[] = [{ x: origin.x, y: origin.y }];

      for (let s = 1; s <= branchSteps; s++) {
        const dev = noise2D("br" + i + b, s * 0.4, seed) * 0.35;
        const a = branchAngle + dev;
        const sl = branchLen / branchSteps;
        const p = branchPts[branchPts.length - 1];
        branchPts.push({
          x: p.x + Math.cos(a) * sl,
          y: p.y + Math.sin(a) * sl,
        });
      }
      branches.push(branchPts);
    }

    cracks.push({ points, branches });
  }

  return cracks;
}

// --- Fragment generation ---

interface Fragment {
  cx: number;
  cy: number;
  angle: number; // direction of flight
  width: number;
  height: number;
  rotation: number; // initial rotation offset
  clipPath: string; // polygon clip
  seed: number;
}

function generateFragments(count: number, seed: number, impactX: number, impactY: number): Fragment[] {
  const fragments: Fragment[] = [];

  for (let i = 0; i < count; i++) {
    // Distribute fragments in a ring around the impact
    const ringAngle = (i / count) * Math.PI * 2 + noise2D("fa", i, seed) * 0.5;
    const ringDist = 40 + Math.abs(noise2D("fd", i * 3.1, seed)) * 250;

    const cx = impactX + Math.cos(ringAngle) * ringDist;
    const cy = impactY + Math.sin(ringAngle) * ringDist;
    const w = 30 + Math.abs(noise2D("fw", i, seed)) * 100;
    const h = 30 + Math.abs(noise2D("fh", i * 2, seed)) * 100;

    // Random triangle or quad clip
    const isTriangle = noise2D("ft", i, seed) > -0.2;
    let clipPath: string;
    if (isTriangle) {
      const p1x = Math.abs(noise2D("t1x", i, seed)) * 100;
      const p1y = 0;
      const p2x = Math.abs(noise2D("t2x", i, seed)) * 100;
      const p2y = 100;
      const p3x = 100 - Math.abs(noise2D("t3x", i, seed)) * 60;
      const p3y = 40 + Math.abs(noise2D("t3y", i, seed)) * 40;
      clipPath = `polygon(${p1x}% ${p1y}%, ${p2x}% ${p2y}%, ${p3x}% ${p3y}%)`;
    } else {
      const p1x = Math.abs(noise2D("q1x", i, seed)) * 30;
      const p1y = Math.abs(noise2D("q1y", i, seed)) * 20;
      const p2x = 70 + Math.abs(noise2D("q2x", i, seed)) * 30;
      const p2y = Math.abs(noise2D("q2y", i, seed)) * 30;
      const p3x = 80 + Math.abs(noise2D("q3x", i, seed)) * 20;
      const p3y = 70 + Math.abs(noise2D("q3y", i, seed)) * 30;
      const p4x = Math.abs(noise2D("q4x", i, seed)) * 30;
      const p4y = 60 + Math.abs(noise2D("q4y", i, seed)) * 40;
      clipPath = `polygon(${p1x}% ${p1y}%, ${p2x}% ${p2y}%, ${p3x}% ${p3y}%, ${p4x}% ${p4y}%)`;
    }

    fragments.push({
      cx,
      cy,
      angle: ringAngle,
      width: w,
      height: h,
      rotation: noise2D("fr", i, seed) * 180,
      clipPath,
      seed: i,
    });
  }

  return fragments;
}

// --- SVG path from crack points ---

function crackToPath(points: CrackPoint[]): string {
  if (points.length < 2) return "";
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    d += ` L ${points[i].x} ${points[i].y}`;
  }
  return d;
}

// --- Component ---

export const ScreenBreak: React.FC<ScreenBreakProps> = ({
  impactFrame = 5,
  color = "#ffffff",
  durationFrames = 30,
}) => {
  const frame = useCurrentFrame();
  const { fps, width: W, height: H } = useVideoConfig();
  const f = frame - impactFrame; // local frame relative to impact

  // Impact point: center-left
  const IMPACT_X = W * 0.35;
  const IMPACT_Y = H * 0.48;

  // Pre-compute geometry once
  const cracks = useMemo(() => generateCrackLines(10, 42, IMPACT_X, IMPACT_Y), [IMPACT_X, IMPACT_Y]);
  const fragments = useMemo(() => generateFragments(24, 77, IMPACT_X, IMPACT_Y), [IMPACT_X, IMPACT_Y]);

  // Before impact, nothing visible
  if (f < 0 || f > durationFrames) return null;

  // --- Crack spread progress (frames 0-8) ---
  const crackProgress = interpolate(f, [0, 8], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // --- Impact flash (frames 0-3) ---
  const flashOpacity = interpolate(f, [0, 1, 3], [0.8, 0.7, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // --- Dark overlay fade-out (frames 15-25) ---
  const overlayOpacity = interpolate(f, [0, 14, 25], [1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // --- Crack visibility (stay until overlay fades) ---
  const crackOpacity = interpolate(f, [0, 20, 26], [1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // --- Fragment animation (frames 8-25) ---
  const fragmentLocalFrame = Math.max(0, f - 8);

  // Shockwave ring (subtle, frames 0-6)
  const shockwaveRadius = interpolate(f, [0, 6], [0, 500], {
    extrapolateRight: "clamp",
  });
  const shockwaveOpacity = interpolate(f, [0, 2, 6], [0, 0.4, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      {/* Dark surface overlay */}
      <AbsoluteFill
        style={{
          backgroundColor: "#0a0a0f",
          opacity: overlayOpacity,
        }}
      />

      {/* Subtle surface texture via radial gradient */}
      {overlayOpacity > 0 && (
        <AbsoluteFill
          style={{
            background: `radial-gradient(ellipse at ${IMPACT_X}px ${IMPACT_Y}px, rgba(30,30,50,0.6) 0%, transparent 70%)`,
            opacity: overlayOpacity,
          }}
        />
      )}

      {/* Shockwave ring */}
      {shockwaveOpacity > 0 && (
        <div
          style={{
            position: "absolute",
            left: IMPACT_X - shockwaveRadius,
            top: IMPACT_Y - shockwaveRadius,
            width: shockwaveRadius * 2,
            height: shockwaveRadius * 2,
            borderRadius: "50%",
            border: `3px solid ${color}`,
            opacity: shockwaveOpacity,
            pointerEvents: "none",
          }}
        />
      )}

      {/* Crack lines (SVG layer) */}
      {crackProgress > 0 && crackOpacity > 0 && (
        <svg
          width={W}
          height={H}
          viewBox={`0 0 ${W} ${H}`}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            opacity: crackOpacity,
            pointerEvents: "none",
          }}
        >
          {/* Glow layer behind cracks */}
          <defs>
            <filter id="crack-glow">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id="crack-glow-soft">
              <feGaussianBlur stdDeviation="8" />
            </filter>
          </defs>

          {cracks.map((crack, i) => {
            // Stagger each crack slightly
            const crackDelay = i * 0.06;
            const localProgress = interpolate(
              crackProgress,
              [crackDelay, crackDelay + 0.5],
              [0, 1],
              { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
            );
            if (localProgress <= 0) return null;

            const visibleCount = Math.ceil(crack.points.length * localProgress);
            const visiblePoints = crack.points.slice(0, visibleCount);
            const path = crackToPath(visiblePoints);

            // Branch visibility (slightly delayed)
            const branchProgress = interpolate(
              crackProgress,
              [crackDelay + 0.25, crackDelay + 0.7],
              [0, 1],
              { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
            );

            return (
              <g key={`crack-${i}`}>
                {/* Soft glow behind */}
                <path
                  d={path}
                  fill="none"
                  stroke={color}
                  strokeWidth={6}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  filter="url(#crack-glow-soft)"
                  opacity={0.4}
                />
                {/* Main crack line */}
                <path
                  d={path}
                  fill="none"
                  stroke={color}
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  filter="url(#crack-glow)"
                />
                {/* Thin bright core */}
                <path
                  d={path}
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth={1}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity={0.8}
                />

                {/* Branches */}
                {branchProgress > 0 &&
                  crack.branches.map((branch, bi) => {
                    const bCount = Math.ceil(branch.length * branchProgress);
                    const bPoints = branch.slice(0, bCount);
                    const bPath = crackToPath(bPoints);
                    return (
                      <g key={`branch-${i}-${bi}`}>
                        <path
                          d={bPath}
                          fill="none"
                          stroke={color}
                          strokeWidth={4}
                          strokeLinecap="round"
                          filter="url(#crack-glow-soft)"
                          opacity={0.3}
                        />
                        <path
                          d={bPath}
                          fill="none"
                          stroke={color}
                          strokeWidth={1.5}
                          strokeLinecap="round"
                          filter="url(#crack-glow)"
                          opacity={0.9}
                        />
                      </g>
                    );
                  })}
              </g>
            );
          })}

          {/* Small impact crater */}
          <circle
            cx={IMPACT_X}
            cy={IMPACT_Y}
            r={interpolate(crackProgress, [0, 0.3], [0, 18], {
              extrapolateRight: "clamp",
            })}
            fill="none"
            stroke={color}
            strokeWidth={3}
            filter="url(#crack-glow)"
            opacity={crackOpacity * 0.7}
          />
          <circle
            cx={IMPACT_X}
            cy={IMPACT_Y}
            r={interpolate(crackProgress, [0, 0.3], [0, 8], {
              extrapolateRight: "clamp",
            })}
            fill={color}
            opacity={crackOpacity * 0.5}
          />
        </svg>
      )}

      {/* Flying fragments */}
      {f >= 8 &&
        fragments.map((frag, i) => {
          // Stagger fragment launches
          const fragDelay = i * 0.4; // frames of delay
          const fragFrame = fragmentLocalFrame - fragDelay;
          if (fragFrame < 0) return null;

          // Spring-based flight distance
          const flightSpring = spring({
            frame: fragFrame,
            fps,
            config: {
              damping: 30,
              stiffness: 80,
              mass: 0.6 + Math.abs(noise2D("fm", i, 42)) * 0.8,
            },
          });

          const flightDist = 300 + Math.abs(noise2D("fld", i, 77)) * 700;
          const tx = Math.cos(frag.angle) * flightDist * flightSpring;
          const ty = Math.sin(frag.angle) * flightDist * flightSpring;

          // Gravity effect (slight downward pull)
          const gravity = fragFrame * fragFrame * 0.8;

          // Rotation
          const rotSpeed = 8 + Math.abs(noise2D("frs", i, 42)) * 20;
          const rot = frag.rotation + fragFrame * rotSpeed;

          // Opacity fade
          const fragOpacity = interpolate(fragFrame, [0, 4, 14, 20], [1, 0.9, 0.5, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });

          if (fragOpacity <= 0) return null;

          // Scale: start normal, shrink slightly
          const fragScale = interpolate(fragFrame, [0, 16], [1, 0.6], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });

          return (
            <div
              key={`frag-${i}`}
              style={{
                position: "absolute",
                left: frag.cx - frag.width / 2,
                top: frag.cy - frag.height / 2,
                width: frag.width,
                height: frag.height,
                backgroundColor: "#0a0a0f",
                border: `1px solid ${color}`,
                clipPath: frag.clipPath,
                opacity: fragOpacity,
                transform: `translate(${tx}px, ${ty + gravity}px) rotate(${rot}deg) scale(${fragScale})`,
                boxShadow: `0 0 8px ${color}40`,
                pointerEvents: "none",
              }}
            />
          );
        })}

      {/* Impact flash */}
      {flashOpacity > 0 && (
        <AbsoluteFill
          style={{
            background: `radial-gradient(circle at ${IMPACT_X}px ${IMPACT_Y}px, rgba(255,255,255,${flashOpacity}) 0%, rgba(255,255,255,${flashOpacity * 0.3}) 40%, transparent 70%)`,
            pointerEvents: "none",
          }}
        />
      )}
    </AbsoluteFill>
  );
};
