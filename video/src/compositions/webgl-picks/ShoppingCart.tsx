// Source: https://tympanus.net/Tutorials/ShoppingCartAnimation/
import React, { useMemo } from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  Easing,
} from "remotion";

// ── Design tokens (from base.scss :root) ──

const BG_COLOR = "#EFEFEF";
const TEXT_COLOR = "#111";
const ACCENT_COLOR = "#D9D9D9";
const HOVER_COLOR = "#C9C9C9";

// ── Layout constants (products.scss, base.scss) ──
// --page-padding at desktop: 2rem 3rem → we use 48px horizontal
const PAGE_PAD_Y = 32; // 2rem
const PAGE_PAD_X = 48; // 3rem
const GRID_COLS = 3;
const GRID_ROWS = 2;
const GRID_GAP = 22; // 2vh at 1080p ≈ 21.6, round to 22

const CARD_W = (1920 - PAGE_PAD_X * 2 - GRID_GAP * (GRID_COLS - 1)) / GRID_COLS;
const CARD_H = 346; // 32vh at 1080p = 345.6
const ITEM_GAP = 22; // gap: 2vh between image and button

// ── Product data (from HTML data attributes) ──

const PRODUCTS = [
  { name: "Product 01", price: 15 },
  { name: "Product 02", price: 8 },
  { name: "Product 03", price: 12 },
  { name: "Product 04", price: 5 },
  { name: "Product 05", price: 20 },
  { name: "Product 06", price: 8 },
];

// ── Product placeholder colors (gradient pairs for visual variety) ──

const PRODUCT_COLORS: [string, string][] = [
  ["#8B6F47", "#C4A882"],
  ["#5A7D6E", "#94B8A7"],
  ["#6B4F8A", "#A088BC"],
  ["#8A5A5A", "#BC8888"],
  ["#4A6B8A", "#7BA0BC"],
  ["#7A6B4A", "#B8A87A"],
];

const GALLERY_COUNT = 6; // 5 gallery images + 1 cover per product

// ── Gallery shade interpolation ──

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
    shades.push(
      `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`,
    );
  }
  return shades;
};

// ── Easing helpers matching GSAP curves ──

const power2Out = Easing.out(Easing.poly(2));
const power2InOut = Easing.inOut(Easing.poly(2));
const expoInOut = Easing.inOut(Easing.exp);

// elastic.out(1.3, 0.9)
const elasticOut = (t: number): number => {
  if (t === 0 || t === 1) return t;
  const p = 0.9;
  const a = 1.3;
  const s = (p / (2 * Math.PI)) * Math.asin(1 / a);
  return (
    a * Math.pow(2, -10 * t) * Math.sin(((t - s) * (2 * Math.PI)) / p) + 1
  );
};

// ── Card grid position helper ──

const cardPosition = (index: number) => {
  const col = index % GRID_COLS;
  const row = Math.floor(index / GRID_COLS);
  const totalGridW = GRID_COLS * CARD_W + (GRID_COLS - 1) * GRID_GAP;
  const totalGridH =
    GRID_ROWS * (CARD_H + ITEM_GAP + 34) + (GRID_ROWS - 1) * GRID_GAP;
  const gridLeft = (1920 - totalGridW) / 2;
  const gridTop = (1080 - totalGridH) / 2;
  const x = gridLeft + col * (CARD_W + GRID_GAP);
  const y = gridTop + row * (CARD_H + ITEM_GAP + 34 + GRID_GAP);
  return { x, y };
};

// Cart button position (top-right corner of frame header, justify-self: end)
const CART_BTN_X = 1920 - PAGE_PAD_X;
const CART_BTN_Y = PAGE_PAD_Y;

// ── Timeline: frame ranges ──

// Event 1: click product 0 (top-left)
const E1_START = 30;
// Event 2: click product 4 (bottom-middle)
const E2_START = 140;
// Cart open/close
const CART_OPEN = 235;
const CART_CLOSE = 275;

// ── Add-to-cart animation state ──
// Faithfully replicates products.js addToCart() GSAP timeline

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
}

