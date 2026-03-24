import React, { useMemo } from "react";
import { interpolate } from "remotion";
import * as THREE from "three";

// ── Reflective Floor ─────────────────────────────────────────────────────────
// A large floor plane with environment map reflections.
// Uses a gradient approach: highly reflective near the desk area, fading
// to matte further away. Implemented via two overlapping planes.

export const ReflectiveFloor: React.FC = () => {
  // Shader material for gradient reflectivity: reflective near center (z ~ -0.5),
  // fading to matte at edges. We achieve this with two layers:
  // 1. A matte base floor
  // 2. A reflective overlay that fades out via alpha based on distance from desk

  const gradientMaterial = useMemo(() => {
    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color("#0a0a10"),
      metalness: 0.6,
      roughness: 0.12,
      transparent: true,
      opacity: 1.0,
      envMapIntensity: 1.2,
    });

    // Custom onBeforeCompile to add distance-based alpha fade
    mat.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <output_fragment>",
        `
        // Fade reflectivity based on distance from desk center (world space)
        // vWorldPosition is available via worldpos_vertex
        float distFromCenter = length(vWorldPosition.xz - vec2(0.0, -0.15));
        float reflectFade = 1.0 - smoothstep(1.2, 3.5, distFromCenter);
        // Mix metalness down at edges by reducing specular contribution via alpha
        gl_FragColor.rgb = mix(
          vec3(0.02, 0.02, 0.04), // matte dark floor color at edges
          gl_FragColor.rgb,
          reflectFade
        );
        #include <output_fragment>
        `
          .replace("#include <output_fragment>", "")
      );
    };

    return mat;
  }, []);

  return (
    <group>
      {/* Base matte floor — always visible underneath */}
      <mesh position={[0, -0.002, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[12, 12]} />
        <meshStandardMaterial
          color="#060608"
          roughness={0.9}
          metalness={0.02}
        />
      </mesh>

      {/* Reflective overlay — concentrated near the desk area */}
      <mesh position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[12, 12]} />
        <primitive object={gradientMaterial} attach="material" />
      </mesh>

      {/* Near-desk high-gloss accent strip — directly under and in front of desk */}
      <mesh position={[0, 0.001, 0.1]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[3.2, 1.8]} />
        <meshStandardMaterial
          color="#0a0a12"
          metalness={0.7}
          roughness={0.08}
          transparent
          opacity={0.6}
          envMapIntensity={1.5}
        />
      </mesh>
    </group>
  );
};

// ── Scene Lighting ───────────────────────────────────────────────────────────
// Improved lighting rig that responds to timeOfDay (0 = afternoon, 1 = night).
// Includes ambient, city glow key light, monitor glow spots, and rim light.

interface SceneLightingProps {
  frame: number;
  timeOfDay: number;
}

export const SceneLighting: React.FC<SceneLightingProps> = ({
  frame,
  timeOfDay,
}) => {
  // Ambient shifts from warm golden (afternoon) to cool blue (night)
  const ambientColor = useMemo(() => {
    const warm = new THREE.Color("#1a1510"); // warm golden ambient
    const cool = new THREE.Color("#080a18"); // cool blue night ambient
    return warm.clone().lerp(cool, timeOfDay);
  }, [timeOfDay]);

  const ambientIntensity = interpolate(timeOfDay, [0, 1], [0.7, 0.35], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
  });

  // City glow key light — simulates warm light bouncing from cityscape through windows
  const cityGlowIntensity = interpolate(timeOfDay, [0, 0.5, 1], [0.3, 0.5, 0.6], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
  });
  const cityGlowColor = useMemo(() => {
    const afternoon = new THREE.Color("#FFD090");
    const night = new THREE.Color("#FFA860");
    return afternoon.clone().lerp(night, timeOfDay);
  }, [timeOfDay]);

  // Monitor glow lights — colored spots pointing down at the desk from each monitor
  // Positions and colors from the MONITORS array in PenthouseScene
  const monitorGlows = useMemo(
    () => [
      {
        pos: [-1.08, 1.0, -0.2] as [number, number, number],
        color: "#FFD700",
        label: "terminal",
      },
      {
        pos: [-0.52, 1.0, -0.35] as [number, number, number],
        color: "#3B82F6",
        label: "candle1",
      },
      {
        pos: [0, 1.0, -0.4] as [number, number, number],
        color: "#8B5CF6",
        label: "candle2",
      },
      {
        pos: [0.52, 1.0, -0.35] as [number, number, number],
        color: "#00e676",
        label: "orderbook",
      },
      {
        pos: [1.08, 1.0, -0.2] as [number, number, number],
        color: "#22D3EE",
        label: "candle3",
      },
    ],
    []
  );

  // Monitor glow intensity pulses subtly per monitor
  const monitorGlowBase = interpolate(timeOfDay, [0, 1], [0.15, 0.3], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
  });

  // Rim light — backlight from city behind, subtle edge definition
  const rimIntensity = interpolate(timeOfDay, [0, 1], [0.08, 0.15], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
  });

  // Fill light from above — very subtle overhead
  const fillIntensity = interpolate(timeOfDay, [0, 1], [0.04, 0.02], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
  });

  return (
    <group>
      {/* Ambient light — warm to cool shift */}
      <ambientLight color={ambientColor} intensity={ambientIntensity} />

      {/* City glow key light — from the window direction */}
      <pointLight
        position={[0, 1.5, -2.2]}
        color={cityGlowColor}
        intensity={cityGlowIntensity}
        distance={6}
        decay={2}
      />
      {/* Secondary city glow — flanking windows */}
      <pointLight
        position={[-2.0, 1.2, -2.0]}
        color="#FFC070"
        intensity={cityGlowIntensity * 0.4}
        distance={4}
        decay={2}
      />
      <pointLight
        position={[2.0, 1.2, -2.0]}
        color="#FFC070"
        intensity={cityGlowIntensity * 0.4}
        distance={4}
        decay={2}
      />

      {/* Monitor glow spots — colored light pools on the desk */}
      {monitorGlows.map((glow, i) => {
        const pulse =
          monitorGlowBase +
          Math.sin(frame * 0.04 + i * 1.5) * 0.04;
        return (
          <spotLight
            key={glow.label}
            position={glow.pos}
            target-position={[glow.pos[0], 0.74, glow.pos[2] + 0.3]}
            color={glow.color}
            intensity={pulse}
            distance={1.5}
            decay={2}
            angle={Math.PI / 4}
            penumbra={0.8}
          />
        );
      })}

      {/* Rim light — backlit silhouette from city glow behind the scene */}
      <directionalLight
        position={[0, 2.5, -3]}
        intensity={rimIntensity}
        color="#4060a0"
      />

      {/* Very subtle overhead fill — prevents pure black on top surfaces */}
      <directionalLight
        position={[0, 4, 0]}
        intensity={fillIntensity}
        color="#303050"
      />

      {/* Floor bounce light — faint warm glow bouncing off reflective floor */}
      <pointLight
        position={[0, 0.05, 0.5]}
        color="#1a1510"
        intensity={0.05}
        distance={3}
        decay={2}
      />
    </group>
  );
};

