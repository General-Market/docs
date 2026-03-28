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
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: 500 + rng() * 280,
    y: 300 + (rng() - 0.5) * 120,
    size: 2 + rng() * 10,
    color: colors[Math.floor(rng() * colors.length)],
    speed: 0.5 + rng() * 3,
    angle: (rng() - 0.3) * Math.PI * 0.8, // bias rightward for sweep
    noiseOffsetX: rng() * 1000,
    noiseOffsetY: rng() * 1000,
    delay: rng() * 15,
    shape: shapes[Math.floor(rng() * shapes.length)],
  }));
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

/* ─── Particle Field ─── */
const ParticleField: React.FC<{
  frame: number;
  fps: number;
  particles: Particle[];
  phase: "explode" | "swirl" | "converge" | "scatter";
}> = ({ frame, fps, particles, phase }) => {
  return (
    <>
      {particles.map((p) => {
        const t = Math.max(0, frame - p.delay) / fps;
        const noiseX = noise2D("px" + p.id, t * 0.8 + p.noiseOffsetX, 0) * 60;
        const noiseY = noise2D("py" + p.id, 0, t * 0.8 + p.noiseOffsetY) * 60;

        let px: number, py: number, opacity: number, scale: number;

        if (phase === "explode") {
          // Deceleration: distance grows fast then tapers (1 - e^-kt)
          const rawDist = p.speed * 120;
          const decel = 1 - Math.exp(-t * 2.5); // fast start, slow finish
          const dist = rawDist * decel;
          // Sweeping arc: particles curve slightly as they travel
          const curveAngle = p.angle + t * 0.4 * (p.id % 2 === 0 ? 1 : -1);
          px = p.x + Math.cos(curveAngle) * dist + noiseX;
          py = p.y + Math.sin(curveAngle) * dist + noiseY;
          opacity = interpolate(t, [0, 0.05, 0.6, 1.0], [0, 1, 0.8, 0], {
            extrapolateRight: "clamp",
          });
          scale = interpolate(t, [0, 0.15, 0.8], [0.2, 1, 0.3], {
            extrapolateRight: "clamp",
          });
        } else if (phase === "swirl") {
          const swirlAngle = p.angle + t * 2;
          const dist = 50 + p.speed * t * 40;
          px = 640 + Math.cos(swirlAngle) * dist + noiseX * 0.5;
          py = 360 + Math.sin(swirlAngle) * dist + noiseY * 0.5;
          opacity = interpolate(t, [0, 0.3, 2, 2.5], [1, 0.8, 0.6, 0], {
            extrapolateRight: "clamp",
          });
          scale = 0.7 + Math.sin(t * 3) * 0.3;
        } else if (phase === "converge") {
          const targetX = 640;
          const targetY = 360;
          const startX = p.x + Math.cos(p.angle) * 300 + noiseX;
          const startY = p.y + Math.sin(p.angle) * 200 + noiseY;
          const prog = interpolate(t, [0, 1.5], [0, 1], {
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.25, 0.46, 0.45, 0.94),
          });
          px = startX + (targetX - startX) * prog;
          py = startY + (targetY - startY) * prog;
          opacity = interpolate(t, [0, 0.2, 1.2, 1.5], [0, 1, 1, 0], {
            extrapolateRight: "clamp",
          });
          scale = interpolate(prog, [0, 0.5, 1], [1, 0.8, 0.2], {
            extrapolateRight: "clamp",
          });
        } else {
          // scatter
          const dist = p.speed * t * 200;
          px = p.x + Math.cos(p.angle) * dist + noiseX * 2;
          py = p.y + Math.sin(p.angle) * dist + noiseY * 2;
          opacity = interpolate(t, [0, 0.1, 0.5, 1], [1, 0.8, 0.4, 0], {
            extrapolateRight: "clamp",
          });
          scale = interpolate(t, [0, 0.5], [1, 0], {
            extrapolateRight: "clamp",
          });
        }

        if (opacity <= 0) return null;

        const s = p.size * scale;
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
              ? `rotate(45deg)`
              : p.shape === "star"
                ? `rotate(${t * 60}deg)`
                : undefined,
          filter: s > 5 ? `blur(${(s - 5) * 0.15}px)` : undefined,
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

  // Particles explode outward from center in a swirl
  const phase: "explode" | "swirl" = frame < fps * 0.8 ? "explode" : "swirl";

  return (
    <AbsoluteFill style={{ backgroundColor: BG }}>
      {/* Soft radial glow at center */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: 400,
          height: 400,
          transform: "translate(-50%, -50%)",
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

/* ─── Segment 2: Gemini Text Materializes ─── */
const SegGeminiReveal: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const particles = useMemo(() => generateParticles(60, 99), []);

  const textSpring = spring({ frame, fps, config: { damping: 12, stiffness: 120 } });
  const textOpacity = interpolate(textSpring, [0, 1], [0, 1]);
  const textScale = interpolate(textSpring, [0, 1], [0.9, 1]);

  // Gemini text uses a blue→purple→pink gradient like the reference
  // The gradient shifts slowly over time for a living feel

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

      {/* Gemini text */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: `translate(-50%, -50%) scale(${textScale})`,
          opacity: textOpacity,
          fontSize: 72,
          fontFamily: "'Google Sans', 'Product Sans', sans-serif",
          fontWeight: 400,
          background: `linear-gradient(90deg, ${BLUE} 0%, ${PURPLE} 45%, ${PINK} 100%)`,
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          letterSpacing: -1,
        }}
      >
        Gemini
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

/* ─── Segment 3: Desktop UI Mockup ─── */
const SegDesktopUI: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // UI slides in with perspective tilt
  const enterSpring = spring({ frame, fps, config: { damping: 20, stiffness: 100 } });
  const uiScale = interpolate(enterSpring, [0, 1], [1.08, 1]);
  const uiY = interpolate(enterSpring, [0, 1], [40, 0]);
  const uiRotX = interpolate(enterSpring, [0, 1], [6, 2.5]);
  const uiOpacity = interpolate(enterSpring, [0, 1], [0, 1]);

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
          transform: `translate(-50%, -50%) translateY(${uiY}px) perspective(1200px) rotateX(${uiRotX}deg) scale(${uiScale})`,
          opacity: uiOpacity,
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

  const enterOp = interpolate(frame, [0, 8], [0, 1], { extrapolateRight: "clamp" });
  const exitOp = interpolate(frame, [durationInFrames - 10, durationInFrames], [1, 0], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
  });

  // Scroll the text wall
  const scrollY = interpolate(frame, [0, durationInFrames], [0, -80], {
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.sin),
  });
  const scrollX = interpolate(frame, [0, durationInFrames], [0, -30], {
    extrapolateRight: "clamp",
  });

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
          transform: `translate(-50%, -50%) translate(${scrollX}px, ${scrollY}px)`,
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

            return (
              <div
                key={`${row}-${col}`}
                style={{
                  position: "absolute",
                  left: (col - 2) * 260,
                  top: (row - 4) * 48,
                  fontSize,
                  fontWeight,
                  fontFamily: "'Google Sans', sans-serif",
                  color,
                  opacity,
                  whiteSpace: "nowrap",
                  transform: isCenter ? `scale(${centerScale})` : undefined,
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
      {/* Floating app icons */}
      {apps.map((app, i) => {
        const delay = i * 3;
        const appSpring = spring({
          frame: frame - delay,
          fps,
          config: { damping: 12, stiffness: 80 },
        });
        const floatY = noise2D("app" + i, frame / 35, 0) * 14;
        const floatX = noise2D("appx" + i, 0, frame / 45) * 10;
        const iconScale = interpolate(appSpring, [0, 1], [0, 1]);

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
              transform: `scale(${iconScale})`,
              opacity: interpolate(appSpring, [0, 1], [0, 1]),
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
              overflow: "hidden",
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
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
          display: "flex",
          gap: 12,
          fontSize: 30,
          fontFamily: "'Google Sans', sans-serif",
          fontWeight: 400,
          color: DARK,
        }}
      >
        <span style={{ opacity: text1Op }}>you know</span>
        <span
          style={{
            opacity: text2Op,
            color: BLUE,
          }}
        >
          and love
        </span>
      </div>
    </AbsoluteFill>
  );
};

/* ─── Segment 6: Typing prompt — "Summarize my recent emails..." ─── */
const SegTypingPrompt: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const { durationInFrames } = useVideoConfig();
  const fullText = "Summarize my recent emails from Harper Elementary School";
  const charCount = Math.floor(
    interpolate(frame, [0, durationInFrames * 0.85], [0, fullText.length], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    })
  );
  const displayed = fullText.slice(0, charCount);

  const barOpacity = interpolate(frame, [0, 10], [0, 1], {
    extrapolateRight: "clamp",
  });
  const exitOp = interpolate(frame, [durationInFrames - 8, durationInFrames], [1, 0], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
  });

  return (
    <AbsoluteFill style={{ backgroundColor: "#FAFAFA", opacity: exitOp }}>
      {/* Input bar */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
          width: 780,
          opacity: barOpacity,
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
  const { fps } = useVideoConfig();

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
  const { durationInFrames } = useVideoConfig();
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

  // Browser container zoom — reference shows this in a browser-like window
  const containerSpring = spring({ frame, fps, config: { damping: 20, stiffness: 100 } });
  const containerScale = interpolate(containerSpring, [0, 1], [0.92, 0.88]);
  const containerY = interpolate(containerSpring, [0, 1], [30, 0]);

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
          transform: `translate(-50%, -50%) translateY(${containerY}px) scale(${containerScale})`,
          width: 960,
          height: 580,
          backgroundColor: "#FFFFFF",
          borderRadius: 16,
          boxShadow: "0 20px 60px rgba(0,0,0,0.1), 0 4px 12px rgba(0,0,0,0.05)",
          overflow: "hidden",
          display: "flex",
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

/* ─── Segment 8: "And more" → "And moooore" with colorful balls ─── */
const SegAndMore: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Phase 1: "And" appears
  const andSpring = spring({ frame, fps, config: { damping: 20, stiffness: 120 } });

  // Phase 2: "more" appears in blue
  const moreSpring = spring({
    frame: frame - fps * 0.6,
    fps,
    config: { damping: 15 },
  });

  const { durationInFrames } = useVideoConfig();

  // Phase 3: "more" stretches — o's multiply and become colorful circles
  // Reference frame_027 shows ~5 o's, frame_028 shows ~15+ colorful circles scrolling left
  const stretchStart = fps * 1.0;
  const stretchFrame = frame - stretchStart;
  const stretch = stretchFrame > 0
    ? interpolate(stretchFrame, [0, fps * 1.2], [0, 1], {
        extrapolateRight: "clamp",
        easing: Easing.bezier(0.25, 0.1, 0.25, 1),
      })
    : 0;

  // O count grows from 1 to 18 during stretch
  const oCount = Math.floor(interpolate(stretch, [0, 1], [1, 18]));

  // Phase 3b: colorful balls phase — each 'o' becomes a colored circle
  const ballPhase = stretch > 0.3;
  const ballProgress = ballPhase
    ? interpolate(stretch, [0.3, 0.6], [0, 1], { extrapolateRight: "clamp" })
    : 0;

  // Horizontal scroll — text slides left as it grows (reference shows it going off-screen)
  const scrollX = interpolate(stretch, [0.15, 1], [0, -500], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.2, 0.0, 0.3, 1),
  });

  // Ball colors cycle through Gemini palette
  const ballColors = [BLUE, PURPLE, PINK, BLUE, "#A78BFA", PINK, PURPLE, BLUE, PINK, PURPLE, BLUE, "#A78BFA", PINK, BLUE, PURPLE, PINK, BLUE, PURPLE];

  const exitOp = interpolate(frame, [durationInFrames - 8, durationInFrames], [1, 0], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
  });

  return (
    <AbsoluteFill style={{ backgroundColor: BG_WARM, opacity: exitOp }}>
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: `translate(-50%, -50%) translateX(${scrollX}px)`,
          display: "flex",
          alignItems: "center",
          gap: ballPhase ? 4 : 12,
          fontSize: 44,
          fontFamily: "'Google Sans', sans-serif",
          fontWeight: 400,
          whiteSpace: "nowrap",
        }}
      >
        {/* "And" fades out during ball phase */}
        <span
          style={{
            color: DARK,
            opacity: interpolate(andSpring, [0, 1], [0, 1]) * (1 - ballProgress),
            transform: `translateY(${interpolate(andSpring, [0, 1], [20, 0])}px)`,
            display: "inline-block",
          }}
        >
          And
        </span>

        {/* "more" — shown as single word before stretch, then split into m + o's + re */}
        {stretch <= 0.05 ? (
          // Before stretching: single word
          <span
            style={{
              opacity: interpolate(moreSpring, [0, 1], [0, 1]),
              display: "inline-block",
              color: BLUE,
              fontSize: 44,
            }}
          >
            more
          </span>
        ) : (
          // Stretching: decomposed into m + o circles + re
          <>
            {/* "m" letter — fades out as balls take over */}
            <span
              style={{
                opacity: interpolate(moreSpring, [0, 1], [0, 1]) * (1 - ballProgress),
                display: ballProgress > 0.95 ? "none" : "inline-block",
                color: BLUE,
                fontSize: 44,
              }}
            >
              m
            </span>

            {/* O's — transition from letters to colored circles */}
            {Array.from({ length: oCount }, (_, i) => {
              const circleSize = interpolate(ballProgress, [0, 1], [0, 28]);
              const letterOpacity = Math.max(0, 1 - ballProgress * 2);
              const circleOpacity = interpolate(ballProgress, [0, 0.3], [0, 1], { extrapolateRight: "clamp" });
              const color = ballColors[i % ballColors.length];

              return (
                <span
                  key={i}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    position: "relative",
                    width: ballPhase ? Math.max(circleSize + 2, 18) : undefined,
                    height: ballPhase ? Math.max(circleSize + 2, 28) : undefined,
                  }}
                >
                  {letterOpacity > 0 && (
                    <span
                      style={{
                        opacity: letterOpacity,
                        color: BLUE,
                        fontSize: 44,
                        position: ballPhase ? "absolute" : undefined,
                      }}
                    >
                      o
                    </span>
                  )}
                  {ballPhase && (
                    <div
                      style={{
                        width: circleSize,
                        height: circleSize,
                        borderRadius: "50%",
                        backgroundColor: color,
                        opacity: circleOpacity,
                      }}
                    />
                  )}
                </span>
              );
            })}

            {/* "re" — fades out as balls take over */}
            <span
              style={{
                opacity: interpolate(moreSpring, [0, 1], [0, 1]) * (1 - ballProgress),
                display: ballProgress > 0.95 ? "none" : "inline-block",
                color: BLUE,
                fontSize: 44,
              }}
            >
              re
            </span>
          </>
        )}
      </div>
    </AbsoluteFill>
  );
};

