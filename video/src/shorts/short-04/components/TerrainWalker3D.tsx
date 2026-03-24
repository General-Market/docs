// TerrainWalker3D — Combines dynamic terrain deformation + floating props (spotify visualiser)
// Character walks forward automatically, camera tracks from front facing them,
// terrain deforms under feet, floating rectangular props with album cover textures.

import React, { useMemo, useRef, useEffect, useCallback, Suspense } from "react";
import {
  useCurrentFrame,
  useVideoConfig,
  AbsoluteFill,
  staticFile,
} from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import { useGLTF, useAnimations, useTexture } from "@react-three/drei";
import * as THREE from "three";

import { CRYPTO_ICON_FILENAMES } from "../cryptoIcons";

// ---------------------------------------------------------------------------
// Constants — terrain (EXACT from dynamic-terrain-deformation)
// ---------------------------------------------------------------------------
const CHUNK_SIZE = 50;
const CHUNKS_PER_SIDE = 1; // 3x3 grid
const GRID_RESOLUTION = 64;
const CHARACTER_SPEED = 12; // matches walk animation
const CHUNK_OVERLAP = 0.5;
const DEFORM_RADIUS = 2.5;
const WAVE_AMPLITUDE = 0.005;
const WAVE_FREQUENCY = 4;

// Animation names (exact from original explorer.glb)
const WALK_ANIMATION = "Armature|mixamo.com|Layer0";
const IDLE_ANIMATION = "Armature.001|mixamo.com|Layer0";

// ---------------------------------------------------------------------------
// Constants — floating props (from spotify-visualiser)
// ---------------------------------------------------------------------------
const PROP_COUNT = 3500;
const ICON_COUNT = CRYPTO_ICON_FILENAMES.length; // 700 unique crypto logos

// Seeded RNG for deterministic positioning
function mulberry32(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// Floating props vertex shader (adapted from spotify-visualiser)
// Now with texture atlas UV coordinates per instance
// ---------------------------------------------------------------------------
const PROP_VERTEX = /* glsl */ `
  attribute vec3 aInitialPosition;
  attribute float aMeshSpeed;
  attribute vec4 aTextureCoords;

  uniform float uTime;
  uniform float uCharZ;
  uniform vec3 uCharPos;
  uniform float uWindStrength;
  uniform float uFogDensity;

  varying float vVisibility;
  varying vec4 vTextureCoords;
  varying vec2 vUv;
  varying float vPopFactor;

  void main() {
    vUv = uv;
    vTextureCoords = aTextureCoords;

    // Phase 1 — Wrap z around character [-100, 100] — no looping in 12s at 12u/s
    vec3 center = aInitialPosition;
    float zOffset = uTime * aMeshSpeed * 2.0;
    float relZ = mod(center.z - zOffset - uCharZ + 100.0, 200.0) - 100.0;

    // Per-icon seed for unique behavior
    float iconSeed = aInitialPosition.x * 7.3 + aInitialPosition.y * 13.1 + aInitialPosition.z * 3.7;
    float iconRand1 = fract(iconSeed * 0.37);
    float iconRand2 = fract(iconSeed * 0.73);
    float iconRand3 = fract(iconSeed * 0.51);

    // Gentle ambient drift (always on, varies per icon)
    center.x += sin(uTime * (0.3 + iconRand1 * 0.3) + aInitialPosition.y * 0.2) * 0.8 * aMeshSpeed;
    center.y += sin(uTime * (0.4 + iconRand2 * 0.4) + aInitialPosition.x * 0.15) * 0.5;

    // Blizzard wind — stronger, each icon has unique speed + curvy path
    float windRate = 3.0 + iconRand1 * 5.0;  // 3–8 speed per icon (wider spread)
    float windX = uWindStrength * uTime * windRate;
    // Non-linear trajectory: sine wobbles at icon-specific frequencies
    windX += sin(uTime * (1.2 + iconRand2 * 1.8) + iconSeed) * uWindStrength * 1.5;
    windX += cos(uTime * (0.7 + iconRand3 * 1.0) + iconSeed * 0.5) * uWindStrength * 0.8;
    center.x += windX;
    // Vertical turbulence — each icon bobs differently
    center.y += sin(uTime * (0.8 + iconRand3 * 1.5) + iconSeed * 0.7) * uWindStrength * 0.8;
    center.y += cos(uTime * (1.3 + iconRand1 * 0.6) + iconSeed * 1.3) * uWindStrength * 0.4;

    // X wrapping — keeps icons distributed around character
    float halfX = 35.0;
    float relX = mod(center.x - uCharPos.x + halfX, halfX * 2.0) - halfX;
    center.x = relX + uCharPos.x;

    // Collision in relative space (character at z=0)
    vec3 relCenter = vec3(center.x, center.y, relZ);

    // Multi-sphere body collider — generous radii, better to pop early than clip
    float cx = uCharPos.x;
    float cy = uCharPos.y;
    vec3 sHead  = vec3(cx, cy + 15.5, 0.0);
    vec3 sTorso = vec3(cx, cy + 10.0, 0.0);
    vec3 sLegs  = vec3(cx, cy + 4.0,  0.0);

    float dHead  = length(relCenter - sHead)  - 5.5;
    float dTorso = length(relCenter - sTorso) - 8.0;
    float dLegs  = length(relCenter - sLegs)  - 5.0;
    float distToSkin = min(dHead, min(dTorso, dLegs));

    // Balloon pop — inflate on approach, quick burst, reappear after
    float approachT = smoothstep(3.0, 0.5, distToSkin);
    float burstT = smoothstep(0.5, -0.5, distToSkin);
    float popScale = 1.0 + approachT * 0.6 - burstT * 0.8;
    vPopFactor = approachT;

    // Phase 2 — Re-offset z to world space for rendering
    center.z = relZ + uCharZ;

    // Scale local quad vertices by pop factor
    vec3 localPos = position * max(popScale, 0.1);
    vec3 pos = localPos + center;

    // Visibility fade at wrapping edges
    float zNorm = (relZ + 100.0) / 200.0;
    vVisibility = smoothstep(0.0, 0.08, zNorm) * smoothstep(1.0, 0.92, zNorm);

    // Brief fade inside body, then reappear on other side
    float bodyFade = smoothstep(-2.0, -0.5, distToSkin) * smoothstep(-0.5, 1.0, distToSkin);
    vVisibility *= mix(1.0, bodyFade, step(0.0, -distToSkin));

    // Fog fade — stronger than terrain so logos vanish before becoming dots
    vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
    float viewDist = length(mvPos.xyz);
    float fogStrength = uFogDensity * 1.8; // more aggressive than terrain
    float fogF = 1.0 - exp(-fogStrength * fogStrength * viewDist * viewDist);
    vVisibility *= 1.0 - fogF;
    // Hard cutoff — nothing beyond 45 units
    vVisibility *= smoothstep(50.0, 40.0, viewDist);

    gl_Position = projectionMatrix * mvPos;
  }
`;

// ---------------------------------------------------------------------------
// Floating props fragment shader — samples crypto icon from atlas
// ---------------------------------------------------------------------------
const PROP_FRAGMENT = /* glsl */ `
  varying float vVisibility;
  varying vec4 vTextureCoords;
  varying vec2 vUv;
  varying float vPopFactor;

  uniform sampler2D uAtlas;

  void main() {
    // Circular trim — discard pixels outside circle
    vec2 centered = vUv - vec2(0.5);
    float dist = length(centered);
    if (dist > 0.5) discard;

    // Smooth anti-aliased edge
    float edgeAlpha = 1.0 - smoothstep(0.46, 0.5, dist);

    // Map UVs to this instance's portion of the atlas
    float xStart = vTextureCoords.x;
    float xEnd = vTextureCoords.y;
    float yStart = vTextureCoords.z;
    float yEnd = vTextureCoords.w;

    vec2 atlasUV = vec2(
      mix(xStart, xEnd, vUv.x),
      mix(yEnd, yStart, vUv.y)
    );

    vec4 color = texture2D(uAtlas, atlasUV);

    if (color.a < 0.05) discard;

    // Balloon pop — subtle rubber stretch tint (warm pink highlight)
    float popGlow = vPopFactor * vPopFactor * 0.4;
    color.rgb += vec3(0.25, 0.12, 0.15) * popGlow;
    color.rgb = mix(color.rgb, color.rgb * 1.2, vPopFactor * 0.3);

    color.a *= vVisibility * edgeAlpha;

    gl_FragColor = color;
  }
`;

// Icon filenames imported from ../cryptoIcons.ts (700 unique logos)

// ---------------------------------------------------------------------------
// Build a texture atlas from crypto icon images (grid layout)
// ---------------------------------------------------------------------------
function useIconAtlas(): {
  atlas: THREE.Texture | null;
  imageUVs: Array<[number, number, number, number]>;
} {
  const atlasRef = useRef<THREE.Texture | null>(null);
  const uvsRef = useRef<Array<[number, number, number, number]>>([]);
  const builtRef = useRef(false);

  useEffect(() => {
    if (builtRef.current) return;
    builtRef.current = true;

    const loadIcon = (filename: string): Promise<HTMLImageElement | null> => {
      const path = staticFile(`logos/crypto/${filename}`);
      return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = path;
      });
    };

    Promise.all(CRYPTO_ICON_FILENAMES.map(loadIcon)).then((results) => {
      const images = results.filter((img): img is HTMLImageElement => img !== null);
      if (images.length === 0) return;

      // Grid layout: square icons (38 cols for 1400 icons)
      const ICON_SIZE = 64;
      const cols = 38;
      const rows = Math.ceil(images.length / cols);
      const atlasWidth = cols * ICON_SIZE;
      const atlasHeight = rows * ICON_SIZE;

      const canvas = document.createElement("canvas");
      canvas.width = atlasWidth;
      canvas.height = atlasHeight;
      const ctx = canvas.getContext("2d")!;

      const uvs: Array<[number, number, number, number]> = [];

      images.forEach((img, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const x = col * ICON_SIZE;
        const y = row * ICON_SIZE;
        ctx.drawImage(img, x, y, ICON_SIZE, ICON_SIZE);
        uvs.push([
          x / atlasWidth,
          (x + ICON_SIZE) / atlasWidth,
          1 - y / atlasHeight,
          1 - (y + ICON_SIZE) / atlasHeight,
        ]);
      });

      const tex = new THREE.CanvasTexture(canvas);
      tex.wrapS = THREE.ClampToEdgeWrapping;
      tex.wrapT = THREE.ClampToEdgeWrapping;
      tex.minFilter = THREE.LinearFilter;
      tex.magFilter = THREE.LinearFilter;
      tex.needsUpdate = true;

      atlasRef.current = tex;
      uvsRef.current = uvs;
    });
  }, []);

  return { atlas: atlasRef.current, imageUVs: uvsRef.current };
}

