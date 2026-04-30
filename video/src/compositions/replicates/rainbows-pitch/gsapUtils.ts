/**
 * GSAP proxy engine for Remotion — frame-accurate animation via GSAP timelines.
 *
 * Usage:
 *   const s = useGsapProxy(
 *     (tl, p) => {
 *       tl.to(p.title, { opacity: 1, y: 0, duration: 0.4, ease: "power2.out" });
 *       tl.to(p.subtitle, { opacity: 1, duration: 0.3 }, 0.5);
 *     },
 *     { title: { opacity: 0, y: 20 }, subtitle: { opacity: 0 } }
 *   );
 *   // then use s.title.opacity, s.title.y, s.subtitle.opacity in styles
 */

import { useMemo } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { gsap } from "gsap";

export type ProxyState = Record<string, number>;

export function useGsapProxy<T extends Record<string, ProxyState>>(
  buildTimeline: (tl: gsap.core.Timeline, proxies: T) => void,
  proxyKeys: T,
): T {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const { tl, proxies } = useMemo(() => {
    const p = {} as T;
    for (const [k, v] of Object.entries(proxyKeys)) {
      (p as any)[k] = { ...v };
    }
    const timeline = gsap.timeline({ paused: true });
    buildTimeline(timeline, p);
    return { tl: timeline, proxies: p };
  }, []);

  tl.seek(frame / fps);

  const snapshot = {} as T;
  for (const [k, v] of Object.entries(proxies)) {
    (snapshot as any)[k] = { ...v };
  }
  return snapshot;
}

export { gsap };
