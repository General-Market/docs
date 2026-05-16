import React from "react";
import {
  AbsoluteFill,
  Easing,
  OffthreadVideo,
  Sequence,
  interpolate,
  staticFile,
  useCurrentFrame,
} from "remotion";
import { font, monoFont } from "../../common/fonts";
import { FPS, H, W, colors, toFrames } from "./theme";
import { DotGrid, DotGridVignette } from "./DotGrid";
import { IdleZoom } from "./vibe";
import { beatPulseScene } from "./beats";

// Solution = 233f (7.77s). SCENE_STARTS.Solution = 508; interior beats
// land at scene-local 25, 50, 76, 102, 128, 153, 179, 205, 230.
// Wordmark holds through beat 22 (local 76), terminal mounts on beat 23
// (local 102) — gives the headline ~3.4s of stillness, then ~4.4s of
// terminal + CTA. Lines, halo, and CTA all snap to interior beats.
const SCENE_FRAMES = 233;
const SCENE_SECONDS = SCENE_FRAMES / FPS;
const TERMINAL_AT = 102; // beat 23, scene-local

export const AntiCheatSolution: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: colors.bg, fontFamily: font }}>
      <IdleZoom durationInFrames={SCENE_FRAMES} from={1} to={1.04}>
        <DotGrid />

        <Sequence from={0} durationInFrames={WALL_TOTAL}>
          <PhoneWall />
        </Sequence>

        <Headline />

        <Sequence from={TERMINAL_AT}>
          <Terminal />
        </Sequence>

        <PressurizedVignette />
      </IdleZoom>
    </AbsoluteFill>
  );
};

// Vignette breathes with the beat grid. Base sits at 0.18; each beat
// adds up to +0.06. Subtle — feels like the room tightens on the kick.
const PressurizedVignette: React.FC = () => {
  const frame = useCurrentFrame();
  const pulse = beatPulseScene(frame, "Solution", 4, 22);
  return <DotGridVignette intensity={0.18 + pulse * 0.06} />;
};

// ─── Phone wall — 4 columns of 3 flat phones, scrolling, masked safe ────────
//
// Pops in with the headline. Each column scrolls in alternating directions —
// outer columns up, inner columns down — so the eye reads "many feeds, one
// table". Each phone plays the insider-trading broll at a distinct frame
// offset; no two charts sit at the same moment. A blue safety mask washes
// over every phone halfway through, then the column gets sucked into the
// "General is the safe table" zoom as the headline blasts forward.
const BROLL_URL = staticFile("cheat-broll/insider-trading-clean.mp4");
const BROLL_LEN_FRAMES = 200; // source is 206f — keep a safety margin

const PHONE_W = 260;
const PHONE_H = 540;
const STRIDE = 580;
const SCROLL_SPEED = 1.9;
const PHONES_PER_COL = 3;

// 4 columns equally spaced — outer two go up, inner two go down.
const COLS: { x: number; dir: -1 | 1 }[] = [
  { x: 180, dir: -1 },
  { x: 620, dir: +1 },
  { x: 1060, dir: +1 },
  { x: 1500, dir: -1 },
];

const WALL_ENTER = 8;
// Phones exit on the same frame the headline begins its zoom (HOLD_END=76
// in Headline — beat 22, scene-local). Keeps the two motions on the
// same downbeat.
const WALL_HOLD_END = 76;
const WALL_EXIT = 16;
const WALL_TOTAL = WALL_HOLD_END + WALL_EXIT;

const clamp01 = (t: number) => (t < 0 ? 0 : t > 1 ? 1 : t);