// ---------------------------------------------------------------------------
// FloatingProps — Instanced mesh with crypto coin icon textures
// ---------------------------------------------------------------------------
const FloatingProps: React.FC<{
  frame: number;
  fps: number;
  characterPosition: THREE.Vector3;
  phase: string;
}> = ({ frame, fps, characterPosition, phase }) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const { atlas, imageUVs } = useIconAtlas();

  const { positions, speeds, textureCoords } = useMemo(() => {
    const rng = mulberry32(77);
    const pos = new Float32Array(PROP_COUNT * 3);
    const spd = new Float32Array(PROP_COUNT);
    const tc = new Float32Array(PROP_COUNT * 4);

    for (let i = 0; i < PROP_COUNT; i++) {
      pos[i * 3] = (rng() - 0.5) * 60;
      pos[i * 3 + 1] = 1.5 + rng() * 30;
      pos[i * 3 + 2] = (rng() - 0.5) * 200;

      spd[i] = 0.3 + rng() * 0.7;

      // Default UV placeholder — updated once atlas loads
      const imgIdx = i % ICON_COUNT;
      tc[i * 4] = imgIdx / ICON_COUNT;
      tc[i * 4 + 1] = (imgIdx + 1) / ICON_COUNT;
      tc[i * 4 + 2] = 1;
      tc[i * 4 + 3] = 0;
    }
    return { positions: pos, speeds: spd, textureCoords: tc };
  }, []);

  // Update texture coords once atlas UVs are available
  useEffect(() => {
    if (imageUVs.length === 0 || !meshRef.current) return;
    const tc = textureCoords;
    for (let i = 0; i < PROP_COUNT; i++) {
      const imgIdx = i % imageUVs.length;
      const uv = imageUVs[imgIdx];
      tc[i * 4] = uv[0];
      tc[i * 4 + 1] = uv[1];
      tc[i * 4 + 2] = uv[2];
      tc[i * 4 + 3] = uv[3];
    }
    const geo = meshRef.current.geometry;
    const attr = geo.getAttribute("aTextureCoords") as THREE.InstancedBufferAttribute;
    if (attr) attr.needsUpdate = true;
  }, [imageUVs, textureCoords]);

  const geometry = useMemo(() => {
    // Square planes for square icons (half size for density)
    const geo = new THREE.PlaneGeometry(1, 1);
    geo.setAttribute(
      "aInitialPosition",
      new THREE.InstancedBufferAttribute(positions, 3),
    );
    geo.setAttribute(
      "aMeshSpeed",
      new THREE.InstancedBufferAttribute(speeds, 1),
    );
    geo.setAttribute(
      "aTextureCoords",
      new THREE.InstancedBufferAttribute(textureCoords, 4),
    );
    return geo;
  }, [positions, speeds, textureCoords]);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: PROP_VERTEX,
        fragmentShader: PROP_FRAGMENT,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        uniforms: {
          uTime: { value: 0 },
          uCharZ: { value: 0 },
          uCharPos: { value: new THREE.Vector3() },
          uAtlas: { value: null },
          uWindStrength: { value: 0 },
          uFogDensity: { value: 0 },
        },
      }),
    [],
  );

  useEffect(() => {
    if (material) {
      material.uniforms.uTime.value = frame / fps;
      material.uniforms.uCharZ.value = characterPosition.z;
      material.uniforms.uCharPos.value.copy(characterPosition);
      material.uniforms.uWindStrength.value = phase === "hillside" ? 1.0 : 0.0;
      material.uniforms.uFogDensity.value = phase === "hillside" ? 0.035 : 0.0;
      if (atlas) {
        material.uniforms.uAtlas.value = atlas;
      }
    }
  }, [frame, fps, characterPosition, material, atlas, phase]);

  useEffect(() => {
    if (meshRef.current) {
      const dummy = new THREE.Object3D();
      for (let i = 0; i < PROP_COUNT; i++) {
        dummy.position.set(0, 0, 0);
        dummy.updateMatrix();
        meshRef.current.setMatrixAt(i, dummy.matrix);
      }
      meshRef.current.instanceMatrix.needsUpdate = true;
    }
  }, []);

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, PROP_COUNT]}
      frustumCulled={false}
      renderOrder={10}
    />
  );
};

