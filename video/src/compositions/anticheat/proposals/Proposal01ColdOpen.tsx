import React from "react";
import { AbsoluteFill, Img, staticFile, useCurrentFrame } from "remotion";
import { font, monoFont } from "../../../common/fonts";
import { FPS, H, W } from "../theme";

// Cold Open — anamorphic letterbox, serif italic title, mono lower-thirds.
// The iceberg is treated as cinema: slow dolly push, snow particulate,
// cold colour grade, atmospheric haze. Title floats in the sky, the
// iceberg owns the lower half. Carousel and counter sleep until T2.

const SCENE_FRAMES = 90;
const BAR_H = Math.round(H * 0.115);

const IMG_NATIVE_W = 1265;
const IMG_NATIVE_H = 1670;
const FILL_SCALE = W / IMG_NATIVE_W; // 1.518

// Seeded random for stable particulate
const seeded = (i: number, m = 233280) => ((i * 9301 + 49297) % m) / m;

type Flake = { x: number; y: number; size: number; speed: number; drift: number };

const SNOW: Flake[] = Array.from({ length: 70 }, (_, i) => ({
  x: seeded(i + 11) * W,
  y: seeded(i + 200) * H * 1.4 - H * 0.2,
  size: 1.2 + seeded(i + 300) * 2.4,
  speed: 0.25 + seeded(i + 400) * 0.55,
  drift: 0.4 + seeded(i + 500) * 0.8,
}));