const calcAddToCartAnim = (
  frame: number,
  startFrame: number,
  clickedIndex: number,
  fps: number,
): CartAnimState => {
  const t = (frame - startFrame) / fps;

  const isTopRow = clickedIndex < 3;
  const pos = cardPosition(clickedIndex);

  // ── Other products: scale 0.8, autoAlpha 0.05, duration 0.6, stagger 0.04 ──
  // GSAP stagger is sequential (0, 0.04, 0.08, ...) on the otherProducts array
  const otherScales: number[] = [];
  const otherOpacities: number[] = [];

  // Build the otherProducts ordering (same as original: filter by index !== clickedIndex)
  const otherIndices = [0, 1, 2, 3, 4, 5].filter((i) => i !== clickedIndex);

  for (let i = 0; i < 6; i++) {
    if (i === clickedIndex) {
      otherScales.push(1);
      otherOpacities.push(1);
      continue;
    }
    // Sequential stagger position in the otherProducts array
    const staggerPos = otherIndices.indexOf(i);
    const staggerDelay = staggerPos * 0.04;

    // Fade out: start, duration 0.6, stagger 0.04
    const fadeProgress = interpolate(
      t,
      [staggerDelay, staggerDelay + 0.6],
      [0, 1],
      { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: power2Out },
    );

    // Return: start+=1.6, duration 0.8, stagger 0.03
    // Original: tl.to([this.currentProduct, this.otherProducts], { scale:1, autoAlpha:1, duration:0.8, stagger:0.03 }, 'start+=1.6')
    // This animates [currentProduct, ...otherProducts] as one array, so currentProduct is index 0, others follow
    // For otherProducts, their position in [current, ...others] is staggerPos + 1
    const returnStaggerDelay = (staggerPos + 1) * 0.03;
    const returnProgress = interpolate(
      t,
      [1.6 + returnStaggerDelay, 1.6 + returnStaggerDelay + 0.8],
      [0, 1],
      { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: power2Out },
    );

    const scale =
      interpolate(fadeProgress, [0, 1], [1, 0.8]) * (1 - returnProgress) +
      1 * returnProgress;
    const opacity =
      interpolate(fadeProgress, [0, 1], [1, 0.05]) * (1 - returnProgress) +
      1 * returnProgress;

    otherScales.push(scale);
    otherOpacities.push(opacity);
  }

  // ── Current product: scale 1.05, duration 1, start+=0.7 ──
  const currentScaleUp = interpolate(t, [0.7, 1.7], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: power2Out,
  });
  // Return: currentProduct is index 0 in the combined array, stagger 0*0.03 = 0
  const currentScaleDown = interpolate(t, [1.6, 1.6 + 0.8], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: power2Out,
  });
  const currentScale =
    1 + 0.05 * currentScaleUp * (1 - currentScaleDown);

  // ── Gallery items keyframes: start, duration 1.8, stagger { from: 'end', each: 0.04 } ──
  const galleryItems: CartAnimState["galleryItems"] = [];
  const galleryVisible = t >= 0 && t < 2.6;

  for (let i = 0; i < GALLERY_COUNT; i++) {
    // from: 'end' means last item (i=5) staggers first (delay=0), first item (i=0) last
    const staggerFromEnd = (GALLERY_COUNT - 1 - i) * 0.04;
    const itemT = interpolate(
      t,
      [staggerFromEnd, staggerFromEnd + 1.8],
      [0, 1],
      { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
    );

    // GSAP keyframes: 40% first waypoint, 100% destination
    // ease: power2.inOut applied to overall progress
    const eased = power2InOut(itemT);

    if (eased <= 0.4) {
      // Phase 1: 0% → 40%
      const phase1 = eased / 0.4;
      const yOffset = isTopRow
        ? CARD_H * 1.5 * phase1
        : -CARD_H * 1.5 * phase1;
      const s = interpolate(phase1, [0, 1], [1, isTopRow ? 0.8 : 0.5]);
      galleryItems.push({ x: 0, y: yOffset, scale: s, opacity: 1 });
    } else {
      // Phase 2: 40% → 100%
      const phase2 = (eased - 0.4) / 0.6;

      const startY = isTopRow ? CARD_H * 1.5 : -CARD_H * 1.5;
      // Original: this.cartButtonCoords.y - y for top row
      // Original: this.cartButtonCoords.y - y - height + 25 for bottom row
      const endY = isTopRow
        ? CART_BTN_Y - pos.y
        : CART_BTN_Y - pos.y - CARD_H + 25;
      const startX = 0;
      // Original: this.cartButtonCoords.x - right for top row
      // Original: this.cartButtonCoords.x - left - 12 for bottom row
      const endX = isTopRow
        ? CART_BTN_X - (pos.x + CARD_W)
        : CART_BTN_X - pos.x - 12;
      const startScale = isTopRow ? 0.8 : 0.5;

      galleryItems.push({
        x: startX + (endX - startX) * phase2,
        y: startY + (endY - startY) * phase2,
        scale: startScale * (1 - phase2), // → 0 at 100%
        opacity: 1 - phase2, // autoAlpha: 0 at 100%
      });
    }
  }

  // ── Cart button animation: triggered at start+=0.6 ──
  // cartButtonAnimationEnter: label x: -35, duration 0.4, ease power2.out
  const labelT = interpolate(t, [0.6, 1.0], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: power2Out,
  });
  const cartLabelX = -35 * labelT;

  // [number, bg] scale: 1, stagger 0.1, duration 0.8, ease elastic.out(1.3, 0.9)
  const badgeT = interpolate(t, [0.6, 1.4], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const cartBadgeScale = badgeT > 0 ? elasticOut(badgeT) : 0;

  return {
    otherScales,
    otherOpacities,
    currentScale,
    galleryVisible,
    galleryItems,
    cartLabelX,
    cartBadgeScale,
  };
};