// ---------------------------------------------------------------------------
// Terrain chunk type
// ---------------------------------------------------------------------------
interface ChunkData {
  key: string;
  offsetX: number;
  offsetZ: number;
}

// ---------------------------------------------------------------------------
// DeformableTerrain — chunk-based terrain with foot deformation
// EXACT snow material from original (no texture tiling override)
// ---------------------------------------------------------------------------
const DeformableTerrain: React.FC<{
  characterPosition: THREE.Vector3;
  leftFootWorld: THREE.Vector3 | null;
  rightFootWorld: THREE.Vector3 | null;
  isMoving: boolean;
}> = ({ characterPosition, leftFootWorld, rightFootWorld, isMoving }) => {
  const chunksRef = useRef<(THREE.Mesh | null)[]>([]);
  const deformedMapRef = useRef<Map<string, Float32Array>>(new Map());

  // Load snow textures
  const [colorMap, normalMap, roughnessMap, aoMap, displacementMap] =
    useTexture([
      staticFile("shorts/short-04/textures/snow/snow-color.jpg"),
      staticFile("shorts/short-04/textures/snow/snow-normal-gl.jpg"),
      staticFile("shorts/short-04/textures/snow/snow-roughness.jpg"),
      staticFile("shorts/short-04/textures/snow/snow-ambientocclusion.jpg"),
      staticFile("shorts/short-04/textures/snow/snow-displacement.jpg"),
    ]);

  const snowChunks = useMemo(() => {
    const chunks: ChunkData[] = [];
    for (let x = -CHUNKS_PER_SIDE; x <= CHUNKS_PER_SIDE; x++) {
      for (let z = -CHUNKS_PER_SIDE; z <= CHUNKS_PER_SIDE; z++) {
        chunks.push({ key: `${x}_${z}`, offsetX: x, offsetZ: z });
      }
    }
    return chunks;
  }, []);

  const getChunkKey = (x: number, z: number) =>
    `${Math.round(x / CHUNK_SIZE)},${Math.round(z / CHUNK_SIZE)}`;

  const getNeighboringChunks = useCallback(
    (point: THREE.Vector3) => {
      return chunksRef.current.filter((chunk) => {
        if (!chunk) return false;
        const distance = new THREE.Vector2(
          chunk.position.x - point.x,
          chunk.position.z - point.z,
        ).length();
        return distance < CHUNK_SIZE + DEFORM_RADIUS;
      });
    },
    [],
  );

  const saveChunkDeformation = useCallback(
    (chunk: THREE.Mesh) => {
      const chunkKey = getChunkKey(chunk.position.x, chunk.position.z);
      const position = chunk.geometry.attributes.position;
      deformedMapRef.current.set(
        chunkKey,
        new Float32Array(position.array as Float32Array),
      );
    },
    [],
  );

  const deformMesh = useCallback(
    (point: THREE.Vector3) => {
      const neighboringChunks = getNeighboringChunks(point);
      const tempVertex = new THREE.Vector3();
      const geometriesToUpdate: THREE.BufferGeometry[] = [];

      neighboringChunks.forEach((chunk) => {
        if (!chunk) return;
        const geometry = chunk.geometry;
        if (!geometry?.attributes?.position) return;

        const positionAttribute = geometry.attributes
          .position as THREE.BufferAttribute;
        const vertices = positionAttribute.array as Float32Array;
        let hasDeformation = false;

        for (let i = 0; i < positionAttribute.count; i++) {
          tempVertex.fromArray(vertices, i * 3);
          chunk.localToWorld(tempVertex);

          const distance = tempVertex.distanceTo(point);

          if (distance < DEFORM_RADIUS) {
            const influence = Math.pow(
              (DEFORM_RADIUS - distance) / DEFORM_RADIUS,
              3,
            );

            const yOffset = influence * 10;
            tempVertex.y -=
              yOffset * Math.sin((distance / DEFORM_RADIUS) * Math.PI);

            tempVertex.y +=
              WAVE_AMPLITUDE * Math.sin(WAVE_FREQUENCY * distance);

            chunk.worldToLocal(tempVertex);
            tempVertex.toArray(vertices, i * 3);
            hasDeformation = true;
          }
        }

        if (hasDeformation) {
          positionAttribute.needsUpdate = true;
          geometriesToUpdate.push(geometry);
          saveChunkDeformation(chunk);
        }
      });

      if (geometriesToUpdate.length > 0) {
        geometriesToUpdate.forEach((g) => g.computeVertexNormals());
      }
    },
    [getNeighboringChunks, saveChunkDeformation],
  );

  useEffect(() => {
    if (!isMoving) return;
    if (leftFootWorld) deformMesh(leftFootWorld);
    if (rightFootWorld) deformMesh(rightFootWorld);
  });

  useEffect(() => {
    const charX = characterPosition.x;
    const charZ = characterPosition.z;

    snowChunks.forEach((chunk, index) => {
      const mesh = chunksRef.current[index];
      if (!mesh) return;

      const chunkX =
        Math.round(charX / CHUNK_SIZE) * CHUNK_SIZE +
        chunk.offsetX * CHUNK_SIZE;
      const chunkZ =
        Math.round(charZ / CHUNK_SIZE) * CHUNK_SIZE +
        chunk.offsetZ * CHUNK_SIZE;

      if (mesh.position.x !== chunkX || mesh.position.z !== chunkZ) {
        mesh.position.set(chunkX, 0, chunkZ);

        const key = getChunkKey(chunkX, chunkZ);
        const saved = deformedMapRef.current.get(key);
        const geo = mesh.geometry as THREE.BufferGeometry;
        const posAttr = geo.attributes.position as THREE.BufferAttribute;

        if (saved) {
          (posAttr.array as Float32Array).set(saved);
          posAttr.needsUpdate = true;
          geo.computeVertexNormals();
        } else if ((geo as any).userData?.originalPosition) {
          (posAttr.array as Float32Array).set(
            (geo as any).userData.originalPosition,
          );
          posAttr.needsUpdate = true;
          geo.computeVertexNormals();
        }
      }
    });
  });

  return (
    <>
      {snowChunks.map((chunk, index) => (
        <mesh
          key={chunk.key}
          ref={(el) => {
            if (el) {
              chunksRef.current[index] = el;
              const geo = el.geometry as THREE.BufferGeometry;
              if (!(geo as any).userData?.originalPosition) {
                (geo as any).userData = {
                  originalPosition: (
                    geo.attributes.position.array as Float32Array
                  ).slice(),
                };
              }
            }
          }}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[
            chunk.offsetX * CHUNK_SIZE,
            0.5,
            chunk.offsetZ * CHUNK_SIZE,
          ]}
        >
          <planeGeometry
            args={[
              CHUNK_SIZE + CHUNK_OVERLAP * 2,
              CHUNK_SIZE + CHUNK_OVERLAP * 2,
              GRID_RESOLUTION,
              GRID_RESOLUTION,
            ]}
          />
          <meshStandardMaterial
            map={colorMap}
            normalMap={normalMap}
            roughnessMap={roughnessMap}
            aoMap={aoMap}
            displacementMap={displacementMap}
            displacementScale={4}
          />
        </mesh>
      ))}
    </>
  );
};

