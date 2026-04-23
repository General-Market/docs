import React from "react";
import { interpolate, useCurrentFrame, spring } from "remotion";
import { monoFont } from "../../../common/fonts";
import { FPS, SECTIONS, toFrames } from "../theme";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

// ── Real Claude Code theme (dark variant, from cli.js) ──────────────────────
const CC = {
  claude: "#D77757",
  claudeShimmer: "#EB9F7F",
  text: "#FFFFFF",
  dim: "#999999",
  subtle: "#505050",
  success: "#4EBA65",
  permission: "#B1B9F9",
  bashBorder: "#FD5DB1",
  promptBg: "#373737",
} as const;

const SPINNER = ["·", "✢", "✳", "✶", "✻", "✽"];

// Random thinking verbs (real Claude Code cycles these)
const THINK_VERBS = [
  "Cooking", "Sock-hopping", "Spiraling", "Percolating",
  "Ruminating", "Contemplating", "Brewing",
];

// ── Clawd block-char mascot (from cli.js oR6/JMz) ──────────────────────────
const CLAWD_POSES = {
  default:      { r1L: " ▐", r1E: "▛███▜", r1R: "▌", r2L: "▝▜", r2R: "▛▘" },
  "look-left":  { r1L: " ▐", r1E: "▟███▟", r1R: "▌", r2L: "▝▜", r2R: "▛▘" },
  "look-right": { r1L: " ▐", r1E: "▙███▙", r1R: "▌", r2L: "▝▜", r2R: "▛▘" },
  "arms-up":    { r1L: "▗▟", r1E: "▛███▜", r1R: "▙▖", r2L: " ▜", r2R: "▛ " },
} as const;

const CLAWD_EYES = {
  default:      " ▗   ▖ ",
  "look-left":  " ▘   ▘ ",
  "look-right": " ▝   ▝ ",
  "arms-up":    " ▗   ▖ ",
} as const;

type ClawdPose = keyof typeof CLAWD_POSES;

// ── Timing ──────────────────────────────────────────────────────────────────
const S = SECTIONS.claudeTerminal;
const ENTER = S.start;
const HEADER_IN = S.start + 0.2;
const PROMPT_IN = S.start + 0.6;
const TYPE_START = S.start + 0.8;
const TYPE_END = S.start + 2.6;
const THINK_START = S.start + 2.9;
const TOOL_START = S.start + 4.0;
const STREAM_START = S.start + 5.0;
const SHRINK_START = 48.64;
const SHRINK_END = 49.6;
const INDICATOR_END = S.end;

const PROMPT_TEXT = "hey claude make a trading bot on twitch for generalmarket.io";

const TOOL_CALLS: { tool: string; arg: string; type: "read" | "bash" }[] = [
  { tool: "Read", arg: "frontend/lib/config.ts", type: "read" },
  { tool: "Read", arg: "frontend/lib/vision/sources.ts", type: "read" },
  { tool: "Bash", arg: "npm run build --dry-run", type: "bash" },
];

const RESPONSE_LINES = [
  "I'll create a Twitch viewer prediction bot that:",
  "",
  "1. Connects to the Vision oracle for stream data",
  "2. Places bets on viewer count movements",
  "3. Uses 10-min settlement windows for fast cycles",
  "",
  "Setting up the project structure now...",
];

// ── Clawd ───────────────────────────────────────────────────────────────────
const Clawd: React.FC<{ fontSize: number }> = ({ fontSize }) => {
  const frame = useCurrentFrame();
  const poses: ClawdPose[] = ["default", "look-left", "default", "look-right", "arms-up"];
  const pose = poses[Math.floor(frame / 25) % poses.length];
  const p = CLAWD_POSES[pose];
  const eyes = CLAWD_EYES[pose];

  const row: React.CSSProperties = {
    fontFamily: monoFont,
    fontSize,
    lineHeight: 1.05,
    whiteSpace: "pre",
    letterSpacing: "0.02em",
  };

  return (
    <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
      <div style={row}>
        <span style={{ color: CC.claude }}>{p.r1L}</span>
        <span style={{ color: CC.claude, backgroundColor: "#000" }}>{p.r1E}</span>
        <span style={{ color: CC.claude }}>{p.r1R}</span>
      </div>
      <div style={row}>
        <span style={{ color: CC.claude }}>{p.r2L}</span>
        <span style={{ color: CC.claude, backgroundColor: "#000" }}>█████</span>
        <span style={{ color: CC.claude }}>{p.r2R}</span>
      </div>
      <div style={row}>
        <span style={{ color: "#000", backgroundColor: CC.claude }}>{eyes}</span>
      </div>
      <div style={row}>
        <span style={{ color: CC.claude }}>{"  "}▘▘ ▝▝{"  "}</span>
      </div>
    </div>
  );
};

