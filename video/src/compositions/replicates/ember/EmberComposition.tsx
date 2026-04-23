import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  interpolate,
} from "remotion";
import { loadFont } from "@remotion/google-fonts/Inter";

const { fontFamily } = loadFont("normal", {
  subsets: ["latin"],
  weights: ["300", "400", "500"],
});

const FPS = 24;
const DURATION = Math.ceil(9.045 * FPS);
const s = (sec: number) => Math.round(sec * FPS);

const TYPER_ROSE = [250, 201, 207] as const;
const EMBER_ROSE = [254, 186, 189] as const;

/* ═══════ background — very subtle, barely visible warm haze ═══════ */

const DotGrid: React.FC = () => {
  const dots: React.ReactNode[] = [];
  const sp = 16;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 14; c++) {
      dots.push(
        <circle key={`tl${r}_${c}`} cx={30 + c * sp} cy={30 + r * sp} r={1} fill="rgba(255,255,255,0.04)" />,
        <circle key={`tr${r}_${c}`} cx={1920 - 30 - c * sp} cy={30 + r * sp} r={1} fill="rgba(255,255,255,0.04)" />,
      );
    }
  }
  return (
    <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} viewBox="0 0 1920 1080">
      {dots}
    </svg>
  );
};

const Background: React.FC = () => {
  const frame = useCurrentFrame();
  const cx = interpolate(frame, [0, DURATION], [64, 54]);
  const cy = interpolate(frame, [0, DURATION], [35, 45]);
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", inset: 0, background: "#000" }} />
      <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse 80% 90% at ${cx}% ${cy}%, rgba(60,22,10,0.04) 0%, transparent 75%)` }} />
      <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse 40% 50% at ${cx - 2}% ${cy + 3}%, rgba(90,32,16,0.03) 0%, transparent 65%)` }} />
      <DotGrid />
    </AbsoluteFill>
  );
};

/* ═══════ easing ═══════ */
const easeIn = (t: number, power: number): number => Math.pow(Math.max(0, Math.min(1, t)), power);

/* ═══════ typewriter — NO ZOOM, just char-by-char with rose→white ═══════ */

