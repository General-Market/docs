import React, { useMemo, useEffect, useRef } from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  Sequence,
  Easing,
} from "remotion";
import { noise2D } from "@remotion/noise";
import { CameraMotionBlur } from "@remotion/motion-blur";
import { useGsapTimeline, gsap } from "../../lib/useGsapTimeline";

/* ─── bezier / motion helpers ─── */
function quadBezier(t: number, p0: number, p1: number, p2: number): number {
  const u = 1 - t;
  return u * u * p0 + 2 * u * t * p1 + t * t * p2;
}

function cubicBezier(t: number, p0: number, p1: number, p2: number, p3: number): number {
  const u = 1 - t;
  return u*u*u*p0 + 3*u*u*t*p1 + 3*u*t*t*p2 + t*t*t*p3;
}

function decel(t: number, rate = 3.0): number {
  return 1 - Math.exp(-t * rate);
}

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
  x: number;
  y: number;
  cpOffX: number;
  cpOffY: number;
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

/* ─── Particle Field — bezier arcs + deceleration (kept procedural — too many elements for GSAP DOM targets) ─── */
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
        let prevPx: number, prevPy: number;

        if (phase === "explode") {
          const tNorm = Math.min(rawT / 1.2, 1);
          const d = decel(tNorm * 3, 2.8);
          px = quadBezier(d, p.x, p.x + p.cpOffX, p.x + p.endX) + noiseX + wob.x;
          py = quadBezier(d, p.y, p.y + p.cpOffY, p.y + p.endY) + noiseY + wob.y;
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
  const { tl, containerRef } = useGsapTimeline();
  const wob = organicWobble("pexp", frame, 4, 3, 0.025);

  useEffect(() => {
    if (!containerRef.current) return;
    const t = tl.current;
    t.clear();
    // Radial glow: fade in then out
    t.fromTo(".radial-glow",
      { opacity: 0 },
      { opacity: 0.8, duration: 10 / fps, ease: "power2.out" },
      0
    );
    t.to(".radial-glow",
      { opacity: 0, duration: (fps * 1.5 - 10) / fps, ease: "power2.in" },
      10 / fps
    );
    tl.current.seek(frame / fps);
  }, []);

  const phase: "explode" | "swirl" = frame < fps * 0.8 ? "explode" : "swirl";

  return (
    <AbsoluteFill ref={containerRef} style={{ backgroundColor: BG }}>
      <div
        className="radial-glow"
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: 400,
          height: 400,
          transform: `translate(calc(-50% + ${wob.x}px), calc(-50% + ${wob.y}px))`,
          background: `radial-gradient(circle, rgba(123,97,255,0.15) 0%, transparent 70%)`,
          opacity: 0,
        }}
      />
      <ParticleField frame={frame} fps={fps} particles={particles} phase={phase} />
    </AbsoluteFill>
  );
};

/* ─── Segment 2: Gemini Text Materializes — GSAP staggered letter entrance ─── */
const GEMINI_LETTERS = "Gemini".split("");
const LETTER_ARC_ANGLES = [-0.9, -0.4, 0.3, -0.6, 0.7, -0.2];
const LETTER_ARC_DIST = [60, 45, 55, 50, 65, 40];

const SegGeminiReveal: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const particles = useMemo(() => generateParticles(60, 99), []);
  const { tl, containerRef } = useGsapTimeline();

  useEffect(() => {
    if (!containerRef.current) return;
    const t = tl.current;
    t.clear();

    // Letters stagger in from arc positions
    const letters = containerRef.current.querySelectorAll(".gemini-letter");
    letters.forEach((el, i) => {
      const arcAngle = LETTER_ARC_ANGLES[i];
      const arcDist = LETTER_ARC_DIST[i];
      t.from(el, {
        x: Math.cos(arcAngle) * arcDist,
        y: Math.sin(arcAngle) * arcDist,
        opacity: 0,
        scale: 0.7,
        duration: 0.5,
        ease: "back.out(1.7)",
      }, i * 0.1); // stagger 3 frames = 0.1s
    });

    // Sparkles — pulsing entrance
    t.from(".sparkle-main", {
      opacity: 0, scale: 0, rotation: -180,
      duration: 0.6, ease: "elastic.out(1, 0.5)",
    }, 0.3);
    t.from(".sparkle-secondary", {
      opacity: 0, scale: 0, rotation: 90,
      duration: 0.5, ease: "back.out(2)",
    }, 0.5);
    t.from(".sparkle-tertiary", {
      opacity: 0, scale: 0,
      duration: 0.4, ease: "power2.out",
    }, 0.6);

    // Fade sparkles out near end
    t.to(".sparkle-main, .sparkle-secondary, .sparkle-tertiary", {
      opacity: 0, duration: 0.3, ease: "power2.in",
    }, 1.2);
    tl.current.seek(frame / fps);
  }, []);

  // Sparkle rotation is continuous — keep frame-driven
  const sparkle1Rot = interpolate(frame, [0, fps * 2], [0, 360]);

  return (
    <AbsoluteFill ref={containerRef} style={{ backgroundColor: BG }}>
      {/* Residual particles fading */}
      <div style={{ opacity: interpolate(frame, [0, fps * 2], [0.5, 0], { extrapolateRight: "clamp" }) }}>
        <ParticleField frame={frame} fps={fps} particles={particles} phase="scatter" />
      </div>

      {/* Gemini text — GSAP staggered arc entrance */}
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
          const wob = organicWobble("gl" + i, frame, 1.5, 1, 0.018);
          return (
            <span
              key={i}
              className="gemini-letter"
              style={{
                display: "inline-block",
                background: `linear-gradient(90deg, ${BLUE} 0%, ${PURPLE} 45%, ${PINK} 100%)`,
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                willChange: "transform, opacity",
              }}
            >
              {letter}
            </span>
          );
        })}
      </div>

      {/* Sparkles */}
      <div className="sparkle-main" style={{ position: "absolute", left: 0, top: 0, width: "100%", height: "100%" }}>
        <Sparkle x={640} y={300} size={36} color={PURPLE} opacity={1} rotation={sparkle1Rot} />
      </div>
      <div className="sparkle-secondary" style={{ position: "absolute", left: 0, top: 0, width: "100%", height: "100%" }}>
        <Sparkle x={700} y={310} size={20} color={BLUE} opacity={1} rotation={-sparkle1Rot * 0.6} />
      </div>
      <div className="sparkle-tertiary" style={{ position: "absolute", left: 0, top: 0, width: "100%", height: "100%" }}>
        <Sparkle x={720} y={340} size={12} color={PINK} opacity={1} rotation={sparkle1Rot * 1.2} />
      </div>
    </AbsoluteFill>
  );
};