// ---------------------------------------------------------------------------
// RidgeTerrain — Himalaya-style mountain ridge
// Custom ShaderMaterial: height + slope + FBM noise for snow/rock blending
// ---------------------------------------------------------------------------
const RIDGE_WIDTH = 80;
const RIDGE_LENGTH = 160; // longer to push snapping edge well past fog fade

// Hash-based pseudo-noise for geometry (better than sine waves)
function hash2D(x: number, z: number): number {
  let n = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return n - Math.floor(n);
}
function smoothNoise(x: number, z: number): number {
  const ix = Math.floor(x), iz = Math.floor(z);
  const fx = x - ix, fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx), uz = fz * fz * (3 - 2 * fz);
  const a = hash2D(ix, iz), b = hash2D(ix + 1, iz);
  const c = hash2D(ix, iz + 1), d = hash2D(ix + 1, iz + 1);
  return a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz;
}
function fbmJS(x: number, z: number, octaves: number): number {
  let val = 0, amp = 0.5, freq = 1;
  for (let i = 0; i < octaves; i++) {
    val += amp * (smoothNoise(x * freq, z * freq) - 0.5);
    amp *= 0.5;
    freq *= 2.17;
  }
  return val;
}

// Vertex shader — passes world position, normal, and view-space depth to fragment
const RIDGE_VERTEX = /* glsl */ `
  varying vec3 vWorldPosition;
  varying vec3 vWorldNormal;
  varying vec2 vUv;
  varying float vViewDist;

  void main() {
    vUv = uv;
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPos.xyz;
    vWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
    vec4 viewPos = viewMatrix * worldPos;
    vViewDist = length(viewPos.xyz);
    gl_Position = projectionMatrix * viewPos;
  }
`;

// Fragment shader — slope + height + FBM noise for Himalayan coloring
const RIDGE_FRAGMENT = /* glsl */ `
  uniform sampler2D uSnowColor;
  uniform sampler2D uSnowNormal;
  uniform vec3 uLightDir;
  uniform float uFogDensity;
  uniform vec3 uFogColor;

  varying vec3 vWorldPosition;
  varying vec3 vWorldNormal;
  varying vec2 vUv;
  varying float vViewDist;

  // Hash-based noise in GLSL
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return a + (b - a) * u.x + (c - a) * u.y + (a - b - c + d) * u.x * u.y;
  }
  float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    mat2 rot = mat2(0.8, 0.6, -0.6, 0.8); // domain rotation to reduce axis-alignment
    for (int i = 0; i < 6; i++) {
      v += a * noise(p);
      p = rot * p * 2.17;
      a *= 0.5;
    }
    return v;
  }

  void main() {
    // Slope: angle between surface normal and up vector
    float slope = acos(clamp(dot(normalize(vWorldNormal), vec3(0.0, 1.0, 0.0)), 0.0, 1.0));

    // Height normalized: -22 (base) to 0 (peak) → 0..1
    float h = clamp((vWorldPosition.y + 22.0) / 22.0, 0.0, 1.0);

    // FBM noise to break up color bands
    vec2 noiseCoord = vWorldPosition.xz * 0.15;
    float n = fbm(noiseCoord);
    float nFine = fbm(noiseCoord * 4.0);

    // --- Himalayan color palette ---
    // Deep rock (base): dark charcoal-brown
    vec3 deepRock = vec3(0.08, 0.06, 0.05);
    // Mid rock: grey-brown
    vec3 midRock = vec3(0.22, 0.18, 0.15);
    // High rock: slate grey
    vec3 highRock = vec3(0.38, 0.35, 0.33);
    // Snow: bright white with blue tint
    vec3 snow = vec3(0.90, 0.93, 0.98);
    // Ice shadow: blue-grey in crevices
    vec3 iceShadow = vec3(0.55, 0.62, 0.72);

    // Rock color by altitude
    vec3 rockColor = mix(deepRock, midRock, smoothstep(0.0, 0.35, h));
    rockColor = mix(rockColor, highRock, smoothstep(0.3, 0.65, h));
    // Add noise variation to rock
    rockColor += (n - 0.5) * 0.08;
    rockColor += (nFine - 0.5) * 0.03;

    // Snow coverage: depends on height AND slope
    // Higher slope threshold = more surfaces qualify as "flat enough" for snow
    float snowThreshold = 0.65; // radians (~37 degrees) — generous snow coverage
    float slopeFactor = 1.0 - smoothstep(snowThreshold, snowThreshold + 0.4, slope);
    // Height factor: snow starts appearing lower on the mountain
    float heightFactor = smoothstep(0.15, 0.4, h);
    // Noise breaks up the snow line for natural look
    float snowNoise = (n - 0.5) * 0.2;
    // Base snow amount boosted — Himalayan peaks are heavily snow-covered
    float snowAmount = clamp(slopeFactor * heightFactor + snowNoise + 0.15, 0.0, 1.0);

    // Sample snow texture at two scales for quality detail
    vec2 snowUVCoarse = vWorldPosition.xz * vec2(0.06, 0.08);
    vec2 snowUVFine = vWorldPosition.xz * vec2(0.2, 0.25);
    vec3 snowTexCoarse = texture2D(uSnowColor, snowUVCoarse).rgb;
    vec3 snowTexFine = texture2D(uSnowColor, snowUVFine).rgb;
    vec3 snowTex = mix(snowTexCoarse, snowTexFine, 0.4) * 1.05;

    // Blend snow texture with base snow color — heavier texture presence
    vec3 snowFinal = mix(snow, snowTex, 0.55);
    // Ice shadow tint in crevices (low normal.y + high altitude)
    float creviceFactor = (1.0 - slopeFactor) * heightFactor * 0.5;
    snowFinal = mix(snowFinal, iceShadow, creviceFactor);

    // Final color: blend rock and snow
    vec3 color = mix(rockColor, snowFinal, snowAmount);

    // Simple diffuse lighting
    float diffuse = max(dot(normalize(vWorldNormal), normalize(uLightDir)), 0.0);
    float ambient = 0.35;
    color *= ambient + (1.0 - ambient) * diffuse;

    // Radial distance fog — smooth fade to white, hides terrain edges
    float fogF = 1.0 - exp(-uFogDensity * uFogDensity * vViewDist * vViewDist);
    fogF = clamp(fogF, 0.0, 1.0);
    color = mix(color, uFogColor, fogF);

    gl_FragColor = vec4(color, 1.0);
  }
`;

