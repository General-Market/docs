import React from "react";
import {
  AbsoluteFill,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { font } from "../../common/fonts";
import { AntiCheatHookScene } from "./AntiCheatHookScene";
import { FPS, H, W, colors } from "./theme";

const BROLL = {
  // minecraft-killaura-clean has the opening + disclaimer strip removed
  // via ffmpeg; the original mp4 bakes a yellow "I am NOT sponsored"
  // banner across the bottom that no CSS overlay can hide once the
  // texture is wrapped onto the laptop screen mesh.
  minecraft: staticFile("cheat-broll/minecraft-killaura-clean.mp4"),
  cs2: staticFile("cheat-broll/cs2-spinbot.mp4"),
  valorant: staticFile("cheat-broll/valorant-wallhack.mp4"),
};

// Cycle order: spinbot → wallhack → kill aura. Beat boundaries inherit
// the original cuts (frames 69 and 146).
const LAPTOP_CLIP_CUTS = { mid: 69, late: 146 } as const;

// CS:GO source has a long lead-in before the spinbot becomes visible.
// Skip the first 1.5s of the file so frame 0 already shows the cheat
// in action.
const LAPTOP_CS2_START_FROM = 45;

export type BrollSegment = {
  url: string;
  from: number; // composition frame at which this segment owns the screen
  durationInFrames: number;
  startFrom: number; // skip this many frames at the head of the source
};

const LAPTOP_SEGMENTS: BrollSegment[] = [
  {
    url: BROLL.cs2,
    from: 0,
    durationInFrames: LAPTOP_CLIP_CUTS.mid,
    startFrom: LAPTOP_CS2_START_FROM,
  },
  {
    url: BROLL.valorant,
    from: LAPTOP_CLIP_CUTS.mid,
    durationInFrames: LAPTOP_CLIP_CUTS.late - LAPTOP_CLIP_CUTS.mid,
    startFrom: 0,
  },
  {
    url: BROLL.minecraft,
    from: LAPTOP_CLIP_CUTS.late,
    durationInFrames: 254 - LAPTOP_CLIP_CUTS.late,
    startFrom: 0,
  },
];

const PAIRS = [
  { game: "Spin-bots", trade: "Insider traders" },
  { game: "Wall-hackers", trade: "Front-runners" },
  { game: "Kill aura", trade: "Order-flow buyers" },
] as const;

// Beat grid (frames) — snapped to VIDEO_BEATS (Hook scene-local: 3, 29,
// 54, 80, 106, 132, 157, 183, 209, 235). Every reveal now lands on a
// kick instead of drifting 11–14f off it.
//   29  — header in (was 17, +12 to beat 1)
//   54  — split begins (was 43, +11 to beat 2)
//   106 — pair 1 (was 94, +12 to beat 4)
//   132 — pair 2 (was 120, +12 to beat 5)
//   157 — pair 3 (was 146, +11 to beat 6)
//   183 — verdict reveal (was 172, +11 to beat 7)
//   209 — panel labels start riding off (was 187, +22 to beat 8)
//   254 — hook ends
const HEADER_IN = 29;
const SPLIT_AT = 54;
const PAIR_FRAMES = [106, 132, 157];
const REVEAL_AT = 183;
const PANEL_EXIT_AT = 209;
const PANEL_EXIT_DURATION = 14;
const PANEL_EXIT_STAGGER = 5;
const HOOK_DURATION = 254;

const clamp01 = (t: number) => (t < 0 ? 0 : t > 1 ? 1 : t);

export const AntiCheatHook: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const splitProgress = spring({
    frame: frame - SPLIT_AT,
    fps,
    config: { damping: 18, stiffness: 90, mass: 0.9 },
  });
  const splitOffset = interpolate(splitProgress, [0, 1], [0, W / 2], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Zoom is now driven inside AntiCheatHookScene via camera.zoom for
  // the laptop curve and a counter-scale on the phone mesh for its
  // own. No CSS transform on the wrapper, so the text overlays don't
  // scale with the devices.

  return (
    <AbsoluteFill style={{ backgroundColor: colors.bg, fontFamily: font }}>
      <AbsoluteFill>
        {/* ── Single dual-device 3D scene underneath everything ── */}
        <AntiCheatHookScene
          laptopSegments={LAPTOP_SEGMENTS}
          laptopBrollAspect={16 / 9}
          width={W}
          height={H}
          emissiveIntensity={0.7}
          lightingIntensity={0.7}
        />

        {/* ── Left panel overlay: text + tint, no canvas ── */}
        <div
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: 0,
            right: `${splitOffset}px`,
            overflow: "hidden",
            borderRight: `1px solid ${"#1f1f1f"}`,
            pointerEvents: "none",
          }}
        >
          <StripDarken />
          <PanelLabel
            eyebrow="When you play"
            showFrom={HEADER_IN}
            align="left"
            frame={frame}
            fps={fps}
          />
          <PairList
            pairs={PAIRS}
            field="game"
            align="left"
            frames={PAIR_FRAMES}
            frame={frame}
            fps={fps}
          />
        </div>

        {/* ── Right panel overlay: text + tint ── */}
        <div
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: `${W - splitOffset}px`,
            right: 0,
            overflow: "hidden",
            borderLeft: `1px solid ${"#1f1f1f"}`,
            pointerEvents: "none",
          }}
        >
          <StripDarken tint={"#ff3b3b"} />
          <PanelLabel
            eyebrow="When you trade"
            showFrom={SPLIT_AT}
            align="right"
            frame={frame}
            fps={fps}
            tint={"#ff3b3b"}
          />
          <PairList
            pairs={PAIRS}
            field="trade"
            align="right"
            frames={PAIR_FRAMES}
            frame={frame}
            fps={fps}
            tint={"#ff3b3b"}
          />
        </div>

        {/* ── Reveal lines ── */}
        <Sequence from={REVEAL_AT} layout="none">
          <RevealLines />
        </Sequence>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ─── Strip darkening — top + bottom edges, keeps text legible ──────────────────

