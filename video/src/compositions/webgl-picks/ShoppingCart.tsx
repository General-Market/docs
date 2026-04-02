// Source: https://tympanus.net/Tutorials/ShoppingCartAnimation/
import React, { useMemo } from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  Easing,
} from "remotion";

// ── Layout constants ──

const BG_COLOR = "#EFEFEF";
const TEXT_COLOR = "#111";
const ACCENT_COLOR = "#D9D9D9";
const HOVER_COLOR = "#C9C9C9";

const PAGE_PAD = 48;
const GRID_COLS = 3;
const GRID_ROWS = 2;
const GRID_GAP = 18;

const CARD_W = (1920 - PAGE_PAD * 2 - GRID_GAP * (GRID_COLS - 1)) / GRID_COLS;
const CARD_H = 346; // ~32vh at 1080p
const BTN_H = 34;

const CART_BTN_X = 1920 - PAGE_PAD - 30;
const CART_BTN_Y = PAGE_PAD + 8;

// ── Product placeholder colors (gradient pairs for visual interest) ──

const PRODUCT_COLORS: [string, string][] = [
  ["#8B6F47", "#C4A882"],
  ["#5A7D6E", "#94B8A7"],
  ["#6B4F8A", "#A088BC"],
  ["#8A5A5A", "#BC8888"],
  ["#4A6B8A", "#7BA0BC"],
  ["#7A6B4A", "#B8A87A"],
];

// ── Gallery image placeholders (different shade per "gallery item") ──

const galleryShades = (base: [string, string], count: number): string[] => {
  const shades: string[] = [];
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1);
    const r = Math.round(
      parseInt(base[0].slice(1, 3), 16) * (1 - t) +
        parseInt(base[1].slice(1, 3), 16) * t,
    );
    const g = Math.round(
      parseInt(base[0].slice(3, 5), 16) * (1 - t) +
        parseInt(base[1].slice(3, 5), 16) * t,
    );
    const b = Math.round(
      parseInt(base[0].slice(5, 7), 16) * (1 - t) +
        parseInt(base[1].slice(5, 7), 16) * t,
    );
    shades.push(`#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`);
  }
  return shades;
};

// ── Easing helpers matching GSAP curves ──

const power2Out = Easing.out(Easing.poly(2));
const power2InOut = Easing.inOut(Easing.poly(2));
const expoInOut = Easing.inOut(Easing.exp);

// Elastic out approximation: elastic.out(1.3, 0.9)
const elasticOut = (t: number): number => {
  if (t === 0 || t === 1) return t;
  const p = 0.9;
  const a = 1.3;
  const s = (p / (2 * Math.PI)) * Math.asin(1 / a);
  return a * Math.pow(2, -10 * t) * Math.sin(((t - s) * (2 * Math.PI)) / p) + 1;
};

// ── Card position helper ──

const cardPosition = (index: number) => {
  const col = index % GRID_COLS;
  const row = Math.floor(index / GRID_COLS);
  const x = PAGE_PAD + col * (CARD_W + GRID_GAP);
  const y = 1080 / 2 - (GRID_ROWS * (CARD_H + BTN_H + 18) + GRID_GAP) / 2 + row * (CARD_H + BTN_H + 18 + GRID_GAP);
  return { x, y };
};

// ── Timeline: frame ranges for the two add-to-cart events + cart open/close ──

// Event 1: click product 0 (top-left) — frames 30-110
const E1_START = 30;
// Event 2: click product 4 (bottom-middle) — frames 140-220
const E2_START = 140;
// Cart open — frames 235-290
const CART_OPEN = 235;
const CART_CLOSE = 275;

// ── Add-to-cart animation state calculator ──

interface CartAnimState {
  otherScales: number[];
  otherOpacities: number[];
  currentScale: number;
  galleryVisible: boolean;
  galleryItems: {
    x: number;
    y: number;
    scale: number;
    opacity: number;
  }[];
  cartLabelX: number;
  cartBadgeScale: number;
  cartCount: number;
}

