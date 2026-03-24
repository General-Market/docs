import React from "react";
import { spring, useCurrentFrame, useVideoConfig } from "remotion";

interface Props {
  text: string;
  /** Absolute frame when trail dots start appearing */
  startFrame: number;
  maxWidth?: number;
  fontSize?: number;
  accentColor?: string;
  /** Whether bubble is on the left side of the character */
  anchorLeft?: boolean;
}

const DOT_RADII = [6, 10, 14];
const DOT_STAGGER = 3; // frames between each dot
const CLOUD_DELAY = DOT_RADII.length * DOT_STAGGER; // frames after first dot before cloud appears

/**
 * SVG cloud thought bubble with 3 trailing dots.
 * Dots pop in staggered, then cloud springs in, then text fades.
 */
export const ThoughtBubble: React.FC<Props> = ({
  text,
  startFrame,
  maxWidth = 460,
  fontSize = 34,
  accentColor = "#00D4FF",
  anchorLeft = false,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  if (frame < startFrame) return null;

  const elapsed = frame - startFrame;

  // ── Trail dots ───────────────────────────────────────────────────
  const dotScales = DOT_RADII.map((_, i) => {
    const dotStart = i * DOT_STAGGER;
    if (elapsed < dotStart) return 0;
    return spring({
      frame: elapsed - dotStart,
      fps,
      config: { damping: 8, stiffness: 200, mass: 0.4 },
      durationInFrames: 8,
    });
  });

  // ── Cloud entrance ──────────────────────────────────────────────
  const cloudStart = CLOUD_DELAY;
  const cloudScale =
    elapsed < cloudStart
      ? 0
      : spring({
          frame: elapsed - cloudStart,
          fps,
          config: { damping: 10, stiffness: 160, mass: 0.6 },
          durationInFrames: 15,
        });

  // ── Text fade ───────────────────────────────────────────────────
  const textStart = cloudStart + 6;
  const textOpacity =
    elapsed < textStart
      ? 0
      : Math.min(1, (elapsed - textStart) / 6);

  // ── Idle float ──────────────────────────────────────────────────
  const floatY = Math.sin((frame / 50) * Math.PI * 2) * 4;

  // Position dots from character toward cloud
  const dotPositions = anchorLeft
    ? [
        { cx: 30, cy: 120 },
        { cx: 55, cy: 95 },
        { cx: 85, cy: 65 },
      ]
    : [
        { cx: maxWidth + 20, cy: 120 },
        { cx: maxWidth - 5, cy: 95 },
        { cx: maxWidth - 35, cy: 65 },
      ];

  // Cloud path — a bubbly cloud shape
  const cloudW = maxWidth;
  const cloudH = Math.max(80, fontSize * 2.8);
  const cx = cloudW / 2;
  const cy = cloudH / 2;
  const rx = cloudW / 2 - 8;
  const ry = cloudH / 2 - 8;

  // Build cloud from overlapping ellipses (simple approach)
  const cloudPath = [
    `M ${cx - rx * 0.8} ${cy + ry * 0.6}`,
    `Q ${cx - rx} ${cy + ry * 0.2} ${cx - rx * 0.7} ${cy - ry * 0.4}`,
    `Q ${cx - rx * 0.5} ${cy - ry} ${cx - rx * 0.1} ${cy - ry * 0.8}`,
    `Q ${cx + rx * 0.1} ${cy - ry * 1.1} ${cx + rx * 0.3} ${cy - ry * 0.7}`,
    `Q ${cx + rx * 0.6} ${cy - ry * 1.0} ${cx + rx * 0.7} ${cy - ry * 0.3}`,
    `Q ${cx + rx * 1.0} ${cy - ry * 0.1} ${cx + rx * 0.8} ${cy + ry * 0.5}`,
    `Q ${cx + rx * 0.6} ${cy + ry * 0.9} ${cx + rx * 0.2} ${cy + ry * 0.7}`,
    `Q ${cx - rx * 0.2} ${cy + ry * 1.0} ${cx - rx * 0.5} ${cy + ry * 0.7}`,
    `Z`,
  ].join(" ");

  const totalHeight = cloudH + 80; // cloud + space for dots
  const totalWidth = cloudW + 60;

  return (
    <div
      style={{
        position: "relative",
        width: totalWidth,
        height: totalHeight,
        transform: `translateY(${floatY}px)`,
      }}
    >
      <svg
        width={totalWidth}
        height={totalHeight}
        viewBox={`0 0 ${totalWidth} ${totalHeight}`}
        style={{ overflow: "visible" }}
      >
        {/* Glow filter */}
        <defs>
          <filter id="bubble-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feFlood floodColor={accentColor} floodOpacity="0.12" result="color" />
            <feComposite in="color" in2="blur" operator="in" result="glow" />
            <feMerge>
              <feMergeNode in="glow" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Trail dots */}
        {DOT_RADII.map((r, i) => (
          <circle
            key={i}
            cx={dotPositions[i].cx}
            cy={dotPositions[i].cy}
            r={r * dotScales[i]}
            fill="rgba(255,255,255,0.95)"
            filter="url(#bubble-glow)"
          />
        ))}

        {/* Cloud */}
        <g
          transform={`translate(${(totalWidth - cloudW) / 2}, 0) scale(${cloudScale})`}
          style={{ transformOrigin: `${cloudW / 2}px ${cloudH}px` }}
        >
          <path
            d={cloudPath}
            fill="rgba(255,255,255,0.95)"
            filter="url(#bubble-glow)"
          />

          {/* Text via foreignObject */}
          <foreignObject x={20} y={8} width={cloudW - 40} height={cloudH - 16}>
            <div
              style={{
                width: "100%",
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                opacity: textOpacity,
              }}
            >
              <span
                style={{
                  fontFamily: "'Switzer', 'Inter', 'Helvetica Neue', sans-serif",
                  fontSize,
                  fontWeight: 700,
                  color: "#1a1a1a",
                  textAlign: "center",
                  lineHeight: 1.3,
                  wordBreak: "break-word",
                }}
              >
                {text}
              </span>
            </div>
          </foreignObject>
        </g>
      </svg>
    </div>
  );
};
