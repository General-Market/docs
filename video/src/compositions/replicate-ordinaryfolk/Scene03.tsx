import React, { useMemo } from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Sequence,
  Easing,
} from "remotion";
import { noise2D } from "@remotion/noise";
import { CameraMotionBlur } from "@remotion/motion-blur";

/* ─── bezier / motion helpers ─── */
/** quadratic bezier — 3-point arc for particle trajectories */
function quadBezier(t: number, p0: number, p1: number, p2: number): number {
  const u = 1 - t;
  return u * u * p0 + 2 * u * t * p1 + t * t * p2;
}

/** cubic bezier — 4-point curve for complex trajectories */
function cubicBezier(t: number, p0: number, p1: number, p2: number, p3: number): number {
  const u = 1 - t;
  return u*u*u*p0 + 3*u*u*t*p1 + 3*u*t*t*p2 + t*t*t*p3;
}

/** deceleration curve: fast start, asymptotic settle */
function decel(t: number, rate = 3.0): number {
  return 1 - Math.exp(-t * rate);
}

/** velocity-proportional blur — 0.2 scale, 6px cap per spec */
function motionBlurAmount(
  currX: number,
  currY: number,
  prevX: number,
  prevY: number,
  scale = 0.2,
  max = 6,
): number {
  const dx = currX - prevX;
  const dy = currY - prevY;
  return Math.min(Math.sqrt(dx * dx + dy * dy) * scale, max);
}

/** organic micro-wobble for any positioned element */
function organicWobble(
  seed: string,
  frame: number,
  amplitudeX = 3,
  amplitudeY = 2,
  speed = 0.02,
): { x: number; y: number; rot: number } {
  return {
    x: noise2D(seed + "wx", frame * speed, 0) * amplitudeX,
    y: noise2D(seed + "wy", 0, frame * speed) * amplitudeY,
    rot: noise2D(seed + "wr", frame * speed * 0.7, 0.5) * 1.5,
  };
}

/* ─── palette ─── */
const PINK = "#E8458B";
const PURPLE = "#7B61FF";
const BLUE = "#4285F4";
const CORAL = "#F28B82";
const LAVENDER = "#C4B5FD";
const BG = "#F0EFF5";
const BG_WARM = "#F5F0EE";
const DARK = "#1A1A2E";

/* ─── deterministic seeded random ─── */
function seededRandom(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/* ─── particle type ─── */
interface Particle {
  id: number;
  /** origin x */
  x: number;
  /** origin y */
  y: number;
  /** bezier control point offset (perpendicular to travel direction) */
  cpOffX: number;
  cpOffY: number;
  /** end point offset from origin */
  endX: number;
  endY: number;
  size: number;
  color: string;
  speed: number;
  angle: number;
  noiseOffsetX: number;
  noiseOffsetY: number;
  delay: number;
  shape: "circle" | "diamond" | "star";
}

function generateParticles(count: number, seed: number): Particle[] {
  const rng = seededRandom(seed);
  const colors = [PINK, PURPLE, BLUE, CORAL, LAVENDER, "#A78BFA", "#F472B6", "#60A5FA"];
  const shapes: Particle["shape"][] = ["circle", "circle", "circle", "diamond", "star"];
  return Array.from({ length: count }, (_, i) => {
    const angle = (rng() - 0.3) * Math.PI * 0.8;
    const dist = 80 + rng() * 280;
    // control point perpendicular to travel direction for arc curvature
    const perpAngle = angle + (rng() > 0.5 ? Math.PI / 2 : -Math.PI / 2);
    const cpDist = 40 + rng() * 120;
    return {
      id: i,
      x: 500 + rng() * 280,
      y: 300 + (rng() - 0.5) * 120,
      cpOffX: Math.cos(perpAngle) * cpDist + Math.cos(angle) * dist * 0.5,
      cpOffY: Math.sin(perpAngle) * cpDist + Math.sin(angle) * dist * 0.5,
      endX: Math.cos(angle) * dist,
      endY: Math.sin(angle) * dist,
      size: 2 + rng() * 10,
      color: colors[Math.floor(rng() * colors.length)],
      speed: 0.5 + rng() * 3,
      angle,
      noiseOffsetX: rng() * 1000,
      noiseOffsetY: rng() * 1000,
      delay: rng() * 15,
      shape: shapes[Math.floor(rng() * shapes.length)],
    };
  });
}

/* ─── Sparkle Star SVG ─── */
const Sparkle: React.FC<{
  x: number;
  y: number;
  size: number;
  color: string;
  opacity: number;
  rotation: number;
}> = ({ x, y, size, color, opacity, rotation }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    style={{
      position: "absolute",
      left: x - size / 2,
      top: y - size / 2,
      opacity,
      transform: `rotate(${rotation}deg)`,
    }}
  >
    <path
      d="M12 0L14.5 9.5L24 12L14.5 14.5L12 24L9.5 14.5L0 12L9.5 9.5Z"
      fill={color}
    />
  </svg>
);

/* ─── Particle Field — quadratic bezier arcs + deceleration + motion blur ─── */
const ParticleField: React.FC<{
  frame: number;
  fps: number;
  particles: Particle[];
  phase: "explode" | "swirl" | "converge" | "scatter";
}> = ({ frame, fps, particles, phase }) => {
  return (
    <>
      {particles.map((p) => {
        const rawT = Math.max(0, frame - p.delay) / fps;
        const noiseX = noise2D("px" + p.id, rawT * 0.8 + p.noiseOffsetX, 0) * 40;
        const noiseY = noise2D("py" + p.id, 0, rawT * 0.8 + p.noiseOffsetY) * 40;
        const wob = organicWobble("p" + p.id, frame, 2.5, 2, 0.025);

        let px: number, py: number, opacity: number, scale: number;
        // previous-frame position for velocity blur
        let prevPx: number, prevPy: number;

        if (phase === "explode") {
          // Decelerated progress along quadratic bezier arc
          const tNorm = Math.min(rawT / 1.2, 1); // normalize to ~1.2s lifespan
          const d = decel(tNorm * 3, 2.8); // fast start, asymptotic settle
          // Bezier arc: origin → control → end
          px = quadBezier(d, p.x, p.x + p.cpOffX, p.x + p.endX) + noiseX + wob.x;
          py = quadBezier(d, p.y, p.y + p.cpOffY, p.y + p.endY) + noiseY + wob.y;
          // Prev frame for blur
          const dPrev = decel(Math.max(0, tNorm - 0.04) * 3, 2.8);
          prevPx = quadBezier(dPrev, p.x, p.x + p.cpOffX, p.x + p.endX) + noiseX;
          prevPy = quadBezier(dPrev, p.y, p.y + p.cpOffY, p.y + p.endY) + noiseY;
          opacity = interpolate(tNorm, [0, 0.04, 0.5, 0.85, 1], [0, 1, 0.9, 0.4, 0], {
            extrapolateRight: "clamp",
          });
          scale = interpolate(tNorm, [0, 0.1, 0.6, 1], [0.15, 1.1, 0.7, 0.15], {
            extrapolateRight: "clamp",
          });
        } else if (phase === "swirl") {
          const swirlAngle = p.angle + rawT * 2;
          const dist = 50 + p.speed * rawT * 40;
          px = 640 + Math.cos(swirlAngle) * dist + noiseX * 0.5 + wob.x;
          py = 360 + Math.sin(swirlAngle) * dist + noiseY * 0.5 + wob.y;
          const prevAngle = p.angle + (rawT - 0.033) * 2;
          prevPx = 640 + Math.cos(prevAngle) * (dist - 1.3);
          prevPy = 360 + Math.sin(prevAngle) * (dist - 1.3);
          opacity = interpolate(rawT, [0, 0.3, 2, 2.5], [1, 0.8, 0.6, 0], {
            extrapolateRight: "clamp",
          });
          scale = 0.7 + Math.sin(rawT * 3) * 0.3;
        } else if (phase === "converge") {
          const targetX = 640;
          const targetY = 360;
          const startX = p.x + Math.cos(p.angle) * 300 + noiseX;
          const startY = p.y + Math.sin(p.angle) * 200 + noiseY;
          const prog = interpolate(rawT, [0, 1.5], [0, 1], {
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.25, 0.46, 0.45, 0.94),
          });
          // Arc via bezier control point offset from midpoint
          const midX = (startX + targetX) / 2 + p.cpOffX * 0.5;
          const midY = (startY + targetY) / 2 + p.cpOffY * 0.5;
          px = quadBezier(prog, startX, midX, targetX) + wob.x;
          py = quadBezier(prog, startY, midY, targetY) + wob.y;
          const progPrev = Math.max(0, prog - 0.03);
          prevPx = quadBezier(progPrev, startX, midX, targetX);
          prevPy = quadBezier(progPrev, startY, midY, targetY);
          opacity = interpolate(rawT, [0, 0.2, 1.2, 1.5], [0, 1, 1, 0], {
            extrapolateRight: "clamp",
          });
          scale = interpolate(prog, [0, 0.5, 1], [1, 0.8, 0.2], {
            extrapolateRight: "clamp",
          });
        } else {
          // scatter — bezier arcs outward
          const tNorm = Math.min(rawT / 0.8, 1);
          const d = decel(tNorm * 2.5, 2.0);
          const dist = p.speed * 200;
          const ex = p.x + Math.cos(p.angle) * dist;
          const ey = p.y + Math.sin(p.angle) * dist;
          px = quadBezier(d, p.x, p.x + p.cpOffX * 0.7, ex) + noiseX * 2 + wob.x;
          py = quadBezier(d, p.y, p.y + p.cpOffY * 0.7, ey) + noiseY * 2 + wob.y;
          const dPrev = decel(Math.max(0, tNorm - 0.04) * 2.5, 2.0);
          prevPx = quadBezier(dPrev, p.x, p.x + p.cpOffX * 0.7, ex);
          prevPy = quadBezier(dPrev, p.y, p.y + p.cpOffY * 0.7, ey);
          opacity = interpolate(rawT, [0, 0.1, 0.5, 1], [1, 0.8, 0.4, 0], {
            extrapolateRight: "clamp",
          });
          scale = interpolate(rawT, [0, 0.5], [1, 0], {
            extrapolateRight: "clamp",
          });
        }

        if (opacity <= 0) return null;

        const s = p.size * scale;
        const blur = motionBlurAmount(px, py, prevPx, prevPy);
        const sizeBlur = s > 5 ? (s - 5) * 0.12 : 0;
        const totalBlur = Math.max(blur, sizeBlur);
        const style: React.CSSProperties = {
          position: "absolute",
          left: px - s / 2,
          top: py - s / 2,
          width: s,
          height: s,
          opacity,
          borderRadius: p.shape === "circle" ? "50%" : p.shape === "diamond" ? "2px" : "50%",
          backgroundColor: p.color,
          transform:
            p.shape === "diamond"
              ? `rotate(${45 + wob.rot}deg)`
              : p.shape === "star"
                ? `rotate(${rawT * 60 + wob.rot}deg)`
                : `rotate(${wob.rot}deg)`,
          filter: totalBlur > 0.3 ? `blur(${totalBlur.toFixed(1)}px)` : undefined,
        };

        return <div key={p.id} style={style} />;
      })}
    </>
  );
};