// Light-mode strip: top + bottom fade to the page background so the
// dark headline / pair labels sit on a clean light field without the
// 3D scene bleeding through behind them. Right-panel variant adds a
// faint red tint so the "When you trade" half reads warmer.
const StripDarken: React.FC<{ tint?: string }> = ({ tint }) => (
  <div
    style={{
      position: "absolute",
      inset: 0,
      pointerEvents: "none",
      background: tint
        ? `linear-gradient(180deg, rgba(240,242,244,0.95) 0%, rgba(240,242,244,0.0) 28%, rgba(240,242,244,0.0) 52%, rgba(240,242,244,0.92) 78%, rgba(240,242,244,1.0) 100%), linear-gradient(180deg, rgba(224,59,74,0.06), rgba(224,59,74,0.0) 40%, rgba(224,59,74,0.0) 60%, rgba(224,59,74,0.06))`
        : `linear-gradient(180deg, rgba(240,242,244,0.95) 0%, rgba(240,242,244,0.0) 28%, rgba(240,242,244,0.0) 52%, rgba(240,242,244,0.92) 78%, rgba(240,242,244,1.0) 100%)`,
    }}
  />
);

// ─── Text components ───────────────────────────────────────────────────────────

const PanelLabel: React.FC<{
  eyebrow: string;
  showFrom: number;
  align: "left" | "right";
  frame: number;
  fps: number;
  tint?: string;
}> = ({ eyebrow, showFrom, align, frame, fps, tint }) => {
  const t = spring({
    frame: frame - showFrom,
    fps,
    config: { damping: 22, stiffness: 110, mass: 0.7 },
  });
  const y = interpolate(t, [0, 1], [24, 0]);
  const enterOp = interpolate(t, [0, 1], [0, 1]);

  // Eyebrows exit last — after all three pairs have left the frame.
  const exitT = clamp01(
    (frame - PANEL_EXIT_AT - PANEL_EXIT_STAGGER * 3) / PANEL_EXIT_DURATION,
  );
  const exitEased = exitT * exitT;
  const exitX = (align === "left" ? -1 : 1) * exitEased * 360;
  const exitOp = 1 - exitT;
  const exitBlur = exitEased * 6;

  return (
    <div
      style={{
        position: "absolute",
        top: "12%",
        left: 0,
        right: 0,
        textAlign: align === "left" ? "left" : "right",
        padding: "0 96px",
        opacity: enterOp * exitOp,
        transform: `translate(${exitX.toFixed(2)}px, ${y}px)`,
        filter: exitBlur > 0.05 ? `blur(${exitBlur.toFixed(2)}px)` : undefined,
        willChange: "transform, opacity, filter",
      }}
    >
      <div
        style={{
          fontFamily: font,
          fontSize: 124,
          fontWeight: 800,
          letterSpacing: "-0.04em",
          color: tint ?? colors.fg,
          lineHeight: 0.95,
        }}
      >
        {eyebrow}
      </div>
    </div>
  );
};

