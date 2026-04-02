// Source: https://codepen.io/GreenSock/pen/OPPjMQV
import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  Easing,
} from "remotion";

/**
 * Reproduction of the GSAP ScrollSmoother showcase demo (OPPjMQV).
 *
 * The original: a long-scroll page with ScrollSmoother (smooth: 2, effects: true).
 * Hero section with a large heading at data-speed="0.5" (parallax lag).
 * Content sections with images at data-speed="auto" (parallax within overflow:hidden containers).
 * Text elements with data-lag="0.8" (trailing elasticity).
 * Staggered fade-up reveals on scroll via ScrollTrigger.
 * A compact header that fades in after scrolling past the hero.
 *
 * Here, scroll → frame progress. The entire "page" is ~4x viewport tall,
 * scrolled through over 300 frames. Parallax speeds and lag are computed
 * per-element relative to scroll position, matching the original data-speed
 * and data-lag multipliers.
 */

// ── Layout ──────────────────────────────────────────────────────────────────

const PAGE_HEIGHT = 4320; // total "page" height: 4x 1080
const VP_H = 1080;
const VP_W = 1920;

// ── Color palette (matches the original dark demo) ──────────────────────────

const COLORS = {
  bg: "#0f0f0f",
  surface: "#1a1a2e",
  accent: "#e94560",
  accentSoft: "#ff6b6b",
  text: "#eaeaea",
  textDim: "#888",
  headerBg: "rgba(15, 15, 15, 0.92)",
  cardBg: "#16213e",
  cardBgAlt: "#1a1a2e",
  highlight: "#533483",
};

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Simulate ScrollSmoother data-speed: element scrolls at `speed` * normal rate */
function parallaxY(scrollY: number, elementTop: number, speed: number): number {
  const normalY = -scrollY + elementTop;
  const offset = (speed - 1) * (scrollY - elementTop);
  return normalY + offset;
}

/** Simulate data-lag: element trails behind scroll with lerp-like smoothing.
 *  In a frame-based system we approximate lag as a slight positional offset. */
function lagOffset(scrollY: number, lagAmount: number, fps: number): number {
  return lagAmount * fps * 0.3 * Math.sin(scrollY * 0.002);
}

/** Fade-up reveal: element fades in and translates up when it enters viewport */
function revealProgress(
  scrollY: number,
  elementTop: number,
  threshold: number = VP_H * 0.85,
): number {
  const visibleAt = elementTop - threshold;
  return Math.min(1, Math.max(0, (scrollY - visibleAt) / (VP_H * 0.3)));
}

// ── Section data ────────────────────────────────────────────────────────────

interface ContentSection {
  y: number;
  title: string;
  body: string;
  imageHue: number;
  imageSpeed: number;
  textLag: number;
  align: "left" | "right";
}

const SECTIONS: ContentSection[] = [
  {
    y: 1100,
    title: "Smooth",
    body: "ScrollSmoother adds a buttery-smooth scrolling experience. Native scroll, real scrollbar, no fake containers.",
    imageHue: 340,
    imageSpeed: 0.6,
    textLag: 0.8,
    align: "left",
  },
  {
    y: 1950,
    title: "Parallax",
    body: "data-speed lets any element scroll faster or slower than normal. Images drift. Text lingers. Depth emerges from flatness.",
    imageHue: 260,
    imageSpeed: 1.5,
    textLag: 0.5,
    align: "right",
  },
  {
    y: 2800,
    title: "Lag",
    body: "data-lag makes elements trail behind the scroll. A gentle elastic delay — the content arrives when it arrives.",
    imageHue: 200,
    imageSpeed: 0.8,
    textLag: 1.0,
    align: "left",
  },
  {
    y: 3650,
    title: "Effects",
    body: "Combine speed and lag for rich layered motion. Every section a small revelation. Every scroll a performance.",
    imageHue: 160,
    imageSpeed: 1.3,
    textLag: 0.6,
    align: "right",
  },
];

// ── Placeholder image component (gradient + geometric shape) ────────────────