const RidgeTerrain: React.FC<{
  characterPosition: THREE.Vector3;
  leftFootWorld: THREE.Vector3 | null;
  rightFootWorld: THREE.Vector3 | null;
  isMoving: boolean;
}> = ({ characterPosition, leftFootWorld, rightFootWorld, isMoving }) => {
  const meshRef = useRef<THREE.Mesh>(null);

  // Load snow textures for detail on snowy areas
  const [snowColorMap, snowNormalMap] = useTexture([
    staticFile("shorts/short-04/textures/snow/snow-color.jpg"),
    staticFile("shorts/short-04/textures/snow/snow-normal-gl.jpg"),
  ]);

  useEffect(() => {
    [snowColorMap, snowNormalMap].forEach((tex) => {
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
    });
  }, [snowColorMap, snowNormalMap]);

  const geometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(RIDGE_WIDTH, RIDGE_LENGTH, 200, 600);
    geo.rotateX(-Math.PI / 2);

    const pos = geo.attributes.position;

    // Seeded RNG for deterministic rock placement
    const rng = mulberry32(314);
    const ROCK_COUNT = 50;
    const rocks: Array<{ rx: number; rz: number; size: number; height: number }> = [];
    for (let r = 0; r < ROCK_COUNT; r++) {
      rocks.push({
        rx: (rng() - 0.5) * RIDGE_WIDTH * 0.8,
        rz: (rng() - 0.5) * RIDGE_LENGTH,
        size: 1.2 + rng() * 4.0,
        height: 0.6 + rng() * 3.0,
      });
    }

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);

      // Ridge crest meanders — using FBM for organic path
      const crestOffset =
        fbmJS(z * 0.03, 0, 4) * 8.0 +
        Math.sin(z * 0.05) * 2.0;
      const dx = x - crestOffset;
      const absDx = Math.abs(dx);

      // Asymmetric Gaussian ridge profile
      const sigmaLeft = 10.0;
      const sigmaRight = 6.5;
      const sigma = dx < 0 ? sigmaLeft : sigmaRight;
      const peakDrop = 22.0;
      const gaussFactor = Math.exp(-(dx * dx) / (2 * sigma * sigma));
      let y = -peakDrop * (1.0 - gaussFactor);

      // FBM-based terrain noise — natural and non-repeating
      const noiseStrength = Math.min(absDx / 3.0, 1.0);
      const terrainNoise = fbmJS(x * 0.12, z * 0.12, 6) * 6.0;
      y += terrainNoise * noiseStrength;

      // Sharp ridge-line variation using higher-frequency FBM
      const ridgeDetail = fbmJS(x * 0.3 + 100, z * 0.25 + 100, 4) * 2.0;
      y += ridgeDetail * (1.0 - noiseStrength * 0.5);

      // Rock outcrops — sharp angular bumps scattered on slopes
      for (const rock of rocks) {
        const dist = Math.sqrt((x - rock.rx) ** 2 + (z - rock.rz) ** 2);
        if (dist < rock.size) {
          const t = 1.0 - dist / rock.size;
          // Angular rock profile
          const rockBump = rock.height * t * t * (3.0 - 2.0 * t);
          // Rocks only on slopes, diminished near peak
          y += rockBump * noiseStrength * 0.8;
        }
      }

      pos.setY(i, y);
    }

    pos.needsUpdate = true;
    geo.computeVertexNormals();
    return geo;
  }, []);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: RIDGE_VERTEX,
        fragmentShader: RIDGE_FRAGMENT,
        side: THREE.DoubleSide,
        uniforms: {
          uSnowColor: { value: null },
          uSnowNormal: { value: null },
          uLightDir: { value: new THREE.Vector3(0.5, 0.8, 0.3).normalize() },
          uFogDensity: { value: 0.035 },
          uFogColor: { value: new THREE.Color("#ffffff") },
        },
      }),
    [],
  );

  // Assign textures to material
  useEffect(() => {
    material.uniforms.uSnowColor.value = snowColorMap;
    material.uniforms.uSnowNormal.value = snowNormalMap;
  }, [snowColorMap, snowNormalMap, material]);

  // Foot deformation on the ridge
  useEffect(() => {
    if (!isMoving || !meshRef.current) return;
    const mesh = meshRef.current;
    const geo = mesh.geometry;
    const posAttr = geo.attributes.position as THREE.BufferAttribute;
    const verts = posAttr.array as Float32Array;
    const tmp = new THREE.Vector3();
    let changed = false;

    const deformFoot = (foot: THREE.Vector3) => {
      for (let i = 0; i < posAttr.count; i++) {
        tmp.fromArray(verts, i * 3);
        mesh.localToWorld(tmp);
        const dist = tmp.distanceTo(foot);
        if (dist < DEFORM_RADIUS) {
          const influence = Math.pow((DEFORM_RADIUS - dist) / DEFORM_RADIUS, 3);
          const yOff = influence * 8;
          tmp.y -= yOff * Math.sin((dist / DEFORM_RADIUS) * Math.PI);
          mesh.worldToLocal(tmp);
          tmp.toArray(verts, i * 3);
          changed = true;
        }
      }
    };

    if (leftFootWorld) deformFoot(leftFootWorld);
    if (rightFootWorld) deformFoot(rightFootWorld);

    if (changed) {
      posAttr.needsUpdate = true;
      geo.computeVertexNormals();
    }
  });

  // Follow character along Z
  useEffect(() => {
    if (meshRef.current) {
      const snapZ = Math.round(characterPosition.z / RIDGE_LENGTH) * RIDGE_LENGTH;
      meshRef.current.position.z = snapZ;
    }
  });

  return (
    <mesh ref={meshRef} geometry={geometry} material={material} />
  );
};

// ---------------------------------------------------------------------------
// SnowPlateau — flat snow strip on top of the ridge crest
// Gives a visible thick snow surface on the mountain peak
// ---------------------------------------------------------------------------
const PLATEAU_WIDTH = 16; // wider base — actual visible width varies via vertex displacement
const PLATEAU_LENGTH = 180; // slightly longer than ridge to avoid pop-in