// ── Cart panel animation ──
// Faithfully replicates cart.js cartAnimationEnter/Leave GSAP timelines

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

const calcCartPanel = (
  frame: number,
  openFrame: number,
  closeFrame: number,
  fps: number,
): CartPanelState => {
  const openT = (frame - openFrame) / fps;
  const closeT = (frame - closeFrame) / fps;

  // Initial state: xPercent: 110, close: x:30 autoAlpha:0, total: scale:0.9 autoAlpha:0
  if (frame < openFrame) {
    return {
      visible: false,
      bgX: 110,
      innerBgX: 110,
      closeOpacity: 0,
      closeX: 30,
      itemOpacity: 0,
      itemX: 30,
      totalScale: 0.9,
      totalOpacity: 0,
    };
  }

  if (frame >= closeFrame) {
    // cartAnimationLeave:
    // [bg, innerBg]: xPercent 110, stagger 0.1, duration 1.5, expo.inOut → start
    // items: x 30, autoAlpha 0, stagger 0.1, duration 0.8, power2.out → start
    // close: x 30, autoAlpha 0, stagger 0.1, duration 0.8, power2.out → start
    // total: scale 0.9, autoAlpha 0, stagger 0.1, duration 0.8, power2.out → start
    const bgClose = interpolate(closeT, [0, 1.5], [0, 110], {
      extrapolateRight: "clamp",
      easing: expoInOut,
    });
    const innerClose = interpolate(closeT, [0.1, 1.6], [0, 110], {
      extrapolateRight: "clamp",
      easing: expoInOut,
    });
    const itemFade = interpolate(closeT, [0, 0.8], [0, 1], {
      extrapolateRight: "clamp",
      easing: power2Out,
    });
    const closeFade = interpolate(closeT, [0, 0.8], [0, 1], {
      extrapolateRight: "clamp",
      easing: power2Out,
    });
    const totalFade = interpolate(closeT, [0, 0.8], [0, 1], {
      extrapolateRight: "clamp",
      easing: power2Out,
    });

    return {
      visible: closeT < 2,
      bgX: bgClose,
      innerBgX: innerClose,
      closeOpacity: 1 - closeFade,
      closeX: 30 * closeFade,
      itemOpacity: 1 - itemFade,
      itemX: 30 * itemFade,
      totalScale: 1 - 0.1 * totalFade,
      totalOpacity: 1 - totalFade,
    };
  }

  // cartAnimationEnter:
  // [bg, innerBg]: xPercent 0, stagger 0.1, duration 2.2, expo.inOut → start
  // close: x 0, autoAlpha 1, duration 1, power2.out → start+=1.3
  // items: x 0, autoAlpha 1, stagger 0.1, duration 1, power2.out → start+=1.4
  // total: scale 1, autoAlpha 1, duration 1, power2.out → start+=1.6
  const bgOpen = interpolate(openT, [0, 2.2], [110, 0], {
    extrapolateRight: "clamp",
    easing: expoInOut,
  });
  const innerOpen = interpolate(openT, [0.1, 2.3], [110, 0], {
    extrapolateRight: "clamp",
    easing: expoInOut,
  });
  const closeOp = interpolate(openT, [1.3, 2.3], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: power2Out,
  });
  const closeXv = interpolate(openT, [1.3, 2.3], [30, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: power2Out,
  });
  const itemOp = interpolate(openT, [1.4, 2.4], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: power2Out,
  });
  const itemXv = interpolate(openT, [1.4, 2.4], [30, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: power2Out,
  });
  const totalS = interpolate(openT, [1.6, 2.6], [0.9, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: power2Out,
  });
  const totalOp = interpolate(openT, [1.6, 2.6], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: power2Out,
  });

  return {
    visible: true,
    bgX: bgOpen,
    innerBgX: innerOpen,
    closeOpacity: closeOp,
    closeX: closeXv,
    itemOpacity: itemOp,
    itemX: itemXv,
    totalScale: totalS,
    totalOpacity: totalOp,
  };
};

