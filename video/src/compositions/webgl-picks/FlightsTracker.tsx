// Source: https://github.com/jeantimex/flights-tracker
import React, { useMemo } from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  staticFile,
  Easing,
} from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree, useLoader } from "@react-three/fiber";
import * as THREE from "three";

// ── Flight data — representative subset covering major global routes ──

interface FlightDatum {
  departure: { lat: number; lng: number };
  arrival: { lat: number; lng: number };
  speed: number;
}

const FLIGHTS: FlightDatum[] = [
  // North America internal
  { departure: { lat: 40.6413, lng: -73.7781 }, arrival: { lat: 33.9425, lng: -118.4081 }, speed: 520 },
  { departure: { lat: 41.9742, lng: -87.9073 }, arrival: { lat: 25.7959, lng: -80.2870 }, speed: 480 },
  { departure: { lat: 37.6213, lng: -122.3790 }, arrival: { lat: 47.4502, lng: -122.3088 }, speed: 440 },
  { departure: { lat: 33.6407, lng: -84.4277 }, arrival: { lat: 42.3656, lng: -71.0096 }, speed: 500 },
  { departure: { lat: 29.9902, lng: -95.3368 }, arrival: { lat: 39.8561, lng: -104.6737 }, speed: 460 },
  { departure: { lat: 43.6777, lng: -79.6248 }, arrival: { lat: 49.1967, lng: -123.1815 }, speed: 490 },
  // Transatlantic
  { departure: { lat: 40.6413, lng: -73.7781 }, arrival: { lat: 51.4700, lng: -0.4543 }, speed: 550 },
  { departure: { lat: 33.9425, lng: -118.4081 }, arrival: { lat: 49.0097, lng: 2.5479 }, speed: 540 },
  { departure: { lat: 41.9742, lng: -87.9073 }, arrival: { lat: 50.0379, lng: 8.5622 }, speed: 530 },
  { departure: { lat: 42.3656, lng: -71.0096 }, arrival: { lat: 53.3539, lng: -2.2750 }, speed: 510 },
  { departure: { lat: 25.7959, lng: -80.2870 }, arrival: { lat: 40.4936, lng: -3.5668 }, speed: 520 },
  // Europe internal
  { departure: { lat: 51.4700, lng: -0.4543 }, arrival: { lat: 49.0097, lng: 2.5479 }, speed: 400 },
  { departure: { lat: 50.0379, lng: 8.5622 }, arrival: { lat: 41.8003, lng: 12.2389 }, speed: 420 },
  { departure: { lat: 52.3105, lng: 4.7683 }, arrival: { lat: 59.6519, lng: 17.9186 }, speed: 430 },
  { departure: { lat: 40.4936, lng: -3.5668 }, arrival: { lat: 38.2922, lng: 23.9484 }, speed: 450 },
  { departure: { lat: 48.1103, lng: 16.5697 }, arrival: { lat: 55.9736, lng: 37.4125 }, speed: 470 },
  { departure: { lat: 41.2971, lng: 2.0785 }, arrival: { lat: 45.6301, lng: 8.7231 }, speed: 390 },
  // Europe to Asia
  { departure: { lat: 51.4700, lng: -0.4543 }, arrival: { lat: 25.2532, lng: 55.3657 }, speed: 540 },
  { departure: { lat: 49.0097, lng: 2.5479 }, arrival: { lat: 35.5494, lng: 139.7798 }, speed: 560 },
  { departure: { lat: 50.0379, lng: 8.5622 }, arrival: { lat: 22.3080, lng: 113.9185 }, speed: 550 },
  { departure: { lat: 55.9736, lng: 37.4125 }, arrival: { lat: 40.0799, lng: 116.6031 }, speed: 530 },
  // Middle East hub
  { departure: { lat: 25.2532, lng: 55.3657 }, arrival: { lat: 1.3644, lng: 103.9915 }, speed: 530 },
  { departure: { lat: 25.2532, lng: 55.3657 }, arrival: { lat: 19.0896, lng: 72.8656 }, speed: 490 },
  { departure: { lat: 25.2532, lng: 55.3657 }, arrival: { lat: -1.3192, lng: 36.9278 }, speed: 480 },
  { departure: { lat: 25.2532, lng: 55.3657 }, arrival: { lat: 40.6413, lng: -73.7781 }, speed: 560 },
  // Asia internal
  { departure: { lat: 35.5494, lng: 139.7798 }, arrival: { lat: 37.4602, lng: 126.4407 }, speed: 450 },
  { departure: { lat: 22.3080, lng: 113.9185 }, arrival: { lat: 1.3644, lng: 103.9915 }, speed: 460 },
  { departure: { lat: 40.0799, lng: 116.6031 }, arrival: { lat: 31.1443, lng: 121.8083 }, speed: 440 },
  { departure: { lat: 1.3644, lng: 103.9915 }, arrival: { lat: 13.6900, lng: 100.7501 }, speed: 420 },
  { departure: { lat: 35.5494, lng: 139.7798 }, arrival: { lat: 22.3080, lng: 113.9185 }, speed: 510 },
  { departure: { lat: 13.6900, lng: 100.7501 }, arrival: { lat: 19.0896, lng: 72.8656 }, speed: 480 },
  { departure: { lat: 31.1443, lng: 121.8083 }, arrival: { lat: 23.3924, lng: 113.2988 }, speed: 430 },
  // Transpacific
  { departure: { lat: 33.9425, lng: -118.4081 }, arrival: { lat: 35.5494, lng: 139.7798 }, speed: 560 },
  { departure: { lat: 37.6213, lng: -122.3790 }, arrival: { lat: 22.3080, lng: 113.9185 }, speed: 550 },
  { departure: { lat: 47.4502, lng: -122.3088 }, arrival: { lat: 37.4602, lng: 126.4407 }, speed: 540 },
  { departure: { lat: 49.1967, lng: -123.1815 }, arrival: { lat: 35.5494, lng: 139.7798 }, speed: 530 },
  // South America
  { departure: { lat: -23.4356, lng: -46.4731 }, arrival: { lat: -34.8222, lng: -58.5358 }, speed: 440 },
  { departure: { lat: -23.4356, lng: -46.4731 }, arrival: { lat: -12.0219, lng: -77.1143 }, speed: 470 },
  { departure: { lat: -34.8222, lng: -58.5358 }, arrival: { lat: -33.3930, lng: -70.7858 }, speed: 420 },
  { departure: { lat: 4.7016, lng: -74.1469 }, arrival: { lat: 25.7959, lng: -80.2870 }, speed: 490 },
  { departure: { lat: -23.4356, lng: -46.4731 }, arrival: { lat: 51.4700, lng: -0.4543 }, speed: 540 },
  // Africa
  { departure: { lat: -33.9649, lng: 18.6017 }, arrival: { lat: -1.3192, lng: 36.9278 }, speed: 460 },
  { departure: { lat: 30.1219, lng: 31.4056 }, arrival: { lat: 25.2532, lng: 55.3657 }, speed: 470 },
  { departure: { lat: -1.3192, lng: 36.9278 }, arrival: { lat: 51.4700, lng: -0.4543 }, speed: 510 },
  { departure: { lat: 6.5774, lng: 3.3213 }, arrival: { lat: 49.0097, lng: 2.5479 }, speed: 490 },
  { departure: { lat: 33.9272, lng: -6.9008 }, arrival: { lat: 40.4936, lng: -3.5668 }, speed: 410 },
  // Oceania
  { departure: { lat: -33.9461, lng: 151.1772 }, arrival: { lat: 1.3644, lng: 103.9915 }, speed: 520 },
  { departure: { lat: -33.9461, lng: 151.1772 }, arrival: { lat: -37.6690, lng: 144.8410 }, speed: 400 },
  { departure: { lat: -36.8485, lng: 174.7633 }, arrival: { lat: -33.9461, lng: 151.1772 }, speed: 440 },
  { departure: { lat: -33.9461, lng: 151.1772 }, arrival: { lat: 33.9425, lng: -118.4081 }, speed: 560 },
  { departure: { lat: -33.9461, lng: 151.1772 }, arrival: { lat: 25.2532, lng: 55.3657 }, speed: 550 },
  // Additional intercontinental variety
  { departure: { lat: 19.4361, lng: -99.0719 }, arrival: { lat: 40.6413, lng: -73.7781 }, speed: 480 },
  { departure: { lat: 55.9736, lng: 37.4125 }, arrival: { lat: 25.2532, lng: 55.3657 }, speed: 500 },
  { departure: { lat: 22.3080, lng: 113.9185 }, arrival: { lat: -33.9461, lng: 151.1772 }, speed: 510 },
  { departure: { lat: 37.4602, lng: 126.4407 }, arrival: { lat: 33.9425, lng: -118.4081 }, speed: 550 },
  { departure: { lat: 13.6900, lng: 100.7501 }, arrival: { lat: -33.9461, lng: 151.1772 }, speed: 500 },
  { departure: { lat: 19.0896, lng: 72.8656 }, arrival: { lat: 40.6413, lng: -73.7781 }, speed: 540 },
  { departure: { lat: 30.1219, lng: 31.4056 }, arrival: { lat: 40.0799, lng: 116.6031 }, speed: 530 },
  { departure: { lat: -23.4356, lng: -46.4731 }, arrival: { lat: 25.2532, lng: 55.3657 }, speed: 550 },
  { departure: { lat: 59.6519, lng: 17.9186 }, arrival: { lat: 13.6900, lng: 100.7501 }, speed: 520 },
  { departure: { lat: -1.3192, lng: 36.9278 }, arrival: { lat: 19.0896, lng: 72.8656 }, speed: 490 },
  // Russia / Central Asia
  { departure: { lat: 55.9736, lng: 37.4125 }, arrival: { lat: 43.4499, lng: 39.9566 }, speed: 450 },
  { departure: { lat: 55.9736, lng: 37.4125 }, arrival: { lat: 56.7431, lng: 60.8027 }, speed: 460 },
  { departure: { lat: 43.2384, lng: 76.9457 }, arrival: { lat: 40.0799, lng: 116.6031 }, speed: 510 },
  { departure: { lat: 41.2511, lng: 69.2813 }, arrival: { lat: 55.9736, lng: 37.4125 }, speed: 470 },
  // More US routes
  { departure: { lat: 39.8561, lng: -104.6737 }, arrival: { lat: 33.6407, lng: -84.4277 }, speed: 460 },
  { departure: { lat: 32.8998, lng: -97.0403 }, arrival: { lat: 40.6413, lng: -73.7781 }, speed: 500 },
  { departure: { lat: 36.0840, lng: -115.1537 }, arrival: { lat: 21.3187, lng: -157.9225 }, speed: 520 },
  { departure: { lat: 21.3187, lng: -157.9225 }, arrival: { lat: 35.5494, lng: 139.7798 }, speed: 530 },
  // Caribbean / Central America
  { departure: { lat: 18.4393, lng: -66.0018 }, arrival: { lat: 40.6413, lng: -73.7781 }, speed: 440 },
  { departure: { lat: 25.7959, lng: -80.2870 }, arrival: { lat: 23.0000, lng: -82.4090 }, speed: 380 },
  { departure: { lat: 19.4361, lng: -99.0719 }, arrival: { lat: 4.7016, lng: -74.1469 }, speed: 470 },
  // South / Southeast Asia
  { departure: { lat: 7.1808, lng: 79.8841 }, arrival: { lat: 25.2532, lng: 55.3657 }, speed: 480 },
  { departure: { lat: 3.1390, lng: 101.6869 }, arrival: { lat: 1.3644, lng: 103.9915 }, speed: 360 },
  { departure: { lat: 21.2187, lng: 105.8050 }, arrival: { lat: 37.4602, lng: 126.4407 }, speed: 450 },
  { departure: { lat: -6.1256, lng: 106.6559 }, arrival: { lat: 1.3644, lng: 103.9915 }, speed: 410 },
  { departure: { lat: -6.1256, lng: 106.6559 }, arrival: { lat: -33.9461, lng: 151.1772 }, speed: 510 },
  // Nordic
  { departure: { lat: 60.3183, lng: 24.9497 }, arrival: { lat: 55.6180, lng: 12.6508 }, speed: 400 },
  { departure: { lat: 63.6986, lng: -20.2741 }, arrival: { lat: 51.4700, lng: -0.4543 }, speed: 430 },
  // Additional long-haul
  { departure: { lat: -33.9649, lng: 18.6017 }, arrival: { lat: 40.6413, lng: -73.7781 }, speed: 550 },
  { departure: { lat: 30.1219, lng: 31.4056 }, arrival: { lat: 35.5494, lng: 139.7798 }, speed: 540 },
  { departure: { lat: 19.0896, lng: 72.8656 }, arrival: { lat: 1.3644, lng: 103.9915 }, speed: 470 },
  { departure: { lat: 19.0896, lng: 72.8656 }, arrival: { lat: 51.4700, lng: -0.4543 }, speed: 530 },
  // East Africa
  { departure: { lat: -6.8781, lng: 39.2026 }, arrival: { lat: -1.3192, lng: 36.9278 }, speed: 400 },
  { departure: { lat: 9.0235, lng: 38.7989 }, arrival: { lat: 25.2532, lng: 55.3657 }, speed: 460 },
];

