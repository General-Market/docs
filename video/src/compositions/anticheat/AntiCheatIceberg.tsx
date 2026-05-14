import React from "react";
import {
  AbsoluteFill,
  continueRender,
  delayRender,
  Easing,
  Img,
  interpolate,
  staticFile,
  useCurrentFrame,
} from "remotion";
import { ThreeCanvas } from "@remotion/three";
import * as THREE from "three";
import { font, monoFont } from "../../common/fonts";
import { colors, FPS, H, W } from "./theme";
import { VIDEO_BEATS } from "./beats";

// The "I lost because of …" iceberg.
//
// Camera descends through six tiers. The clamp on scroll has been
// removed — at T4 and T5 the iceberg's bottom rises into the frame,
// revealing abyss below. Surface god rays at T0–T2. Waterline sweep
// at T1. Underwater takes hold afterward: caustic shimmer, three
// bubble depth layers, motion-blur on the scroll. The climax at
// "insider traders" gets specular sweep, chromatic split, NYSE
// solarise, red bloom, and a Wash vignette. Tier stamps are pinned
// to VIDEO_BEATS.

const IMG_NATIVE_W = 1265;
const IMG_NATIVE_H = 1670;

// Scale tuned so the silhouette reads as an iceberg — wide enough to
// see tip + body in the same shot, not so wide that we lose the shape.
const ICEBERG_SCALE = 1.8;

const TIER_Y_NATIVE = [
  Math.round((0 + 269) / 2),       // 134  — sky / above line 1
  Math.round((269 + 539) / 2),     // 404  — tip
  Math.round((539 + 857) / 2),     // 698  — upper underwater
  Math.round((857 + 1141) / 2),    // 999  — mid underwater
  Math.round((1141 + 1430) / 2),   // 1285 — lower iceberg
  Math.round((1430 + 1670) / 2),   // 1550 — depths
];
const TIER_Y_FILL = TIER_Y_NATIVE.map((y) => y * ICEBERG_SCALE);

const ICEBERG_LAYER_H = IMG_NATIVE_H * ICEBERG_SCALE;
const MAX_SCROLL = H - ICEBERG_LAYER_H;

// Linear scroll across the tier ladder. Tier 0 flush at the iceberg top,
// tier 5 flush at the iceberg bottom — no empty space ever.
const scrollAtTier = (i: number) => (i / (TIER_Y_NATIVE.length - 1)) * MAX_SCROLL;

type Tier = {
  word: string[];
  icon?: string;
  stat?: string;
  statUnit?: string;
  accent?: string;
  pullQuote?: string;
  caption?: string;
  source?: string;
};

export const TIERS: Tier[] = [
  { word: ["strategy"] },
  { word: ["fees"] },
  { word: ["liquidation", "hunters"] },
  { word: ["front", "runners"] },
  { word: ["orderbook", "spoofers"] },
  { word: ["insider", "traders"], accent: "#FF3344" },
];
const N = TIERS.length;
const LAST = N - 1;

type TradingTier = { imageSrc: string; glyph: string; label: string };

const TRADING_TIERS: TradingTier[] = [
  { imageSrc: "anticheat-imgs/trader-0.png", glyph: "📱", label: "you, on your phone" },
  { imageSrc: "anticheat-imgs/trader-1.png", glyph: "💻", label: "the digital nomad" },
  { imageSrc: "anticheat-imgs/trader-2.png", glyph: "🖥️", label: "prop firm" },
  { imageSrc: "anticheat-imgs/trader-3.png", glyph: "🏛️", label: "trading floor" },
  { imageSrc: "anticheat-imgs/trader-4.png", glyph: "🏦", label: "wall street" },
  { imageSrc: "anticheat-imgs/trader-5.png", glyph: "🏛️", label: "u.s. congress" },
];

const EASE_OUT = Easing.bezier(0.25, 0.1, 0.3, 1);
const EASE_DEFAULT = Easing.bezier(0.4, 0, 0.6, 1);

