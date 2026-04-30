import React from "react";
import { AbsoluteFill } from "remotion";
import { loadFont } from "@remotion/google-fonts/Inter";
import { BlueGradient, LightGradient, DarkBg, SolidBlue, GridOverlay } from "./backgrounds";
import { useGsapProxy } from "./gsapUtils";

const { fontFamily } = loadFont("normal", { subsets: ["latin"], weights: ["400", "700", "800"] });
const BLUE = "#0040FF";

// One use only — reserved for the word "rainbows" in the Scene 03 title.
const RAINBOW_GRADIENT =
  "linear-gradient(90deg, #ff3b3b 0%, #ff8a00 18%, #ffd400 36%, #2cd36f 54%, #2dabff 72%, #7e3bff 88%, #ff3bd1 100%)";

const baseText: React.CSSProperties = {
  fontFamily,
  fontWeight: 800,
  fontStyle: "italic",
  lineHeight: 1.15,
  display: "inline-block",
};

/* ═══════════════════════════════════════════════════════
   Scene 01 — Intro  (48 frames = 2s @ 24fps)
   "Trade market like this." cross-fades to
   "Is simpler than trading market like this."
   ═══════════════════════════════════════════════════════ */

const SCENE01_A = ["Trade", "market", "like", "this"] as const;
const SCENE01_B = ["Is", "simpler", "than", "trading", "market", "like", "this"] as const;

function buildScene01Proxies() {
  const init: Record<string, Record<string, number>> = {
    phraseA: { opacity: 1 },
    phraseB: { opacity: 0 },
  };
  SCENE01_A.forEach((w, i) => { init[`a_${i}`] = { opacity: i === 0 ? 1 : 0, y: i === 0 ? 0 : 15 }; });
  SCENE01_B.forEach((_, i) => { init[`b_${i}`] = { opacity: 0, y: 15 }; });
  return init;
}

