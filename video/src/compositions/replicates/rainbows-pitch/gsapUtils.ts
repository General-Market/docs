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

/**
 * Standard entrance easings for Rainbows-Pitch.
 * Out-only: things arriving should decelerate into place, never accelerate out.
 *
 *   HERO_SPRING    — confident overshoot for primary reveals (titles, big cards)
 *   ELEMENT_SPRING — subtle overshoot for text, pills, chrome
 *   SOFT_OUT       — restrained ease-out when a spring would feel cartoonish
 */
export const HERO_SPRING = "back.out(1.8)";
export const ELEMENT_SPRING = "back.out(1.2)";
export const SOFT_OUT = "power3.out";

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