// Beat-locked tier stamps. Iceberg master window [111, 331].
// Local beats: 10, 36, 61, 87, 113, 139, 164, 190, 216.
// Anim window is six frames — launch video, no time to dawdle. The
// motion blur on the iceberg layer carries the eye across the gap.
const TIER_STAMP_LOCAL = [36, 61, 87, 113, 139, 164] as const;
const STAMP_OFFSET_FROM_ANIM = 5;
const TIER_ANIM = 6;
const ZOOM_OUT = TIER_STAMP_LOCAL[0] - STAMP_OFFSET_FROM_ANIM; // 31
const FINAL_HOLD = 41;
const OUTRO = 14;

const tierAnimStart = (i: number) =>
  TIER_STAMP_LOCAL[i] - STAMP_OFFSET_FROM_ANIM;

const tierHoldEnd = (i: number) =>
  i === LAST
    ? tierAnimStart(i) + TIER_ANIM + FINAL_HOLD
    : tierAnimStart(i + 1);

const SCENE_FRAMES =
  tierAnimStart(LAST) + TIER_ANIM + FINAL_HOLD + OUTRO; // 220

type State =
  | { phase: "zoom"; t: number }
  | { phase: "tier"; tier: number; sub: "anim" | "hold"; t: number };

const stateAt = (frame: number): State => {
  if (frame < ZOOM_OUT) return { phase: "zoom", t: frame / ZOOM_OUT };
  for (let i = 0; i < N; i++) {
    const animStart = tierAnimStart(i);
    const holdStart = animStart + TIER_ANIM;
    const holdEnd = tierHoldEnd(i);
    if (frame < holdStart)
      return { phase: "tier", tier: i, sub: "anim", t: (frame - animStart) / TIER_ANIM };
    if (frame < holdEnd) {
      const holdLen = Math.max(1, holdEnd - holdStart);
      return { phase: "tier", tier: i, sub: "hold", t: (frame - holdStart) / holdLen };
    }
  }
  return { phase: "tier", tier: LAST, sub: "hold", t: 1 };
};

const computeScale = (state: State): number => {
  if (state.phase === "zoom")
    return interpolate(state.t, [0, 1], [ICEBERG_SCALE * 1.15, ICEBERG_SCALE], {
      easing: EASE_OUT,
    });
  if (state.sub === "hold") {
    const pulse = Math.sin(state.t * Math.PI) * 0.006;
    return ICEBERG_SCALE * (1 + pulse);
  }
  return ICEBERG_SCALE;
};

const computeScrollY = (state: State): number => {
  if (state.phase === "zoom") return 0;
  if (state.sub === "hold") return scrollAtTier(state.tier);
  if (state.tier === 0) return 0;
  const a = scrollAtTier(state.tier - 1);
  const b = scrollAtTier(state.tier);
  return a + (b - a) * EASE_OUT(state.t);
};

// Per-tier PnL stamp. Escalates roughly with the dollars-extracted scale
// established in the original LossCounter — strategy is a paper-cut,
// insider traders is a fatal wound.
const TIER_PNL = ["−1.0%", "−2.8%", "−6.4%", "−14.7%", "−32.5%", "−74.2%"] as const;

// ─── Halftone shader iceberg ──────────────────────────────────────────────────
//
// GLSL fragment shader. The webp is uploaded as a texture; the shader splits
// the frame into uDotSize × uDotSize cells, samples the texture at each cell
// centre, and draws a circle whose radius scales with that sample's luminance.
// Background bleeds through where the dot doesn't cover. This is the
// classic dot-grid halftone — one draw call, one fragment program.