const SnowPlateau: React.FC<{
  characterPosition: THREE.Vector3;
  leftFootWorld: THREE.Vector3 | null;
  rightFootWorld: THREE.Vector3 | null;
  isMoving: boolean;
}> = ({ characterPosition, leftFootWorld, rightFootWorld, isMoving }) => {
  const meshRef = useRef<THREE.Mesh>(null);

  const [colorMap, normalMap, roughnessMap, aoMap, displacementMap] =
    useTexture([
      staticFile("shorts/short-04/textures/snow/snow-color.jpg"),
      staticFile("shorts/short-04/textures/snow/snow-normal-gl.jpg"),
      staticFile("shorts/short-04/textures/snow/snow-roughness.jpg"),
      staticFile("shorts/short-04/textures/snow/snow-ambientocclusion.jpg"),
      staticFile("shorts/short-04/textures/snow/snow-displacement.jpg"),
    ]);

  useEffect(() => {
    [colorMap, normalMap, roughnessMap, aoMap, displacementMap].forEach(
      (tex) => {
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(1, 14);
      },
    );
  }, [colorMap, normalMap, roughnessMap, aoMap, displacementMap]);

  const geometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(PLATEAU_WIDTH, PLATEAU_LENGTH, 64, 360);
    geo.rotateX(-Math.PI / 2);

    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);

      // Organic varying width along the path using FBM
      const widthNoise = fbmJS(z * 0.04, 0, 4);
      const localHalfWidth = 3.5 + widthNoise * 2.5; // varies ~3.5–6 units wide (wider minimum)

      // Crest meander matching the ridge terrain
      const crestOffset =
        fbmJS(z * 0.03, 0, 4) * 8.0 +
        Math.sin(z * 0.05) * 2.0;
      const dx = x - crestOffset;
      const absDx = Math.abs(dx);

      // Soft feathered edge — vertices beyond width get pushed down into ridge
      const edgeT = Math.max(0, (absDx - localHalfWidth) / 2.5);
      const edgeDrop = edgeT * edgeT * 4.0; // quadratic drop-off

      // Snow surface undulations
      const bump =
        Math.sin(x * 3.0 + z * 2.0) * 0.08 +
        Math.sin(z * 5.0) * 0.05 +
        fbmJS(x * 0.5, z * 0.5, 3) * 0.15;

      pos.setY(i, bump - edgeDrop);

      // Vertex color alpha: white snow in center, fades at edges for blending
      const edgeFade = 1.0 - Math.min(1, edgeT * 0.6);
      colors[i * 3] = edgeFade;
      colors[i * 3 + 1] = edgeFade;
      colors[i * 3 + 2] = edgeFade;
    }

    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    pos.needsUpdate = true;
    geo.computeVertexNormals();
    return geo;
  }, []);

  // Foot deformation on snow plateau
  useEffect(() => {
    if (!isMoving || !meshRef.current) return;
    const mesh = meshRef.current;
    const geo = mesh.geometry;
    const posAttr = geo.attributes.position as THREE.BufferAttribute;
    const verts = posAttr.array as Float32Array;
    const tmp = new THREE.Vector3();
    let changed = false;

    const deformFoot = (foot: THREE.Vector3) => {
      for (let i = 0; i < posAttr.count; i++) {
        tmp.fromArray(verts, i * 3);
        mesh.localToWorld(tmp);
        const dist = tmp.distanceTo(foot);
        if (dist < DEFORM_RADIUS) {
          const influence = Math.pow(
            (DEFORM_RADIUS - dist) / DEFORM_RADIUS,
            3,
          );
          tmp.y -= influence * 6 * Math.sin((dist / DEFORM_RADIUS) * Math.PI);
          mesh.worldToLocal(tmp);
          tmp.toArray(verts, i * 3);
          changed = true;
        }
      }
    };

    if (leftFootWorld) deformFoot(leftFootWorld);
    if (rightFootWorld) deformFoot(rightFootWorld);

    if (changed) {
      posAttr.needsUpdate = true;
      geo.computeVertexNormals();
    }
  });

  // Follow character along Z — same snap interval as RidgeTerrain
  useEffect(() => {
    if (meshRef.current) {
      const snapZ =
        Math.round(characterPosition.z / RIDGE_LENGTH) * RIDGE_LENGTH;
      meshRef.current.position.set(0, 0.35, snapZ);
    }
  });

  return (
    <mesh ref={meshRef} geometry={geometry}>
      <meshStandardMaterial
        map={colorMap}
        normalMap={normalMap}
        roughnessMap={roughnessMap}
        aoMap={aoMap}
        displacementMap={displacementMap}
        displacementScale={0.8}
        roughness={0.98}
        metalness={0.0}
        vertexColors
      />
    </mesh>
  );
};

// ---------------------------------------------------------------------------
// WalkerCharacter — auto-walks forward with idle→walk animation switching
// ---------------------------------------------------------------------------
// Crest offset function — must match RidgeTerrain geometry exactly
function ridgeCrestX(z: number): number {
  return fbmJS(z * 0.03, 0, 4) * 8.0 + Math.sin(z * 0.05) * 2.0;
}

const WalkerCharacter: React.FC<{
  frame: number;
  fps: number;
  phase: string;
  onUpdate: (data: {
    position: THREE.Vector3;
    leftFoot: THREE.Vector3 | null;
    rightFoot: THREE.Vector3 | null;
    isMoving: boolean;
  }) => void;
}> = ({ frame, fps, phase, onUpdate }) => {
  const characterRef = useRef<THREE.Group>(null);
  const parentRef = useRef<THREE.Group>(null);
  const currentAnimRef = useRef<string | null>(null);

  const { scene, animations } = useGLTF(
    staticFile("shorts/short-04/models/explorer.glb"),
  );
  const { actions, mixer } = useAnimations(animations, scene);

  const [occlusion, texture, normal] = useTexture([
    staticFile("shorts/short-04/textures/character/occlusion.png"),
    staticFile("shorts/short-04/textures/character/texture.png"),
    staticFile("shorts/short-04/textures/character/normal.png"),
  ]);

  useEffect(() => {
    texture.flipY = false;
    normal.flipY = false;
    occlusion.flipY = false;

    scene.traverse((child: any) => {
      if (child.isMesh) {
        child.material.map = texture;
        child.material.normalMap = normal;
        child.material.aoMap = occlusion;
        child.material.needsUpdate = true;
      }
    });

    if (characterRef.current) {
      characterRef.current.scale.set(0.1, 0.1, 0.1);
    }
  }, [scene, texture, normal, occlusion]);

  useEffect(() => {
    if (characterRef.current && parentRef.current) {
      const boundingBox = new THREE.Box3().setFromObject(characterRef.current);
      const yMin = boundingBox.min.y;
      parentRef.current.position.set(
        0,
        -yMin * characterRef.current.scale.y - 0.5,
        0,
      );
    }
  }, [scene]);

  const switchAnimation = useCallback(
    (animationName: string) => {
      if (currentAnimRef.current === animationName) return;

      const current = currentAnimRef.current;
      if (current && actions[current]) {
        actions[current].fadeOut(0.5);
      }

      if (actions[animationName]) {
        actions[animationName].reset().fadeIn(0.4).play();
        currentAnimRef.current = animationName;
      }
    },
    [actions],
  );

  useEffect(() => {
    if (actions[IDLE_ANIMATION]) {
      actions[IDLE_ANIMATION].reset().fadeIn(0.4).play();
      currentAnimRef.current = IDLE_ANIMATION;
    }
  }, [actions]);

  useEffect(() => {
    const time = frame / fps;
    const delta = 1 / fps;

    const START_DELAY = 1.0;
    const movingTime = Math.max(0, time - START_DELAY);
    const isMoving = movingTime > 0;

    switchAnimation(isMoving ? WALK_ANIMATION : IDLE_ANIMATION);

    if (parentRef.current) {
      if (isMoving) {
        const z = -movingTime * CHARACTER_SPEED;
        parentRef.current.position.z = z;

        if (phase === "hillside") {
          // Follow the ridge crest meander
          const crestX = ridgeCrestX(z);

          // Wind drift — subtle oscillation, character stays centered on path
          const windDrift = Math.sin(movingTime * 0.7) * 0.15 + Math.sin(movingTime * 1.3) * 0.08;
          parentRef.current.position.x = crestX + windDrift;

          // Rotate to face direction of travel along crest
          const dz = 0.5;
          const crestAhead = ridgeCrestX(z - dz);
          const dx = crestAhead - crestX;
          const heading = Math.atan2(dx, -dz);
          parentRef.current.rotation.y = heading;

          // Lean into the wind (slight Z tilt)
          const windLean = Math.sin(movingTime * 0.9) * 0.04 + 0.03;
          parentRef.current.rotation.z = windLean;
        } else {
          parentRef.current.position.x = 0;
          parentRef.current.rotation.y = Math.PI;
          parentRef.current.rotation.z = 0;
        }
      } else {
        parentRef.current.rotation.y = Math.PI;
      }
    }

    if (mixer) {
      mixer.update(delta);
    }

    let leftFoot: THREE.Vector3 | null = null;
    let rightFoot: THREE.Vector3 | null = null;

    if (characterRef.current && isMoving) {
      const leftBone =
        characterRef.current.getObjectByName("mixamorigLeftFoot");
      const rightBone =
        characterRef.current.getObjectByName("mixamorigRightFoot");

      if (leftBone) {
        leftFoot = new THREE.Vector3();
        leftFoot.setFromMatrixPosition(leftBone.matrixWorld);
      }
      if (rightBone) {
        rightFoot = new THREE.Vector3();
        rightFoot.setFromMatrixPosition(rightBone.matrixWorld);
      }
    }

    const worldPos = new THREE.Vector3();
    if (parentRef.current) {
      parentRef.current.getWorldPosition(worldPos);
    }

    onUpdate({ position: worldPos, leftFoot, rightFoot, isMoving });
  }, [frame, fps, mixer, onUpdate, switchAnimation]);

  return (
    <group ref={parentRef}>
      <primitive ref={characterRef} object={scene} />
    </group>
  );
};

