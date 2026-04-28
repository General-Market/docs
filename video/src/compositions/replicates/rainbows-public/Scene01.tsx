import React, { useMemo, Suspense } from "react";
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
import { loadFont } from "@remotion/google-fonts/Inter";
import { ThreeCanvas } from "@remotion/three";
import * as THREE from "three";

// Quadratic bezier helper: (1-t)^2*P0 + 2(1-t)*t*P1 + t^2*P2
const bezier2 = (t: number, p0: number, p1: number, p2: number) =>
  (1 - t) * (1 - t) * p0 + 2 * (1 - t) * t * p1 + t * t * p2;

// Velocity-proportional motion blur filter
const motionBlurFilter = (vel: number) =>
  vel > 0.5 ? `blur(${Math.min(vel * 0.15, 5)}px)` : "none";

const { fontFamily } = loadFont("normal", {
  subsets: ["latin"],
  weights: ["300", "400", "500", "600", "700", "800"],
});

const BLUE = "#042FF4";
const WHITE = "#FFFFFF";

// Audio beats for sync (first 10s): 0.55, 0.7, 1.1, 1.35, 1.5, 1.7, 1.75, 1.85, 2.5, 2.6
// At 29fps: frames 16, 20, 32, 39, 44, 49, 51, 54, 73, 75

// Film grain overlay — animated noise that shifts each frame
const FilmGrain: React.FC<{ opacity?: number }> = ({ opacity = 0.04 }) => {
  const frame = useCurrentFrame();
  // Shift grain position each frame for organic crawl
  const offsetX = (frame * 37) % 256;
  const offsetY = (frame * 53) % 256;
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        zIndex: 999,
        opacity,
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        backgroundSize: "256px 256px",
        backgroundPosition: `${offsetX}px ${offsetY}px`,
        mixBlendMode: "overlay",
      }}
    />
  );
};

// Dense ticker LINES — full-width scrolling rows of perp markets filling entire viewport
const TICKER_LINES = [
  "BTC-PERP 67,420.10  \u2191 +2.45%    ETH-PERP 3,189.42  \u2191 +1.12%    SOL-PERP 271.30  \u2193 -0.89%    HYPE-PERP 41.05  \u2191 +0.34%    DOGE-PERP 0.1856  \u2191 +2.73%",
  "ETH-PERP 3,250.10  \u2191 +1.25%    AVAX-PERP 42.88  \u2191 +0.67%    LINK-PERP 18.32  \u2193 -0.06%    APT-PERP 9.40  \u2191 +0.91%    SUI-PERP 2.82  \u2191 +0.44%    SEI-PERP 0.524  \u2193 -0.28%",
  "SOL-PERP 268.12  \u2193 -0.06%    NEAR-PERP 6.72  \u2191 +1.55%    ARB-PERP 1.624  \u2191 +0.22%    OP-PERP 2.658  \u2193 -0.41%    BLUR-PERP 0.392  \u2191 +0.78%    JUP-PERP 1.255  \u2191 +2.10%",
  "BTC-PERP 67,425.40  \u2191 +2.73%    ORDI-PERP 62.18  \u2193 -0.52%    PEPE-PERP 0.0000164  \u2191 +3.01%    WIF-PERP 3.127  \u2193 -0.29%    BONK-PERP 0.0000438  \u2191 +1.48%",
  "HYPE-PERP 41.94  \u2193 -1.04%    TIA-PERP 7.342  \u2191 +2.15%    DYDX-PERP 1.865  \u2191 +1.30%    INJ-PERP 28.214  \u2193 -0.75%    JTO-PERP 3.122  \u2191 +0.55%    PYTH-PERP 0.674  \u2191 +4.12%",
  "DOGE-PERP 0.1863  \u2191 +0.15%    SHIB-PERP 0.0000242  \u2193 -2.30%    FLOKI-PERP 0.000234  \u2191 +0.92%    MEME-PERP 0.04215  \u2191 +1.77%    1000PEPE-PERP 0.00164  \u2191 +3.44%",
  "ATOM-PERP 6.946  \u2191 +0.91%    ADA-PERP 0.7824  \u2191 +0.33%    DOT-PERP 7.815  \u2193 -1.45%    XRP-PERP 0.6789  \u2191 +0.67%    LTC-PERP 71.55  \u2191 +0.22%    BCH-PERP 471.80  \u2193 -0.18%",
  "TON-PERP 7.350  \u2191 +1.39%    FIL-PERP 5.628  \u2193 -0.55%    HBAR-PERP 0.1542  \u2191 +0.28%    ICP-PERP 11.895  \u2191 +1.15%    KAS-PERP 0.1227  \u2193 -0.82%    EGLD-PERP 36.235  \u2191 +0.45%",
  "FTM-PERP 0.9425  \u2193 -0.52%    SAND-PERP 0.4755  \u2191 +0.88%    MANA-PERP 0.3842  \u2193 -0.15%    AXS-PERP 7.480  \u2191 +0.33%    GALA-PERP 0.0265  \u2191 +1.02%    APE-PERP 1.2715  \u2191 +0.55%",
  "ENA-PERP 0.4528  \u2191 +3.01%    ETHFI-PERP 4.275  \u2191 +0.62%    PENDLE-PERP 4.235  \u2193 -1.18%    ONDO-PERP 0.988  \u2191 +0.44%    REZ-PERP 0.0855  \u2193 -0.77%    BB-PERP 0.298  \u2191 +0.33%",
  "AAVE-PERP 173.36  \u2193 -0.29%    UNI-PERP 7.820  \u2191 +1.25%    MKR-PERP 1742.55  \u2191 +0.88%    LDO-PERP 1.924  \u2193 -1.55%    GMX-PERP 28.75  \u2191 +2.30%    SNX-PERP 2.189  \u2191 +0.67%",
  "RNDR-PERP 7.402  \u2191 +1.48%    FET-PERP 1.4423  \u2191 +0.55%    AGIX-PERP 0.4281  \u2193 -0.33%    OCEAN-PERP 0.6184  \u2191 +0.78%    WLD-PERP 4.855  \u2191 +0.44%    AR-PERP 28.90  \u2193 -0.92%",
];

/**
 * Segment 1: "Sometimes investing can feel →" with stock tickers
 * Reference: frame_001–004
 * Words appear left-of-center with overshoot spring.
 * Tickers in a single column, right-of-center, vertically distributed.
 */