// ── Typing with cursor ──────────────────────────────────────────────────────
const TypedText: React.FC<{
  text: string;
  progress: number;
  showCursor?: boolean;
}> = ({ text, progress, showCursor = true }) => {
  const len = Math.floor(text.length * Math.min(1, Math.max(0, progress)));
  const frame = useCurrentFrame();
  const cursorOn = Math.floor(frame / 8) % 2 === 0;
  return (
    <span>
      {text.slice(0, len)}
      {showCursor && progress < 1 && cursorOn && (
        <span style={{ color: CC.text }}>█</span>
      )}
    </span>
  );
};

// ── Tool call with colored border ───────────────────────────────────────────
const ToolCall: React.FC<{
  tool: string;
  arg: string;
  type: "read" | "bash";
  opacity: number;
  y: number;
}> = ({ tool, arg, type, opacity, y }) => {
  const borderColor = type === "bash" ? CC.bashBorder : CC.permission;
  return (
    <div
      style={{
        opacity,
        transform: `translateY(${y}px)`,
        border: `1.5px solid ${borderColor}`,
        borderRadius: 8,
        padding: "5px 14px",
        marginBottom: 4,
        display: "flex",
        alignItems: "center",
        gap: 10,
        fontSize: 15,
      }}
    >
      <span style={{ color: CC.dim, fontWeight: 600 }}>{tool}</span>
      <span style={{ color: CC.text }}>{arg}</span>
      <span style={{ color: CC.success, marginLeft: "auto", fontSize: 13 }}>✓</span>
    </div>
  );
};

// ── Streaming response ──────────────────────────────────────────────────────
const StreamingText: React.FC<{ lines: string[]; progress: number }> = ({
  lines,
  progress,
}) => {
  const total = lines.reduce((a, l) => a + l.length + 1, 0);
  const visible = Math.floor(total * progress);
  let count = 0;
  return (
    <div style={{ fontSize: 15, lineHeight: 1.6, color: CC.text, padding: "4px 0" }}>
      {lines.map((line, i) => {
        const start = count;
        count += line.length + 1;
        if (start >= visible) return null;
        const chars = Math.min(line.length, visible - start);
        return (
          <div key={i} style={{ minHeight: line === "" ? 8 : undefined }}>
            {line.slice(0, chars)}
          </div>
        );
      })}
    </div>
  );
};

// ── Separator line ──────────────────────────────────────────────────────────
const Sep: React.FC = () => (
  <div style={{ borderBottom: `1px solid ${CC.subtle}`, margin: "6px 0" }} />
);

// ── Building indicator (post-shrink) ────────────────────────────────────────
const BuildingIndicator: React.FC<{ opacity: number }> = ({ opacity }) => {
  const frame = useCurrentFrame();
  const idx = Math.floor(frame / 4) % SPINNER.length;
  const t = (Math.sin(frame * 0.15) + 1) / 2;
  const color = t > 0.5 ? CC.claude : CC.claudeShimmer;
  return (
    <div
      style={{
        position: "absolute",
        bottom: 50,
        right: 50,
        opacity,
        background: "#1A1A1A",
        border: `1px solid ${CC.subtle}`,
        borderRadius: 6,
        padding: "10px 20px",
        display: "flex",
        alignItems: "center",
        gap: 12,
        fontFamily: monoFont,
        fontSize: 16,
        color: CC.dim,
        boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
      }}
    >
      <span style={{ color, fontSize: 18 }}>{SPINNER[idx]}</span>
      <span>claude working</span>
    </div>
  );
};

