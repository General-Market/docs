import React from "react";
import {
  AbsoluteFill,
  Audio,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { FPS } from "../theme";
import { COLOR, TYPE, PANEL } from "../designTokens";

const sec = (s: number) => Math.round(s * FPS);
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

// ---------------------------------------------------------------------------
// Source card data
// ---------------------------------------------------------------------------

interface SourceSpec {
  name: string;
  logoText: string;
  brandColor: string;
  category: string;
  markets: number;
  type: string;
  description: string;
  /** Absolute video time this card appears */
  enterAt: number;
}

const SOURCES: SourceSpec[] = [
  {
    name: "Deutsche Bahn",
    logoText: "DB",
    brandColor: "#EC0016",
    category: "TRANSPORT",
    markets: 30,
    type: "Delay",
    description: "German rail delay markets",
    enterAt: 255.36,
  },
  {
    name: "Twitch",
    logoText: "twitch",
    brandColor: "#9146FF",
    category: "STREAMING",
    markets: 5000,
    type: "Viewers",
    description: "Live viewer count markets",
    enterAt: 256.88,
  },
  {
    name: "Steam",
    logoText: "STEAM",
    brandColor: "#1B2838",
    category: "GAMING",
    markets: 500,
    type: "Players",
    description: "Concurrent player markets",
    enterAt: 258.24,
  },
  {
    name: "Pump.fun",
    logoText: "pump.fun",
    brandColor: "#FF6B35",
    category: "CRYPTO",
    markets: 3000000,
    type: "Price",
    description: "Memecoin price markets",
    enterAt: 259.44,
  },
];

// Overlay window (absolute video time)
const OVERLAY_START = 253.92;
const OVERLAY_END = 264.88;

// ---------------------------------------------------------------------------
// Live dot — green ping animation (CSS keyframes in Remotion via frame math)
// ---------------------------------------------------------------------------

const LiveDot: React.FC<{ frame: number }> = ({ frame }) => {
  const color = COLOR.wiseGreen;
  // Ping expands and fades in a ~1s cycle
  const cycle = (frame % 30) / 30;
  const pingScale = 1 + cycle * 1.5;
  const pingOpacity = 0.6 * (1 - cycle);

  return (
    <span
      style={{
        position: "relative",
        display: "inline-flex",
        width: 8,
        height: 8,
      }}
    >
      <span
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "50%",
          backgroundColor: color,
          opacity: pingOpacity,
          transform: `scale(${pingScale})`,
        }}
      />
      <span
        style={{
          position: "relative",
          display: "inline-flex",
          width: 8,
          height: 8,
          borderRadius: "50%",
          backgroundColor: color,
        }}
      />
    </span>
  );
};

// ---------------------------------------------------------------------------
// Single SourceCard — replicates frontend SourceCard.tsx
// ---------------------------------------------------------------------------