// ── Coordinate conversion (matches source exactly) ──

function latLngToVector3(
  lat: number,
  lng: number,
  radius: number,
): THREE.Vector3 {
  const phi = ((90 - lat) * Math.PI) / 180;
  const theta = ((-lng + 180) * Math.PI) / 180;
  const x = radius * Math.sin(phi) * Math.cos(theta);
  const y = radius * Math.cos(phi);
  const z = radius * Math.sin(phi) * Math.sin(theta);
  // Compensate for the globe's -PI/2 Y-rotation
  return new THREE.Vector3(z, y, -x);
}

// ── Build a flight arc (CatmullRomCurve3, same geometry as source) ──

function buildFlightCurve(
  dep: { lat: number; lng: number },
  arr: { lat: number; lng: number },
  radius: number,
): THREE.CatmullRomCurve3 {
  const surfaceOffset = 5;
  const maxCruise = 200;
  const minCruise = 15;

  const origin = latLngToVector3(dep.lat, dep.lng, radius);
  const dest = latLngToVector3(arr.lat, arr.lng, radius);

  const start = origin.clone().normalize().multiplyScalar(radius + surfaceOffset);
  const end = dest.clone().normalize().multiplyScalar(radius + surfaceOffset);

  const distance = start.distanceTo(end);
  const maxDist = radius * Math.PI;
  const ratio = Math.min(distance / (maxDist * 0.3), 1);
  const cruise = minCruise + (maxCruise - minCruise) * Math.pow(ratio, 0.7);

  const lerpAt = (t: number, alt: number) =>
    start
      .clone()
      .lerp(end, t)
      .normalize()
      .multiplyScalar(radius + alt);

  return new THREE.CatmullRomCurve3([
    start,
    lerpAt(0.2, cruise * 0.4),
    lerpAt(0.35, cruise * 0.75),
    lerpAt(0.5, cruise * 0.85),
    lerpAt(0.65, cruise * 0.75),
    lerpAt(0.8, cruise * 0.4),
    end,
  ]);
}