export const Proposal01ColdOpen: React.FC = () => {
  const frame = useCurrentFrame();

  // Hold the steady-state look from frame 0 so scrubbing to the start
  // still shows the design. Animation reserved for in-context use.
  const intro = 1;
  const barIn = BAR_H;
  const kickerA = 1;
  const ledeA = 1;
  const wordA = 1;
  const wordY = 0;
  const lowerA = 1;

  // Slow dolly push-in + slight horizontal drift — handheld documentary feel.
  const dollyT = frame / SCENE_FRAMES;
  const dollyScale = 1.0 + dollyT * 0.06;
  const dollyX = dollyT * -18; // drift left
  const dollyY = dollyT * 10; // slight downward

  return (
    <AbsoluteFill style={{ backgroundColor: "#04111e", fontFamily: font }}>
      {/* Cold-graded iceberg, full bleed. Image positioned so the sky
          fills the top half and the iceberg tip + body sit in the lower
          half. */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: -36 + dollyY,
          width: IMG_NATIVE_W * FILL_SCALE,
          height: IMG_NATIVE_H * FILL_SCALE,
          transform: `translate(calc(-50% + ${dollyX.toFixed(2)}px), 0) scale(${dollyScale.toFixed(4)})`,
          transformOrigin: "center top",
          filter:
            "saturate(0.78) brightness(0.92) contrast(1.06) hue-rotate(-6deg)",
          opacity: intro,
        }}
      >
        <Img
          src={staticFile("iceberg-tiers-clean.webp")}
          style={{
            width: IMG_NATIVE_W * FILL_SCALE,
            height: IMG_NATIVE_H * FILL_SCALE,
            display: "block",
          }}
        />
      </div>

      {/* Cold blue colour wash — pulls the warmth out, deepens shadows */}
      <AbsoluteFill
        style={{
          background:
            "linear-gradient(180deg, rgba(8,18,38,0.28) 0%, rgba(8,18,38,0) 28%, rgba(2,8,18,0.0) 60%, rgba(2,8,18,0.55) 100%)",
          pointerEvents: "none",
        }}
      />

      {/* Atmospheric haze sitting on the horizon line */}
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(140% 14% at 50% 56%, rgba(200,220,240,0.32) 0%, rgba(200,220,240,0) 70%)",
          pointerEvents: "none",
        }}
      />

      {/* Vignette */}
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(110% 70% at 50% 48%, rgba(0,0,0,0) 0%, rgba(0,0,0,0.55) 100%)",
          pointerEvents: "none",
        }}
      />

      {/* Snow particulate, drifting */}
      <AbsoluteFill style={{ pointerEvents: "none", opacity: 0.65 }}>
        {SNOW.map((f, i) => {
          const t = frame * f.speed;
          const y = ((f.y + t) % (H + 60)) - 30;
          const x = f.x + Math.sin((t + f.x) / 60) * f.drift * 18;
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: x,
                top: y,
                width: f.size,
                height: f.size,
                borderRadius: "50%",
                background: "rgba(245,250,255,0.85)",
                boxShadow: "0 0 4px rgba(220,235,250,0.4)",
              }}
            />
          );
        })}
      </AbsoluteFill>

      {/* Film grain */}
      <AbsoluteFill
        style={{
          backgroundImage:
            "radial-gradient(circle, rgba(255,255,255,0.05) 1px, transparent 1px)",
          backgroundSize: "3px 3px",
          mixBlendMode: "overlay",
          opacity: 0.45,
          pointerEvents: "none",
        }}
      />

      {/* Letterbox bars */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: barIn,
          background: "#000",
          zIndex: 5,
          boxShadow: "0 6px 16px rgba(0,0,0,0.4)",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: barIn,
          background: "#000",
          zIndex: 5,
          boxShadow: "0 -6px 16px rgba(0,0,0,0.4)",
        }}
      />

      {/* Title block — lives in the sky region (upper third), aligned left */}
      <div
        style={{
          position: "absolute",
          left: 88,
          top: BAR_H + 64,
          maxWidth: 980,
          opacity: intro,
          zIndex: 7,
        }}
      >
        <div
          style={{
            fontFamily: monoFont,
            fontSize: 20,
            letterSpacing: "0.42em",
            color: "rgba(255,255,255,0.74)",
            textTransform: "uppercase",
            marginBottom: 26,
            opacity: kickerA,
            transform: `translateY(${(1 - kickerA) * 8}px)`,
            textShadow: "0 1px 8px rgba(0,0,0,0.55)",
          }}
        >
          Reason 01 <span style={{ opacity: 0.55 }}>/ 06</span>
        </div>

        <div
          style={{
            fontFamily: font,
            fontSize: 34,
            fontWeight: 400,
            color: "rgba(255,255,255,0.86)",
            letterSpacing: "-0.008em",
            marginBottom: 18,
            opacity: ledeA,
            transform: `translateY(${(1 - ledeA) * 6}px)`,
            textShadow: "0 2px 14px rgba(0,0,0,0.55)",
          }}
        >
          I lost because of
        </div>

        <div
          style={{
            fontFamily: '"Times New Roman", "EB Garamond", Georgia, serif',
            fontStyle: "italic",
            fontSize: 240,
            fontWeight: 400,
            color: "#fff",
            letterSpacing: "-0.018em",
            lineHeight: 0.9,
            opacity: wordA,
            transform: `translateY(${wordY.toFixed(1)}px)`,
            textShadow:
              "0 10px 70px rgba(0,16,40,0.78), 0 2px 22px rgba(0,0,0,0.6)",
          }}
        >
          strategy
        </div>
      </div>

      {/* Lower-third left — documentary slug */}
      <div
        style={{
          position: "absolute",
          left: 88,
          bottom: barIn + 30,
          zIndex: 7,
          fontFamily: monoFont,
          fontSize: 18,
          letterSpacing: "0.28em",
          color: "rgba(255,255,255,0.72)",
          textTransform: "uppercase",
          opacity: lowerA,
          transform: `translateY(${(1 - lowerA) * 6}px)`,
          textShadow: "0 1px 8px rgba(0,0,0,0.6)",
        }}
      >
        <span
          style={{
            display: "inline-block",
            width: 8,
            height: 8,
            background: "#ff3b30",
            borderRadius: 4,
            marginRight: 14,
            verticalAlign: 1,
            boxShadow: "0 0 14px rgba(255,59,48,0.7)",
          }}
        />
        <span style={{ color: "#fff", fontWeight: 500 }}>Sea level</span>
        &nbsp;&nbsp;·&nbsp;&nbsp;71° S, Scotia Sea
      </div>

      {/* Right meta — tiny dignified counter */}
      <div
        style={{
          position: "absolute",
          right: 88,
          bottom: barIn + 22,
          zIndex: 7,
          fontFamily: monoFont,
          textAlign: "right",
          color: "rgba(255,255,255,0.72)",
          opacity: lowerA,
          transform: `translateY(${(1 - lowerA) * 6}px)`,
        }}
      >
        <div
          style={{
            fontFamily: font,
            fontSize: 34,
            fontWeight: 500,
            letterSpacing: "-0.012em",
            color: "#fff",
            marginBottom: 4,
            textShadow: "0 1px 10px rgba(0,0,0,0.55)",
          }}
        >
          $0
        </div>
        <div
          style={{
            fontSize: 13,
            letterSpacing: "0.3em",
            textTransform: "uppercase",
            textShadow: "0 1px 6px rgba(0,0,0,0.55)",
          }}
        >
          taken from retail
        </div>
      </div>

      {/* Tier ladder — bottom centre, six dots */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          transform: "translateX(-50%)",
          bottom: barIn + 38,
          zIndex: 7,
          display: "flex",
          gap: 10,
          alignItems: "center",
          opacity: lowerA,
        }}
      >
        {Array.from({ length: 6 }).map((_, i) => (
          <span
            key={i}
            style={{
              width: i === 0 ? 26 : 10,
              height: 10,
              borderRadius: 10,
              background:
                i === 0 ? "#fff" : "rgba(255,255,255,0.32)",
              boxShadow: i === 0 ? "0 0 14px rgba(255,255,255,0.5)" : "none",
            }}
          />
        ))}
      </div>
    </AbsoluteFill>
  );
};

export const proposal01ColdOpenMeta = {
  id: "Proposal01-ColdOpen",
  component: Proposal01ColdOpen,
  durationInFrames: SCENE_FRAMES,
  fps: FPS,
  width: W,
  height: H,
};
