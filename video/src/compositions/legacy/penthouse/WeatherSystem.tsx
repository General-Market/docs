import React, { useMemo } from "react";
import { interpolate } from "remotion";
import * as THREE from "three";

// ═══════════════════════════════════════════════════════════════════════════
// WEATHER SYSTEM — Day/night cycle, rain, window droplets, lightning
// ═══════════════════════════════════════════════════════════════════════════

// ── Seeded PRNG for deterministic randomness ─────────────────────────────
function seededRandom(seed: number): () => number {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── Weather state helper ─────────────────────────────────────────────────
// timeOfDay: 0 = late afternoon, 0.25 = sunset, 0.5 = dusk, 0.75 = night, 1.0 = deep night w/ rain
// rainIntensity: 0-1 scale
// isLightning: true during flash frames

export function getWeatherState(frame: number): {
  timeOfDay: number;
  rainIntensity: number;
  isLightning: boolean;
} {
  const timeOfDay = Math.min(1, frame / 600);

  // Rain starts building at frame 400, full at 600
  const rainIntensity = interpolate(frame, [400, 450, 600], [0, 0.3, 1.0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Lightning flashes — two bursts
  // Flash 1: frames 500-503
  // Flash 2: frames 540-543
  const isLightning =
    (frame >= 500 && frame <= 503) || (frame >= 540 && frame <= 543);

  return { timeOfDay, rainIntensity, isLightning };
}

// ── Color utility ────────────────────────────────────────────────────────
function lerpColor3(
  c1: THREE.Color,
  c2: THREE.Color,
  t: number,
): THREE.Color {
  const clamped = Math.max(0, Math.min(1, t));
  return new THREE.Color().lerpColors(c1, c2, clamped);
}

// ── Ambient Light Controller ─────────────────────────────────────────────
// Manages ambient, directional, and fog transitions across the day/night cycle

const AMBIENT_COLORS = {
  goldenHour: new THREE.Color("#e0c0a0"),  // bright warm daylight
  sunset: new THREE.Color("#804828"),
  dusk: new THREE.Color("#0a0a18"),
  night: new THREE.Color("#060610"),
};

const DIRECTIONAL_COLORS = {
  goldenHour: new THREE.Color("#ffe8c0"),  // bright warm sun
  sunset: new THREE.Color("#ff8040"),
  dusk: new THREE.Color("#304080"),
  night: new THREE.Color("#182040"),
};

const FOG_COLORS = {
  goldenHour: new THREE.Color("#c09870"),  // warm haze, not dark brown
  sunset: new THREE.Color("#402818"),
  dusk: new THREE.Color("#060608"),
  night: new THREE.Color("#030305"),
};

const AmbientLightController: React.FC<{ frame: number }> = ({ frame }) => {
  const { timeOfDay, isLightning } = getWeatherState(frame);

  // Ambient light: transition through phases
  const ambientColor = useMemo(() => {
    if (timeOfDay < 0.25) {
      return lerpColor3(
        AMBIENT_COLORS.goldenHour,
        AMBIENT_COLORS.sunset,
        timeOfDay / 0.25,
      );
    } else if (timeOfDay < 0.5) {
      return lerpColor3(
        AMBIENT_COLORS.sunset,
        AMBIENT_COLORS.dusk,
        (timeOfDay - 0.25) / 0.25,
      );
    } else {
      return lerpColor3(
        AMBIENT_COLORS.dusk,
        AMBIENT_COLORS.night,
        (timeOfDay - 0.5) / 0.5,
      );
    }
  }, [timeOfDay]);

  const ambientIntensity = interpolate(
    timeOfDay,
    [0, 0.25, 0.5, 0.75, 1.0],
    [1.8, 0.9, 0.35, 0.2, 0.15],
    { extrapolateRight: "clamp" },
  );

  // Directional light (sun position): moves from upper-left to horizon
  const dirColor = useMemo(() => {
    if (timeOfDay < 0.25) {
      return lerpColor3(
        DIRECTIONAL_COLORS.goldenHour,
        DIRECTIONAL_COLORS.sunset,
        timeOfDay / 0.25,
      );
    } else if (timeOfDay < 0.5) {
      return lerpColor3(
        DIRECTIONAL_COLORS.sunset,
        DIRECTIONAL_COLORS.dusk,
        (timeOfDay - 0.25) / 0.25,
      );
    } else {
      return lerpColor3(
        DIRECTIONAL_COLORS.dusk,
        DIRECTIONAL_COLORS.night,
        (timeOfDay - 0.5) / 0.5,
      );
    }
  }, [timeOfDay]);

  const dirIntensity = interpolate(
    timeOfDay,
    [0, 0.25, 0.5, 0.75, 1.0],
    [1.5, 0.6, 0.1, 0.04, 0.02],
    { extrapolateRight: "clamp" },
  );

  // Sun position drops toward horizon over time
  const sunY = interpolate(timeOfDay, [0, 0.5, 1], [4, 1.5, 0.5], {
    extrapolateRight: "clamp",
  });
  const sunX = interpolate(timeOfDay, [0, 1], [-2, -3], {
    extrapolateRight: "clamp",
  });

  // Fog transitions
  const fogColor = useMemo(() => {
    if (timeOfDay < 0.25) {
      return lerpColor3(
        FOG_COLORS.goldenHour,
        FOG_COLORS.sunset,
        timeOfDay / 0.25,
      );
    } else if (timeOfDay < 0.5) {
      return lerpColor3(
        FOG_COLORS.sunset,
        FOG_COLORS.dusk,
        (timeOfDay - 0.25) / 0.25,
      );
    } else {
      return lerpColor3(
        FOG_COLORS.dusk,
        FOG_COLORS.night,
        (timeOfDay - 0.5) / 0.5,
      );
    }
  }, [timeOfDay]);

  // Lightning: spike ambient to bright white
  const lightningIntensity = isLightning ? 2.5 : 0;
  const lightningColor = new THREE.Color("#c0c8ff");

  return (
    <>
      <ambientLight color={ambientColor} intensity={ambientIntensity} />
      <directionalLight
        position={[sunX, sunY, 1]}
        intensity={dirIntensity}
        color={dirColor}
      />
      <fog attach="fog" args={[fogColor, 20, 40]} />

      {/* Lightning flash light */}
      {isLightning && (
        <ambientLight
          color={lightningColor}
          intensity={lightningIntensity}
        />
      )}
    </>
  );
};

// ── Rain Particle System ─────────────────────────────────────────────────
// THREE.Points with BufferGeometry — positioned behind windows (z ~ -2.7 to -4.0)

const RAIN_MAX_PARTICLES = 400;

// Spatial bounds for rain — behind window plane, spanning the window width
const RAIN_X_MIN = -3.5;
const RAIN_X_MAX = 3.5;
const RAIN_Y_MIN = -0.5; // below floor to avoid pop-in at bottom
const RAIN_Y_MAX = 5.0; // well above ceiling
const RAIN_Z_MIN = -4.0;
const RAIN_Z_MAX = -2.75; // right up to the window plane

// Wind angle: rain falls at a slight angle
const RAIN_WIND_X = 0.008; // horizontal drift per frame
const RAIN_FALL_SPEED = 0.12; // vertical fall per frame

const RainSystem: React.FC<{ frame: number }> = ({ frame }) => {
  const { rainIntensity } = getWeatherState(frame);

  // Create geometry and initial positions once
  const { geometry, initialPositions, velocities } = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(RAIN_MAX_PARTICLES * 3);
    const vels = new Float32Array(RAIN_MAX_PARTICLES); // per-particle speed variation
    const rng = seededRandom(314159);

    for (let i = 0; i < RAIN_MAX_PARTICLES; i++) {
      positions[i * 3] = RAIN_X_MIN + rng() * (RAIN_X_MAX - RAIN_X_MIN);
      positions[i * 3 + 1] = RAIN_Y_MIN + rng() * (RAIN_Y_MAX - RAIN_Y_MIN);
      positions[i * 3 + 2] = RAIN_Z_MIN + rng() * (RAIN_Z_MAX - RAIN_Z_MIN);
      vels[i] = 0.8 + rng() * 0.4; // speed multiplier 0.8 - 1.2
    }

    geo.setAttribute("position", new THREE.BufferAttribute(positions.slice(), 3));

    return { geometry: geo, initialPositions: positions, velocities: vels };
  }, []);

  // Update particle positions each frame
  const posAttr = geometry.attributes.position as THREE.BufferAttribute;
  const activeCount = Math.floor(RAIN_MAX_PARTICLES * rainIntensity);

  for (let i = 0; i < RAIN_MAX_PARTICLES; i++) {
    if (i >= activeCount) {
      // Hide inactive particles far away
      posAttr.setXYZ(i, 0, -100, 0);
      continue;
    }

    // Start from initial seed position and simulate forward
    let x = initialPositions[i * 3];
    let y = initialPositions[i * 3 + 1];
    const z = initialPositions[i * 3 + 2];
    const speed = velocities[i];

    // Advance position based on frame (deterministic per-particle animation)
    const totalFall = frame * RAIN_FALL_SPEED * speed;
    const totalDrift = frame * RAIN_WIND_X * speed;
    const range = RAIN_Y_MAX - RAIN_Y_MIN;

    y = y - totalFall;
    x = x + totalDrift;

    // Wrap vertically (particle recycling)
    y = RAIN_Y_MIN + ((((y - RAIN_Y_MIN) % range) + range) % range);
    // Wrap horizontally
    const xRange = RAIN_X_MAX - RAIN_X_MIN;
    x = RAIN_X_MIN + ((((x - RAIN_X_MIN) % xRange) + xRange) % xRange);

    posAttr.setXYZ(i, x, y, z);
  }
  posAttr.needsUpdate = true;

  // Rain material — thin white/light-blue streaks
  // We use a small point size with additive blending for streak effect
  const rainMaterial = useMemo(() => {
    return new THREE.PointsMaterial({
      color: new THREE.Color("#b0c8ff"),
      size: 0.025,
      transparent: true,
      opacity: 0.5,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    });
  }, []);

  // Fade rain opacity with intensity
  rainMaterial.opacity = interpolate(rainIntensity, [0, 0.3, 1], [0, 0.25, 0.55], {
    extrapolateRight: "clamp",
  });

  if (rainIntensity <= 0) return null;

  return <points geometry={geometry} material={rainMaterial} />;
};

// ── Rain Streak Lines ────────────────────────────────────────────────────
// Additional line-based rain for more visible streaks

const STREAK_COUNT = 100;

const RainStreaks: React.FC<{ frame: number }> = ({ frame }) => {
  const { rainIntensity } = getWeatherState(frame);

  const { geometry, seeds } = useMemo(() => {
    const positions = new Float32Array(STREAK_COUNT * 6); // 2 vertices per line
    const rng = seededRandom(271828);
    const seedData: Array<{
      x: number;
      y: number;
      z: number;
      speed: number;
      len: number;
    }> = [];

    for (let i = 0; i < STREAK_COUNT; i++) {
      const s = {
        x: RAIN_X_MIN + rng() * (RAIN_X_MAX - RAIN_X_MIN),
        y: RAIN_Y_MIN + rng() * (RAIN_Y_MAX - RAIN_Y_MIN),
        z: RAIN_Z_MIN + rng() * (RAIN_Z_MAX - RAIN_Z_MIN),
        speed: 0.7 + rng() * 0.6,
        len: 0.08 + rng() * 0.15, // streak length
      };
      seedData.push(s);

      // Initialize with placeholder
      positions[i * 6] = 0;
      positions[i * 6 + 1] = 0;
      positions[i * 6 + 2] = 0;
      positions[i * 6 + 3] = 0;
      positions[i * 6 + 4] = 0;
      positions[i * 6 + 5] = 0;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));

    return { geometry: geo, seeds: seedData };
  }, []);

  const activeStreaks = Math.floor(STREAK_COUNT * rainIntensity);
  const posAttr = geometry.attributes.position as THREE.BufferAttribute;

  for (let i = 0; i < STREAK_COUNT; i++) {
    if (i >= activeStreaks) {
      posAttr.setXYZ(i * 2, 0, -100, 0);
      posAttr.setXYZ(i * 2 + 1, 0, -100, 0);
      continue;
    }

    const s = seeds[i];
    const totalFall = frame * RAIN_FALL_SPEED * s.speed * 1.2;
    const totalDrift = frame * RAIN_WIND_X * s.speed;
    const range = RAIN_Y_MAX - RAIN_Y_MIN;

    let y = s.y - totalFall;
    let x = s.x + totalDrift;

    y = RAIN_Y_MIN + ((((y - RAIN_Y_MIN) % range) + range) % range);
    const xRange = RAIN_X_MAX - RAIN_X_MIN;
    x = RAIN_X_MIN + ((((x - RAIN_X_MIN) % xRange) + xRange) % xRange);

    // Top of streak
    posAttr.setXYZ(i * 2, x, y + s.len, s.z);
    // Bottom of streak (offset by wind angle and length)
    posAttr.setXYZ(i * 2 + 1, x - RAIN_WIND_X * 4, y, s.z);
  }
  posAttr.needsUpdate = true;

  const material = useMemo(() => {
    return new THREE.LineBasicMaterial({
      color: new THREE.Color("#a0b8e0"),
      transparent: true,
      opacity: 0.3,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
  }, []);

  material.opacity = interpolate(rainIntensity, [0, 0.3, 1], [0, 0.15, 0.35], {
    extrapolateRight: "clamp",
  });

  if (rainIntensity <= 0) return null;

  return <lineSegments geometry={geometry} material={material} />;
};

// ── Window Rain Droplets ─────────────────────────────────────────────────
// Small semi-transparent spheres on the window plane that drip down

const DROPLET_COUNT = 25;

interface DropletSeed {
  x: number;
  startY: number;
  z: number;
  size: number;
  dripSpeed: number;
  spawnFrame: number; // frame when this droplet appears
  dripLength: number; // how far it drips before resetting
}

const WindowDroplets: React.FC<{ frame: number }> = ({ frame }) => {
  const { rainIntensity } = getWeatherState(frame);

  const dropletSeeds = useMemo<DropletSeed[]>(() => {
    const rng = seededRandom(161803);
    const seeds: DropletSeed[] = [];

    for (let i = 0; i < DROPLET_COUNT; i++) {
      seeds.push({
        x: -3.2 + rng() * 6.4, // across window width
        startY: 0.3 + rng() * 3.4, // window height range
        z: -2.73, // on the window glass, just in front of frame
        size: 0.008 + rng() * 0.012, // small droplets
        dripSpeed: 0.003 + rng() * 0.006, // slow drip
        spawnFrame: 400 + Math.floor(rng() * 180), // stagger appearance
        dripLength: 0.3 + rng() * 0.8, // how far before reset
      });
    }
    return seeds;
  }, []);

  // Shared geometry
  const sphereGeo = useMemo(() => {
    return new THREE.SphereGeometry(1, 8, 6);
  }, []);

  if (rainIntensity <= 0) return null;

  const activeDroplets = Math.floor(
    DROPLET_COUNT * Math.min(1, rainIntensity * 1.5),
  );

  return (
    <group>
      {dropletSeeds.slice(0, activeDroplets).map((d, i) => {
        if (frame < d.spawnFrame) return null;

        const elapsed = frame - d.spawnFrame;
        const dripOffset = (elapsed * d.dripSpeed) % d.dripLength;
        const y = d.startY - dripOffset;

        // Skip if below window sill
        if (y < 0.15) return null;

        // Droplet opacity fades as it drips
        const dripProgress = dripOffset / d.dripLength;
        const dropOpacity = interpolate(dripProgress, [0, 0.7, 1.0], [0.4, 0.3, 0.0], {
          extrapolateRight: "clamp",
        }) * rainIntensity;

        // Elongate droplet vertically as it drips (teardrop effect)
        const scaleY = 1.0 + dripProgress * 1.5;
        const scaleX = 1.0 - dripProgress * 0.2;

        return (
          <mesh
            key={i}
            geometry={sphereGeo}
            position={[d.x, y, d.z]}
            scale={[d.size * scaleX, d.size * scaleY, d.size * 0.5]}
          >
            <meshStandardMaterial
              color="#8ab4e8"
              transparent
              opacity={dropOpacity}
              roughness={0.05}
              metalness={0.8}
              envMapIntensity={1.5}
            />
          </mesh>
        );
      })}

      {/* Drip trails — faint vertical lines below dripping droplets */}
      {dropletSeeds.slice(0, Math.floor(activeDroplets * 0.3)).map((d, i) => {
        if (frame < d.spawnFrame + 30) return null;

        const elapsed = frame - d.spawnFrame;
        const dripOffset = (elapsed * d.dripSpeed) % d.dripLength;
        const y = d.startY - dripOffset;
        if (y < 0.3) return null;

        const trailLen = Math.min(0.15, dripOffset * 0.3);

        return (
          <mesh
            key={`trail-${i}`}
            position={[d.x, y + trailLen * 0.5, d.z - 0.001]}
          >
            <planeGeometry args={[0.002, trailLen]} />
            <meshBasicMaterial
              color="#8ab4e8"
              transparent
              opacity={0.12 * rainIntensity}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </mesh>
        );
      })}
    </group>
  );
};

// ── Lightning Flash ──────────────────────────────────────────────────────
// Brief flashes at specific frames — bright directional light + ambient spike

const LightningFlash: React.FC<{ frame: number }> = ({ frame }) => {
  const { isLightning } = getWeatherState(frame);

  if (!isLightning) return null;

  // Intensity varies within the flash for realism
  // Frame pattern: bright -> brighter -> dim -> off
  const flash1Progress = frame >= 500 && frame <= 503 ? frame - 500 : -1;
  const flash2Progress = frame >= 540 && frame <= 543 ? frame - 540 : -1;
  const flashProgress = flash1Progress >= 0 ? flash1Progress : flash2Progress;

  const intensityPattern = [1.8, 2.5, 1.0, 0.3];
  const intensity = flashProgress >= 0 ? intensityPattern[flashProgress] : 0;

  return (
    <>
      {/* Directional flash from behind skyline */}
      <directionalLight
        position={[1, 5, -5]}
        intensity={intensity * 1.5}
        color="#d0d8ff"
      />
      {/* Fill flash on the room */}
      <pointLight
        position={[0, 3, -2]}
        intensity={intensity * 2}
        color="#c0c8ff"
        distance={10}
        decay={1}
      />
    </>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// MAIN WEATHER SYSTEM COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export const WeatherSystem: React.FC<{ frame: number }> = ({ frame }) => {
  return (
    <>
      <AmbientLightController frame={frame} />
      <RainSystem frame={frame} />
      <RainStreaks frame={frame} />
      <WindowDroplets frame={frame} />
      <LightningFlash frame={frame} />
    </>
  );
};