/* ─── Segment 1: Particle Explosion + Gemini Logo ─── */
const SegParticleExplosion: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const particles = useMemo(() => generateParticles(120, 42), []);
  const wob = organicWobble("pexp", frame, 4, 3, 0.025);

  // Particles explode outward from center in a swirl
  const phase: "explode" | "swirl" = frame < fps * 0.8 ? "explode" : "swirl";

  return (
    <AbsoluteFill style={{ backgroundColor: BG }}>
      {/* Soft radial glow at center — wobbles with particle field */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: 400,
          height: 400,
          transform: `translate(calc(-50% + ${wob.x}px), calc(-50% + ${wob.y}px))`,
          background: `radial-gradient(circle, rgba(123,97,255,0.15) 0%, transparent 70%)`,
          opacity: interpolate(frame, [0, 10, fps * 1.5], [0, 0.8, 0], {
            extrapolateRight: "clamp",
          }),
        }}
      />
      <ParticleField frame={frame} fps={fps} particles={particles} phase={phase} />
    </AbsoluteFill>
  );
};

/* ─── Segment 2: Gemini Text Materializes — per-letter arc entrances ─── */
const GEMINI_LETTERS = "Gemini".split("");
/** Per-letter arc entrance angles (radians) — varied for organic feel */
const LETTER_ARC_ANGLES = [-0.9, -0.4, 0.3, -0.6, 0.7, -0.2];
const LETTER_ARC_DIST = [60, 45, 55, 50, 65, 40];

const SegGeminiReveal: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const particles = useMemo(() => generateParticles(60, 99), []);

  // Sparkle animations
  const sparkle1Op = interpolate(
    frame % (fps * 1.2),
    [0, fps * 0.3, fps * 0.6, fps * 1.2],
    [0, 1, 1, 0],
    { extrapolateRight: "clamp" }
  );
  const sparkle1Rot = interpolate(frame, [0, fps * 2], [0, 360]);

  const sparkle2Op = interpolate(
    (frame + fps * 0.4) % (fps * 1.5),
    [0, fps * 0.3, fps * 0.8, fps * 1.5],
    [0, 1, 0.8, 0],
    { extrapolateRight: "clamp" }
  );

  return (
    <AbsoluteFill style={{ backgroundColor: BG }}>
      {/* Residual particles fading */}
      <div style={{ opacity: interpolate(frame, [0, fps * 2], [0.5, 0], { extrapolateRight: "clamp" }) }}>
        <ParticleField frame={frame} fps={fps} particles={particles} phase="scatter" />
      </div>

      {/* Gemini text — per-letter arc entrance */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
          display: "flex",
          alignItems: "baseline",
          fontSize: 72,
          fontFamily: "'Google Sans', 'Product Sans', sans-serif",
          fontWeight: 400,
          letterSpacing: -1,
        }}
      >
        {GEMINI_LETTERS.map((letter, i) => {
          const delay = i * 3; // stagger: 3 frames per letter
          const letterSpring = spring({
            frame: frame - delay,
            fps,
            config: { damping: 14, stiffness: 130, mass: 0.7 },
          });
          const wob = organicWobble("gl" + i, frame, 1.5, 1, 0.018);
          // Arc entrance: each letter arrives from its own angle
          const arcAngle = LETTER_ARC_ANGLES[i];
          const arcDist = LETTER_ARC_DIST[i];
          const prog = interpolate(letterSpring, [0, 1], [0, 1]);
          const arcX = Math.cos(arcAngle) * arcDist * (1 - prog);
          const arcY = Math.sin(arcAngle) * arcDist * (1 - prog);
          // Velocity blur on entrance
          const prevProg = Math.max(0, prog - 0.06);
          const prevArcX = Math.cos(arcAngle) * arcDist * (1 - prevProg);
          const prevArcY = Math.sin(arcAngle) * arcDist * (1 - prevProg);
          const blur = motionBlurAmount(arcX, arcY, prevArcX, prevArcY);

          return (
            <span
              key={i}
              style={{
                display: "inline-block",
                background: `linear-gradient(90deg, ${BLUE} 0%, ${PURPLE} 45%, ${PINK} 100%)`,
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                opacity: interpolate(letterSpring, [0, 0.3], [0, 1], { extrapolateRight: "clamp" }),
                transform: `translate(${arcX + wob.x}px, ${arcY + wob.y}px) scale(${interpolate(letterSpring, [0, 1], [0.7, 1])}) rotate(${wob.rot * 0.5}deg)`,
                filter: blur > 0.3 ? `blur(${blur.toFixed(1)}px)` : undefined,
              }}
            >
              {letter}
            </span>
          );
        })}
      </div>

      {/* Sparkles — main one above the 'i' dot, smaller ones flanking */}
      <Sparkle x={640} y={300} size={36} color={PURPLE} opacity={sparkle1Op} rotation={sparkle1Rot} />
      <Sparkle x={700} y={310} size={20} color={BLUE} opacity={sparkle2Op} rotation={-sparkle1Rot * 0.6} />
      <Sparkle
        x={720}
        y={340}
        size={12}
        color={PINK}
        opacity={interpolate(frame, [fps * 0.5, fps * 1, fps * 2, fps * 2.5], [0, 0.8, 0.8, 0], {
          extrapolateRight: "clamp",
        })}
        rotation={sparkle1Rot * 1.2}
      />
    </AbsoluteFill>
  );
};

