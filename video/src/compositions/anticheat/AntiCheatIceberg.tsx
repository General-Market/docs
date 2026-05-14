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

// Continuous slow camera: a single linear scale + scroll across the
// entire scene. No tier-locked jumps. The cards live in viewport
// space, so this only moves the backdrop.
const CAMERA_SCALE_START = 1.55;
const CAMERA_SCALE_END = 1.05;
const CAMERA_SCROLL_END = -1100;

const computeScale = (frame: number): number => {
  const t = Math.min(1, Math.max(0, frame / SCENE_FRAMES));
  return interpolate(t, [0, 1], [CAMERA_SCALE_START, CAMERA_SCALE_END], {
    easing: EASE_OUT,
  });
};

const computeScrollY = (frame: number): number => {
  const t = Math.min(1, Math.max(0, frame / SCENE_FRAMES));
  return interpolate(t, [0, 1], [0, CAMERA_SCROLL_END], { easing: EASE_OUT });
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
    // threshold (sky, water) the field stays solid blue — no halftone
    // artefacts ringing the photo's background when we zoom out.
    float mask = smoothstep(0.50, 0.66, luma);
    float weight = pow(luma, 0.85) * mask;
    float radius = weight * uDotSize * 0.60;

    float dist = length(fragCoord - cellCenter);
    float aa = 0.6;
    float coverage = 1.0 - smoothstep(radius - aa, radius + aa, dist);

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
      uDotSize: { value: 3.5 },
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
  const scale = computeScale(frame);
  const scrollY = computeScrollY(frame);

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
          left: "50%",
          top: scrollY,
          width: IMG_NATIVE_W,
          height: IMG_NATIVE_H,
          transform: `translate(-50%, 0) scale(${scale.toFixed(4)})`,
          transformOrigin: "top center",
          willChange: "transform, top",
        }}
      >
        <IcebergPoints />
      </div>

      <CardStack state={state} />
    </AbsoluteFill>
  );
};

// ─── Tier card stack ─────────────────────────────────────────────────────────
//
// Cards live in viewport space, not on the iceberg layer. Six fixed
// slots stacked down the left side. Each card drops from above the
// frame when its tier activates; once landed, it stays. By the end of
// the scene all six cards are visible — the iceberg drifts behind them.

const CARD_W = 560;
const CARD_H = 156;
const CARD_LEFT = 72;
const CARD_GAP = 16;
const CARD_TOP_OFFSET = (H - (CARD_H * N + CARD_GAP * (N - 1))) / 2;
const CARD_IMG_W = 156;

const CardStack: React.FC<{ state: State }> = ({ state }) => (
  <>
    {TIERS.map((tier, i) => {
      const isAnim =
        state.phase === "tier" && state.tier === i && state.sub === "anim";
      const isActiveOrPast =
        state.phase === "tier" &&
        (state.tier > i ||
          (state.tier === i && (state.sub === "hold" || state.sub === "anim")));
      if (!isActiveOrPast) return null;

      let slide = 0;
      let opacity = 1;
      let cardScale = 1;
      if (isAnim) {
        const at = state.t;
        slide = interpolate(at, [0, 1], [-520, 0], { easing: EASE_OUT });
        opacity = interpolate(at, [0.10, 0.60], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        cardScale = interpolate(at, [0.55, 0.85, 1], [0.92, 1.04, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: EASE_DEFAULT,
        });
      }

      const isCurrent =
        state.phase === "tier" && state.tier === i;
      const dim = isCurrent ? 1 : 0.78;

      return (
        <TierCard
          key={i}
          tier={tier}
          index={i}
          slide={slide}
          opacity={opacity * dim}
          scale={cardScale}
        />
      );
    })}
  </>
);

const TierCard: React.FC<{
  tier: Tier;
  index: number;
  slide: number;
  opacity: number;
  scale: number;
}> = ({ tier, index, slide, opacity, scale }) => {
  const trader = TRADING_TIERS[index];
  const tierLabel = tier.word.join(" ");
  const top = CARD_TOP_OFFSET + index * (CARD_H + CARD_GAP) + slide;

  return (
    <div
      style={{
        position: "absolute",
        left: CARD_LEFT,
        top,
        width: CARD_W,
        height: CARD_H,
        opacity,
        transform: `scale(${scale.toFixed(3)})`,
        transformOrigin: "left center",
        pointerEvents: "none",
        willChange: "transform, top, opacity",
      }}
    >
      <div
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          borderRadius: 20,
          background: colors.surface,
          boxShadow:
            "0 1px 0 rgba(255,255,255,0.6) inset, 0 24px 56px rgba(0, 16, 60, 0.42), 0 8px 18px rgba(0, 16, 60, 0.22)",
          border: `1px solid ${colors.rule}`,
          overflow: "hidden",
          display: "flex",
        }}
      >
        <div
          style={{
            flex: 1,
            padding: "18px 24px 16px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            minWidth: 0,
          }}
        >
          <div
            style={{
              fontFamily: monoFont,
              fontSize: 13,
              fontWeight: 500,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: colors.dim,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            tier {index + 1} · {trader.label}
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              justifyContent: "space-between",
              gap: 16,
            }}
          >
            <div
              style={{
                fontFamily: font,
                fontSize: 34,
                fontWeight: 800,
                letterSpacing: "-0.022em",
                color: colors.fg,
                lineHeight: 1.0,
                flex: 1,
                minWidth: 0,
              }}
            >
              {tierLabel}
            </div>
            <div
              style={{
                fontFamily: font,
                fontSize: 56,
                fontWeight: 800,
                letterSpacing: "-0.04em",
                color: colors.accent,
                lineHeight: 0.92,
                fontVariantNumeric: "tabular-nums",
                whiteSpace: "nowrap",
              }}
            >
              {TIER_PNL[index]}
            </div>
          </div>

          <div
            style={{
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

        <div
          style={{
            width: CARD_IMG_W,
            height: "100%",
            flexShrink: 0,
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