const calcAddToCartAnim = (
  frame: number,
  startFrame: number,
  clickedIndex: number,
  fps: number,
): CartAnimState => {
  const t = (frame - startFrame) / fps; // seconds since start

  const isTopRow = clickedIndex < 3;
  const pos = cardPosition(clickedIndex);

  // Phase durations (matching GSAP timeline)
  // Other products: scale 0.8, opacity 0.05, 0.6s, stagger 0.04
  const otherScales: number[] = [];
  const otherOpacities: number[] = [];
  for (let i = 0; i < 6; i++) {
    if (i === clickedIndex) {
      otherScales.push(1);
      otherOpacities.push(1);
      continue;
    }
    const staggerDelay = Math.abs(i - clickedIndex) * 0.04;

    // Fade out phase: 0 to 0.6s
    const fadeProgress = interpolate(t, [staggerDelay, staggerDelay + 0.6], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: power2Out,
    });

    // Fade back in phase: 1.6s to 2.4s
    const returnProgress = interpolate(t, [1.6 + staggerDelay * 0.75, 1.6 + staggerDelay * 0.75 + 0.8], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: power2Out,
    });

    const scale = interpolate(fadeProgress, [0, 1], [1, 0.8]) * (1 - returnProgress) + 1 * returnProgress;
    const opacity = interpolate(fadeProgress, [0, 1], [1, 0.05]) * (1 - returnProgress) + 1 * returnProgress;

    otherScales.push(scale);
    otherOpacities.push(opacity);
  }

  // Current product scale: starts at 0.7s, 1s duration, to 1.05
  const currentScaleUp = interpolate(t, [0.7, 1.7], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: power2Out,
  });
  const currentScaleDown = interpolate(t, [1.6, 2.4], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: power2Out,
  });
  const currentScale = 1 + 0.05 * currentScaleUp * (1 - currentScaleDown);

  // Gallery items: 6 images, stagger from end, 0.04 each, 1.8s duration
  const GALLERY_COUNT = 6;
  const galleryItems: CartAnimState["galleryItems"] = [];
  const galleryVisible = t >= 0 && t < 2.4;

  for (let i = 0; i < GALLERY_COUNT; i++) {
    const staggerFromEnd = (GALLERY_COUNT - 1 - i) * 0.04;
    const itemT = interpolate(t, [staggerFromEnd, staggerFromEnd + 1.8], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });

    // Keyframes: 0-40% first phase, 40-100% second phase
    if (itemT <= 0.4) {
      const phase1 = itemT / 0.4;
      const eased = power2InOut(phase1);
      const yOffset = isTopRow ? CARD_H * 1.5 * eased : -CARD_H * 1.5 * eased;
      const s = interpolate(eased, [0, 1], [1, isTopRow ? 0.8 : 0.5]);
      galleryItems.push({ x: 0, y: yOffset, scale: s, opacity: 1 });
    } else {
      const phase2 = (itemT - 0.4) / 0.6;
      const eased = power2InOut(phase2);

      // End position: cart button
      const startY = isTopRow ? CARD_H * 1.5 : -CARD_H * 1.5;
      const endY = CART_BTN_Y - pos.y;
      const startX = 0;
      const endX = isTopRow ? CART_BTN_X - (pos.x + CARD_W) : CART_BTN_X - pos.x - 12;
      const startScale = isTopRow ? 0.8 : 0.5;

      galleryItems.push({
        x: startX + (endX - startX) * eased,
        y: startY + (endY - startY) * eased,
        scale: startScale * (1 - eased),
        opacity: 1 - eased,
      });
    }
  }

  // Cart button badge animation: starts at 0.6s
  const badgeT = interpolate(t, [0.6, 1.4], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const cartBadgeScale = badgeT > 0 ? elasticOut(badgeT) : 0;

  // Cart label shift left
  const labelT = interpolate(t, [0.6, 1.0], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: power2Out,
  });
  const cartLabelX = -35 * labelT;

  return {
    otherScales,
    otherOpacities,
    currentScale,
    galleryVisible,
    galleryItems,
    cartLabelX,
    cartBadgeScale,
    cartCount: 0,
  };
};

// ── Cart panel animation ──

interface CartPanelState {
  visible: boolean;
  bgX: number;
  innerBgX: number;
  closeOpacity: number;
  closeX: number;
  itemOpacity: number;
  itemX: number;
  totalScale: number;
  totalOpacity: number;
}