const PairList: React.FC<{
  pairs: typeof PAIRS;
  field: "game" | "trade";
  align: "left" | "right";
  frames: readonly number[];
  frame: number;
  fps: number;
  tint?: string;
}> = ({ pairs, field, align, frames, frame, fps, tint }) => {
  return (
    <div
      style={{
        position: "absolute",
        bottom: "10%",
        left: 0,
        right: 0,
        textAlign: align === "left" ? "left" : "right",
        padding: "0 96px",
        display: "flex",
        flexDirection: "column",
        gap: 22,
        alignItems: align === "left" ? "flex-start" : "flex-end",
      }}
    >
      {pairs.map((pair, i) => {
        const at = frames[i] ?? frames[frames.length - 1];

        const xT = spring({
          frame: frame - at,
          fps,
          config: { damping: 22, stiffness: 90, mass: 0.8 },
        });
        const enterOp = interpolate(xT, [0.05, 0.45], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        const initialX = align === "left" ? 480 : -480;
        const enterX = interpolate(xT, [0, 1], [initialX, 0]);

        // Exit, bottom-up. Pair 3 (last in) leaves first; pair 1 last.
        const exitDelay = (pairs.length - 1 - i) * PANEL_EXIT_STAGGER;
        const exitT = clamp01(
          (frame - PANEL_EXIT_AT - exitDelay) / PANEL_EXIT_DURATION,
        );
        const exitEased = exitT * exitT;
        const exitX = (align === "left" ? -1 : 1) * exitEased * 420;
        const exitOp = 1 - exitT;
        const exitBlur = exitEased * 5;

        return (
          <div
            key={i}
            style={{
              transform: `translateX(${(enterX + exitX).toFixed(2)}px)`,
              opacity: enterOp * exitOp,
              filter:
                exitBlur > 0.05 ? `blur(${exitBlur.toFixed(2)}px)` : undefined,
              willChange: "transform, opacity, filter",
              fontFamily: font,
              fontSize: 76,
              fontWeight: 700,
              letterSpacing: "-0.03em",
              color: tint ?? colors.fg,
              textShadow:
                "0 1px 0 rgba(255,255,255,0.7), 0 2px 18px rgba(240,242,244,0.65)",
            }}
          >
            {pair[field]}
          </div>
        );
      })}
    </div>
  );
};

// Both lines fly in together as whole lines (depth-flash). The exit is
// the snappy bit: word-by-word stagger, opposite drift directions per
// line, both lines starting their exit on the same frame. RevealLines
// is gated behind a Sequence at REVEAL_AT (183), so frame numbers
// below are scene-local. 7.5s absolute = 225 - 183 = 42.
const LINE1_LAND = 7;
const LINE2_LAND = 7;
const LINE_EXIT_AT = 42;
const WORD_EXIT_STAGGER = 2;
const WORD_EXIT_DURATION = 5;
const SHAKE_FRAMES = 5;
const SHAKE_AMP = 9;

const RevealLines: React.FC = () => {
  const frame = useCurrentFrame();

  const shakeAt = (landFrame: number) => {
    const since = frame - landFrame;
    if (since < 0 || since >= SHAKE_FRAMES) return 0;
    return (1 - since / SHAKE_FRAMES) * SHAKE_AMP;
  };
  const amp = Math.max(shakeAt(LINE1_LAND), shakeAt(LINE2_LAND));
  const shakeX = amp ? (pseudo(frame * 7.31) - 0.5) * 2 * amp : 0;
  const shakeY = amp ? (pseudo(frame * 11.7 + 1) - 0.5) * 2 * amp : 0;

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        background: "rgba(240,242,244,0.88)",
        backdropFilter: "blur(2px)",
        transform: `translate(${shakeX}px, ${shakeY}px)`,
      }}
    >
      <div
        style={{
          fontFamily: font,
          fontWeight: 700,
          fontSize: 100,
          letterSpacing: "-0.025em",
          textAlign: "center",
          color: colors.fg,
          lineHeight: 1.12,
        }}
      >
        <DepthLine
          text="The cheaters in your games"
          startAt={0}
          exitAt={LINE_EXIT_AT}
          exitDir="left"
          frame={frame}
        />
        <DepthLine
          text="Stole you also in your trades"
          startAt={0}
          exitAt={LINE_EXIT_AT}
          exitDir="right"
          frame={frame}
          color="#E03B4A"
          marginTop={20}
        />
      </div>
    </AbsoluteFill>
  );
};