// ── Precomputed arc geometry (done once) ──

interface ArcData {
  positions: Float32Array;
  colors: Float32Array;
  vertexCount: number;
  curve: THREE.CatmullRomCurve3;
  hue: number;
}

const POINTS_PER_ARC = 80;
const EARTH_RADIUS = 3000;

function precomputeArcs(): ArcData[] {
  return FLIGHTS.map((f) => {
    const curve = buildFlightCurve(f.departure, f.arrival, EARTH_RADIUS);
    const pts = curve.getPoints(POINTS_PER_ARC);
    const hue = ((f.departure.lng + 180) % 360) / 360;

    const positions = new Float32Array(pts.length * 3);
    const colors = new Float32Array(pts.length * 3);
    const color = new THREE.Color();

    for (let i = 0; i < pts.length; i++) {
      positions[i * 3] = pts[i].x;
      positions[i * 3 + 1] = pts[i].y;
      positions[i * 3 + 2] = pts[i].z;

      const progress = i / (pts.length - 1);
      color.setHSL(hue, 1.0, 0.3 + progress * 0.4);
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
    }

    return { positions, colors, vertexCount: pts.length, curve, hue };
  });
}

// ── Earth globe component ──

const Globe: React.FC<{ time: number }> = ({ time }) => {
  const texture = useLoader(
    THREE.TextureLoader,
    staticFile("compositions/flights-tracker/world-topo.jpg"),
  );

  const configuredTexture = useMemo(() => {
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.flipY = true;
    return texture;
  }, [texture]);

  return (
    <mesh rotation={[0, -Math.PI / 2, 0]}>
      <sphereGeometry args={[EARTH_RADIUS, 64, 32]} />
      <meshPhongMaterial map={configuredTexture} shininess={10} />
    </mesh>
  );
};