/* ─── Segment 3: Desktop UI Mockup — GSAP perspective entrance + typing ─── */
const SegDesktopUI: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { tl, containerRef } = useGsapTimeline();
  const wob = organicWobble("dui", frame, 1.2, 0.8, 0.015);

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

  useEffect(() => {
    if (!containerRef.current) return;
    const t = tl.current;
    t.clear();

    // Browser container: spring entrance with perspective tilt
    t.from(".browser-container", {
      y: 55,
      scale: 1.12,
      rotationX: 8,
      opacity: 0,
      duration: 0.8,
      ease: "elastic.out(1, 0.6)",
    }, 0);

    // Cards stagger in
    t.from(".suggestion-card", {
      y: 40,
      scale: 0.9,
      opacity: 0,
      duration: 0.5,
      ease: "back.out(1.4)",
      stagger: 0.1,
    }, 1.5);

    // Input bar fades in
    t.from(".input-bar", {
      opacity: 0,
      duration: 0.5,
      ease: "power2.out",
    }, 2.0);

    // Disclaimer
    t.from(".disclaimer-text", {
      opacity: 0,
      duration: 0.5,
      ease: "power2.out",
    }, 1.5);
    tl.current.seek(frame / fps);
  }, []);

  const cards = [
    { text: "Help me find YouTube videos to care for a plant", icon: "youtube" },
    { text: "Brainstorm presentation ideas about a topic", icon: "compass" },
    { text: "What are some tips to improve public speaking skills?", icon: "mic" },
    { text: "Come up with a product name for a new app", icon: "pen" },
  ];

  return (
    <AbsoluteFill ref={containerRef} style={{ backgroundColor: BG }}>
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
        className="browser-container"
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: 904,
          height: 524,
          transform: `translate(-50%, -50%)`,
          perspective: 1200,
          borderRadius: 18,
          background: `linear-gradient(135deg, ${LAVENDER}88, ${PINK}44, ${BLUE}66, ${PURPLE}44)`,
          padding: 2,
          willChange: "transform, opacity",
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
            }}
          >
            {cards.map((card, i) => (
              <div
                key={i}
                className="suggestion-card"
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
                  position: "relative",
                  willChange: "transform, opacity",
                }}
              >
                {card.text}
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
            ))}
          </div>
        </div>

        {/* Bottom input bar */}
        <div
          className="input-bar"
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
            opacity: 0,
          }}
        >
          Enter a prompt here
        </div>
      </div>
      </div>

      {/* Disclaimer text */}
      <div
        className="disclaimer-text"
        style={{
          position: "absolute",
          bottom: 24,
          left: 40,
          fontSize: 11,
          fontFamily: "'Google Sans', sans-serif",
          color: "#B0B0B8",
          opacity: 0,
        }}
      >
        Sequences shortened and simulated.
      </div>
    </AbsoluteFill>
  );
};

