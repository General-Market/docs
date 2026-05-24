// RetailVsMM — the opener visual for "you don't make as much as a market maker".
//
// Two money columns on the blue field: YOU make one $, the MARKET MAKER makes
// four — and a thin stream of $ drifts from your column to theirs, because the
// gap isn't that he earns more in a vacuum, it's that he earns it FROM you on
// every trade you make. Built on the standard SceneFrame in the blue-world
// language (white ink, Base blue, mono labels), so it sits beside the webcam
// like any other opener schematic.

import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { SceneFrame, scene, font, monoFont } from "../props";

// One column: a stack of $ glyphs rising to `count`, a pedestal bar, a label.
const MoneyColumn: React.FC<{
  count: number;
  label: string;
  delay: number;
  big: boolean;
}> = ({ count, label, delay, big }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const glyphSize = big ? 132 : 96;
  const gap = big ? 18 : 14;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "flex-end",
      }}
    >
      {/* The $ stack — each glyph springs up in turn, bottom to top. */}
      <div
        style={{
          display: "flex",
          flexDirection: "column-reverse",
          alignItems: "center",
          gap,
          marginBottom: 30,
        }}
      >
        {Array.from({ length: count }).map((_, i) => {
          const at = delay + i * 7;
          const rise = spring({
            fps,
            frame: Math.max(0, frame - at),
            config: { mass: 0.6, damping: 13, stiffness: 150 },
            durationInFrames: 20,
          });
          const op = interpolate(frame - at, [0, 8], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          return (
            <div
              key={i}
              style={{
                fontFamily: font,
                fontSize: glyphSize,
                fontWeight: 800,
                lineHeight: 0.9,
                letterSpacing: "-0.04em",
                color: scene.ink,
                opacity: op,
                transform: `translateY(${((1 - rise) * 30).toFixed(1)}px) scale(${(0.7 + rise * 0.3).toFixed(3)})`,
                textShadow: big
                  ? "0 0 40px rgba(30,115,255,0.55), 0 8px 24px rgba(2,14,43,0.5)"
                  : "0 6px 18px rgba(2,14,43,0.5)",
              }}
            >
              $
            </div>
          );
        })}
      </div>

      {/* Pedestal — a Base-blue bar, taller under the market maker. */}
      <div
        style={{
          width: big ? 280 : 220,
          height: big ? 18 : 12,
          borderRadius: 8,
          background: big
            ? `linear-gradient(90deg, ${scene.accentSoft}, ${scene.blueBright})`
            : "rgba(255,255,255,0.5)",
          boxShadow: big ? "0 0 30px rgba(30,115,255,0.5)" : "none",
        }}
      />

      <div
        style={{
          marginTop: 26,
          fontFamily: monoFont,
          fontSize: big ? 27 : 24,
          fontWeight: big ? 700 : 500,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          color: big ? scene.ink : scene.inkDim,
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </div>
    </div>
  );
};

// The extraction — small $ glyphs drift from YOU toward the MARKET MAKER,
// looping. Each one starts after the columns are up; the stream is the point.
const ExtractionFlow: React.FC<{ start: number }> = ({ start }) => {
  const frame = useCurrentFrame();
  const t = frame - start;
  if (t < 0) return null;

  const N = 7;
  const travel = 56; // frames to cross
  const fromX = -360;
  const toX = 360;
  const arcY = -120;

  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      {Array.from({ length: N }).map((_, i) => {
        const phase = ((t + (i * travel) / N) % travel) / travel; // 0..1 loop
        const x = interpolate(phase, [0, 1], [fromX, toX]);
        // a shallow arc — up then down into the taller stack
        const y = arcY * Math.sin(phase * Math.PI) - 40;
        const op = interpolate(phase, [0, 0.12, 0.85, 1], [0, 1, 1, 0]);
        const sc = interpolate(phase, [0, 1], [0.8, 1.05]);
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              transform: `translate(-50%,-50%) translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) scale(${sc.toFixed(2)})`,
              fontFamily: font,
              fontSize: 44,
              fontWeight: 800,
              color: scene.blueBright,
              opacity: op,
              textShadow: "0 0 18px rgba(30,115,255,0.7)",
            }}
          >
            $
          </div>
        );
      })}
    </div>
  );
};

export const RetailVsMM: React.FC = () => {
  const frame = useCurrentFrame();
  const ruleH = interpolate(frame, [12, 30], [0, 300], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <SceneFrame kicker="EVERY TRADE YOU MAKE">
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 220,
          paddingTop: 90,
        }}
      >
        <MoneyColumn count={1} label="you" delay={8} big={false} />
        <div
          style={{
            width: 2,
            height: ruleH,
            background: "rgba(255,255,255,0.18)",
            borderRadius: 1,
          }}
        />
        <MoneyColumn count={4} label="market maker" delay={20} big />
      </div>

      <ExtractionFlow start={48} />
    </SceneFrame>
  );
};