// ── Atmosphere glow ──

const atmosphereVertexShader = `
  varying vec3 vNormal;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const atmosphereFragmentShader = `
  varying vec3 vNormal;
  void main() {
    float intensity = pow(0.6 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.0);
    gl_FragColor = vec4(0.3, 0.6, 1.0, 1.0) * intensity;
  }
`;

const Atmosphere: React.FC = () => (
  <mesh rotation={[0, -Math.PI / 2, 0]}>
    <sphereGeometry args={[EARTH_RADIUS * 1.25, 64, 32]} />
    <shaderMaterial
      vertexShader={atmosphereVertexShader}
      fragmentShader={atmosphereFragmentShader}
      blending={THREE.AdditiveBlending}
      side={THREE.BackSide}
      transparent
      depthWrite={false}
    />
  </mesh>
);

// ── Starfield with twinkling shader ──

const starVertexShader = `
  attribute float opacity;
  varying float vOpacity;
  void main() {
    vOpacity = opacity;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = 3.0;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const starFragmentShader = `
  uniform float time;
  varying float vOpacity;
  void main() {
    float dist = length(gl_PointCoord - vec2(0.5));
    if (dist > 0.5) discard;
    float twinkle = sin(time * vOpacity * 3.0 + vOpacity * 10.0) * 0.3 + 0.7;
    float alpha = (1.0 - dist * 2.0) * twinkle;
    gl_FragColor = vec4(1.0, 1.0, 1.0, alpha);
  }
`;

const Stars: React.FC<{ time: number }> = ({ time }) => {
  const { geometry } = useMemo(() => {
    const count = 4000;
    const pos = new Float32Array(count * 3);
    const opa = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const r = 10000 + Math.random() * 10000;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      pos[i * 3 + 2] = r * Math.cos(phi);
      opa[i] = Math.random();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("opacity", new THREE.BufferAttribute(opa, 1));
    return { geometry: geo };
  }, []);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { time: { value: 0 } },
        vertexShader: starVertexShader,
        fragmentShader: starFragmentShader,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [],
  );

  material.uniforms.time.value = time;

  return <points geometry={geometry} material={material} />;
};