const SometimesSegment: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const words = ["When", "you", "want", "leverage"];
  // Beat-synced word starts: "When" at beat 0.55s (frame 16),
  // "you" at 0.7s (f20), "want" at 1.1s (f32), "leverage" at 1.35s (f39)
  const wordStartFrames = [0, Math.round(fps * 0.4), Math.round(fps * 0.85), Math.round(fps * 1.15)];

  // Dissolve transition — starts at ~2.0s, completes by ~2.34s
  const segmentOpacity = interpolate(frame, [fps * 1.9, fps * 2.3], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Ticker lines fade in staggered after first word appears
  const tickerOpacity = interpolate(frame, [fps * 0.25, fps * 0.55], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Slow upward scroll for the entire ticker field
  const tickerScrollY = interpolate(frame, [0, fps * 2.3], [15, -20], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Beat-synced opacity pulse — tickers briefly brighten on audio beats
  const beatFrames = [16, 20, 32, 39, 44, 49, 51, 54];
  const beatPulse = beatFrames.reduce((acc, bf) => {
    const dist = Math.abs(frame - bf);
    return dist < 4 ? Math.max(acc, 1 - dist / 4) : acc;
  }, 0);
  const tickerPulseOpacity = tickerOpacity * (0.4 + beatPulse * 0.15);

  return (
    <AbsoluteFill style={{ opacity: segmentOpacity }}>
      <FilmGrain opacity={0.035} />

      {/* Dense ticker lines — edge-to-edge, filling entire viewport top to bottom */}
      <div
        style={{
          position: "absolute",
          top: "-5%",
          left: "-5%",
          right: "-5%",
          bottom: "-5%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          transform: `translateY(${tickerScrollY}px)`,
          opacity: tickerPulseOpacity,
          overflow: "hidden",
        }}
      >
        {TICKER_LINES.map((line, i) => {
          const stagger = interpolate(
            frame,
            [fps * 0.25 + i * 1.2, fps * 0.4 + i * 1.2],
            [0, 1],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
          );
          // Alternating scroll direction for visual density
          const lineScroll = interpolate(
            frame,
            [0, fps * 2.3],
            [i % 2 === 0 ? 0 : -40, i % 2 === 0 ? -60 : 20],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
          );
          return (
            <div
              key={i}
              style={{
                fontFamily,
                fontSize: 28,
                fontWeight: 300,
                color: "rgba(255,255,255,0.35)",
                whiteSpace: "nowrap",
                letterSpacing: 1.5,
                opacity: stagger,
                lineHeight: 1.0,
                transform: `translateX(${lineScroll}px)`,
              }}
            >
              {line}
            </div>
          );
        })}
      </div>

      {/* Main text — positioned left-of-center as in reference */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-58%, -50%)",
          display: "flex",
          flexWrap: "nowrap",
          gap: 12,
          alignItems: "baseline",
          whiteSpace: "nowrap",
        }}
      >
        {words.map((word, i) => {
          const localFrame = Math.max(0, frame - wordStartFrames[i]);
          const wordSpring = spring({
            frame: localFrame,
            fps,
            config: { damping: 12, mass: 0.8, stiffness: 120 },
          });
          const wordOpacity = interpolate(
            frame,
            [wordStartFrames[i], wordStartFrames[i] + Math.round(fps * 0.08)],
            [0, 1],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
          );
          // Bezier curved entrance — diagonal arc, not linear slide
          const t = Math.min(1, wordSpring);
          const wordX = bezier2(t, 25, -8, 0);   // overshoot left then settle
          const wordY = bezier2(t, 30, -5, 0);    // arc upward past target
          // Noise wobble — organic drift after landing
          const wobX = noise2D("swx" + i, frame * 0.04, i * 7.3) * 3.5;
          const wobY = noise2D("swy" + i, frame * 0.04, i * 3.1) * 3;
          // Motion blur proportional to velocity
          const prevT = Math.min(1, spring({ frame: Math.max(0, localFrame - 1), fps, config: { damping: 12, mass: 0.8, stiffness: 120 } }));
          const prevX = bezier2(prevT, 25, -8, 0);
          const prevY = bezier2(prevT, 30, -5, 0);
          const vel = Math.abs(wordX - prevX) + Math.abs(wordY - prevY);
          return (
            <span
              key={word}
              style={{
                fontFamily,
                fontSize: word === "leverage" ? 62 : 54,
                fontWeight: word === "leverage" ? 700 : 400,
                color: WHITE,
                opacity: wordOpacity,
                transform: `translate(${wordX + wobX}px, ${wordY + wobY}px)`,
                letterSpacing: word === "When" ? 0.5 : -0.3,
                filter: motionBlurFilter(vel),
              }}
            >
              {word}
            </span>
          );
        })}
        {/* Bridge dash + "you trade perps." reveal */}
        {(() => {
          const bridgeStart = wordStartFrames[3] + Math.round(fps * 0.15);
          const bridgeEnd = wordStartFrames[3] + Math.round(fps * 0.35);
          const bridgeT = interpolate(frame, [bridgeStart, bridgeEnd], [0, 1], {
            extrapolateLeft: "clamp", extrapolateRight: "clamp",
          });
          const bridgeX = bezier2(bridgeT, -20, -5, 0);
          const bridgeY = bezier2(bridgeT, 12, -4, 0);
          const bridgeWobX = noise2D("brwx", frame * 0.04, 0) * 2.5;
          const bridgeWobY = noise2D("brwy", frame * 0.04, 0) * 2;
          const bridgePrevT = interpolate(frame - 1, [bridgeStart, bridgeEnd], [0, 1], {
            extrapolateLeft: "clamp", extrapolateRight: "clamp",
          });
          const bridgePrevX = bezier2(bridgePrevT, -20, -5, 0);
          const bridgeVel = Math.abs(bridgeX - bridgePrevX);
          return (
            <span
              style={{
                fontFamily,
                fontSize: 46,
                fontWeight: 500,
                color: WHITE,
                opacity: interpolate(frame, [bridgeStart, bridgeStart + Math.round(fps * 0.1)], [0, 1], {
                  extrapolateLeft: "clamp", extrapolateRight: "clamp",
                }),
                transform: `translate(${bridgeX + bridgeWobX}px, ${bridgeY + bridgeWobY}px)`,
                filter: motionBlurFilter(bridgeVel),
                whiteSpace: "nowrap",
              }}
            >
              — you trade perps.
            </span>
          );
        })()}
      </div>
    </AbsoluteFill>
  );
};

/**
 * 3D Tangled Ribbon using Three.js TubeGeometry.
 * Each tube is a CatmullRomCurve3 rendered with meshPhysicalMaterial
 * for glossy, translucent appearance matching reference.
 */

// Ribbon curve definitions — 3D points creating tangled loops
const RIBBON_CURVES = [
  // Path A: Left knot cluster → smooth extension right (denser tangle in left-center)
  [[-2.8, 0.6, 0.2], [-2.0, -0.5, 0.6], [-1.0, -1.2, -0.4], [0.0, -0.6, 0.5], [0.5, 0.3, -0.3], [0.2, 1.0, 0.4], [-0.6, 0.8, -0.2], [-1.2, 0.1, 0.6], [-0.4, -0.8, -0.5], [0.8, -1.0, 0.3], [2.0, -0.4, -0.1], [3.2, 0.2, 0.3], [3.8, 0.8, -0.2], [3.2, 1.2, 0.1]],
  // Path B: Second loop, different Z crossings for true 3D interweave
  [[-2.5, 0.4, -0.4], [-1.8, -0.7, -0.6], [-0.8, -1.0, 0.5], [0.1, -0.3, -0.4], [0.4, 0.6, 0.6], [0.0, 1.2, -0.3], [-0.7, 0.7, 0.5], [-1.1, -0.1, -0.6], [-0.2, -1.0, 0.4], [1.0, -0.8, -0.3], [2.5, -0.2, 0.4], [3.5, 0.6, -0.3], [3.0, 1.4, 0.2], [2.0, 1.0, -0.1]],
  // Path C: Tight inner crossing loop
  [[-1.6, 0.2, 0.5], [-1.0, -0.4, -0.4], [-0.2, -0.6, 0.6], [0.3, 0.0, -0.5], [0.6, 0.6, 0.4], [0.1, 1.0, -0.6], [-0.5, 0.6, 0.3], [-0.8, -0.2, -0.4], [0.0, -0.6, 0.5], [0.8, -0.3, -0.3], [1.5, 0.3, 0.3], [1.2, 0.9, -0.2]],
  // Path D: Wide background sweep — arcs behind, creates depth
  [[-3.5, -0.2, -0.7], [-2.0, -1.2, 0.4], [-0.3, -1.5, -0.3], [1.2, -0.8, 0.6], [2.8, -1.2, -0.4], [4.0, -0.3, 0.3], [4.2, 0.6, -0.5], [3.5, 1.3, 0.4], [2.2, 1.0, -0.3], [0.8, 0.4, 0.5], [-0.6, 0.9, -0.4], [-1.8, 0.6, 0.3]],
  // Path E: Extra knot crossing — adds density in center cluster
  [[-2.2, 0.5, 0.3], [-1.5, -0.3, -0.5], [-0.5, -0.9, 0.4], [0.2, -0.1, -0.3], [0.5, 0.7, 0.5], [-0.1, 1.1, -0.4], [-0.8, 0.5, 0.3], [-1.3, -0.3, -0.5], [-0.3, -0.9, 0.4], [0.6, -0.5, -0.2], [1.3, 0.2, 0.3], [1.0, 0.8, -0.2]],
] as const;

