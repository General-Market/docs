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
import { loadFont } from "@remotion/google-fonts/Inter";
import { ThreeCanvas } from "@remotion/three";
import * as THREE from "three";

const { fontFamily } = loadFont("normal", {
  subsets: ["latin"],
  weights: ["300", "400", "500", "600", "700", "800"],
});

const BLUE = "#042FF3";
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

// Stock ticker data — single column, right-aligned as in reference
const TICKERS = [
  { price: "567,10", dir: "up", pct: "+2,45%" },
  { price: "250.10", dir: "up", pct: "+1.25%" },
  { price: "413.12", dir: "down", pct: "-0.06%" },
  { price: "871.56", dir: "up", pct: "+2.73%" },
  { price: "517.94", dir: "down", pct: "-1.04%" },
  { price: "328.63", dir: "up", pct: "+0.15%" },
  { price: "699.46", dir: "up", pct: "+0.91%" },
  { price: "735.00", dir: "up", pct: "+1.39%" },
  { price: "964.25", dir: "down", pct: "-0.52%" },
  { price: "452.89", dir: "up", pct: "+3.01%" },
  { price: "573.36", dir: "down", pct: "-0.29%" },
  { price: "240.21", dir: "up", pct: "+1.48%" },
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

  const words = ["Sometimes", "investing", "can", "feel"];
  // Beat-synced word starts: "Sometimes" at beat 0.55s (frame 16),
  // "investing" at 0.7s (f20), "can" at 1.1s (f32), "feel" at 1.35s (f39)
  const wordStartFrames = [0, Math.round(fps * 0.4), Math.round(fps * 0.85), Math.round(fps * 1.15)];

  // Dissolve transition — starts at ~2.0s, completes by ~2.34s
  const segmentOpacity = interpolate(frame, [fps * 1.9, fps * 2.3], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Ticker columns fade in after first word appears
  const tickerOpacity = interpolate(frame, [fps * 0.3, fps * 0.6], [0, 0.35], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Subtle ticker scroll
  const tickerScrollY = interpolate(frame, [0, fps * 2], [10, -10], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Beat-synced opacity pulse — tickers briefly brighten on audio beats
  const beatFrames = [16, 20, 32, 39, 44, 49, 51, 54];
  const beatPulse = beatFrames.reduce((acc, bf) => {
    const dist = Math.abs(frame - bf);
    return dist < 4 ? Math.max(acc, 1 - dist / 4) : acc;
  }, 0);
  const tickerPulseOpacity = tickerOpacity + beatPulse * 0.12;

  return (
    <AbsoluteFill style={{ opacity: segmentOpacity }}>
      <FilmGrain opacity={0.035} />

      {/* Stock tickers — single centered column as in reference, right-aligned values */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: `translate(-30%, -50%) translateY(${tickerScrollY}px)`,
          opacity: tickerPulseOpacity,
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          gap: 2,
        }}
      >
        {TICKERS.map((t, i) => {
          const stagger = interpolate(
            frame,
            [fps * 0.3 + i * 1.2, fps * 0.45 + i * 1.2],
            [0, 1],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
          );
          return (
            <div
              key={i}
              style={{
                fontFamily,
                fontSize: 15,
                fontWeight: 300,
                color: "rgba(255,255,255,0.4)",
                whiteSpace: "nowrap",
                letterSpacing: 1.4,
                opacity: stagger,
                textAlign: "right",
              }}
            >
              {t.price}&nbsp;&nbsp;{t.dir === "up" ? "↑" : "↓"}&nbsp;{t.pct}
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
          // Use spring with overshoot (ease_out_back_overshoot detected)
          const wordSpring = spring({
            frame: Math.max(0, frame - wordStartFrames[i]),
            fps,
            config: {
              damping: 12,
              mass: 0.8,
              stiffness: 120,
            },
          });
          const wordOpacity = interpolate(
            frame,
            [wordStartFrames[i], wordStartFrames[i] + Math.round(fps * 0.08)],
            [0, 1],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
          );
          // Slight upward motion
          const wordY = (1 - wordSpring) * 18;
          return (
            <span
              key={word}
              style={{
                fontFamily,
                fontSize: word === "investing" ? 58 : 50,
                fontWeight: word === "investing" ? 700 : 400,
                color: WHITE,
                opacity: wordOpacity,
                transform: `translateY(${wordY}px)`,
                letterSpacing: word === "Sometimes" ? 0.5 : -0.3,
              }}
            >
              {word}
            </span>
          );
        })}
        {/* Arrow after "feel" */}
        <span
          style={{
            fontFamily,
            fontSize: 46,
            fontWeight: 400,
            color: WHITE,
            opacity: interpolate(
              frame,
              [wordStartFrames[3] + Math.round(fps * 0.15), wordStartFrames[3] + Math.round(fps * 0.25)],
              [0, 1],
              { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
            ),
            transform: `translateX(${interpolate(
              frame,
              [wordStartFrames[3] + Math.round(fps * 0.15), wordStartFrames[3] + Math.round(fps * 0.35)],
              [-14, 0],
              { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
            )}px)`,
          }}
        >
          →
        </span>
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
    const geo = new THREE.TubeGeometry(curve, visibleSegments, radius, 12, false);
    return geo;
  }, [points, radius, progress]);

  return (
    <mesh geometry={geometry}>
      <meshPhysicalMaterial
        color={color}
        transparent
        opacity={opacity}
        transmission={0.65}
        roughness={0.03}
        metalness={0.08}
        clearcoat={1.0}
        clearcoatRoughness={0.01}
        ior={1.5}
        thickness={0.2}
        side={THREE.DoubleSide}
        envMapIntensity={2.0}
        emissive="#6080c0"
        emissiveIntensity={0.18}
        specularIntensity={1.0}
        specularColor={new THREE.Color("#d0e0ff")}
      />
    </mesh>
  );
};

const RibbonScene: React.FC<{ progress: number; breathe: number }> = ({ progress, breathe }) => {
  const colors = ["#b8c8e8", "#c0d0f0", "#a8b8e0", "#bcc8e8", "#b0c0e0"];
  const radii = [0.19, 0.17, 0.15, 0.21, 0.16];
  const opacities = [0.68, 0.58, 0.63, 0.52, 0.60];

  return (
    <>
      <ambientLight intensity={1.0} />
      <pointLight position={[5, 5, 5]} intensity={1.8} color="#d0e0ff" />
      <pointLight position={[-4, -2, 4]} intensity={0.8} color="#a0b0e0" />
      <pointLight position={[0, 4, 2]} intensity={0.6} color="#e0e8ff" />
      <directionalLight position={[0, 3, 5]} intensity={1.2} color="#ffffff" />
      <group
        rotation={[breathe * 0.01, breathe * 0.025, breathe * 0.005]}
        position={[0, breathe * 0.05, 0]}
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
        camera={{ position: [0.3, 0.1, 7], fov: 50 }}
      >
        <Suspense fallback={null}>
          <RibbonScene progress={progress} breathe={breathe} />
        </Suspense>
      </ThreeCanvas>
    </div>
  );
};

/**
 * Segment 2: "all over the place" with tangled ribbon
 * Reference: frame_005–007
 * Huge text filling viewport, dashes between "all" and "over",
 * 3D ribbon loops tangled across the center.
 */
const AllOverSegment: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Exit dissolve — the ribbon and text fade out as phone enters (crossfade)
  const exitOpacity = interpolate(frame, [fps * 1.0, fps * 1.35], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Words: "all" top-left, "over" top-right, "the" bottom-left, "place" bottom-right
  const words = [
    { text: "all", top: "2%", left: "4%", textAlign: "left" as const },
    { text: "over", top: "2%", right: "4%", textAlign: "right" as const },
    { text: "the", bottom: "8%", left: "4%", textAlign: "left" as const },
    { text: "place", bottom: "8%", right: "4%", textAlign: "right" as const },
  ];

  const wordDelays = [0, Math.round(fps * 0.06), Math.round(fps * 0.12), Math.round(fps * 0.18)];

  // Ribbon draws on quickly with segmented feel
  const ribbonProgress = interpolate(frame, [0, fps * 0.45], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  // Post-draw breathing — subtle oscillation after ribbon is fully drawn
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

      {/* Tangled ribbon behind text — Three.js 3D tubes */}
      <TangledRibbon3D progress={ribbonProgress} breathe={breathe} />

      {/* Dashes connecting "all" to "over" — horizontal row at top */}
      <div
        style={{
          position: "absolute",
          top: "16%",
          left: "18%",
          width: "64%",
          display: "flex",
          gap: 14,
          alignItems: "center",
          justifyContent: "center",
          opacity: interpolate(frame, [Math.round(fps * 0.08), Math.round(fps * 0.2)], [0, 0.7], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        {Array.from({ length: 10 }).map((_, i) => (
          <div
            key={i}
            style={{
              width: 42,
              height: 4,
              background: "rgba(255,255,255,0.55)",
              borderRadius: 2,
            }}
          />
        ))}
      </div>

      {/* Big text: "all over the place" */}
      {words.map((w, i) => {
        const delay = wordDelays[i];
        const wordSpring = spring({
          frame: Math.max(0, frame - delay),
          fps,
          config: { damping: 12, mass: 0.7, stiffness: 100 },
        });
        const posStyle: React.CSSProperties = {
          position: "absolute",
          ...(w.top ? { top: w.top } : {}),
          ...(w.bottom ? { bottom: w.bottom } : {}),
          ...(w.left ? { left: w.left } : {}),
          ...(w.right ? { right: w.right } : {}),
          fontFamily,
          fontSize: 150,
          fontWeight: 700,
          color: WHITE,
          opacity: wordSpring,
          transform: `translateY(${(1 - wordSpring) * 35}px)`,
          lineHeight: 1.0,
          letterSpacing: -3,
          textShadow: "0 4px 20px rgba(0,0,0,0.15)",
        };
        return (
          <div key={w.text} style={posStyle}>
            {w.text}
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

/**
 * Segment 3: Phone mockup with public.com → tilts → isometric grid
 * Reference: frame_008–014
 * Phone enters centered, tilts with perspective, then zooms to isometric grid.
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

  // Transition to isometric view (~1.2s in)
  const isoStart = Math.round(fps * 1.2);
  const isoProgress = interpolate(frame, [isoStart, isoStart + Math.round(fps * 0.5)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });

  // Exit — hold the isometric view longer, then fade for crossfade with next segment
  const exitOpacity = interpolate(frame, [fps * 3.2, fps * 3.6], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const phoneY = interpolate(entrySpring, [0, 1], [600, 0]);

  // Tilt transforms — subtle perspective rotation matching reference (~12-14°)
  const tiltRotateY = interpolate(tiltProgress, [0, 1], [0, -13]);
  const tiltRotateX = interpolate(tiltProgress, [0, 1], [0, 4]);

  // Isometric transforms
  const phoneScale = interpolate(isoProgress, [0, 1], [1, 0.58]);
  const isoRotateX = interpolate(isoProgress, [0, 1], [tiltRotateX, 55]);
  const isoRotateZ = interpolate(isoProgress, [0, 1], [0, -45]);
  const isoRotateY = interpolate(isoProgress, [0, 1], [tiltRotateY, 0]);

  // Isometric card data — rich content matching reference screenshots
  type IsoCard = {
    label: string; amount: string; subtitle?: string;
    hasChart: boolean; hasBar: boolean; hasProfile?: boolean;
    greenText?: string; redText?: string; extraLines?: number;
    buttonText?: string;
  };
  const isoCards: IsoCard[] = [
    { label: "Treasury account", amount: "$5,585.00", subtitle: "$4,400.00 available", hasChart: false, hasBar: true, extraLines: 3 },
    { label: "Holdings", amount: "", subtitle: "45.0%", hasChart: true, hasBar: false, extraLines: 4, greenText: "+$338.07 (+1.63%)" },
    { label: "About", amount: "", subtitle: "Company overview", hasChart: false, hasBar: true, extraLines: 5 },
    { label: "Statements", amount: "", hasChart: false, hasBar: true, extraLines: 4, buttonText: "Download" },
    { label: "Treasury Bills", amount: "", subtitle: "Current yield", hasChart: false, hasBar: false, extraLines: 3 },
    { label: "Rating", amount: "", subtitle: "Analyst ratings", hasChart: false, hasBar: true, extraLines: 3 },
    { label: "Buy", amount: "", hasChart: false, hasBar: true, extraLines: 2, buttonText: "Buy" },
    { label: "$125,367.10", amount: "Today", subtitle: "+$1,432.50 (+1.15%)", hasChart: true, hasBar: false, greenText: "+$1,432.50" },
    { label: "Research", amount: "", subtitle: "Expert analysis", hasChart: true, hasBar: false, extraLines: 5 },
    { label: "Public Live", amount: "", hasChart: false, hasBar: false, hasProfile: true, extraLines: 3 },
    { label: "Top holdings", amount: "13.7%", subtitle: "3.8% in 10 of 102 holdings", hasChart: false, hasBar: true, extraLines: 2 },
    { label: "Watchlist", amount: "", hasChart: true, hasBar: false, extraLines: 4, greenText: "$2,771.10" },
    { label: "Your position", amount: "", subtitle: "Avg cost $142.50", hasChart: false, hasBar: false, extraLines: 3 },
    { label: "View all", amount: "", hasChart: false, hasBar: false, extraLines: 2, redText: "+$338.07 (+1.63%)" },
    { label: "Let's Talk", amount: "", hasChart: false, hasBar: false, hasProfile: true, extraLines: 3, buttonText: "Start" },
  ];

  return (
    <AbsoluteFill style={{ opacity: exitOpacity * entryOpacity }}>
      <FilmGrain opacity={0.03} />

      {/* Light background that fades in for isometric view */}
      {isoProgress > 0 && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `linear-gradient(135deg, #eef0f5, #e8eaf2, #f0f1f6)`,
            opacity: isoProgress,
          }}
        />
      )}

      {/* Background app screen cards (isometric grid) */}
      {isoProgress > 0 && (
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: `translate(-50%, -50%) perspective(1400px) rotateX(55deg) rotateZ(-45deg)`,
            opacity: isoProgress,
            display: "grid",
            gridTemplateColumns: "repeat(5, 320px)",
            gridTemplateRows: "repeat(3, 540px)",
            gap: 14,
          }}
        >
          {isoCards.map((card, i) => {
            const isCenter = i === 7;
            // Radial stagger: cards closer to center appear first
            const row = Math.floor(i / 5);
            const col = i % 5;
            const distFromCenter = Math.sqrt(Math.pow(row - 1, 2) + Math.pow(col - 2, 2));
            const cardDelay = distFromCenter * 0.06;
            const cardOpacity = interpolate(
              isoProgress,
              [cardDelay, cardDelay + 0.25],
              [0, 1],
              { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
            );
            // Cards slide up from below as they appear
            const cardSlideY = interpolate(
              isoProgress,
              [cardDelay, cardDelay + 0.3],
              [40, 0],
              { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
            );
            return (
              <div
                key={i}
                style={{
                  background: isCenter
                    ? "linear-gradient(145deg, #ffffff, #f8f9ff)"
                    : "linear-gradient(145deg, #fcfcff, #f4f5fb)",
                  borderRadius: 16,
                  transform: `translateY(${cardSlideY}px)`,
                  border: isCenter
                    ? "2px solid rgba(80,140,255,0.35)"
                    : "1.5px solid rgba(190,200,230,0.4)",
                  boxShadow: isCenter
                    ? "0 12px 50px rgba(0,0,80,0.18), 0 3px 12px rgba(0,0,80,0.1), inset 0 1px 0 rgba(255,255,255,0.9)"
                    : `0 6px 25px rgba(0,0,60,0.08), 0 2px 8px rgba(0,0,60,0.04), 0 0 0 1px rgba(${180 + (i * 13) % 40},${160 + (i * 19) % 60},255,0.12), inset 0 1px 0 rgba(255,255,255,0.7)`,
                  overflow: "hidden",
                  padding: 18,
                  opacity: cardOpacity,
                  position: "relative",
                }}
              >
                {/* Iridescent border glow — visible colored edges */}
                {!isCenter && (
                  <div style={{
                    position: "absolute", inset: -2, borderRadius: 18, pointerEvents: "none",
                    border: `2.5px solid rgba(${140 + (i * 23) % 80},${190 + (i * 17) % 50},${230 + (i * 7) % 25},0.25)`,
                    boxShadow: `0 0 12px rgba(${100 + (i * 31) % 100},${200 + (i * 13) % 55},${220 + (i * 7) % 35},0.15), 0 0 4px rgba(${220 + (i * 11) % 35},${140 + (i * 19) % 60},${255},0.1)`,
                    zIndex: 5,
                  }} />
                )}
                {/* Card label */}
                <div
                  style={{
                    fontFamily,
                    fontSize: isCenter ? 14 : 18,
                    fontWeight: 700,
                    color: "rgba(0,20,80,0.75)",
                    marginBottom: 4,
                    letterSpacing: -0.2,
                  }}
                >
                  {card.label}
                </div>
                {card.subtitle && (
                  <div style={{ fontFamily, fontSize: 11, fontWeight: 400, color: "rgba(0,20,60,0.45)", marginBottom: 6 }}>
                    {card.subtitle}
                  </div>
                )}
                {card.amount && (
                  <div
                    style={{
                      fontFamily,
                      fontSize: isCenter ? 26 : 22,
                      fontWeight: 800,
                      color: "rgba(0,20,80,0.85)",
                      marginBottom: 6,
                      letterSpacing: -0.5,
                    }}
                  >
                    {card.amount}
                  </div>
                )}
                {/* Green/red financial text */}
                {card.greenText && (
                  <div style={{ fontFamily, fontSize: 12, fontWeight: 600, color: "#00c853", marginBottom: 6 }}>
                    {card.greenText}
                  </div>
                )}
                {card.redText && (
                  <div style={{ fontFamily, fontSize: 12, fontWeight: 600, color: "#ff1744", marginBottom: 6 }}>
                    {card.redText}
                  </div>
                )}
                {/* Chart line — prominent, with area fill */}
                {card.hasChart && (
                  <svg viewBox="0 0 100 35" style={{ width: "100%", height: 45, marginBottom: 10 }}>
                    <path
                      d={`M 0,${20 + (i % 5) * 2} C 15,${14 - (i % 3) * 3} 30,${24 + (i % 4)} 50,${10 - (i % 2) * 3} S 75,${20 + (i % 3)} 100,${12 - (i % 5)}`}
                      fill="none"
                      stroke={`rgba(4,47,243,${0.5 + (i % 3) * 0.1})`}
                      strokeWidth={2.5}
                    />
                    <path
                      d={`M 0,${20 + (i % 5) * 2} C 15,${14 - (i % 3) * 3} 30,${24 + (i % 4)} 50,${10 - (i % 2) * 3} S 75,${20 + (i % 3)} 100,${12 - (i % 5)} L 100,35 L 0,35 Z`}
                      fill={`rgba(4,47,243,${0.08 + (i % 3) * 0.03})`}
                    />
                  </svg>
                )}
                {/* Text skeleton lines */}
                {Array.from({ length: card.extraLines || 3 }).map((_, li) => (
                  <div key={li} style={{
                    width: `${85 - li * 10 + (i * 7) % 12}%`,
                    height: 8,
                    background: `rgba(0,20,80,${0.07 + li * 0.015})`,
                    borderRadius: 3,
                    marginBottom: 6,
                  }} />
                ))}
                {/* Bar chart */}
                {card.hasBar && (
                  <div style={{ display: "flex", gap: 6, alignItems: "flex-end", marginTop: 8 }}>
                    {[35, 60, 25, 72, 45, 62, 38, 52].map((h, j) => (
                      <div
                        key={j}
                        style={{
                          width: 18,
                          height: h * 0.9,
                          background: `rgba(4,47,243,${0.2 + j * 0.04})`,
                          borderRadius: 2,
                        }}
                      />
                    ))}
                  </div>
                )}
                {/* Profile circle — large, visible */}
                {card.hasProfile && (
                  <div style={{
                    width: 60, height: 60, borderRadius: "50%",
                    background: "linear-gradient(135deg, rgba(160,170,200,0.5), rgba(140,150,180,0.3))",
                    margin: "10px auto 6px",
                    border: "3px solid rgba(0,20,80,0.1)",
                  }} />
                )}
                {/* Action button — prominent */}
                {card.buttonText && (
                  <div style={{
                    marginTop: 12, padding: "8px 0", width: "65%",
                    background: BLUE, borderRadius: 10,
                    fontFamily, fontSize: 14, fontWeight: 700,
                    color: WHITE, textAlign: "center",
                    opacity: 0.9,
                  }}>
                    {card.buttonText}
                  </div>
                )}
                {/* Green/red indicator dot */}
                {i % 3 === 1 && (
                  <div style={{
                    position: "absolute", top: 16, right: 16,
                    width: 14, height: 14, borderRadius: "50%",
                    background: i % 2 === 0 ? "#00c853" : "#ff1744",
                  }} />
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Main phone mockup */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: `translate(-50%, calc(-50% + ${phoneY}px)) perspective(1000px) rotateY(${isoRotateY}deg) rotateX(${isoRotateX}deg) rotateZ(${isoRotateZ + settleRock}deg) scale(${phoneScale})`,
          transformStyle: "preserve-3d",
          width: 320,
          height: 640,
          background: "linear-gradient(160deg, #2a3050, #1a2040, #0e1530)",
          borderRadius: 48,
          padding: 6,
          boxShadow: `0 ${20 + isoProgress * 10}px ${60 + isoProgress * 20}px rgba(0,0,0,${0.4 + isoProgress * 0.15}), 0 6px 20px rgba(0,0,0,0.3), inset 0 1px 0 rgba(100,120,180,0.3)`,
          zIndex: 10,
        }}
      >
        {/* Screen */}
        <div
          style={{
            width: "100%",
            height: "100%",
            background: WHITE,
            borderRadius: 38,
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
              top: 14,
              left: "50%",
              transform: "translateX(-50%)",
              width: 90,
              height: 24,
              background: "#101830",
              borderRadius: 12,
            }}
          />
          {/* Phone content — shows logo initially, then portfolio in iso mode */}
          {isoProgress < 0.3 ? (
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                <div style={{ width: 12, height: 12, borderRadius: "50%", background: BLUE }} />
                <div style={{ width: 7, height: 7, borderRadius: "50%", background: BLUE }} />
              </div>
              <span style={{ fontFamily, fontSize: 22, fontWeight: 600, color: "#0a0a2e", letterSpacing: -0.5 }}>
                public.com
              </span>
            </div>
          ) : (
            <div style={{ width: "100%", padding: "50px 18px 18px", display: "flex", flexDirection: "column", gap: 6 }}>
              {/* Portfolio header */}
              <div style={{ fontFamily, fontSize: 11, fontWeight: 400, color: "rgba(0,20,60,0.5)" }}>Portfolio</div>
              <div style={{ fontFamily, fontSize: 24, fontWeight: 700, color: "#0a0a2e" }}>$125,367.10</div>
              <div style={{ fontFamily, fontSize: 10, fontWeight: 500, color: "#00c853" }}>Today +$1,432.50 (+1.15%)</div>
              {/* Mini chart */}
              <svg viewBox="0 0 240 60" style={{ width: "100%", height: 50, marginTop: 4 }}>
                <path d="M 0,45 C 30,40 60,35 80,30 S 120,20 150,25 S 200,15 240,10" fill="none" stroke="rgba(4,47,243,0.3)" strokeWidth={1.5} />
                <path d="M 0,45 C 30,40 60,35 80,30 S 120,20 150,25 S 200,15 240,10 L 240,60 L 0,60 Z" fill="rgba(4,47,243,0.05)" />
              </svg>
              {/* Tab bar */}
              <div style={{ display: "flex", gap: 12, marginTop: 4, borderBottom: "1px solid rgba(0,0,0,0.06)", paddingBottom: 6 }}>
                {["Portfolio", "Assets", "Activity"].map((tab, ti) => (
                  <div key={tab} style={{ fontFamily, fontSize: 9, fontWeight: ti === 0 ? 600 : 400, color: ti === 0 ? BLUE : "rgba(0,20,60,0.4)" }}>{tab}</div>
                ))}
              </div>
              {/* Holdings list */}
              {[
                { name: "AAPL", amount: "$24,500", pct: "+2.3%" },
                { name: "TSLA", amount: "$18,200", pct: "-1.1%" },
                { name: "BTC", amount: "$15,800", pct: "+4.5%" },
                { name: "SPY", amount: "$12,400", pct: "+0.8%" },
              ].map((h, hi) => (
                <div key={hi} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0", borderBottom: "0.5px solid rgba(0,0,0,0.04)" }}>
                  <div>
                    <div style={{ fontFamily, fontSize: 10, fontWeight: 600, color: "#0a0a2e" }}>{h.name}</div>
                    <div style={{ fontFamily, fontSize: 8, fontWeight: 400, color: "rgba(0,20,60,0.4)" }}>{h.amount}</div>
                  </div>
                  <div style={{ fontFamily, fontSize: 9, fontWeight: 500, color: h.pct.startsWith("+") ? "#00c853" : "#ff1744" }}>{h.pct}</div>
                </div>
              ))}
              {/* Blue dot indicator */}
              <div style={{ position: "absolute", right: 16, top: "50%", width: 24, height: 24, borderRadius: "50%", background: BLUE, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: "white" }} />
              </div>
            </div>
          )}
        </div>

        {/* Side buttons — matching silver bezel */}
        <div
          style={{
            position: "absolute",
            right: -3,
            top: 130,
            width: 3,
            height: 55,
            background: "#3a4060",
            borderRadius: "0 2px 2px 0",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: -3,
            top: 110,
            width: 3,
            height: 30,
            background: "#3a4060",
            borderRadius: "2px 0 0 2px",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: -3,
            top: 150,
            width: 3,
            height: 55,
            background: "#3a4060",
            borderRadius: "2px 0 0 2px",
          }}
        />
      </div>
    </AbsoluteFill>
  );
};

/**
 * Segment 4: "One place" glass text + blue arrow box → slide → "invest in"
 * Reference: frame_015–018
 * "One" is enormous glass/iridescent text, "place" is bold blue below.
 * Arrow box on the right. Whole white panel slides left to reveal blue "invest in".
 */
const OnePlaceSegment: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // "One" appears with snappy spring — reaches full quickly
  const oneSpring = spring({
    frame,
    fps,
    config: { damping: 14, mass: 0.5, stiffness: 180 },
  });

  // "place" appears slightly after — also snappy
  const placeSpring = spring({
    frame: Math.max(0, frame - Math.round(fps * 0.08)),
    fps,
    config: { damping: 14, mass: 0.5, stiffness: 180 },
  });

  // Blue arrow box
  const arrowSpring = spring({
    frame: Math.max(0, frame - Math.round(fps * 0.25)),
    fps,
    config: { damping: 10, mass: 0.5, stiffness: 120 },
  });

  // Slide the whole white panel left
  const slideStart = Math.round(fps * 1.2);
  const slideProgress = interpolate(frame, [slideStart, slideStart + Math.round(fps * 0.45)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });
  const slideX = slideProgress * -1300;

  // "invest in" text — appears as panel begins sliding, visible through the gap
  const investOpacity = interpolate(frame, [slideStart + Math.round(fps * 0.05), slideStart + Math.round(fps * 0.25)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Exit
  const exitOpacity = interpolate(frame, [fps * 2.2, fps * 2.5], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ opacity: exitOpacity }}>
      {/* Blue background always behind */}
      <AbsoluteFill style={{ background: BLUE }}>
        <div
          style={{
            position: "absolute",
            top: "46%",
            left: "52%",
            transform: "translate(-50%, -50%)",
            opacity: investOpacity,
          }}
        >
          <span
            style={{
              fontFamily,
              fontSize: 52,
              fontWeight: 400,
              color: WHITE,
              letterSpacing: -0.3,
            }}
          >
            invest in
          </span>
        </div>
      </AbsoluteFill>

      {/* White panel with "One place" — slides left */}
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
          {/* "One" — glass/crystal 3D iridescent text matching reference */}
          <div
            style={{
              position: "relative",
              opacity: oneSpring,
              transform: `translateY(${(1 - oneSpring) * 60}px)`,
              filter: "drop-shadow(0 6px 22px rgba(140,120,200,0.12))",
            }}
          >
            {/* SVG-based glass text — proper clipping, no rectangular artifacts */}
            <svg
              viewBox="0 0 580 260"
              style={{ width: 580, height: 260, overflow: "visible" }}
            >
              <defs>
                {/* Glow filter for glass text shadow */}
                <filter id="ribbonGlow">
                  <feGaussianBlur stdDeviation="2.5" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
                {/* Iridescent gradient — animated, strong prismatic colors */}
                <linearGradient id="glassIridescent" x1="0%" y1="0%" x2="100%" y2="100%"
                  gradientTransform={`rotate(${(frame * 0.4) % 360})`}>
                  <stop offset="0%" stopColor="rgba(200,130,240,0.7)" />
                  <stop offset="14%" stopColor="rgba(140,180,255,0.4)" />
                  <stop offset="28%" stopColor="rgba(255,150,200,0.65)" />
                  <stop offset="42%" stopColor="rgba(100,170,255,0.35)" />
                  <stop offset="56%" stopColor="rgba(230,170,255,0.55)" />
                  <stop offset="70%" stopColor="rgba(130,210,250,0.45)" />
                  <stop offset="84%" stopColor="rgba(255,140,190,0.6)" />
                  <stop offset="100%" stopColor="rgba(180,140,255,0.5)" />
                </linearGradient>
                {/* Specular highlight gradient — sharp white bands */}
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
                {/* Glass base fill — visible glass body */}
                <linearGradient id="glassFill" x1="0%" y1="20%" x2="100%" y2="80%">
                  <stop offset="0%" stopColor="rgba(195,190,225,0.38)" />
                  <stop offset="35%" stopColor="rgba(205,200,230,0.28)" />
                  <stop offset="65%" stopColor="rgba(190,195,235,0.32)" />
                  <stop offset="100%" stopColor="rgba(200,195,225,0.35)" />
                </linearGradient>
              </defs>
              {/* Shadow — subtle depth */}
              <text x="4" y="210" fontFamily={fontFamily} fontSize="260" fontWeight="200"
                letterSpacing="-10" fill="rgba(160,150,200,0.08)" filter="url(#ribbonGlow)">
                One
              </text>
              {/* 3D extrusion shadow — gives thickness to the glass */}
              <text x="2" y="212" fontFamily={fontFamily} fontSize="260" fontWeight="200"
                letterSpacing="-10" fill="rgba(170,160,210,0.06)">
                One
              </text>
              <text x="1.5" y="211" fontFamily={fontFamily} fontSize="260" fontWeight="200"
                letterSpacing="-10" fill="rgba(175,165,215,0.05)">
                One
              </text>
              {/* Glass fill — more visible body */}
              <text x="0" y="208" fontFamily={fontFamily} fontSize="260" fontWeight="200"
                letterSpacing="-10" fill="url(#glassFill)">
                One
              </text>
              {/* Iridescent color — strong prismatic */}
              <text x="0" y="208" fontFamily={fontFamily} fontSize="260" fontWeight="200"
                letterSpacing="-10" fill="url(#glassIridescent)">
                One
              </text>
              {/* Specular highlights */}
              <text x="0" y="208" fontFamily={fontFamily} fontSize="260" fontWeight="200"
                letterSpacing="-10" fill="url(#glassSpecular)">
                One
              </text>
              {/* Edge stroke — visible glass boundary */}
              <text x="0" y="208" fontFamily={fontFamily} fontSize="260" fontWeight="200"
                letterSpacing="-10" fill="none" stroke="rgba(170,165,210,0.55)" strokeWidth="1.8">
                One
              </text>
            </svg>
          </div>

          {/* "place" — bold blue, overlapping the glass text slightly */}
          <div
            style={{
              fontFamily,
              fontSize: 160,
              fontWeight: 800,
              lineHeight: 0.85,
              opacity: placeSpring,
              transform: `translateY(${(1 - placeSpring) * 35}px)`,
              color: BLUE,
              marginTop: -40,
              letterSpacing: -5,
              textShadow: "0 2px 15px rgba(4,47,243,0.15)",
            }}
          >
            place
          </div>
        </div>

        {/* Blue arrow box — positioned to the right */}
        <div
          style={{
            width: 110,
            height: 110,
            background: BLUE,
            borderRadius: 16,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            opacity: arrowSpring,
            transform: `scale(${arrowSpring}) translateY(50px)`,
            boxShadow: "0 10px 35px rgba(4,47,243,0.3)",
          }}
        >
          <span style={{ color: WHITE, fontSize: 46, fontWeight: 300 }}>→</span>
        </div>
      </div>
    </AbsoluteFill>
  );
};

/**
 * Segment 5: "everything" grid pattern
 * Reference: frame_019–020
 * Blue background, repeated "everything" in a grid, center one is bold white.
 * Remaining are dimmed blue-ish text.
 */
const EverythingSegment: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const entrySpring = spring({
    frame,
    fps,
    config: { damping: 12, mass: 0.5, stiffness: 120 },
  });

  const COLS = 5;
  const ROWS = 9;
  const centerRow = Math.floor(ROWS / 2);
  const centerCol = Math.floor(COLS / 2);

  // Horizontal scroll — reference shows words drifting left
  const scrollX = interpolate(frame, [0, fps * 1.8], [20, -30], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Center word scale pulse with ongoing subtle breathe
  const centerScaleBase = interpolate(frame, [fps * 0.3, fps * 0.5], [0.9, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.back(1.4)),
  });
  // Subtle ongoing pulse — micro-animation glow
  const centerBreathe = frame > fps * 0.5
    ? Math.sin((frame - fps * 0.5) * 0.18) * 0.02
    : 0;
  const centerScale = centerScaleBase + centerBreathe;

  // Glow intensity pulse for center word
  const glowIntensity = frame > fps * 0.5
    ? 0.15 + Math.sin((frame - fps * 0.5) * 0.22) * 0.08
    : 0.15;

  return (
    <AbsoluteFill
      style={{
        background: BLUE,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      <FilmGrain opacity={0.03} />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${COLS}, 1fr)`,
          gridTemplateRows: `repeat(${ROWS}, 1fr)`,
          width: "115%",
          height: "95%",
          alignItems: "center",
          justifyItems: "center",
          opacity: entrySpring,
          transform: `translateX(${scrollX}px)`,
        }}
      >
        {Array.from({ length: ROWS * COLS }).map((_, i) => {
          const row = Math.floor(i / COLS);
          const col = i % COLS;
          const isCenter = row === centerRow && col === centerCol;
          // Distance from center for radial dimming
          const dist = Math.sqrt(
            Math.pow(row - centerRow, 2) + Math.pow(col - centerCol, 2)
          );
          const dimFactor = Math.max(0.1, 1 - dist * 0.18);

          // Row-based horizontal offset for typographic texture (reference shows staggered rows)
          const rowOffset = isCenter ? 0 : ((row % 3) - 1) * 18;

          return (
            <span
              key={i}
              style={{
                fontFamily,
                fontSize: isCenter ? 42 : 26,
                fontWeight: isCenter ? 800 : 400,
                color: isCenter
                  ? WHITE
                  : `rgba(80,120,255,${0.3 * dimFactor})`,
                letterSpacing: isCenter ? -1 : -0.3,
                whiteSpace: "nowrap",
                transform: isCenter
                  ? `scale(${centerScale})`
                  : `translateX(${rowOffset}px)`,
                textShadow: isCenter ? `0 0 ${20 + glowIntensity * 40}px rgba(255,255,255,${glowIntensity})` : undefined,
              }}
            >
              everything
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

/**
 * Scene 01 — 0.0s to ~10.1s (301 frames at 29fps)
 *
 * Timeline aligned to deep analysis scene changes:
 * Scene 1: 0–2.34s (frames 0–68): "Sometimes investing can feel →"
 * Scene 2: 2.34–3.74s (frames 68–108): "all over the place" + ribbon
 * Scene 3: 3.74–4.2s (frames 108–122): transition to phone
 * Scene 4: 4.2–5.14s (frames 122–149): phone with public.com
 * Scene 5: 5.14–7.01s (frames 149–203): phone isometric grid
 * Scene 6: 7.01–8.41s (frames 203–244): "One place"
 * Scene 7: 8.41–10.28s (frames 244–298): "invest in" → "everything"
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

      {/* Segment 4: "One place" → "invest in" */}
      <Sequence from={195} durationInFrames={60}>
        <OnePlaceSegment />
      </Sequence>

      {/* Segment 5: "everything" grid */}
      <Sequence from={244} durationInFrames={57}>
        <EverythingSegment />
      </Sequence>
    </AbsoluteFill>
  );
};

export const scene01Meta = {
  id: "ReplicateScene01",
  component: Scene01,
  width: 1280,
  height: 720,
  fps: 29,
  durationInFrames: 301,
};