// ── Flight arcs (merged LineSegments with vertex colors) ──

const FlightPaths: React.FC<{ arcs: ArcData[]; fadeIn: number }> = ({
  arcs,
  fadeIn,
}) => {
  const { geometry, material } = useMemo(() => {
    // Convert line strips to line segment pairs
    let totalSegments = 0;
    for (const arc of arcs) {
      totalSegments += (arc.vertexCount - 1) * 2;
    }

    const segPos = new Float32Array(totalSegments * 3);
    const segCol = new Float32Array(totalSegments * 3);
    let offset = 0;

    for (const arc of arcs) {
      for (let i = 0; i < arc.vertexCount - 1; i++) {
        // Start of segment
        segPos[offset * 3] = arc.positions[i * 3];
        segPos[offset * 3 + 1] = arc.positions[i * 3 + 1];
        segPos[offset * 3 + 2] = arc.positions[i * 3 + 2];
        segCol[offset * 3] = arc.colors[i * 3];
        segCol[offset * 3 + 1] = arc.colors[i * 3 + 1];
        segCol[offset * 3 + 2] = arc.colors[i * 3 + 2];
        offset++;
        // End of segment
        segPos[offset * 3] = arc.positions[(i + 1) * 3];
        segPos[offset * 3 + 1] = arc.positions[(i + 1) * 3 + 1];
        segPos[offset * 3 + 2] = arc.positions[(i + 1) * 3 + 2];
        segCol[offset * 3] = arc.colors[(i + 1) * 3];
        segCol[offset * 3 + 1] = arc.colors[(i + 1) * 3 + 1];
        segCol[offset * 3 + 2] = arc.colors[(i + 1) * 3 + 2];
        offset++;
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(segPos, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(segCol, 3));

    const mat = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.6,
    });

    return { geometry: geo, material: mat };
  }, [arcs]);

  material.opacity = 0.6 * fadeIn;

  return <lineSegments geometry={geometry} material={material} />;
};

// ── Animated plane dots traveling along arcs ──