const RibbonTube: React.FC<{
  points: readonly (readonly [number, number, number])[];
  radius: number;
  color: string;
  opacity: number;
  progress: number;
}> = ({ points, radius, color, opacity, progress }) => {
  const geometry = useMemo(() => {
    const pts = points.map((p) => new THREE.Vector3(p[0], p[1], p[2]));
    const curve = new THREE.CatmullRomCurve3(pts, false, "catmullrom", 0.5);
    const segments = 96;
    const visibleSegments = Math.max(1, Math.floor(segments * progress));
    const geo = new THREE.TubeGeometry(curve, visibleSegments, radius, 24, false);
    return geo;
  }, [points, radius, progress]);

  return (
    <mesh geometry={geometry}>
      <meshPhysicalMaterial
        color={color}
        transparent
        opacity={opacity * 0.5}
        roughness={0.05}
        metalness={0.15}
        clearcoat={1.0}
        clearcoatRoughness={0.02}
        side={THREE.DoubleSide}
        envMapIntensity={2.0}
        emissive="#9080c0"
        emissiveIntensity={0.15}
        specularIntensity={2.0}
        specularColor={new THREE.Color("#ffd0f0")}
      />
    </mesh>
  );
};

const RibbonScene: React.FC<{ progress: number; breathe: number }> = ({ progress, breathe }) => {
  // Glass tubes with pink/purple iridescent tones matching reference
  const colors = ["#a090d8", "#8898e0", "#b088c8", "#7890d8", "#9880c0"];
  const radii = [0.10, 0.09, 0.08, 0.11, 0.085];
  const opacities = [0.55, 0.48, 0.52, 0.45, 0.50];

  return (
    <>
      <ambientLight intensity={1.4} />
      <pointLight position={[5, 5, 5]} intensity={2.2} color="#d0e0ff" />
      <pointLight position={[-4, -2, 4]} intensity={1.0} color="#a0b0e0" />
      <pointLight position={[0, 4, 2]} intensity={0.8} color="#e0e8ff" />
      <directionalLight position={[0, 3, 5]} intensity={1.5} color="#ffffff" />
      <group
        rotation={[breathe * 0.01, breathe * 0.025, breathe * 0.005]}
        position={[0.3, breathe * 0.05, 0]}
      >
        {RIBBON_CURVES.map((pts, i) => {
          const staggerDelay = i * 0.06;
          const localProgress = Math.max(0, Math.min(1, (progress - staggerDelay) / (1 - staggerDelay)));
          if (localProgress <= 0) return null;
          return (
            <RibbonTube
              key={i}
              points={pts}
              radius={radii[i]}
              color={colors[i]}
              opacity={opacities[i]}
              progress={localProgress}
            />
          );
        })}
      </group>
    </>
  );
};

const TangledRibbon3D: React.FC<{ progress: number; breathe?: number }> = ({ progress, breathe = 0 }) => {
  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <ThreeCanvas
        width={1280}
        height={720}
        style={{ position: "absolute", inset: 0 }}
        camera={{ position: [0.4, 0.1, 3.4], fov: 55 }}
      >
        <Suspense fallback={null}>
          <RibbonScene progress={progress} breathe={breathe} />
        </Suspense>
      </ThreeCanvas>
    </div>
  );
};

/**
 * Segment 2: "When you want volatility exposure — you trade options."
 * Same prose pattern as SometimesSegment, with a 3D tangled ribbon backdrop —
 * volatility as visible chaos, the sentence laid in front of it.
 */
