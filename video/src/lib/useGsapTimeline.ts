/**
 * useGsapTimeline — GSAP integration for Remotion
 *
 * Creates a paused GSAP timeline that syncs to Remotion's frame clock.
 * Use GSAP for complex animations (SVG morph, text split, motion paths)
 * that are tedious with interpolate() alone.
 *
 * Usage:
 *   const { tl, containerRef } = useGsapTimeline();
 *
 *   useEffect(() => {
 *     if (!containerRef.current) return;
 *     tl.current
 *       .from(".letter", { opacity: 0, y: 50, stagger: 0.05, ease: "back.out(1.7)" })
 *       .to(".letter", { opacity: 0, scale: 0, stagger: 0.03, ease: "power2.in" }, "+=0.5");
 *   }, []);
 *
 *   return <div ref={containerRef}>...</div>;
 */

import { useRef, useEffect } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { gsap } from "gsap";

// Register plugins once
import { SplitText } from "gsap/SplitText";
import { MorphSVGPlugin } from "gsap/MorphSVGPlugin";
import { MotionPathPlugin } from "gsap/MotionPathPlugin";

gsap.registerPlugin(SplitText, MorphSVGPlugin, MotionPathPlugin);

export function useGsapTimeline() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const tl = useRef<gsap.core.Timeline>(gsap.timeline({ paused: true }));
  const containerRef = useRef<HTMLDivElement>(null);

  // Seek timeline to current frame's time position
  useEffect(() => {
    tl.current.seek(frame / fps);
  }, [frame, fps]);

  return { tl, containerRef, frame, fps };
}

/**
 * Bezier motion path helper — converts tracking data to GSAP MotionPath format.
 *
 * Takes a trajectory from our v3 tracker and returns a GSAP-compatible path.
 */
export function trackingToMotionPath(
  bezierPath: Array<{ x: number; y: number }>
): Array<{ x: number; y: number }> {
  return bezierPath.map((p) => ({ x: p.x, y: p.y }));
}

/**
 * Quick text disintegration — splits text, explodes fragments outward.
 *
 * Usage:
 *   useEffect(() => {
 *     if (!containerRef.current) return;
 *     disintegrateText(tl.current, ".bard-text", { delay: 1.5, duration: 0.8 });
 *   }, []);
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

  // SplitText into characters
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
 *
 * Usage:
 *   useEffect(() => {
 *     morphSVG(tl.current, "#sparkle-path", "#google-g-path", { delay: 2 });
 *   }, []);
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