export const Scene01_Intro: React.FC = () => {
  const s = useGsapProxy(
    (tl, p) => {
      // Phrase A — words stagger in 0.0s → 0.45s
      SCENE01_A.forEach((_, i) => {
        if (i === 0) return; // first word visible at start
        tl.to(p[`a_${i}`], { opacity: 1, y: 0, duration: 0.15, ease: "power2.out" }, i * 0.15);
      });
      // Phrase A fades out
      tl.to(p.phraseA, { opacity: 0, duration: 0.18, ease: "power2.in" }, 0.75);
      // Phrase B fades in
      tl.to(p.phraseB, { opacity: 1, duration: 0.15, ease: "power2.out" }, 0.85);
      // Phrase B — words stagger in 0.85s → 1.69s
      SCENE01_B.forEach((_, i) => {
        tl.to(p[`b_${i}`], { opacity: 1, y: 0, duration: 0.14, ease: "power2.out" }, 0.85 + i * 0.12);
      });
    },
    buildScene01Proxies(),
  );

  const phraseStyle: React.CSSProperties = {
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    display: "flex",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: "0 32px",
    maxWidth: "92%",
    whiteSpace: "nowrap",
  };

  return (
    <AbsoluteFill>
      <BlueGradient />
      <div style={{ ...phraseStyle, opacity: s.phraseA.opacity }}>
        {SCENE01_A.map((word, i) => {
          const proxy = s[`a_${i}`];
          return (
            <span
              key={word + i}
              style={{
                ...baseText,
                fontSize: 150,
                color: "#fff",
                opacity: proxy.opacity,
                transform: `translateY(${proxy.y}px)`,
              }}
            >
              {word}
            </span>
          );
        })}
      </div>
      <div style={{ ...phraseStyle, opacity: s.phraseB.opacity }}>
        {SCENE01_B.map((word, i) => {
          const proxy = s[`b_${i}`];
          return (
            <span
              key={word + i}
              style={{
                ...baseText,
                fontSize: 130,
                color: "#fff",
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

/* ═══════════════════════════════════════════════════════
   Scene 02 — Numbers  (48 frames = 2s @ 24fps)
   "regaining / 70% / of your profits" — three lines, one frame.
   ═══════════════════════════════════════════════════════ */

export const Scene02_Numbers: React.FC = () => {
  const s = useGsapProxy(
    (tl, p) => {
      // "regaining" fades in first
      tl.to(p.regaining, { opacity: 1, y: 0, duration: 0.22, ease: "power2.out" }, 0.0);
      // Counter rolls 0 → 70
      tl.to(p.num, { opacity: 1, duration: 0.15 }, 0.2);
      tl.to(p.num, { value: 70, duration: 0.6, ease: "power2.out", snap: { value: 1 } }, 0.2);
      tl.to(p.num, { scale: 1, duration: 0.5, ease: "back.out(1.6)" }, 0.2);
      // "%" reveals
      tl.to(p.pct, { opacity: 1, duration: 0.15, ease: "power2.out" }, 0.65);
      // "of your profits" cascades in last
      tl.to(p.caption, { opacity: 1, y: 0, duration: 0.22, ease: "power2.out" }, 0.95);
    },
    {
      regaining: { opacity: 0, y: 12 },
      num: { value: 0, opacity: 0, scale: 0.7 },
      pct: { opacity: 0 },
      caption: { opacity: 0, y: 14 },
    },
  );

  const blueGradientText: React.CSSProperties = {
    backgroundImage: `linear-gradient(180deg, ${BLUE} 0%, #2a5cff 60%, ${BLUE} 100%)`,
    backgroundClip: "text",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    color: "transparent",
  };

  return (
    <AbsoluteFill>
      <LightGradient />
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 4,
          whiteSpace: "nowrap",
        }}
      >
        {/* "regaining" */}
        <span
          style={{
            ...baseText,
            fontSize: 96,
            fontWeight: 700,
            color: BLUE,
            opacity: s.regaining.opacity,
            transform: `translateY(${s.regaining.y}px)`,
            letterSpacing: "-0.01em",
          }}
        >
          regaining
        </span>

        {/* 70% */}
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            opacity: s.num.opacity,
            transform: `scale(${s.num.scale})`,
          }}
        >
          <span
            style={{
              ...baseText,
              ...blueGradientText,
              fontSize: 360,
              letterSpacing: "-0.04em",
            }}
          >
            {Math.round(s.num.value)}
          </span>
          <span
            style={{
              ...baseText,
              ...blueGradientText,
              fontSize: 260,
              marginLeft: 12,
              opacity: s.pct.opacity,
            }}
          >
            %
          </span>
        </div>

        {/* "of your profits" */}
        <span
          style={{
            ...baseText,
            fontSize: 110,
            fontWeight: 700,
            color: BLUE,
            opacity: s.caption.opacity,
            transform: `translateY(${s.caption.y}px)`,
            marginTop: 8,
          }}
        >
          of your profits
        </span>
      </div>
    </AbsoluteFill>
  );
};

/* ═══════════════════════════════════════════════════════
   Scene 03 — DarkGrid  (84 frames = 3.5s @ 24fps)
   Phase 1: "But / what / are / rainbows?" word flash
   Phase 2: title "What are rainbows?" slides in (rainbow gradient on "rainbows")
   ═══════════════════════════════════════════════════════ */

export const Scene03_DarkGrid: React.FC = () => {
  const s = useGsapProxy(
    (tl, p) => {
      // "But" visible at 0
      tl.to(p.but, { opacity: 0, duration: 0.08, ease: "power2.in" }, 0.35);
      // "what" enters
      tl.to(p.what, { opacity: 1, y: 0, duration: 0.1, ease: "power2.out" }, 0.35);
      tl.to(p.what, { opacity: 0, duration: 0.08, ease: "power2.in" }, 0.7);
      // "are"
      tl.to(p.are, { opacity: 1, y: 0, duration: 0.1, ease: "power2.out" }, 0.7);
      tl.to(p.are, { opacity: 0, duration: 0.08, ease: "power2.in" }, 1.0);
      // "rainbows?" — held longer, with rainbow gradient
      tl.to(p.rainbows, { opacity: 1, y: 0, duration: 0.12, ease: "power2.out" }, 1.0);
      // Phase 1 cross-fades out at 1.6s
      tl.to(p.phase1, { opacity: 0, duration: 0.18, ease: "power2.in" }, 1.6);
      // Phase 2 — title slides in from right at 1.7s
      tl.to(p.phase2, { opacity: 1, duration: 0.15, ease: "power2.out" }, 1.7);
      tl.to(p.title, { x: 0, duration: 0.45, ease: "power2.out" }, 1.7);
    },
    {
      phase1: { opacity: 1 },
      but: { opacity: 1, y: 0 },
      what: { opacity: 0, y: 15 },
      are: { opacity: 0, y: 15 },
      rainbows: { opacity: 0, y: 15 },
      phase2: { opacity: 0 },
      title: { x: 60 },
    },
  );

  const flashStyle: React.CSSProperties = {
    position: "absolute",
    left: "50%",
    top: "50%",
    transform: "translate(-50%, -50%)",
    fontSize: 165,
    color: "#fff",
    whiteSpace: "nowrap",
  };

  const rainbowText: React.CSSProperties = {
    backgroundImage: RAINBOW_GRADIENT,
    backgroundClip: "text",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    color: "transparent",
  };

  return (
    <AbsoluteFill>
      <DarkBg />
      <GridOverlay color="rgba(255,255,255,0.18)" cols={10} rows={7} />

      {/* Phase 1 — single words, centered */}
      <div style={{ opacity: s.phase1.opacity }}>
        {s.but.opacity > 0.01 && (
          <span style={{ ...baseText, fontStyle: "normal", ...flashStyle, transform: `translate(-50%, calc(-50% + ${s.but.y}px))`, opacity: s.but.opacity }}>
            But
          </span>
        )}
        {s.what.opacity > 0.01 && (
          <span style={{ ...baseText, fontStyle: "normal", ...flashStyle, transform: `translate(-50%, calc(-50% + ${s.what.y}px))`, opacity: s.what.opacity }}>
            what
          </span>
        )}
        {s.are.opacity > 0.01 && (
          <span style={{ ...baseText, fontStyle: "normal", ...flashStyle, transform: `translate(-50%, calc(-50% + ${s.are.y}px))`, opacity: s.are.opacity }}>
            are
          </span>
        )}
        {s.rainbows.opacity > 0.01 && (
          <span
            style={{
              ...baseText,
              fontStyle: "normal",
              ...flashStyle,
              ...rainbowText,
              fontSize: 195,
              transform: `translate(-50%, calc(-50% + ${s.rainbows.y}px))`,
              opacity: s.rainbows.opacity,
            }}
          >
            rainbows?
          </span>
        )}
      </div>

      {/* Phase 2 — title card, left-aligned */}
      <div
        style={{
          position: "absolute",
          top: "55%",
          left: "8%",
          transform: `translateX(${s.title.x}px)`,
          opacity: s.phase2.opacity,
          maxWidth: "85%",
          display: "flex",
          flexWrap: "wrap",
          gap: "0 28px",
        }}
      >
        <span style={{ ...baseText, fontSize: 200, color: "#fff" }}>What</span>
        <span style={{ ...baseText, fontSize: 200, color: "#fff" }}>are</span>
        <span style={{ ...baseText, fontSize: 200, ...rainbowText }}>rainbows?</span>
      </div>
    </AbsoluteFill>
  );
};

/* ═══════════════════════════════════════════════════════
   Scene 04 — CubeExplode  (72 frames = 3s @ 24fps)
   "Rainbows filters out illegal activities."
   White square → isometric cube → 10-shard explosion.
   ═══════════════════════════════════════════════════════ */

const CUBE_SIZE = 500;
const SMALL_CUBE = 120;

function seededRand(seed: number) {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

const EXPLOSION_TARGETS = Array.from({ length: 10 }, (_, i) => {
  const angle = seededRand(i * 7 + 3) * Math.PI * 2;
  const dist = 300 + seededRand(i * 13 + 1) * 300;
  return {
    x: Math.cos(angle) * dist,
    y: Math.sin(angle) * dist * 0.8,
    rot: seededRand(i * 19 + 5) * 720 - 360,
  };
});

const CubeFace: React.FC<{ size: number; transform: string; shade: string }> = ({ size, transform, shade }) => (
  <div
    style={{
      position: "absolute",
      width: size,
      height: size,
      background: shade,
      border: "1.5px solid rgba(0,0,0,0.25)",
      transform,
      backfaceVisibility: "hidden",
    }}
  />
);

const IsoCube: React.FC<{ size: number; opacity?: number }> = ({ size, opacity = 1 }) => {
  const half = size / 2;
  return (
    <div
      style={{
        width: size,
        height: size,
        position: "relative",
        transformStyle: "preserve-3d",
        transform: "rotateX(-30deg) rotateY(45deg)",
        opacity,
      }}
    >
      <CubeFace size={size} transform={`translateZ(${half}px)`} shade="rgba(255,255,255,0.95)" />
      <CubeFace size={size} transform={`rotateX(90deg) translateZ(${half}px)`} shade="rgba(255,255,255,0.8)" />
      <CubeFace size={size} transform={`rotateY(90deg) translateZ(${half}px)`} shade="rgba(230,230,240,0.85)" />
    </div>
  );
};

const SCENE04_WORDS = ["Rainbows", "filters", "out", "illegal", "activities"] as const;

type Scene04Proxies = {
  cube: { opacity: number; rotX: number; rotY: number };
  cubeFade: { opacity: number };
  [key: `w_${number}`]: { opacity: number; y: number };
  [key: `shard${number}`]: { x: number; y: number; rotation: number; opacity: number };
};

function buildScene04Proxies(): Scene04Proxies {
  const base: Record<string, Record<string, number>> = {
    cube: { opacity: 0, rotX: 0, rotY: 0 },
    cubeFade: { opacity: 1 },
  };
  SCENE04_WORDS.forEach((_, i) => { base[`w_${i}`] = { opacity: 0, y: 15 }; });
  for (let i = 0; i < 10; i++) {
    base[`shard${i}`] = { x: 0, y: 0, rotation: 0, opacity: 0 };
  }
  return base as unknown as Scene04Proxies;
}

export const Scene04_CubeExplode: React.FC = () => {
  const s = useGsapProxy<Scene04Proxies>(
    (tl, p) => {
      // Word-by-word — 5 words across 0–0.7s
      SCENE04_WORDS.forEach((_, i) => {
        tl.to(p[`w_${i}` as keyof Scene04Proxies], { opacity: 1, y: 0, duration: 0.14, ease: "power2.out" }, i * 0.16);
      });

      // White square appears at 0.3s
      tl.to(p.cube, { opacity: 1, duration: 0.15, ease: "power2.out" }, 0.3);
      // Morph to isometric cube from 0.85s–1.25s
      tl.to(p.cube, { rotX: -30, rotY: 45, duration: 0.4, ease: "power2.out" }, 0.85);
      // Big cube fades out as explosion starts
      tl.to(p.cubeFade, { opacity: 0, duration: 0.15, ease: "power2.in" }, 1.45);

      // Explosion at 1.5s — each shard flies out
      for (let i = 0; i < 10; i++) {
        const target = EXPLOSION_TARGETS[i];
        const shard = p[`shard${i}` as keyof Scene04Proxies] as { x: number; y: number; rotation: number; opacity: number };
        const offset = 1.5 + i * 0.02;
        tl.to(shard, { opacity: 1, duration: 0.08 }, offset);
        tl.to(shard, { x: target.x, y: target.y, rotation: target.rot, duration: 1.0, ease: "power2.out" }, offset);
        tl.to(shard, { opacity: 0, duration: 0.3, ease: "power2.in" }, offset + 0.8);
      }
    },
    buildScene04Proxies(),
  );

  const showBigCube = s.cube.opacity > 0.01 && s.cubeFade.opacity > 0.01;

  return (
    <AbsoluteFill>
      <SolidBlue />
      <GridOverlay color="rgba(255,255,255,0.12)" />

      {/* Sentence */}
      <div
        style={{
          position: "absolute",
          top: "12%",
          left: "50%",
          transform: "translateX(-50%)",
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          gap: "0 22px",
          maxWidth: "90%",
        }}
      >
        {SCENE04_WORDS.map((word, i) => {
          const proxy = s[`w_${i}` as keyof Scene04Proxies] as { opacity: number; y: number };
          return (
            <span
              key={word + i}
              style={{
                ...baseText,
                fontSize: 130,
                color: "#fff",
                opacity: proxy.opacity,
                transform: `translateY(${proxy.y}px)`,
              }}
            >
              {word}
            </span>
          );
        })}
      </div>

      {/* Big cube — morphs from flat square to isometric */}
      {showBigCube && (
        <div
          style={{
            position: "absolute",
            top: "55%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            perspective: 800,
            opacity: s.cube.opacity * s.cubeFade.opacity,
          }}
        >
          <div
            style={{
              width: CUBE_SIZE,
              height: CUBE_SIZE,
              position: "relative",
              transformStyle: "preserve-3d",
              transform: `rotateX(${s.cube.rotX}deg) rotateY(${s.cube.rotY}deg)`,
            }}
          >
            <CubeFace size={CUBE_SIZE} transform={`translateZ(${CUBE_SIZE / 2}px)`} shade="rgba(255,255,255,0.95)" />
            <CubeFace size={CUBE_SIZE} transform={`rotateX(90deg) translateZ(${CUBE_SIZE / 2}px)`} shade="rgba(255,255,255,0.8)" />
            <CubeFace size={CUBE_SIZE} transform={`rotateY(90deg) translateZ(${CUBE_SIZE / 2}px)`} shade="rgba(230,230,240,0.85)" />
          </div>
        </div>
      )}

      {/* Explosion — 10 small cubes */}
      <div
        style={{
          position: "absolute",
          top: "55%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          perspective: 800,
        }}
      >
        {EXPLOSION_TARGETS.map((_, i) => {
          const shard = s[`shard${i}` as keyof Scene04Proxies] as { x: number; y: number; rotation: number; opacity: number };
          if (shard.opacity < 0.01) return null;
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: -SMALL_CUBE / 2,
                top: -SMALL_CUBE / 2,
                transform: `translate(${shard.x}px, ${shard.y}px) rotate(${shard.rotation}deg)`,
                opacity: shard.opacity,
              }}
            >
              <IsoCube size={SMALL_CUBE} />
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

/* ── Meta ── */

export const sceneAMetas = [
  { id: "RP-Scene01", component: Scene01_Intro, durationInFrames: 48 },
  { id: "RP-Scene02", component: Scene02_Numbers, durationInFrames: 48 },
  { id: "RP-Scene03", component: Scene03_DarkGrid, durationInFrames: 84 },
  { id: "RP-Scene04", component: Scene04_CubeExplode, durationInFrames: 72 },
];