const PlaceholderImage: React.FC<{
  hue: number;
  width: number;
  height: number;
  parallaxOffset: number;
}> = ({ hue, width, height, parallaxOffset }) => {
  const frame = useCurrentFrame();
  const time = frame / 30;

  // Subtle shimmer
  const shimmer = Math.sin(time * 0.8 + hue) * 0.05 + 0.95;

  return (
    <div
      style={{
        width,
        height,
        borderRadius: 12,
        overflow: "hidden",
        position: "relative",
        boxShadow: `0 20px 60px rgba(0,0,0,0.5)`,
      }}
    >
      {/* Gradient background */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `linear-gradient(135deg,
            hsl(${hue}, 65%, ${18 * shimmer}%) 0%,
            hsl(${hue + 30}, 55%, ${28 * shimmer}%) 50%,
            hsl(${hue + 60}, 45%, ${22 * shimmer}%) 100%)`,
        }}
      />
      {/* Parallax inner element — simulates data-speed="auto" image shift */}
      <div
        style={{
          position: "absolute",
          inset: -40,
          transform: `translateY(${parallaxOffset * 0.5}px)`,
          background: `radial-gradient(ellipse at 50% 50%,
            hsla(${hue + 15}, 70%, 40%, 0.6) 0%,
            transparent 70%)`,
        }}
      />
      {/* Geometric accent */}
      <div
        style={{
          position: "absolute",
          width: width * 0.4,
          height: width * 0.4,
          borderRadius: "50%",
          border: `2px solid hsla(${hue}, 60%, 60%, 0.3)`,
          top: "50%",
          left: "50%",
          transform: `translate(-50%, -50%) scale(${0.9 + Math.sin(time * 0.5) * 0.1})`,
        }}
      />
      {/* Grid lines */}
      {[0.25, 0.5, 0.75].map((frac) => (
        <div
          key={`h-${frac}`}
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: `${frac * 100}%`,
            height: 1,
            background: `hsla(${hue}, 40%, 60%, 0.1)`,
          }}
        />
      ))}
      {[0.33, 0.66].map((frac) => (
        <div
          key={`v-${frac}`}
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: `${frac * 100}%`,
            width: 1,
            background: `hsla(${hue}, 40%, 60%, 0.1)`,
          }}
        />
      ))}
    </div>
  );
};

// ── Staggered dots — decorative detail from the original ────────────────────

const StaggerDots: React.FC<{
  scrollY: number;
  baseY: number;
  x: number;
  count: number;
}> = ({ scrollY, baseY, x, count }) => {
  return (
    <>
      {Array.from({ length: count }, (_, i) => {
        const dotY = baseY + i * 28;
        const reveal = revealProgress(scrollY, dotY, VP_H * 0.7);
        const stagger = i * 0.08;
        const progress = Math.min(1, Math.max(0, reveal - stagger));
        const opacity = interpolate(progress, [0, 1], [0, 0.4], {
          extrapolateRight: "clamp",
        });
        const scale = interpolate(progress, [0, 1], [0, 1], {
          extrapolateRight: "clamp",
        });

        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x,
              top: parallaxY(scrollY, dotY, 0.95) ,
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: COLORS.accent,
              opacity,
              transform: `scale(${scale})`,
            }}
          />
        );
      })}
    </>
  );
};

// ── Main component ──────────────────────────────────────────────────────────