// ── Main ────────────────────────────────────────────────────────────────────
export const ClaudeTerminal: React.FC = () => {
  const frame = useCurrentFrame();
  const t = frame / FPS;

  const sStart = toFrames(ENTER);
  const sEnd = toFrames(INDICATOR_END);
  if (frame < sStart || frame > sEnd) return null;

  const isShrunk = t >= SHRINK_END;

  // Slide in from right
  const enterP = spring({
    frame: frame - sStart,
    fps: FPS,
    config: { damping: 18, stiffness: 120, mass: 0.8 },
  });
  const slideX = interpolate(enterP, [0, 1], [900, 0], clamp);

  // Shrink
  const shrinkP = interpolate(t, [SHRINK_START, SHRINK_END], [0, 1], clamp);
  const scale = interpolate(shrinkP, [0, 1], [1, 0], clamp);
  const opacity = interpolate(shrinkP, [0, 1], [1, 0], clamp);

  // Indicator
  const indIn = interpolate(t, [SHRINK_END, SHRINK_END + 0.3], [0, 1], clamp);
  const indOut = interpolate(t, [INDICATOR_END - 0.5, INDICATOR_END], [1, 0], clamp);

  // Phase opacities
  const headerOp = interpolate(t, [HEADER_IN, HEADER_IN + 0.3], [0, 1], clamp);
  const promptOp = interpolate(t, [PROMPT_IN, PROMPT_IN + 0.2], [0, 1], clamp);
  const typeP = interpolate(t, [TYPE_START, TYPE_END], [0, 1], clamp);
  const thinkOp = interpolate(t, [THINK_START, THINK_START + 0.2], [0, 1], clamp);
  const toolBase = t - TOOL_START;
  const streamP = interpolate(t, [STREAM_START, SHRINK_START - 0.2], [0, 1], clamp);

  // Spinner
  const spinIdx = Math.floor(frame / 4) % SPINNER.length;
  const spinT = (Math.sin(frame * 0.15) + 1) / 2;
  const spinColor = spinT > 0.5 ? CC.claude : CC.claudeShimmer;

  // Think verb
  const verbIdx = Math.floor(frame / 40) % THINK_VERBS.length;
  const thinkVerb = THINK_VERBS[verbIdx];

  // Cursor blink
  const cursorOn = Math.floor(frame / 8) % 2 === 0;

  if (isShrunk) {
    return <BuildingIndicator opacity={indIn * indOut} />;
  }

  return (
    <div
      style={{
        position: "absolute",
        right: 40,
        top: 40,
        bottom: 40,
        width: 860,
        fontFamily: monoFont,
        fontSize: 15,
        color: CC.text,
        transform: `translateX(${slideX}px) scale(${scale})`,
        transformOrigin: "center right",
        opacity,
        pointerEvents: "none",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Terminal window — square corners */}
      <div
        style={{
          flex: 1,
          background: "#1A1A1A",
          border: `1px solid #333`,
          boxShadow: "0 24px 80px rgba(0,0,0,0.7)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* ── Shell prompt line ────────────────────────────────────── */}
        <div style={{ padding: "12px 20px 0", color: CC.dim, fontSize: 13 }}>
          <span style={{ color: CC.subtle }}>○</span>{" "}
          max@MacBook-Air index %{" "}
          <span style={{ color: CC.text }}>cl</span>
        </div>

        {/* ── Clawd + header info ─────────────────────────────────── */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 18,
            padding: "8px 20px 12px 40px",
            opacity: headerOp,
          }}
        >
          <Clawd fontSize={22} />
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 2,
              fontSize: 14,
              lineHeight: 1.5,
            }}
          >
            <div>
              <span style={{ fontWeight: 700 }}>Claude Code</span>{" "}
              <span style={{ color: CC.dim }}>v2.1.101</span>
            </div>
            <div style={{ color: CC.dim }}>
              Opus 4.6 (1M context) with high effort · Claude Max
            </div>
            <div style={{ color: CC.dim }}>~/Downloads/index</div>
          </div>
        </div>

        {/* ── User prompt (full-width dark bar with ❯) ────────────── */}
        {t >= PROMPT_IN && (
          <div
            style={{
              background: CC.promptBg,
              padding: "10px 20px",
              fontSize: 16,
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: 10,
              opacity: promptOp,
            }}
          >
            <span style={{ color: CC.claude, fontSize: 18 }}>❯</span>
            <TypedText
              text={PROMPT_TEXT}
              progress={typeP}
              showCursor={t < THINK_START}
            />
          </div>
        )}

        {/* ── Thinking state ──────────────────────────────────────── */}
        {t >= THINK_START && (
          <div style={{ padding: "10px 20px 0", opacity: thinkOp }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 15,
                marginBottom: 8,
              }}
            >
              <span style={{ color: spinColor, fontSize: 17 }}>
                {SPINNER[spinIdx]}
              </span>
              <span style={{ color: CC.claude, fontWeight: 600 }}>
                {thinkVerb}…
              </span>
              <span style={{ color: CC.dim }}>(thinking with high effort)</span>
            </div>

            <Sep />

            {/* ❯ cursor area */}
            <div
              style={{
                padding: "6px 0",
                fontSize: 16,
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <span style={{ color: CC.dim }}>❯</span>
              {cursorOn && t < TOOL_START && (
                <span style={{ color: CC.text }}>█</span>
              )}
            </div>
          </div>
        )}

        {/* ── Tool calls (after thinking resolves) ────────────────── */}
        {t >= TOOL_START && (
          <div style={{ padding: "0 20px" }}>
            {TOOL_CALLS.map((tc, i) => {
              const delay = i * 0.3;
              const tcO = interpolate(toolBase - delay, [0, 0.15], [0, 1], clamp);
              const tcY = interpolate(tcO, [0, 1], [6, 0], clamp);
              if (tcO <= 0) return null;
              return (
                <ToolCall
                  key={i}
                  tool={tc.tool}
                  arg={tc.arg}
                  type={tc.type}
                  opacity={tcO}
                  y={tcY}
                />
              );
            })}
          </div>
        )}

        {/* ── Streaming response ──────────────────────────────────── */}
        {t >= STREAM_START && (
          <div style={{ padding: "0 20px" }}>
            <StreamingText lines={RESPONSE_LINES} progress={streamP} />
          </div>
        )}

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* ── Bypass permissions bar ──────────────────────────────── */}
        <div
          style={{
            padding: "8px 20px 10px",
            fontSize: 14,
            color: CC.dim,
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <span style={{ color: CC.claude }}>▸▸</span>
          <span style={{ color: CC.claude, fontWeight: 600 }}>bypass permissions on</span>
          <span style={{ color: CC.subtle }}>
            (shift+tab to cycle) · esc to interrupt
          </span>
        </div>
      </div>
    </div>
  );
};
