import React from "react";
import {
  AbsoluteFill,
  OffthreadVideo,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { font, monoFont } from "../../common/fonts";
import { FPS, H, W, colors, toFrames } from "./theme";

const BROLL = {
  minecraft: staticFile("cheat-broll/minecraft-killaura.mp4"),
  cs2: staticFile("cheat-broll/cs2-spinbot.mp4"),
  valorant: staticFile("cheat-broll/valorant-wallhack.mp4"),
};

const PAIRS = [
  { game: "Spin-bots.", trade: "Insider traders.", broll: BROLL.cs2 },
  { game: "Wall-hackers.", trade: "Front-runners.", broll: BROLL.valorant },
  { game: "Kill aura.", trade: "Order-flow buyers.", broll: BROLL.minecraft },
] as const;

const HEADER_IN = toFrames(0.3);
const SPLIT_AT = toFrames(2.0);
const PAIRS_AT = toFrames(3.6);
const PAIR_STEP = toFrames(1.4);
const REVEAL_AT = toFrames(8.4);

export const AntiCheatHook: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const splitProgress = spring({
    frame: frame - SPLIT_AT,
    fps,
    config: { damping: 18, stiffness: 90, mass: 0.9 },
  });
  const splitX = interpolate(splitProgress, [0, 1], [0, W / 2]);

  return (
    <AbsoluteFill style={{ backgroundColor: colors.bg, fontFamily: font }}>
      {/* ── Left panel: PLAY ── */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          right: `${W - splitX}px`,
          overflow: "hidden",
          borderRight: `1px solid ${colors.rule}`,
        }}
      >
        <PanelBackground
          src={BROLL.minecraft}
          align="left"
          showFrom={HEADER_IN}
          frame={frame}
        />
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
          startFrame={PAIRS_AT}
          stepFrame={PAIR_STEP}
          frame={frame}
          fps={fps}
        />
      </div>

      {/* ── Right panel: TRADE ── */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          left: `${splitX}px`,
          overflow: "hidden",
          borderLeft: `1px solid ${colors.rule}`,
          opacity: interpolate(frame, [SPLIT_AT - 4, SPLIT_AT + 8], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        <PanelBackground
          src={BROLL.cs2}
          align="right"
          showFrom={SPLIT_AT}
          frame={frame}
        />
        <PanelLabel
          eyebrow="When you trade"
          showFrom={SPLIT_AT}
          align="right"
          frame={frame}
          fps={fps}
          tint={colors.accent}
        />
        <PairList
          pairs={PAIRS}
          field="trade"
          align="right"
          startFrame={PAIRS_AT}
          stepFrame={PAIR_STEP}
          frame={frame}
          fps={fps}
          tint={colors.accent}
        />
      </div>

      {/* ── Reveal lines ── */}
      <Sequence from={REVEAL_AT} layout="none">
        <RevealLines />
      </Sequence>

      {/* ── Vignette + grain for cinematic compression ── */}
      <AbsoluteFill
        style={{
          pointerEvents: "none",
          background:
            "radial-gradient(circle at 50% 50%, transparent 55%, rgba(0,0,0,0.55) 100%)",
        }}
      />
    </AbsoluteFill>
  );
};

// ────────────────────────────────────────────────────────────────────────

const PanelBackground: React.FC<{
  src: string;
  align: "left" | "right";
  showFrom: number;
  frame: number;
}> = ({ src, frame, showFrom }) => {
  const opacity = interpolate(
    frame,
    [showFrom, showFrom + toFrames(0.5)],
    [0, 0.42],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const scale = interpolate(
    frame,
    [showFrom, showFrom + toFrames(6)],
    [1.18, 1.05],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        opacity,
        transform: `scale(${scale})`,
        filter: "saturate(0.7) contrast(1.1)",
      }}
    >
      <OffthreadVideo
        src={src}
        muted
        startFrom={0}
        playbackRate={1}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          mixBlendMode: "screen",
        }}
      />
    </div>
  );
};

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
  const opacity = interpolate(t, [0, 1], [0, 1]);

  return (
    <div
      style={{
        position: "absolute",
        top: "20%",
        left: 0,
        right: 0,
        textAlign: align === "left" ? "left" : "right",
        padding: "0 96px",
        opacity,
        transform: `translateY(${y}px)`,
      }}
    >
      <div
        style={{
          fontFamily: monoFont,
          fontSize: 28,
          fontWeight: 500,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: colors.dim,
          marginBottom: 18,
        }}
      >
        {align === "left" ? "01 / Game" : "02 / Market"}
      </div>
      <div
        style={{
          fontFamily: font,
          fontSize: 132,
          fontWeight: 800,
          letterSpacing: "-0.04em",
          color: tint ?? colors.fg,
          lineHeight: 0.95,
        }}
      >
        {eyebrow}
        <span style={{ color: tint ?? colors.fg, opacity: 0.4 }}>.</span>
      </div>
    </div>
  );
};

