import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { SceneFrame, font, monoFont, scene } from "../props";

// THE PRICE OF THE EDGE — "A million dollars of wires".
//
// A spend comparison. The "HEDGE FUND INFRA" bar towers, labeled
// "> $1,000,000". The "RETAIL" bar sits at ~zero. The gap between them is
// the edge — bought, not earned. A callback to the latency-map scene: the
// first dollar of this stack was a shorter wire.

const STAGE_W = 1200;
const STAGE_LEFT = (1920 - STAGE_W) / 2;
const STAGE_TOP = 330;

const BASELINE = 470;
const MAX_BAR_H = 410;
const BAR_W = 230;

const FUND_X = STAGE_W * 0.33;
const RETAIL_X = STAGE_W * 0.7;

export const InfraGap: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const fundRise = spring({
    fps,
    frame: Math.max(0, frame - 18),
    config: { mass: 0.7, damping: 15, stiffness: 110 },
    durationInFrames: 30,
  });
  const retailRise = spring({
    fps,
    frame: Math.max(0, frame - 30),
    config: { mass: 0.6, damping: 16, stiffness: 130 },
    durationInFrames: 22,
  });

  const fundH = MAX_BAR_H * fundRise;
  const retailH = MAX_BAR_H * 0.035 * retailRise;

  // Dollar counter ramps with the bar.
  const dollars = Math.round(
    interpolate(frame, [18, 54], [0, 1_000_000], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    })
  );
  const dollarStr = dollars >= 1_000_000 ? "1,000,000" : dollars.toLocaleString("en-US");

  const breath = 0.5 + 0.5 * Math.sin((frame / fps) * 2.2);

  const gapOp = interpolate(frame, [50, 66], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const callbackOp = interpolate(frame, [72, 90], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <SceneFrame kicker="THE PRICE OF THE EDGE" title="A million dollars of wires">
      <AbsoluteFill>
        <div
          style={{
            position: "absolute",
            left: STAGE_LEFT,
            top: STAGE_TOP,
            width: STAGE_W,
          }}
        >
          {/* Baseline rule */}
          <div
            style={{
              position: "absolute",
              left: 40,
              top: BASELINE,
              width: STAGE_W - 80,
              height: 0,
              borderTop: `1px solid ${scene.gridLine}`,
            }}
          />

          {/* Sapphire bloom behind the towering fund bar */}
          {fundH > 8 ? (
            <div
              style={{
                position: "absolute",
                left: FUND_X - BAR_W / 2 - 80,
                top: BASELINE - fundH - 100,
                width: BAR_W + 160,
                height: fundH + 160,
                background:
                  "radial-gradient(ellipse at center, rgba(0,82,255,0.40) 0%, rgba(0,82,255,0) 68%)",
                filter: "blur(8px)",
                opacity: 0.5 + 0.5 * breath,
                pointerEvents: "none",
              }}
            />
          ) : null}

          {/* HEDGE FUND INFRA bar */}
          <div
            style={{
              position: "absolute",
              left: FUND_X - BAR_W / 2,
              top: BASELINE - fundH,
              width: BAR_W,
              height: fundH,
              borderRadius: 22,
              background: scene.accent,
              boxShadow: `0 0 0 1px ${scene.accentSoft} inset, 0 16px 44px rgba(0,82,255,0.34)`,
            }}
          />
          {/* Fund dollar label above the bar */}
          <div
            style={{
              position: "absolute",
              left: FUND_X - 200,
              top: BASELINE - fundH - 86,
              width: 400,
              textAlign: "center",
              opacity: fundRise,
            }}
          >
            <div
              style={{
                fontFamily: font,
                fontSize: 52,
                fontWeight: 800,
                letterSpacing: "-0.022em",
                color: scene.ink,
                fontVariantNumeric: "tabular-nums",
                lineHeight: 1.0,
              }}
            >
              &gt; ${dollarStr}
            </div>
          </div>
          {/* Fund base label */}
          <div
            style={{
              position: "absolute",
              left: FUND_X - 160,
              top: BASELINE + 18,
              width: 320,
              textAlign: "center",
              fontFamily: monoFont,
              fontSize: 17,
              fontWeight: 700,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: scene.ink,
              opacity: fundRise,
            }}
          >
            Hedge fund infra
          </div>

          {/* RETAIL bar — at the floor */}
          <div
            style={{
              position: "absolute",
              left: RETAIL_X - BAR_W / 2,
              top: BASELINE - Math.max(retailH, 6),
              width: BAR_W,
              height: Math.max(retailH, 6),
              borderRadius: 10,
              background: "rgba(255,255,255,0.16)",
              boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.10)",
            }}
          />
          <div
            style={{
              position: "absolute",
              left: RETAIL_X - 200,
              top: BASELINE - 70,
              width: 400,
              textAlign: "center",
              opacity: retailRise,
            }}
          >
            <div
              style={{
                fontFamily: font,
                fontSize: 40,
                fontWeight: 800,
                letterSpacing: "-0.022em",
                color: scene.inkDim,
                fontVariantNumeric: "tabular-nums",
                lineHeight: 1.0,
              }}
            >
              ~$0
            </div>
          </div>
          <div
            style={{
              position: "absolute",
              left: RETAIL_X - 160,
              top: BASELINE + 18,
              width: 320,
              textAlign: "center",
              fontFamily: monoFont,
              fontSize: 17,
              fontWeight: 700,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: scene.inkSoft,
              opacity: retailRise,
            }}
          >
            Retail
          </div>

          {/* The gap bracket between the two bar tops */}
          <svg
            width={STAGE_W}
            height={BASELINE + 120}
            viewBox={`0 0 ${STAGE_W} ${BASELINE + 120}`}
            style={{ position: "absolute", inset: 0, overflow: "visible", pointerEvents: "none" }}
          >
            <line
              x1={FUND_X + BAR_W / 2 + 14}
              y1={BASELINE - fundH}
              x2={RETAIL_X - BAR_W / 2 - 14}
              y2={BASELINE - fundH}
              stroke={scene.accentSoft}
              strokeWidth={2}
              strokeDasharray="3 8"
              opacity={gapOp}
            />
          </svg>
          <div
            style={{
              position: "absolute",
              left: (FUND_X + RETAIL_X) / 2 - 120,
              top: BASELINE - fundH - 44,
              width: 240,
              textAlign: "center",
              fontFamily: monoFont,
              fontSize: 16,
              fontWeight: 700,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: scene.ink,
              opacity: gapOp,
            }}
          >
            the edge
          </div>

          {/* Callback to the latency-map scene */}
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: BASELINE + 96,
              textAlign: "center",
              fontFamily: monoFont,
              fontSize: 15,
              fontWeight: 500,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: scene.inkDim,
              opacity: callbackOp,
            }}
          >
            the latency map was the first dollar of this
          </div>
        </div>
      </AbsoluteFill>
    </SceneFrame>
  );
};
