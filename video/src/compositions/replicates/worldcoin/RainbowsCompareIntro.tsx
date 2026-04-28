// Rainbows-Compare intro — one laptop, three answers, the rainbows reveal.
//
// Text placement is copied verbatim from Rainbows-Flashblocks Scene 01,
// 02, 03 — same positions, same staggers, same per-beat durations
// (48 / 48 / 84 frames at 24 fps). Beat 2's text was originally blue
// on a light gradient; here it is white over the lofi cloud broll for
// legibility.
//
// One laptop sits centred behind the text and stays still through
// beats 1 and 2. At the rainbows reveal — frames 132 to 156, exactly
// when the title "you trade rainbows." slides in — it performs a
// single 360° Y-axis spin, eased like an Apple keynote, and lands
// forward as the title settles. That is its only motion.

import React, { useMemo } from "react";
import {
  AbsoluteFill,
  Sequence,
  interpolate,
  staticFile,
  useCurrentFrame,
} from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import { useGLTF, ContactShadows, Environment } from "@react-three/drei";
import * as THREE from "three";
// @ts-ignore — SkeletonUtils types are not bundled
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
import { loadFont } from "@remotion/google-fonts/Inter";
import { LofiDots } from "../../endcard/LofiDots";
import { useGsapProxy } from "../standrew/gsapUtils";

const { fontFamily } = loadFont("normal", {
  subsets: ["latin"],
  weights: ["400", "700", "800"],
});

const MODEL_URL = staticFile("models/tabletop_macbook_iphone.glb");
useGLTF.preload(MODEL_URL);

// ── Composition timing ──────────────────────────────────────────────

const W = 1920;
const H = 1080;
const FPS = 24;
const BEAT1 = 48;
const BEAT2 = 48;
const BEAT3 = 84;
const TOTAL_FRAMES = BEAT1 + BEAT2 + BEAT3; // 180

// Spin window — the rainbows reveal moment. Frames 132 → 156 is the
// title slide-in inside Scene03 (1.5s → 2.6s of beat 3 at 24fps).
const SPIN_START = 132;
const SPIN_END = 156;
const SPIN_FRAMES = SPIN_END - SPIN_START;

// ── Camera & macbook pose ──────────────────────────────────────────

// Worldcoin2 hero pose, pulled back ~0.8 units to give the text room.
const CAM_POS_START = new THREE.Vector3(3.031, 4.096, -7.0);
const CAM_POS_END = new THREE.Vector3(3.031, 4.096, -6.18); // Worldcoin2 baseline
const CAM_TARGET = new THREE.Vector3(3.001, 2.78, 0.829);

const LID_OPEN = new THREE.Quaternion(-0.78333, 0, 0, 0.62161);
const BEVELS_POS = new THREE.Vector3(-0.00012, 0.00824, -0.10401);
const BEVELS_SCALE = new THREE.Vector3(0.27471, 0.27471, 0.27471);

// ── Macbook scene — single laptop ──────────────────────────────────

