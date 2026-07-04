// The 3D chart world — everything inside <ThreeCanvas>.
// Real perspective camera driven by measured keyframes (data.ts).
import React, { useMemo } from "react";
import { useCurrentFrame } from "remotion";
import * as THREE from "three";
import { Line } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import {
  ARC_DRAW, BAR, BAR_GROWTH, CANDLES, CHANNEL, COL,
  DASH_SCHEDULE, DOME_H, FPS, GRID, LABELS, MEASURE_DOME, MEASURE_DROP,
  PILL, STOP_LINE, TARGET_LINE, arcPoints, camAt, clamp01, dashPathPoints,
  easeOutCubic, lerpTable,
} from "./data";
import {
  badgeTexture, channelFillTexture, domeFillTexture, gridTexture,
  hatchTexture, labelTexture, pillTexture, shadowTexture,
} from "./textures";

// ─── camera rig ───
const CameraRig: React.FC = () => {
  const frame = useCurrentFrame();
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const pose = camAt(frame);
  camera.position.set(pose.x, pose.y, pose.z);
  camera.rotation.set(0, 0, pose.roll);
  camera.fov = 35.02;
  camera.near = 5;
  camera.far = 4000;
  camera.updateProjectionMatrix();
  return null;
};

// billboard: matches camera roll only (camera has no yaw/pitch)
const useRoll = () => {
  const frame = useCurrentFrame();
  return camAt(frame).roll;
};

// ─── far grid plane ───
const GridPlane: React.FC = () => {
  const tex = useMemo(gridTexture, []);
  const w = 9000;
  const h = 6000;
  tex.repeat.set(w / GRID.cellX, h / GRID.cellY);
  return (
    <mesh position={[110, 0, GRID.z]}>
      <planeGeometry args={[w, h]} />
      <meshBasicMaterial map={tex} />
    </mesh>
  );
};

// ─── support bar ───
const SupportBar: React.FC = () => {
  const frame = useCurrentFrame();
  const hatch = useMemo(hatchTexture, []);
  const shadow = useMemo(shadowTexture, []);
  const right = lerpTable(
    BAR_GROWTH.map(([f, v]) => [f, v] as [number, number]),
    frame,
  );
  const x0 = BAR.x0;
  const w = Math.max(0.01, right - x0);
  const cy = BAR.top - BAR.thickness / 2;
  const innerH = BAR.thickness - 2 * BAR.border;
  hatch.repeat.set(w / 6.5, 1);
  return (
    <group>
      {/* soft drop shadow under the bar */}
      <mesh position={[x0 + w / 2 + 1.2, cy - 2.4, -1.5]}>
        <planeGeometry args={[w + 4, BAR.thickness + 4.5]} />
        <meshBasicMaterial map={shadow} transparent opacity={0.4} depthWrite={false} />
      </mesh>
      {/* border frame */}
      <mesh position={[x0 + w / 2, cy, 0.02]}>
        <planeGeometry args={[w, BAR.thickness]} />
        <meshBasicMaterial color={COL.barBorder} />
      </mesh>
      {/* bright top/bottom edge lines */}
      <mesh position={[x0 + w / 2, BAR.top - BAR.border / 2, 0.03]}>
        <planeGeometry args={[w, BAR.border * 0.55]} />
        <meshBasicMaterial color={COL.barBorderBright} />
      </mesh>
      <mesh position={[x0 + w / 2, BAR.top - BAR.thickness + BAR.border / 2, 0.03]}>
        <planeGeometry args={[w, BAR.border * 0.55]} />
        <meshBasicMaterial color={COL.barBorderBright} />
      </mesh>
      {/* hatched interior */}
      <mesh position={[x0 + w / 2, cy, 0.03]}>
        <planeGeometry args={[w - 2 * BAR.border, innerH]} />
        <meshBasicMaterial map={hatch} />
      </mesh>
    </group>
  );
};

// ─── candles ───
const BODY_W = 0.72;
const WICK_W = 0.16;

