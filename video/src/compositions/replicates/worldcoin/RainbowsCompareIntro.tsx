// Rainbows-Compare intro — three macbooks, three answers.
//
// Three cloned macbook GLTFs sit on the lofi cloud broll. Each one
// spins on its Y-axis. As each phrase arrives, its macbook slows,
// pulls forward, faces the camera. The other two keep spinning
// behind. The third beat is the punch — rainbows.
//
// v1: empty screens. The screen content layer is intentionally
// missing; once the comparison framing is approved we wire the
// product UIs into per-macbook canvases.

import React, { useMemo } from "react";
import {
  AbsoluteFill,
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

const W = 1920;
const H = 1080;
// Match Rainbows-Flashblocks: 24fps, 48-frame beats (2s each).
const FPS = 24;
const BEAT_FRAMES = 48;
const TOTAL_FRAMES = BEAT_FRAMES * 3;

// Macbook layout — three side-by-side. Gap > macbook keyboard width
// or the bases overlap into one wide silver smear.
const SLOTS: { x: number; z: number; spinDir: 1 | -1 }[] = [
  { x: -9.5, z: -1.5, spinDir: 1 },
  { x: 0, z: -1.5, spinDir: -1 },
  { x: 9.5, z: -1.5, spinDir: 1 },
];

// Camera pulled far enough back to frame all three with room to spare.
const CAM_POS = new THREE.Vector3(0, 5.2, -22);
const CAM_TARGET = new THREE.Vector3(0, 2.4, 0);

// Lid pose copied from Worldcoin2 — open laptop in its rest position.
const LID_OPEN = new THREE.Quaternion(-0.78333, 0, 0, 0.62161);
const LID_CLOSED = new THREE.Quaternion(0, 0, 0, 1); // identity = lid flat on base
const BEVELS_POS = new THREE.Vector3(-0.00012, 0.00824, -0.10401);
const BEVELS_SCALE = new THREE.Vector3(0.27471, 0.27471, 0.27471);

// Per-macbook pose rig built once from a fresh GLTF clone. We hide
// the iPhone children and stash the lid (Bevels_2) reference so we
// can drive its open/close quaternion each frame.
function buildMacbookRig(sourceScene: THREE.Object3D): {
  root: THREE.Object3D;
  bevels: THREE.Object3D | null;
} {
  const root = cloneSkeleton(sourceScene) as THREE.Object3D;

  const iphone = root.getObjectByName("iphone");
  if (iphone) {
    iphone.traverse((child) => {
      const m = child as THREE.Mesh;
      if (m.isMesh) m.visible = false;
    });
  }

  const bevels = root.getObjectByName("Bevels_2") ?? null;
  if (bevels) {
    bevels.position.copy(BEVELS_POS);
    bevels.scale.copy(BEVELS_SCALE);
  }

  return { root, bevels };
}

// activity: 0 = closed and spinning, 1 = open and forward at rest.
// At full spin we run hard — 4 turns per second so a still frame is
// unmistakeably mid-rotation. As activity rises, yaw is multiplied
// down to zero, so the macbook decelerates and lands facing the camera.
const SPIN_TURNS_PER_SEC = 4.0;

function macbookYaw(frame: number, slotIdx: number, activity: number): number {
  const dir = SLOTS[slotIdx].spinDir;
  const spinPerFrame = (Math.PI * 2 * SPIN_TURNS_PER_SEC) / FPS;
  return frame * spinPerFrame * dir * (1 - activity);
}

const ThreeMacbooks: React.FC<{ frame: number }> = ({ frame }) => {
  const { camera } = useThree();
  const gltf = useGLTF(MODEL_URL);

  const rigs = useMemo(
    () => SLOTS.map(() => buildMacbookRig(gltf.scene)),
    [gltf],
  );

  // Per-slot activity over the beats. Smooth ramp in/out so the
  // change between active/inactive feels intentional, not linear.
  const slotActivity = SLOTS.map((_, i) => {
    const beatStart = i * BEAT_FRAMES;
    const beatEnd = beatStart + BEAT_FRAMES;
    const rampIn = 6; // ~0.25s at 24fps
    const rampOut = 6;
    const settle = beatStart + rampIn;
    const release = beatEnd - rampOut;
    if (frame < beatStart) return 0;
    if (frame < settle) {
      return interpolate(frame, [beatStart, settle], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });
    }
    if (frame < release) return 1;
    if (frame < beatEnd) {
      // Hold third macbook forward to the end of the scene.
      if (i === SLOTS.length - 1) return 1;
      return interpolate(frame, [release, beatEnd], [1, 0], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });
    }
    // After this slot's beat: only the last one stays forward.
    return i === SLOTS.length - 1 ? 1 : 0;
  });

  // On the final beat, gently bring slots A and B forward too so all
  // three face the camera by the end — the comparison framed in one shot.
  const finalReveal = interpolate(
    frame,
    [BEAT_FRAMES * 2 + 6, BEAT_FRAMES * 2 + 22],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  rigs.forEach(({ root, bevels }, i) => {
    const slot = SLOTS[i];
    const myActivity = slotActivity[i];
    const isFinalSlot = i === SLOTS.length - 1;
    const activity = isFinalSlot
      ? myActivity
      : Math.max(myActivity, finalReveal * 0.7);

    root.position.x = slot.x;
    // Active macbook pulls slightly forward (toward camera = -z).
    root.position.z = slot.z - activity * 1.2;
    root.position.y = 0;

    // Yaw: fast spin tapered to 0 by activity.
    root.rotation.y = macbookYaw(frame, i, activity);
    // Tiny scale lift for the focused macbook.
    const s = 1 + activity * 0.06;
    root.scale.set(s, s, s);

    // Lid open/close — closed while spinning, opens as activity rises.
    // Slerp between identity (closed) and the open quaternion. Ease the
    // open so the lid snaps a little at the end, like a real laptop.
    if (bevels) {
      const eased = activity * activity * (3 - 2 * activity); // smoothstep
      bevels.quaternion.slerpQuaternions(LID_CLOSED, LID_OPEN, eased);
    }
  });

  // Camera holds wide and steady — micro-drift only.
  const driftX = Math.sin(frame * 0.012) * 0.08;
  const driftY = Math.cos(frame * 0.009) * 0.05;
  const cam = camera as THREE.PerspectiveCamera;
  cam.position.set(CAM_POS.x + driftX, CAM_POS.y + driftY, CAM_POS.z);
  cam.lookAt(CAM_TARGET);
  cam.fov = 50;
  cam.updateProjectionMatrix();

  return (
    <>
      {rigs.map(({ root }, i) => (
        <primitive key={i} object={root} />
      ))}
      <Environment preset="studio" environmentIntensity={1.6} />
      <ambientLight intensity={0.35} />
      <directionalLight position={[5, 8, -5]} intensity={2.2} />
      <directionalLight position={[-4, 4, 3]} intensity={0.6} color="#c0d0e8" />
      <ContactShadows
        position={[0, -0.01, 0]}
        opacity={0.35}
        scale={20}
        blur={1.6}
        far={6}
      />
    </>
  );
};

