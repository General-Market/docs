import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, Easing } from "remotion";
import { FPS, W, H, NAVY, SANS, SANS_TEXT } from "./theme";
import { BrandMark } from "../../components/BrandMark";

// Wall 1 · Technical Overload — one matching engine, asked to run more and more
// order books. 100 books: fine. 10 billion: it melts. The count ratchets ×10 a
// beat, the server farm grows and the heat climbs with it — the "it goes harder
// and harder" escalation, fast, in MarketUniverseScale's dark hero-number style.
// The mechanism is on screen: every market needs its own book running every
// instant, so the load is the COUNT of markets, not the trades. A billion never
// sleep, and the engine can't keep them all alive at once.

// ── the escalation ───────────────────────────────────────────────────────────
// books · status · heat (0..1) · servers-per-side shown (the farm grows). The
// camera pulls back to fit the farm — the self-reframe carries the scale.
type Step = { books: number; status: string; heat: number; side: number };
const STEPS: Step[] = [
  { books: 100, status: "STABLE", heat: 0.02, side: 1 },
  { books: 1_000, status: "STABLE", heat: 0.06, side: 2 },
  { books: 10_000, status: "STABLE", heat: 0.13, side: 3 },
  { books: 100_000, status: "HEATING", heat: 0.30, side: 5 },
  { books: 1_000_000, status: "HOT", heat: 0.47, side: 7 },
  { books: 10_000_000, status: "OVERCLOCKING", heat: 0.65, side: 10 },
  { books: 100_000_000, status: "CRITICAL", heat: 0.82, side: 13 },
  { books: 1_000_000_000, status: "OVERLOAD", heat: 0.93, side: 16 },
  { books: 10_000_000_000, status: "MELTDOWN", heat: 1.0, side: 19 },
];

// Accelerating cadence — each beat lands a touch faster than the last, so it
// builds. grow[k] is the ramp into step k (frames @30fps).
const GROW = [1, 22, 20, 18, 16, 15, 14, 13, 13];
const START: number[] = (() => {
  const out = [0];
  for (let i = 1; i < STEPS.length; i++) out.push(out[i - 1] + GROW[i]);
  return out;
})();
const LAST = STEPS.length - 1;
const MELT_START = START[LAST]; // the meltdown begins as the final count lands
const MELT_LEN = 78;
const DURATION = MELT_START + MELT_LEN;

const PITCH = 220; // world units between server centres
const RACK = 168; // world size of one rack
const FIT_SPAN = 1480; // the farm is framed to about this on-screen width

const clamp01 = (t: number): number => (t < 0 ? 0 : t > 1 ? 1 : t);
const smoother = (t: number): number => {
  const x = clamp01(t);
  return x * x * x * (x * (x * 6 - 15) + 10);
};
const commas = (n: number): string => Math.round(n).toLocaleString("en-US");
const easeOut = (t: number): number => Easing.out(Easing.cubic)(clamp01(t));

// Heat → colour. Cool steel, then green (ok), amber, red, white-hot.
const mix = (a: number[], b: number[], t: number): string =>
  `rgb(${Math.round(a[0] + (b[0] - a[0]) * t)}, ${Math.round(a[1] + (b[1] - a[1]) * t)}, ${Math.round(a[2] + (b[2] - a[2]) * t)})`;
const STEEL = [42, 54, 80];
const GREEN = [31, 184, 119];
const AMBER = [232, 161, 58];
const RED = [242, 86, 107];
const WHITE = [255, 244, 222];
const heatColor = (h: number): string => {
  if (h < 0.16) return mix(STEEL, GREEN, h / 0.16);
  if (h < 0.5) return mix(GREEN, AMBER, (h - 0.16) / 0.34);
  if (h < 0.85) return mix(AMBER, RED, (h - 0.5) / 0.35);
  return mix(RED, WHITE, (h - 0.85) / 0.15);
};

