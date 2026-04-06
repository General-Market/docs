/**
 * ClosingSection — Fix 7: Value statement, not logo.
 *
 * Phase 1: "$1 minimum. Zero spread." (pricing trust signal)
 * Phase 2: "583,551 prediction markets" (metric)
 * Phase 3: "The world's most absurd prediction market." + urgency
 *          No logo. No URL pill. No "General Market" wordmark.
 *          The PH page has all of that. End on identity + urgency.
 *          URL stays visible in MosaicDezoom browser chrome.
 */
import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  interpolate,
  spring,
  useVideoConfig,
} from "remotion";
import { COLOR, FONT } from "../tokens";

export const ClosingSection: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // ── LINE 1: Pricing (f5-55) ──
  const line1In = interpolate(frame, [5, 14], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });
  const line1Out = interpolate(frame, [50, 58], [1, 0], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });
  const line1Op = frame < 50 ? line1In : line1Out;
  const line1Scale = interpolate(
    spring({ frame: Math.max(0, frame - 5), fps, config: { damping: 22, stiffness: 130, mass: 0.5 } }),
    [0, 1], [0.96, 1]
  );

  // ── LINE 2: Market count (f62-115) ──
  const line2In = interpolate(frame, [62, 71], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });
  const line2Out = interpolate(frame, [110, 118], [1, 0], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });
  const line2Op = frame < 110 ? line2In : line2Out;
  const line2Scale = interpolate(
    spring({ frame: Math.max(0, frame - 62), fps, config: { damping: 22, stiffness: 130, mass: 0.5 } }),
    [0, 1], [0.96, 1]
  );

  // ── PHASE 3: Identity + urgency (f122+) ──
  const p3In = interpolate(frame, [122, 134], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });
  const p3Y = interpolate(frame, [122, 136], [10, 0], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });

  // Urgency (delayed)
  const urgOp = interpolate(frame, [142, 152], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });

  // End fade
  const endFade = interpolate(frame, [172, 185], [1, 0], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });

  // ── EXIT: scale down + fade in last 10 frames ──
  const exitProgress = interpolate(frame, [durationInFrames - 10, durationInFrames], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });
  const exitScale = interpolate(exitProgress, [0, 1], [1, 0.95]);
  const exitOpacity = interpolate(exitProgress, [0, 1], [1, 0]);

  return (
    <AbsoluteFill style={{
      backgroundColor: "transparent",
      transform: `scale(${exitScale})`,
      opacity: exitOpacity,
    }}>
      {/* LINE 1: Pricing */}
      {line1Op > 0 && (
        <div style={{
          position: "absolute", top: "50%", left: "50%",
          transform: `translate(-50%, -50%) scale(${line1Scale})`,
          opacity: line1Op, textAlign: "center",
        }}>
          <div style={{
            fontFamily: FONT.sans, fontSize: 76, fontWeight: 900,
            color: COLOR.textPrimary, letterSpacing: "-0.03em",
            whiteSpace: "nowrap",
            textShadow: "0 2px 20px rgba(255,255,255,0.8)",
          }}>
            $1 minimum. Zero spread.
          </div>
          <div style={{
            fontFamily: FONT.sans, fontSize: 32, fontWeight: 500,
            color: COLOR.textSecondary, marginTop: 16,
            textShadow: "0 1px 12px rgba(255,255,255,0.6)",
          }}>
            10-minute settlement
          </div>
        </div>
      )}

      {/* LINE 2: Market count */}
      {line2Op > 0 && (
        <div style={{
          position: "absolute", top: "50%", left: "50%",
          transform: `translate(-50%, -50%) scale(${line2Scale})`,
          opacity: line2Op, textAlign: "center",
        }}>
          <div style={{
            fontFamily: FONT.mono, fontSize: 100, fontWeight: 700,
            color: COLOR.textPrimary, letterSpacing: "-0.02em",
            fontVariantNumeric: "tabular-nums",
            textShadow: "0 2px 20px rgba(255,255,255,0.8)",
          }}>
            583,551
          </div>
          <div style={{
            fontFamily: FONT.sans, fontSize: 36, fontWeight: 600,
            color: COLOR.textSecondary, marginTop: 12,
            textShadow: "0 1px 12px rgba(255,255,255,0.6)",
          }}>
            prediction markets
          </div>
        </div>
      )}

      {/* PHASE 3: Identity + urgency — no logo */}
      {frame >= 122 && (
        <div style={{
          position: "absolute", top: "50%", left: "50%",
          transform: `translate(-50%, -50%) translateY(${p3Y}px)`,
          opacity: p3In * endFade,
          textAlign: "center",
          display: "flex", flexDirection: "column", alignItems: "center", gap: 20,
        }}>
          <div style={{
            fontFamily: FONT.sans, fontWeight: 900, fontSize: 56,
            color: COLOR.textPrimary, letterSpacing: "-0.03em",
            textShadow: "0 2px 16px rgba(255,255,255,0.7)",
            lineHeight: 1.2,
          }}>
            The world's most absurd
            <br />
            prediction market.
          </div>

          <div style={{
            fontFamily: FONT.sans, fontWeight: 500, fontSize: 24,
            color: COLOR.textMuted, marginTop: 4,
            textShadow: "0 1px 8px rgba(255,255,255,0.5)",
          }}>
            583,551 markets and counting.
          </div>

          {/* Urgency */}
          <div style={{
            opacity: urgOp * endFade,
            fontFamily: FONT.sans, fontWeight: 800, fontSize: 28,
            color: COLOR.brand, letterSpacing: "0.04em",
            textTransform: "uppercase", marginTop: 16,
            display: "flex", alignItems: "center", gap: 10,
            textShadow: "0 1px 8px rgba(255,255,255,0.5)",
          }}>
            <span style={{
              width: 10, height: 10, borderRadius: "50%",
              backgroundColor: COLOR.brand,
              boxShadow: `0 0 12px ${COLOR.brand}`,
            }} />
            Beta live — Season 1
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};
