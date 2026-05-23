import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { SceneFrame, font, monoFont, scene } from "../props";

// MECHANISM 12 / 13 — "Paid to win".
//
// A strategy's raw P&L bar sits below zero — a loss. A "REBATE" segment stacks
// on top and lifts the same strategy above zero: the venue pays the maker to
// run a losing book. Second beat — your identical strategy gets no rebate, so
// your bar stays under water while theirs clears. The rebate is the edge.

const STAGE_W = 1100;
const STAGE_LEFT = (1920 - STAGE_W) / 2;
const STAGE_TOP = 360;

// Plot geometry. The zero line sits mid-stage; bars grow up (profit) or down
// (loss) from it.
const ZERO_Y = 230;
const UNIT = 24; // px per $ of P&L
const RAW_PNL = -3; // both strategies lose $3 on raw fills
const REBATE = 5; // the maker's rebate, in $
const BAR_W = 150;

const PnlColumn: React.FC<{
  x: number;
  label: string;
  withRebate: boolean;
  delay: number;
}> = ({ x, label, withRebate, delay }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Raw loss bar rises first.
  const rawRise = spring({
    fps,
    frame: Math.max(0, frame - delay),
    config: { mass: 0.6, damping: 15, stiffness: 120 },
    durationInFrames: 24,
  });
  // Rebate segment stacks after the raw bar settles.
  const rebRise = withRebate
    ? spring({
        fps,
        frame: Math.max(0, frame - delay - 24),
        config: { mass: 0.55, damping: 13, stiffness: 130 },
        durationInFrames: 22,
      })
    : 0;

  const lossH = Math.abs(RAW_PNL) * UNIT * rawRise; // grows downward from zero
  const rebH = REBATE * UNIT * rebRise; // grows upward, stacked above zero

  const net = RAW_PNL + (withRebate ? REBATE * rebRise : 0);
  const profitable = net > 0;

  const labelOp = interpolate(frame - delay, [0, 10], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div style={{ position: "absolute", left: x, top: 0, width: BAR_W, transform: "translateX(-50%)" }}>
      {/* Raw loss segment — below zero, red-free, just dim ink */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: ZERO_Y,
          width: BAR_W,
          height: lossH,
          borderRadius: "0 0 8px 8px",
          background: "rgba(255,255,255,0.18)",
          border: "1px solid rgba(255,255,255,0.22)",
        }}
      />
      {/* Rebate segment — above zero, saturated accent */}
      {withRebate ? (
        <div
          style={{
            position: "absolute",
            left: 0,
            top: ZERO_Y - rebH,
            width: BAR_W,
            height: rebH,
            borderRadius: "8px 8px 0 0",
            background: scene.accent,
            boxShadow: "0 0 0 1px rgba(91,121,255,0.6) inset, 0 12px 30px rgba(0,82,255,0.28)",
          }}
        />
      ) : null}

      {/* "REBATE" tag on the lifting segment */}
      {withRebate && rebH > 30 ? (
        <div
          style={{
            position: "absolute",
            left: 0,
            top: ZERO_Y - rebH / 2 - 10,
            width: BAR_W,
            textAlign: "center",
            fontFamily: monoFont,
            fontSize: 16,
            fontWeight: 700,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: scene.ink,
            opacity: rebRise,
          }}
        >
          + REBATE
        </div>
      ) : null}

      {/* Net P&L readout — above the bar if profit, below the loss if not */}
      <div
        style={{
          position: "absolute",
          left: -30,
          top: profitable ? ZERO_Y - rebH - 52 : ZERO_Y + lossH + 16,
          width: BAR_W + 60,
          textAlign: "center",
          fontFamily: font,
          fontSize: 38,
          fontWeight: 800,
          letterSpacing: "-0.02em",
          color: profitable ? scene.accentSoft : scene.inkSoft,
          fontVariantNumeric: "tabular-nums",
          opacity: labelOp,
        }}
      >
        {net >= 0 ? "+" : "−"}${Math.abs(net).toFixed(0)}
      </div>

      {/* Column label */}
      <div
        style={{
          position: "absolute",
          left: -40,
          top: ZERO_Y + lossH + (profitable ? 16 : 60),
          width: BAR_W + 80,
          textAlign: "center",
          fontFamily: monoFont,
          fontSize: 16,
          fontWeight: 700,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: profitable ? scene.ink : scene.inkDim,
          opacity: labelOp,
          lineHeight: 1.3,
          whiteSpace: "pre-line",
        }}
      >
        {label}
      </div>
    </div>
  );
};

export const MakerRebates: React.FC = () => {
  const frame = useCurrentFrame();

  const zeroOp = interpolate(frame, [6, 18], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const noteOp = interpolate(frame, [96, 112], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <SceneFrame kicker="MECHANISM 12 / 13" title="Paid to win">
      <AbsoluteFill>
        <div
          style={{
            position: "absolute",
            left: STAGE_LEFT,
            top: STAGE_TOP,
            width: STAGE_W,
            height: 540,
          }}
        >
          {/* The zero line — break-even */}
          <div
            style={{
              position: "absolute",
              left: 0,
              top: ZERO_Y,
              width: STAGE_W,
              borderTop: `1.5px dashed ${scene.inkDim}`,
              opacity: zeroOp,
            }}
          />
          <div
            style={{
              position: "absolute",
              left: 0,
              top: ZERO_Y - 26,
              fontFamily: monoFont,
              fontSize: 14,
              fontWeight: 600,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: scene.inkDim,
              opacity: zeroOp,
            }}
          >
            break-even
          </div>

          {/* Two identical strategies — one fed a rebate, one not */}
          <PnlColumn
            x={STAGE_W * 0.34}
            label={"MARKET MAKER\nsame strategy"}
            withRebate
            delay={18}
          />
          <PnlColumn
            x={STAGE_W * 0.7}
            label={"YOU\nidentical fills"}
            withRebate={false}
            delay={26}
          />

          {/* The punch — a losing book made profitable by the venue */}
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 470,
              width: STAGE_W,
              textAlign: "center",
              fontFamily: monoFont,
              fontSize: 16,
              fontWeight: 600,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: scene.inkSoft,
              opacity: noteOp,
            }}
          >
            same losing strategy · the rebate is the only edge
          </div>
        </div>
      </AbsoluteFill>
    </SceneFrame>
  );
};