const DepthLine: React.FC<{
  text: string;
  startAt: number;
  exitAt: number;
  exitDir: "left" | "right";
  frame: number;
  color?: string;
  marginTop?: number;
}> = ({ text, startAt, exitAt, exitDir, frame, color, marginTop }) => {
  const words = text.split(" ");

  // Line-level entry — whole-line depth flash (huge + blurry → land).
  const t = frame - startAt;
  const enterScale = interpolate(t, [0, 7], [2.4, 1.0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const enterBlur = interpolate(t, [0, 7], [16, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const enterOp = interpolate(t, [0, 5], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        transform: `scale(${enterScale.toFixed(3)})`,
        transformOrigin: "50% 50%",
        filter: enterBlur > 0.05 ? `blur(${enterBlur.toFixed(2)}px)` : "none",
        opacity: enterOp,
        color: color ?? colors.fg,
        marginTop: marginTop ?? 0,
        willChange: "transform, opacity, filter",
      }}
    >
      {words.map((word, i) => {
        // Per-word exit, snappy. Each word drifts to its line's
        // assigned side and fades, with a tight 2-frame stagger
        // between words.
        const wordExitStart = exitAt + i * WORD_EXIT_STAGGER;
        const wExitT = clamp01(
          (frame - wordExitStart) / WORD_EXIT_DURATION,
        );
        const wExitEased = wExitT * wExitT;
        const wExitX = (exitDir === "left" ? -1 : 1) * wExitEased * 220;
        const wExitOp = 1 - wExitT;
        const wExitScale = 1 - wExitEased * 0.22;
        const wExitBlur = wExitEased * 7;
        return (
          <React.Fragment key={i}>
            <span
              style={{
                display: "inline-block",
                transform: `translateX(${wExitX.toFixed(2)}px) scale(${wExitScale.toFixed(3)})`,
                transformOrigin: "50% 50%",
                filter:
                  wExitBlur > 0.05
                    ? `blur(${wExitBlur.toFixed(2)}px)`
                    : "none",
                opacity: wExitOp,
                willChange: "transform, opacity, filter",
              }}
            >
              {word}
            </span>
            {i < words.length - 1 ? " " : null}
          </React.Fragment>
        );
      })}
    </div>
  );
};

function pseudo(seed: number): number {
  return (Math.sin(seed * 12.9898) * 43758.5453) % 1 < 0
    ? ((Math.sin(seed * 12.9898) * 43758.5453) % 1) + 1
    : (Math.sin(seed * 12.9898) * 43758.5453) % 1;
}

export const antiCheatHookMeta = {
  id: "AntiCheatHook",
  component: AntiCheatHook,
  durationInFrames: HOOK_DURATION,
  fps: FPS,
  width: W,
  height: H,
};
