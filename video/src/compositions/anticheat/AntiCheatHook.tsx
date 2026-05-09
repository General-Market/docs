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
import { FPS, H, W } from "./theme";

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

const PHONE_BROLL = staticFile("cheat-broll/phone-trading.mp4");

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

// Phone broll also has a dark intro before the trading chart appears.
// Skip ~2s so the chart is on screen at frame 0.
const PHONE_BROLL_START_FROM = 60;

const PHONE_SEGMENTS: BrollSegment[] = [
  {
    url: PHONE_BROLL,
    from: 0,
    durationInFrames: 254,
    startFrom: PHONE_BROLL_START_FROM,
  },
];

const PAIRS = [
  { game: "Spin-bots", trade: "Insider traders" },
  { game: "Wall-hackers", trade: "Front-runners" },
  { game: "Kill aura", trade: "Order-flow buyers" },
] as const;

// Beat grid (frames):
//   17  — header in
//   43  — split begins
//   94  — pair 1
//   120 — pair 2
//   146 — pair 3
//   172 — verdict reveal
//   187 — panel labels start riding off (6.22s; bottom-up, line by line)
//   254 — hook ends
const HEADER_IN = 17;
const SPLIT_AT = 43;
const PAIR_FRAMES = [94, 120, 146];
const REVEAL_AT = 172;
const PANEL_EXIT_AT = 187;
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
    <AbsoluteFill style={{ backgroundColor: "#0a0a0a", fontFamily: font }}>
      <AbsoluteFill>
        {/* ── Single dual-device 3D scene underneath everything ── */}
        <AntiCheatHookScene
          laptopSegments={LAPTOP_SEGMENTS}
          phoneSegments={PHONE_SEGMENTS}
          laptopBrollAspect={16 / 9}
          phoneBrollAspect={720 / 1560}
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

const StripDarken: React.FC<{ tint?: string }> = ({ tint }) => (
  <div
    style={{
      position: "absolute",
      inset: 0,
      pointerEvents: "none",
      background: tint
        ? `linear-gradient(180deg, rgba(10,10,10,0.82) 0%, rgba(10,10,10,0.0) 28%, rgba(10,10,10,0.0) 52%, rgba(10,10,10,0.78) 78%, rgba(10,10,10,0.94) 100%), linear-gradient(180deg, rgba(255,59,59,0.04), rgba(255,59,59,0.0))`
        : `linear-gradient(180deg, rgba(10,10,10,0.82) 0%, rgba(10,10,10,0.0) 28%, rgba(10,10,10,0.0) 52%, rgba(10,10,10,0.78) 78%, rgba(10,10,10,0.94) 100%)`,
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
          color: tint ?? "#f5f5f5",
          lineHeight: 0.95,
          textShadow: "0 4px 28px rgba(0,0,0,0.65)",
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
              color: tint ?? "#f5f5f5",
              textShadow:
                "0 2px 6px rgba(0,0,0,0.95), 0 6px 22px rgba(0,0,0,0.8), 0 12px 40px rgba(0,0,0,0.55)",
            }}
          >
            {pair[field]}
          </div>
        );
      })}
    </div>
  );
};

// Both lines land in lockstep at frame 0; inside each line the words
// pop in word-by-word with a tight stagger. The whole pair exits
// together too — opposite drift directions, same exitAt.
// RevealLines is gated behind a Sequence at REVEAL_AT (172), so all
// frame numbers below are scene-local. 7.5s absolute = 225 - 172 = 53.
const WORD_STAGGER = 2;
const WORD_ENTER_DURATION = 4;
const LINES_LAND = 12; // tail end of the word cascade — used for the screen shake
const LINE_EXIT_AT = 53; // 7.5s
const LINE_EXIT_DURATION = 8;
const SHAKE_FRAMES = 5;
const SHAKE_AMP = 9;

const RevealLines: React.FC = () => {
  const frame = useCurrentFrame();

  const shakeAt = (landFrame: number) => {
    const since = frame - landFrame;
    if (since < 0 || since >= SHAKE_FRAMES) return 0;
    return (1 - since / SHAKE_FRAMES) * SHAKE_AMP;
  };
  const amp = shakeAt(LINES_LAND);
  const shakeX = amp ? (pseudo(frame * 7.31) - 0.5) * 2 * amp : 0;
  const shakeY = amp ? (pseudo(frame * 11.7 + 1) - 0.5) * 2 * amp : 0;

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        background: "rgba(10,10,10,0.78)",
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
          color: "#f5f5f5",
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
          color="#ff3b3b"
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

  // Line-level exit. The whole line drifts to its side, softens.
  const exitT = clamp01((frame - exitAt) / LINE_EXIT_DURATION);
  const exitEased = exitT * exitT;
  const exitX = (exitDir === "left" ? -1 : 1) * exitEased * 240;
  const exitOp = 1 - exitT;
  const exitScale = 1 - exitEased * 0.18;
  const exitBlur = exitEased * 7;

  return (
    <div
      style={{
        transform: `translateX(${exitX.toFixed(2)}px) scale(${exitScale.toFixed(3)})`,
        transformOrigin: "50% 50%",
        filter: exitBlur > 0.05 ? `blur(${exitBlur.toFixed(2)}px)` : "none",
        opacity: exitOp,
        color: color ?? "#f5f5f5",
        marginTop: marginTop ?? 0,
        willChange: "transform, opacity, filter",
      }}
    >
      {words.map((word, i) => {
        const wordStart = startAt + i * WORD_STAGGER;
        const wt = clamp01((frame - wordStart) / WORD_ENTER_DURATION);
        // Ease-out cubic — snappy land, no slow ramp.
        const wEased = 1 - Math.pow(1 - wt, 3);
        const wScale = interpolate(wEased, [0, 1], [2.0, 1.0]);
        const wBlur = (1 - wEased) * 10;
        const wOp = wt;
        return (
          <React.Fragment key={i}>
            <span
              style={{
                display: "inline-block",
                transform: `scale(${wScale.toFixed(3)})`,
                transformOrigin: "50% 50%",
                filter: wBlur > 0.05 ? `blur(${wBlur.toFixed(2)}px)` : "none",
                opacity: wOp,
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