// ---------------------------------------------------------------------------
// BlizzardEffect — GPU point-sprite snow particles driven by wind
// ---------------------------------------------------------------------------
const BLIZZARD_COUNT = 12000;

const BLIZZARD_VERTEX = /* glsl */ `
  attribute vec3 aOffset;
  attribute float aSpeed;
  attribute float aSize;

  uniform float uTime;
  uniform vec3 uCharPos;

  varying float vAlpha;

  void main() {
    vec3 pos = position;

    float t = uTime * aSpeed;
    pos += aOffset;

    // Apply all movement BEFORE wrapping so particles stay in volume
    pos.x += sin(t * 2.3 + aOffset.y * 0.5) * 3.0 + uTime * 4.0;
    pos.y += cos(t * 1.7 + aOffset.x * 0.3) * 0.5 - uTime * 1.5;
    pos.z += sin(t * 1.1 + aOffset.z * 0.4) * 1.5;

    // Wrap around character AFTER movement
    pos.z = mod(pos.z - uCharPos.z + 50.0, 100.0) - 50.0 + uCharPos.z;
    pos.x = mod(pos.x - uCharPos.x + 40.0, 80.0) - 40.0 + uCharPos.x;
    pos.y = mod(pos.y + 5.0, 40.0) - 5.0;

    // Depth fade
    vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
    float dist = -mvPos.z;
    vAlpha = smoothstep(80.0, 5.0, dist) * smoothstep(0.0, 2.0, dist);

    gl_Position = projectionMatrix * mvPos;
    gl_PointSize = aSize * (50.0 / max(dist, 1.0));
  }
`;

const BLIZZARD_FRAGMENT = /* glsl */ `
  varying float vAlpha;

  void main() {
    float d = length(gl_PointCoord - vec2(0.5));
    float alpha = smoothstep(0.5, 0.1, d) * vAlpha * 1.0;
    gl_FragColor = vec4(1.0, 1.0, 1.0, alpha);
  }
`;

const BlizzardEffect: React.FC<{
  frame: number;
  fps: number;
  characterPosition: THREE.Vector3;
}> = ({ frame, fps, characterPosition }) => {
  const pointsRef = useRef<THREE.Points>(null);

  const { geometry, material } = useMemo(() => {
    const rng = mulberry32(999);
    const positions = new Float32Array(BLIZZARD_COUNT * 3);
    const offsets = new Float32Array(BLIZZARD_COUNT * 3);
    const speeds = new Float32Array(BLIZZARD_COUNT);
    const sizes = new Float32Array(BLIZZARD_COUNT);

    for (let i = 0; i < BLIZZARD_COUNT; i++) {
      positions[i * 3] = 0;
      positions[i * 3 + 1] = 0;
      positions[i * 3 + 2] = 0;

      offsets[i * 3] = (rng() - 0.5) * 100;
      offsets[i * 3 + 1] = rng() * 45;
      offsets[i * 3 + 2] = (rng() - 0.5) * 120;

      speeds[i] = 0.4 + rng() * 2.5;
      // 3 layers: fine snow (50%), medium (35%), big soft flakes (15%)
      const layerRoll = rng();
      sizes[i] = layerRoll < 0.5 ? 1.0 + rng() * 2.0
               : layerRoll < 0.85 ? 3.0 + rng() * 3.5
               : 5.0 + rng() * 6.0;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("aOffset", new THREE.BufferAttribute(offsets, 3));
    geo.setAttribute("aSpeed", new THREE.BufferAttribute(speeds, 1));
    geo.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));

    const mat = new THREE.ShaderMaterial({
      vertexShader: BLIZZARD_VERTEX,
      fragmentShader: BLIZZARD_FRAGMENT,
      transparent: true,
      depthWrite: false,
      uniforms: {
        uTime: { value: 0 },
        uCharPos: { value: new THREE.Vector3() },
      },
    });

    return { geometry: geo, material: mat };
  }, []);

  useEffect(() => {
    material.uniforms.uTime.value = frame / fps;
    material.uniforms.uCharPos.value.copy(characterPosition);
  }, [frame, fps, characterPosition, material]);

  return <points ref={pointsRef} geometry={geometry} material={material} />;
};

// ---------------------------------------------------------------------------
// Phase configs
// ---------------------------------------------------------------------------
interface PhaseConfig {
  terrainType: "snow" | "ridge"; // which terrain to render
  cameraOffset: [number, number, number];
  lookAtYOffset: number;
  bgColor: string;
  fogColor: string;
  lightDir: [number, number, number];
  lightIntensity: number;
  ambientIntensity: number;
  useFogExp2: boolean; // exponential fog for void effect
  fogDensity: number;
}

const PHASE_CONFIGS: Record<string, PhaseConfig> = {
  walk: {
    terrainType: "snow",
    cameraOffset: [3, 11, -30], // pulled back for full-body framing
    lookAtYOffset: 7,
    bgColor: "white",
    fogColor: "#ffffff",
    lightDir: [4, 5, 0],
    lightIntensity: 3,
    ambientIntensity: 1,
    useFogExp2: false,
    fogDensity: 0,
  },
  hillside: {
    terrainType: "ridge",
    cameraOffset: [4, 12, -32], // pulled back, slightly offset
    lookAtYOffset: 7,
    bgColor: "white",
    fogColor: "#ffffff",
    lightDir: [4, 5, 0],
    lightIntensity: 3,
    ambientIntensity: 1,
    useFogExp2: true,
    fogDensity: 0.035,
  },
};