// ── Desk Reflection ──────────────────────────────────────────────────────────
// A subtle semi-transparent plane just above the desk surface that creates
// a dark mirror-like reflection effect for the monitors above it.

export const DeskReflection: React.FC = () => {
  return (
    <group>
      {/* Main desk reflection surface — slightly above desk at y=0.76 */}
      <mesh position={[0, 0.761, -1.1]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[3.2, 1.3]} />
        <meshStandardMaterial
          color="#0c0c14"
          metalness={0.85}
          roughness={0.05}
          transparent
          opacity={0.35}
          envMapIntensity={2.0}
          depthWrite={false}
        />
      </mesh>

      {/* Narrow high-gloss strip directly under monitors — catches the most light */}
      <mesh position={[0, 0.762, -1.4]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[2.8, 0.4]} />
        <meshStandardMaterial
          color="#0a0a12"
          metalness={0.9}
          roughness={0.02}
          transparent
          opacity={0.25}
          envMapIntensity={2.5}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
};

// ── Room Upgraded ────────────────────────────────────────────────────────────
// Better room enclosure with:
// - Very dark, barely visible ceiling
// - Side walls with subtle depth and slight color variation
// - Floor-to-ceiling feel matching the penthouse reference
// - Back wall behind the skyline (not visible, but closes the space)

export const RoomUpgraded: React.FC = () => {
  return (
    <group>
      {/* Floor — handled by ReflectiveFloor, but we add a safety base */}
      <mesh position={[0, -0.005, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[10, 10]} />
        <meshStandardMaterial color="#050508" roughness={0.95} metalness={0.0} />
      </mesh>

      {/* Ceiling — very dark, barely perceptible */}
      <mesh position={[0, 3.5, -1]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[10, 10]} />
        <meshStandardMaterial
          color="#030305"
          roughness={0.95}
          metalness={0.0}
        />
      </mesh>

      {/* Left wall — subtle depth with slight gradient feel via two overlapping planes */}
      <mesh position={[-3.8, 1.75, -1]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[8, 3.8]} />
        <meshStandardMaterial
          color="#070710"
          roughness={0.85}
          metalness={0.05}
        />
      </mesh>
      {/* Left wall — lower portion slightly different tone for depth */}
      <mesh position={[-3.79, 0.5, -1]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[8, 1.2]} />
        <meshStandardMaterial
          color="#060609"
          roughness={0.9}
          metalness={0.02}
          transparent
          opacity={0.7}
        />
      </mesh>

      {/* Right wall — mirrors left wall */}
      <mesh position={[3.8, 1.75, -1]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[8, 3.8]} />
        <meshStandardMaterial
          color="#070710"
          roughness={0.85}
          metalness={0.05}
        />
      </mesh>
      {/* Right wall — lower portion */}
      <mesh position={[3.79, 0.5, -1]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[8, 1.2]} />
        <meshStandardMaterial
          color="#060609"
          roughness={0.9}
          metalness={0.02}
          transparent
          opacity={0.7}
        />
      </mesh>

      {/* Back wall removed — was blocking the sky dome and buildings behind windows.
          SkyDome provides visual enclosure from behind. */}

      {/* Floor-to-wall edge strips — thin dark baseboards for grounding */}
      {/* Left baseboard */}
      <mesh position={[-3.78, 0.03, -1]}>
        <boxGeometry args={[0.02, 0.06, 8]} />
        <meshStandardMaterial color="#0a0a12" roughness={0.4} metalness={0.3} />
      </mesh>
      {/* Right baseboard */}
      <mesh position={[3.78, 0.03, -1]}>
        <boxGeometry args={[0.02, 0.06, 8]} />
        <meshStandardMaterial color="#0a0a12" roughness={0.4} metalness={0.3} />
      </mesh>

      {/* Ceiling edge — very subtle dark trim where walls meet ceiling */}
      <mesh position={[0, 3.48, -1]}>
        <boxGeometry args={[7.6, 0.03, 0.03]} />
        <meshStandardMaterial color="#08080c" roughness={0.5} metalness={0.2} />
      </mesh>
    </group>
  );
};