// ── Text overlay ─────────────────────────────────────────────────────

// Text styling and timing mirror Rainbows-Flashblocks Scene01 exactly:
// large italic Inter 800, white, with the staggered fade-in then phrase-A
// fade-out at 0.85s, phrase-B fade-in at 0.95s. Each beat lasts 2s.
const baseText: React.CSSProperties = {
  fontFamily,
  fontWeight: 800,
  fontStyle: "italic",
  lineHeight: 1.05,
  display: "inline-block",
  color: "#fff",
  textShadow: "0 6px 28px rgba(0,0,0,0.65)",
};

const PHRASES: { a: string[]; b: string[] }[] = [
  { a: ["When", "you", "want", "leverage"], b: ["you", "trade", "perps."] },
  {
    a: ["When", "you", "want", "volatility", "exposure"],
    b: ["you", "trade", "options."],
  },
  {
    a: ["When", "you", "want", "better", "odds", "of", "winning"],
    b: ["you", "trade", "rainbows."],
  },
];

function buildTextProxies() {
  const init: Record<string, Record<string, number>> = {};
  PHRASES.forEach((phrase, beat) => {
    init[`phraseA_${beat}`] = { opacity: 1 };
    init[`phraseB_${beat}`] = { opacity: 0 };
    phrase.a.forEach((_, i) => {
      // First word of each beat enters already visible — Scene01 pattern.
      init[`a_${beat}_${i}`] = { opacity: i === 0 ? 1 : 0, y: i === 0 ? 0 : 15 };
    });
    phrase.b.forEach((_, i) => {
      init[`b_${beat}_${i}`] = { opacity: 0, y: 15 };
    });
    // Beat row gating — A or B for current beat shows, others hidden.
    init[`row_${beat}`] = { opacity: beat === 0 ? 1 : 0 };
  });
  return init;
}