/* ─── Segment 9: "Starting with the new Gemini app" ─── */
const SegStartingWith: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const words = ["Starting", "with", "the", "new", "Gemini", "app"];
  const wordDelays = [0, 4, 8, 12, 16, 20]; // frame delays

  const { durationInFrames } = useVideoConfig();

  // At end, text scatters/distorts before next segment
  const scatterPhase = frame > durationInFrames - fps * 0.5;
  const scatterProgress = scatterPhase
    ? interpolate(frame, [durationInFrames - fps * 0.5, durationInFrames], [0, 1], { extrapolateRight: "clamp" })
    : 0;

  const exitOp = interpolate(frame, [durationInFrames - 5, durationInFrames], [1, 0], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
  });

  return (
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
          const isAccent = false; // Reference shows all black text
          const color = DARK;

          // Scatter effect at end
          const scatterX = scatterPhase
            ? noise2D("sx" + i, scatterProgress * 3, i) * 200 * scatterProgress
            : 0;
          const scatterY = scatterPhase
            ? noise2D("sy" + i, i, scatterProgress * 3) * 150 * scatterProgress
            : 0;
          const scatterRot = scatterProgress * (i - 2.5) * 15;

          return (
            <span
              key={i}
              style={{
                display: "inline-block",
                color,
                opacity: interpolate(wSpring, [0, 1], [0, 1]) * (1 - scatterProgress * 0.5),
                transform: `translateY(${interpolate(wSpring, [0, 1], [30, 0]) + scatterY}px) translateX(${scatterX}px) rotate(${scatterRot}deg)`,
                fontWeight: isAccent ? 500 : 400,
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

/* ─── Segment 10: Phone Mockup — Gemini Mobile ─── */
const SegPhoneMockup: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Phone slides up and tilts
  const phoneSpring = spring({ frame, fps, config: { damping: 14, stiffness: 80 } });
  const phoneY = interpolate(phoneSpring, [0, 1], [300, 0]);
  const phoneScale = interpolate(phoneSpring, [0, 1], [0.7, 1]);

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
          transform: `translate(-50%, -50%) translateY(${phoneY}px) scale(${phoneScale})`,
          width: 320,
          height: 620,
          backgroundColor: "#FFFFFF",
          borderRadius: 40,
          border: "6px solid #1A1A2E",
          overflow: "hidden",
          boxShadow: "0 30px 80px rgba(0,0,0,0.18), 0 8px 24px rgba(0,0,0,0.1)",
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

  const words = [
    { text: "Designed", accent: false },
    { text: "to", accent: false },
    { text: "supercharge", accent: true },
    { text: "your", accent: false },
    { text: "ideas", accent: false },
  ];

  // Each word has staggered entry — slightly wider gaps for emphasis
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
        {words.map((w, i) => {
          const wordDelayFrames = [0, 5, 10, 16, 21]; // wider stagger for pacing
          const wSpring = spring({
            frame: frame - wordDelayFrames[i],
            fps,
            config: { damping: w.accent ? 12 : 18, stiffness: w.accent ? 110 : 100 },
          });
          const scale = w.accent
            ? interpolate(wSpring, [0, 1], [0.85, 1])
            : 1;
          const yOff = interpolate(wSpring, [0, 1], [25, 0]);

          // "supercharge" has gradient color
          const style: React.CSSProperties = {
            display: "inline-block",
            fontSize: 36,
            fontFamily: "'Google Sans', sans-serif",
            fontWeight: 400,
            color: DARK,
            opacity: interpolate(wSpring, [0, 1], [0, 1]),
            transform: `translateY(${yOff}px) scale(${scale})`,
          };

          return (
            <span key={i} style={style}>
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

  const phoneSpring = spring({ frame, fps, config: { damping: 14 } });
  const phoneScale = interpolate(phoneSpring, [0, 1], [0.8, 0.75]);
  const phoneY = interpolate(phoneSpring, [0, 1], [200, 0]);

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
          transform: `translate(-50%, -50%) translateY(${phoneY}px) scale(${phoneScale})`,
          width: 320,
          height: 620,
          borderRadius: 40,
          border: "6px solid #1A1A2E",
          overflow: "hidden",
          boxShadow: "0 30px 80px rgba(0,0,0,0.18), 0 8px 24px rgba(0,0,0,0.1)",
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