export const GsapSmooth: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const time = frame / fps;

  // Master scroll progress: 0 → 1 over the full duration
  // Eased to simulate ScrollSmoother's smooth: 2 (gentle ease on scroll velocity)
  const rawProgress = frame / durationInFrames;
  const smoothedProgress = interpolate(
    rawProgress,
    [0, 0.02, 0.98, 1],
    [0, 0, 1, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  // Apply smooth easing — the "butter" in buttery smooth
  const easedProgress =
    smoothedProgress < 0.5
      ? 2 * smoothedProgress * smoothedProgress
      : 1 - Math.pow(-2 * smoothedProgress + 2, 2) / 2;

  // Blend: 70% eased (smooth feel) + 30% linear (keeps responsiveness)
  const blendedProgress = easedProgress * 0.3 + smoothedProgress * 0.7;

  const scrollY = blendedProgress * (PAGE_HEIGHT - VP_H);

  // ── Header ──

  const headerOpacity = interpolate(scrollY, [200, 400], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const headerScale = interpolate(scrollY, [200, 400], [0.95, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // ── Hero text: data-speed="0.5" (scrolls at half rate = strong parallax) ──

  const heroTextY = parallaxY(scrollY, 0, 0.5);
  const heroOpacity = interpolate(scrollY, [0, 600], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Hero subtitle: data-speed="0.7"
  const heroSubY = parallaxY(scrollY, 200, 0.7);

  // Hero scroll indicator
  const indicatorPulse = Math.sin(time * 3) * 0.3 + 0.7;
  const indicatorY = parallaxY(scrollY, 900, 0.3);

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bg, overflow: "hidden" }}>
      {/* ── Ambient gradient background ── */}
      <div
        style={{
          position: "absolute",
          width: VP_W * 1.5,
          height: VP_H * 1.5,
          left: "50%",
          top: "50%",
          transform: `translate(-50%, -50%) rotate(${scrollY * 0.02}deg)`,
          background: `radial-gradient(ellipse at 30% 40%,
            ${COLORS.highlight}15 0%, transparent 50%),
            radial-gradient(ellipse at 70% 60%,
            ${COLORS.accent}10 0%, transparent 50%)`,
          opacity: 0.6,
        }}
      />

      {/* ── Fixed header bar ── */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 72,
          background: COLORS.headerBg,
          backdropFilter: "blur(12px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 60px",
          opacity: headerOpacity,
          transform: `scale(${headerScale})`,
          transformOrigin: "top center",
          zIndex: 100,
          borderBottom: `1px solid rgba(255,255,255,0.06)`,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 6,
              background: `linear-gradient(135deg, ${COLORS.accent}, ${COLORS.highlight})`,
            }}
          />
          <span
            style={{
              color: COLORS.text,
              fontSize: 18,
              fontFamily:
                "'Inter', 'SF Pro Display', -apple-system, sans-serif",
              fontWeight: 600,
              letterSpacing: "-0.02em",
            }}
          >
            ScrollSmoother
          </span>
        </div>
        <div style={{ display: "flex", gap: 32 }}>
          {["Smooth", "Parallax", "Lag", "Effects"].map((label) => (
            <span
              key={label}
              style={{
                color: COLORS.textDim,
                fontSize: 14,
                fontFamily:
                  "'Inter', 'SF Pro Display', -apple-system, sans-serif",
                fontWeight: 400,
              }}
            >
              {label}
            </span>
          ))}
        </div>
      </div>

      {/* ── Hero section ── */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 0,
          height: VP_H,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          transform: `translateY(${heroTextY}px)`,
          opacity: heroOpacity,
        }}
      >
        {/* Small eyebrow */}
        <div
          style={{
            color: COLORS.accent,
            fontSize: 14,
            fontFamily:
              "'JetBrains Mono', 'SF Mono', monospace",
            fontWeight: 500,
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            marginBottom: 24,
            transform: `translateY(${heroSubY - heroTextY}px)`,
          }}
        >
          GSAP ScrollSmoother
        </div>

        {/* Main title — large, bold, the hero */}
        <div
          style={{
            color: COLORS.text,
            fontSize: 120,
            fontFamily:
              "'Inter', 'SF Pro Display', -apple-system, sans-serif",
            fontWeight: 800,
            letterSpacing: "-0.04em",
            lineHeight: 1,
            textAlign: "center",
            maxWidth: 1200,
          }}
        >
          Butter.
        </div>

        {/* Subtitle */}
        <div
          style={{
            color: COLORS.textDim,
            fontSize: 22,
            fontFamily:
              "'Inter', 'SF Pro Display', -apple-system, sans-serif",
            fontWeight: 300,
            marginTop: 28,
            textAlign: "center",
            maxWidth: 600,
            lineHeight: 1.6,
            transform: `translateY(${(heroSubY - heroTextY) * 0.5}px)`,
          }}
        >
          Smooth scrolling, parallax effects, and lag-based motion
          — all driven by native scroll.
        </div>
      </div>

      {/* ── Scroll indicator ── */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: "50%",
          transform: `translate(-50%, ${indicatorY}px)`,
          opacity: indicatorPulse * heroOpacity,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 8,
        }}
      >
        <span
          style={{
            color: COLORS.textDim,
            fontSize: 12,
            fontFamily: "'JetBrains Mono', monospace",
            letterSpacing: "0.15em",
            textTransform: "uppercase",
          }}
        >
          Scroll
        </span>
        <div
          style={{
            width: 1,
            height: 40,
            background: `linear-gradient(to bottom, ${COLORS.textDim}, transparent)`,
          }}
        />
      </div>

      {/* ── Content sections ── */}
      {SECTIONS.map((section, idx) => {
        const reveal = revealProgress(scrollY, section.y);
        const easedReveal = Easing.out(Easing.cubic)(Math.min(1, reveal));

        // Image parallax (data-speed on the image)
        const imgY = parallaxY(scrollY, section.y, section.imageSpeed);
        const imgParallaxOffset =
          (section.imageSpeed - 1) * (scrollY - section.y);

        // Text lag (data-lag on text elements)
        const textLagOff = lagOffset(scrollY, section.textLag, fps);
        const textY = parallaxY(scrollY, section.y + 60, 1) + textLagOff;

        // Stagger: title appears first, body follows
        const titleReveal = Math.min(
          1,
          Math.max(0, (easedReveal - 0) / 0.6),
        );
        const bodyReveal = Math.min(
          1,
          Math.max(0, (easedReveal - 0.15) / 0.6),
        );

        const isLeft = section.align === "left";
        const imgX = isLeft ? 100 : VP_W - 100 - 700;
        const textX = isLeft ? VP_W - 100 - 580 : 100;

        return (
          <React.Fragment key={idx}>
            {/* Image */}
            <div
              style={{
                position: "absolute",
                left: imgX,
                top: imgY,
                opacity: interpolate(easedReveal, [0, 0.3], [0, 1], {
                  extrapolateRight: "clamp",
                }),
                transform: `translateY(${(1 - easedReveal) * 60}px) scale(${
                  0.92 + easedReveal * 0.08
                })`,
                transformOrigin: isLeft ? "left center" : "right center",
              }}
            >
              <PlaceholderImage
                hue={section.imageHue}
                width={700}
                height={460}
                parallaxOffset={imgParallaxOffset}
              />
            </div>

            {/* Text block */}
            <div
              style={{
                position: "absolute",
                left: textX,
                top: textY,
                width: 580,
              }}
            >
              {/* Section number */}
              <div
                style={{
                  color: COLORS.accent,
                  fontSize: 13,
                  fontFamily: "'JetBrains Mono', monospace",
                  fontWeight: 500,
                  letterSpacing: "0.15em",
                  marginBottom: 16,
                  opacity: titleReveal,
                  transform: `translateY(${(1 - titleReveal) * 30}px)`,
                }}
              >
                0{idx + 1}
              </div>

              {/* Title */}
              <div
                style={{
                  color: COLORS.text,
                  fontSize: 64,
                  fontFamily:
                    "'Inter', 'SF Pro Display', -apple-system, sans-serif",
                  fontWeight: 700,
                  letterSpacing: "-0.03em",
                  lineHeight: 1.1,
                  marginBottom: 20,
                  opacity: titleReveal,
                  transform: `translateY(${(1 - titleReveal) * 40}px)`,
                }}
              >
                {section.title}
              </div>

              {/* Accent line */}
              <div
                style={{
                  width: interpolate(titleReveal, [0, 1], [0, 60]),
                  height: 3,
                  background: COLORS.accent,
                  borderRadius: 2,
                  marginBottom: 24,
                }}
              />

              {/* Body */}
              <div
                style={{
                  color: COLORS.textDim,
                  fontSize: 18,
                  fontFamily:
                    "'Inter', 'SF Pro Display', -apple-system, sans-serif",
                  fontWeight: 300,
                  lineHeight: 1.7,
                  opacity: bodyReveal,
                  transform: `translateY(${(1 - bodyReveal) * 30}px)`,
                }}
              >
                {section.body}
              </div>

              {/* Speed/lag badge */}
              <div
                style={{
                  marginTop: 28,
                  display: "flex",
                  gap: 12,
                  opacity: bodyReveal,
                  transform: `translateY(${(1 - bodyReveal) * 20}px)`,
                }}
              >
                <span
                  style={{
                    background: "rgba(233, 69, 96, 0.15)",
                    color: COLORS.accentSoft,
                    fontSize: 12,
                    fontFamily: "'JetBrains Mono', monospace",
                    padding: "6px 14px",
                    borderRadius: 6,
                    border: "1px solid rgba(233, 69, 96, 0.2)",
                  }}
                >
                  data-speed=&quot;{section.imageSpeed}&quot;
                </span>
                <span
                  style={{
                    background: "rgba(83, 52, 131, 0.15)",
                    color: "#a78bfa",
                    fontSize: 12,
                    fontFamily: "'JetBrains Mono', monospace",
                    padding: "6px 14px",
                    borderRadius: 6,
                    border: "1px solid rgba(83, 52, 131, 0.2)",
                  }}
                >
                  data-lag=&quot;{section.textLag}&quot;
                </span>
              </div>
            </div>

            {/* Decorative dots */}
            <StaggerDots
              scrollY={scrollY}
              baseY={section.y + 80}
              x={isLeft ? 68 : VP_W - 68}
              count={8}
            />
          </React.Fragment>
        );
      })}

      {/* ── Floating particles — ambient depth ── */}
      {Array.from({ length: 20 }, (_, i) => {
        const seed = i * 137.5;
        const px = ((seed * 7.3) % VP_W);
        const py = ((seed * 11.7) % PAGE_HEIGHT);
        const size = 2 + (i % 3) * 1.5;
        const speed = 0.3 + (i % 5) * 0.2;
        const particleY = parallaxY(scrollY, py, speed);
        const visible =
          particleY > -50 && particleY < VP_H + 50;

        if (!visible) return null;

        return (
          <div
            key={`p-${i}`}
            style={{
              position: "absolute",
              left: px,
              top: particleY,
              width: size,
              height: size,
              borderRadius: "50%",
              background:
                i % 3 === 0
                  ? COLORS.accent
                  : i % 3 === 1
                    ? COLORS.highlight
                    : "rgba(255,255,255,0.15)",
              opacity: 0.25 + Math.sin(time * 0.5 + i) * 0.15,
            }}
          />
        );
      })}

      {/* ── End section / footer ── */}
      {(() => {
        const footerY = parallaxY(scrollY, PAGE_HEIGHT - 300, 0.9);
        const footerReveal = revealProgress(scrollY, PAGE_HEIGHT - 400);
        const footerEased = Easing.out(Easing.cubic)(
          Math.min(1, footerReveal),
        );

        return (
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: footerY,
              height: 300,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              opacity: footerEased,
              transform: `translateY(${(1 - footerEased) * 40}px)`,
            }}
          >
            <div
              style={{
                width: 60,
                height: 3,
                background: COLORS.accent,
                borderRadius: 2,
                marginBottom: 32,
              }}
            />
            <div
              style={{
                color: COLORS.text,
                fontSize: 48,
                fontFamily:
                  "'Inter', 'SF Pro Display', -apple-system, sans-serif",
                fontWeight: 700,
                letterSpacing: "-0.03em",
              }}
            >
              That&apos;s ScrollSmoother.
            </div>
            <div
              style={{
                color: COLORS.textDim,
                fontSize: 16,
                fontFamily:
                  "'Inter', 'SF Pro Display', -apple-system, sans-serif",
                fontWeight: 300,
                marginTop: 16,
              }}
            >
              gsap.com/scrollsmoother
            </div>
          </div>
        );
      })()}

      {/* ── Progress bar (bottom) ── */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          width: VP_W * blendedProgress,
          height: 3,
          background: `linear-gradient(90deg, ${COLORS.accent}, ${COLORS.highlight})`,
          zIndex: 100,
        }}
      />

      {/* ── Vignette overlay ── */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.4) 100%)`,
          pointerEvents: "none",
          zIndex: 50,
        }}
      />
    </AbsoluteFill>
  );
};