const PairList: React.FC<{
  pairs: typeof PAIRS;
  field: "game" | "trade";
  align: "left" | "right";
  startFrame: number;
  stepFrame: number;
  frame: number;
  fps: number;
  tint?: string;
}> = ({ pairs, field, align, startFrame, stepFrame, frame, fps, tint }) => {
  return (
    <div
      style={{
        position: "absolute",
        bottom: "16%",
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
        const at = startFrame + i * stepFrame;
        const t = spring({
          frame: frame - at,
          fps,
          config: { damping: 24, stiffness: 130, mass: 0.6 },
        });
        const x = interpolate(t, [0, 1], [align === "left" ? -40 : 40, 0]);
        const opacity = interpolate(t, [0, 1], [0, 1]);

        return (
          <div
            key={i}
            style={{
              transform: `translateX(${x}px)`,
              opacity,
              fontFamily: font,
              fontSize: 56,
              fontWeight: 600,
              letterSpacing: "-0.02em",
              color: tint ?? colors.fg,
              display: "flex",
              alignItems: "center",
              gap: 18,
              flexDirection: align === "left" ? "row" : "row-reverse",
            }}
          >
            <span
              style={{
                fontFamily: monoFont,
                fontSize: 22,
                fontWeight: 500,
                color: colors.dim,
                opacity: 0.7,
                minWidth: 32,
              }}
            >
              0{i + 1}
            </span>
            <span>{pair[field]}</span>
          </div>
        );
      })}
    </div>
  );
};

const RevealLines: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const t1 = spring({
    frame,
    fps,
    config: { damping: 22, stiffness: 100, mass: 0.8 },
  });
  const t2 = spring({
    frame: frame - toFrames(0.7),
    fps,
    config: { damping: 22, stiffness: 100, mass: 0.8 },
  });

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        background: "rgba(10,10,10,0.7)",
        backdropFilter: "blur(2px)",
      }}
    >
      <div
        style={{
          fontFamily: font,
          fontWeight: 700,
          fontSize: 84,
          letterSpacing: "-0.025em",
          textAlign: "center",
          color: colors.fg,
          lineHeight: 1.15,
        }}
      >
        <div
          style={{
            opacity: interpolate(t1, [0, 1], [0, 1]),
            transform: `translateY(${interpolate(t1, [0, 1], [16, 0])}px)`,
          }}
        >
          The same cheaters ruining your games
        </div>
        <div
          style={{
            opacity: interpolate(t2, [0, 1], [0, 1]),
            transform: `translateY(${interpolate(t2, [0, 1], [16, 0])}px)`,
            color: colors.accent,
            marginTop: 16,
          }}
        >
          are trading against you.
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const antiCheatHookMeta = {
  id: "AntiCheatHook",
  component: AntiCheatHook,
  durationInFrames: toFrames(12),
  fps: FPS,
  width: W,
  height: H,
};
