import React from "react";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import {
  FIT_FROM,
  FIT_TO,
  POINTS,
  X_TICKS,
  Y_TICKS,
} from "./data";
import { ACCENT, INK_SOFT, NAVY } from "./theme";
import { font, monoFont } from "../../common/fonts";

const PL = 320; // plot left
const PR = 1620; // plot right
const PT = 280; // plot top
const PB = 868; // plot bottom
const PW = PR - PL;
const PH = PB - PT;

const px = (nx: number) => PL + nx * PW;
const py = (ny: number) => PB - ny * PH;

export const ImpressionsVolumeChart: React.FC<{ background?: string }> = ({
  background = NAVY,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Opens already partly up (frame 0 ≈ 0.5) so the chart never starts on a
  // dead frame, and builds fast — axes, line and points all in motion early.
  const sceneOp = Math.min(
    interpolate(frame, [0, 8], [0.5, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
    interpolate(frame, [180, 200], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
  );

  // Heading sharpens in on a focus-pull — no fade-up-from-below.
  const titleBlur = interpolate(frame, [0, 14], [10, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  const axisDraw = interpolate(frame, [-4, 12], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });

  const lineDraw = interpolate(frame, [4, 30], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });

  const chipOp = interpolate(frame, [40, 56], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ backgroundColor: background, opacity: sceneOp }}>
      {/* heading */}
      <div
        style={{
          position: "absolute",
          left: 80,
          top: 86,
          filter: titleBlur > 0.1 ? `blur(${titleBlur.toFixed(2)}px)` : undefined,
        }}
      >
        <div
          style={{
            fontFamily: font,
            fontWeight: 800,
            fontSize: 66,
            letterSpacing: "-1.4px",
            color: "#fff",
          }}
        >
          Attention moves volume.
        </div>
        <div
          style={{
            fontFamily: monoFont,
            fontSize: 28,
            color: "rgba(255,255,255,0.62)",
            marginTop: 12,
            letterSpacing: "-0.2px",
          }}
        >
          Twitter impressions vs. daily trading volume — plotted on log axes.
        </div>
      </div>

      <svg
        width={1920}
        height={1080}
        viewBox="0 0 1920 1080"
        style={{ position: "absolute", inset: 0 }}
      >
        {/* gridlines */}
        {Y_TICKS.map(([ny], i) => (
          <line
            key={`gy${i}`}
            x1={PL}
            x2={PR}
            y1={py(ny)}
            y2={py(ny)}
            stroke="rgba(255,255,255,0.07)"
            strokeWidth={1}
            opacity={axisDraw}
          />
        ))}
        {X_TICKS.map(([nx], i) => (
          <line
            key={`gx${i}`}
            x1={px(nx)}
            x2={px(nx)}
            y1={PT}
            y2={PB}
            stroke="rgba(255,255,255,0.07)"
            strokeWidth={1}
            opacity={axisDraw}
          />
        ))}

        {/* axes */}
        <line
          x1={PL}
          y1={PB}
          x2={PR}
          y2={PB}
          stroke="rgba(255,255,255,0.35)"
          strokeWidth={2}
          pathLength={1}
          strokeDasharray={1}
          strokeDashoffset={1 - axisDraw}
        />
        <line
          x1={PL}
          y1={PB}
          x2={PL}
          y2={PT}
          stroke="rgba(255,255,255,0.35)"
          strokeWidth={2}
          pathLength={1}
          strokeDasharray={1}
          strokeDashoffset={1 - axisDraw}
        />

        {/* axis tick labels */}
        {X_TICKS.map(([nx, label], i) => (
          <text
            key={`xt${i}`}
            x={px(nx)}
            y={PB + 44}
            fill="rgba(255,255,255,0.6)"
            fontFamily={monoFont}
            fontSize={26}
            textAnchor="middle"
            opacity={axisDraw}
          >
            {label}
          </text>
        ))}
        {Y_TICKS.map(([ny, label], i) => (
          <text
            key={`yt${i}`}
            x={PL - 26}
            y={py(ny) + 9}
            fill="rgba(255,255,255,0.6)"
            fontFamily={monoFont}
            fontSize={26}
            textAnchor="end"
            opacity={axisDraw}
          >
            {label}
          </text>
        ))}

        {/* axis captions */}
        <text
          x={(PL + PR) / 2}
          y={PB + 96}
          fill="rgba(255,255,255,0.5)"
          fontFamily={monoFont}
          fontSize={26}
          textAnchor="middle"
          opacity={axisDraw}
        >
          Twitter impressions →
        </text>
        <text
          x={104}
          y={(PT + PB) / 2}
          fill="rgba(255,255,255,0.5)"
          fontFamily={monoFont}
          fontSize={26}
          textAnchor="middle"
          transform={`rotate(-90 104 ${(PT + PB) / 2})`}
          opacity={axisDraw}
        >
          Trading volume, $ →
        </text>

        {/* best-fit line, drawing on */}
        <line
          x1={px(FIT_FROM[0])}
          y1={py(FIT_FROM[1])}
          x2={px(FIT_TO[0])}
          y2={py(FIT_TO[1])}
          stroke={ACCENT}
          strokeWidth={6}
          strokeLinecap="round"
          pathLength={1}
          strokeDasharray={1}
          strokeDashoffset={1 - lineDraw}
          style={{ filter: `drop-shadow(0 0 12px rgba(45,91,255,0.5))` }}
        />

        {/* scatter points */}
        {POINTS.map(([nx, ny], i) => {
          const start = i * 1.4;
          const s = spring({
            fps,
            frame: frame - start,
            config: { mass: 0.5, damping: 13, stiffness: 140 },
            durationInFrames: 20,
          });
          const r = 11 * s;
          return (
            <circle
              key={`p${i}`}
              cx={px(nx)}
              cy={py(ny)}
              r={Math.max(0, r)}
              fill="#fff"
              opacity={0.92 * Math.min(1, s)}
            />
          );
        })}
      </svg>

      {/* elasticity callout */}
      <div
        style={{
          position: "absolute",
          left: PL + 30,
          top: PT + 24,
          opacity: chipOp,
          paddingLeft: 22,
          borderLeft: `4px solid ${ACCENT}`,
        }}
      >
        <div
          style={{
            fontFamily: font,
            fontWeight: 800,
            fontSize: 42,
            color: "#fff",
            letterSpacing: "-0.6px",
          }}
        >
          +1% impressions → +0.33% volume
        </div>
        <div
          style={{
            fontFamily: monoFont,
            fontSize: 24,
            color: INK_SOFT,
            marginTop: 8,
          }}
        >
          log–log elasticity · Granger-causal · Shen, Urquhart &amp; Wang (2019)
        </div>
      </div>
    </AbsoluteFill>
  );
};