const textInit = buildTextProxies();

const TextOverlay: React.FC = () => {
  const s = useGsapProxy((tl, p) => {
    const beatSec = BEAT_FRAMES / FPS; // 2s
    PHRASES.forEach((phrase, beat) => {
      const t0 = beat * beatSec;

      // Beat row gating: previous beat's row hides, this beat's row shows.
      if (beat > 0) {
        tl.to(
          p[`row_${beat - 1}`],
          { opacity: 0, duration: 0.001 },
          t0,
        );
        tl.to(p[`row_${beat}`], { opacity: 1, duration: 0.001 }, t0);
      }

      // Phrase A — first word already visible. Rest stagger in.
      phrase.a.forEach((_, i) => {
        if (i === 0) return;
        tl.to(
          p[`a_${beat}_${i}`],
          { opacity: 1, y: 0, duration: 0.15, ease: "power2.out" },
          t0 + 0.15 + i * 0.12,
        );
      });

      // Phrase A fades out at 0.85s into the beat.
      tl.to(
        p[`phraseA_${beat}`],
        { opacity: 0, duration: 0.18, ease: "power2.in" },
        t0 + 0.85,
      );

      // Phrase B fades in at 0.95s, words stagger.
      tl.to(
        p[`phraseB_${beat}`],
        { opacity: 1, duration: 0.15, ease: "power2.out" },
        t0 + 0.95,
      );
      phrase.b.forEach((_, i) => {
        tl.to(
          p[`b_${beat}_${i}`],
          { opacity: 1, y: 0, duration: 0.15, ease: "power2.out" },
          t0 + 0.95 + i * 0.18,
        );
      });
    });
  }, textInit);

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {PHRASES.map((phrase, beat) => {
        const isPunch = beat === PHRASES.length - 1;
        // Match Scene01 sizes: phrase A 160, phrase B 200. Rainbows beat
        // earns a small bump since it is the answer the others were not.
        const sizeA = isPunch ? 170 : 160;
        const sizeB = isPunch ? 220 : 200;
        return (
          <div
            key={beat}
            style={{
              position: "absolute",
              inset: 0,
              opacity: s[`row_${beat}`].opacity,
            }}
          >
            {/* Phrase A — centered, like Scene01 */}
            <div
              style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                display: "flex",
                gap: 36,
                justifyContent: "center",
                whiteSpace: "nowrap",
                opacity: s[`phraseA_${beat}`].opacity,
              }}
            >
              {phrase.a.map((word, i) => {
                const proxy = s[`a_${beat}_${i}`];
                return (
                  <span
                    key={i}
                    style={{
                      ...baseText,
                      fontSize: sizeA,
                      opacity: proxy.opacity,
                      transform: `translateY(${proxy.y}px)`,
                    }}
                  >
                    {word}
                  </span>
                );
              })}
            </div>

            {/* Phrase B — also centered, larger, the punch */}
            <div
              style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                display: "flex",
                gap: 40,
                justifyContent: "center",
                whiteSpace: "nowrap",
                opacity: s[`phraseB_${beat}`].opacity,
              }}
            >
              {phrase.b.map((word, i) => {
                const proxy = s[`b_${beat}_${i}`];
                return (
                  <span
                    key={i}
                    style={{
                      ...baseText,
                      fontSize: sizeB,
                      opacity: proxy.opacity,
                      transform: `translateY(${proxy.y}px)`,
                    }}
                  >
                    {word}
                  </span>
                );
              })}
            </div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

// ── Composition ──────────────────────────────────────────────────────

export const RainbowsCompareIntro: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill style={{ width: W, height: H }}>
      <LofiDots skipFadeIn />
      <AbsoluteFill>
        <ThreeCanvas
          width={W}
          height={H}
          camera={{
            fov: 50,
            near: 0.5,
            far: 1000,
            position: [CAM_POS.x, CAM_POS.y, CAM_POS.z],
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
            <ThreeMacbooks frame={frame} />
          </React.Suspense>
        </ThreeCanvas>
      </AbsoluteFill>
      <TextOverlay />
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
