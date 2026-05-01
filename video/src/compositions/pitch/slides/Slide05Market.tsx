import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { COLOR, FONT, PAD, SLIDE_COUNT } from "../tokens";

const STARBURST_RAYS = 14;

const formatThousands = (n: number) =>
  Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

export const Slide05Market: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;

  // Counter — rolls 0 → 500,000 over 1 second, with bounce
  const counterRaw = interpolate(t, [0.05, 1.05], [0, 500000], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const counter = formatThousands(easeOut((counterRaw / 500000) || 0) * 500000);
  const counterScale = interpolate(t, [0, 0.45], [0.4, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: (x) => 1 - Math.pow(1 - x, 4),
  });
  const counterOpacity = interpolate(t, [0, 0.25], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Starburst rays — length grows
  const rayLength = interpolate(t, [0.1, 1.4], [0, 1300], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: easeOut,
  });
  const rayOpacity = interpolate(t, [0.1, 0.4], [0, 0.35], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // "exclusive markets" caption
  const captionOpacity = interpolate(t, [1.0, 1.35], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const captionY = interpolate(t, [1.0, 1.35], [16, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: easeOut,
  });

  // "only tradable with rainbows" sub-caption
  const subOpacity = interpolate(t, [1.4, 1.8], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const subY = interpolate(t, [1.4, 1.8], [12, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: easeOut,
  });

  return (
    <AbsoluteFill style={{ background: COLOR.bg }}>
      {/* Starburst rays radiating from center */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          width: 0,
          height: 0,
          opacity: rayOpacity,
        }}
      >
        {Array.from({ length: STARBURST_RAYS }, (_, i) => {
          const angle = (360 / STARBURST_RAYS) * i;
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: rayLength,
                height: 3,
                backgroundColor: COLOR.ink,
                transformOrigin: "0% 50%",
                transform: `rotate(${angle}deg) translateX(180px)`,
              }}
            />
          );
        })}
      </div>

      {/* Counter */}
      <AbsoluteFill
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          opacity: counterOpacity,
        }}
      >
        <div
          style={{
            fontFamily: FONT.serif,
            fontSize: 280,
            fontWeight: 400,
            color: COLOR.ink,
            letterSpacing: "-0.04em",
            lineHeight: 0.95,
            transform: `scale(${counterScale})`,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {counter}
        </div>
      </AbsoluteFill>

      {/* "exclusive markets" caption */}
      <div
        style={{
          position: "absolute",
          top: "70%",
          left: 0,
          right: 0,
          textAlign: "center",
          fontFamily: FONT.serif,
          fontSize: 96,
          fontWeight: 400,
          color: COLOR.ink,
          lineHeight: 1,
          letterSpacing: "-0.02em",
          opacity: captionOpacity,
          transform: `translateY(${captionY}px)`,
        }}
      >
        exclusive markets
      </div>

      {/* "only tradable with rainbows" sub-caption */}
      <div
        style={{
          position: "absolute",
          top: "82%",
          left: 0,
          right: 0,
          textAlign: "center",
          fontFamily: FONT.serif,
          fontSize: 48,
          fontWeight: 300,
          fontStyle: "italic",
          color: COLOR.muted,
          lineHeight: 1,
          opacity: subOpacity,
          transform: `translateY(${subY}px)`,
        }}
      >
        only tradable with rainbows
      </div>

      {/* Deck chrome */}
      <div
        style={{
          position: "absolute",
          top: 64,
          left: PAD.x,
          fontFamily: FONT.serif,
          fontSize: 22,
          color: COLOR.muted,
          letterSpacing: "-0.005em",
        }}
      >
        General Market
      </div>

      <div
        style={{
          position: "absolute",
          top: 144,
          left: PAD.x,
          fontFamily: FONT.sans,
          fontSize: 18,
          fontWeight: 500,
          letterSpacing: "0.22em",
          textTransform: "uppercase",
          color: COLOR.muted,
        }}
      >
        Market
      </div>

      <div
        style={{
          position: "absolute",
          bottom: 64,
          right: PAD.x,
          fontFamily: FONT.sans,
          fontSize: 20,
          color: COLOR.muted,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        05 / {String(SLIDE_COUNT).padStart(2, "0")}
      </div>

      <div
        style={{
          position: "absolute",
          bottom: 64,
          left: PAD.x,
          fontFamily: FONT.sans,
          fontSize: 14,
          color: COLOR.muted,
          maxWidth: 900,
        }}
      >
        Polymarket + Kalshi cleared $21B/month combined in Q1 2026 across ~2,500 markets. The next 200× of category growth is locked behind correlated-asset architecture. TRM Labs, 2026.
      </div>
    </AbsoluteFill>
  );
};