// ── Main component ──

export const ShoppingCart: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

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

  // Cart item count
  const cartCount =
    frame >= E2_START + 18 ? 2 : frame >= E1_START + 18 ? 1 : 0;

  const cartPanel = useMemo(
    () => calcCartPanel(frame, CART_OPEN, CART_CLOSE, fps),
    [frame, fps],
  );

  // Badge persistence: once first item added, badge stays visible
  const badgeVisible = frame >= E1_START + 18;
  const badgeLabelX = (() => {
    if (!badgeVisible) return 0;
    if (activeAnim) return activeAnim.cartLabelX;
    return -35;
  })();
  const badgeScale = (() => {
    if (!badgeVisible) return 0;
    if (activeAnim && activeAnim.cartBadgeScale < 1)
      return activeAnim.cartBadgeScale;
    // Pulse on second add
    if (anim2Active && anim2) {
      const pulseT = interpolate(
        (frame - E2_START) / fps,
        [0.6, 0.8, 1.0],
        [1, 1.3, 1],
        { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
      );
      return pulseT;
    }
    return 1;
  })();

  const allShades = useMemo(
    () => PRODUCT_COLORS.map((pair) => galleryShades(pair, GALLERY_COUNT)),
    [],
  );

  return (
    <AbsoluteFill
      style={{
        backgroundColor: BG_COLOR,
        // Original: neue-haas-grotesk-text (Adobe Typekit). Fallback chain.
        fontFamily:
          '"neue-haas-grotesk-text", "Helvetica Neue", Helvetica, Arial, sans-serif',
        color: TEXT_COLOR,
        overflow: "hidden",
      }}
    >
      {/* ── Noise overlay (globals.scss) ── */}
      {/* Original uses noise.png with keyframe animation. Static approximation here. */}
      <div
        style={{
          position: "absolute",
          top: "-50%",
          left: "-50%",
          width: "200%",
          height: "200%",
          opacity: 1,
          mixBlendMode: "multiply",
          pointerEvents: "none",
          zIndex: 10,
          background:
            "repeating-conic-gradient(rgba(0,0,0,0.06) 0% 25%, transparent 0% 50%) 0 0 / 3px 3px",
        }}
      />

      {/* ── Header (frame, base.scss desktop layout) ── */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          padding: `${PAGE_PAD_Y}px ${PAGE_PAD_X}px`,
          display: "grid",
          gridTemplateColumns: "auto auto auto auto 1fr",
          gridTemplateRows: "auto auto",
          alignContent: "space-between",
          zIndex: 1000,
          pointerEvents: "none",
        }}
      >
        {/* Top row: title, back, github, archive, cart-button */}
        <div
          style={{
            gridArea: "1 / 1",
            fontFamily:
              '"neue-haas-grotesk-display", "Helvetica Neue", Helvetica, Arial, sans-serif',
            fontWeight: 600,
            fontSize: 16,
          }}
        >
          Add-To-Shopping Cart Animation
        </div>
        <a
          style={{
            gridArea: "1 / 2",
            textDecoration: "underline",
            fontSize: 16,
            marginLeft: 32,
          }}
        >
          Tutorial
        </a>
        <a
          style={{
            gridArea: "1 / 3",
            textDecoration: "underline",
            fontSize: 16,
            marginLeft: 32,
          }}
        >
          GitHub
        </a>
        <span style={{ gridArea: "1 / 4" }} />

        {/* Cart button (justify-self: end on the 5th column) */}
        <div
          style={{
            gridArea: "1 / 5",
            justifySelf: "end",
            position: "relative",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            pointerEvents: "all",
          }}
        >
          <div
            style={{
              position: "relative",
              transform: `translateX(${badgeLabelX}px)`,
            }}
          >
            <span style={{ fontSize: 16 }}>Cart</span>
            <span
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
              right: 0,
              top: "50%",
              transform: `translateY(-50%) scale(${badgeScale})`,
              display: "grid",
              gridTemplateAreas: "'element'",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                gridArea: "element",
                width: 25,
                height: 25,
                borderRadius: "50%",
                backgroundColor: ACCENT_COLOR,
              }}
            />
            <span
              style={{
                gridArea: "element",
                fontSize: 12,
                textAlign: "center",
              }}
            >
              {cartCount}
            </span>
          </div>
        </div>

        {/* Bottom row: tags (base.scss frame__tags) */}
        <div
          style={{
            gridArea: "2 / 1 / 3 / 3",
            display: "flex",
            alignItems: "start",
            gap: 16,
            alignSelf: "end",
          }}
        >
          {["shopping-cart", "grid"].map((tag) => (
            <span
              key={tag}
              style={{
                border: `1px solid ${TEXT_COLOR}`,
                borderRadius: 16,
                padding: "1px 6px 3px",
                fontSize: 16,
              }}
            >
              {tag}
            </span>
          ))}
        </div>
      </div>

      {/* ── Product grid (products.scss) ── */}
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
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${GRID_COLS}, 1fr)`,
            gridTemplateRows: `repeat(${GRID_ROWS}, 1fr)`,
            gap: GRID_GAP,
            width: `calc(100% - ${PAGE_PAD_X * 2}px)`,
          }}
        >
          {PRODUCTS.map((product, i) => {
            const isClicked = i === activeClickedIndex;
            const shades = allShades[i];
            const colors = PRODUCT_COLORS[i];

            let cardScale = 1;
            let cardOpacity = 1;

            if (activeAnim && !isClicked) {
              cardScale = activeAnim.otherScales[i];
              cardOpacity = activeAnim.otherOpacities[i];
            }
            if (activeAnim && isClicked) {
              cardScale = activeAnim.currentScale;
            }

            // z-index: nth-child(n) = 7-n (products.scss)
            const zIndex = isClicked ? 10 : 7 - (i + 1);
            const isTopRow = i < 3;
            const transformOrigin = isTopRow ? "top right" : "bottom left";

            return (
              <div
                key={i}
                style={{
                  position: "relative",
                  display: "flex",
                  flexDirection: "column",
                  gap: ITEM_GAP,
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
                    width: "100%",
                    height: CARD_H,
                    overflow: "visible",
                  }}
                >
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
                      {product.name}
                    </span>
                  </div>

                  {/* Gallery overlay — stacked images that fly to cart */}
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
                              {gi + 1} / {GALLERY_COUNT}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Add to cart button (globals.scss .button) */}
                <div
                  style={{
                    placeSelf: "end",
                    fontSize: 15,
                    lineHeight: 1,
                    padding: "8px 10px",
                    backgroundColor:
                      isClicked && activeAnim ? HOVER_COLOR : ACCENT_COLOR,
                    color: TEXT_COLOR,
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
          cursorY = pos.y + CARD_H + ITEM_GAP + 10;
          const clickT = (frame - (E1_START - 8)) / 13;
          cursorOpacity = interpolate(
            clickT,
            [0, 0.3, 0.5, 1],
            [0, 1, 1, 0],
            { extrapolateRight: "clamp" },
          );
        }

        if (frame >= E2_START - 8 && frame <= E2_START + 5) {
          const pos = cardPosition(4);
          cursorX = pos.x + CARD_W - 40;
          cursorY = pos.y + CARD_H + ITEM_GAP + 10;
          const clickT = (frame - (E2_START - 8)) / 13;
          cursorOpacity = interpolate(
            clickT,
            [0, 0.3, 0.5, 1],
            [0, 1, 1, 0],
            { extrapolateRight: "clamp" },
          );
        }

        if (frame >= CART_OPEN - 8 && frame <= CART_OPEN + 5) {
          cursorX = CART_BTN_X - 15;
          cursorY = CART_BTN_Y + 5;
          const clickT = (frame - (CART_OPEN - 8)) / 13;
          cursorOpacity = interpolate(
            clickT,
            [0, 0.3, 0.5, 1],
            [0, 1, 1, 0],
            { extrapolateRight: "clamp" },
          );
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
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path
                d="M2 2L2 16L6.5 12L11 18L14 16.5L9.5 10.5L15 9L2 2Z"
                fill={TEXT_COLOR}
                stroke="white"
                strokeWidth="1"
              />
            </svg>
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

      {/* ── Cart panel (cart.scss) ── */}
      {cartPanel.visible && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: 1920,
            height: 1080,
            zIndex: 1001,
          }}
        >
          {/* cart__bg: rgba(255,255,255,0.8) */}
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

          {/* cart__inner: top 20, right 20, width 600, height calc(100vh-40) */}
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
            {/* cart__inner-bg */}
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                backgroundColor: BG_COLOR,
                zIndex: 0,
                transform: `translateX(${cartPanel.innerBgX}%)`,
              }}
            />

            {/* cart__inner-close */}
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

            {/* cart-items */}
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
              {[PRODUCTS[0], PRODUCTS[4]].map((product, idx) => (
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
                  {/* cart-item__img */}
                  <div
                    style={{
                      width: 100,
                      height: 100,
                      background: `linear-gradient(135deg, ${PRODUCT_COLORS[idx === 0 ? 0 : 4][0]}, ${PRODUCT_COLORS[idx === 0 ? 0 : 4][1]})`,
                    }}
                  />
                  {/* cart-item__details */}
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 20,
                      fontSize: 14,
                      width: "100%",
                    }}
                  >
                    <span style={{ fontWeight: 500 }}>{product.name}</span>
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
                      <span>&euro; {product.price}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* cart-total */}
            <div
              style={{
                position: "relative",
                zIndex: 1,
                width: "100%",
                opacity: cartPanel.totalOpacity,
                transform: `scale(${cartPanel.totalScale})`,
                transformOrigin: "bottom right",
              }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "100px auto",
                  gap: 60,
                }}
              >
                <div />
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(2, 1fr)",
                    gridTemplateRows: "repeat(2, 1fr)",
                    gap: 30,
                  }}
                >
                  <span style={{ fontWeight: 500 }}>Total:</span>
                  <span style={{ textAlign: "right" }}>
                    &euro; {PRODUCTS[0].price + PRODUCTS[4].price}
                  </span>
                  <span style={{ fontSize: 12 }}>
                    Delivery fee and tax
                    <br />
                    calculated at checkout
                  </span>
                  <div
                    style={{
                      placeSelf: "end",
                      fontSize: 15,
                      lineHeight: 1,
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
        </div>
      )}
    </AbsoluteFill>
  );
};