// ── one server rack ───────────────────────────────────────────────────────────
const ServerRack: React.FC<{ x: number; y: number; heat: number; frame: number; seed: number }> = ({
  x,
  y,
  heat,
  frame,
  seed,
}) => {
  const col = heatColor(heat);
  const glow = 0.15 + heat * 0.85;
  const fanSpin = frame * (4 + heat * 46) + seed * 90;
  const flicker = heat > 0.6 ? 0.85 + 0.15 * Math.sin(frame * (heat * 3) + seed) : 1;
  const units = 4;
  return (
    <div style={{ position: "absolute", left: x - RACK / 2, top: y - RACK / 2, width: RACK, height: RACK }}>
      {/* heat glow */}
      <div
        style={{
          position: "absolute",
          inset: -RACK * 0.35,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${col} 0%, transparent 68%)`,
          opacity: glow * 0.6 * flicker,
        }}
      />
      {/* chassis */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: 14,
          background: "linear-gradient(160deg, #11151f 0%, #0b0e16 100%)",
          border: `2px solid ${col}`,
          boxShadow: `0 0 ${(heat * 40).toFixed(0)}px ${col}, inset 0 1px 0 rgba(255,255,255,0.06)`,
          overflow: "hidden",
        }}
      >
        {/* rack-unit slots */}
        {Array.from({ length: units }).map((_, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              left: 14,
              right: 56,
              top: 18 + i * ((RACK - 36) / units),
              height: (RACK - 36) / units - 10,
              borderRadius: 5,
              background: "rgba(255,255,255,0.05)",
              borderLeft: `4px solid ${col}`,
              boxShadow: `inset 0 0 8px ${col}33`,
            }}
          >
            {/* activity LEDs */}
            <div
              style={{
                position: "absolute",
                right: 8,
                top: "50%",
                transform: "translateY(-50%)",
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: col,
                opacity: flicker,
                boxShadow: `0 0 8px ${col}`,
              }}
            />
          </div>
        ))}
        {/* two cooling fans, spinning faster as it heats */}
        {[0, 1].map((i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              right: 14,
              top: 22 + i * (RACK - 64),
              width: 34,
              height: 34,
              borderRadius: "50%",
              border: `2px solid ${col}`,
              transform: `rotate(${fanSpin}deg)`,
            }}
          >
            {[0, 1, 2].map((b) => (
              <div
                key={b}
                style={{
                  position: "absolute",
                  left: "50%",
                  top: "50%",
                  width: 3,
                  height: 15,
                  background: col,
                  transformOrigin: "center top",
                  transform: `translate(-50%,0) rotate(${b * 120}deg)`,
                }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

export const TechnicalOverload: React.FC = () => {
  const frame = useCurrentFrame();

  // active step + ramp into it (mirrors MarketUniverseScale's camera)
  let active = 0;
  for (let i = 0; i < STEPS.length; i++) if (frame >= START[i]) active = i;
  const A = STEPS[active];
  const P = STEPS[active > 0 ? active - 1 : 0];
  const r = smoother((frame - START[active]) / GROW[active]);

  // continuously interpolated state
  const books = Math.round((active > 0 ? P.books : 0) + (A.books - (active > 0 ? P.books : 0)) * r);
  const heat = (active > 0 ? P.heat : 0) + (A.heat - (active > 0 ? P.heat : 0)) * r;
  const sideF = (active > 0 ? P.side : 1) + (A.side - (active > 0 ? P.side : 1)) * r;
  const side = Math.max(1, Math.round(sideF));

  // camera scale fits the current farm — the pull-back is the scale reveal
  const span = side * PITCH;
  const camScale = Math.min(7.2, FIT_SPAN / Math.max(PITCH, span));

  // meltdown timeline
  const melt = clamp01((frame - MELT_START) / MELT_LEN);
  const flare = frame >= MELT_START ? interpolate(frame, [MELT_START + 30, MELT_START + 40, MELT_START + 64], [0, 0.92, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : 0;
  const broken = frame >= MELT_START + 38;

  // screen shake — grows with heat, spikes at the blast
  const shakeAmp = heat * heat * 14 + (frame >= MELT_START + 36 ? interpolate(frame, [MELT_START + 36, MELT_START + 52, MELT_START + 70], [26, 8, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : 0);
  const sx = shakeAmp * Math.sin(frame * 3.1);
  const sy = shakeAmp * Math.cos(frame * 3.7);

  // hero number swells with its own magnitude — 100 reads small, 10B enormous
  const mag = clamp01(Math.log10(Math.max(1, books)) / 10);
  const countSize = 96 * (1 + 0.95 * mag);

  // status word blur-swap
  const tIn = clamp01((frame - START[active]) / 8);
  const statusCol = heatColor(heat);

  const gridCenter = ((side - 1) * PITCH) / 2;
  const tx = W / 2 - gridCenter * camScale + sx;
  const ty = H / 2 - gridCenter * camScale + sy;

  // grid of racks (only the active count), centred on the world origin grid
  const racks: React.ReactNode[] = [];
  if (!broken) {
    for (let row = 0; row < side; row++) {
      for (let c = 0; c < side; c++) {
        const idx = row * side + c;
        racks.push(
          <ServerRack key={idx} x={c * PITCH} y={row * PITCH} heat={heat} frame={frame} seed={idx} />,
        );
      }
    }
  }

  // meltdown shards (white-hot chunks of the farm flying out)
  const shards: React.ReactNode[] = [];
  if (broken) {
    const t = (frame - (MELT_START + 38)) / FPS;
    const N = 70;
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2 + (i % 7);
      const sp = 600 + ((i * 137) % 700);
      const px = W / 2 + Math.cos(a) * sp * t + sx;
      const py = H / 2 + Math.sin(a) * sp * t + 0.5 * 900 * t * t + sy;
      const op = clamp01(1 - t * 1.1);
      const sz = 26 + ((i * 53) % 40);
      if (op <= 0) continue;
      shards.push(
        <div
          key={i}
          style={{
            position: "absolute",
            left: px,
            top: py,
            width: sz,
            height: sz,
            transform: `translate(-50%,-50%) rotate(${(i * 47 + frame * 8).toFixed(0)}deg)`,
            background: i % 3 === 0 ? "#FFF3DE" : heatColor(0.9),
            borderRadius: 4,
            opacity: op,
            boxShadow: "0 0 16px rgba(255,200,120,0.8)",
          }}
        />,
      );
    }
  }

  return (
    <AbsoluteFill style={{ backgroundColor: NAVY, fontFamily: SANS, overflow: "hidden" }}>
      <BrandMark surface="dark" />

      {/* ambient heat wash over the whole frame as it climbs */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(120% 100% at 50% 55%, ${heatColor(heat)}22 0%, transparent 60%)`,
          opacity: heat,
        }}
      />

      {/* the server farm — rides the self-reframing camera */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: 1,
          height: 1,
          transformOrigin: "0 0",
          transform: `translate(${tx.toFixed(2)}px, ${ty.toFixed(2)}px) scale(${camScale.toFixed(4)})`,
        }}
      >
        {racks}
      </div>

      {/* meltdown shards (screen space) */}
      {shards}

      {/* white flare on the blast */}
      {flare > 0 && <AbsoluteFill style={{ background: "#FFF8EE", opacity: flare }} />}

      {/* status word — top, blur-swap, heat-coloured */}
      {!broken && (
        <div style={{ position: "absolute", top: 96, left: 0, right: 0, display: "flex", justifyContent: "center" }}>
          <div
            style={{
              fontFamily: SANS,
              fontSize: 56,
              fontWeight: 800,
              letterSpacing: "2px",
              color: statusCol,
              textShadow: `0 0 40px ${statusCol}`,
              opacity: easeOut(tIn),
              filter: tIn < 1 ? `blur(${(1 - tIn) * 10}px)` : undefined,
              transform: `translateY(${((1 - easeOut(tIn)) * 18).toFixed(1)}px)`,
            }}
          >
            {A.status}
          </div>
        </div>
      )}

      {/* the hero number — swelling with magnitude, bottom band */}
      {!broken && (
        <div style={{ position: "absolute", bottom: 70, left: 0, right: 0, display: "flex", justifyContent: "center", alignItems: "baseline" }}>
          <span
            style={{
              fontVariantNumeric: "tabular-nums",
              fontSize: countSize,
              fontWeight: 800,
              letterSpacing: "-2px",
              color: "#fff",
              textShadow: "0 6px 40px rgba(0,0,0,0.6)",
            }}
          >
            {commas(books)}
          </span>
          <span
            style={{
              fontFamily: SANS_TEXT,
              fontSize: Math.min(64, countSize * 0.42),
              fontWeight: 700,
              color: "rgba(255,255,255,0.6)",
              marginLeft: countSize * 0.16,
            }}
          >
            order books
          </span>
        </div>
      )}

      {/* the verdict, after the blast */}
      {melt > 0.55 && (
        <AbsoluteFill style={{ display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column" }}>
          <div
            style={{
              fontFamily: SANS,
              fontSize: 78,
              fontWeight: 800,
              letterSpacing: "-2px",
              color: "#fff",
              textAlign: "center",
              opacity: interpolate(frame, [MELT_START + 50, MELT_START + 66], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
              transform: `translateY(${interpolate(frame, [MELT_START + 50, MELT_START + 66], [22, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }).toFixed(1)}px)`,
              textShadow: "0 8px 50px rgba(0,0,0,0.7)",
            }}
          >
            One engine can't run
            <br />a billion order books
          </div>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};

export const technicalOverloadMeta = {
  id: "TechnicalOverload",
  component: TechnicalOverload,
  durationInFrames: DURATION,
  fps: FPS,
  width: W,
  height: H,
};