const TypewriterScene: React.FC<{
  text: string;
  typeStart: number;
  typeEnd: number;
  wipeStart: number;
  wipeEnd: number;
  fontSize?: number;
  typePower?: number;
}> = ({ text, typeStart, typeEnd, wipeStart, wipeEnd, fontSize = 70, typePower = 2.8 }) => {
  const frame = useCurrentFrame();
  const len = text.length;

  if (frame < typeStart || frame > wipeEnd) return null;

  let visibleStart = 0;
  let visibleEnd = 0;
  let phase: "typing" | "hold" | "wiping" = "hold";

  if (frame < typeEnd) {
    phase = "typing";
    const t = (frame - typeStart) / (typeEnd - typeStart);
    visibleEnd = Math.min(len, Math.max(1, Math.round(len * easeIn(t, typePower))));
  } else if (frame < wipeStart) {
    phase = "hold";
    visibleEnd = len;
  } else {
    phase = "wiping";
    const t = (frame - wipeStart) / (wipeEnd - wipeStart);
    const removed = Math.min(len, Math.round(len * easeIn(t, 2)));
    visibleStart = removed;
    visibleEnd = len;
  }

  if (visibleEnd <= visibleStart) return null;

  return (
    <AbsoluteFill style={{ display: "flex", justifyContent: "center", alignItems: "center" }}>
      <div style={{
        fontFamily, fontSize, fontWeight: 400,
        letterSpacing: "-0.02em", whiteSpace: "nowrap",
      }}>
        {text.split("").map((ch, i) => {
          if (i < visibleStart || i >= visibleEnd) return null;

          if (phase === "typing") {
            const currentT = (frame - typeStart) / (typeEnd - typeStart);
            const charThreshold = i / len;
            const age = (easeIn(currentT, 2.8) - charThreshold) * (typeEnd - typeStart);
            const colorT = interpolate(age, [0, 5], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
            const r = interpolate(colorT, [0, 1], [TYPER_ROSE[0], 255]);
            const g = interpolate(colorT, [0, 1], [TYPER_ROSE[1], 255]);
            const b = interpolate(colorT, [0, 1], [TYPER_ROSE[2], 255]);
            return <span key={i} style={{ color: `rgb(${r},${g},${b})` }}>{ch}</span>;
          }

          if (phase === "wiping") {
            const dist = i - visibleStart;
            const op = interpolate(dist, [0, 2], [0.2, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
            return <span key={i} style={{ color: `rgba(255,255,255,${op})` }}>{ch}</span>;
          }

          return <span key={i} style={{ color: "white" }}>{ch}</span>;
        })}
      </div>
    </AbsoluteFill>
  );
};

/* ═══════ logos — bigger to match original ═══════ */

const logoStyle = (w: number, h: number): React.CSSProperties => ({
  width: w, height: h, minWidth: w, minHeight: h, flexShrink: 0,
});

const Logo1: React.FC = () => (
  <div style={logoStyle(180, 180)}>
    <svg width="100%" height="100%" viewBox="0 0 100 100" fill="white">
      <polygon points="50,5 62,32 50,24 38,32" />
      <polygon points="95,50 68,62 76,50 68,38" />
      <polygon points="50,95 38,68 50,76 62,68" />
      <polygon points="5,50 32,38 24,50 32,62" />
      <rect x="36" y="36" width="28" height="28" rx="4" fill="black" />
    </svg>
  </div>
);

const Logo2: React.FC = () => (
  <div style={logoStyle(200, 140)}>
    <svg width="100%" height="100%" viewBox="0 0 120 80" fill="none" stroke="white" strokeWidth="6" strokeLinejoin="round">
      <polyline points="8,8 52,40 8,72" />
      <line x1="8" y1="8" x2="8" y2="72" />
      <polyline points="112,8 68,40 112,72" />
      <line x1="112" y1="8" x2="112" y2="72" />
    </svg>
  </div>
);

const Logo3: React.FC = () => (
  <div style={logoStyle(200, 120)}>
    <svg width="100%" height="100%" viewBox="0 0 120 72" fill="none" stroke="white" strokeWidth="3.5">
      <path d="M8,36 Q60,-2 112,36 Q60,74 8,36 Z" />
      <circle cx="60" cy="36" r="16" />
      <ellipse cx="60" cy="36" rx="7" ry="16" />
      <line x1="44" y1="36" x2="76" y2="36" />
      <path d="M46,27 Q60,23 74,27" />
      <path d="M46,45 Q60,49 74,45" />
    </svg>
  </div>
);

/* ═══════ helpers ═══════ */

const op = (frame: number, inS: number, inE: number, outS: number, outE: number) => {
  const fi = interpolate(frame, [inS, inE], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const fo = interpolate(frame, [outS, outE], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return fi * fo;
};

const CENTER: React.CSSProperties = { display: "flex", justifyContent: "center", alignItems: "center" };

/* ═══════ main composition ═══════ */

export const EmberComposition: React.FC = () => {
  const frame = useCurrentFrame();

  // ─── "on": smooth scale-up, s(3.67)→s(4.42) ───
  const onStart = s(3.67);
  const onEnd = s(4.42);
  const onOp = op(frame, onStart, onStart + 2, onEnd - 2, onEnd);
  const onT = interpolate(frame, [onStart, onEnd], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const smooth = onT * onT * (3 - 2 * onT);
  const onScale = interpolate(smooth, [0, 1], [1, 6]);

  // ─── "Ember protocol": zoom-out + per-char rack focus ───
  const EP_TEXT = "Ember protocol";
  const epStart = s(4.42);
  const epEnd = s(4.83);
  const epOp = op(frame, epStart, epStart + 2, epEnd - 3, epEnd);
  const epRel = Math.max(0, frame - epStart);
  const epScale = interpolate(epRel, [0, 14], [1.12, 1.0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const epBaseBlur = interpolate(epRel, [0, 10], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // ─── Logos ───
  const l1Op = op(frame, s(4.83), s(4.83) + 3, s(5.33) - 3, s(5.33));
  const l2Op = op(frame, s(5.33), s(5.33) + 3, s(5.67) - 3, s(5.67));
  const l3Op = op(frame, s(5.67), s(5.67) + 3, s(6.04) - 3, s(6.04));

  // ─── Final card — quick fade-in, no stagger (matches original) ───
  const cardStart = s(6.04);
  const cardOp = interpolate(frame, [cardStart, cardStart + 4], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const cardFo = interpolate(frame, [s(8.5), DURATION], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill>
      <Background />

      {/* "Launching the first ever" — fixed size, no zoom */}
      <TypewriterScene
        text="Launching the first ever"
        typeStart={s(0.12)}
        typeEnd={s(1.0)}
        wipeStart={s(1.75)}
        wipeEnd={s(2.17)}
        fontSize={70}
      />

      {/* "prediction market vault" — faster typing (milder ease) */}
      <TypewriterScene
        text="prediction market vault"
        typeStart={s(2.17)}
        typeEnd={s(2.83)}
        wipeStart={s(3.5)}
        wipeEnd={s(3.67)}
        fontSize={70}
        typePower={1.0}
      />

      {/* "on" — scale-up */}
      {onOp > 0 && (
        <AbsoluteFill style={{ ...CENTER, opacity: onOp }}>
          <div style={{
            fontFamily, fontSize: 67, fontWeight: 300,
            color: "white", letterSpacing: "-0.02em",
            transform: `scale(${onScale})`,
          }}>on</div>
        </AbsoluteFill>
      )}

      {/* "Ember protocol" — centered, zoom-out + per-char rack focus blur */}
      {epOp > 0 && (
        <AbsoluteFill style={{ ...CENTER, opacity: epOp }}>
          <div style={{
            transform: `scale(${epScale})`,
            fontFamily, fontSize: 168, fontWeight: 300,
            letterSpacing: "-0.03em",
            whiteSpace: "nowrap",
            textShadow: "0 0 60px rgba(254,186,189,0.12)",
          }}>
            {EP_TEXT.split("").map((ch, i) => {
              if (ch === " ") return <span key={i}>{"\u00A0"}</span>;
              const center = EP_TEXT.length / 2;
              const dist = Math.abs(i - center) / center;
              const charBlur = epBaseBlur * (2 + 6 * dist);
              return (
                <span key={i} style={{
                  color: `rgb(${EMBER_ROSE.join(",")})`,
                  filter: charBlur > 0.2 ? `blur(${charBlur}px)` : undefined,
                  display: "inline-block",
                }}>{ch}</span>
              );
            })}
          </div>
        </AbsoluteFill>
      )}

      {/* Logos */}
      {l1Op > 0 && <AbsoluteFill style={{ ...CENTER, opacity: l1Op }}><Logo1 /></AbsoluteFill>}
      {l2Op > 0 && <AbsoluteFill style={{ ...CENTER, opacity: l2Op }}><Logo2 /></AbsoluteFill>}
      {l3Op > 0 && <AbsoluteFill style={{ ...CENTER, opacity: l3Op }}><Logo3 /></AbsoluteFill>}

      {/* Final card — quick fade-in, all at once */}
      {frame >= cardStart && (
        <AbsoluteFill style={{ ...CENTER, flexDirection: "column", opacity: cardOp * cardFo }}>
          <div style={{ fontFamily, fontSize: 32, fontWeight: 400, color: "white", marginBottom: 10 }}>
            Live Now at
          </div>
          <div style={{
            fontFamily, fontSize: 110, fontWeight: 500, color: "white",
            letterSpacing: "-0.03em",
          }}>ember.so</div>
          <div style={{
            position: "absolute", bottom: 50, textAlign: "center",
            fontFamily, fontSize: 12, color: "rgba(255,255,255,0.3)",
            lineHeight: "1.6",
          }}>
            Disclaimer: This vault takes directional exposure, carries risk, and is not principal-protected.
            <br />
            Prediction markets can be volatile. Please review the FAQs and ensure you understand the product and risks before depositing.
          </div>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};

export const emberMeta = {
  id: "Ember-Replicate",
  component: EmberComposition,
  width: 1920,
  height: 1080,
  fps: FPS,
  durationInFrames: DURATION,
};