const Candles: React.FC = () => {
  const frame = useCurrentFrame();
  const shadow = useMemo(shadowTexture, []);
  return (
    <group>
      {CANDLES.map((c) => {
        if (frame < c.spawn) return null;
        const g = easeOutCubic(clamp01((frame - c.spawn) / Math.max(1, c.grow)));
        const close = c.o + (c.c - c.o) * g;
        const top = Math.max(c.o, close);
        const bot = Math.min(c.o, close);
        const bodyH = Math.max(0.12, top - bot);
        const hi = c.o + (c.h - c.o) * g;
        const lo = c.o + (c.l - c.o) * g;
        const color = c.up ? COL.candleTeal : COL.candleRed;
        return (
          <group key={c.i}>
            <mesh position={[c.i + 0.8, (top + bot) / 2 - 0.9, -1.2]}>
              <planeGeometry args={[3.2, bodyH + 3.2]} />
              <meshBasicMaterial map={shadow} transparent opacity={0.32} depthWrite={false} />
            </mesh>
            <mesh position={[c.i, (hi + lo) / 2, 0.1]}>
              <planeGeometry args={[WICK_W, Math.max(0.05, hi - lo)]} />
              <meshBasicMaterial color={color} />
            </mesh>
            <mesh position={[c.i, (top + bot) / 2, 0.12]}>
              <planeGeometry args={[BODY_W, bodyH]} />
              <meshBasicMaterial color={color} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
};

// ─── glowing purple polyline with progressive draw ───
const GlowLine: React.FC<{
  pts: [number, number][];
  progress: number; // 0..1 by arc length
  width?: number;
  z?: number;
  color?: string;
}> = ({ pts, progress, width = 1.35, z = 0.5, color = COL.purple }) => {
  const { lens, total } = useMemo(() => {
    const ls: number[] = [0];
    let t = 0;
    for (let i = 1; i < pts.length; i++) {
      t += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      ls.push(t);
    }
    return { lens: ls, total: t };
  }, [pts]);
  if (progress <= 0.005) return null;
  const target = total * clamp01(progress);
  const drawn: [number, number, number][] = [];
  for (let i = 0; i < pts.length; i++) {
    if (lens[i] <= target) drawn.push([pts[i][0], pts[i][1], z]);
    else {
      const prev = i - 1;
      const seg = lens[i] - lens[prev];
      const f = (target - lens[prev]) / seg;
      drawn.push([
        pts[prev][0] + (pts[i][0] - pts[prev][0]) * f,
        pts[prev][1] + (pts[i][1] - pts[prev][1]) * f,
        z,
      ]);
      break;
    }
  }
  if (drawn.length < 2) return null;
  return (
    <group>
      <Line points={drawn} color={color} lineWidth={width * 2.8} worldUnits transparent opacity={0.16} />
      <Line points={drawn} color={color} lineWidth={width * 1.6} worldUnits transparent opacity={0.32} />
      <Line points={drawn} color={color} lineWidth={width} worldUnits />
    </group>
  );
};

// ─── dome arc + gradient fill ───
const Dome: React.FC = () => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const pts = useMemo(() => arcPoints(160), []);
  const fillTex = useMemo(domeFillTexture, []);
  // draw: left wall t4.2→5.05 covers 0→0.5 of arc length; then 0.5→1
  let progress = 0;
  if (t >= ARC_DRAW.tStart) {
    if (t < ARC_DRAW.tApex) progress = (0.5 * (t - ARC_DRAW.tStart)) / (ARC_DRAW.tApex - ARC_DRAW.tStart);
    else if (t < ARC_DRAW.tEnd) progress = 0.5 + (0.5 * (t - ARC_DRAW.tApex)) / (ARC_DRAW.tEnd - ARC_DRAW.tApex);
    else progress = 1;
  }
  const fillGeo = useMemo(() => {
    if (progress <= 0.02) return null;
    const upTo = Math.max(2, Math.floor(pts.length * clamp01(progress)));
    const shape = new THREE.Shape();
    shape.moveTo(pts[0][0], 0);
    for (let i = 0; i < upTo; i++) shape.lineTo(pts[i][0], pts[i][1]);
    shape.lineTo(pts[upTo - 1][0], 0);
    shape.closePath();
    const geo = new THREE.ShapeGeometry(shape);
    // uv normalize to dome bbox
    const uv = geo.attributes.uv as THREE.BufferAttribute;
    const posA = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) {
      uv.setXY(
        i,
        (posA.getX(i) - pts[0][0]) / (pts[pts.length - 1][0] - pts[0][0]),
        posA.getY(i) / (DOME_H + 2.2),
      );
    }
    return geo;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Math.round(progress * 160), pts]);
  return (
    <group>
      {fillGeo ? (
        <mesh geometry={fillGeo} position={[0, 0, 0.35]}>
          <meshBasicMaterial map={fillTex} transparent depthWrite={false} />
        </mesh>
      ) : null}
      <GlowLine pts={pts} progress={progress} z={0.55} />
    </group>
  );
};

// ─── handle channel ───
const Channel: React.FC = () => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const fillTex = useMemo(channelFillTexture, []);
  const lo = CHANNEL.lower;
  const up = CHANNEL.upper;
  const pLo = clamp01((t - CHANNEL.drawLower.t0) / (CHANNEL.drawLower.t1 - CHANNEL.drawLower.t0));
  const pUp = clamp01((t - CHANNEL.drawUpper.t0) / (CHANNEL.drawUpper.t1 - CHANNEL.drawUpper.t0));
  const fillGeo = useMemo(() => {
    if (pUp <= 0.02) return null;
    const shape = new THREE.Shape();
    shape.moveTo(lo.x0, lo.y0);
    shape.lineTo(lo.x0 + (lo.x1 - lo.x0) * pUp, lo.y0 + (lo.y1 - lo.y0) * pUp);
    shape.lineTo(up.x0 + (up.x1 - up.x0) * pUp, up.y0 + (up.y1 - up.y0) * pUp);
    shape.lineTo(up.x0, up.y0);
    shape.closePath();
    return new THREE.ShapeGeometry(shape);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Math.round(pUp * 60)]);
  return (
    <group>
      {fillGeo ? (
        <mesh geometry={fillGeo} position={[0, 0, 0.3]}>
          <meshBasicMaterial map={fillTex} transparent depthWrite={false} />
        </mesh>
      ) : null}
      <GlowLine pts={[[lo.x0, lo.y0], [lo.x1, lo.y1]]} progress={pLo} z={0.5} width={1.15} />
      <GlowLine pts={[[up.x0, up.y0], [up.x1, up.y1]]} progress={pUp} z={0.5} width={1.15} />
    </group>
  );
};

// ─── white dashed trace with arrowhead ───
const DashTrace: React.FC = () => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const pts = useMemo(dashPathPoints, []);
  const { lens, total } = useMemo(() => {
    const ls: number[] = [0];
    let acc = 0;
    for (let i = 1; i < pts.length; i++) {
      acc += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      ls.push(acc);
    }
    return { lens: ls, total: acc };
  }, [pts]);
  // schedule maps t → target world-x; convert to arc-length target
  const lenAtX = (x: number): number => {
    for (let i = 1; i < pts.length; i++) {
      if (pts[i][0] >= x) {
        const f = (x - pts[i - 1][0]) / Math.max(1e-6, pts[i][0] - pts[i - 1][0]);
        return lens[i - 1] + (lens[i] - lens[i - 1]) * clamp01(f);
      }
    }
    return total;
  };
  if (t < DASH_SCHEDULE[0][0]) return null;
  const targetX = lerpTable(DASH_SCHEDULE, t);
  const target = lenAtX(targetX);
  const drawn: [number, number, number][] = [];
  let tip: [number, number] = pts[0];
  let dir: [number, number] = [1, 0];
  for (let i = 0; i < pts.length; i++) {
    if (lens[i] <= target) {
      drawn.push([pts[i][0], pts[i][1], 0.8]);
      tip = pts[i];
      if (i > 0) dir = [pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]];
    } else {
      const prev = i - 1;
      const f = (target - lens[prev]) / (lens[i] - lens[prev]);
      tip = [
        pts[prev][0] + (pts[i][0] - pts[prev][0]) * f,
        pts[prev][1] + (pts[i][1] - pts[prev][1]) * f,
      ];
      drawn.push([tip[0], tip[1], 0.8]);
      dir = [pts[i][0] - pts[prev][0], pts[i][1] - pts[prev][1]];
      break;
    }
  }
  const ang = Math.atan2(dir[1], dir[0]);
  return (
    <group>
      {drawn.length >= 2 ? (
        <Line
          points={drawn}
          color="#ffffff"
          lineWidth={0.85}
          worldUnits
          dashed
          dashSize={2.0}
          gapSize={1.3}
        />
      ) : null}
      {/* arrowhead */}
      <mesh position={[tip[0], tip[1], 0.85]} rotation={[0, 0, ang - Math.PI / 2]}>
        <coneGeometry args={[1.2, 2.6, 3]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
    </group>
  );
};

// ─── yellow measure arrow with rotated % label ───
const Measure: React.FC<{
  x: number;
  yTop: number;
  yBot: number;
  t0: number;
  t1: number;
}> = ({ x, yTop, yBot, t0, t1 }) => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const p = easeOutCubic(clamp01((t - t0) / (t1 - t0)));
  const pct = Math.round(p * 100);
  const label = useMemo(() => labelTexture(`${pct}%`, { px: 72 }), [pct]);
  if (t < t0) return null;
  const yEnd = yTop + (yBot - yTop) * p;
  const mid = (yTop + yEnd) / 2;
  const labelH = 2.1;
  return (
    <group>
      <Line
        points={[[x, yTop, 0.7], [x, yEnd, 0.7]]}
        color={COL.yellow}
        lineWidth={0.32}
        worldUnits
      />
      <mesh position={[x, yEnd + 0.9, 0.72]} rotation={[0, 0, Math.PI]}>
        <coneGeometry args={[0.75, 1.8, 3]} />
        <meshBasicMaterial color={COL.yellow} />
      </mesh>
      <mesh position={[x - 1.6, mid, 0.72]} rotation={[0, 0, Math.PI / 2]}>
        <planeGeometry args={[labelH * label.aspect, labelH]} />
        <meshBasicMaterial map={label.tex} transparent depthWrite={false} />
      </mesh>
    </group>
  );
};