/* ─── Segment 3: Desktop UI Mockup — perspective tilt w/ spring settle ─── */
const SegDesktopUI: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Spring settle: overshoots then settles — lower damping for visible bounce
  const enterSpring = spring({ frame, fps, config: { damping: 11, stiffness: 90, mass: 1.2 } });
  const wob = organicWobble("dui", frame, 1.2, 0.8, 0.015);
  const uiScale = interpolate(enterSpring, [0, 1], [1.12, 1]);
  const uiY = interpolate(enterSpring, [0, 1], [55, 0]) + wob.y;
  // Perspective tilt: enters tilted, settles to subtle rest tilt
  const uiRotX = interpolate(enterSpring, [0, 1], [8, 2]) + wob.rot * 0.3;
  const uiRotY = wob.x * 0.15; // subtle lateral wobble
  const uiOpacity = interpolate(enterSpring, [0, 0.3], [0, 1], { extrapolateRight: "clamp" });
  // Velocity blur on entrance (first ~15 frames)
  const prevY = interpolate(Math.max(0, enterSpring - 0.05), [0, 1], [55, 0]);
  const entranceBlur = motionBlurAmount(0, uiY, 0, prevY);

  // "Hello, Lisa." text typing
  const helloText = "Hello, Lisa.";
  const howText = "How can I help you today?";
  const helloChars = Math.floor(
    interpolate(frame, [fps * 0.3, fps * 0.8], [0, helloText.length], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    })
  );
  const howChars = Math.floor(
    interpolate(frame, [fps * 0.9, fps * 1.8], [0, howText.length], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    })
  );

  // Cards slide up
  const cardsSpring = spring({ frame: frame - fps * 1.5, fps, config: { damping: 15 } });
  const cardsY = interpolate(cardsSpring, [0, 1], [40, 0]);
  const cardsOp = interpolate(cardsSpring, [0, 1], [0, 1]);

  const cards = [
    { text: "Help me find YouTube videos to care for a plant", icon: "youtube" },
    { text: "Brainstorm presentation ideas about a topic", icon: "compass" },
    { text: "What are some tips to improve public speaking skills?", icon: "mic" },
    { text: "Come up with a product name for a new app", icon: "pen" },
  ];

  return (
    <AbsoluteFill style={{ backgroundColor: BG }}>
      {/* Soft gradient backdrop */}
      <div
        style={{
          position: "absolute",
          width: "100%",
          height: "100%",
          background: `linear-gradient(135deg, rgba(196,181,253,0.15) 0%, rgba(232,69,139,0.08) 50%, rgba(66,133,244,0.1) 100%)`,
        }}
      />

      {/* Browser-like container with iridescent border */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: 904,
          height: 524,
          transform: `translate(-50%, -50%) translateY(${uiY}px) perspective(1200px) rotateX(${uiRotX}deg) rotateY(${uiRotY}deg) scale(${uiScale})`,
          opacity: uiOpacity,
          filter: entranceBlur > 0.3 ? `blur(${entranceBlur.toFixed(1)}px)` : undefined,
          borderRadius: 18,
          background: `linear-gradient(135deg, ${LAVENDER}88, ${PINK}44, ${BLUE}66, ${PURPLE}44)`,
          padding: 2,
        }}
      >
      <div
        style={{
          width: "100%",
          height: "100%",
          backgroundColor: "#FFFFFF",
          borderRadius: 16,
          boxShadow: "0 20px 60px rgba(0,0,0,0.1), 0 4px 12px rgba(0,0,0,0.05)",
          overflow: "hidden",
          position: "relative",
        }}
      >
        {/* Top bar */}
        <div
          style={{
            height: 48,
            borderBottom: "1px solid #E8E8EC",
            display: "flex",
            alignItems: "center",
            padding: "0 20px",
            gap: 16,
          }}
        >
          <div style={{ fontSize: 18, color: "#666" }}>&#9776;</div>
          <div
            style={{
              fontSize: 16,
              fontFamily: "'Google Sans', sans-serif",
              color: "#444",
              fontWeight: 500,
            }}
          >
            Gemini{" "}
            <span style={{ fontSize: 10, color: "#999" }}>&#9660;</span>
          </div>
          <div style={{ flex: 1 }} />
          {/* + button */}
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              backgroundColor: "#E8E8EC",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 18,
              color: "#666",
            }}
          >
            +
          </div>
        </div>

        {/* Content area */}
        <div
          style={{
            padding: "50px 60px 30px",
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
          }}
        >
          {/* Hello text with gradient */}
          <div
            style={{
              fontSize: 38,
              fontFamily: "'Google Sans', sans-serif",
              fontWeight: 400,
              background: `linear-gradient(135deg, ${BLUE}, ${PURPLE}, ${PINK})`,
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              lineHeight: 1.2,
              marginBottom: 8,
            }}
          >
            {helloText.slice(0, helloChars)}
            {helloChars < helloText.length && (
              <span style={{ opacity: frame % 20 < 10 ? 1 : 0, WebkitTextFillColor: BLUE }}>|</span>
            )}
          </div>

          {/* How can I help text */}
          <div
            style={{
              fontSize: 34,
              fontFamily: "'Google Sans', sans-serif",
              fontWeight: 400,
              color: "#B0B0B8",
              lineHeight: 1.2,
              marginBottom: 40,
            }}
          >
            {howText.slice(0, howChars)}
          </div>

          {/* Suggestion cards */}
          <div
            style={{
              display: "flex",
              gap: 14,
              opacity: cardsOp,
              transform: `translateY(${cardsY}px)`,
            }}
          >
            {cards.map((card, i) => {
              const cardDelay = i * 3;
              const cardSpring = spring({
                frame: frame - fps * 1.5 - cardDelay,
                fps,
                config: { damping: 18 },
              });
              const cScale = interpolate(cardSpring, [0, 1], [0.9, 1]);
              return (
                <div
                  key={i}
                  style={{
                    width: 165,
                    height: 100,
                    backgroundColor: "#F6F6FA",
                    borderRadius: 12,
                    padding: "14px 12px",
                    fontSize: 12,
                    fontFamily: "'Google Sans', sans-serif",
                    color: "#444",
                    lineHeight: 1.35,
                    transform: `scale(${cScale})`,
                    opacity: interpolate(cardSpring, [0, 1], [0, 1]),
                    position: "relative",
                  }}
                >
                  {card.text}
                  {/* Recognizable icon shapes */}
                  <div
                    style={{
                      position: "absolute",
                      bottom: 10,
                      left: 12,
                      width: 26,
                      height: 26,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {card.icon === "youtube" && (
                      <div style={{ width: 26, height: 18, borderRadius: 5, backgroundColor: "#FF0000", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <div style={{ width: 0, height: 0, borderLeft: "8px solid white", borderTop: "5px solid transparent", borderBottom: "5px solid transparent" }} />
                      </div>
                    )}
                    {card.icon === "compass" && (
                      <div style={{ width: 24, height: 24, borderRadius: "50%", backgroundColor: "#E8E8EC", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <div style={{ width: 12, height: 12, borderRadius: "50%", border: "2px solid #666", position: "relative" }}>
                          <div style={{ position: "absolute", top: 2, left: "50%", transform: "translateX(-50%)", width: 2, height: 4, backgroundColor: "#666" }} />
                        </div>
                      </div>
                    )}
                    {card.icon === "mic" && (
                      <div style={{ width: 24, height: 24, borderRadius: "50%", backgroundColor: `${PURPLE}22`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <div style={{ width: 8, height: 14, borderRadius: 4, backgroundColor: PURPLE }} />
                      </div>
                    )}
                    {card.icon === "pen" && (
                      <div style={{ width: 24, height: 24, borderRadius: "50%", backgroundColor: `${BLUE}22`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <div style={{ width: 3, height: 14, backgroundColor: BLUE, borderRadius: 1, transform: "rotate(-45deg)" }} />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Bottom input bar */}
        <div
          style={{
            position: "absolute",
            bottom: 20,
            left: 40,
            right: 40,
            height: 44,
            backgroundColor: "#F2F2F6",
            borderRadius: 22,
            display: "flex",
            alignItems: "center",
            padding: "0 20px",
            fontSize: 13,
            color: "#AAA",
            fontFamily: "'Google Sans', sans-serif",
            opacity: interpolate(frame, [fps * 2, fps * 2.5], [0, 0.7], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
          }}
        >
          Enter a prompt here
        </div>
      </div>
      </div>

      {/* Disclaimer text */}
      <div
        style={{
          position: "absolute",
          bottom: 24,
          left: 40,
          fontSize: 11,
          fontFamily: "'Google Sans', sans-serif",
          color: "#B0B0B8",
          opacity: interpolate(frame, [fps * 1.5, fps * 2], [0, 0.6], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        Sequences shortened and simulated.
      </div>
    </AbsoluteFill>
  );
};

/* ─── Segment 4: "It's everything" repeating text wall ─── */
const SegItsEverything: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const wob = organicWobble("itsev", frame, 2, 1.5, 0.02);

  const enterOp = interpolate(frame, [0, 8], [0, 1], { extrapolateRight: "clamp" });
  const exitOp = interpolate(frame, [durationInFrames - 10, durationInFrames], [1, 0], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
  });

  // Scroll the text wall + organic wobble
  const scrollY = interpolate(frame, [0, durationInFrames], [0, -80], {
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.sin),
  }) + wob.y;
  const scrollX = interpolate(frame, [0, durationInFrames], [0, -30], {
    extrapolateRight: "clamp",
  }) + wob.x;

  // The center text is bolder
  const centerScale = spring({
    frame: frame - 5,
    fps,
    config: { damping: 15, stiffness: 120 },
  });

  const rows = 9;
  const cols = 5;

  return (
    <AbsoluteFill
      style={{ backgroundColor: BG, opacity: Math.min(enterOp, exitOp) }}
    >
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: `translate(-50%, -50%) translate(${scrollX}px, ${scrollY}px) rotate(${wob.rot * 0.2}deg)`,
        }}
      >
        {Array.from({ length: rows }, (_, row) =>
          Array.from({ length: cols }, (_, col) => {
            const isCenter = row === 4 && col === 2;
            const dist = Math.sqrt(
              Math.pow(row - 4, 2) + Math.pow(col - 2, 2)
            );
            const opacity = isCenter
              ? 1
              : interpolate(dist, [0, 1, 3], [0.7, 0.35, 0.12], {
                  extrapolateRight: "clamp",
                });
            const fontSize = isCenter ? 42 : 26;
            const fontWeight = isCenter ? 600 : 400;
            const color = isCenter ? DARK : "#9090A0";
            // Per-cell micro wobble — amplitude scales with distance from center
            const cellWob = organicWobble(`ie${row}${col}`, frame, 1 + dist * 0.4, 0.8 + dist * 0.3, 0.015);

            return (
              <div
                key={`${row}-${col}`}
                style={{
                  position: "absolute",
                  left: (col - 2) * 260 + cellWob.x,
                  top: (row - 4) * 48 + cellWob.y,
                  fontSize,
                  fontWeight,
                  fontFamily: "'Google Sans', sans-serif",
                  color,
                  opacity,
                  whiteSpace: "nowrap",
                  transform: isCenter ? `scale(${centerScale})` : `rotate(${cellWob.rot * 0.3}deg)`,
                }}
              >
                It's everything
              </div>
            );
          })
        )}
      </div>
    </AbsoluteFill>
  );
};

/* ─── Segment 5: Google App Icons floating + "you know and love" ─── */
const SegAppsFloat: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Text reveal
  const text1Spring = spring({ frame, fps, config: { damping: 20 } });
  const text2Spring = spring({
    frame: frame - fps * 0.5,
    fps,
    config: { damping: 20 },
  });

  const text1Op = interpolate(text1Spring, [0, 1], [0, 1]);
  const text2Op = interpolate(text2Spring, [0, 1], [0, 1]);

  // App icons with float animation — positioned around text
  const apps = [
    { name: "Maps", color: "#34A853", x: 250, y: 200, icon: "pin" },
    { name: "Gmail", color: "#EA4335", x: 520, y: 150, icon: "mail" },
    { name: "Travel", color: "#4285F4", x: 780, y: 190, icon: "plane" },
    { name: "Docs", color: "#4285F4", x: 160, y: 350, icon: "doc" },
    { name: "YouTube", color: "#FF0000", x: 850, y: 360, icon: "play" },
    { name: "Sheets", color: "#34A853", x: 380, y: 510, icon: "grid" },
    { name: "Drive", color: "#FBBC04", x: 680, y: 500, icon: "triangle" },
  ];

  const { durationInFrames } = useVideoConfig();
  const exitOp = interpolate(frame, [durationInFrames - 10, durationInFrames], [1, 0], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
  });

  return (
    <AbsoluteFill style={{ backgroundColor: BG, opacity: exitOp }}>
      {/* Floating app icons — wobble + motion blur */}
      {apps.map((app, i) => {
        const delay = i * 3;
        const appSpring = spring({
          frame: frame - delay,
          fps,
          config: { damping: 12, stiffness: 80 },
        });
        const appWob = organicWobble("afw" + i, frame, 3, 2.5, 0.02);
        const floatY = noise2D("app" + i, frame / 35, 0) * 14 + appWob.y;
        const floatX = noise2D("appx" + i, 0, frame / 45) * 10 + appWob.x;
        const iconScale = interpolate(appSpring, [0, 1], [0, 1]);
        // Entrance blur
        const prevScale = interpolate(Math.max(0, appSpring - 0.07), [0, 1], [0, 1]);
        const entBlur = motionBlurAmount(0, iconScale * 52, 0, prevScale * 52);

        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: app.x + floatX,
              top: app.y + floatY,
              width: 52,
              height: 52,
              borderRadius: app.icon === "plane" ? "50%" : 12,
              backgroundColor: app.icon === "plane" ? "#E8F0FE" : "white",
              transform: `scale(${iconScale}) rotate(${appWob.rot * 0.4}deg)`,
              opacity: interpolate(appSpring, [0, 1], [0, 1]),
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
              overflow: "hidden",
              filter: entBlur > 0.3 ? `blur(${entBlur.toFixed(1)}px)` : undefined,
            }}
          >
            {app.icon === "pin" && (
              <svg width="28" height="28" viewBox="0 0 24 24">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="#EA4335"/>
                <circle cx="12" cy="9" r="2.5" fill="#B31412"/>
                <path d="M12 2C8.13 2 5 5.13 5 9c0 1.74.5 3.37 1.41 4.84L12 9V2z" fill="#34A853"/>
                <path d="M5 9c0 5.25 7 13 7 13V9H5z" fill="#4285F4" opacity="0.3"/>
              </svg>
            )}
            {app.icon === "mail" && (
              <svg width="28" height="20" viewBox="0 0 28 20">
                <rect x="0" y="0" width="28" height="20" rx="2" fill="white" stroke="#D5D5D5" strokeWidth="0.5"/>
                <path d="M0 2L14 12L28 2" stroke="#EA4335" strokeWidth="2.5" fill="none"/>
                <path d="M0 2L14 12" stroke="#34A853" strokeWidth="2.5" fill="none" opacity="0.7"/>
                <path d="M28 2L14 12" stroke="#FBBC04" strokeWidth="2.5" fill="none" opacity="0.7"/>
              </svg>
            )}
            {app.icon === "plane" && (
              <svg width="24" height="24" viewBox="0 0 24 24">
                <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" fill="#4285F4"/>
              </svg>
            )}
            {app.icon === "doc" && (
              <svg width="24" height="30" viewBox="0 0 24 30">
                <rect x="0" y="0" width="24" height="30" rx="2" fill="#4285F4"/>
                <rect x="5" y="8" width="14" height="2" rx="1" fill="white"/>
                <rect x="5" y="13" width="14" height="2" rx="1" fill="white"/>
                <rect x="5" y="18" width="10" height="2" rx="1" fill="white"/>
              </svg>
            )}
            {app.icon === "play" && (
              <div style={{ width: 36, height: 26, borderRadius: 6, backgroundColor: "#FF0000", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div style={{ width: 0, height: 0, borderLeft: "10px solid white", borderTop: "6px solid transparent", borderBottom: "6px solid transparent" }} />
              </div>
            )}
            {app.icon === "grid" && (
              <svg width="28" height="28" viewBox="0 0 28 28">
                <rect x="0" y="0" width="28" height="28" rx="4" fill="#34A853"/>
                <rect x="6" y="6" width="6" height="6" rx="1" fill="white"/>
                <rect x="16" y="6" width="6" height="6" rx="1" fill="white"/>
                <rect x="6" y="16" width="6" height="6" rx="1" fill="white"/>
                <rect x="16" y="16" width="6" height="6" rx="1" fill="white"/>
              </svg>
            )}
            {app.icon === "triangle" && (
              <svg width="30" height="26" viewBox="0 0 30 26">
                <path d="M15 0L30 26H0Z" fill="#FBBC04"/>
                <path d="M15 0L0 26H15Z" fill="#34A853"/>
                <path d="M15 0L30 26H15Z" fill="#4285F4"/>
              </svg>
            )}
          </div>
        );
      })}

      {/* "you know and love" text */}
      {(() => {
        const txtWob = organicWobble("ykl", frame, 1.5, 1, 0.018);
        const txt1Y = interpolate(text1Spring, [0, 1], [18, 0]);
        const txt2Y = interpolate(text2Spring, [0, 1], [18, 0]);
        return (
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              transform: `translate(-50%, -50%) rotate(${txtWob.rot * 0.15}deg)`,
              display: "flex",
              gap: 12,
              fontSize: 30,
              fontFamily: "'Google Sans', sans-serif",
              fontWeight: 400,
              color: DARK,
            }}
          >
            <span style={{
              opacity: text1Op,
              transform: `translateY(${txt1Y + txtWob.y}px)`,
              display: "inline-block",
            }}>you know</span>
            <span
              style={{
                opacity: text2Op,
                color: BLUE,
                transform: `translateY(${txt2Y + txtWob.y * 0.7}px)`,
                display: "inline-block",
              }}
            >
              and love
            </span>
          </div>
        );
      })()}
    </AbsoluteFill>
  );
};

/* ─── Segment 6: Typing prompt — "Summarize my recent emails..." ─── */
const SegTypingPrompt: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const wob = organicWobble("typr", frame, 1.5, 1, 0.015);

  const fullText = "Summarize my recent emails from Harper Elementary School";
  const charCount = Math.floor(
    interpolate(frame, [0, durationInFrames * 0.85], [0, fullText.length], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    })
  );
  const displayed = fullText.slice(0, charCount);

  const barSpring = spring({ frame, fps, config: { damping: 14, stiffness: 100 } });
  const barOpacity = interpolate(barSpring, [0, 0.3], [0, 1], { extrapolateRight: "clamp" });
  const barY = interpolate(barSpring, [0, 1], [25, 0]);
  const barScale = interpolate(barSpring, [0, 1], [0.96, 1]);
  const exitOp = interpolate(frame, [durationInFrames - 8, durationInFrames], [1, 0], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
  });
  const prevBarY = interpolate(Math.max(0, barSpring - 0.05), [0, 1], [25, 0]);
  const barBlur = motionBlurAmount(0, barY, 0, prevBarY);

  return (
    <AbsoluteFill style={{ backgroundColor: "#FAFAFA", opacity: exitOp }}>
      {/* Input bar */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: `translate(-50%, -50%) translateY(${barY + wob.y}px) scale(${barScale}) rotate(${wob.rot * 0.1}deg)`,
          width: 780,
          opacity: barOpacity,
          filter: barBlur > 0.3 ? `blur(${barBlur.toFixed(1)}px)` : undefined,
        }}
      >
        <div
          style={{
            backgroundColor: "#EDECF2",
            borderRadius: 28,
            padding: "22px 32px",
            fontSize: 26,
            fontFamily: "'Google Sans', sans-serif",
            fontWeight: 400,
            color: "#444",
            minHeight: 36,
            lineHeight: 1.4,
          }}
        >
          {displayed}
          {charCount < fullText.length && (
            <span
              style={{
                display: "inline-block",
                width: 2,
                height: 28,
                backgroundColor: "#666",
                marginLeft: 1,
                opacity: frame % 20 < 12 ? 1 : 0,
                verticalAlign: "text-bottom",
              }}
            />
          )}
        </div>
      </div>

      {/* Disclaimer */}
      <div
        style={{
          position: "absolute",
          bottom: 30,
          left: "50%",
          transform: "translateX(-50%)",
          fontSize: 11,
          fontFamily: "'Google Sans', sans-serif",
          color: "#B0B0B0",
          opacity: interpolate(frame, [fps * 0.5, fps * 1], [0, 0.5], {
            extrapolateRight: "clamp",
          }),
        }}
      >
        Sequences shortened and simulated. With Google Workspace extension enabled. Check the responses for accuracy. Availability varies by country.
      </div>
    </AbsoluteFill>
  );
};

/* ─── Segment 7: Gemini Response Streaming ─── */
const SegGeminiResponse: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const wob = organicWobble("gresp", frame, 1.2, 0.8, 0.012);

  // Workspace chip appears
  const chipSpring = spring({
    frame: frame - fps * 0.3,
    fps,
    config: { damping: 18 },
  });

  // Response text streams in
  const responseLines = [
    "You have two recent emails from Harper Elementary.",
    "",
    "The first email is the Harper Elementary School Newsletter for October 2025. It includes information",
    "about upcoming events, such as Crazy Hat Day on October 8th and the Fall Festival on October 23rd.",
    "",
    "The second email is a call for parent volunteers. It asks parents to sign up by October 15th if they are",
    "interested in volunteering...",
  ];
  const fullResponse = responseLines.join("\n");
  const respChars = Math.floor(
    interpolate(frame, [fps * 0.6, durationInFrames * 0.9], [0, fullResponse.length], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    })
  );

  const enterOp = interpolate(frame, [0, 10], [0, 1], { extrapolateRight: "clamp" });
  const exitOp = interpolate(frame, [durationInFrames - 8, durationInFrames], [1, 0], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
  });

  // Browser container — spring settle + perspective + wobble + blur
  const containerSpring = spring({ frame, fps, config: { damping: 12, stiffness: 90, mass: 1.1 } });
  const containerScale = interpolate(containerSpring, [0, 1], [0.92, 0.88]);
  const containerY = interpolate(containerSpring, [0, 1], [35, 0]) + wob.y;
  const containerRotX = interpolate(containerSpring, [0, 1], [4, 0.5]) + wob.rot * 0.2;
  const prevContainerY = interpolate(Math.max(0, containerSpring - 0.05), [0, 1], [35, 0]);
  const cBlur = motionBlurAmount(0, containerY, 0, prevContainerY);

  // Email cards appear at the bottom after response streams
  const emailCardsSpring = spring({
    frame: frame - durationInFrames * 0.7,
    fps,
    config: { damping: 18 },
  });

  return (
    <AbsoluteFill style={{ backgroundColor: "#FAFAFA", opacity: Math.min(enterOp, exitOp) }}>
      {/* Browser-like container */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: `translate(-50%, -50%) translateY(${containerY}px) perspective(1200px) rotateX(${containerRotX}deg) scale(${containerScale})`,
          width: 960,
          height: 580,
          backgroundColor: "#FFFFFF",
          borderRadius: 16,
          boxShadow: "0 20px 60px rgba(0,0,0,0.1), 0 4px 12px rgba(0,0,0,0.05)",
          overflow: "hidden",
          display: "flex",
          filter: cBlur > 0.3 ? `blur(${cBlur.toFixed(1)}px)` : undefined,
        }}
      >
        {/* Left sidebar — purple accent strip */}
        <div
          style={{
            width: 4,
            backgroundColor: PURPLE,
            flexShrink: 0,
          }}
        />

        {/* Main content area */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          {/* Top bar */}
          <div
            style={{
              height: 44,
              borderBottom: "1px solid #E8E8EC",
              display: "flex",
              alignItems: "center",
              padding: "0 20px",
              gap: 12,
            }}
          >
            <div style={{ fontSize: 16, color: "#666" }}>&#9776;</div>
            <div
              style={{
                fontSize: 14,
                fontFamily: "'Google Sans', sans-serif",
                color: "#444",
                fontWeight: 500,
              }}
            >
              Gemini <span style={{ fontSize: 10, color: "#999" }}>&#9660;</span>
            </div>
            <div style={{ flex: 1 }} />
            {/* "Drafts" label on right side */}
            <div
              style={{
                fontSize: 12,
                fontFamily: "'Google Sans', sans-serif",
                color: "#888",
                opacity: interpolate(frame, [fps * 2, fps * 3], [0, 0.6], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                }),
              }}
            >
              Drafts
            </div>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: "50%",
                backgroundColor: "#E8E8EC",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 14,
                color: "#666",
              }}
            >
              +
            </div>
          </div>

          {/* Chat content */}
          <div style={{ flex: 1, padding: "20px 28px", overflow: "hidden" }}>
            {/* User message */}
            <div
              style={{
                display: "flex",
                gap: 10,
                marginBottom: 16,
                alignItems: "flex-start",
              }}
            >
              {/* Avatar — gradient like reference */}
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  background: "linear-gradient(135deg, #D4A574, #8B6F47)",
                  flexShrink: 0,
                }}
              />
              <div
                style={{
                  fontSize: 13,
                  fontFamily: "'Google Sans', sans-serif",
                  color: "#444",
                  fontStyle: "italic",
                  paddingTop: 4,
                }}
              >
                Summarize my recent emails from Harper Elementary School
              </div>
            </div>

            {/* Google Workspace chip */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 14,
                marginLeft: 38,
                opacity: interpolate(chipSpring, [0, 1], [0, 1]),
                transform: `scale(${interpolate(chipSpring, [0, 1], [0.8, 1])})`,
              }}
            >
              <svg width="14" height="14" viewBox="0 0 14 14">
                <path d="M7 0L9 5L14 7L9 9L7 14L5 9L0 7L5 5Z" fill={BLUE} />
              </svg>
              <div
                style={{
                  padding: "5px 12px",
                  borderRadius: 16,
                  border: "1px solid #E0E0E4",
                  fontSize: 12,
                  fontFamily: "'Google Sans', sans-serif",
                  fontWeight: 500,
                  color: "#444",
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                }}
              >
                Google Workspace
                <span style={{ fontSize: 9, color: "#999" }}>&#9660;</span>
              </div>
            </div>

            {/* Streamed response */}
            <div
              style={{
                fontSize: 13,
                fontFamily: "'Google Sans', sans-serif",
                color: "#333",
                lineHeight: 1.7,
                whiteSpace: "pre-wrap",
                marginLeft: 38,
              }}
            >
              {fullResponse.slice(0, respChars)}
            </div>

            {/* Email preview cards — appear after response */}
            <div
              style={{
                display: "flex",
                gap: 12,
                marginTop: 20,
                marginLeft: 38,
                opacity: interpolate(emailCardsSpring, [0, 1], [0, 1]),
                transform: `translateY(${interpolate(emailCardsSpring, [0, 1], [15, 0])}px)`,
              }}
            >
              {[
                { title: "Harper Elementary Newsletter", sub: "Harper Elementary", color: BLUE },
                { title: "Calling for Parent Volunteers", sub: "Harper Elementary", color: PINK },
              ].map((card, ci) => (
                <div
                  key={ci}
                  style={{
                    flex: 1,
                    height: 65,
                    backgroundColor: "#F6F6FA",
                    borderRadius: 10,
                    padding: "10px 14px",
                    borderLeft: `3px solid ${card.color}`,
                  }}
                >
                  <div style={{ fontSize: 11, fontWeight: 600, color: "#333", fontFamily: "'Google Sans', sans-serif", marginBottom: 4 }}>
                    {card.title}
                  </div>
                  <div style={{ fontSize: 10, color: "#888", fontFamily: "'Google Sans', sans-serif" }}>
                    {card.sub}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Disclaimer */}
      <div
        style={{
          position: "absolute",
          bottom: 20,
          left: "50%",
          transform: "translateX(-50%)",
          fontSize: 10,
          fontFamily: "'Google Sans', sans-serif",
          color: "#B0B0B0",
          opacity: interpolate(frame, [fps * 0.5, fps * 1], [0, 0.5], {
            extrapolateRight: "clamp",
          }),
        }}
      >
        Sequences shortened and simulated. With Google Workspace extension enabled. Check the responses for accuracy. Availability varies by country.
      </div>
    </AbsoluteFill>
  );
};

