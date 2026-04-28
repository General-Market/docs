import React from "react";
import { AbsoluteFill } from "remotion";
import { loadFont } from "@remotion/google-fonts/Inter";
import { BlueGradient, LightGradient, DarkBg, SolidBlue, GridOverlay } from "../standrew/backgrounds";
import { useGsapProxy } from "../standrew/gsapUtils";

const { fontFamily } = loadFont("normal", { subsets: ["latin"], weights: ["400", "700", "800"] });
const BLUE = "#0040FF";

const baseText: React.CSSProperties = {
  fontFamily,
  fontWeight: 800,
  fontStyle: "italic",
  lineHeight: 1.15,
  display: "inline-block",
};

const center: React.CSSProperties = {
  position: "absolute",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  display: "flex",
  gap: 36,
  justifyContent: "center",
  whiteSpace: "nowrap",
};

/* ═══════════════════════════════════════════════════════
   Scene 01 — Intro  (48 frames = 2s @ 24fps)
   "When you want leverage" → "you trade perps."
   ═══════════════════════════════════════════════════════ */

const SCENE01_PHRASE_A = ["When", "you", "want", "leverage"] as const;
const SCENE01_PHRASE_B = ["you", "trade", "perps."] as const;

function buildScene01Proxies() {
  const init: Record<string, Record<string, number>> = {
    phraseA: { opacity: 1 },
    phraseB: { opacity: 0 },
  };
  SCENE01_PHRASE_A.forEach((_, i) => {
    init[`a_${i}`] = { opacity: i === 0 ? 1 : 0, y: i === 0 ? 0 : 15 };
  });
  SCENE01_PHRASE_B.forEach((_, i) => {
    init[`b_${i}`] = { opacity: 0, y: 15 };
  });
  return init;
}

const scene01Init = buildScene01Proxies();