const DOT_VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const DOT_FRAGMENT = /* glsl */ `
  precision highp float;

  uniform sampler2D uTexture;
  uniform vec2 uResolution;
  uniform float uDotSize;
  uniform vec3 uBackground;

  varying vec2 vUv;

  void main() {
    vec2 fragCoord = vUv * uResolution;

    vec2 cellId = floor(fragCoord / uDotSize);
    vec2 cellCenter = (cellId + 0.5) * uDotSize;
    vec2 cellUv = cellCenter / uResolution;

    vec4 src = texture2D(uTexture, cellUv);
    float luma = dot(src.rgb, vec3(0.299, 0.587, 0.114));

    // Only emit dots where the photograph reads as ice. Below the
    // threshold (sky, deep water) the field stays solid blue — no
    // halftone fringe surviving the zoom. The window is wide enough
    // to keep the underwater iceberg body legible.
    float mask = smoothstep(0.38, 0.70, luma);
    float weight = pow(luma, 0.75) * mask;
    float radius = weight * uDotSize * 0.62;

    float dist = length(fragCoord - cellCenter);
    float aa = 0.6;
    float coverage = 1.0 - smoothstep(radius - aa, radius + aa, dist);

    // Solid blue background — exactly the next scene's field. White ice
    // sits on top wherever the photo is bright.
    vec3 ice = mix(vec3(0.92, 0.96, 1.0), vec3(1.0), luma);
    vec3 color = mix(uBackground, ice, coverage);
    gl_FragColor = vec4(color, 1.0);
  }
`;

const DotShaderPlane: React.FC<{ texture: THREE.Texture }> = ({ texture }) => {
  const uniforms = React.useMemo(
    () => ({
      uTexture: { value: texture },
      uResolution: { value: new THREE.Vector2(IMG_NATIVE_W, IMG_NATIVE_H) },
      uDotSize: { value: 5.0 },
      uBackground: { value: new THREE.Color(colors.accent) },
    }),
    [texture],
  );

  return (
    <mesh>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        vertexShader={DOT_VERTEX}
        fragmentShader={DOT_FRAGMENT}
        uniforms={uniforms}
        depthTest={false}
        depthWrite={false}
      />
    </mesh>
  );
};

const IcebergPoints: React.FC = () => {
  const [texture, setTexture] = React.useState<THREE.Texture | null>(null);
  const [handle] = React.useState(() => delayRender("iceberg-shader"));

  React.useEffect(() => {
    const loader = new THREE.TextureLoader();
    loader.load(
      staticFile("iceberg-tiers-clean.webp"),
      (tex) => {
        tex.minFilter = THREE.LinearFilter;
        tex.magFilter = THREE.LinearFilter;
        tex.colorSpace = THREE.SRGBColorSpace;
        setTexture(tex);
        continueRender(handle);
      },
      undefined,
      () => continueRender(handle),
    );
  }, [handle]);

  return (
    <ThreeCanvas
      width={IMG_NATIVE_W}
      height={IMG_NATIVE_H}
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: IMG_NATIVE_W,
        height: IMG_NATIVE_H,
        display: "block",
      }}
      gl={{ antialias: true, alpha: false }}
    >
      {texture ? <DotShaderPlane texture={texture} /> : null}
    </ThreeCanvas>
  );
};

