import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";

const PHOSPHOR = "#00ff41";
const PHOSPHOR_DIM = "#00ff4122";
const PHOSPHOR_GHOST = "#00ff4118";
const BG = "rgba(0,10,0,0.4)";

const BLIPS = [
  { startAngle: 20, dist: 0.6, heading: 45, alt: "FL350", speed: 0.12, label: "UAL417", type: "CIV" as const },
  { startAngle: 85, dist: 0.35, heading: 190, alt: "FL280", speed: 0.08, label: "DLH92", type: "CIV" as const },
  { startAngle: 155, dist: 0.78, heading: 310, alt: "FL410", speed: 0.15, label: "BAW18", type: "CIV" as const },
  { startAngle: 210, dist: 0.45, heading: 90, alt: "FL320", speed: 0.1, label: "AFR61", type: "CIV" as const },
  { startAngle: 270, dist: 0.55, heading: 160, alt: "FL370", speed: 0.06, label: "SWR8", type: "MIL" as const },
  { startAngle: 320, dist: 0.7, heading: 250, alt: "FL290", speed: 0.11, label: "THY4", type: "CIV" as const },
  { startAngle: 50, dist: 0.88, heading: 120, alt: "FL380", speed: 0.09, label: "QFA1", type: "CIV" as const },
];

const CX = 960;
const CY = 540;
const MAX_R = 420;

const RING_FRACTIONS = [0.25, 0.5, 0.75, 1] as const;
const RING_LABELS = ["50NM", "100NM", "150NM", "200NM"] as const;
const CARDINALS: Array<{ label: string; angle: number }> = [
  { label: "N", angle: -90 },
  { label: "E", angle: 0 },
  { label: "S", angle: 90 },
  { label: "W", angle: 180 },
];
const GHOST_COUNT = 4;
const GHOST_FRAME_SPACING = 8;
const HEADING_VECTOR_LEN = 28;

/** Compute blip position at a given frame */
function blipPosition(blip: typeof BLIPS[number], f: number) {
  const angle = ((blip.startAngle + f * blip.speed) * Math.PI) / 180;
  const drift = f * blip.speed * 0.3;
  const dist = blip.dist + drift * 0.001;
  const clampedDist = Math.min(dist, 0.95);
  const bx = CX + Math.cos(angle) * MAX_R * clampedDist;
  const by = CY + Math.sin(angle) * MAX_R * clampedDist;
  return { bx, by, angle };
}