const MacbookSceneOne: React.FC<{ frame: number }> = ({ frame }) => {
  const { camera } = useThree();
  const gltf = useGLTF(MODEL_URL);

  const root = useMemo(() => {
    const cloned = cloneSkeleton(gltf.scene) as THREE.Object3D;

    const iphone = cloned.getObjectByName("iphone");
    if (iphone) {
      iphone.traverse((child) => {
        const m = child as THREE.Mesh;
        if (m.isMesh) m.visible = false;
      });
    }

    const bevels = cloned.getObjectByName("Bevels_2");
    if (bevels) {
      bevels.position.copy(BEVELS_POS);
      bevels.quaternion.copy(LID_OPEN);
      bevels.scale.copy(BEVELS_SCALE);
    }

    return cloned;
  }, [gltf]);

  // Single 360° spin in the rainbows window. Ease-in-out cubic — slow
  // start, fast middle, slow finish. Outside the window: yaw 0, fully
  // forward. The lid stays open at LID_OPEN throughout.
  let yaw = 0;
  if (frame >= SPIN_START && frame < SPIN_END) {
    const t = (frame - SPIN_START) / SPIN_FRAMES;
    const eased =
      t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    yaw = eased * Math.PI * 2;
  }
  root.rotation.y = yaw;

  // Whisper of breath so the laptop is never dead. ±0.3% scale, slow.
  const breath = 1 + Math.sin(frame * 0.06) * 0.003;
  root.scale.set(breath, breath, breath);

  // Slow camera push-in — Apple keynote dolly. Linear over the whole
  // 7.5s. Subtle enough to feel like air moving rather than a move.
  const t = interpolate(frame, [0, TOTAL_FRAMES], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const cam = camera as THREE.PerspectiveCamera;
  cam.position.set(
    CAM_POS_START.x + (CAM_POS_END.x - CAM_POS_START.x) * t,
    CAM_POS_START.y + (CAM_POS_END.y - CAM_POS_START.y) * t,
    CAM_POS_START.z + (CAM_POS_END.z - CAM_POS_START.z) * t,
  );
  cam.lookAt(CAM_TARGET);
  cam.fov = 50;
  cam.updateProjectionMatrix();

  return (
    <>
      <primitive object={root} />
      <Environment preset="studio" environmentIntensity={1.6} />
      <ambientLight intensity={0.3} />
      {/* Key light — strong, upper-front-left */}
      <directionalLight position={[5, 8, -5]} intensity={2.6} castShadow />
      {/* Fill — soft, cool, upper-right */}
      <directionalLight position={[-4, 4, 3]} intensity={0.6} color="#c0d0e8" />
      {/* Rim — separates body from broll behind */}
      <directionalLight position={[0, 5, 8]} intensity={1.4} color="#ffffff" />
      <ContactShadows
        position={[0, -0.01, 0]}
        opacity={0.4}
        scale={14}
        blur={1.6}
        far={5}
      />
    </>
  );
};

// ── Text layers — copied verbatim from ScenesA, white throughout ───

const baseText: React.CSSProperties = {
  fontFamily,
  fontWeight: 800,
  fontStyle: "italic",
  lineHeight: 1.15,
  display: "inline-block",
  color: "#fff",
  textShadow: "0 6px 28px rgba(0,0,0,0.65)",
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

// Beat 1 — Scene01_Intro logic. Centered phrase A, centered phrase B.
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

const TextBeat1: React.FC = () => {
  const s = useGsapProxy((tl, p) => {
    SCENE01_PHRASE_A.forEach((_, i) => {
      if (i === 0) return;
      tl.to(
        p[`a_${i}`],
        { opacity: 1, y: 0, duration: 0.15, ease: "power2.out" },
        0.15 + i * 0.12,
      );
    });
    tl.to(p.phraseA, { opacity: 0, duration: 0.18, ease: "power2.in" }, 0.85);
    tl.to(p.phraseB, { opacity: 1, duration: 0.15, ease: "power2.out" }, 0.95);
    SCENE01_PHRASE_B.forEach((_, i) => {
      tl.to(
        p[`b_${i}`],
        { opacity: 1, y: 0, duration: 0.15, ease: "power2.out" },
        0.95 + i * 0.18,
      );
    });
  }, scene01Init);

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div style={{ ...center, opacity: s.phraseA.opacity }}>
        {SCENE01_PHRASE_A.map((word, i) => {
          const proxy = s[`a_${i}`];
          return (
            <span
              key={i}
              style={{
                ...baseText,
                fontSize: 160,
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

// Beat 2 — Scene02_Numbers logic. Phrase A left-aligned, phrase B
// centered huge. White instead of the original blue.
const SCENE02_PHRASE_A = [
  "When",
  "you",
  "want",
  "volatility",
  "exposure",
] as const;
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

const TextBeat2: React.FC = () => {
  const s = useGsapProxy((tl, p) => {
    SCENE02_PHRASE_A.forEach((_, i) => {
      tl.to(
        p[`a_${i}`],
        { opacity: 1, y: 0, duration: 0.12, ease: "power2.out" },
        i * 0.1,
      );
    });
    tl.to(p.phraseA, { opacity: 0, duration: 0.18, ease: "power2.in" }, 0.85);
    tl.to(p.phraseB, { opacity: 1, duration: 0.15, ease: "power2.out" }, 0.95);
    SCENE02_PHRASE_B.forEach((_, i) => {
      tl.to(
        p[`b_${i}`],
        { opacity: 1, y: 0, duration: 0.15, ease: "power2.out" },
        0.95 + i * 0.16,
      );
    });
  }, scene02Init);

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {/* Phrase A — left-aligned (Scene02 layout, white text) */}
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
                opacity: proxy.opacity,
                transform: `translateY(${proxy.y}px)`,
              }}
            >
              {word}
            </span>
          );
        })}
      </div>

      {/* Phrase B — centered, huge (Scene02 punch) */}
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

// Beat 3 — Scene03_DarkGrid logic. Phase 1: single-word flashes
// centered. Phase 2: title "you trade rainbows." slides left-aligned.
const TextBeat3: React.FC = () => {
  const s = useGsapProxy(
    (tl, p) => {
      // Phase 1 — word flashes
      tl.to(p.when, { opacity: 0, duration: 0.08, ease: "power2.in" }, 0.35);
      tl.to(
        p.youFlash,
        { opacity: 1, y: 0, duration: 0.1, ease: "power2.out" },
        0.35,
      );
      tl.to(
        p.youFlash,
        { opacity: 0, duration: 0.08, ease: "power2.in" },
        0.7,
      );
      tl.to(
        p.want,
        { opacity: 1, y: 0, duration: 0.1, ease: "power2.out" },
        0.7,
      );
      tl.to(p.want, { opacity: 0, duration: 0.08, ease: "power2.in" }, 1.0);
      tl.to(
        p.better,
        { opacity: 1, y: 0, duration: 0.12, ease: "power2.out" },
        1.0,
      );

      // Phase 1 cross-fades out
      tl.to(p.phase1, { opacity: 0, duration: 0.15, ease: "power2.in" }, 1.5);

      // Phase 2 — title slides in from the right
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

  const flashSpan = (
    text: string,
    opacity: number,
    y: number,
    fontSize: number,
  ) => (
    <span
      style={{
        ...baseText,
        fontStyle: "normal",
        position: "absolute",
        left: "50%",
        transform: `translate(-50%, ${y}px)`,
        fontSize,
        opacity,
        whiteSpace: "nowrap",
      }}
    >
      {text}
    </span>
  );

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {/* Phase 1 — single-word flashes, all sharing one centered slot */}
      <div style={{ ...center, opacity: s.phase1.opacity }}>
        {s.when.opacity > 0.01 && flashSpan("When", s.when.opacity, s.when.y, 145)}
        {s.youFlash.opacity > 0.01 &&
          flashSpan("you", s.youFlash.opacity, s.youFlash.y, 145)}
        {s.want.opacity > 0.01 &&
          flashSpan("want", s.want.opacity, s.want.y, 145)}
        {s.better.opacity > 0.01 &&
          flashSpan("better odds", s.better.opacity, s.better.y, 175)}
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
        <span style={{ ...baseText, fontSize: 200 }}>
          you trade rainbows.
        </span>
      </div>
    </AbsoluteFill>
  );
};

// ── Composition ────────────────────────────────────────────────────

export const RainbowsCompareIntro: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill style={{ width: W, height: H }}>
      {/* Lofi cloud broll — full colour, no chroma filter */}
      <LofiDots skipFadeIn />

      {/* Macbook hero — driven by global frame so the spin lands at the
          rainbows reveal regardless of the per-Sequence text timing. */}
      <AbsoluteFill>
        <ThreeCanvas
          width={W}
          height={H}
          camera={{
            fov: 50,
            near: 0.5,
            far: 1000,
            position: [CAM_POS_START.x, CAM_POS_START.y, CAM_POS_START.z],
          }}
          gl={{
            antialias: true,
            alpha: true,
            powerPreference: "high-performance",
            toneMapping: THREE.ACESFilmicToneMapping,
            toneMappingExposure: 1.0,
          }}
          style={{ background: "transparent" }}
        >
          <React.Suspense fallback={null}>
            <MacbookSceneOne frame={frame} />
          </React.Suspense>
        </ThreeCanvas>
      </AbsoluteFill>

      {/* Text on top — three sequences, exact placements from
          Rainbows-Flashblocks Scene 01, 02, 03. Beat 2 white not blue. */}
      <Sequence from={0} durationInFrames={BEAT1} name="01 leverage / perps">
        <TextBeat1 />
      </Sequence>
      <Sequence
        from={BEAT1}
        durationInFrames={BEAT2}
        name="02 vol exposure / options"
      >
        <TextBeat2 />
      </Sequence>
      <Sequence
        from={BEAT1 + BEAT2}
        durationInFrames={BEAT3}
        name="03 better odds / rainbows"
      >
        <TextBeat3 />
      </Sequence>
    </AbsoluteFill>
  );
};

export const rainbowsCompareIntroMeta = {
  id: "RainbowsCompareIntro",
  component: RainbowsCompareIntro,
  width: W,
  height: H,
  fps: FPS,
  durationInFrames: TOTAL_FRAMES,
};