const FlatPhone: React.FC<{
  x: number;
  y: number;
  brollStart: number;
  safetyMask: number;
}> = ({ x, y, brollStart, safetyMask }) => {
  const RADIUS = 26;
  const BEZEL = 7;
  const innerW = PHONE_W - BEZEL * 2;
  const innerH = PHONE_H - BEZEL * 2;
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: PHONE_W,
        height: PHONE_H,
        borderRadius: RADIUS,
        background: "#08080c",
        boxShadow:
          "0 24px 48px rgba(10,12,18,0.32), 0 6px 14px rgba(10,12,18,0.22), inset 0 0 0 1px rgba(255,255,255,0.05)",
        overflow: "hidden",
        willChange: "transform",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: BEZEL,
          top: BEZEL,
          width: innerW,
          height: innerH,
          borderRadius: RADIUS - BEZEL,
          overflow: "hidden",
          background: "#000",
        }}
      >
        <OffthreadVideo
          src={BROLL_URL}
          startFrom={brollStart}
          muted
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
        />
        {/* Safety mask: blue tint + faint shield watermark. The mask is the
            visual punctuation of "General is the safe table" — chart action
            stays underneath, protocol washes over it. */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `linear-gradient(180deg, rgba(0,82,255,${(safetyMask * 0.32).toFixed(3)}) 0%, rgba(91,134,255,${(safetyMask * 0.55).toFixed(3)}) 100%)`,
            mixBlendMode: "screen",
            opacity: safetyMask,
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            opacity: safetyMask * 0.55,
            pointerEvents: "none",
          }}
        >
          <ShieldIcon size={Math.round(innerW * 0.5)} glow={safetyMask * 0.6} />
        </div>
      </div>
    </div>
  );
};

