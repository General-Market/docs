import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { font, monoFont } from "./tokens";

// The simple language: a card is a number, or two numbers compared. Nothing
// else. Huge figures, one short label each, generous space. Built for the
// blue field — white ink, one figure allowed to go red where it costs you.
//
//   StatDuel — two figures side by side (you vs them), a thin rule between.
//   StatSolo — one figure, one caption.
//
// Four elements, at most: two numbers, two labels. The title lives on the
// SceneFrame above.

type Tone = "ink" | "soft" | "bad";

const toneColor = (t: Tone = "ink"): string =>
  t === "bad" ? "#FF6B6B" : t === "soft" ? "rgba(255,255,255,0.5)" : "#FFFFFF";

export type Side = {
  value: string;
  label: string;
  tone?: Tone;
};

const Figure: React.FC<{ side: Side; delay: number }> = ({ side, delay }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const rise = spring({
    fps,
    frame: Math.max(0, frame - delay),
    config: { mass: 0.7, damping: 16, stiffness: 110 },
    durationInFrames: 24,
  });
  const op = interpolate(frame - delay, [0, 10], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const y = (1 - rise) * 26;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        opacity: op,
        transform: `translateY(${y.toFixed(1)}px)`,
      }}
    >
      <div
        style={{
          fontFamily: font,
          fontSize: 184,
          fontWeight: 800,
          letterSpacing: "-0.03em",
          lineHeight: 0.92,
          color: toneColor(side.tone),
          fontVariantNumeric: "tabular-nums",
          whiteSpace: "nowrap",
        }}
      >
        {side.value}
      </div>
      <div
        style={{
          marginTop: 26,
          fontFamily: monoFont,
          fontSize: 23,
          fontWeight: 500,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          color: "rgba(255,255,255,0.62)",
          whiteSpace: "nowrap",
        }}
      >
        {side.label}
      </div>
    </div>
  );
};

export const StatDuel: React.FC<{ left: Side; right: Side }> = ({ left, right }) => {
  const frame = useCurrentFrame();
  const ruleH = interpolate(frame, [10, 28], [0, 230], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 150,
        paddingTop: 70,
      }}
    >
      <Figure side={left} delay={6} />
      <div
        style={{
          width: 2,
          height: ruleH,
          background: "rgba(255,255,255,0.22)",
          borderRadius: 1,
        }}
      />
      <Figure side={right} delay={12} />
    </div>
  );
};

export const StatSolo: React.FC<{ value: string; caption: string; tone?: Tone }> = ({
  value,
  caption,
  tone,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const rise = spring({ fps, frame, config: { mass: 0.7, damping: 16, stiffness: 110 }, durationInFrames: 26 });
  const op = interpolate(frame, [0, 12], [0, 1], { extrapolateRight: "clamp" });
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        paddingTop: 70,
        opacity: op,
        transform: `translateY(${((1 - rise) * 26).toFixed(1)}px)`,
      }}
    >
      <div
        style={{
          fontFamily: font,
          fontSize: 280,
          fontWeight: 800,
          letterSpacing: "-0.03em",
          lineHeight: 0.9,
          color: toneColor(tone),
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </div>
      <div
        style={{
          marginTop: 34,
          fontFamily: monoFont,
          fontSize: 26,
          fontWeight: 500,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: "rgba(255,255,255,0.62)",
        }}
      >
        {caption}
      </div>
    </div>
  );
};