// ─── horizontal level line (target / stop-loss) ───
const LevelLine: React.FC<{
  y: number;
  x0: number;
  x1: number;
  t0: number;
  t1: number;
  color: string;
  width?: number;
}> = ({ y, x0, x1, t0, t1, color, width = 0.45 }) => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const p = clamp01((t - t0) / (t1 - t0));
  if (p <= 0.01) return null;
  const xe = x0 + (x1 - x0) * p;
  return (
    <group>
      <Line points={[[x0, y, 0.6], [xe, y, 0.6]]} color={color} lineWidth={width * 2.4} worldUnits transparent opacity={0.2} />
      <Line points={[[x0, y, 0.62], [xe, y, 0.62]]} color={color} lineWidth={width} worldUnits />
    </group>
  );
};

// ─── flat text label on the chart plane ───
const FlatLabel: React.FC<{
  tex: ReturnType<typeof labelTexture>;
  x: number;
  y: number;
  h: number;
  opacity: number;
  billboardRoll?: boolean;
}> = ({ tex, x, y, h, opacity, billboardRoll }) => {
  const roll = useRoll();
  if (opacity <= 0.01) return null;
  return (
    <mesh position={[x, y, 0.9]} rotation={[0, 0, billboardRoll ? roll : 0]}>
      <planeGeometry args={[h * tex.aspect, h]} />
      <meshBasicMaterial map={tex.tex} transparent opacity={opacity} depthWrite={false} />
    </mesh>
  );
};