const SourceCard: React.FC<{
  spec: SourceSpec;
  localEnterFrame: number;
}> = ({ spec, localEnterFrame }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const elapsed = frame - localEnterFrame;

  // Spring entrance: scale 0.85 -> 1
  const scaleSpring = spring({
    frame: Math.max(elapsed, 0),
    fps,
    config: { damping: 14, stiffness: 120, mass: 0.7 },
  });
  const scale = interpolate(scaleSpring, [0, 1], [0.85, 1], clamp);

  // Opacity fade in
  const opacity = interpolate(elapsed, [0, 8], [0, 1], clamp);

  // Exit fade — last 1.5s of overlay window (absolute frames)
  const exitFrame = sec(OVERLAY_END);
  const exitOpacity = interpolate(
    frame,
    [exitFrame - sec(1.5), exitFrame],
    [1, 0],
    clamp,
  );

  // Text color on brand hero — light text unless bg is very light
  const heroTextColor = hexLuminance(spec.brandColor) > 180 ? COLOR.nearBlack : COLOR.white;

  return (
    <div
      style={{
        width: 400,
        background: COLOR.bg,
        border: `1px solid ${COLOR.border}`,
        borderRadius: 12,
        overflow: "hidden",
        opacity: Math.min(opacity, exitOpacity),
        transform: `scale(${scale})`,
        boxShadow: PANEL.white.boxShadow,
      }}
    >
      {/* Brand hero area — aspect ~16:10 */}
      <div
        style={{
          position: "relative",
          width: 400,
          height: 250,
          backgroundColor: spec.brandColor,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* Logo text */}
        <span
          style={{
            fontFamily: TYPE.displayHero.fontFamily,
            fontSize: spec.logoText.length > 5 ? 48 : 72,
            fontWeight: 900,
            color: heroTextColor,
            letterSpacing: spec.logoText === "DB" ? 4 : -1,
            textTransform: spec.logoText === spec.logoText.toLowerCase() ? "none" : "uppercase",
          }}
        >
          {spec.logoText}
        </span>

        {/* Category badge — glass pill, top-right */}
        <span
          style={{
            position: "absolute",
            top: 12,
            right: 12,
            ...TYPE.small,
            color: COLOR.darkGreen,
            background: COLOR.wiseGreen,
            padding: "3px 10px",
            borderRadius: 999,
          }}
        >
          {spec.category}
        </span>
      </div>

      {/* Card content */}
      <div style={{ padding: "14px 20px 0" }}>
        {/* Name + Live dot row */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: 4,
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                ...TYPE.cardTitle,
                lineHeight: 1.2,
              }}
            >
              {spec.name}
            </div>
            <div
              style={{
                ...TYPE.caption,
                marginTop: 3,
              }}
            >
              {spec.description}
            </div>
          </div>

          {/* Live status */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              flexShrink: 0,
              marginTop: 2,
            }}
          >
            <LiveDot frame={frame} />
            <span
              style={{
                ...TYPE.label,
                color: COLOR.wiseGreen,
              }}
            >
              Live
            </span>
          </div>
        </div>

        {/* Metrics row — 2 columns with border-top */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            borderTop: `1px solid ${COLOR.border}`,
            borderBottom: `1px solid ${COLOR.border}`,
            margin: "10px -20px 0",
            padding: "0 20px",
          }}
        >
          {/* Markets */}
          <div style={{ padding: "10px 12px 10px 0" }}>
            <div
              style={{
                ...TYPE.label,
                marginBottom: 3,
              }}
            >
              Markets
            </div>
            <span
              style={{
                ...TYPE.bodySemibold,
                fontWeight: 700,
              }}
            >
              {spec.markets.toLocaleString()}
            </span>
          </div>

          {/* Type */}
          <div
            style={{
              padding: "10px 0 10px 12px",
              borderLeft: `1px solid ${COLOR.border}`,
            }}
          >
            <div
              style={{
                ...TYPE.label,
                marginBottom: 3,
              }}
            >
              Type
            </div>
            <span
              style={{
                ...TYPE.body,
                fontWeight: 700,
              }}
            >
              {spec.type}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Luminance helper (matching frontend)
// ---------------------------------------------------------------------------

function hexLuminance(hex: string): number {
  const h = hex.replace("#", "");
  if (h.length !== 6) return 128;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return r * 0.299 + g * 0.587 + b * 0.114;
}

// ---------------------------------------------------------------------------
// Main overlay — full-duration, manages absolute timing
// ---------------------------------------------------------------------------

export const SourceCardOverlays: React.FC = () => {
  const frame = useCurrentFrame();

  // Local frame relative to overlay start
  const localFrame = frame - sec(OVERLAY_START);

  // Only render during the active window
  if (localFrame < 0 || localFrame > sec(OVERLAY_END - OVERLAY_START)) {
    return null;
  }

  return (
    <AbsoluteFill>
      {/* SFX on first card entrance */}
      <Sequence from={sec(SOURCES[0].enterAt)} durationInFrames={sec(3)}>
        <Audio
          src={staticFile("sfx/text-pop-rapid-sequence.mp3")}
          volume={0.55}
        />
      </Sequence>

      {/* 2x2 grid of cards */}
      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "400px 400px",
            gap: 24,
          }}
        >
          {SOURCES.map((src) => (
            <SourceCard
              key={src.name}
              spec={src}
              localEnterFrame={sec(src.enterAt)}
            />
          ))}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