const calcCartPanel = (frame: number, openFrame: number, closeFrame: number, fps: number): CartPanelState => {
  const openT = (frame - openFrame) / fps;
  const closeT = (frame - closeFrame) / fps;

  if (frame < openFrame) {
    return { visible: false, bgX: 110, innerBgX: 110, closeOpacity: 0, closeX: 30, itemOpacity: 0, itemX: 30, totalScale: 0.9, totalOpacity: 0 };
  }

  if (frame >= closeFrame) {
    // Closing animation: 1.5s expo.inOut
    const bgClose = interpolate(closeT, [0, 1.5], [0, 110], { extrapolateRight: "clamp", easing: expoInOut });
    const innerClose = interpolate(closeT, [0.1, 1.6], [0, 110], { extrapolateRight: "clamp", easing: expoInOut });
    const itemClose = interpolate(closeT, [0, 0.8], [0, 1], { extrapolateRight: "clamp", easing: power2Out });
    const closeClose = interpolate(closeT, [0, 0.8], [1, 0], { extrapolateRight: "clamp", easing: power2Out });
    const totalClose = interpolate(closeT, [0, 0.8], [0, 1], { extrapolateRight: "clamp", easing: power2Out });

    return {
      visible: closeT < 2,
      bgX: bgClose,
      innerBgX: innerClose,
      closeOpacity: closeClose,
      closeX: 30 * (1 - closeClose),
      itemOpacity: 1 - itemClose,
      itemX: 30 * itemClose,
      totalScale: 1 - 0.1 * totalClose,
      totalOpacity: 1 - totalClose,
    };
  }

  // Opening animation
  const bgOpen = interpolate(openT, [0, 2.2], [110, 0], { extrapolateRight: "clamp", easing: expoInOut });
  const innerOpen = interpolate(openT, [0.1, 2.3], [110, 0], { extrapolateRight: "clamp", easing: expoInOut });
  const closeOp = interpolate(openT, [1.3, 2.3], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: power2Out });
  const closeXv = interpolate(openT, [1.3, 2.3], [30, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: power2Out });
  const itemOp = interpolate(openT, [1.4, 2.4], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: power2Out });
  const itemXv = interpolate(openT, [1.4, 2.4], [30, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: power2Out });
  const totalS = interpolate(openT, [1.6, 2.6], [0.9, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: power2Out });
  const totalOp = interpolate(openT, [1.6, 2.6], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: power2Out });

  return { visible: true, bgX: bgOpen, innerBgX: innerOpen, closeOpacity: closeOp, closeX: closeXv, itemOpacity: itemOp, itemX: itemXv, totalScale: totalS, totalOpacity: totalOp };
};

// ── Main component ──