// ─── typed "SUPPORT ZONE" instances on the bar ───
const FULL_TEXT = "SUPPORT ZONE";
const SupportLabels: React.FC = () => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const pose = camAt(frame);
  return (
    <group>
      {LABELS.supportZone.map((L: {
        x: number;
        typeT0: number;
        typeT1: number;
        fadeT0?: number;
        fadeT1?: number;
        track?: boolean;
      }, k) => {
        if (t < L.typeT0 || t > L.fadeT1!) return null;
        const chars = Math.max(
          1,
          Math.min(
            FULL_TEXT.length,
            Math.floor(((t - L.typeT0) / (L.typeT1 - L.typeT0)) * FULL_TEXT.length) + 1,
          ),
        );
        const text = FULL_TEXT.slice(0, chars);
        const opacity = t < L.fadeT0! ? 1 : 1 - clamp01((t - L.fadeT0!) / (L.fadeT1! - L.fadeT0!));
        const x = L.track && t < L.typeT1 ? pose.x : L.x;
        return <TypedLabel key={k} text={text} x={x} opacity={opacity} />;
      })}
    </group>
  );
};

const TypedLabel: React.FC<{ text: string; x: number; opacity: number }> = ({
  text,
  x,
  opacity,
}) => {
  const tex = useMemo(() => labelTexture(text, { px: 84 }), [text]);
  return <FlatLabel tex={tex} x={x} y={-BAR.thickness / 2} h={2.15} opacity={opacity} />;
};