const PhoneWall: React.FC = () => {
  const frame = useCurrentFrame();

  const enterT = clamp01(frame / WALL_ENTER);
  const enterEased = 1 - (1 - enterT) * (1 - enterT);

  const exitT = clamp01((frame - WALL_HOLD_END) / WALL_EXIT);
  const exitEased = exitT * exitT;

  const opacity = enterEased * (1 - exitT);
  // As the headline zooms forward, the wall shrinks and dims — as if it's
  // being absorbed by the wordmark blast.
  const wallScale = 1 - exitEased * 0.22;

  // Safety mask sweeps in once the headline has been read. Rises into
  // beat 21 (local 50), holds through beat 22 (HOLD_END), washes out
  // with the wall.
  const safetyMask = interpolate(
    frame,
    [32, 50, WALL_HOLD_END, WALL_HOLD_END + WALL_EXIT],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  return (
    <AbsoluteFill
      style={{
        opacity,
        transform: `scale(${wallScale.toFixed(3)})`,
        transformOrigin: "center center",
        pointerEvents: "none",
      }}
    >
      {COLS.map((col, ci) => {
        const scroll = frame * SCROLL_SPEED * col.dir;
        return (
          <React.Fragment key={ci}>
            {Array.from({ length: PHONES_PER_COL }).map((_, pi) => {
              const baseY = (H - PHONE_H) / 2 + (pi - 1) * STRIDE;
              const y = baseY + scroll;
              const brollStart =
                (ci * 47 + pi * 31 + 11) % BROLL_LEN_FRAMES;
              return (
                <FlatPhone
                  key={pi}
                  x={col.x}
                  y={y}
                  brollStart={brollStart}
                  safetyMask={safetyMask}
                />
              );
            })}
          </React.Fragment>
        );
      })}
    </AbsoluteFill>
  );
};

// ─── Headline: end-screen wordmark — logo on the left, "General" right ──────
// Mirrors the EndCard layout. Soft fade in at the start of the scene, fades
// out into the terminal fly-in at TERMINAL_AT.

const Headline: React.FC = () => {
  const frame = useCurrentFrame();

  // Hold through beats 20, 21, 22 so the wordmark sits still and
  // legible. The blast collapses into beat 23 — bezier surge, then a
  // fast white wash that erases the close-up letterforms before the
  // terminal mounts. Read first, blast last.
  const HOLD_END = 76; // beat 22 — ≈2.5s of stillness
  const ZOOM_END = TERMINAL_AT; // beat 23
  const zoomT = interpolate(frame, [HOLD_END, ZOOM_END], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.7, 0, 0.84, 0.3),
  });

  // Beat-driven halo behind the wordmark. Pulses on every Solution
  // beat (scene-local 25, 50, 76, 102…) — the room behind the brand
  // breathes with the kick. Visible during the held window only;
  // collapses ahead of the surge so the wash reads clean.
  const haloPulse = beatPulseScene(frame, "Solution", 3, 18);
  const haloVis = interpolate(
    frame,
    [0, 8, HOLD_END + 4, ZOOM_END - 12],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const haloAmt = haloPulse * haloVis;
  const haloScale = 0.92 + haloAmt * 0.18 + Math.sin(frame * 0.08) * 0.012;

  // Sub-1% wordmark scale lift on each held beat. Imperceptible alone,
  // but the eye reads it as breathing in time with the halo.
  const wordmarkBeatLift = haloPulse * haloVis * 0.008;
  const scale = interpolate(zoomT, [0, 1], [1, 88]) + wordmarkBeatLift;

  const opacity = interpolate(frame, [0, 6], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Faster wash — 10 frames from start to solid white, riding the back
  // of the surge.
  const wash = interpolate(
    frame,
    [ZOOM_END - 14, ZOOM_END - 4],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  // Wordmark glow lift on the held beats — text-shadow strength tracks
  // the same pulse as the halo.
  const wordmarkGlow = haloAmt;

  return (
    <AbsoluteFill style={{ opacity }}>
      {/* Backdrop scrim — lifts the wordmark off the blue safety-masked phone
          wall so "is the safe table" never blends into the chart tint. Page
          bg color radiating from center, heavily feathered. */}
      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            position: "absolute",
            width: 1760,
            height: 920,
            background:
              "radial-gradient(ellipse at center, rgba(240,242,244,0.95) 0%, rgba(240,242,244,0.86) 26%, rgba(240,242,244,0.55) 52%, rgba(240,242,244,0.18) 72%, rgba(240,242,244,0) 86%)",
            filter: "blur(36px)",
          }}
        />
      </AbsoluteFill>
      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            position: "absolute",
            width: 1500,
            height: 760,
            transform: `scale(${haloScale.toFixed(3)})`,
            transformOrigin: "center center",
            background: `radial-gradient(ellipse at center, rgba(0,82,255,${(0.45 * haloAmt + 0.04).toFixed(3)}) 0%, rgba(0,82,255,${(0.18 * haloAmt + 0.02).toFixed(3)}) 32%, rgba(0,82,255,0) 68%)`,
            filter: "blur(80px)",
            mixBlendMode: "multiply",
          }}
        />
      </AbsoluteFill>
      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          textAlign: "center",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 14,
            padding: "60px 90px",
            background: "transparent",
            transform: `scale(${scale})`,
            transformOrigin: "center center",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 26 }}>
            <img
              src={staticFile("gm-mark.svg")}
              alt=""
              style={{
                width: 130,
                height: 130,
                flexShrink: 0,
                filter: `drop-shadow(0 8px ${(28 + wordmarkGlow * 14).toFixed(2)}px rgba(0, 82, 255, ${(0.30 + wordmarkGlow * 0.25).toFixed(3)}))`,
              }}
            />
            <span
              style={{
                fontFamily: font,
                fontSize: 140,
                fontWeight: 800,
                letterSpacing: "-0.05em",
                color: colors.fg,
                lineHeight: 0.95,
                textShadow: `0 8px ${(28 + wordmarkGlow * 14).toFixed(2)}px rgba(0, 82, 255, ${(0.30 + wordmarkGlow * 0.25).toFixed(3)})`,
              }}
            >
              General
            </span>
          </div>
          <span
            style={{
              fontFamily: font,
              fontSize: 140,
              fontWeight: 800,
              letterSpacing: "-0.05em",
              color: colors.accent,
              lineHeight: 0.95,
              textShadow: `0 0 ${(18 + wordmarkGlow * 10).toFixed(2)}px rgba(255,255,255,${(0.85 + wordmarkGlow * 0.10).toFixed(3)}), 0 0 6px rgba(255,255,255,0.95), 0 4px 14px rgba(10,10,12,0.22)`,
            }}
          >
            is the safe table
          </span>
        </div>
      </AbsoluteFill>
      <AbsoluteFill
        style={{ background: "#FFFFFF", opacity: wash, pointerEvents: "none" }}
      />
    </AbsoluteFill>
  );
};

