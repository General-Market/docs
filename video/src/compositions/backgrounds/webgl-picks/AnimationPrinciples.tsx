// "Principles of UI Animation" — eight tiles in a 4x2 grid, each
// demonstrating one principle (easing, parenting, obscuration, parallax,
// dimensionality, transformation, dolly & zoom, masking). Frame-driven port
// of the original CSS demo, sized for 1920x1080.

import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  Easing,
} from "remotion";

const BG_GRADIENT = "linear-gradient(-45deg, #00c6fb 0%, #005bea 100%)";

const easeOut = Easing.bezier(0.0, 0.0, 0.2, 1);
const easeInOut = Easing.bezier(0.42, 0, 0.58, 1);
const obscureCubic = Easing.bezier(0.6, 0, 0.4, 1);

// 1s alternate infinite -> 2s ping-pong: 0 -> 1 (eased) -> 0 (eased).
const pingPong = (t: number, period: number, easing = easeInOut) => {
  const phase = (t % period) / period; // 0..1
  const tri = phase < 0.5 ? phase * 2 : 2 - phase * 2; // 0..1..0
  return easing(tri);
};

// ── Tile shell ───────────────────────────────────────────────────────────

const Tile: React.FC<{ label: string; children: React.ReactNode }> = ({
  label,
  children,
}) => (
  <div
    style={{
      position: "relative",
      width: "100%",
      height: "100%",
      border: "1px solid rgba(255,255,255,0.1)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
    }}
  >
    {children}
    <h4
      style={{
        position: "absolute",
        bottom: 64,
        left: "50%",
        transform: "translateX(-50%)",
        color: "#fff",
        fontFamily: "'Open Sans','SF Pro Display',sans-serif",
        fontWeight: 400,
        fontSize: 26,
        letterSpacing: 1.2,
        margin: 0,
        textAlign: "center",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </h4>
  </div>
);

// ── Tiles ────────────────────────────────────────────────────────────────

// #easing — 2s ease-out, NOT alternate. translateX -120 -> 40 -> 250
// (scaled ~2x: container 400x160, white square 160x160, -240 -> 80 -> 500).
const EasingTile: React.FC<{ t: number }> = ({ t }) => {
  const p = easeOut((t % 2) / 2); // 0..1 eased
  // Mirror the original three-stop curve: 0% -240, 75% 80, 100% 500.
  const x =
    p < 0.75
      ? interpolate(p, [0, 0.75], [-240, 80])
      : interpolate(p, [0.75, 1], [80, 500]);
  return (
    <div
      style={{
        position: "relative",
        width: 400,
        height: 160,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: 160,
          height: 160,
          background: "#fff",
          transform: `translateX(${x}px)`,
        }}
      />
    </div>
  );
};

// #parenting — two 200x80 stacked spans, 20px gap.
// Both slide x: -50 -> 50. Top one ALSO scales 0.1 -> 1 from bottom-center.
const Parenting: React.FC<{ t: number }> = ({ t }) => {
  const p = pingPong(t, 2);
  const x = interpolate(p, [0, 1], [-50, 50]);
  const scale = interpolate(p, [0, 1], [0.1, 1]);
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 20,
      }}
    >
      <div
        style={{
          width: 200,
          height: 80,
          background: "#fff",
          transformOrigin: "50% 100%",
          transform: `translateX(${x}px) scale(${scale})`,
        }}
      />
      <div
        style={{
          width: 200,
          height: 80,
          background: "#fff",
          transform: `translateX(${x}px)`,
        }}
      />
    </div>
  );
};

// #obscuration — base 120x160 card, larger 180x220 scrim slides over.
// Scrim left: -120 -> 60, opacity 0.7, cubic-bezier(0.6, 0, 0.4, 1) alternate.
const Obscuration: React.FC<{ t: number }> = ({ t }) => {
  const p = pingPong(t, 2, obscureCubic);
  const left = interpolate(p, [0, 1], [-120, 60]);
  return (
    <div
      style={{
        position: "relative",
        width: 120,
        height: 160,
        background: "#fff",
        borderRadius: 4,
      }}
    >
      <div
        style={{
          position: "absolute",
          top: "50%",
          left,
          width: 180,
          height: 220,
          marginTop: -110,
          background: "#f7f7f7",
          opacity: 0.7,
        }}
      />
    </div>
  );
};

// #parallax — 320x180 grey container, 240x180 inner translateY -40 -> 40.
const Parallax: React.FC<{ t: number }> = ({ t }) => {
  const p = pingPong(t, 2);
  const y = interpolate(p, [0, 1], [-40, 40]);
  return (
    <div
      style={{
        width: 320,
        height: 180,
        background: "#EAEAEA",
        borderRadius: 4,
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          width: 240,
          height: 180,
          background: "#fff",
          transform: `translateY(${y}px)`,
        }}
      />
    </div>
  );
};