// ─── breakout pill + badge ───
const BreakoutPill: React.FC = () => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const pill = useMemo(pillTexture, []);
  const badge = useMemo(badgeTexture, []);
  const roll = useRoll();
  if (t < PILL.tCircle) return null;
  const cIn = easeOutCubic(clamp01((t - PILL.tCircle) / 0.35));
  const pIn = easeOutCubic(clamp01((t - PILL.tPill) / 0.4));
  // slight overshoot on the badge pop
  const pop = cIn < 1 ? 1 + 0.25 * Math.sin(cIn * Math.PI) : 1;
  return (
    <group rotation={[0, 0, roll]} position={[PILL.cx, PILL.cy, 1.0]}>
      <mesh scale={[cIn * pop, cIn * pop, 1]}>
        <planeGeometry args={[PILL.circleR * 2.3, PILL.circleR * 2.3]} />
        <meshBasicMaterial map={badge.tex} transparent depthWrite={false} />
      </mesh>
      {pIn > 0.02 ? (
        <mesh
          position={[PILL.pillX0 - PILL.cx + (PILL.pillW / 2) * pIn, PILL.pillCy - PILL.cy, -0.01]}
          scale={[pIn, Math.min(1, pIn * 1.6), 1]}
        >
          <planeGeometry args={[PILL.pillW * 1.13, PILL.pillH * 1.35]} />
          <meshBasicMaterial map={pill.tex} transparent depthWrite={false} opacity={pIn} />
        </mesh>
      ) : null}
    </group>
  );
};

// ─── TARGET / STOP-LOSS labels ───
const LineLabels: React.FC = () => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const target = useMemo(() => labelTexture("TARGET", { px: 90 }), []);
  const stop = useMemo(() => labelTexture("STOP-LOSS", { px: 90 }), []);
  const tl = LABELS.target;
  const sl = LABELS.stopLoss;
  const oT = clamp01((t - tl.t0) / (tl.t1 - tl.t0));
  const oS = clamp01((t - sl.t0) / (sl.t1 - sl.t0));
  return (
    <group>
      <FlatLabel tex={target} x={tl.x} y={tl.y} h={3.1} opacity={oT} billboardRoll />
      <FlatLabel tex={stop} x={sl.x} y={sl.y} h={3.1} opacity={oS} billboardRoll />
    </group>
  );
};

// ─── scene root ───
export const World: React.FC<{ fontReady: boolean }> = ({ fontReady }) => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  return (
    <group key={fontReady ? "f1" : "f0"}>
      <CameraRig />
      <GridPlane />
      <SupportBar />
      <Candles />
      <Dome />
      <Channel />
      <DashTrace />
      {t >= MEASURE_DOME.t0 ? <Measure {...MEASURE_DOME} /> : null}
      {t >= MEASURE_DROP.t0 ? <Measure {...MEASURE_DROP} /> : null}
      <LevelLine {...TARGET_LINE} color={COL.yellow} width={0.5} />
      <LevelLine {...STOP_LINE} color={COL.redLine} width={0.42} />
      <SupportLabels />
      <BreakoutPill />
      <LineLabels />
    </group>
  );
};