export const AntiCheatIceberg: React.FC = () => {
  const frame = useCurrentFrame();
  const state = stateAt(frame);
  const scale = computeScale(state);
  const scrollY = computeScrollY(state);

  const introOpacity = interpolate(frame, [0, ZOOM_OUT * 0.3], [0, 1], {
    easing: EASE_OUT,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const outroOpacity = interpolate(
    frame,
    [SCENE_FRAMES - OUTRO, SCENE_FRAMES],
    [1, 0],
    { easing: EASE_OUT, extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const sceneOpacity = Math.min(introOpacity, outroOpacity);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: colors.accent,
        fontFamily: font,
        opacity: sceneOpacity,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 0,
          top: scrollY,
          width: W,
          height: ICEBERG_LAYER_H,
          willChange: "top",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: 0,
            width: IMG_NATIVE_W,
            height: IMG_NATIVE_H,
            transform: `translate(-50%, 0) scale(${scale.toFixed(4)})`,
            transformOrigin: "top center",
          }}
        >
          <IcebergPoints />
        </div>

        {TIERS.map((tier, i) => {
          if (state.phase !== "tier") return null;
          if (state.tier < i) return null;
          const isJustEntering =
            state.tier === i && state.sub === "anim";
          return (
            <TierCard
              key={i}
              tier={tier}
              index={i}
              isJustEntering={isJustEntering}
              entryT={isJustEntering ? state.t : 1}
              isCurrent={state.tier === i}
            />
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

// ─── Tier card — image on the right, text on the left ──────────────────────
//
// Anchored to the iceberg layer at that tier's Y. As the iceberg scrolls,
// cards scroll with it. Cards drop from above the frame when their tier
// activates, then settle and stay — past cards scroll out of view
// naturally, never disappearing on cut.

const CARD_W = 540;
const CARD_H = 280;
const CARD_IMG_W = 220;
const CARD_LEFT = 60;

const TierCard: React.FC<{
  tier: Tier;
  index: number;
  isJustEntering: boolean;
  entryT: number;
  isCurrent: boolean;
}> = ({ tier, index, isJustEntering, entryT, isCurrent }) => {
  const trader = TRADING_TIERS[index];
  const tierLabel = tier.word.join(" ");

  let slide = 0;
  let opacity = 1;
  let scale = 1;
  if (isJustEntering) {
    slide = interpolate(entryT, [0, 1], [-560, 0], { easing: EASE_OUT });
    opacity = interpolate(entryT, [0.10, 0.60], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    scale = interpolate(entryT, [0.55, 0.85, 1], [0.92, 1.05, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: EASE_DEFAULT,
    });
  } else if (!isCurrent) {
    // Past card — keep visible but slightly recede.
    opacity = 0.82;
  }

  const anchorY = TIER_Y_FILL[index];

  return (
    <div
      style={{
        position: "absolute",
        left: CARD_LEFT,
        top: anchorY + slide,
        width: CARD_W,
        transform: `translateY(-50%) scale(${scale.toFixed(3)})`,
        transformOrigin: "left center",
        opacity,
        pointerEvents: "none",
        willChange: "transform, top, opacity",
      }}
    >
      <div
        style={{
          width: CARD_W,
          height: CARD_H,
          borderRadius: 28,
          background: colors.surface,
          boxShadow:
            "0 1px 0 rgba(255,255,255,0.6) inset, 0 40px 80px rgba(0, 16, 60, 0.45), 0 12px 24px rgba(0, 16, 60, 0.28)",
          border: `1px solid ${colors.rule}`,
          overflow: "hidden",
          position: "relative",
        }}
      >
        {/* Text area — left side, full height. */}
        <div
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: 0,
            width: CARD_W - CARD_IMG_W,
          }}
        >
          <div
            style={{
              position: "absolute",
              top: 20,
              left: 24,
              fontFamily: monoFont,
              fontSize: 13,
              fontWeight: 500,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: colors.dim,
            }}
          >
            tier {index + 1} of {N} · {trader.label}
          </div>

          <div
            style={{
              position: "absolute",
              top: 46,
              left: 24,
              right: 24,
              fontFamily: font,
              fontSize: 32,
              fontWeight: 800,
              letterSpacing: "-0.022em",
              color: colors.fg,
              lineHeight: 1.0,
            }}
          >
            {tierLabel}
          </div>

          <div
            style={{
              position: "absolute",
              left: 24,
              right: 24,
              bottom: 44,
              fontFamily: font,
              fontSize: 72,
              fontWeight: 800,
              letterSpacing: "-0.04em",
              color: colors.accent,
              lineHeight: 0.92,
              fontVariantNumeric: "tabular-nums",
              textAlign: "left",
            }}
          >
            {TIER_PNL[index]}
          </div>

          <div
            style={{
              position: "absolute",
              left: 24,
              right: 24,
              bottom: 20,
              fontFamily: monoFont,
              fontSize: 11,
              fontWeight: 500,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: colors.dim,
            }}
          >
            extracted by unfair trading
          </div>
        </div>

        {/* Image area — right side, full height. */}
        <div
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            right: 0,
            width: CARD_IMG_W,
            overflow: "hidden",
          }}
        >
          <Img
            src={staticFile(trader.imageSrc)}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: "block",
            }}
          />
        </div>
      </div>
    </div>
  );
};

void VIDEO_BEATS;

export const antiCheatIcebergMeta = {
  id: "AntiCheatIceberg",
  component: AntiCheatIceberg,
  durationInFrames: SCENE_FRAMES,
  fps: FPS,
  width: W,
  height: H,
};