// ─── Terminal panel — types out the prompt + response ─────────────────────────

const TERMINAL_LINES: { text: string; color: string; mode: "cmd" | "user" | "ok" }[] = [
  { text: "$ claude", color: "#9aa0a6", mode: "cmd" },
  { text: "> upgrade my bot to block-trading", color: "#f1f3f5", mode: "user" },
  { text: "anti-cheat", color: "#5B86FF", mode: "ok" },
];

const ShieldIcon: React.FC<{ size: number; glow: number }> = ({ size, glow }) => (
  <svg
    width={size}
    height={size * 1.14}
    viewBox="0 0 24 28"
    style={{
      flexShrink: 0,
      filter: `drop-shadow(0 0 ${4 + glow * 18}px rgba(91,134,255,${0.55 + glow * 0.4}))`,
    }}
  >
    <path
      d="M12 1.4 L22 5 L22 13 C22 19 17.4 24.8 12 26.6 C6.6 24.8 2 19 2 13 L2 5 Z"
      fill="#5B86FF"
    />
    <path
      d="M7.6 13.4 L10.8 16.6 L16.8 9.6"
      stroke="#0b0b10"
      strokeWidth={2.6}
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const Terminal: React.FC = () => {
  const frame = useCurrentFrame();

  // 3D entrance ported from GMBrand Scene03 SegDesktopUI (the desktop UI
  // fly-in that lands at 0:18). Tilted-and-zoomed → flat over 95 frames.
  const ENTRANCE_KEYS = [0, 10, 20, 35, 50, 65, 80, 95];
  const panelRotY = interpolate(
    frame,
    ENTRANCE_KEYS,
    [-22, -18, -14, -10, -7, -4, -2, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const panelRotX = interpolate(
    frame,
    ENTRANCE_KEYS,
    [8, 6.5, 5, 4, 3, 2, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const panelScale = interpolate(
    frame,
    ENTRANCE_KEYS,
    [2.3, 2.0, 1.7, 1.4, 1.2, 1.1, 1.03, 1.0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const panelOpacity = interpolate(frame, [0, 3], [0, 1], {
    extrapolateRight: "clamp",
  });

  // Lines paced so each typewriter event lands on a beat. Terminal
  // mounts at scene-local 102 (beat 23); delays are terminal-local.
  // Beat 24 lands at terminal-local 26, beat 25 at 51, beat 26 at 77,
  // beat 27 at 103.
  //
  // Line 0 ("$ claude", ~10f to type): starts beat 23, finishes ~10.
  // Line 1 ("> upgrade…", ~39f to type): starts terminal 12, finishes
  //   terminal 51 = beat 25 exactly.
  // Line 2 ("anti-cheat", ~12f to type): starts terminal 65, finishes
  //   terminal 77 = beat 26 — that's the "shielded" punch.
  const LINE_DELAYS = [0, 12, 65];
  const CHARS_PER_FRAME = 0.85;

  // Frame at which the absolute scene-frame "✓ shielded" finishes typing.
  const shieldedTypeFrames = Math.ceil(
    TERMINAL_LINES[2].text.length / CHARS_PER_FRAME,
  );
  const shieldedCompleteAt = LINE_DELAYS[2] + shieldedTypeFrames;
  const sinceShieldedDone = Math.max(0, frame - shieldedCompleteAt);

  // Punch curve: scale snaps up then settles back.
  const punch = interpolate(
    sinceShieldedDone,
    [0, 4, 12, 26],
    [0, 0.22, 0.04, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  // Sustained breathing glow after the punch.
  const glowSustain = interpolate(
    sinceShieldedDone,
    [0, 8, 20],
    [0, 1, 0.55],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const glow = Math.max(punch * 1.6, glowSustain);

  // CTA: per-char reveal, last letter first, working back to the first.
  // Each char slides in from off-screen left (-1920px) and fades over 4f.
  // Wrap allowed so the line stays on two lines.
  //
  // Per-letter cadence is pulled toward the nearest interior beat
  // (terminal-local 77 = beat 26, terminal-local 103 = beat 27).
  // Letters whose linear position lands near a beat snap onto it; the
  // cascade lurches forward on each kick, hesitates between. Pull
  // factor controls how musical vs. metronomic it reads.
  const CTA_TEXT = "Shield your PnL from bad actors";
  const CTA_START = 73; // Terminal-local — first char lands ahead of beat 26
  const CTA_REVEAL = 30;
  const CTA_BEATS_LOCAL = [77, 103] as const;
  const CTA_BEAT_PULL = 0.78;
  const ctaBeatPull = (f: number): number => {
    let nearest: number = CTA_BEATS_LOCAL[0];
    let bestDist = Math.abs(f - nearest);
    for (const b of CTA_BEATS_LOCAL) {
      const d = Math.abs(f - b);
      if (d < bestDist) {
        nearest = b;
        bestDist = d;
      }
    }
    return f + (nearest - f) * CTA_BEAT_PULL;
  };

  // Exit punch on beat 27 (terminal-local 103). Brief scale lift on
  // the whole terminal as the CTA finishes — sells the cut into
  // Reassure.
  const EXIT_BEAT = 103;
  const exitPunch = interpolate(
    frame,
    [EXIT_BEAT - 4, EXIT_BEAT, EXIT_BEAT + 8, EXIT_BEAT + 22],
    [0, 1, 0.25, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const exitScale = 1 + exitPunch * 0.018;

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        padding: "0 96px",
        flexDirection: "column",
        gap: 56,
      }}
    >
      <div
        style={{
          width: "min(1200px, 90%)",
          perspective: 1400,
          opacity: panelOpacity,
        }}
      >
      <div
        style={{
          background: "linear-gradient(180deg, #0d0d10 0%, #050507 100%)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 8,
          transformStyle: "preserve-3d",
          transform: `rotateY(${panelRotY}deg) rotateX(${panelRotX}deg) scale(${(panelScale * exitScale).toFixed(4)})`,
          transformOrigin: "50% 50%",
          boxShadow:
            "0 0 0 1px rgba(10,12,18,0.10), 0 24px 56px rgba(10,12,18,0.20)",
        }}
      >
        {/* Window chrome */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "14px 18px",
            borderBottom: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <Dot color="#ff5f57" />
          <Dot color="#febc2e" />
          <Dot color="#28c840" />
          <span
            style={{
              marginLeft: 18,
              fontFamily: monoFont,
              fontSize: 24,
              color: "#9aa0a6",
              letterSpacing: "0.08em",
            }}
          >
            ~/bot — claude
          </span>
        </div>

        <div
          style={{
            padding: "36px 44px 40px",
            fontFamily: monoFont,
            fontSize: 50,
            lineHeight: 1.5,
            display: "flex",
            flexDirection: "column",
            gap: 8,
            minHeight: 400,
          }}
        >
          {TERMINAL_LINES.map((line, i) => {
            const start = LINE_DELAYS[i];
            const localFrame = Math.max(0, frame - start);
            const visibleChars = Math.min(
              line.text.length,
              Math.floor(localFrame * CHARS_PER_FRAME),
            );
            const shown = line.text.slice(0, visibleChars);
            const isActive = frame >= start;
            const isComplete = visibleChars >= line.text.length;
            const showCursor = isActive && !isComplete;
            const isShielded = line.mode === "ok";

            // Each line completes on a beat. Sample a tight flare
            // window after completion: 0→peak in 2f, decay over 14f.
            // The shielded line already has its own punch+glow stack;
            // the flare is for the other two lines.
            const completionFrame =
              start + Math.ceil(line.text.length / CHARS_PER_FRAME);
            const sinceLineDone = Math.max(0, frame - completionFrame);
            const flare = interpolate(
              sinceLineDone,
              [0, 2, 16],
              [0, 1, 0],
              { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
            );

            const lineScale = isShielded ? 1 + punch : 1 + flare * 0.012;
            const shieldGlow = isShielded ? glow : 0;

            // Non-shielded lines get a +1px text-shadow flare on
            // completion; shielded keeps its richer blue glow.
            const baseShadow =
              isShielded && isComplete
                ? `0 0 ${22 + shieldGlow * 44}px rgba(91,134,255,${0.45 + shieldGlow * 0.35})`
                : flare > 0.01
                  ? `0 0 ${(1 + flare * 6).toFixed(2)}px rgba(241,243,245,${(0.55 * flare).toFixed(3)})`
                  : undefined;

            return (
              <div
                key={i}
                style={{
                  color: line.color,
                  fontWeight: line.mode === "ok" ? 700 : 500,
                  opacity: isActive ? 1 : 0.0,
                  whiteSpace: "pre",
                  display: "flex",
                  alignItems: "center",
                  gap: isShielded ? 18 : 0,
                  minHeight: "1.5em",
                  transform: `scale(${lineScale})`,
                  transformOrigin: "left center",
                  textShadow: baseShadow,
                }}
              >
                {isShielded && isActive ? (
                  <ShieldIcon size={48} glow={shieldGlow} />
                ) : null}
                <span style={{ whiteSpace: "pre" }}>
                  {shown}
                  {showCursor && <Cursor />}
                </span>
              </div>
            );
          })}
        </div>
      </div>
      </div>

      <div
        style={{
          width: "min(1500px, 92%)",
          textAlign: "center",
          fontFamily: font,
          fontSize: 120,
          letterSpacing: "-0.025em",
          lineHeight: 1.08,
        }}
      >
        {CTA_TEXT.split(" ").map((word, wi, words) => {
          const wordStart = words
            .slice(0, wi)
            .reduce((n, w) => n + w.length + 1, 0);
          return (
            <React.Fragment key={wi}>
              <span style={{ display: "inline-block", whiteSpace: "nowrap" }}>
                {word.split("").map((ch, ci) => {
                  const i = wordStart + ci;
                  const order = CTA_TEXT.length - 1 - i;
                  const linearStart =
                    CTA_START +
                    CTA_REVEAL * Math.sqrt(order / CTA_TEXT.length);
                  const startFrame = ctaBeatPull(linearStart);
                  const local = frame - startFrame;
                  const op = Math.max(0, Math.min(1, local / 4));
                  const x = (1 - op) * -1920;
                  const isShield = i < 6;
                  return (
                    <span
                      key={ci}
                      style={{
                        display: "inline-block",
                        opacity: op,
                        transform: `translateX(${x}px)`,
                        color: isShield ? colors.accent : colors.fg,
                        fontWeight: isShield ? 800 : 700,
                      }}
                    >
                      {ch}
                    </span>
                  );
                })}
              </span>
              {wi < words.length - 1 ? " " : null}
            </React.Fragment>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

// Cursor blinks on half-beats (≈13f). Terminal mounts on beat 23, so
// terminal-local frame phase aligns with the beat grid — the toggle
// hits beats and half-beats cleanly.
const Cursor: React.FC = () => {
  const frame = useCurrentFrame();
  const blink = Math.floor(frame / 13) % 2 === 0;
  return (
    <span
      style={{
        display: "inline-block",
        width: "0.55em",
        marginLeft: 2,
        background: "#f1f3f5",
        opacity: blink ? 0.85 : 0.0,
        height: "1em",
        verticalAlign: "-0.18em",
      }}
    />
  );
};

const Dot: React.FC<{ color: string }> = ({ color }) => (
  <span
    style={{
      display: "inline-block",
      width: 12,
      height: 12,
      borderRadius: 6,
      background: color,
      opacity: 0.85,
    }}
  />
);

export const antiCheatSolutionMeta = {
  id: "AntiCheatSolution",
  component: AntiCheatSolution,
  durationInFrames: toFrames(SCENE_SECONDS),
  fps: FPS,
  width: W,
  height: H,
};