export const Scene01_Intro: React.FC = () => {
  const s = useGsapProxy(
    (tl, p) => {
      // "When" already visible. Rest of phrase A staggers in.
      SCENE01_PHRASE_A.forEach((_, i) => {
        if (i === 0) return;
        tl.to(p[`a_${i}`], { opacity: 1, y: 0, duration: 0.15, ease: "power2.out" }, 0.15 + i * 0.12);
      });

      // Phrase A fades out at 0.85s
      tl.to(p.phraseA, { opacity: 0, duration: 0.18, ease: "power2.in" }, 0.85);

      // Phrase B fades in at 0.95s, words stagger
      tl.to(p.phraseB, { opacity: 1, duration: 0.15, ease: "power2.out" }, 0.95);
      SCENE01_PHRASE_B.forEach((_, i) => {
        tl.to(p[`b_${i}`], { opacity: 1, y: 0, duration: 0.15, ease: "power2.out" }, 0.95 + i * 0.18);
      });
    },
    scene01Init,
  );

  return (
    <AbsoluteFill>
      <BlueGradient />
      <div style={{ ...center, opacity: s.phraseA.opacity }}>
        {SCENE01_PHRASE_A.map((word, i) => {
          const proxy = s[`a_${i}`];
          return (
            <span
              key={i}
              style={{
                ...baseText,
                fontSize: 160,
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
      <div style={{ ...center, opacity: s.phraseB.opacity }}>
        {SCENE01_PHRASE_B.map((word, i) => {
          const proxy = s[`b_${i}`];
          return (
            <span
              key={i}
              style={{
                ...baseText,
                fontSize: 200,
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
   "When you want volatility exposure" → "you trade options."
   Light gradient. Phase A small-ish, phase B big italic.
   ═══════════════════════════════════════════════════════ */

const SCENE02_PHRASE_A = ["When", "you", "want", "volatility", "exposure"] as const;
const SCENE02_PHRASE_B = ["you", "trade", "options."] as const;

function buildScene02Proxies() {
  const init: Record<string, Record<string, number>> = {
    phraseA: { opacity: 1 },
    phraseB: { opacity: 0 },
  };
  SCENE02_PHRASE_A.forEach((_, i) => {
    init[`a_${i}`] = { opacity: 0, y: 15 };
  });
  SCENE02_PHRASE_B.forEach((_, i) => {
    init[`b_${i}`] = { opacity: 0, y: 15 };
  });
  return init;
}

const scene02Init = buildScene02Proxies();

export const Scene02_Numbers: React.FC = () => {
  const s = useGsapProxy(
    (tl, p) => {
      // Phase A staggers in
      SCENE02_PHRASE_A.forEach((_, i) => {
        tl.to(p[`a_${i}`], { opacity: 1, y: 0, duration: 0.12, ease: "power2.out" }, i * 0.1);
      });

      // Phase A fades out at 0.85s
      tl.to(p.phraseA, { opacity: 0, duration: 0.18, ease: "power2.in" }, 0.85);

      // Phase B fades in at 0.95s
      tl.to(p.phraseB, { opacity: 1, duration: 0.15, ease: "power2.out" }, 0.95);
      SCENE02_PHRASE_B.forEach((_, i) => {
        tl.to(p[`b_${i}`], { opacity: 1, y: 0, duration: 0.15, ease: "power2.out" }, 0.95 + i * 0.16);
      });
    },
    scene02Init,
  );

  return (
    <AbsoluteFill>
      <LightGradient />

      {/* Phase A — left-aligned */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "8%",
          transform: "translateY(-50%)",
          maxWidth: "84%",
          display: "flex",
          flexWrap: "wrap",
          gap: "0 22px",
          opacity: s.phraseA.opacity,
        }}
      >
        {SCENE02_PHRASE_A.map((word, i) => {
          const proxy = s[`a_${i}`];
          return (
            <span
              key={i}
              style={{
                ...baseText,
                fontSize: 145,
                color: BLUE,
                opacity: proxy.opacity,
                transform: `translateY(${proxy.y}px)`,
              }}
            >
              {word}
            </span>
          );
        })}
      </div>

      {/* Phase B — centered, large italic */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          gap: "0 28px",
          opacity: s.phraseB.opacity,
        }}
      >
        {SCENE02_PHRASE_B.map((word, i) => {
          const proxy = s[`b_${i}`];
          return (
            <span
              key={i}
              style={{
                ...baseText,
                fontSize: 250,
                color: BLUE,
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
   Scene 03 — DarkGrid  (84 frames = 3.5s @ 24fps)
   "When" → "you" → "want" → "better odds" → title "you trade rainbows."
   ═══════════════════════════════════════════════════════ */

export const Scene03_DarkGrid: React.FC = () => {
  const s = useGsapProxy(
    (tl, p) => {
      // "When" visible from the start, exits at 0.35s
      tl.to(p.when, { opacity: 0, duration: 0.08, ease: "power2.in" }, 0.35);
      // "you" enters at 0.35s, exits at 0.7s
      tl.to(p.youFlash, { opacity: 1, y: 0, duration: 0.1, ease: "power2.out" }, 0.35);
      tl.to(p.youFlash, { opacity: 0, duration: 0.08, ease: "power2.in" }, 0.7);
      // "want" enters at 0.7s, exits at 1.0s
      tl.to(p.want, { opacity: 1, y: 0, duration: 0.1, ease: "power2.out" }, 0.7);
      tl.to(p.want, { opacity: 0, duration: 0.08, ease: "power2.in" }, 1.0);
      // "better odds" enters at 1.0s
      tl.to(p.better, { opacity: 1, y: 0, duration: 0.12, ease: "power2.out" }, 1.0);

      // Phase 1 cross-fades out at 1.5s
      tl.to(p.phase1, { opacity: 0, duration: 0.15, ease: "power2.in" }, 1.5);
      // Phase 2: title slides in from right at 1.6s
      tl.to(p.phase2, { opacity: 1, duration: 0.15, ease: "power2.out" }, 1.6);
      tl.to(p.title, { x: 0, duration: 0.4, ease: "power2.out" }, 1.6);
    },
    {
      phase1: { opacity: 1 },
      when: { opacity: 1, y: 0 },
      youFlash: { opacity: 0, y: 15 },
      want: { opacity: 0, y: 15 },
      better: { opacity: 0, y: 15 },
      phase2: { opacity: 0 },
      title: { x: 50 },
    },
  );

  return (
    <AbsoluteFill>
      <DarkBg />
      <GridOverlay color="rgba(255,255,255,0.18)" cols={10} rows={7} />

      {/* Phase 1 — single-word flashes, centered */}
      <div style={{ ...center, opacity: s.phase1.opacity }}>
        {s.when.opacity > 0.01 && (
          <span style={{ ...baseText, fontStyle: "normal", position: "absolute", left: "50%", transform: `translate(-50%, ${s.when.y}px)`, fontSize: 145, color: "#fff", opacity: s.when.opacity, whiteSpace: "nowrap" }}>
            When
          </span>
        )}
        {s.youFlash.opacity > 0.01 && (
          <span style={{ ...baseText, fontStyle: "normal", position: "absolute", left: "50%", transform: `translate(-50%, ${s.youFlash.y}px)`, fontSize: 145, color: "#fff", opacity: s.youFlash.opacity, whiteSpace: "nowrap" }}>
            you
          </span>
        )}
        {s.want.opacity > 0.01 && (
          <span style={{ ...baseText, fontStyle: "normal", position: "absolute", left: "50%", transform: `translate(-50%, ${s.want.y}px)`, fontSize: 145, color: "#fff", opacity: s.want.opacity, whiteSpace: "nowrap" }}>
            want
          </span>
        )}
        {s.better.opacity > 0.01 && (
          <span style={{ ...baseText, fontStyle: "normal", position: "absolute", left: "50%", transform: `translate(-50%, ${s.better.y}px)`, fontSize: 145, color: "#fff", opacity: s.better.opacity, whiteSpace: "nowrap" }}>
            better odds of winning
          </span>
        )}
      </div>

      {/* Phase 2 — title card */}
      <div
        style={{
          position: "absolute",
          top: "55%",
          left: "8%",
          transform: `translateX(${s.title.x}px)`,
          opacity: s.phase2.opacity,
          maxWidth: "84%",
        }}
      >
        <span style={{ ...baseText, fontSize: 200, color: "#fff" }}>
          you trade rainbows.
        </span>
      </div>
    </AbsoluteFill>
  );
};

/* ═══════════════════════════════════════════════════════
   Scene 04 — CubeExplode  (72 frames = 3s @ 24fps)
   Silent visual beat — cube assembles, holds, explodes.
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

type Scene04Proxies = {
  cube: { opacity: number; rotX: number; rotY: number };
  cubeFade: { opacity: number };
  [key: `shard${number}`]: { x: number; y: number; rotation: number; opacity: number };
};

function buildScene04Proxies(): Scene04Proxies {
  const base: Record<string, Record<string, number>> = {
    cube: { opacity: 0, rotX: 0, rotY: 0 },
    cubeFade: { opacity: 1 },
  };
  for (let i = 0; i < 10; i++) {
    base[`shard${i}`] = { x: 0, y: 0, rotation: 0, opacity: 0 };
  }
  return base as unknown as Scene04Proxies;
}

export const Scene04_CubeExplode: React.FC = () => {
  const s = useGsapProxy<Scene04Proxies>(
    (tl, p) => {
      // White square appears at 0.3s
      tl.to(p.cube, { opacity: 1, duration: 0.15, ease: "power2.out" }, 0.3);
      // Morph to isometric cube
      tl.to(p.cube, { rotX: -30, rotY: 45, duration: 0.4, ease: "power2.out" }, 0.8);
      // Big cube fades out as explosion starts
      tl.to(p.cubeFade, { opacity: 0, duration: 0.15, ease: "power2.in" }, 1.4);

      // Explosion at 1.5s
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

      {/* Big cube — morphs flat-square to iso */}
      {showBigCube && (
        <div
          style={{
            position: "absolute",
            top: "50%",
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
          top: "50%",
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

export const sceneMetasA = [
  { id: "RB-Scene01", component: Scene01_Intro, durationInFrames: 48 },
  { id: "RB-Scene02", component: Scene02_Numbers, durationInFrames: 48 },
  { id: "RB-Scene03", component: Scene03_DarkGrid, durationInFrames: 84 },
  { id: "RB-Scene04", component: Scene04_CubeExplode, durationInFrames: 72 },
];