/* ─── Segment 8: "And moooooore" — o's stretch into colored Gemini balls ─── */
const GEMINI_BALLS = ["#4285F4", "#EA4335", "#FBBC04", "#34A853", "#7B61FF"];
const MAX_BALLS = 18;

const SegAndMore: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  /* ── Phase 1: "And" + "more" appear — softer spring for organic feel ── */
  const andSpring = spring({ frame, fps, config: { damping: 14, stiffness: 90 } });
  const moreSpring = spring({
    frame: frame - fps * 0.5,
    fps,
    config: { damping: 12, stiffness: 100 },
  });

  /* ── Phase 2: stretch — o's multiply ── */
  const stretchStart = fps * 1.0; // ~frame 30 within segment
  const stretchRaw = frame - stretchStart;
  const stretch = stretchRaw > 0
    ? interpolate(stretchRaw, [0, fps * 2.0], [0, 1], {
        extrapolateRight: "clamp",
        easing: Easing.bezier(0.22, 0.1, 0.25, 1),
      })
    : 0;

  // O count ramps up during stretch
  const oCount = Math.floor(interpolate(stretch, [0, 0.8], [1, MAX_BALLS], { extrapolateRight: "clamp" }));

  /* ── Phase 3: letters → colored balls ── */
  const ballStart = 0.15; // balls start appearing early
  const ballProgress = stretch > ballStart
    ? interpolate(stretch, [ballStart, 0.5], [0, 1], { extrapolateRight: "clamp" })
    : 0;

  /* ── Scroll left as chain grows ── */
  const scrollX = interpolate(stretch, [0.1, 1], [0, -420], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.2, 0.0, 0.3, 1),
  });

  /* ── Exit ── */
  const exitOp = interpolate(frame, [durationInFrames - 8, durationInFrames], [1, 0], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
  });

  /* ── Ball rendering — varied spring params + sine-wave bounce ── */
  const renderBalls = () =>
    Array.from({ length: oCount }, (_, i) => {
      const ballDelay = stretchStart + i * 2.2;
      // Varied spring per ball — irregular overshoot creates organic ripple
      const damping = 6 + (i % 5) * 1.4;
      const stiffness = 120 + (i % 3) * 30;
      const mass = 0.4 + (i % 4) * 0.15;
      const ballSpring = spring({
        frame: frame - ballDelay,
        fps,
        config: { damping, stiffness, mass },
      });

      const baseSize = 28;
      const size = baseSize * ballSpring;

      const ballOpacity = interpolate(ballSpring, [0, 0.4], [0, 1], { extrapolateRight: "clamp" });
      const letterOp = interpolate(ballProgress, [0, 0.6], [1, 0], { extrapolateRight: "clamp" });

      // Sine wave with varied freq + phase — no two balls in lockstep
      const waveAmp = interpolate(stretch, [0.2, 0.5], [0, 18], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
      const freq = 0.11 + (i % 4) * 0.025;
      const phase = i * 0.55 + (i % 3) * 0.35;
      const waveY = Math.sin((frame * freq) + phase) * waveAmp * ballSpring;

      // Noise micro-wobble breaks sine repetition
      const wobX = noise2D("bx" + i, frame * 0.025, i) * 3 * ballSpring;

      const color = GEMINI_BALLS[i % GEMINI_BALLS.length];

      // Scale overshoot — each ball bounces differently on landing
      const scaleOvershoot = interpolate(ballSpring, [0, 0.3, 0.6, 1], [0.15, 1.3, 0.9, 1], {
        extrapolateRight: "clamp",
      });

      return (
        <span
          key={i}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
            width: Math.max(size + 2, 14),
            height: Math.max(size + 2, 30),
            transform: `translateY(${waveY}px) translateX(${wobX}px)`,
          }}
        >
          {letterOp > 0.01 && (
            <span
              style={{
                position: "absolute",
                opacity: letterOp * Math.min(ballSpring * 3, 1),
                color: BLUE,
                fontSize: 44,
              }}
            >
              o
            </span>
          )}
          {ballSpring > 0.01 && (
            <div
              style={{
                width: size,
                height: size,
                borderRadius: "50%",
                backgroundColor: color,
                opacity: ballOpacity,
                transform: `scale(${scaleOvershoot})`,
                boxShadow: ballSpring > 0.5 ? `0 2px 8px ${color}44` : undefined,
              }}
            />
          )}
        </span>
      );
    });

  const andOp = interpolate(andSpring, [0, 1], [0, 1]);
  const mOp = interpolate(moreSpring, [0, 1], [0, 1]);

  // Organic wobble on "And" — subtle life
  const andWob = organicWobble("and8", frame, 2, 2.5, 0.015);

  const stretchContent = (
    <AbsoluteFill style={{ backgroundColor: BG_WARM, opacity: exitOp }}>
      <div style={{
        position: "absolute", width: "100%", height: "100%",
        background: `radial-gradient(ellipse at 55% 40%, rgba(232,69,139,0.035) 0%, rgba(196,181,253,0.025) 35%, transparent 60%)`,
      }} />
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: `translate(-50%, -50%) translateX(${scrollX}px)`,
          display: "flex",
          alignItems: "center",
          flexWrap: "nowrap",
          gap: stretch > 0.1 ? 1 : 12,
          fontSize: 44,
          fontFamily: "'Google Sans', sans-serif",
          fontWeight: 400,
          whiteSpace: "nowrap",
        }}
      >
        <span
          style={{
            color: DARK,
            opacity: andOp,
            transform: `translateY(${interpolate(andSpring, [0, 1], [20, 0]) + andWob.y}px) translateX(${andWob.x}px)`,
            display: "inline-block",
            marginRight: 4,
          }}
        >
          And
        </span>

        {stretch <= 0.02 ? (
          /* Before stretch: show "more" as one word */
          <span style={{ opacity: mOp, color: BLUE, fontSize: 44 }}>
            more
          </span>
        ) : (
          /* During stretch: m + [o balls] + re */
          <>
            <span style={{ opacity: mOp, color: BLUE, fontSize: 44, display: "inline-block" }}>
              m
            </span>
            {renderBalls()}
            <span style={{ opacity: mOp, color: BLUE, fontSize: 44, display: "inline-block", marginLeft: -6 }}>
              re
            </span>
          </>
        )}
      </div>
    </AbsoluteFill>
  );

  /* ── Motion blur during active stretch — higher samples for smoothness ── */
  if (stretch > 0.05 && stretch < 0.95) {
    return (
      <CameraMotionBlur samples={8} shutterAngle={130}>
        {stretchContent}
      </CameraMotionBlur>
    );
  }

  return stretchContent;
};