// #dimension — 380x120 white card. Parent has perspective:800. rotateX 0 -> -90.
const Dimensionality: React.FC<{ t: number }> = ({ t }) => {
  const p = pingPong(t, 2);
  const rx = interpolate(p, [0, 1], [0, -90]);
  return (
    <div style={{ perspective: 800 }}>
      <div
        style={{
          width: 380,
          height: 120,
          background: "#fff",
          borderRadius: 4,
          transform: `rotateX(${rx}deg)`,
        }}
      />
    </div>
  );
};

// #transformation — 120x120 circle morphs to 300x120 pill.
const Transformation: React.FC<{ t: number }> = ({ t }) => {
  const p = pingPong(t, 2);
  const w = interpolate(p, [0, 1], [120, 300]);
  const r = interpolate(p, [0, 1], [60, 4]); // 50% of 120 = 60px -> 4px
  return (
    <div
      style={{
        width: w,
        height: 120,
        background: "#fff",
        borderRadius: r,
      }}
    />
  );
};

// #dollyZoom — 130x130 viewport. Inner 300x300 grid of 9 white 80x80 squares,
// 30px gaps. 2s ease-in-out alternate. transform-origin slides 118% 103% -> 50% 50%,
// scale 1 -> 0.412, translate(-50%,-50%) -> (-120%, -122%).
const DollyZoom: React.FC<{ t: number }> = ({ t }) => {
  const p = pingPong(t, 4); // 2s -> 4s ping-pong
  const scale = interpolate(p, [0, 1], [1, 0.412]);
  const tx = interpolate(p, [0, 1], [-50, -120]);
  const ty = interpolate(p, [0, 1], [-50, -122]);
  const ox = interpolate(p, [0, 1], [118, 50]);
  const oy = interpolate(p, [0, 1], [103, 50]);
  return (
    <div
      style={{
        position: "relative",
        width: 130,
        height: 130,
        overflow: "hidden",
        borderRadius: 4,
      }}
    >
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          width: 300,
          height: 300,
          transformOrigin: `${ox}% ${oy}%`,
          transform: `scale(${scale}) translate(${tx}%, ${ty}%)`,
          display: "grid",
          gridTemplateColumns: "repeat(3, 80px)",
          gridTemplateRows: "repeat(3, 80px)",
          gap: 30,
        }}
      >
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} style={{ background: "#fff" }} />
        ))}
      </div>
    </div>
  );
};

// #masking — 300x120 grey container, 60x60 white circle grows to 500x500.
const Masking: React.FC<{ t: number }> = ({ t }) => {
  const p = pingPong(t, 2);
  const size = interpolate(p, [0, 1], [60, 500]);
  return (
    <div
      style={{
        width: 300,
        height: 120,
        background: "#EAEAEA",
        borderRadius: 4,
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          width: size,
          height: size,
          background: "#fff",
          borderRadius: "50%",
        }}
      />
    </div>
  );
};

const TILES: { label: string; render: (t: number) => React.ReactNode }[] = [
  { label: "Easing", render: (t) => <EasingTile t={t} /> },
  { label: "Parenting", render: (t) => <Parenting t={t} /> },
  { label: "Obscuration", render: (t) => <Obscuration t={t} /> },
  { label: "Parallax", render: (t) => <Parallax t={t} /> },
  // Keep the original typo intentionally.
  { label: "Dimentionality", render: (t) => <Dimensionality t={t} /> },
  { label: "Transformation", render: (t) => <Transformation t={t} /> },
  { label: "Dolly & Zoom", render: (t) => <DollyZoom t={t} /> },
  { label: "Masking", render: (t) => <Masking t={t} /> },
];

export const AnimationPrinciples: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const t = frame / fps;

  const fadeIn = interpolate(frame, [0, 20], [0, 1], {
    extrapolateRight: "clamp",
  });
  const fadeOut = interpolate(
    frame,
    [durationInFrames - 20, durationInFrames],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  return (
    <AbsoluteFill
      style={{
        background: BG_GRADIENT,
        opacity: fadeIn * fadeOut,
      }}
    >
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gridTemplateRows: "repeat(2, 1fr)",
        }}
      >
        {TILES.map((tile, i) => (
          <Tile key={i} label={tile.label}>
            {tile.render(t)}
          </Tile>
        ))}
      </div>
    </AbsoluteFill>
  );
};
