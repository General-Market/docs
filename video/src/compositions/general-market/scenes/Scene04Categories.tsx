import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Easing,
} from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { loadFont } from "@remotion/google-fonts/SpaceMono";
import * as THREE from "three";
import { THEME, CATEGORIES } from "../theme";
import { GMGrid } from "../components/GMGrid";

const { fontFamily } = loadFont();

// Lights mirror the ParticleWave reference scene so the hex prisms render with
// the same physically-based highlights instead of looking flat.
const SceneLights: React.FC = () => (
  <>
    <pointLight
      color={0xffffff}
      intensity={8}
      decay={0}
      position={[0, 0, 5]}
    />
    <pointLight
      color={0xff0000}
      intensity={3}
      decay={0}
      position={[0, 0, -20]}
    />
    <ambientLight intensity={0.3} />
  </>
);

export const Scene04Categories: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  // Title spring entry from frame 5
  const titleSpring = spring({
    frame: frame - 5,
    fps,
    config: { damping: 18, stiffness: 160, mass: 0.6 },
    durationInFrames: 20,
  });
  const titleY = interpolate(titleSpring, [0, 1], [-30, 0]);
  const titleOpacity = interpolate(titleSpring, [0, 1], [0, 1]);

  // Subtitle entry, slightly delayed
  const subtitleSpring = spring({
    frame: frame - 12,
    fps,
    config: { damping: 18, stiffness: 160, mass: 0.6 },
    durationInFrames: 20,
  });
  const subtitleY = interpolate(subtitleSpring, [0, 1], [-20, 0]);
  const subtitleOpacity = interpolate(subtitleSpring, [0, 1], [0, 1]);

  // Accent fades in late
  const accentOpacity = interpolate(frame, [110, 130], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  // Cycle category index 0..13 across the body of the scene
  const categoryIndex = Math.floor(
    interpolate(frame, [20, 130], [0, CATEGORIES.length - 0.01], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }),
  );

  const categoryHue = (categoryIndex * 360) / 14;
  const categoryColor = `hsl(${Math.round(categoryHue)}, 70%, 55%)`;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: THEME.bgDark,
        color: THEME.textLight,
        fontFamily,
      }}
    >
      {/* Three.js layer — both grids share one canvas */}
      <AbsoluteFill>
        <ThreeCanvas
          width={width}
          height={height}
          camera={{ position: [0, 0, 100], fov: 50 }}
          gl={{
            antialias: true,
            alpha: true,
            powerPreference: "high-performance",
            toneMapping: THREE.NoToneMapping,
          }}
          shadows
          style={{ width: "100%", height: "100%" }}
        >
          <SceneLights />
          {/* LEFT — sparse grid representing the rivals' tiny menu */}
          <GMGrid
            cols={10}
            rows={8}
            fillRatio={0.3}
            activeColor={THEME.muted}
            inactiveColor={THEME.divider}
            pulseFreq={0}
            pulseAmplitude={0.2}
            position={[-35, 0, 0]}
            seed={1}
          />
          {/* RIGHT — full grid sweeping through every category */}
          <GMGrid
            cols={40}
            rows={30}
            fillRatio={1.0}
            activeColor={THEME.gmGreen}
            inactiveColor={THEME.divider}
            pulseFreq={0.6}
            pulseAmplitude={0.25}
            categoryIndex={categoryIndex}
            position={[35, 0, 0]}
            seed={2}
          />
        </ThreeCanvas>
      </AbsoluteFill>

      {/* Title */}
      <div
        style={{
          position: "absolute",
          top: 80,
          left: 0,
          width: "100%",
          textAlign: "center",
          transform: `translateY(${titleY}px)`,
          opacity: titleOpacity,
        }}
      >
        <div
          style={{
            fontSize: 72,
            fontWeight: 700,
            color: THEME.textLight,
            letterSpacing: -1,
            lineHeight: 1.1,
          }}
        >
          Most venues can&apos;t list these.
        </div>
      </div>

      {/* Subtitle */}
      <div
        style={{
          position: "absolute",
          top: 180,
          left: 0,
          width: "100%",
          textAlign: "center",
          transform: `translateY(${subtitleY}px)`,
          opacity: subtitleOpacity,
        }}
      >
        <div
          style={{
            fontSize: 32,
            fontWeight: 400,
            color: THEME.muted,
            letterSpacing: 2,
            textTransform: "uppercase",
          }}
        >
          Insiders would devour them.
        </div>
      </div>

      {/* Floating category label beneath the right grid */}
      <div
        style={{
          position: "absolute",
          bottom: 160,
          left: "50%",
          width: "50%",
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontSize: 40,
            fontWeight: 700,
            color: categoryColor,
            textTransform: "uppercase",
            letterSpacing: 6,
            textShadow: "0 0 20px rgba(0,0,0,0.6)",
          }}
        >
          {CATEGORIES[categoryIndex]}
        </div>
      </div>

      {/* Accent strapline */}
      <div
        style={{
          position: "absolute",
          bottom: 60,
          left: 0,
          width: "100%",
          textAlign: "center",
          opacity: accentOpacity,
        }}
      >
        <div
          style={{
            fontSize: 20,
            fontWeight: 400,
            color: THEME.muted,
            letterSpacing: 3,
            textTransform: "uppercase",
          }}
        >
          Because it&apos;s batched parimutuel.
        </div>
      </div>
    </AbsoluteFill>
  );
};