const PlaneDots: React.FC<{
  arcs: ArcData[];
  time: number;
  fadeIn: number;
}> = ({ arcs, time, fadeIn }) => {
  const { geometry, material } = useMemo(() => {
    const count = arcs.length;
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(col, 3));

    const mat = new THREE.PointsMaterial({
      size: 40,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      sizeAttenuation: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    return { geometry: geo, material: mat };
  }, [arcs]);

  // Update dot positions every frame
  const posAttr = geometry.attributes.position as THREE.BufferAttribute;
  const colAttr = geometry.attributes.color as THREE.BufferAttribute;
  const color = new THREE.Color();

  for (let i = 0; i < arcs.length; i++) {
    const arc = arcs[i];
    // Each flight has its own speed/phase offset for visual variety
    const seed = (i * 0.618 + 0.3) % 1;
    const cycleDuration = 4 + seed * 4; // 4-8 second cycles
    const progress = ((time + seed * cycleDuration) % cycleDuration) / cycleDuration;

    const pt = arc.curve.getPointAt(progress);
    const normal = pt.clone().normalize();
    // Lift dot above the arc surface
    const lifted = pt.add(normal.multiplyScalar(12));

    posAttr.setXYZ(i, lifted.x, lifted.y, lifted.z);

    color.setHSL(arc.hue, 0.9, 0.7);
    colAttr.setXYZ(i, color.r, color.g, color.b);
  }

  posAttr.needsUpdate = true;
  colAttr.needsUpdate = true;
  material.opacity = 0.9 * fadeIn;

  return <points geometry={geometry} material={material} />;
};

// ── Scene orchestrator ──

const FlightTrackerScene: React.FC<{
  time: number;
  rotationY: number;
  cameraDistance: number;
  cameraY: number;
  fadeIn: number;
}> = ({ time, rotationY, cameraDistance, cameraY, fadeIn }) => {
  const { camera } = useThree();
  const arcs = useMemo(() => precomputeArcs(), []);

  // Animate camera position
  const cx = Math.sin(rotationY) * cameraDistance;
  const cz = Math.cos(rotationY) * cameraDistance;
  camera.position.set(cx, cameraY, cz);
  camera.lookAt(0, 0, 0);

  // Sun position — offset from camera for day/night contrast
  const sunAngle = rotationY + Math.PI * 0.4;
  const sunX = Math.sin(sunAngle) * EARTH_RADIUS * 3;
  const sunZ = Math.cos(sunAngle) * EARTH_RADIUS * 3;
  const sunY = EARTH_RADIUS * 0.8;

  return (
    <>
      <ambientLight intensity={0.35} />
      <directionalLight
        position={[sunX, sunY, sunZ]}
        intensity={1.2}
        color={0xffffff}
      />

      <Stars time={time} />
      <Globe time={time} />
      <Atmosphere />
      <FlightPaths arcs={arcs} fadeIn={fadeIn} />
      <PlaneDots arcs={arcs} time={time} fadeIn={fadeIn} />
    </>
  );
};

// ── Main composition ──

export const FlightsTracker: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const time = frame / fps;

  // Camera orbit — slow continuous rotation
  const rotationY = interpolate(frame, [0, 480], [0, Math.PI * 0.65], {
    extrapolateRight: "clamp",
  });

  // Camera pulls in slightly over duration
  const cameraDistance = interpolate(frame, [0, 480], [7200, 5800], {
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  // Gentle vertical drift
  const cameraY = interpolate(
    frame,
    [0, 240, 480],
    [1200, 600, 1000],
    { extrapolateRight: "clamp" },
  );

  // Fade in
  const fadeIn = interpolate(frame, [0, 60], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  // Fade out
  const fadeOut = interpolate(frame, [420, 480], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.in(Easing.cubic),
  });

  const opacity = Math.min(fadeIn, fadeOut);

  return (
    <AbsoluteFill style={{ backgroundColor: "#000000" }}>
      <div style={{ width: "100%", height: "100%", opacity }}>
        <ThreeCanvas
          width={width}
          height={height}
          camera={{ position: [0, 1200, 7200], fov: 50, near: 100, far: 30000 }}
          gl={{
            antialias: true,
            alpha: false,
            powerPreference: "high-performance",
            toneMapping: THREE.NoToneMapping,
          }}
          style={{ width: "100%", height: "100%" }}
        >
          <FlightTrackerScene
            time={time}
            rotationY={rotationY}
            cameraDistance={cameraDistance}
            cameraY={cameraY}
            fadeIn={fadeIn}
          />
        </ThreeCanvas>
      </div>
    </AbsoluteFill>
  );
};