const AllOverSegment: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Exit dissolve — ribbon + text fade out as phone enters (crossfade with PhoneSegment)
  const exitOpacity = interpolate(frame, [fps * 1.0, fps * 1.35], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Sentence: "When you want volatility exposure" then bridge "— you trade options."
  const words = ["When", "you", "want", "volatility", "exposure"];
  // Tighter cadence than SometimesSegment — five words in ~1.0s vs four in ~1.15s
  const wordStartFrames = [
    0,
    Math.round(fps * 0.18),
    Math.round(fps * 0.36),
    Math.round(fps * 0.54),
    Math.round(fps * 0.78),
  ];

  // Ribbon draws on as the sentence opens
  const ribbonProgress = interpolate(frame, [0, fps * 0.45], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  const breathe = ribbonProgress >= 0.95
    ? Math.sin((frame - fps * 0.45) * 0.15) * interpolate(
        frame,
        [fps * 0.45, fps * 0.7],
        [0, 1],
        { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
      )
    : 0;

  return (
    <AbsoluteFill style={{ opacity: exitOpacity }}>
      <FilmGrain opacity={0.03} />

      {/* Tangled ribbon behind the sentence — Three.js 3D tubes */}
      <TangledRibbon3D progress={ribbonProgress} breathe={breathe} />

      {/* Sentence — left-of-center, mirrors SometimesSegment composition */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          display: "flex",
          flexWrap: "nowrap",
          gap: 12,
          alignItems: "baseline",
          whiteSpace: "nowrap",
        }}
      >
        {words.map((word, i) => {
          const localFrame = Math.max(0, frame - wordStartFrames[i]);
          const wordSpring = spring({
            frame: localFrame,
            fps,
            config: { damping: 12, mass: 0.8, stiffness: 120 },
          });
          const wordOpacity = interpolate(
            frame,
            [wordStartFrames[i], wordStartFrames[i] + Math.round(fps * 0.08)],
            [0, 1],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
          );
          const t = Math.min(1, wordSpring);
          const wordX = bezier2(t, 25, -8, 0);
          const wordY = bezier2(t, 30, -5, 0);
          const wobX = noise2D("vex" + i, frame * 0.04, i * 7.3) * 3.5;
          const wobY = noise2D("vey" + i, frame * 0.04, i * 3.1) * 3;
          const prevT = Math.min(1, spring({ frame: Math.max(0, localFrame - 1), fps, config: { damping: 12, mass: 0.8, stiffness: 120 } }));
          const prevX = bezier2(prevT, 25, -8, 0);
          const prevY = bezier2(prevT, 30, -5, 0);
          const vel = Math.abs(wordX - prevX) + Math.abs(wordY - prevY);
          const isAccent = word === "volatility" || word === "exposure";
          return (
            <span
              key={word}
              style={{
                fontFamily,
                fontSize: isAccent ? 60 : 50,
                fontWeight: isAccent ? 700 : 400,
                color: WHITE,
                opacity: wordOpacity,
                transform: `translate(${wordX + wobX}px, ${wordY + wobY}px)`,
                letterSpacing: word === "When" ? 0.5 : -0.3,
                filter: motionBlurFilter(vel),
                textShadow: "0 4px 20px rgba(0,0,0,0.25)",
              }}
            >
              {word}
            </span>
          );
        })}
        {/* Bridge dash + "you trade options." reveal */}
        {(() => {
          const bridgeStart = wordStartFrames[4] + Math.round(fps * 0.18);
          const bridgeEnd = wordStartFrames[4] + Math.round(fps * 0.4);
          const bridgeT = interpolate(frame, [bridgeStart, bridgeEnd], [0, 1], {
            extrapolateLeft: "clamp", extrapolateRight: "clamp",
          });
          const bridgeX = bezier2(bridgeT, -20, -5, 0);
          const bridgeY = bezier2(bridgeT, 12, -4, 0);
          const bridgeWobX = noise2D("vebx", frame * 0.04, 0) * 2.5;
          const bridgeWobY = noise2D("veby", frame * 0.04, 0) * 2;
          const bridgePrevT = interpolate(frame - 1, [bridgeStart, bridgeEnd], [0, 1], {
            extrapolateLeft: "clamp", extrapolateRight: "clamp",
          });
          const bridgePrevX = bezier2(bridgePrevT, -20, -5, 0);
          const bridgeVel = Math.abs(bridgeX - bridgePrevX);
          return (
            <span
              style={{
                fontFamily,
                fontSize: 42,
                fontWeight: 500,
                color: WHITE,
                opacity: interpolate(frame, [bridgeStart, bridgeStart + Math.round(fps * 0.1)], [0, 1], {
                  extrapolateLeft: "clamp", extrapolateRight: "clamp",
                }),
                transform: `translate(${bridgeX + bridgeWobX}px, ${bridgeY + bridgeWobY}px)`,
                filter: motionBlurFilter(bridgeVel),
                whiteSpace: "nowrap",
                textShadow: "0 4px 20px rgba(0,0,0,0.25)",
              }}
            >
              — you trade options.
            </span>
          );
        })()}
      </div>
    </AbsoluteFill>
  );
};

/**
 * Single phone mockup — reusable for both the centered phone and the grid.
 * Shows the rainbows logomark with dynamic island, side buttons, and bezel.
 */
// Screen variant types for grid phones
type ScreenVariant = "logo" | "treasury" | "holdings" | "chart" | "buy" | "research" | "live" | "about" | "statements";

const PhoneScreenContent: React.FC<{ variant: ScreenVariant; width: number }> = ({ variant, width }) => {
  const fs = (n: number) => width * n;
  const shared = { fontFamily, color: "#0a0a2e" as const };
  switch (variant) {
    case "treasury":
      return (
        <div style={{ width: "100%", padding: `${fs(0.15)}px ${fs(0.06)}px ${fs(0.06)}px` }}>
          <div style={{ ...shared, fontSize: fs(0.03), fontWeight: 400, color: "rgba(0,20,60,0.5)" }}>Treasury account</div>
          <div style={{ ...shared, fontSize: fs(0.065), fontWeight: 700 }}>$5,585.00</div>
          <div style={{ ...shared, fontSize: fs(0.025), fontWeight: 400, color: "rgba(0,20,60,0.4)", marginTop: fs(0.01) }}>$4,400.00 available</div>
          <div style={{ display: "flex", gap: fs(0.015), alignItems: "flex-end", marginTop: fs(0.03) }}>
            {[35, 60, 25, 72, 45, 62, 38].map((h, j) => (
              <div key={j} style={{ width: fs(0.04), height: h * fs(0.008), background: `rgba(4,47,243,${0.2 + j * 0.06})`, borderRadius: 2 }} />
            ))}
          </div>
        </div>
      );
    case "holdings":
      return (
        <div style={{ width: "100%", padding: `${fs(0.15)}px ${fs(0.06)}px ${fs(0.06)}px` }}>
          <div style={{ ...shared, fontSize: fs(0.03), fontWeight: 400, color: "rgba(0,20,60,0.5)" }}>Holdings</div>
          <div style={{ ...shared, fontSize: fs(0.025), fontWeight: 600, color: "#00c853", marginTop: fs(0.01) }}>+$338.07 (+1.63%)</div>
          <svg viewBox="0 0 100 35" style={{ width: "100%", height: fs(0.12), marginTop: fs(0.02) }}>
            <path d="M 0,22 C 15,16 30,24 50,12 S 75,20 100,14" fill="none" stroke="rgba(4,47,243,0.5)" strokeWidth={2} />
            <path d="M 0,22 C 15,16 30,24 50,12 S 75,20 100,14 L 100,35 L 0,35 Z" fill="rgba(4,47,243,0.08)" />
          </svg>
        </div>
      );
    case "chart":
      return (
        <div style={{ width: "100%", padding: `${fs(0.15)}px ${fs(0.06)}px ${fs(0.06)}px` }}>
          <div style={{ ...shared, fontSize: fs(0.06), fontWeight: 700 }}>$125,367.10</div>
          <div style={{ ...shared, fontSize: fs(0.025), fontWeight: 500, color: "#00c853" }}>+$1,432.50</div>
          <svg viewBox="0 0 240 60" style={{ width: "100%", height: fs(0.15), marginTop: fs(0.02) }}>
            <path d="M 0,45 C 30,40 60,35 80,30 S 120,20 150,25 S 200,15 240,10" fill="none" stroke="rgba(4,47,243,0.3)" strokeWidth={1.5} />
            <path d="M 0,45 C 30,40 60,35 80,30 S 120,20 150,25 S 200,15 240,10 L 240,60 L 0,60 Z" fill="rgba(4,47,243,0.05)" />
          </svg>
        </div>
      );
    case "buy":
      return (
        <div style={{ width: "100%", padding: `${fs(0.15)}px ${fs(0.06)}px ${fs(0.06)}px`, display: "flex", flexDirection: "column", gap: fs(0.015) }}>
          <div style={{ ...shared, fontSize: fs(0.035), fontWeight: 600 }}>Buy AAPL</div>
          {[85, 65, 50].map((w, j) => (
            <div key={j} style={{ width: `${w}%`, height: fs(0.02), background: `rgba(0,20,80,0.07)`, borderRadius: 2 }} />
          ))}
          <div style={{ marginTop: fs(0.02), padding: `${fs(0.02)}px 0`, width: "70%", background: BLUE, borderRadius: fs(0.025), textAlign: "center" as const }}>
            <span style={{ fontFamily, fontSize: fs(0.03), fontWeight: 700, color: WHITE }}>Buy</span>
          </div>
        </div>
      );
    case "research":
      return (
        <div style={{ width: "100%", padding: `${fs(0.15)}px ${fs(0.06)}px ${fs(0.06)}px` }}>
          <div style={{ ...shared, fontSize: fs(0.03), fontWeight: 400, color: "rgba(0,20,60,0.5)" }}>Research</div>
          <div style={{ ...shared, fontSize: fs(0.035), fontWeight: 600, marginTop: fs(0.01) }}>Expert analysis</div>
          <svg viewBox="0 0 100 35" style={{ width: "100%", height: fs(0.1), marginTop: fs(0.02) }}>
            <path d="M 0,28 C 20,20 40,30 60,15 S 80,22 100,10" fill="none" stroke="rgba(4,47,243,0.4)" strokeWidth={2} />
          </svg>
          {[90, 70, 80, 55].map((w, j) => (
            <div key={j} style={{ width: `${w}%`, height: fs(0.015), background: `rgba(0,20,80,0.06)`, borderRadius: 2, marginTop: fs(0.01) }} />
          ))}
        </div>
      );
    case "live":
      return (
        <div style={{ width: "100%", padding: `${fs(0.15)}px ${fs(0.06)}px ${fs(0.06)}px`, display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div style={{ width: fs(0.18), height: fs(0.18), borderRadius: "50%", background: "linear-gradient(135deg, rgba(160,170,200,0.5), rgba(140,150,180,0.3))", border: `3px solid rgba(0,20,80,0.1)` }} />
          <div style={{ ...shared, fontSize: fs(0.03), fontWeight: 600, marginTop: fs(0.02) }}>Rainbows Live</div>
          {[75, 60].map((w, j) => (
            <div key={j} style={{ width: `${w}%`, height: fs(0.015), background: "rgba(0,20,80,0.06)", borderRadius: 2, marginTop: fs(0.01) }} />
          ))}
        </div>
      );
    case "about":
      return (
        <div style={{ width: "100%", padding: `${fs(0.15)}px ${fs(0.06)}px ${fs(0.06)}px` }}>
          <div style={{ ...shared, fontSize: fs(0.03), fontWeight: 400, color: "rgba(0,20,60,0.5)" }}>About</div>
          <div style={{ ...shared, fontSize: fs(0.035), fontWeight: 600, marginTop: fs(0.01) }}>Company overview</div>
          {[90, 85, 70, 80, 65].map((w, j) => (
            <div key={j} style={{ width: `${w}%`, height: fs(0.015), background: "rgba(0,20,80,0.06)", borderRadius: 2, marginTop: fs(0.012) }} />
          ))}
        </div>
      );
    case "statements":
      return (
        <div style={{ width: "100%", padding: `${fs(0.15)}px ${fs(0.06)}px ${fs(0.06)}px` }}>
          <div style={{ ...shared, fontSize: fs(0.03), fontWeight: 400, color: "rgba(0,20,60,0.5)" }}>Statements</div>
          {[80, 65, 75, 55].map((w, j) => (
            <div key={j} style={{ width: `${w}%`, height: fs(0.015), background: "rgba(0,20,80,0.06)", borderRadius: 2, marginTop: fs(0.012) }} />
          ))}
          <div style={{ marginTop: fs(0.02), padding: `${fs(0.015)}px ${fs(0.03)}px`, background: BLUE, borderRadius: fs(0.02), display: "inline-block" }}>
            <span style={{ fontFamily, fontSize: fs(0.025), fontWeight: 600, color: WHITE }}>Download</span>
          </div>
        </div>
      );
    default: // "logo"
      return (
        <div style={{ display: "flex", alignItems: "center", gap: width * 0.031 }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: width * 0.009 }}>
            <div style={{ width: width * 0.038, height: width * 0.038, borderRadius: "50%", background: BLUE }} />
            <div style={{ width: width * 0.022, height: width * 0.022, borderRadius: "50%", background: BLUE }} />
          </div>
          <span style={{ fontFamily, fontSize: width * 0.069, fontWeight: 600, color: "#0a0a2e", letterSpacing: -0.5 }}>
            rainbows
          </span>
        </div>
      );
  }
};

const PhoneMockup: React.FC<{
  width?: number;
  height?: number;
  showPortfolio?: boolean;
  elevated?: boolean;
  iridescentHue?: number;
  screenVariant?: ScreenVariant;
}> = ({ width = 320, height = 640, showPortfolio = false, elevated = false, iridescentHue = 0, screenVariant = "logo" }) => {
  // Iridescent border colors derived from hue rotation
  const h1 = (iridescentHue + 200) % 360;
  const h2 = (iridescentHue + 260) % 360;
  const h3 = (iridescentHue + 320) % 360;
  const iridescentBorder = iridescentHue > 0
    ? `0 0 ${width * 0.08}px hsla(${h1},85%,72%,0.5), 0 0 ${width * 0.04}px hsla(${h2},80%,68%,0.45), 0 0 ${width * 0.15}px hsla(${h3},75%,75%,0.2), inset 0 0 ${width * 0.03}px hsla(${h1},80%,80%,0.3)`
    : "";
  return (
    <div
      style={{
        width,
        height,
        background: iridescentHue > 0
          ? `linear-gradient(160deg, hsl(${h1},35%,30%), hsl(${h2},30%,22%), hsl(${h3},25%,18%))`
          : "linear-gradient(160deg, #2a3050, #1a2040, #0e1530)",
        borderRadius: width * 0.15,
        padding: width * 0.019,
        border: iridescentHue > 0 ? `2px solid hsla(${h1},70%,75%,0.4)` : "none",
        boxShadow: elevated
          ? `0 20px 60px rgba(0,0,0,0.45), 0 6px 20px rgba(0,0,0,0.3), inset 0 1px 0 rgba(100,120,180,0.3)`
          : `0 8px 30px rgba(0,0,0,0.25), 0 3px 10px rgba(0,0,0,0.15), inset 0 1px 0 rgba(100,120,180,0.2)${iridescentBorder ? ", " + iridescentBorder : ""}`,
        position: "relative",
        flexShrink: 0,
      }}
    >
      {/* Screen */}
      <div
        style={{
          width: "100%",
          height: "100%",
          background: WHITE,
          borderRadius: width * 0.12,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          overflow: "hidden",
          position: "relative",
        }}
      >
        {/* Dynamic Island */}
        <div
          style={{
            position: "absolute",
            top: width * 0.044,
            left: "50%",
            transform: "translateX(-50%)",
            width: width * 0.28,
            height: width * 0.075,
            background: "#101830",
            borderRadius: width * 0.038,
          }}
        />
        {showPortfolio ? (
          <div style={{ width: "100%", padding: `${width * 0.156}px ${width * 0.056}px ${width * 0.056}px`, display: "flex", flexDirection: "column", gap: width * 0.019 }}>
            <div style={{ fontFamily, fontSize: width * 0.034, fontWeight: 400, color: "rgba(0,20,60,0.5)" }}>Portfolio</div>
            <div style={{ fontFamily, fontSize: width * 0.075, fontWeight: 700, color: "#0a0a2e" }}>$125,367.10</div>
            <div style={{ fontFamily, fontSize: width * 0.031, fontWeight: 500, color: "#00c853" }}>Today +$1,432.50 (+1.15%)</div>
            <svg viewBox="0 0 240 60" style={{ width: "100%", height: width * 0.156, marginTop: width * 0.013 }}>
              <path d="M 0,45 C 30,40 60,35 80,30 S 120,20 150,25 S 200,15 240,10" fill="none" stroke="rgba(4,47,243,0.3)" strokeWidth={1.5} />
              <path d="M 0,45 C 30,40 60,35 80,30 S 120,20 150,25 S 200,15 240,10 L 240,60 L 0,60 Z" fill="rgba(4,47,243,0.05)" />
            </svg>
            <div style={{ display: "flex", gap: width * 0.038, marginTop: width * 0.013, borderBottom: "1px solid rgba(0,0,0,0.06)", paddingBottom: width * 0.019 }}>
              {["Portfolio", "Assets", "Activity"].map((tab, ti) => (
                <div key={tab} style={{ fontFamily, fontSize: width * 0.028, fontWeight: ti === 0 ? 600 : 400, color: ti === 0 ? BLUE : "rgba(0,20,60,0.4)" }}>{tab}</div>
              ))}
            </div>
            {[
              { name: "AAPL", amount: "$24,500", pct: "+2.3%" },
              { name: "TSLA", amount: "$18,200", pct: "-1.1%" },
              { name: "BTC", amount: "$15,800", pct: "+4.5%" },
              { name: "SPY", amount: "$12,400", pct: "+0.8%" },
            ].map((h, hi) => (
              <div key={hi} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: `${width * 0.013}px 0`, borderBottom: "0.5px solid rgba(0,0,0,0.04)" }}>
                <div>
                  <div style={{ fontFamily, fontSize: width * 0.031, fontWeight: 600, color: "#0a0a2e" }}>{h.name}</div>
                  <div style={{ fontFamily, fontSize: width * 0.025, fontWeight: 400, color: "rgba(0,20,60,0.4)" }}>{h.amount}</div>
                </div>
                <div style={{ fontFamily, fontSize: width * 0.028, fontWeight: 500, color: h.pct.startsWith("+") ? "#00c853" : "#ff1744" }}>{h.pct}</div>
              </div>
            ))}
          </div>
        ) : (
          <PhoneScreenContent variant={screenVariant} width={width} />
        )}
      </div>
      {/* Side buttons */}
      <div style={{ position: "absolute", right: -3, top: height * 0.203, width: 3, height: height * 0.086, background: "#3a4060", borderRadius: "0 2px 2px 0" }} />
      <div style={{ position: "absolute", left: -3, top: height * 0.172, width: 3, height: height * 0.047, background: "#3a4060", borderRadius: "2px 0 0 2px" }} />
      <div style={{ position: "absolute", left: -3, top: height * 0.234, width: 3, height: height * 0.086, background: "#3a4060", borderRadius: "2px 0 0 2px" }} />
    </div>
  );
};

