import React from "react";
import {
  AbsoluteFill,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { font, monoFont } from "../../common/fonts";
import { FPS, H, W, colors, toFrames } from "./theme";
import {
  useGsapProxy,
  HERO_SPRING,
  ELEMENT_SPRING,
  SOFT_OUT,
} from "../replicates/rainbows-pitch/gsapUtils";

const SCENE_SECONDS = 8;
const TERMINAL_AT = toFrames(4);
const GREEN = "#3ddc84";

const HEADLINE_LEAD = ["General"] as const;
const HEADLINE_TAIL = ["this"] as const;
const SUBLINE = [
  "Securing",
  "your",
  "profits",
  "from",
  "unfair",
  "actors",
] as const;

export const AntiCheatSolution: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: colors.bg, fontFamily: font }}>
      <Headline />

      <Sequence from={TERMINAL_AT}>
        <Terminal />
      </Sequence>

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

// ─── Headline ─────────────────────────────────────────────────────────────────

const Headline: React.FC = () => {
  const proxyKeys: Record<string, Record<string, number>> = {
    block: { opacity: 1, y: 0 },
    changes: { opacity: 0, y: 18, scale: 0.7, letterSpacing: -0.02 },
  };
  HEADLINE_LEAD.forEach((_, i) => {
    proxyKeys[`hL_${i}`] = { opacity: 0, y: 18 };
  });
  HEADLINE_TAIL.forEach((_, i) => {
    proxyKeys[`hT_${i}`] = { opacity: 0, y: 18 };
  });
  SUBLINE.forEach((_, i) => {
    proxyKeys[`sl_${i}`] = { opacity: 0, y: 10 };
  });

  const TERMINAL_AT_SEC = TERMINAL_AT / FPS;

  const s = useGsapProxy((tl, p) => {
    HEADLINE_LEAD.forEach((_, i) => {
      tl.to(
        p[`hL_${i}`]!,
        { opacity: 1, y: 0, duration: 0.18, ease: ELEMENT_SPRING },
        i * 0.12,
      );
    });
    // "changes" — hero word with letter-spacing kick
    tl.to(
      p.changes,
      { opacity: 1, y: 0, scale: 1, duration: 0.5, ease: HERO_SPRING },
      0.18,
    );
    tl.to(
      p.changes,
      { letterSpacing: -0.04, duration: 0.4, ease: SOFT_OUT },
      0.18,
    );
    tl.to(
      p.changes,
      { letterSpacing: -0.025, duration: 0.4, ease: SOFT_OUT },
      0.58,
    );
    HEADLINE_TAIL.forEach((_, i) => {
      tl.to(
        p[`hT_${i}`]!,
        { opacity: 1, y: 0, duration: 0.18, ease: ELEMENT_SPRING },
        0.7 + i * 0.12,
      );
    });
    SUBLINE.forEach((_, i) => {
      tl.to(
        p[`sl_${i}`]!,
        { opacity: 1, y: 0, duration: 0.16, ease: "power2.out" },
        1.0 + i * 0.1,
      );
    });

    // Headline lifts + fades as the terminal arrives
    tl.to(
      p.block,
      { opacity: 0.18, y: -120, duration: 0.7, ease: SOFT_OUT },
      TERMINAL_AT_SEC - 0.3,
    );
  }, proxyKeys);

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        padding: "0 96px",
        textAlign: "center",
        opacity: s.block.opacity,
        transform: `translateY(${s.block.y}px)`,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          gap: "0 28px",
          flexWrap: "wrap",
          fontFamily: font,
          fontSize: 132,
          fontWeight: 800,
          color: colors.fg,
          lineHeight: 0.95,
          letterSpacing: "-0.04em",
          textShadow: "0 4px 28px rgba(0,0,0,0.65)",
        }}
      >
        {HEADLINE_LEAD.map((word, i) => {
          const proxy = s[`hL_${i}`]!;
          return (
            <span
              key={word + i}
              style={{
                display: "inline-block",
                opacity: proxy.opacity,
                transform: `translateY(${proxy.y}px)`,
              }}
            >
              {word}
            </span>
          );
        })}
        <span
          style={{
            display: "inline-block",
            color: GREEN,
            opacity: s.changes.opacity,
            transform: `translateY(${s.changes.y}px) scale(${s.changes.scale})`,
            letterSpacing: `${s.changes.letterSpacing}em`,
          }}
        >
          changes
        </span>
        {HEADLINE_TAIL.map((word, i) => {
          const proxy = s[`hT_${i}`]!;
          return (
            <span
              key={word + i}
              style={{
                display: "inline-block",
                opacity: proxy.opacity,
                transform: `translateY(${proxy.y}px)`,
              }}
            >
              {word}
            </span>
          );
        })}
        <span style={{ color: colors.fg, opacity: 0.45 }}>.</span>
      </div>
      <div
        style={{
          marginTop: 36,
          display: "flex",
          justifyContent: "center",
          gap: "0 14px",
          flexWrap: "wrap",
          fontFamily: monoFont,
          fontSize: 30,
          fontWeight: 500,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: colors.dim,
        }}
      >
        {SUBLINE.map((word, i) => {
          const proxy = s[`sl_${i}`]!;
          return (
            <span
              key={word + i}
              style={{
                display: "inline-block",
                opacity: proxy.opacity,
                transform: `translateY(${proxy.y}px)`,
              }}
            >
              {word}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

// ─── Terminal — types out at ~25 cps, green flash on the OK line ──────────────

const TERMINAL_LINES: { text: string; color: string; mode: "cmd" | "user" | "ok" }[] = [
  { text: "$ claude", color: colors.dim, mode: "cmd" },
  { text: "> upgrade my bot to block-trading", color: colors.fg, mode: "user" },
  { text: "✓ shielded", color: GREEN, mode: "ok" },
];

const Terminal: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Panel + per-line meta drives via GSAP for crisp arrival.
  const proxyKeys: Record<string, Record<string, number>> = {
    panel: { opacity: 0, y: 40, scale: 0.97 },
    okFlash: { v: 0 },
    okScale: { scale: 0.92 },
    okLetter: { letterSpacing: 0 },
  };

  // ~25 chars/sec → 25/30 = 0.833 chars/frame
  const CHARS_PER_FRAME = 25 / fps;
  const LINE_DELAYS = [toFrames(0.3), toFrames(1.0), toFrames(2.0)];

  // OK line completes at: LINE_DELAYS[2] + (length / CHARS_PER_FRAME) frames.
  const okLine = TERMINAL_LINES[2]!;
  const okCompleteFrame =
    LINE_DELAYS[2]! + Math.ceil(okLine.text.length / CHARS_PER_FRAME);
  const okCompleteSec = okCompleteFrame / fps;

  const s = useGsapProxy((tl, p) => {
    tl.to(
      p.panel,
      { opacity: 1, y: 0, scale: 1, duration: 0.5, ease: ELEMENT_SPRING },
      0,
    );
    // Green flash + scale + letter-spacing on the OK line
    tl.fromTo(
      p.okFlash,
      { v: 0 },
      { v: 1, duration: 0.18, ease: SOFT_OUT },
      okCompleteSec,
    );
    tl.to(
      p.okFlash,
      { v: 0, duration: 0.22, ease: "power2.in" },
      okCompleteSec + 0.18,
    );
    tl.to(
      p.okScale,
      { scale: 1, duration: 0.45, ease: "back.out(1.6)" },
      okCompleteSec,
    );
    tl.fromTo(
      p.okLetter,
      { letterSpacing: -0.04 },
      { letterSpacing: -0.02, duration: 0.4, ease: SOFT_OUT },
      okCompleteSec + 0.05,
    );
  }, proxyKeys);

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        padding: "0 96px",
      }}
    >
      <div
        style={{
          width: "min(1200px, 90%)",
          background: "linear-gradient(180deg, #0d0d10 0%, #050507 100%)",
          border: `1px solid ${colors.rule}`,
          borderRadius: 8,
          opacity: s.panel.opacity,
          transform: `translateY(${s.panel.y}px) scale(${s.panel.scale})`,
          boxShadow: "0 24px 80px rgba(0,0,0,0.6)",
        }}
      >
        {/* Window chrome */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "14px 18px",
            borderBottom: `1px solid ${colors.rule}`,
          }}
        >
          <Dot color="#ff5f57" />
          <Dot color="#febc2e" />
          <Dot color="#28c840" />
          <span
            style={{
              marginLeft: 18,
              fontFamily: monoFont,
              fontSize: 16,
              color: colors.dim,
              letterSpacing: "0.08em",
            }}
          >
            ~/bot — claude
          </span>
        </div>

        {/* Body */}
        <div
          style={{
            padding: "32px 40px 36px",
            fontFamily: monoFont,
            fontSize: 38,
            lineHeight: 1.5,
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          {TERMINAL_LINES.map((line, i) => {
            const start = LINE_DELAYS[i]!;
            const localFrame = Math.max(0, frame - start);
            const visibleChars = Math.min(
              line.text.length,
              Math.floor(localFrame * CHARS_PER_FRAME),
            );
            const shown = line.text.slice(0, visibleChars);
            const isActive = frame >= start;
            const isComplete = visibleChars >= line.text.length;
            const showCursor = isActive && !isComplete;
            const isOk = line.mode === "ok";

            const flashAlpha = isOk ? 0.18 * s.okFlash.v : 0;

            return (
              <div
                key={i}
                style={{
                  color: line.color,
                  fontWeight: isOk ? 700 : 500,
                  opacity: isActive ? 1 : 0.0,
                  whiteSpace: "pre",
                  background: isOk
                    ? `rgba(61,220,132,${flashAlpha})`
                    : "transparent",
                  padding: isOk ? "2px 8px" : 0,
                  borderRadius: isOk ? 4 : 0,
                  transform: isOk ? `scale(${s.okScale.scale})` : undefined,
                  transformOrigin: "left center",
                  letterSpacing: isOk ? `${s.okLetter.letterSpacing}em` : undefined,
                  display: "inline-block",
                  width: "fit-content",
                }}
              >
                {shown}
                {showCursor && <Cursor />}
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};

const Cursor: React.FC = () => {
  const frame = useCurrentFrame();
  const blink = Math.floor(frame / 8) % 2 === 0;
  return (
    <span
      style={{
        display: "inline-block",
        width: "0.55em",
        marginLeft: 2,
        background: colors.fg,
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