export const MilitaryRadarScene: React.FC = () => {
  const frame = useCurrentFrame();

  // Sweep: one full rotation over 150 frames
  const sweepAngle = (frame / 150) * 360;
  const sweepRad = (sweepAngle * Math.PI) / 180;

  const civCount = BLIPS.filter((b) => b.type === "CIV").length;
  const milCount = BLIPS.filter((b) => b.type === "MIL").length;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "transparent",
        fontFamily: "'Courier New', Consolas, monospace",
        overflow: "hidden",
      }}
    >

      {/* CRT curvature wrapper — barrel distortion + vignette */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          // Subtle barrel distortion via perspective
          perspective: "1800px",
          perspectiveOrigin: "50% 50%",
        }}
      >
        <div
          style={{
            width: "100%",
            height: "100%",
            transform: "rotateX(0.4deg) rotateY(0deg) scaleX(1.008) scaleY(1.005)",
            transformStyle: "preserve-3d",
            borderRadius: "18px",
            overflow: "hidden",
            background: BG,
          }}
        >
          <svg width={1920} height={1080} viewBox="0 0 1920 1080">
            <defs>
              {/* Phosphor glow filter */}
              <filter id="phosphorGlow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="blur1" />
                <feGaussianBlur in="SourceGraphic" stdDeviation="0.8" result="blur2" />
                <feMerge>
                  <feMergeNode in="blur1" />
                  <feMergeNode in="blur2" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>

              {/* Stronger bloom for sweep-hit flash */}
              <filter id="contactFlash" x="-100%" y="-100%" width="300%" height="300%">
                <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="bigBlur" />
                <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="medBlur" />
                <feMerge>
                  <feMergeNode in="bigBlur" />
                  <feMergeNode in="medBlur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>

              {/* Sweep gradient */}
              <linearGradient id="sweepGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor={PHOSPHOR} stopOpacity={0} />
                <stop offset="100%" stopColor={PHOSPHOR} stopOpacity={0.7} />
              </linearGradient>
            </defs>

            {/* Grid — faint lat/lon lines */}
            {[-2, -1, 0, 1, 2].map((i) => (
              <React.Fragment key={`grid-${i}`}>
                <line
                  x1={CX + i * 150}
                  y1={CY - MAX_R}
                  x2={CX + i * 150}
                  y2={CY + MAX_R}
                  stroke={PHOSPHOR}
                  strokeWidth={0.3}
                  opacity={0.06}
                />
                <line
                  x1={CX - MAX_R}
                  y1={CY + i * 150}
                  x2={CX + MAX_R}
                  y2={CY + i * 150}
                  stroke={PHOSPHOR}
                  strokeWidth={0.3}
                  opacity={0.06}
                />
              </React.Fragment>
            ))}

            {/* Range rings with distance labels */}
            {RING_FRACTIONS.map((r, idx) => {
              const ringR = MAX_R * r;
              return (
                <React.Fragment key={`ring-${r}`}>
                  <circle
                    cx={CX}
                    cy={CY}
                    r={ringR}
                    fill="none"
                    stroke={PHOSPHOR_DIM}
                    strokeWidth={0.8}
                  />
                  {/* Label at 45-degree position on each ring */}
                  <text
                    x={CX + Math.cos(-Math.PI / 4) * ringR + 4}
                    y={CY + Math.sin(-Math.PI / 4) * ringR - 4}
                    fill={PHOSPHOR}
                    fontSize={10}
                    fontFamily="'Courier New', monospace"
                    opacity={0.3}
                    filter="url(#phosphorGlow)"
                  >
                    {RING_LABELS[idx]}
                  </text>
                </React.Fragment>
              );
            })}

            {/* Cross hairs */}
            <line x1={CX} y1={CY - MAX_R} x2={CX} y2={CY + MAX_R} stroke={PHOSPHOR_DIM} strokeWidth={0.6} />
            <line x1={CX - MAX_R} y1={CY} x2={CX + MAX_R} y2={CY} stroke={PHOSPHOR_DIM} strokeWidth={0.6} />

            {/* Compass rose labels */}
            {CARDINALS.map((c) => {
              const rad = (c.angle * Math.PI) / 180;
              const labelR = MAX_R + 22;
              return (
                <text
                  key={c.label}
                  x={CX + Math.cos(rad) * labelR}
                  y={CY + Math.sin(rad) * labelR + 5}
                  fill={PHOSPHOR}
                  fontSize={16}
                  fontFamily="'Courier New', monospace"
                  fontWeight={700}
                  textAnchor="middle"
                  opacity={0.5}
                  filter="url(#phosphorGlow)"
                >
                  {c.label}
                </text>
              );
            })}

            {/* Sweep cone — 30-degree trailing fade */}
            {Array.from({ length: 30 }).map((_, i) => {
              const a = sweepRad - (i * Math.PI) / 180;
              const op = interpolate(i, [0, 30], [0.45, 0], { extrapolateRight: "clamp" });
              return (
                <line
                  key={`sweep-${i}`}
                  x1={CX}
                  y1={CY}
                  x2={CX + Math.cos(a) * MAX_R}
                  y2={CY + Math.sin(a) * MAX_R}
                  stroke={PHOSPHOR}
                  strokeWidth={1}
                  opacity={op}
                />
              );
            })}

            {/* Primary sweep line */}
            <line
              x1={CX}
              y1={CY}
              x2={CX + Math.cos(sweepRad) * MAX_R}
              y2={CY + Math.sin(sweepRad) * MAX_R}
              stroke={PHOSPHOR}
              strokeWidth={2}
              opacity={0.9}
              filter="url(#phosphorGlow)"
            />

            {/* Aircraft blips with phosphor persistence trails */}
            {BLIPS.map((blip, i) => {
              const { bx, by, angle } = blipPosition(blip, frame);

              // Sweep-proximity brightness
              const blipAngleDeg = ((angle * 180) / Math.PI + 360) % 360;
              const sweepDeg = (sweepAngle + 360) % 360;
              const diff = Math.abs(blipAngleDeg - sweepDeg);
              const angularDist = Math.min(diff, 360 - diff);
              const brightness = interpolate(angularDist, [0, 40, 180], [1, 0.55, 0.2], {
                extrapolateRight: "clamp",
              });

              // Contact flash — bright bloom when sweep is very close
              const isFlashing = angularDist < 8;

              // Heading vector endpoint
              const headingRad = (blip.heading * Math.PI) / 180;
              const hvx = bx + Math.cos(headingRad) * HEADING_VECTOR_LEN;
              const hvy = by + Math.sin(headingRad) * HEADING_VECTOR_LEN;

              // Ghost trail positions (past frames)
              const ghosts: Array<{ gx: number; gy: number; opacity: number }> = [];
              for (let g = 1; g <= GHOST_COUNT; g++) {
                const pastFrame = Math.max(0, frame - g * GHOST_FRAME_SPACING);
                const past = blipPosition(blip, pastFrame);
                ghosts.push({
                  gx: past.bx,
                  gy: past.by,
                  opacity: interpolate(g, [1, GHOST_COUNT], [0.25, 0.06]),
                });
              }

              return (
                <g key={i}>
                  {/* Phosphor persistence ghost trail */}
                  {ghosts.map((ghost, gi) => (
                    <circle
                      key={`ghost-${i}-${gi}`}
                      cx={ghost.gx}
                      cy={ghost.gy}
                      r={interpolate(gi, [0, GHOST_COUNT - 1], [4, 2.5])}
                      fill={PHOSPHOR}
                      opacity={ghost.opacity * brightness}
                    />
                  ))}

                  {/* Faint trail line connecting ghosts */}
                  {ghosts.length > 1 && (
                    <polyline
                      points={[
                        ...ghosts
                          .slice()
                          .reverse()
                          .map((g) => `${g.gx},${g.gy}`),
                        `${bx},${by}`,
                      ].join(" ")}
                      fill="none"
                      stroke={PHOSPHOR_GHOST}
                      strokeWidth={1.2}
                      opacity={brightness * 0.5}
                    />
                  )}

                  {/* Main blip group */}
                  <g
                    opacity={brightness}
                    filter={isFlashing ? "url(#contactFlash)" : "url(#phosphorGlow)"}
                  >
                    {/* Contact flash halo */}
                    {isFlashing && (
                      <circle
                        cx={bx}
                        cy={by}
                        r={14}
                        fill={PHOSPHOR}
                        opacity={interpolate(angularDist, [0, 8], [0.35, 0], {
                          extrapolateRight: "clamp",
                        })}
                      />
                    )}

                    {/* Triangle blip pointing in heading direction */}
                    <polygon
                      points="0,-7 -4,5 4,5"
                      fill={isFlashing ? "#44ff77" : PHOSPHOR}
                      transform={`translate(${bx},${by}) rotate(${blip.heading})`}
                    />

                    {/* Heading vector line */}
                    <line
                      x1={bx}
                      y1={by}
                      x2={hvx}
                      y2={hvy}
                      stroke={PHOSPHOR}
                      strokeWidth={1}
                      opacity={0.45}
                      strokeDasharray="3,3"
                    />

                    {/* Label */}
                    <text
                      x={bx + 14}
                      y={by - 5}
                      fill={PHOSPHOR}
                      fontSize={11}
                      fontFamily="'Courier New', monospace"
                      opacity={0.7}
                    >
                      {blip.label}
                    </text>
                    <text
                      x={bx + 14}
                      y={by + 9}
                      fill={PHOSPHOR}
                      fontSize={10}
                      fontFamily="'Courier New', monospace"
                      opacity={0.45}
                    >
                      {blip.alt}
                    </text>
                  </g>
                </g>
              );
            })}

            {/* Center dot */}
            <circle cx={CX} cy={CY} r={4} fill={PHOSPHOR} opacity={0.8} filter="url(#phosphorGlow)" />
            <circle cx={CX} cy={CY} r={1.5} fill="#88ffaa" opacity={0.9} />
          </svg>

          {/* ADS-B label — top left */}
          <div
            style={{
              position: "absolute",
              top: 36,
              left: 56,
              zIndex: 5,
              textShadow: `0 0 8px ${PHOSPHOR}66, 0 0 20px ${PHOSPHOR}33`,
            }}
          >
            <div
              style={{
                color: PHOSPHOR,
                fontSize: 22,
                fontWeight: 700,
                letterSpacing: 4,
                opacity: 0.8,
              }}
            >
              ADS-B TRACKING
            </div>
            <div
              style={{
                color: PHOSPHOR,
                fontSize: 13,
                opacity: 0.35,
                letterSpacing: 2,
                marginTop: 4,
              }}
            >
              48.1101N / 11.5560E — RANGE 200NM
            </div>
          </div>

          {/* Status readout — bottom right */}
          <div
            style={{
              position: "absolute",
              bottom: 40,
              right: 56,
              zIndex: 5,
              textAlign: "right",
              textShadow: `0 0 8px ${PHOSPHOR}66, 0 0 20px ${PHOSPHOR}33`,
            }}
          >
            <div
              style={{
                color: PHOSPHOR,
                fontSize: 14,
                fontWeight: 700,
                letterSpacing: 3,
                opacity: 0.7,
              }}
            >
              TRACK COUNT: {BLIPS.length}
            </div>
            <div
              style={{
                color: PHOSPHOR,
                fontSize: 12,
                letterSpacing: 2,
                opacity: 0.45,
                marginTop: 4,
              }}
            >
              CIV: {civCount} &nbsp; MIL: {milCount}
            </div>
            <div
              style={{
                color: PHOSPHOR,
                fontSize: 11,
                letterSpacing: 2,
                opacity: 0.3,
                marginTop: 2,
              }}
            >
              MODE-S / ADS-B
            </div>
          </div>

          {/* Scan-line overlay for CRT feel */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              pointerEvents: "none",
              zIndex: 10,
              background: `repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,255,65,0.02) 2px, rgba(0,255,65,0.02) 3px)`,
            }}
          />

          {/* Inner phosphor bloom layer — faint green haze */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              pointerEvents: "none",
              zIndex: 11,
              background: `radial-gradient(ellipse at 50% 50%, rgba(0,255,65,0.03) 0%, transparent 60%)`,
            }}
          />
        </div>
      </div>

      {/* Dark vignette — outermost, covers entire frame including CRT edges */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          zIndex: 20,
          background:
            "radial-gradient(ellipse at center, transparent 40%, rgba(0,8,0,0.2) 70%, rgba(0,0,0,0.35) 100%)",
        }}
      />

      {/* CRT edge shadow — simulates curved glass catching less light at edges */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          zIndex: 21,
          boxShadow: "inset 0 0 120px 40px rgba(0,0,0,0.3), inset 0 0 300px 80px rgba(0,0,0,0.15)",
          borderRadius: "18px",
        }}
      />
    </AbsoluteFill>
  );
};