/* ─── Segment 4: "It's everything" repeating text wall — GSAP stagger ─── */
const SegItsEverything: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const { tl, containerRef } = useGsapTimeline();
  const wob = organicWobble("itsev", frame, 2, 1.5, 0.02);

  const rows = 9;
  const cols = 5;

  useEffect(() => {
    if (!containerRef.current) return;
    const t = tl.current;
    t.clear();

    // Container: fade in
    t.from(".itsev-container", {
      opacity: 0,
      duration: 8 / fps,
      ease: "power2.out",
    }, 0);

    // Center text: spring scale
    t.from(".itsev-center", {
      scale: 0,
      duration: 0.6,
      ease: "elastic.out(1, 0.5)",
    }, 5 / fps);

    // All cells stagger from center outward
    t.from(".itsev-cell", {
      opacity: 0,
      y: 20,
      duration: 0.4,
      ease: "power2.out",
      stagger: {
        each: 0.03,
        from: "center",
      },
    }, 0.1);

    // Fade out at end
    const dur = durationInFrames / fps;
    t.to(".itsev-container", {
      opacity: 0,
      duration: 10 / fps,
      ease: "power2.in",
    }, dur - 10 / fps);
    tl.current.seek(frame / fps);
  }, []);

  // Scroll the text wall + organic wobble (frame-driven for noise)
  const scrollY = interpolate(frame, [0, durationInFrames], [0, -80], {
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.sin),
  }) + wob.y;
  const scrollX = interpolate(frame, [0, durationInFrames], [0, -30], {
    extrapolateRight: "clamp",
  }) + wob.x;

  return (
    <AbsoluteFill ref={containerRef} style={{ backgroundColor: BG }}>
      <div
        className="itsev-container"
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
            const cellWob = organicWobble(`ie${row}${col}`, frame, 1 + dist * 0.4, 0.8 + dist * 0.3, 0.015);

            return (
              <div
                key={`${row}-${col}`}
                className={isCenter ? "itsev-center" : "itsev-cell"}
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
                  transform: isCenter ? undefined : `rotate(${cellWob.rot * 0.3}deg)`,
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

/* ─── Segment 5: Google App Icons floating + "you know and love" — GSAP float ─── */
const SegAppsFloat: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const { tl, containerRef } = useGsapTimeline();

  const apps = [
    { name: "Maps", color: "#34A853", x: 250, y: 200, icon: "pin" },
    { name: "Gmail", color: "#EA4335", x: 520, y: 150, icon: "mail" },
    { name: "Travel", color: "#4285F4", x: 780, y: 190, icon: "plane" },
    { name: "Docs", color: "#4285F4", x: 160, y: 350, icon: "doc" },
    { name: "YouTube", color: "#FF0000", x: 850, y: 360, icon: "play" },
    { name: "Sheets", color: "#34A853", x: 380, y: 510, icon: "grid" },
    { name: "Drive", color: "#FBBC04", x: 680, y: 500, icon: "triangle" },
  ];

  useEffect(() => {
    if (!containerRef.current) return;
    const t = tl.current;
    t.clear();

    // Icons pop in with stagger — elastic bounce
    t.from(".app-icon", {
      scale: 0,
      opacity: 0,
      duration: 0.6,
      ease: "elastic.out(1, 0.5)",
      stagger: { each: 0.1, from: "random" },
    }, 0);

    // Text reveal: "you know" then "and love"
    t.from(".text-you-know", {
      y: 18,
      opacity: 0,
      duration: 0.5,
      ease: "power3.out",
    }, 0);
    t.from(".text-and-love", {
      y: 18,
      opacity: 0,
      duration: 0.5,
      ease: "power3.out",
    }, 0.5);

    // Exit fade
    const dur = durationInFrames / fps;
    t.to(".app-icon, .text-you-know, .text-and-love", {
      opacity: 0,
      duration: 10 / fps,
      ease: "power2.in",
    }, dur - 10 / fps);
    tl.current.seek(frame / fps);
  }, []);

  return (
    <AbsoluteFill ref={containerRef} style={{ backgroundColor: BG }}>
      {/* Floating app icons — sinusoidal modifiers via frame */}
      {apps.map((app, i) => {
        const floatY = noise2D("app" + i, frame / 35, 0) * 14;
        const floatX = noise2D("appx" + i, 0, frame / 45) * 10;
        const appWob = organicWobble("afw" + i, frame, 3, 2.5, 0.02);

        return (
          <div
            key={i}
            className="app-icon"
            style={{
              position: "absolute",
              left: app.x + floatX + appWob.x,
              top: app.y + floatY + appWob.y,
              width: 52,
              height: 52,
              borderRadius: app.icon === "plane" ? "50%" : 12,
              backgroundColor: app.icon === "plane" ? "#E8F0FE" : "white",
              transform: `rotate(${appWob.rot * 0.4}deg)`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
              overflow: "hidden",
              willChange: "transform, opacity",
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
            <span className="text-you-know" style={{
              display: "inline-block",
              willChange: "transform, opacity",
            }}>you know</span>
            <span
              className="text-and-love"
              style={{
                color: BLUE,
                display: "inline-block",
                willChange: "transform, opacity",
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

/* ─── Segment 6: Typing prompt — GSAP entrance + frame-driven typing ─── */
const SegTypingPrompt: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const { tl, containerRef } = useGsapTimeline();
  const wob = organicWobble("typr", frame, 1.5, 1, 0.015);

  const fullText = "Summarize my recent emails from Harper Elementary School";
  const charCount = Math.floor(
    interpolate(frame, [0, durationInFrames * 0.85], [0, fullText.length], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    })
  );
  const displayed = fullText.slice(0, charCount);

  useEffect(() => {
    if (!containerRef.current) return;
    const t = tl.current;
    t.clear();

    // Input bar entrance
    t.from(".typing-bar", {
      y: 25,
      scale: 0.96,
      opacity: 0,
      duration: 0.6,
      ease: "back.out(1.4)",
    }, 0);

    // Disclaimer fade in
    t.from(".typing-disclaimer", {
      opacity: 0,
      duration: 0.5,
      ease: "power2.out",
    }, 0.5);

    // Exit fade
    const dur = durationInFrames / fps;
    t.to(".typing-bar, .typing-disclaimer", {
      opacity: 0,
      duration: 8 / fps,
      ease: "power2.in",
    }, dur - 8 / fps);
    tl.current.seek(frame / fps);
  }, []);

  return (
    <AbsoluteFill ref={containerRef} style={{ backgroundColor: "#FAFAFA" }}>
      {/* Input bar */}
      <div
        className="typing-bar"
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: `translate(-50%, -50%) translate(0, ${wob.y}px) rotate(${wob.rot * 0.1}deg)`,
          width: 780,
          willChange: "transform, opacity",
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
        className="typing-disclaimer"
        style={{
          position: "absolute",
          bottom: 30,
          left: "50%",
          transform: "translateX(-50%)",
          fontSize: 11,
          fontFamily: "'Google Sans', sans-serif",
          color: "#B0B0B0",
          opacity: 0,
        }}
      >
        Sequences shortened and simulated. With Google Workspace extension enabled. Check the responses for accuracy. Availability varies by country.
      </div>
    </AbsoluteFill>
  );
};

/* ─── Segment 7: Gemini Response Streaming — GSAP entrance + frame-driven text ─── */
const SegGeminiResponse: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const { tl, containerRef } = useGsapTimeline();
  const wob = organicWobble("gresp", frame, 1.2, 0.8, 0.012);

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

  useEffect(() => {
    if (!containerRef.current) return;
    const t = tl.current;
    t.clear();

    // Browser container: spring entrance
    t.from(".response-container", {
      y: 35,
      scale: 0.92,
      rotationX: 4,
      opacity: 0,
      duration: 0.8,
      ease: "elastic.out(1, 0.6)",
    }, 0);

    // Workspace chip
    t.from(".workspace-chip", {
      scale: 0.8,
      opacity: 0,
      duration: 0.4,
      ease: "back.out(1.7)",
    }, 0.3);

    // Email cards appear after response streams
    t.from(".email-card", {
      y: 15,
      opacity: 0,
      duration: 0.5,
      ease: "power3.out",
      stagger: 0.1,
    }, durationInFrames * 0.7 / fps);

    // Exit fade
    const dur = durationInFrames / fps;
    t.to(".response-container", {
      opacity: 0,
      duration: 8 / fps,
      ease: "power2.in",
    }, dur - 8 / fps);

    // Disclaimer
    t.from(".resp-disclaimer", {
      opacity: 0,
      duration: 0.5,
      ease: "power2.out",
    }, 0.5);
    tl.current.seek(frame / fps);
  }, []);

  return (
    <AbsoluteFill ref={containerRef} style={{ backgroundColor: "#FAFAFA" }}>
      {/* Browser-like container */}
      <div
        className="response-container"
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: `translate(-50%, -50%) translate(0, ${wob.y}px)`,
          perspective: 1200,
          width: 960,
          height: 580,
          backgroundColor: "#FFFFFF",
          borderRadius: 16,
          boxShadow: "0 20px 60px rgba(0,0,0,0.1), 0 4px 12px rgba(0,0,0,0.05)",
          overflow: "hidden",
          display: "flex",
          willChange: "transform, opacity",
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
              className="workspace-chip"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 14,
                marginLeft: 38,
                willChange: "transform, opacity",
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

            {/* Email preview cards */}
            <div
              style={{
                display: "flex",
                gap: 12,
                marginTop: 20,
                marginLeft: 38,
              }}
            >
              {[
                { title: "Harper Elementary Newsletter", sub: "Harper Elementary", color: BLUE },
                { title: "Calling for Parent Volunteers", sub: "Harper Elementary", color: PINK },
              ].map((card, ci) => (
                <div
                  key={ci}
                  className="email-card"
                  style={{
                    flex: 1,
                    height: 65,
                    backgroundColor: "#F6F6FA",
                    borderRadius: 10,
                    padding: "10px 14px",
                    borderLeft: `3px solid ${card.color}`,
                    willChange: "transform, opacity",
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
        className="resp-disclaimer"
        style={{
          position: "absolute",
          bottom: 20,
          left: "50%",
          transform: "translateX(-50%)",
          fontSize: 10,
          fontFamily: "'Google Sans', sans-serif",
          color: "#B0B0B0",
          opacity: 0,
        }}
      >
        Sequences shortened and simulated. With Google Workspace extension enabled. Check the responses for accuracy. Availability varies by country.
      </div>
    </AbsoluteFill>
  );
};

/* ─── Segment 8: "And moooooore" — GSAP spring-bouncing balls ─── */
const GEMINI_BALLS = ["#4285F4", "#EA4335", "#FBBC04", "#34A853", "#7B61FF"];
const MAX_BALLS = 18;

const SegAndMore: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const { tl, containerRef } = useGsapTimeline();

  /* ── Phase timing (kept frame-driven for precise ball count + stretch) ── */
  const stretchStart = fps * 1.0;
  const stretchRaw = frame - stretchStart;
  const stretch = stretchRaw > 0
    ? interpolate(stretchRaw, [0, fps * 2.0], [0, 1], {
        extrapolateRight: "clamp",
        easing: Easing.bezier(0.22, 0.1, 0.25, 1),
      })
    : 0;

  const oCount = Math.floor(interpolate(stretch, [0, 0.8], [1, MAX_BALLS], { extrapolateRight: "clamp" }));

  const ballStart = 0.15;
  const ballProgress = stretch > ballStart
    ? interpolate(stretch, [ballStart, 0.5], [0, 1], { extrapolateRight: "clamp" })
    : 0;

  const scrollX = interpolate(stretch, [0.1, 1], [0, -420], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.2, 0.0, 0.3, 1),
  });

  const exitOp = interpolate(frame, [durationInFrames - 8, durationInFrames], [1, 0], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
  });

  useEffect(() => {
    if (!containerRef.current) return;
    const t = tl.current;
    t.clear();

    // "And" entrance
    t.from(".and-text", {
      y: 20,
      opacity: 0,
      duration: 0.5,
      ease: "elastic.out(1, 0.6)",
    }, 0);

    // "more" entrance
    t.from(".more-text", {
      opacity: 0,
      duration: 0.4,
      ease: "power2.out",
    }, 0.5);
    tl.current.seek(frame / fps);
  }, []);

  /* ── Ball rendering — sine-wave bounce + noise wobble ── */
  const renderBalls = () =>
    Array.from({ length: oCount }, (_, i) => {
      const ballDelay = stretchStart + i * 2.2;
      const damping = 6 + (i % 5) * 1.4;
      const stiffness = 120 + (i % 3) * 30;
      const mass = 0.4 + (i % 4) * 0.15;
      // Use gsap-style spring approximation via frame math (GSAP can't do per-ball spring in a loop efficiently)
      const ballRaw = Math.max(0, frame - ballDelay);
      const ballT = Math.min(ballRaw / (fps * 0.5), 1);
      // Simulated spring with overshoot
      const omega = Math.sqrt(stiffness / mass);
      const zeta = damping / (2 * Math.sqrt(stiffness * mass));
      const ballSpring = ballT <= 0 ? 0 : 1 - Math.exp(-zeta * omega * ballT / fps * 15) * Math.cos(omega * Math.sqrt(1 - zeta * zeta) * ballT / fps * 15);
      const clampedSpring = Math.max(0, Math.min(1.3, ballSpring));

      const baseSize = 28;
      const size = baseSize * Math.min(clampedSpring, 1);

      const ballOpacity = interpolate(clampedSpring, [0, 0.4], [0, 1], { extrapolateRight: "clamp" });
      const letterOp = interpolate(ballProgress, [0, 0.6], [1, 0], { extrapolateRight: "clamp" });

      const waveAmp = interpolate(stretch, [0.2, 0.5], [0, 18], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
      const freq = 0.11 + (i % 4) * 0.025;
      const phase = i * 0.55 + (i % 3) * 0.35;
      const waveY = Math.sin((frame * freq) + phase) * waveAmp * Math.min(clampedSpring, 1);

      const wobX = noise2D("bx" + i, frame * 0.025, i) * 3 * Math.min(clampedSpring, 1);

      const color = GEMINI_BALLS[i % GEMINI_BALLS.length];

      const scaleOvershoot = interpolate(clampedSpring, [0, 0.3, 0.6, 1, 1.3], [0.15, 1.3, 0.9, 1, 1.1], {
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
                opacity: letterOp * Math.min(clampedSpring * 3, 1),
                color: BLUE,
                fontSize: 44,
              }}
            >
              o
            </span>
          )}
          {clampedSpring > 0.01 && (
            <div
              style={{
                width: size,
                height: size,
                borderRadius: "50%",
                backgroundColor: color,
                opacity: ballOpacity,
                transform: `scale(${scaleOvershoot})`,
                boxShadow: clampedSpring > 0.5 ? `0 2px 8px ${color}44` : undefined,
              }}
            />
          )}
        </span>
      );
    });

  const andWob = organicWobble("and8", frame, 2, 2.5, 0.015);

  const stretchContent = (
    <AbsoluteFill ref={containerRef} style={{ backgroundColor: BG_WARM, opacity: exitOp }}>
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
          className="and-text"
          style={{
            color: DARK,
            transform: `translateY(${andWob.y}px) translateX(${andWob.x}px)`,
            display: "inline-block",
            marginRight: 4,
            willChange: "transform, opacity",
          }}
        >
          And
        </span>

        {stretch <= 0.02 ? (
          <span className="more-text" style={{ color: BLUE, fontSize: 44, willChange: "opacity" }}>
            more
          </span>
        ) : (
          <>
            <span className="more-text" style={{ color: BLUE, fontSize: 44, display: "inline-block" }}>
              m
            </span>
            {renderBalls()}
            <span style={{ color: BLUE, fontSize: 44, display: "inline-block", marginLeft: -6 }}>
              re
            </span>
          </>
        )}
      </div>
    </AbsoluteFill>
  );

  if (stretch > 0.05 && stretch < 0.95) {
    return (
      <CameraMotionBlur samples={8} shutterAngle={130}>
        {stretchContent}
      </CameraMotionBlur>
    );
  }

  return stretchContent;
};

/* ─── Segment 9: "Starting with the new Gemini app" — GSAP word stagger + scatter exit ─── */
const SegStartingWith: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const { tl, containerRef } = useGsapTimeline();

  const words = ["Starting", "with", "the", "new", "Gemini", "app"];

  const scatterPhase = frame > durationInFrames - fps * 0.5;
  const scatterProgress = scatterPhase
    ? interpolate(frame, [durationInFrames - fps * 0.5, durationInFrames], [0, 1], { extrapolateRight: "clamp" })
    : 0;

  const exitOp = interpolate(frame, [durationInFrames - 5, durationInFrames], [1, 0], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
  });

  useEffect(() => {
    if (!containerRef.current) return;
    const t = tl.current;
    t.clear();

    // Words stagger entrance
    t.from(".starting-word", {
      y: 30,
      opacity: 0,
      duration: 0.5,
      ease: "back.out(1.4)",
      stagger: { each: 4 / fps },
    }, 0);

    // Scatter exit — words explode outward with rotation
    const scatterStart = (durationInFrames - fps * 0.5) / fps;
    const scatterDur = (fps * 0.5) / fps;
    t.to(".starting-word", {
      x: () => (Math.random() - 0.5) * 600,
      y: () => (Math.random() - 0.5) * 440,
      rotation: () => (Math.random() - 0.5) * 50,
      scale: 0.6,
      opacity: 0,
      duration: scatterDur,
      ease: "power2.in",
      stagger: { each: 0.02, from: "edges" },
    }, scatterStart);
    tl.current.seek(frame / fps);
  }, []);

  const content = (
    <AbsoluteFill ref={containerRef} style={{ backgroundColor: BG, opacity: exitOp }}>
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
          const wordWob = organicWobble(`sw${i}`, frame, 2, 1.5, 0.02);
          return (
            <span
              key={i}
              className="starting-word"
              style={{
                display: "inline-block",
                color: DARK,
                transform: `translate(${wordWob.x}px, ${wordWob.y}px)`,
                fontWeight: 400,
                willChange: "transform, opacity",
              }}
            >
              {word}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );

  if (scatterPhase) {
    return (
      <CameraMotionBlur samples={8} shutterAngle={140}>
        {content}
      </CameraMotionBlur>
    );
  }

  return content;
};

/* ─── Segment 10: Phone Mockup — GSAP arc entrance ─── */
const SegPhoneMockup: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const { tl, containerRef } = useGsapTimeline();
  const phoneWob10 = organicWobble("ph10", frame, 2.5, 2, 0.018);

  useEffect(() => {
    if (!containerRef.current) return;
    const t = tl.current;
    t.clear();

    // Phone arc entrance using MotionPath
    t.from(".phone-frame", {
      x: 300,
      y: 500,
      rotation: 12,
      scale: 0.65,
      opacity: 0,
      duration: 1.2,
      ease: "power3.out",
      motionPath: {
        path: [
          { x: 300, y: 500 },
          { x: 280, y: 350 },
          { x: 80, y: 50 },
          { x: 0, y: 0 },
        ],
        curviness: 1.5,
      },
    }, 0);

    // Settle bounce after arc
    t.to(".phone-frame", {
      y: -8,
      duration: 0.15,
      ease: "power2.out",
    }, 1.2);
    t.to(".phone-frame", {
      y: 0,
      duration: 0.3,
      ease: "elastic.out(1, 0.4)",
    }, 1.35);

    // Screen content — "Hi I'm" entrance
    t.from(".phone-hi-text", {
      y: 20,
      opacity: 0,
      duration: 0.5,
      ease: "power3.out",
    }, 0.6);

    // Body text
    t.from(".phone-body-text", {
      y: 15,
      opacity: 0,
      duration: 0.5,
      ease: "power3.out",
    }, 1.0);

    // Exit
    const dur = durationInFrames / fps;
    t.to(".phone-frame", {
      opacity: 0,
      duration: 8 / fps,
      ease: "power2.in",
    }, dur - 8 / fps);
    tl.current.seek(frame / fps);
  }, []);

  return (
    <AbsoluteFill ref={containerRef} style={{ backgroundColor: BG }}>
      {/* Phone frame */}
      <div
        className="phone-frame"
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: `translate(-50%, -50%) translate(${phoneWob10.x}px, ${phoneWob10.y}px)`,
          width: 320,
          height: 620,
          backgroundColor: "#FFFFFF",
          borderRadius: 40,
          border: "3px solid #1A1A2E",
          overflow: "hidden",
          boxShadow: "0 30px 80px rgba(0,0,0,0.18), 0 8px 24px rgba(0,0,0,0.1)",
          willChange: "transform, opacity",
        }}
      >
        {/* Status bar with Dynamic Island */}
        <div
          style={{
            height: 44,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "6px 20px 0",
            fontSize: 13,
            fontWeight: 600,
            color: "#333",
          }}
        >
          <span>9:30</span>
          <div
            style={{
              width: 80,
              height: 24,
              borderRadius: 12,
              backgroundColor: "#000",
            }}
          />
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ fontSize: 13, fontWeight: 700 }}>5G</span>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 1.5, height: 12 }}>
              {[5, 7, 9, 12].map((h, i) => (
                <div key={i} style={{ width: 3, height: h, backgroundColor: "#333", borderRadius: 1 }} />
              ))}
            </div>
            <div style={{ width: 20, height: 10, border: "1.5px solid #333", borderRadius: 2, position: "relative", marginLeft: 2 }}>
              <div style={{ position: "absolute", inset: 1.5, backgroundColor: "#333", borderRadius: 0.5 }} />
              <div style={{ position: "absolute", right: -4, top: 2, width: 3, height: 6, backgroundColor: "#333", borderRadius: "0 1px 1px 0" }} />
            </div>
          </div>
        </div>

        {/* Content */}
        <div style={{ padding: "30px 24px" }}>
          <div className="phone-hi-text" style={{ willChange: "transform, opacity" }}>
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

          <div className="phone-body-text" style={{ marginTop: 8, willChange: "transform, opacity" }}>
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

        {/* Profile avatar */}
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

/* ─── Segment 11: "Designed to supercharge your ideas" — GSAP word springs ─── */
const SegSupercharge: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { tl, containerRef } = useGsapTimeline();

  const wordCfg = [
    { text: "Designed", accent: false, delay: 0,    fontSize: 36, yOff: 0,   italic: false },
    { text: "to",       accent: false, delay: 0.17, fontSize: 36, yOff: 2,   italic: false },
    { text: "supercharge", accent: true, delay: 0.33, fontSize: 42, yOff: -4, italic: true },
    { text: "your",     accent: false, delay: 0.6,  fontSize: 34, yOff: -10, italic: true },
    { text: "ideas",    accent: false, delay: 0.77, fontSize: 38, yOff: -6,  italic: true },
  ];

  useEffect(() => {
    if (!containerRef.current) return;
    const t = tl.current;
    t.clear();

    // Each word enters with distinct personality
    wordCfg.forEach((w, i) => {
      const el = containerRef.current!.querySelector(`.supercharge-word-${i}`);
      if (!el) return;
      const yTravel = w.accent ? 35 : 25;
      t.from(el, {
        y: yTravel,
        opacity: 0,
        scale: w.accent ? 0.7 : 0.95,
        duration: w.accent ? 0.7 : 0.5,
        ease: w.accent ? "elastic.out(1.2, 0.4)" : "back.out(1.4)",
      }, w.delay);
    });

    // Particle dust
    t.from(".supercharge-dust", {
      opacity: 0,
      scale: 0,
      duration: 0.3,
      ease: "power2.out",
      stagger: { each: 0.04, from: "random" },
    }, 0.5);

    t.to(".supercharge-dust", {
      opacity: 0,
      duration: 0.5,
      ease: "power2.in",
      stagger: { each: 0.02 },
    }, 1.5);
    tl.current.seek(frame / fps);
  }, []);

  return (
    <AbsoluteFill ref={containerRef} style={{ backgroundColor: BG }}>
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
          const scWob = organicWobble(`sc${i}`, frame, 2, 1.5, 0.02);
          const isGradient = w.accent;
          const baseStyle: React.CSSProperties = {
            display: "inline-block",
            fontSize: w.fontSize,
            fontFamily: "'Google Sans', sans-serif",
            fontWeight: w.accent ? 500 : 400,
            fontStyle: w.italic ? "italic" : "normal",
            transform: `translate(${scWob.x}px, ${scWob.y + w.yOff}px)`,
            willChange: "transform, opacity",
          };

          if (isGradient) {
            return (
              <span
                key={i}
                className={`supercharge-word-${i}`}
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
            <span key={i} className={`supercharge-word-${i}`} style={{ ...baseStyle, color: DARK }}>
              {w.text}
            </span>
          );
        })}
      </div>

      {/* Subtle particle dust */}
      {Array.from({ length: 20 }, (_, i) => {
        const px = noise2D("sx" + i, frame / 60, i) * 500 + 640;
        const py = noise2D("sy" + i, i, frame / 60) * 300 + 360;
        const size = 3 + (i % 4) * 1.5;
        const colors = [PINK, PURPLE, BLUE, LAVENDER];
        return (
          <div
            key={i}
            className="supercharge-dust"
            style={{
              position: "absolute",
              left: px,
              top: py,
              width: size,
              height: size,
              borderRadius: "50%",
              backgroundColor: colors[i % colors.length],
              willChange: "opacity",
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

/* ─── Segment 12: Phone with "Good morning" + Camera/Dog — GSAP arc entrance ─── */
const SegPhoneGoodMorning: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const { tl, containerRef } = useGsapTimeline();
  const phoneWob12 = organicWobble("ph12", frame, 2, 1.5, 0.018);

  // Phase 2: camera view (frame-driven crossfade)
  const cameraPhase = frame > durationInFrames * 0.5;
  const camTransition = cameraPhase
    ? interpolate(frame, [durationInFrames * 0.5, durationInFrames * 0.6], [0, 1], { extrapolateRight: "clamp" })
    : 0;

  const exitOp = interpolate(frame, [durationInFrames - 8, durationInFrames], [1, 0], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
  });

  useEffect(() => {
    if (!containerRef.current) return;
    const t = tl.current;
    t.clear();

    // Phone arc entrance
    t.from(".phone-12-frame", {
      x: 250,
      y: 400,
      rotation: 10,
      scale: 0.6,
      opacity: 0,
      duration: 1.0,
      ease: "power3.out",
      motionPath: {
        path: [
          { x: 250, y: 400 },
          { x: 200, y: 280 },
          { x: 50, y: 30 },
          { x: 0, y: 0 },
        ],
        curviness: 1.5,
      },
    }, 0);

    // Scale to 0.75 during entrance
    t.to(".phone-12-frame", {
      scale: 0.75,
      duration: 1.0,
      ease: "power3.out",
    }, 0);

    // Settle bounce
    t.to(".phone-12-frame", {
      y: -6,
      duration: 0.12,
      ease: "power2.out",
    }, 1.0);
    t.to(".phone-12-frame", {
      y: 0,
      duration: 0.25,
      ease: "elastic.out(1, 0.4)",
    }, 1.12);

    // Content cards stagger
    t.from(".good-morning-card", {
      y: 15,
      opacity: 0,
      duration: 0.4,
      ease: "power3.out",
      stagger: 0.2,
    }, 0.3);
    tl.current.seek(frame / fps);
  }, []);

  return (
    <AbsoluteFill ref={containerRef} style={{ backgroundColor: "#FAFAFA", opacity: exitOp }}>
      <div
        className="phone-12-frame"
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: `translate(-50%, -50%) translate(${phoneWob12.x}px, ${phoneWob12.y}px)`,
          width: 320,
          height: 620,
          borderRadius: 40,
          border: "6px solid #1A1A2E",
          overflow: "hidden",
          boxShadow: "0 30px 80px rgba(0,0,0,0.18), 0 8px 24px rgba(0,0,0,0.1)",
          willChange: "transform, opacity",
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
          {[0, 1, 2].map((ci) => (
            <div
              key={ci}
              className="good-morning-card"
              style={{
                height: 60,
                backgroundColor: "#F4F4F8",
                borderRadius: 12,
                marginBottom: 10,
                padding: "12px 16px",
                fontSize: 12,
                fontFamily: "'Google Sans', sans-serif",
                color: "#666",
                willChange: "transform, opacity",
              }}
            >
              {ci === 0 && "Find videos on how to care for a plant"}
              {ci === 1 && "Summarize your travel reservations for July"}
              {ci === 2 && "Create a playlist for a road trip"}
            </div>
          ))}

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
          {/* Dog photo area */}
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
            <div
              style={{
                width: 120,
                height: 100,
                borderRadius: "40% 40% 20% 20%",
                backgroundColor: "#D4A574",
                position: "relative",
              }}
            >
              <div style={{ position: "absolute", top: -12, left: 8, width: 24, height: 20, borderRadius: "50% 50% 0 0", backgroundColor: "#C4956A", transform: "rotate(-15deg)" }} />
              <div style={{ position: "absolute", top: -12, right: 8, width: 24, height: 20, borderRadius: "50% 50% 0 0", backgroundColor: "#C4956A", transform: "rotate(15deg)" }} />
              <div style={{ position: "absolute", top: 20, left: 28, width: 8, height: 8, borderRadius: "50%", backgroundColor: "#333" }} />
              <div style={{ position: "absolute", top: 20, right: 28, width: 8, height: 8, borderRadius: "50%", backgroundColor: "#333" }} />
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
  const segments: { start: number; dur: number; Comp: React.FC }[] = [
    { start: 0,   dur: 50,  Comp: SegParticleExplosion },
    { start: 45,  dur: 50,  Comp: SegGeminiReveal },
    { start: 90,  dur: 95,  Comp: SegDesktopUI },
    { start: 180, dur: 35,  Comp: SegItsEverything },
    { start: 210, dur: 50,  Comp: SegAppsFloat },
    { start: 255, dur: 80,  Comp: SegTypingPrompt },
    { start: 330, dur: 95,  Comp: SegGeminiResponse },
    { start: 420, dur: 75,  Comp: SegAndMore },
    { start: 490, dur: 70,  Comp: SegStartingWith },
    { start: 555, dur: 80,  Comp: SegPhoneMockup },
    { start: 630, dur: 65,  Comp: SegSupercharge },
    { start: 690, dur: 55,  Comp: SegPhoneGoodMorning },
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