export const ShoppingCart: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Compute animation states for both add-to-cart events
  const anim1Active = frame >= E1_START && frame < E1_START + 80;
  const anim2Active = frame >= E2_START && frame < E2_START + 80;

  const anim1 = useMemo(() => {
    if (!anim1Active) return null;
    return calcAddToCartAnim(frame, E1_START, 0, fps);
  }, [frame, anim1Active, fps]);

  const anim2 = useMemo(() => {
    if (!anim2Active) return null;
    return calcAddToCartAnim(frame, E2_START, 4, fps);
  }, [frame, anim2Active, fps]);

  const activeAnim = anim1 || anim2;
  const activeClickedIndex = anim1 ? 0 : anim2 ? 4 : -1;

  // Cart count
  const cartCount = frame >= E2_START + 18 ? 2 : frame >= E1_START + 18 ? 1 : 0;

  // Cart panel
  const cartPanel = useMemo(
    () => calcCartPanel(frame, CART_OPEN, CART_CLOSE, fps),
    [frame, fps],
  );

  // Cart badge persistence: once first item added, badge stays
  const badgeVisible = frame >= E1_START + 18;
  const badgeLabelX = (() => {
    if (!badgeVisible) return 0;
    if (activeAnim) return activeAnim.cartLabelX;
    return -35;
  })();
  const badgeScale = (() => {
    if (!badgeVisible) return 0;
    if (activeAnim && activeAnim.cartBadgeScale < 1) return activeAnim.cartBadgeScale;
    // Pulse on second add
    if (anim2Active && anim2) {
      const pulseT = interpolate((frame - E2_START) / fps, [0.6, 0.8, 1.0], [1, 1.3, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });
      return pulseT;
    }
    return 1;
  })();

  // Product gallery shades
  const allShades = useMemo(
    () => PRODUCT_COLORS.map((pair) => galleryShades(pair, 6)),
    [],
  );

  return (
    <AbsoluteFill
      style={{
        backgroundColor: BG_COLOR,
        fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
        color: TEXT_COLOR,
        overflow: "hidden",
      }}
    >
      {/* ── Noise overlay ── */}
      <div
        style={{
          position: "absolute",
          top: "-50%",
          left: "-50%",
          width: "200%",
          height: "200%",
          opacity: 0.04,
          mixBlendMode: "multiply",
          pointerEvents: "none",
          zIndex: 10,
          background:
            "repeating-conic-gradient(rgba(0,0,0,0.06) 0% 25%, transparent 0% 50%) 0 0 / 3px 3px",
        }}
      />

      {/* ── Header ── */}
      <div
        style={{
          position: "absolute",
          top: PAGE_PAD,
          left: PAGE_PAD,
          right: PAGE_PAD,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          zIndex: 1000,
        }}
      >
        <div>
          <div style={{ fontSize: 16, fontWeight: 600 }}>
            Add-To-Shopping Cart Animation
          </div>
          <div style={{ display: "flex", gap: 16, marginTop: 8, fontSize: 14 }}>
            <span style={{ textDecoration: "underline" }}>Tutorial</span>
            <span style={{ textDecoration: "underline" }}>GitHub</span>
          </div>
        </div>

        {/* Cart button */}
        <div
          style={{
            position: "relative",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
          }}
        >
          <div
            style={{
              position: "relative",
              transform: `translateX(${badgeLabelX}px)`,
            }}
          >
            <span style={{ fontSize: 16 }}>Cart</span>
            <div
              style={{
                position: "absolute",
                bottom: 0,
                left: 0,
                width: "100%",
                height: 1,
                backgroundColor: TEXT_COLOR,
              }}
            />
          </div>
          <div
            style={{
              position: "absolute",
              right: -30,
              top: "50%",
              transform: `translateY(-50%) scale(${badgeScale})`,
              display: "grid",
              placeItems: "center",
              width: 25,
              height: 25,
            }}
          >
            <div
              style={{
                position: "absolute",
                width: 25,
                height: 25,
                borderRadius: "50%",
                backgroundColor: ACCENT_COLOR,
              }}
            />
            <span style={{ position: "relative", fontSize: 12, zIndex: 1 }}>
              {cartCount}
            </span>
          </div>
        </div>
      </div>

      {/* ── Footer tags ── */}
      <div
        style={{
          position: "absolute",
          bottom: PAGE_PAD,
          left: PAGE_PAD,
          display: "flex",
          gap: 16,
          zIndex: 1000,
        }}
      >
        {["shopping-cart", "grid"].map((tag) => (
          <span
            key={tag}
            style={{
              border: `1px solid ${TEXT_COLOR}`,
              borderRadius: 16,
              padding: "1px 8px 3px",
              fontSize: 14,
            }}
          >
            {tag}
          </span>
        ))}
      </div>

      {/* ── Product grid ── */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: 1920,
          height: 1080,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: `0 ${PAGE_PAD}px`,
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${GRID_COLS}, ${CARD_W}px)`,
            gridTemplateRows: `repeat(${GRID_ROWS}, auto)`,
            gap: GRID_GAP,
          }}
        >
          {PRODUCT_COLORS.map((colors, i) => {
            const isClicked = i === activeClickedIndex;
            const shades = allShades[i];

            let cardScale = 1;
            let cardOpacity = 1;

            if (activeAnim && !isClicked) {
              cardScale = activeAnim.otherScales[i];
              cardOpacity = activeAnim.otherOpacities[i];
            }
            if (activeAnim && isClicked) {
              cardScale = activeAnim.currentScale;
            }

            // Z-index: clicked card on top
            const zIndex = isClicked ? 10 : 6 - i;

            // Transform origin for gallery items
            const isTopRow = i < 3;
            const transformOrigin = isTopRow ? "top right" : "bottom left";

            return (
              <div
                key={i}
                style={{
                  position: "relative",
                  display: "flex",
                  flexDirection: "column",
                  gap: 18,
                  transform: `scale(${cardScale})`,
                  opacity: cardOpacity,
                  zIndex,
                  willChange: "transform, opacity",
                }}
              >
                {/* Product image area */}
                <div
                  style={{
                    position: "relative",
                    width: CARD_W,
                    height: CARD_H,
                    overflow: "visible",
                  }}
                >
                  {/* Main cover image */}
                  <div
                    style={{
                      width: "100%",
                      height: "100%",
                      background: `linear-gradient(135deg, ${colors[0]}, ${colors[1]})`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <span
                      style={{
                        color: "rgba(255,255,255,0.4)",
                        fontSize: 18,
                        fontWeight: 500,
                        letterSpacing: 3,
                        textTransform: "uppercase",
                      }}
                    >
                      Product {String(i + 1).padStart(2, "0")}
                    </span>
                  </div>

                  {/* Gallery overlay (stacked images that fly to cart) */}
                  {isClicked && activeAnim && activeAnim.galleryVisible && (
                    <div
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        width: "100%",
                        height: "100%",
                      }}
                    >
                      {activeAnim.galleryItems.map((item, gi) => (
                        <div
                          key={gi}
                          style={{
                            position: "absolute",
                            top: 0,
                            left: 0,
                            width: "100%",
                            height: "100%",
                            transform: `translate(${item.x}px, ${item.y}px) scale(${item.scale})`,
                            opacity: item.opacity,
                            transformOrigin,
                            willChange: "transform, opacity",
                          }}
                        >
                          <div
                            style={{
                              width: "100%",
                              height: "100%",
                              backgroundColor: shades[gi],
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            <span
                              style={{
                                color: "rgba(255,255,255,0.3)",
                                fontSize: 13,
                                letterSpacing: 2,
                              }}
                            >
                              {gi + 1} / 6
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Add to cart button */}
                <div
                  style={{
                    alignSelf: "flex-end",
                    fontSize: 15,
                    lineHeight: 1,
                    padding: "8px 10px",
                    backgroundColor:
                      isClicked && activeAnim ? HOVER_COLOR : ACCENT_COLOR,
                    color: TEXT_COLOR,
                    transition: "none",
                  }}
                >
                  Add to cart
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Click cursor indicator ── */}
      {(() => {
        let cursorOpacity = 0;
        let cursorX = 0;
        let cursorY = 0;

        if (frame >= E1_START - 8 && frame <= E1_START + 5) {
          const pos = cardPosition(0);
          cursorX = pos.x + CARD_W - 40;
          cursorY = pos.y + CARD_H + 30;
          const clickT = (frame - (E1_START - 8)) / 13;
          cursorOpacity = interpolate(clickT, [0, 0.3, 0.5, 1], [0, 1, 1, 0], {
            extrapolateRight: "clamp",
          });
        }

        if (frame >= E2_START - 8 && frame <= E2_START + 5) {
          const pos = cardPosition(4);
          cursorX = pos.x + CARD_W - 40;
          cursorY = pos.y + CARD_H + 30;
          const clickT = (frame - (E2_START - 8)) / 13;
          cursorOpacity = interpolate(clickT, [0, 0.3, 0.5, 1], [0, 1, 1, 0], {
            extrapolateRight: "clamp",
          });
        }

        if (frame >= CART_OPEN - 8 && frame <= CART_OPEN + 5) {
          cursorX = CART_BTN_X - 15;
          cursorY = CART_BTN_Y + 5;
          const clickT = (frame - (CART_OPEN - 8)) / 13;
          cursorOpacity = interpolate(clickT, [0, 0.3, 0.5, 1], [0, 1, 1, 0], {
            extrapolateRight: "clamp",
          });
        }

        if (cursorOpacity <= 0) return null;

        return (
          <div
            style={{
              position: "absolute",
              left: cursorX,
              top: cursorY,
              width: 20,
              height: 20,
              zIndex: 2000,
              opacity: cursorOpacity,
              pointerEvents: "none",
            }}
          >
            {/* Simple cursor arrow */}
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path
                d="M2 2L2 16L6.5 12L11 18L14 16.5L9.5 10.5L15 9L2 2Z"
                fill={TEXT_COLOR}
                stroke="white"
                strokeWidth="1"
              />
            </svg>
            {/* Click ripple */}
            <div
              style={{
                position: "absolute",
                top: -5,
                left: -5,
                width: 30,
                height: 30,
                borderRadius: "50%",
                border: `2px solid ${TEXT_COLOR}`,
                opacity: cursorOpacity * 0.4,
                transform: `scale(${1 + cursorOpacity * 0.5})`,
              }}
            />
          </div>
        );
      })()}

      {/* ── Cart panel (side drawer) ── */}
      {cartPanel.visible && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: 1920,
            height: 1080,
            zIndex: 1001,
          }}
        >
          {/* Frosted background overlay */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              backgroundColor: "rgba(255,255,255,0.8)",
              transform: `translateX(${cartPanel.bgX}%)`,
            }}
          />

          {/* Cart inner panel */}
          <div
            style={{
              position: "absolute",
              top: 20,
              right: 20,
              width: 600,
              height: 1040,
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              padding: "120px 20px 20px",
            }}
          >
            {/* Inner background */}
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                backgroundColor: BG_COLOR,
                transform: `translateX(${cartPanel.innerBgX}%)`,
              }}
            />

            {/* Close button */}
            <div
              style={{
                position: "absolute",
                top: 20,
                right: 20,
                fontSize: 16,
                textDecoration: "underline",
                zIndex: 2,
                opacity: cartPanel.closeOpacity,
                transform: `translateX(${cartPanel.closeX}px)`,
                cursor: "pointer",
              }}
            >
              Close
            </div>

            {/* Cart items */}
            <div
              style={{
                position: "relative",
                display: "flex",
                flexDirection: "column",
                gap: 60,
                zIndex: 1,
                opacity: cartPanel.itemOpacity,
                transform: `translateX(${cartPanel.itemX}px)`,
              }}
            >
              {[
                { name: "Product 01", color: PRODUCT_COLORS[0], price: 15 },
                { name: "Product 05", color: PRODUCT_COLORS[4], price: 20 },
              ].map((item, idx) => (
                <div
                  key={idx}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "100px auto",
                    gap: 60,
                    position: "relative",
                    alignItems: "flex-end",
                  }}
                >
                  <div
                    style={{
                      width: 100,
                      height: 100,
                      background: `linear-gradient(135deg, ${item.color[0]}, ${item.color[1]})`,
                    }}
                  />
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 20,
                      fontSize: 14,
                    }}
                  >
                    <span style={{ fontWeight: 500 }}>{item.name}</span>
                    <div
                      style={{
                        position: "absolute",
                        top: 0,
                        right: 0,
                        fontWeight: 500,
                        color: "rgba(0,0,0,0.2)",
                        textDecoration: "underline",
                      }}
                    >
                      Remove
                    </div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        width: "100%",
                      }}
                    >
                      <span>Quantity:</span>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 20,
                        }}
                      >
                        <span>-</span>
                        <span>1</span>
                        <span>+</span>
                      </div>
                      <span>EUR {item.price}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Cart total */}
            <div
              style={{
                position: "relative",
                zIndex: 1,
                opacity: cartPanel.totalOpacity,
                transform: `scale(${cartPanel.totalScale})`,
                transformOrigin: "bottom right",
              }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 30,
                  marginLeft: 160,
                }}
              >
                <span style={{ fontWeight: 500 }}>Total:</span>
                <span style={{ textAlign: "right" }}>EUR 35</span>
                <span style={{ fontSize: 12 }}>
                  Delivery fee and tax
                  <br />
                  calculated at checkout
                </span>
                <div
                  style={{
                    alignSelf: "end",
                    justifySelf: "end",
                    fontSize: 15,
                    padding: "8px 10px",
                    backgroundColor: ACCENT_COLOR,
                    color: TEXT_COLOR,
                  }}
                >
                  Checkout
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};