/* ─── Segment 9: "Starting with the new Gemini app" ─── */
const SegStartingWith: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const words = ["Starting", "with", "the", "new", "Gemini", "app"];
  const wordDelays = [0, 4, 8, 12, 16, 20];

  // Scatter: explosive exit — reference frame_032 shows wild disintegration
  const scatterPhase = frame > durationInFrames - fps * 0.5;
  const scatterProgress = scatterPhase
    ? interpolate(frame, [durationInFrames - fps * 0.5, durationInFrames], [0, 1], { extrapolateRight: "clamp" })
    : 0;

  const exitOp = interpolate(frame, [durationInFrames - 5, durationInFrames], [1, 0], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
  });

  // Color tint during scatter — reference shows pink/purple chromatic shift
  const scatterTint = scatterProgress > 0.2
    ? interpolate(scatterProgress, [0.2, 0.8], [0, 1], { extrapolateRight: "clamp" })
    : 0;

  const content = (
    <AbsoluteFill style={{ backgroundColor: BG, opacity: exitOp }}>
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
          display: "flex",
          gap: 14,
          fontSize: 40,
          fontFamily: "'Google Sans', sans-serif",
          fontWeight: 400,
        }}
      >
        {words.map((word, i) => {
          const wSpring = spring({
            frame: frame - wordDelays[i],
            fps,
            config: { damping: 18 },
          });

          // Scatter — wider explosion radius, more rotation
          const scatterX = scatterPhase
            ? noise2D("sx" + i, scatterProgress * 3, i) * 300 * scatterProgress
            : 0;
          const scatterY = scatterPhase
            ? noise2D("sy" + i, i, scatterProgress * 3) * 220 * scatterProgress
            : 0;
          const scatterRot = scatterProgress * (i - 2.5) * 25;
          const scatterScale = scatterPhase
            ? interpolate(scatterProgress, [0, 0.3, 1], [1, 1.15, 0.6], { extrapolateRight: "clamp" })
            : 1;

          const yNow = interpolate(wSpring, [0, 1], [30, 0]) + scatterY;
          const wordWob = organicWobble(`sw${i}`, frame, 2, 1.5, 0.02);

          // Color shift during scatter — words tint toward pink/purple
          const wordColor = scatterTint > 0.01
            ? (i % 2 === 0 ? PINK : PURPLE)
            : DARK;
          const colorMix = scatterTint > 0.01
            ? `color-mix(in srgb, ${DARK} ${Math.round((1 - scatterTint) * 100)}%, ${wordColor} ${Math.round(scatterTint * 100)}%)`
            : DARK;

          return (
            <span
              key={i}
              style={{
                display: "inline-block",
                color: colorMix,
                opacity: interpolate(wSpring, [0, 1], [0, 1]) * (1 - scatterProgress * 0.6),
                transform: `translateY(${yNow + wordWob.y}px) translateX(${scatterX + wordWob.x}px) rotate(${scatterRot}deg) scale(${scatterScale})`,
                fontWeight: 400,
              }}
            >
              {word}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );

  // Wrap scatter phase in CameraMotionBlur for the dramatic exit
  if (scatterPhase) {
    return (
      <CameraMotionBlur samples={8} shutterAngle={140}>
        {content}
      </CameraMotionBlur>
    );
  }

  return content;
};

/* ─── Segment 10: Phone Mockup — Gemini Mobile ─── */
const SegPhoneMockup: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Bezier arc entrance from below-right — reference shows phone sweeping in
  const entranceT = interpolate(frame, [0, fps * 1.2], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.25, 0.1, 0.25, 1),
  });
  // Arc path: start at (300, 500), control points curve through right, land at (0, 0)
  const phoneX = cubicBezier(entranceT, 300, 280, 80, 0);
  const phoneY = cubicBezier(entranceT, 500, 350, 50, 0);
  const phoneRot = cubicBezier(entranceT, 12, 8, 2, 0);
  const phoneScale = interpolate(entranceT, [0, 1], [0.65, 1]);
  const phoneOp = interpolate(entranceT, [0, 0.1], [0, 1], { extrapolateRight: "clamp" });

  // Settle spring — kicks in after the bezier arc completes
  const settleSpring = spring({ frame: frame - Math.round(fps * 1.2), fps, config: { damping: 12, stiffness: 90 } });
  const settleY = entranceT >= 1 ? interpolate(settleSpring, [0, 1], [-8, 0]) : 0;

  const phoneWob10 = organicWobble("ph10", frame, 2.5, 2, 0.018);

  // Screen content appears
  const textDelay = fps * 0.6;
  const hiSpring = spring({
    frame: frame - textDelay,
    fps,
    config: { damping: 20 },
  });
  const bodyDelay = fps * 1;
  const bodySpring = spring({
    frame: frame - bodyDelay,
    fps,
    config: { damping: 20 },
  });

  const { durationInFrames } = useVideoConfig();
  const exitOp = interpolate(frame, [durationInFrames - 8, durationInFrames], [1, 0], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
  });

  return (
    <AbsoluteFill style={{ backgroundColor: BG, opacity: exitOp }}>
      {/* Phone frame */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: `translate(-50%, -50%) translate(${phoneX + phoneWob10.x}px, ${phoneY + settleY + phoneWob10.y}px) rotate(${phoneRot}deg) scale(${phoneScale})`,
          width: 320,
          height: 620,
          backgroundColor: "#FFFFFF",
          borderRadius: 40,
          border: "6px solid #1A1A2E",
          overflow: "hidden",
          boxShadow: "0 30px 80px rgba(0,0,0,0.18), 0 8px 24px rgba(0,0,0,0.1)",
          opacity: phoneOp,
        }}
      >
        {/* Status bar with Dynamic Island */}
        <div
          style={{
            height: 48,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "8px 24px 0",
            fontSize: 14,
            fontWeight: 600,
            color: "#333",
          }}
        >
          <span>9:30</span>
          {/* Dynamic Island — pill shape */}
          <div
            style={{
              width: 90,
              height: 28,
              borderRadius: 14,
              backgroundColor: "#000",
            }}
          />
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ fontSize: 13, fontWeight: 700 }}>5G</span>
            {/* Signal bars */}
            <div style={{ display: "flex", alignItems: "flex-end", gap: 1.5, height: 12 }}>
              {[5, 7, 9, 12].map((h, i) => (
                <div key={i} style={{ width: 3, height: h, backgroundColor: "#333", borderRadius: 1 }} />
              ))}
            </div>
            {/* Battery */}
            <div style={{ width: 20, height: 10, border: "1.5px solid #333", borderRadius: 2, position: "relative", marginLeft: 2 }}>
              <div style={{ position: "absolute", inset: 1.5, backgroundColor: "#333", borderRadius: 0.5 }} />
              <div style={{ position: "absolute", right: -4, top: 2, width: 3, height: 6, backgroundColor: "#333", borderRadius: "0 1px 1px 0" }} />
            </div>
          </div>
        </div>

        {/* Content */}
        <div style={{ padding: "30px 24px" }}>
          {/* "Hi I'm Gemini" */}
          <div
            style={{
              opacity: interpolate(hiSpring, [0, 1], [0, 1]),
              transform: `translateY(${interpolate(hiSpring, [0, 1], [20, 0])}px)`,
            }}
          >
            <span
              style={{
                fontSize: 36,
                fontWeight: 700,
                fontFamily: "'Google Sans', sans-serif",
                color: PURPLE,
              }}
            >
              Hi
            </span>{" "}
            <span
              style={{
                fontSize: 36,
                fontWeight: 700,
                fontFamily: "'Google Sans', sans-serif",
                color: DARK,
              }}
            >
              I'm{" "}
            </span>
            <span
              style={{
                fontSize: 36,
                fontWeight: 700,
                fontFamily: "'Google Sans', sans-serif",
                background: `linear-gradient(135deg, ${PINK}, ${PURPLE})`,
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              Gemini,
            </span>
          </div>

          {/* Body text */}
          <div
            style={{
              marginTop: 8,
              opacity: interpolate(bodySpring, [0, 1], [0, 1]),
              transform: `translateY(${interpolate(bodySpring, [0, 1], [15, 0])}px)`,
            }}
          >
            <div
              style={{
                fontSize: 32,
                fontWeight: 700,
                fontFamily: "'Google Sans', sans-serif",
                color: DARK,
                lineHeight: 1.2,
              }}
            >
              an experimental
              <br />
              AI assistant on
              <br />
              your phone.
            </div>
            <div
              style={{
                marginTop: 24,
                fontSize: 16,
                fontFamily: "'Google Sans', sans-serif",
                color: "#666",
                lineHeight: 1.5,
              }}
            >
              I can help you write, plan, learn, and more.
            </div>
          </div>
        </div>

        {/* Profile avatar with gradient placeholder */}
        <div
          style={{
            position: "absolute",
            top: 58,
            right: 20,
            width: 36,
            height: 36,
            borderRadius: "50%",
            background: "linear-gradient(135deg, #D4A574, #8B6F47)",
            border: "2px solid #DDD",
          }}
        />
      </div>

      {/* Disclaimer text */}
      <div
        style={{
          position: "absolute",
          bottom: 20,
          left: 30,
          fontSize: 11,
          fontFamily: "'Google Sans', sans-serif",
          color: "#B0B0B8",
          opacity: interpolate(frame, [fps * 1, fps * 1.5], [0, 0.5], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        The Gemini mobile app is available for select devices, languages and locations.
      </div>
    </AbsoluteFill>
  );
};

/* ─── Segment 11: "Designed to supercharge your ideas" ─── */
const SegSupercharge: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Each word: distinct spring personality — reference shows varied landing times
  const wordCfg: { text: string; accent: boolean; delay: number; damping: number; stiffness: number; mass: number; fontSize: number }[] = [
    { text: "Designed", accent: false, delay: 0,  damping: 20, stiffness: 100, mass: 1,    fontSize: 36 },
    { text: "to",       accent: false, delay: 5,  damping: 22, stiffness: 90,  mass: 0.8,  fontSize: 36 },
    { text: "supercharge", accent: true, delay: 10, damping: 8, stiffness: 130, mass: 0.7, fontSize: 42 },
    { text: "your",     accent: false, delay: 18, damping: 16, stiffness: 110, mass: 0.9,  fontSize: 36 },
    { text: "ideas",    accent: false, delay: 23, damping: 14, stiffness: 120, mass: 0.85, fontSize: 38 },
  ];

  return (
    <AbsoluteFill style={{ backgroundColor: BG }}>
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
          display: "flex",
          gap: 12,
          alignItems: "baseline",
        }}
      >
        {wordCfg.map((w, i) => {
          const wSpring = spring({
            frame: frame - w.delay,
            fps,
            config: { damping: w.damping, stiffness: w.stiffness, mass: w.mass },
          });

          // "supercharge" bounces higher and scales with overshoot
          const yTravel = w.accent ? 35 : 25;
          const yOff = interpolate(wSpring, [0, 1], [yTravel, 0]);
          const scale = w.accent
            ? interpolate(wSpring, [0, 0.4, 0.7, 1], [0.7, 1.18, 0.95, 1], { extrapolateRight: "clamp" })
            : interpolate(wSpring, [0, 1], [0.95, 1]);

          const scWob = organicWobble(`sc${i}`, frame, 2, 1.5, 0.02);

          // "supercharge" gets the gradient treatment — reference shows pink→blue
          const isGradient = w.accent;
          const baseStyle: React.CSSProperties = {
            display: "inline-block",
            fontSize: w.fontSize,
            fontFamily: "'Google Sans', sans-serif",
            fontWeight: w.accent ? 500 : 400,
            opacity: interpolate(wSpring, [0, 1], [0, 1]),
            transform: `translateY(${yOff + scWob.y}px) translateX(${scWob.x}px) scale(${scale})`,
          };

          if (isGradient) {
            return (
              <span
                key={i}
                style={{
                  ...baseStyle,
                  background: `linear-gradient(90deg, ${PINK} 0%, ${PURPLE} 50%, ${BLUE} 100%)`,
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                {w.text}
              </span>
            );
          }

          return (
            <span key={i} style={{ ...baseStyle, color: DARK }}>
              {w.text}
            </span>
          );
        })}
      </div>

      {/* Subtle particle dust */}
      {Array.from({ length: 20 }, (_, i) => {
        const px = noise2D("sx" + i, frame / 60, i) * 500 + 640;
        const py = noise2D("sy" + i, i, frame / 60) * 300 + 360;
        const pop = interpolate(
          frame,
          [fps * 0.5 + i * 2, fps * 0.8 + i * 2, fps * 2 + i * 2],
          [0, 0.4, 0],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
        );
        const size = 3 + (i % 4) * 1.5;
        const colors = [PINK, PURPLE, BLUE, LAVENDER];
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: px,
              top: py,
              width: size,
              height: size,
              borderRadius: "50%",
              backgroundColor: colors[i % colors.length],
              opacity: pop,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

/* ─── Segment 12: Phone with "Good morning" + Camera/Dog ─── */
const SegPhoneGoodMorning: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Bezier arc from below-right — mirrored from phone 10 but tighter arc
  const entT12 = interpolate(frame, [0, fps * 1.0], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.22, 0.1, 0.25, 1),
  });
  const phoneX12 = cubicBezier(entT12, 250, 200, 50, 0);
  const phoneY = cubicBezier(entT12, 400, 280, 30, 0);
  const phoneRot12 = cubicBezier(entT12, 10, 6, 1, 0);
  const phoneScale = interpolate(entT12, [0, 1], [0.6, 0.75]);
  const phoneOp12 = interpolate(entT12, [0, 0.08], [0, 1], { extrapolateRight: "clamp" });

  // Settle bounce after arc
  const settle12 = spring({ frame: frame - Math.round(fps * 1.0), fps, config: { damping: 10, stiffness: 100 } });
  const settleY12 = entT12 >= 1 ? interpolate(settle12, [0, 1], [-6, 0]) : 0;

  const phoneWob12 = organicWobble("ph12", frame, 2, 1.5, 0.018);

  const { durationInFrames } = useVideoConfig();

  // Phase 2: screen changes to camera view (dark)
  const cameraPhase = frame > durationInFrames * 0.5;
  const camTransition = cameraPhase
    ? interpolate(frame, [durationInFrames * 0.5, durationInFrames * 0.6], [0, 1], { extrapolateRight: "clamp" })
    : 0;

  const exitOp = interpolate(frame, [durationInFrames - 8, durationInFrames], [1, 0], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
  });

  return (
    <AbsoluteFill style={{ backgroundColor: "#FAFAFA", opacity: exitOp }}>
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: `translate(-50%, -50%) translate(${phoneX12 + phoneWob12.x}px, ${phoneY + settleY12 + phoneWob12.y}px) rotate(${phoneRot12}deg) scale(${phoneScale})`,
          width: 320,
          height: 620,
          borderRadius: 40,
          border: "6px solid #1A1A2E",
          overflow: "hidden",
          boxShadow: "0 30px 80px rgba(0,0,0,0.18), 0 8px 24px rgba(0,0,0,0.1)",
          opacity: phoneOp12,
        }}
      >
        {/* Good morning screen */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundColor: "#FFFFFF",
            opacity: 1 - camTransition,
            padding: "60px 24px 24px",
          }}
        >
          <div
            style={{
              fontSize: 28,
              fontFamily: "'Google Sans', sans-serif",
              fontWeight: 500,
              background: `linear-gradient(135deg, ${BLUE}, ${PURPLE})`,
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              marginBottom: 24,
            }}
          >
            Good morning
          </div>

          {/* Content cards */}
          {[0, 1, 2].map((ci) => {
            const cardSpring = spring({
              frame: frame - fps * 0.3 - ci * 6,
              fps,
              config: { damping: 18 },
            });
            return (
              <div
                key={ci}
                style={{
                  height: 60,
                  backgroundColor: "#F4F4F8",
                  borderRadius: 12,
                  marginBottom: 10,
                  opacity: interpolate(cardSpring, [0, 1], [0, 1]),
                  transform: `translateY(${interpolate(cardSpring, [0, 1], [15, 0])}px)`,
                  padding: "12px 16px",
                  fontSize: 12,
                  fontFamily: "'Google Sans', sans-serif",
                  color: "#666",
                }}
              >
                {ci === 0 && "Find videos on how to care for a plant"}
                {ci === 1 && "Summarize your travel reservations for July"}
                {ci === 2 && "Create a playlist for a road trip"}
              </div>
            );
          })}

          {/* Bottom bar */}
          <div
            style={{
              position: "absolute",
              bottom: 24,
              left: 24,
              right: 24,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: 12,
                fontSize: 12,
                color: "#999",
              }}
            >
              <span>Chats</span>
              <span>&#9998;</span>
            </div>
            <div
              style={{
                height: 44,
                backgroundColor: "#EDEDF1",
                borderRadius: 22,
                display: "flex",
                alignItems: "center",
                padding: "0 16px",
                fontSize: 13,
                color: "#AAA",
              }}
            >
              Type, talk, or share a photo
            </div>
          </div>
        </div>

        {/* Camera/dog screen */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundColor: "#1A1A2E",
            opacity: camTransition,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {/* Dog photo area — outdoor green-brown scene */}
          <div
            style={{
              width: "100%",
              height: "75%",
              background: `linear-gradient(180deg, #87CEEB 0%, #90B86C 30%, #78A55A 50%, #8B7355 70%, #C4A67A 100%)`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              position: "relative",
            }}
          >
            {/* Dog silhouette placeholder */}
            <div
              style={{
                width: 120,
                height: 100,
                borderRadius: "40% 40% 20% 20%",
                backgroundColor: "#D4A574",
                position: "relative",
              }}
            >
              {/* Dog ears */}
              <div style={{ position: "absolute", top: -12, left: 8, width: 24, height: 20, borderRadius: "50% 50% 0 0", backgroundColor: "#C4956A", transform: "rotate(-15deg)" }} />
              <div style={{ position: "absolute", top: -12, right: 8, width: 24, height: 20, borderRadius: "50% 50% 0 0", backgroundColor: "#C4956A", transform: "rotate(15deg)" }} />
              {/* Dog eyes */}
              <div style={{ position: "absolute", top: 20, left: 28, width: 8, height: 8, borderRadius: "50%", backgroundColor: "#333" }} />
              <div style={{ position: "absolute", top: 20, right: 28, width: 8, height: 8, borderRadius: "50%", backgroundColor: "#333" }} />
              {/* Dog nose */}
              <div style={{ position: "absolute", top: 38, left: "50%", transform: "translateX(-50%)", width: 12, height: 8, borderRadius: "50%", backgroundColor: "#333" }} />
            </div>
          </div>

          {/* Camera UI bottom bar */}
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 30,
            }}
          >
            {/* Shutter button */}
            <div
              style={{
                width: 54,
                height: 54,
                borderRadius: "50%",
                border: "3px solid white",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <div style={{ width: 44, height: 44, borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.9)" }} />
            </div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

/* ═══════════════════════════════════════════════════════════
   MAIN SCENE 03 — Sequences all sub-segments
   ═══════════════════════════════════════════════════════════ */
export const Scene03: React.FC = () => {
  /*
   * 745 frames total (24.8s at 30fps). 12 segments, sequential.
   * Mapped from 50 reference frames (~15 real frames per sample).
   *
   * ref 01-03:   Particle burst → Gemini text    ~frames 0-45
   * ref 03-06:   Gemini logo with sparkles        ~frames 45-90
   * ref 07-12:   Desktop UI (Hello Lisa)          ~frames 90-180
   * ref 13-14:   "It's everything" wall           ~frames 180-210
   * ref 15-17:   App icons floating               ~frames 210-255
   * ref 18-20:   Typing prompt                    ~frames 255-330
   * ref 21-24:   Gemini response stream           ~frames 330-420
   * ref 25-28:   "And" → "And moooore"            ~frames 420-490
   * ref 29-32:   "Starting with new Gemini app"   ~frames 490-555
   * ref 33-37:   Phone mockup (Hi I'm Gemini)     ~frames 555-630
   * ref 39-43:   "Designed to supercharge"         ~frames 630-690
   * ref 44-50:   Phone Good Morning + Camera/Dog  ~frames 690-745
   */
  const segments: { start: number; dur: number; Comp: React.FC }[] = [
    { start: 0,   dur: 50,  Comp: SegParticleExplosion },    // 0-50
    { start: 45,  dur: 50,  Comp: SegGeminiReveal },          // 45-95
    { start: 90,  dur: 95,  Comp: SegDesktopUI },             // 90-185
    { start: 180, dur: 35,  Comp: SegItsEverything },          // 180-215
    { start: 210, dur: 50,  Comp: SegAppsFloat },              // 210-260
    { start: 255, dur: 80,  Comp: SegTypingPrompt },           // 255-335
    { start: 330, dur: 95,  Comp: SegGeminiResponse },         // 330-425
    { start: 420, dur: 75,  Comp: SegAndMore },                // 420-495
    { start: 490, dur: 70,  Comp: SegStartingWith },           // 490-560
    { start: 555, dur: 80,  Comp: SegPhoneMockup },            // 555-635
    { start: 630, dur: 65,  Comp: SegSupercharge },            // 630-695
    { start: 690, dur: 55,  Comp: SegPhoneGoodMorning },       // 690-745
  ];

  return (
    <AbsoluteFill style={{ backgroundColor: BG }}>
      {segments.map(({ start, dur, Comp }, i) => (
        <Sequence key={i} from={start} durationInFrames={dur} name={`seg-${i}`}>
          <Comp />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};

export const scene03Meta = {
  id: "OFScene03",
  component: Scene03,
  width: 1280,
  height: 720,
  fps: 30,
  durationInFrames: 745,
};
