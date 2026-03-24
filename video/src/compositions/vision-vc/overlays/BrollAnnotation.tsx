/**
 * BrollAnnotation — small data overlays on b-roll scenes.
 *
 * PH finding: annotations/highlights = r+0.152, p<0.001.
 * PH finding: more on-screen text = r+0.146, p<0.001.
 * PH finding: jargon density = r+0.115, p=0.006.
 *
 * Small pill-shaped labels with live data points.
 * Positioned in corners, out of the way but visible.
 */
import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from "remotion";
import { COLOR, FONT } from "../tokens";

interface AnnotationProps {
  /** Top-left label */
  label: string;
  /** Bottom-left data point (monospace) */
  metric?: string;
  /** Top-right category tag */
  tag?: string;
  /** Bottom-right "LIVE" or timestamp */
  status?: string;
}

const Pill: React.FC<{
  children: React.ReactNode;
  style?: React.CSSProperties;
  mono?: boolean;
}> = ({ children, style, mono }) => (
  <div
    style={{
      fontFamily: mono ? FONT.mono : FONT.sans,
      fontSize: mono ? 13 : 12,
      fontWeight: 600,
      color: COLOR.textPrimary,
      backgroundColor: "rgba(255,255,255,0.88)",
      backdropFilter: "blur(8px)",
      padding: "5px 12px",
      borderRadius: 4,
      border: `1px solid ${COLOR.borderLight}`,
      letterSpacing: mono ? "0.02em" : "0.06em",
      textTransform: mono ? "none" : "uppercase",
      whiteSpace: "nowrap",
      ...style,
    }}
  >
    {children}
  </div>
);

export const BrollAnnotation: React.FC<AnnotationProps> = ({
  label,
  metric,
  tag,
  status = "LIVE",
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const springConfig = { damping: 12, mass: 0.8 };

  // Staggered spring entrances
  const labelSpring = spring({ frame: Math.max(0, frame - 4), fps, config: springConfig });
  const labelY = interpolate(labelSpring, [0, 1], [30, 0]);
  const labelOpacity = interpolate(labelSpring, [0, 0.5], [0, 1], { extrapolateRight: "clamp" });

  const tagSpring = spring({ frame: Math.max(0, frame - 6), fps, config: springConfig });
  const tagY = interpolate(tagSpring, [0, 1], [30, 0]);
  const tagOpacity = interpolate(tagSpring, [0, 0.5], [0, 1], { extrapolateRight: "clamp" });

  const metricSpring = spring({ frame: Math.max(0, frame - 8), fps, config: springConfig });
  const metricY = interpolate(metricSpring, [0, 1], [30, 0]);
  const metricOpacity = interpolate(metricSpring, [0, 0.5], [0, 1], { extrapolateRight: "clamp" });

  const statusSpring = spring({ frame: Math.max(0, frame - 10), fps, config: springConfig });
  const statusY = interpolate(statusSpring, [0, 1], [30, 0]);
  const statusOpacity = interpolate(statusSpring, [0, 0.5], [0, 1], { extrapolateRight: "clamp" });

  // Status blink (subtle)
  const blink = Math.sin(frame * 0.3) > 0.3 ? 1 : 0.6;

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {/* Top-left: source label */}
      <div style={{ position: "absolute", top: 48, left: 60, opacity: labelOpacity, transform: `translateY(${labelY}px)` }}>
        <Pill>{label}</Pill>
      </div>

      {/* Top-right: category tag */}
      {tag && (
        <div style={{ position: "absolute", top: 48, right: 60, opacity: tagOpacity, transform: `translateY(${tagY}px)` }}>
          <Pill>{tag}</Pill>
        </div>
      )}

      {/* Bottom-left: metric */}
      {metric && (
        <div style={{ position: "absolute", bottom: 56, left: 60, opacity: metricOpacity, transform: `translateY(${metricY}px)` }}>
          <Pill mono>{metric}</Pill>
        </div>
      )}

      {/* Bottom-right: LIVE status */}
      <div style={{ position: "absolute", bottom: 56, right: 60, opacity: statusOpacity * blink, transform: `translateY(${statusY}px)` }}>
        <Pill
          style={{
            color: COLOR.up,
            borderColor: "rgba(22,163,74,0.3)",
          }}
        >
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                backgroundColor: COLOR.up,
              }}
            />
            {status}
          </span>
        </Pill>
      </div>
    </AbsoluteFill>
  );
};