/**
 * Segment 3: Phone mockup with rainbows wordmark → tilts → grid of identical 3D phones
 * Reference: frame_008–014
 * Phone enters centered, tilts with perspective, then zooms out to reveal
 * a 5x3 grid of identical phones in slight isometric perspective.
 */
const PhoneSegment: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Phone slides up with spring — slight overshoot for settle/rock feel
  const entrySpring = spring({
    frame,
    fps,
    config: { damping: 10, mass: 1.1, stiffness: 90 },
  });

  // Fade in for crossfade overlap with previous segment
  const entryOpacity = interpolate(frame, [0, Math.round(fps * 0.25)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Subtle rock/settle — a small rotational wobble during entry
  const settleRock = frame < Math.round(fps * 0.8)
    ? Math.sin(frame * 0.4) * interpolate(frame, [0, Math.round(fps * 0.6)], [2.5, 0], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      })
    : 0;

  // Phone tilts after settling (~0.8s in)
  const tiltStart = Math.round(fps * 0.6);
  const tiltProgress = interpolate(
    frame,
    [tiltStart, tiltStart + Math.round(fps * 0.4)],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) }
  );

  // Transition to phone grid (~1.2s in)
  const gridStart = Math.round(fps * 1.2);
  const gridProgress = interpolate(frame, [gridStart, gridStart + Math.round(fps * 0.5)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });

  // Exit — hold the grid view, then fade for crossfade with next segment
  const exitOpacity = interpolate(frame, [fps * 3.2, fps * 3.6], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const phoneY = interpolate(entrySpring, [0, 1], [600, 0]);

  // Tilt transforms — subtle perspective rotation matching reference (~12-14 degrees)
  const tiltRotateY = interpolate(tiltProgress, [0, 1], [0, -13]);
  const tiltRotateX = interpolate(tiltProgress, [0, 1], [0, 4]);

  // Grid transforms — zoom out + slight perspective tilt
  const gridScale = interpolate(gridProgress, [0, 1], [1, 0.32]);
  const gridRotateX = interpolate(gridProgress, [0, 1], [tiltRotateX, 52]);
  const gridRotateZ = interpolate(gridProgress, [0, 1], [0, -42]);
  const gridRotateY = interpolate(gridProgress, [0, 1], [tiltRotateY, 0]);

  // Grid layout: 5 columns x 3 rows of identical phones
  const GRID_COLS = 5;
  const GRID_ROWS = 3;
  const gridPhoneW = 200;
  const gridPhoneH = 400;

  // Light background fades in for grid view
  const bgOpacity = interpolate(gridProgress, [0, 0.5], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ opacity: exitOpacity * entryOpacity }}>
      <FilmGrain opacity={0.03} />

      {/* Light background that fades in for grid view */}
      {gridProgress > 0 && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `linear-gradient(135deg, #eef0f5, #e8eaf2, #f0f1f6)`,
            opacity: bgOpacity,
          }}
        />
      )}

      {/* Phone grid — 5x3 identical phones in isometric perspective */}
      {gridProgress > 0 && (
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: `translate(-50%, -50%) perspective(1400px) rotateX(52deg) rotateZ(-42deg)`,
            opacity: gridProgress,
            display: "grid",
            gridTemplateColumns: `repeat(${GRID_COLS}, ${gridPhoneW + 16}px)`,
            gridTemplateRows: `repeat(${GRID_ROWS}, ${gridPhoneH + 16}px)`,
            gap: 14,
            alignItems: "center",
            justifyItems: "center",
          }}
        >
          {Array.from({ length: GRID_ROWS * GRID_COLS }).map((_, i) => {
            const row = Math.floor(i / GRID_COLS);
            const col = i % GRID_COLS;
            const isCenter = row === 1 && col === 2;
            // Radial stagger from center
            const distFromCenter = Math.sqrt(Math.pow(row - 1, 2) + Math.pow(col - 2, 2));
            const cardDelay = distFromCenter * 0.08;
            const phoneOpacity = interpolate(
              gridProgress,
              [cardDelay, cardDelay + 0.3],
              [0, 1],
              { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
            );
            const phoneSlideY = interpolate(
              gridProgress,
              [cardDelay, cardDelay + 0.35],
              [50, 0],
              { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
            );
            return (
              <div
                key={i}
                style={{
                  opacity: phoneOpacity,
                  transform: `translateY(${phoneSlideY}px)`,
                  filter: isCenter ? "none" : "brightness(0.92)",
                }}
              >
                <PhoneMockup
                  width={gridPhoneW}
                  height={gridPhoneH}
                  showPortfolio={isCenter}
                  elevated={isCenter}
                  iridescentHue={isCenter ? 0 : (i * 47 + 120) % 360}
                  screenVariant={isCenter ? "logo" : (["treasury", "holdings", "about", "statements", "chart", "buy", "research", "live", "holdings", "about", "chart", "research", "treasury", "live", "statements"] as ScreenVariant[])[i % 15]}
                />
              </div>
            );
          })}
        </div>
      )}

      {/* Main phone mockup — zooms into the grid */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: `translate(-50%, calc(-50% + ${phoneY}px)) perspective(1000px) rotateY(${gridRotateY}deg) rotateX(${gridRotateX}deg) rotateZ(${gridRotateZ + settleRock}deg) scale(${gridScale})`,
          transformStyle: "preserve-3d",
          opacity: gridProgress > 0.5 ? 0 : 1,
          zIndex: 10,
        }}
      >
        <PhoneMockup width={320} height={640} showPortfolio={false} elevated />
      </div>
    </AbsoluteFill>
  );
};

