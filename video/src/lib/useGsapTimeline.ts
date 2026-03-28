/**
 * useGsapTimeline — GSAP integration for Remotion
 *
 * TWO modes:
 *
 * 1) DOM mode (original) — builds timeline in useEffect targeting real DOM elements.
 *    Works in Studio. For headless rendering, requires effects to fire before screenshot.
 *    Use: const { tl, containerRef, frame, fps } = useGsapTimeline();
 *
 * 2) Proxy mode — animates plain JS objects, read values in render via inline styles.
 *    Works everywhere (Studio + headless). No DOM dependency.
 *    Use: const { tl, frame, fps } = useGsapTimeline();
 *    Then: tl.current.to(proxy.current, { ... })  in useMemo
 *
 * The seek happens in BOTH useEffect (for DOM mode) and useMemo (for proxy mode).
 */

import { useRef, useEffect, useMemo } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { gsap } from "gsap";

// Register plugins once
import { MotionPathPlugin } from "gsap/MotionPathPlugin";
import { MorphSVGPlugin } from "gsap/MorphSVGPlugin";
import { SplitText } from "gsap/SplitText";

gsap.registerPlugin(MotionPathPlugin, MorphSVGPlugin, SplitText);

export function useGsapTimeline() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const tl = useRef<gsap.core.Timeline>(gsap.timeline({ paused: true }));
  const containerRef = useRef<HTMLDivElement>(null);

  // Seek for proxy-mode (synchronous, before render)
  useMemo(() => {
    tl.current.seek(frame / fps);
  }, [frame, fps]);

  // Seek for DOM-mode (after effects fire and timeline is built)
  useEffect(() => {
    tl.current.seek(frame / fps);
  }, [frame, fps]);

  return { tl, containerRef, frame, fps };
}

/**
 * Bezier motion path helper — converts tracking data to GSAP MotionPath format.
 */
export function trackingToMotionPath(
  bezierPath: Array<{ x: number; y: number }>
): Array<{ x: number; y: number }> {
  return bezierPath.map((p) => ({ x: p.x, y: p.y }));
}

/**
 * Quick text disintegration — splits text, explodes fragments outward.
 */
export function disintegrateText(
  timeline: gsap.core.Timeline,
  selector: string,
  options: {
    delay?: number;
    duration?: number;
    spread?: number;
    rotation?: number;
    ease?: string;
  } = {}
) {
  const {
    delay = 0,
    duration = 0.8,
    spread = 200,
    rotation = 360,
    ease = "power2.in",
  } = options;

  const split = new SplitText(selector, { type: "chars" });

  timeline.to(
    split.chars,
    {
      x: () => (Math.random() - 0.5) * spread * 2,
      y: () => (Math.random() - 0.5) * spread * 2,
      rotation: () => (Math.random() - 0.5) * rotation,
      scale: 0,
      opacity: 0,
      duration,
      ease,
      stagger: {
        each: 0.02,
        from: "edges",
      },
    },
    delay
  );

  return split;
}

/**
 * Morph between two SVG paths.
 */
export function morphSVG(
  timeline: gsap.core.Timeline,
  fromSelector: string,
  toPathData: string,
  options: { delay?: number; duration?: number; ease?: string } = {}
) {
  const { delay = 0, duration = 1, ease = "power2.inOut" } = options;

  timeline.to(
    fromSelector,
    {
      morphSVG: toPathData,
      duration,
      ease,
    },
    delay
  );
}

export { gsap, SplitText, MorphSVGPlugin, MotionPathPlugin };