// ---------------------------------------------------------------------------
// CameraController — tracks character, position varies per phase
// ---------------------------------------------------------------------------
const CameraController: React.FC<{
  characterPosition: THREE.Vector3;
  frame: number;
  fps: number;
  phase: string;
}> = ({ characterPosition, frame, fps, phase }) => {
  const { camera } = useThree();
  const targetRef = useRef(new THREE.Vector3());

  const config = PHASE_CONFIGS[phase] || PHASE_CONFIGS.walk;

  useEffect(() => {
    const time = frame / fps;

    const finalOffset = new THREE.Vector3(...config.cameraOffset);

    // --- 1. Cinematic entry pull-in (first ~3.5s) ---
    const introT = Math.min(1, time / 3.5);
    // smoothstep for natural deceleration
    const introEase = introT * introT * (3 - 2 * introT);

    const startOffset = new THREE.Vector3(0, 18, -80);
    const baseOffset = new THREE.Vector3().lerpVectors(
      startOffset,
      finalOffset,
      introEase,
    );

    // --- 2. Dynamic ongoing camera movement (layered harmonics) ---
    // Orbit drift — wide side-to-side sweep
    const swayX =
      Math.sin(time * 0.23) * 3.0 +
      Math.sin(time * 0.11) * 1.5 +
      Math.cos(time * 0.37) * 0.8;

    // Height variation — crane-like ups and downs
    const swayY =
      Math.cos(time * 0.19) * 2.0 +
      Math.sin(time * 0.41) * 0.8 +
      Math.sin(time * 0.07) * 1.2;

    // Push/pull breathing — irregular zoom rhythm
    const zoomBreath =
      Math.sin(time * 0.15) * 5.0 +
      Math.cos(time * 0.29) * 2.5 +
      Math.sin(time * 0.47) * 1.2;

    // Fade in dynamic motion during intro so it doesn't fight the swoop
    const motionBlend = introEase;

    const targetCamPos = new THREE.Vector3(
      characterPosition.x + baseOffset.x + swayX * motionBlend,
      characterPosition.y + baseOffset.y + swayY * motionBlend,
      characterPosition.z + baseOffset.z + zoomBreath * motionBlend,
    );

    // --- 3. Lerp speed: faster during intro, buttery after ---
    const lerpSpeed = time < 3.5 ? 0.3 : 0.08;
    camera.position.lerp(targetCamPos, lerpSpeed);

    // --- Look-at with wander ---
    const lookDriftX =
      Math.sin(time * 0.28) * 1.5 + Math.cos(time * 0.13) * 0.8;
    const lookDriftY =
      Math.cos(time * 0.22) * 0.8 + Math.sin(time * 0.09) * 0.5;

    // During intro, look higher (down at approaching character)
    const introLookYBoost = (1 - introEase) * 6.0;

    targetRef.current.set(
      characterPosition.x + lookDriftX * motionBlend,
      characterPosition.y + config.lookAtYOffset + introLookYBoost + lookDriftY * motionBlend,
      characterPosition.z,
    );
    camera.lookAt(targetRef.current);
  }, [characterPosition, frame, fps, camera, config]);

  return null;
};

// ---------------------------------------------------------------------------
// SceneContent — the full 3D scene, switches terrain type per phase
// ---------------------------------------------------------------------------
const SceneContent: React.FC<{
  frame: number;
  fps: number;
  phase: string;
}> = ({ frame, fps, phase }) => {
  const charDataRef = useRef({
    position: new THREE.Vector3(),
    leftFoot: null as THREE.Vector3 | null,
    rightFoot: null as THREE.Vector3 | null,
    isMoving: false,
  });

  const handleCharUpdate = React.useCallback(
    (data: {
      position: THREE.Vector3;
      leftFoot: THREE.Vector3 | null;
      rightFoot: THREE.Vector3 | null;
      isMoving: boolean;
    }) => {
      charDataRef.current = data;
    },
    [],
  );

  const config = PHASE_CONFIGS[phase] || PHASE_CONFIGS.walk;

  return (
    <>
      {/* Lighting */}
      <directionalLight
        position={config.lightDir}
        intensity={config.lightIntensity}
      />
      <ambientLight intensity={config.ambientIntensity} />

      {/* Background + fog */}
      <color attach="background" args={[config.bgColor]} />
      {config.useFogExp2 && (
        <fogExp2 attach="fog" args={[config.fogColor, config.fogDensity]} />
      )}

      {/* Camera tracking */}
      <CameraController
        characterPosition={charDataRef.current.position}
        frame={frame}
        fps={fps}
        phase={phase}
      />

      {/* Character */}
      <WalkerCharacter
        frame={frame}
        fps={fps}
        phase={phase}
        onUpdate={handleCharUpdate}
      />

      {/* Terrain — snow chunks for walk, ridge for hillside */}
      {config.terrainType === "snow" && (
        <DeformableTerrain
          characterPosition={charDataRef.current.position}
          leftFootWorld={charDataRef.current.leftFoot}
          rightFootWorld={charDataRef.current.rightFoot}
          isMoving={charDataRef.current.isMoving}
        />
      )}
      {config.terrainType === "ridge" && (
        <>
          <RidgeTerrain
            characterPosition={charDataRef.current.position}
            leftFootWorld={charDataRef.current.leftFoot}
            rightFootWorld={charDataRef.current.rightFoot}
            isMoving={charDataRef.current.isMoving}
          />
          <SnowPlateau
            characterPosition={charDataRef.current.position}
            leftFootWorld={charDataRef.current.leftFoot}
            rightFootWorld={charDataRef.current.rightFoot}
            isMoving={charDataRef.current.isMoving}
          />
        </>
      )}

      {/* Floating props with album cover textures */}
      <FloatingProps
        frame={frame}
        fps={fps}
        characterPosition={charDataRef.current.position}
        phase={phase}
      />

      {/* Blizzard — only on hillside phase */}
      {phase === "hillside" && (
        <BlizzardEffect
          frame={frame}
          fps={fps}
          characterPosition={charDataRef.current.position}
        />
      )}
    </>
  );
};

// ---------------------------------------------------------------------------
// TerrainWalker3D — main export, wraps ThreeCanvas
// ---------------------------------------------------------------------------
interface Props {
  phase: string;
  overrideFrame: number;
  overrideDuration: number;
  phaseFrame: number;
  phaseDurationFrames: number;
}

export const TerrainWalker3D: React.FC<Props> = ({
  phase,
}) => {
  const { width, height, fps } = useVideoConfig();
  const frame = useCurrentFrame();

  const config = PHASE_CONFIGS[phase] || PHASE_CONFIGS.walk;

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <ThreeCanvas
        width={width}
        height={height}
        camera={{
          fov: 65,
          near: 0.1,
          far: 200,
          position: config.cameraOffset,
        }}
        gl={{
          antialias: true,
          alpha: false,
          powerPreference: "high-performance",
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.0,
        }}
        style={{ position: "absolute", top: 0, left: 0 }}
      >
        <Suspense fallback={null}>
          <SceneContent frame={frame} fps={fps} phase={phase} />
        </Suspense>
      </ThreeCanvas>
    </AbsoluteFill>
  );
};