/**
 * Segment 4: "One place" glass text + blue arrow box → slide → "invest" / "in" collision + shockwave
 * Reference: frame_015–020
 * "One" is enormous glass/iridescent text, "place" is bold blue below.
 * Arrow box on the right. White panel slides left to reveal blue bg.
 * "invest" flies from LEFT, "in" flies from RIGHT. They COLLIDE at center.
 * At collision: shockwave circle radiates outward as clip-path, revealing "everything" grid.
 * Screen shake for 5 frames at collision.
 */
const OnePlaceSegment: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // "One" appears with snappy spring
  const oneSpring = spring({
    frame,
    fps,
    config: { damping: 14, mass: 0.5, stiffness: 180 },
  });
  const oneT = Math.min(1, oneSpring);
  const oneX = bezier2(oneT, -45, 12, 0);
  const oneY = bezier2(oneT, 60, -15, 0);
  const oneWobX = noise2D("onex", frame * 0.03, 0) * 4;
  const oneWobY = noise2D("oney", frame * 0.03, 0) * 3;
  const onePrevT = Math.min(1, spring({ frame: Math.max(0, frame - 1), fps, config: { damping: 14, mass: 0.5, stiffness: 180 } }));
  const onePrevX = bezier2(onePrevT, -45, 12, 0);
  const onePrevY = bezier2(onePrevT, 60, -15, 0);
  const oneVel = Math.abs(oneX - onePrevX) + Math.abs(oneY - onePrevY);

  // Slide the whole white panel left
  const slideStart = Math.round(fps * 1.2);
  const slideProgress = interpolate(frame, [slideStart, slideStart + Math.round(fps * 0.45)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });
  const slideX = slideProgress * -1300;

  // --- COLLISION TIMELINE ---
  // "invest" and "in" appear once slide reveals enough blue (~60% through)
  const flyStart = slideStart + Math.round(fps * 0.25);
  const collisionFrame = flyStart + Math.round(fps * 0.35); // fast 0.35s flight
  const collisionDuration = Math.round(fps * 0.4);

  // "invest" flies from left, "in" from right — converge to touching
  // Gap = 8px at collision (tight, nearly touching)
  const investX = interpolate(frame, [flyStart, collisionFrame], [-400, -8], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.in(Easing.quad),
  });
  const inX = interpolate(frame, [flyStart, collisionFrame], [400, 8], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.in(Easing.quad),
  });
  // Opacity — pop in instantly
  const flyOpacity = interpolate(frame, [flyStart, flyStart + 3], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  // After collision, flash bright then fade fast
  const collisionFlash = frame >= collisionFrame && frame < collisionFrame + 3 ? 1 : 0;
  const postCollisionFade = interpolate(frame, [collisionFrame, collisionFrame + Math.round(fps * 0.15)], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  // Motion blur proportional to speed (less aggressive)
  const investVel = frame < collisionFrame && frame >= flyStart
    ? Math.abs(interpolate(frame, [flyStart, collisionFrame], [-400, -8], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.in(Easing.quad) })
        - interpolate(Math.max(flyStart, frame - 1), [flyStart, collisionFrame], [-400, -8], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.in(Easing.quad) }))
    : 0;
  const inVel = frame < collisionFrame && frame >= flyStart
    ? Math.abs(interpolate(frame, [flyStart, collisionFrame], [400, 8], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.in(Easing.quad) })
        - interpolate(Math.max(flyStart, frame - 1), [flyStart, collisionFrame], [400, 8], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.in(Easing.quad) }))
    : 0;

  // --- SHOCKWAVE ---
  // Circle expands from center after collision, revealing "everything"
  const shockwaveProgress = interpolate(
    frame,
    [collisionFrame, collisionFrame + collisionDuration],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) }
  );
  const shockwaveRadius = shockwaveProgress * 160;

  // Shockwave ring — visible expanding circle outline
  const ringOpacity = interpolate(
    frame,
    [collisionFrame, collisionFrame + Math.round(collisionDuration * 0.2), collisionFrame + collisionDuration],
    [0, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const ringRadius = shockwaveProgress * 1000;

  // --- SCREEN SHAKE ---
  const shakeIntensity = frame >= collisionFrame && frame < collisionFrame + 6
    ? interpolate(frame, [collisionFrame, collisionFrame + 6], [8, 0], { extrapolateRight: "clamp" })
    : 0;
  const shakeX = shakeIntensity > 0 ? (noise2D("skx", frame * 3, 0) * shakeIntensity) : 0;
  const shakeY = shakeIntensity > 0 ? (noise2D("sky", frame * 3, 7.7) * shakeIntensity) : 0;

  // --- EVERYTHING GRID (revealed by shockwave) ---
  const COLS = 5;
  const ROWS = 9;
  const centerRow = Math.floor(ROWS / 2);
  const centerCol = Math.floor(COLS / 2);
  const everythingScrollX = interpolate(frame, [collisionFrame, collisionFrame + fps * 1.8], [20, -30], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const centerScaleBase = interpolate(
    frame,
    [collisionFrame + Math.round(fps * 0.15), collisionFrame + Math.round(fps * 0.35)],
    [0.9, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.back(1.4)) }
  );
  const centerBreathe = frame > collisionFrame + Math.round(fps * 0.35)
    ? Math.sin((frame - collisionFrame - fps * 0.35) * 0.18) * 0.02
    : 0;
  const centerScale = centerScaleBase + centerBreathe;
  const glowIntensity = frame > collisionFrame + Math.round(fps * 0.35)
    ? 0.15 + Math.sin((frame - collisionFrame - fps * 0.35) * 0.22) * 0.08
    : 0.15;

  return (
    <AbsoluteFill style={{ transform: `translate(${shakeX}px, ${shakeY}px)` }}>
      {/* Layer 0: "everything" grid — always behind, revealed by shockwave clip-path */}
      <AbsoluteFill
        style={{
          background: BLUE,
          clipPath: shockwaveProgress > 0
            ? `circle(${shockwaveRadius}% at 50% 46%)`
            : "circle(0% at 50% 46%)",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${COLS}, 1fr)`,
              gridTemplateRows: `repeat(${ROWS}, 1fr)`,
              width: "115%",
              height: "95%",
              alignItems: "center",
              justifyItems: "center",
              transform: `translateX(${everythingScrollX}px)`,
            }}
          >
            {Array.from({ length: ROWS * COLS }).map((_, i) => {
              const row = Math.floor(i / COLS);
              const col = i % COLS;
              const isCenter = row === centerRow && col === centerCol;
              const dist = Math.sqrt(Math.pow(row - centerRow, 2) + Math.pow(col - centerCol, 2));
              const dimFactor = Math.max(0.1, 1 - dist * 0.18);
              const rowOffset = isCenter ? 0 : ((row % 3) - 1) * 18;
              const wobX = noise2D("ewx" + i, frame * 0.025, i * 0.7) * 4;
              const wobY = noise2D("ewy" + i, frame * 0.025, i * 1.3) * 3;
              return (
                <span
                  key={i}
                  style={{
                    fontFamily,
                    fontSize: isCenter ? 44 : 28,
                    fontWeight: isCenter ? 800 : 400,
                    color: isCenter ? WHITE : `rgba(100,140,255,${0.45 * dimFactor})`,
                    letterSpacing: isCenter ? -1 : -0.3,
                    whiteSpace: "nowrap",
                    transform: isCenter
                      ? `scale(${centerScale}) translate(${wobX}px, ${wobY}px)`
                      : `translate(${rowOffset + wobX}px, ${wobY}px)`,
                    textShadow: isCenter ? `0 0 ${20 + glowIntensity * 40}px rgba(255,255,255,${glowIntensity})` : undefined,
                  }}
                >
                  rainbows
                </span>
              );
            })}
          </div>
        </div>
        <FilmGrain opacity={0.03} />
      </AbsoluteFill>

      {/* Layer 1: Blue background with flying "you" / "trade" words */}
      {shockwaveProgress < 1 && (
        <AbsoluteFill style={{ background: BLUE, opacity: shockwaveProgress > 0 ? 1 - shockwaveProgress : 1 }}>
          {/* "you" — flies from LEFT */}
          {frame >= flyStart && (
            <div
              style={{
                position: "absolute",
                top: "46%",
                left: "50%",
                transform: `translate(calc(-100% + ${investX}px), -50%)`,
                opacity: flyOpacity * postCollisionFade,
                filter: investVel > 15 ? `blur(${Math.min(investVel * 0.04, 4)}px)` : "none",
                textShadow: collisionFlash ? "0 0 40px rgba(255,255,255,0.9)" : "0 0 15px rgba(255,255,255,0.3)",
              }}
            >
              <span style={{ fontFamily, fontSize: 56, fontWeight: 500, color: WHITE, letterSpacing: -0.5 }}>
                you
              </span>
            </div>
          )}
          {/* "trade" — flies from RIGHT */}
          {frame >= flyStart && (
            <div
              style={{
                position: "absolute",
                top: "46%",
                left: "50%",
                transform: `translate(${inX}px, -50%)`,
                opacity: flyOpacity * postCollisionFade,
                filter: inVel > 15 ? `blur(${Math.min(inVel * 0.04, 4)}px)` : "none",
                textShadow: collisionFlash ? "0 0 40px rgba(255,255,255,0.9)" : "0 0 15px rgba(255,255,255,0.3)",
              }}
            >
              <span style={{ fontFamily, fontSize: 56, fontWeight: 500, color: WHITE, letterSpacing: -0.5 }}>
                trade
              </span>
            </div>
          )}
        </AbsoluteFill>
      )}

      {/* Shockwave ring — visible expanding circle */}
      {ringOpacity > 0 && (
        <div
          style={{
            position: "absolute",
            top: "46%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: ringRadius * 2,
            height: ringRadius * 2,
            borderRadius: "50%",
            border: `3px solid rgba(255,255,255,${ringOpacity * 0.6})`,
            boxShadow: `0 0 30px rgba(255,255,255,${ringOpacity * 0.3}), inset 0 0 20px rgba(255,255,255,${ringOpacity * 0.15})`,
            pointerEvents: "none",
          }}
        />
      )}

      {/* Layer 2: White panel with "One place" — slides left to reveal blue */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: WHITE,
          transform: `translateX(${slideX}px)`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 30,
          paddingLeft: 60,
        }}
      >
        <FilmGrain opacity={0.02} />

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
          }}
        >
          {/* Bridge phrase above — "When you want better odds of winning, you trade —" */}
          <div
            style={{
              fontFamily,
              fontSize: 36,
              fontWeight: 500,
              color: "#1a1a35",
              opacity: oneSpring,
              transform: `translate(${oneX * 0.4 + oneWobX * 0.5}px, ${oneY * 0.4 + oneWobY * 0.5}px)`,
              letterSpacing: -0.3,
              marginBottom: 4,
              whiteSpace: "nowrap",
            }}
          >
            When you want better odds of winning, you trade —
          </div>
          {/* Glass "rainbows" — iridescent crystal */}
          <div
            style={{
              position: "relative",
              opacity: oneSpring,
              transform: `translate(${oneX + oneWobX}px, ${oneY + oneWobY}px)`,
              filter: `drop-shadow(0 6px 22px rgba(140,120,200,0.12)) ${oneVel > 0.5 ? `blur(${Math.min(oneVel * 0.15, 5)}px)` : ""}`.trim(),
            }}
          >
            <svg
              viewBox="0 0 1000 260"
              style={{ width: 1000, height: 260, overflow: "visible" }}
            >
              <defs>
                <filter id="ribbonGlow">
                  <feGaussianBlur stdDeviation="2.5" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
                <linearGradient id="glassIridescent" x1="0%" y1="30%" x2="100%" y2="70%">
                  {/* prismatic spectrum across the word — rainbows */}
                  <stop offset="0%" stopColor={`rgba(${230 + Math.sin(frame * 0.06) * 10},${80 + Math.sin(frame * 0.08) * 20},${100 + Math.sin(frame * 0.04) * 10},0.85)`} />
                  <stop offset="15%" stopColor={`rgba(${240 + Math.sin(frame * 0.07) * 10},${150 + Math.sin(frame * 0.05) * 15},${70 + Math.sin(frame * 0.06) * 10},0.78)`} />
                  <stop offset="35%" stopColor={`rgba(${230 + Math.sin(frame * 0.05) * 10},${210 + Math.sin(frame * 0.07) * 15},${80 + Math.sin(frame * 0.04) * 5},0.7)`} />
                  <stop offset="50%" stopColor={`rgba(${110 + Math.sin(frame * 0.08) * 15},${210 + Math.sin(frame * 0.06) * 10},${130},0.7)`} />
                  <stop offset="65%" stopColor={`rgba(${90 + Math.sin(frame * 0.06) * 15},${170 + Math.sin(frame * 0.04) * 15},${230 + Math.sin(frame * 0.07) * 10},0.75)`} />
                  <stop offset="80%" stopColor={`rgba(${130 + Math.sin(frame * 0.07) * 10},${100 + Math.sin(frame * 0.05) * 15},${220 + Math.sin(frame * 0.06) * 15},0.8)`} />
                  <stop offset="100%" stopColor={`rgba(${200 + Math.sin(frame * 0.04) * 5},${100 + Math.sin(frame * 0.08) * 10},${210 + Math.sin(frame * 0.05) * 15},0.78)`} />
                </linearGradient>
                <linearGradient id="glassSpecular" x1="0%" y1="0%" x2="100%" y2="100%"
                  gradientTransform={`rotate(${(frame * 0.25 + 15) % 360})`}>
                  <stop offset="0%" stopColor="transparent" />
                  <stop offset="10%" stopColor="rgba(255,255,255,0.8)" />
                  <stop offset="18%" stopColor="transparent" />
                  <stop offset="42%" stopColor="transparent" />
                  <stop offset="52%" stopColor="rgba(255,255,255,0.55)" />
                  <stop offset="60%" stopColor="transparent" />
                  <stop offset="82%" stopColor="transparent" />
                  <stop offset="92%" stopColor="rgba(255,255,255,0.4)" />
                  <stop offset="100%" stopColor="transparent" />
                </linearGradient>
                <linearGradient id="glassFill" x1="0%" y1="20%" x2="100%" y2="80%">
                  <stop offset="0%" stopColor="rgba(220,200,200,0.42)" />
                  <stop offset="35%" stopColor="rgba(210,210,200,0.36)" />
                  <stop offset="65%" stopColor="rgba(195,210,225,0.4)" />
                  <stop offset="100%" stopColor="rgba(210,200,225,0.42)" />
                </linearGradient>
              </defs>
              <text x="4" y="195" fontFamily={fontFamily} fontSize="180" fontWeight="200"
                letterSpacing="-6" fill="rgba(160,150,200,0.08)" filter="url(#ribbonGlow)">
                rainbows
              </text>
              <text x="2" y="197" fontFamily={fontFamily} fontSize="180" fontWeight="200"
                letterSpacing="-6" fill="rgba(170,160,210,0.06)">
                rainbows
              </text>
              <text x="1.5" y="196" fontFamily={fontFamily} fontSize="180" fontWeight="200"
                letterSpacing="-6" fill="rgba(175,165,215,0.05)">
                rainbows
              </text>
              <text x="0" y="193" fontFamily={fontFamily} fontSize="180" fontWeight="200"
                letterSpacing="-6" fill="url(#glassFill)">
                rainbows
              </text>
              <text x="0" y="193" fontFamily={fontFamily} fontSize="180" fontWeight="200"
                letterSpacing="-6" fill="url(#glassIridescent)">
                rainbows
              </text>
              <text x="0" y="193" fontFamily={fontFamily} fontSize="180" fontWeight="200"
                letterSpacing="-6" fill="url(#glassSpecular)">
                rainbows
              </text>
              <text x="0" y="193" fontFamily={fontFamily} fontSize="180" fontWeight="200"
                letterSpacing="-6" fill="none" stroke="rgba(160,155,210,0.65)" strokeWidth="2.2">
                rainbows
              </text>
            </svg>
          </div>

        </div>
      </div>
    </AbsoluteFill>
  );
};

/* EverythingSegment removed — now integrated into OnePlaceSegment as shockwave reveal */

/**
 * Scene 01 — 301 frames at 29fps (~10.4s).
 *
 * Three sentences in three beats:
 *   Beat 1 (Segment 1): "When you want leverage — you trade perps."
 *   Beat 2 (Segment 2): "When you want volatility exposure — you trade options."
 *   Beat 3 (Segment 4): "When you want better odds of winning, you trade — rainbows."
 * Segment 3 is the phone-grid bridge between beats 2 and 3.
 */
export const Scene01: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: BLUE, fontFamily }}>
      {/* Segment 1: "Sometimes investing can feel →" */}
      <Sequence from={0} durationInFrames={70}>
        <SometimesSegment />
      </Sequence>

      {/* Segment 2: "all over the place" */}
      <Sequence from={64} durationInFrames={55}>
        <AllOverSegment />
      </Sequence>

      {/* Segment 3: Phone mockup → tilt → isometric (overlaps end of segment 2 for crossfade) */}
      <Sequence from={100} durationInFrames={113}>
        <PhoneSegment />
      </Sequence>

      {/* Segment 4: "One place" → slide → "invest"/"in" collision → shockwave → "everything" */}
      <Sequence from={195} durationInFrames={106}>
        <OnePlaceSegment />
      </Sequence>
    </AbsoluteFill>
  );
};

export const scene01Meta = {
  id: "RainbowsPublicScene01",
  component: Scene01,
  width: 1280,
  height: 720,
  fps: 29,
  durationInFrames: 301,
};
