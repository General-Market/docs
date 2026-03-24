import React, { useMemo } from "react";
import type { EntityDef, Waypoint } from "../types/scene";
import type { PrefabRegistry, PrefabBaseProps } from "../types/prefab";
import type { QualityConfig } from "../types/quality";
import { useQuality } from "../quality";

// ---------------------------------------------------------------------------
// Motion path interpolation
// ---------------------------------------------------------------------------

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

function easeFunc(t: number, type: string): number {
  switch (type) {
    case "linear": return t;
    case "cubic": return t * t * t;
    default: return smoothstep(t);
  }
}

function lerpWaypoints(
  waypoints: Waypoint[],
  t: number,
  easing: string,
): { position: [number, number, number]; rotationY: number } {
  if (waypoints.length === 0) return { position: [0, 0, 0], rotationY: 0 };
  if (waypoints.length === 1) {
    return { position: waypoints[0].position, rotationY: waypoints[0].rotationY ?? 0 };
  }

  // Clamp t
  const ct = Math.max(0, Math.min(1, t));

  // Find the two waypoints we're between
  let i0 = 0;
  for (let i = 0; i < waypoints.length - 1; i++) {
    if (ct >= waypoints[i].t && ct <= waypoints[i + 1].t) {
      i0 = i;
      break;
    }
    if (ct > waypoints[i].t) i0 = i;
  }
  const i1 = Math.min(i0 + 1, waypoints.length - 1);

  if (i0 === i1) {
    return { position: waypoints[i0].position, rotationY: waypoints[i0].rotationY ?? 0 };
  }

  const segT = (ct - waypoints[i0].t) / (waypoints[i1].t - waypoints[i0].t);
  const e = easeFunc(segT, easing);

  const p0 = waypoints[i0].position;
  const p1 = waypoints[i1].position;
  const position: [number, number, number] = [
    p0[0] + (p1[0] - p0[0]) * e,
    p0[1] + (p1[1] - p0[1]) * e,
    p0[2] + (p1[2] - p0[2]) * e,
  ];

  const r0 = waypoints[i0].rotationY ?? 0;
  const r1 = waypoints[i1].rotationY ?? r0;
  const rotationY = r0 + (r1 - r0) * e;

  return { position, rotationY };
}

// ---------------------------------------------------------------------------
// Animation timeline resolution
// ---------------------------------------------------------------------------

function resolveAnimation(
  entity: EntityDef,
  t: number,
): string | undefined {
  // Timeline takes precedence
  if (entity.animations && entity.animations.length > 0) {
    let activeClip = entity.animations[0].clip;
    for (const seg of entity.animations) {
      const start = seg.start ?? 0;
      if (t >= start) activeClip = seg.clip;
    }
    return activeClip;
  }
  // Single animation
  if (entity.animation) return entity.animation.clip;
  return undefined;
}

// ---------------------------------------------------------------------------
// Quality gate
// ---------------------------------------------------------------------------

const QUALITY_ORDER: Record<string, number> = { draft: 0, preview: 1, final: 2 };

function isVisible(entity: EntityDef, quality: QualityConfig, mode: string): boolean {
  if (entity.visible === false) return false;
  if (entity.qualityMin) {
    const minLevel = QUALITY_ORDER[entity.qualityMin] ?? 0;
    const currentLevel = QUALITY_ORDER[mode] ?? 2;
    if (currentLevel < minLevel) return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// EntityRenderer
// ---------------------------------------------------------------------------

export const EntityRenderer: React.FC<{
  entity: EntityDef;
  registry: PrefabRegistry;
  frame: number;
  fps: number;
  durationFrames: number;
  t: number;
}> = ({ entity, registry, frame, fps, durationFrames, t }) => {
  const { mode, config: quality } = useQuality();

  if (!isVisible(entity, quality, mode)) return null;

  const prefab = registry[entity.prefab];
  if (!prefab) {
    if (process.env.NODE_ENV === "development") {
      console.warn(`[EntityRenderer] Unknown prefab: "${entity.prefab}"`);
    }
    return null;
  }

  // Resolve position from motion path or static transform
  const { position, rotationY } = useMemo(() => {
    if (entity.motion && entity.motion.waypoints.length > 0) {
      return lerpWaypoints(entity.motion.waypoints, t, entity.motion.easing ?? "smoothstep");
    }
    return {
      position: entity.transform.position,
      rotationY: entity.transform.rotationY ?? (entity.transform.rotation?.[1] ?? 0),
    };
  }, [entity, t]);

  // Resolve animation
  const animationClip = resolveAnimation(entity, t);

  // Resolve scale
  const s = entity.transform.scale;
  const scale = typeof s === "number" ? s : (Array.isArray(s) ? s[0] : 1);

  const Component = prefab.component;
  const mergedProps = { ...prefab.defaults, ...entity.props };

  const baseProps: PrefabBaseProps = {
    frame,
    fps,
    durationFrames,
    t,
    animationClip,
    position,
    rotationY,
    scale,
  };

  return (
    <Component {...mergedProps} {...baseProps} />
  );
};
