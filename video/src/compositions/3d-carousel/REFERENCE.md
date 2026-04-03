# 3D Gradient Carousel — Complete Source Extraction

Source: https://tympanus.net/Tutorials/3DGradientCarousel/
Author: Clement Grellier
GitHub: https://github.com/clementgrellier/gradientslider

## Images (10 total, all .webp)
- ./img/img01.webp through ./img/img10.webp
- Aspect ratio 4:5 (portrait)
- Sizes: 31KB–110KB

---

## EXACT NUMERICAL VALUES

### CSS Custom Properties
```
--bg: #f0f0f0
--fg: #0b0b0b
--perspective: 1800px
--ease: cubic-bezier(0.22, 1, 0.36, 1)
```

### Card Dimensions
```
width: min(26vw, 360px)
aspect-ratio: 4/5
```
So at 1920px viewport: 26vw = 499.2px width, height = 499.2 * 1.25 = 624px
Capped at 360px width, 450px height.

### Card CSS
```css
position: absolute
top: 50%
left: 50%
isolation: isolate
transform-style: preserve-3d
backface-visibility: hidden
will-change: transform, filter
transform-origin: 90% center
contain: layout paint
```

### Card Image
```css
border-radius: 15px
opacity: 1
width: 100%
height: 100%
object-fit: cover
display: block
transform: translateZ(0)
pointer-events: none
```

### Container (.cards)
```css
position: absolute
inset: 0
z-index: 10
transform-style: preserve-3d
```

### Stage (.stage)
```css
position: relative
width: 100vw
height: 100vh
background: var(--bg)  /* #f0f0f0 */
overflow: hidden
perspective: 1800px
overscroll-behavior: none
user-select: none
```

---

## PHYSICS CONSTANTS

```js
FRICTION = 0.9           // Velocity decay per frame (0-1)
WHEEL_SENS = 0.6         // Mouse wheel sensitivity multiplier
DRAG_SENS = 1.0          // Drag sensitivity multiplier
```

### Friction Application
```js
// Per-frame decay (framerate-independent):
const decay = Math.pow(FRICTION, dt * 60);
vX *= decay;
if (Math.abs(vX) < 0.02) vX = 0;  // Dead zone threshold
```

### Wheel Handler
```js
const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
vX += delta * WHEEL_SENS * 20;  // Effective multiplier: 0.6 * 20 = 12
```

### Drag Handler
```js
// On pointermove:
SCROLL_X = mod(SCROLL_X - dx * DRAG_SENS, TRACK);
lastDelta = dx / dt;  // Track velocity for momentum

// On pointerup:
vX = -lastDelta * DRAG_SENS;  // Apply final velocity as momentum
```

### Scroll Position Update (per tick)
```js
SCROLL_X = mod(SCROLL_X + vX * dt, TRACK);
```

---

## VISUAL CONSTANTS

```js
MAX_ROTATION = 28        // Maximum rotateY in degrees
MAX_DEPTH = 140          // Maximum translateZ in pixels
MIN_SCALE = 0.92         // Minimum scale for cards
SCALE_RANGE = 0.1        // Scale variation range (0.92 to 1.02)
GAP = 28                 // Gap between cards in pixels
```

---

## TRANSFORM FORMULA

```js
function computeTransformComponents(screenX) {
  // screenX = card position relative to viewport center
  // VW_HALF = window.innerWidth * 0.5

  const norm = Math.max(-1, Math.min(1, screenX / VW_HALF));
  // norm: -1 (far left) to +1 (far right), clamped

  const absNorm = Math.abs(norm);
  const invNorm = 1 - absNorm;  // 1 at center, 0 at edges

  const ry = -norm * MAX_ROTATION;
  // rotateY: -28deg (right edge) to +28deg (left edge)
  // Cards at center: 0deg
  // Cards to the right: rotated toward viewer on left side
  // Cards to the left: rotated toward viewer on right side

  const tz = invNorm * MAX_DEPTH;
  // translateZ: 140px at center, 0px at edges

  const scale = MIN_SCALE + invNorm * SCALE_RANGE;
  // scale: 1.02 at center (0.92 + 0.1), 0.92 at edges

  return { norm, absNorm, invNorm, ry, tz, scale };
}

// Final transform string:
`translate3d(${screenX}px, -50%, ${tz}px) rotateY(${ry}deg) scale(${scale})`
```

### z-index Calculation
```js
it.el.style.zIndex = String(1000 + Math.round(z));
// z = tz (0-140), so zIndex ranges from 1000 to 1140
// Cards closer to camera get higher z-index
```

---

## BLUR FORMULA

```js
// Only applied to non-core cards (not center, prev, or next)
const isCore = i === closestIdx || i === prevIdx || i === nextIdx;
const blur = isCore ? 0 : 2 * Math.pow(Math.abs(norm), 1.1);
// blur: 0px for center+adjacent, up to ~2px at edges
// Power of 1.1 means slightly accelerating blur curve
```

---

## INFINITE SCROLL / WRAPPING LOGIC

```js
// Safe modulo:
function mod(n, m) { return ((n % m) + m) % m; }

// Track layout:
STEP = CARD_W + GAP;           // e.g. 360 + 28 = 388px between card centers
TRACK = items.length * STEP;   // e.g. 10 * 388 = 3880px total track

// Each card has a base position:
items[i].x = i * STEP;

// Position wrapping (per frame):
let pos = items[i].x - SCROLL_X;
if (pos < -half) pos += TRACK;   // half = TRACK / 2
if (pos > half) pos -= TRACK;
// This wraps cards to stay within [-TRACK/2, TRACK/2] of center
```

---

## BACKGROUND GRADIENT

### Canvas Setup
```css
#bg {
  position: absolute
  inset: 0
  z-index: 0
  width: 100%
  height: 100%
  filter: blur(24px) saturate(1.05)
  pointer-events: none
}
```

### Canvas Sizing (DPR-aware)
```js
const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
// Capped at 2x for performance
bgCanvas.width = Math.floor(w * dpr);
bgCanvas.height = Math.floor(h * dpr);
bgCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
```

### Gradient Drawing Algorithm
```js
// Base fill:
bgCtx.fillStyle = '#f6f7f9';
bgCtx.fillRect(0, 0, w, h);

// Animated center positions (floating/orbiting):
const time = now * 0.0002;  // Very slow time factor
const cx = w * 0.5;
const cy = h * 0.5;
const a1 = Math.min(w, h) * 0.35;  // Amplitude 1
const a2 = Math.min(w, h) * 0.28;  // Amplitude 2

// Gradient 1 center (Lissajous-like orbit):
const x1 = cx + Math.cos(time) * a1;
const y1 = cy + Math.sin(time * 0.8) * a1 * 0.4;

// Gradient 2 center (counter-orbiting):
const x2 = cx + Math.cos(-time * 0.9 + 1.2) * a2;
const y2 = cy + Math.sin(-time * 0.7 + 0.7) * a2 * 0.5;

// Gradient radii:
const r1 = Math.max(w, h) * 0.75;
const r2 = Math.max(w, h) * 0.65;

// First radial gradient:
createRadialGradient(x1, y1, 0, x1, y1, r1)
  stop 0: rgba(R1, G1, B1, 0.85)
  stop 1: rgba(255, 255, 255, 0)

// Second radial gradient:
createRadialGradient(x2, y2, 0, x2, y2, r2)
  stop 0: rgba(R2, G2, B2, 0.70)
  stop 1: rgba(255, 255, 255, 0)
```

### Gradient Color Transition (GSAP)
```js
// On card change:
gsap.to(gradCurrent, { ...targetColors, duration: 0.45, ease: 'power2.out' });
// gradCurrent = { r1, g1, b1, r2, g2, b2 }
// Initial: r1=240, g1=240, b1=240, r2=235, g2=235, b2=235
```

### Render Throttling
```js
// During transition (800ms after card change): 60fps (16ms interval)
// At rest: 30fps (33ms interval)
const minInterval = now < bgFastUntil ? 16 : 33;
```

---

## COLOR EXTRACTION ALGORITHM

### Downscaling
```js
const MAX = 48;  // Max dimension for analysis
// Maintains aspect ratio, min 16px on short side
```

### Histogram Binning
```js
const H_BINS = 36;  // 10-degree hue increments (360/36)
const S_BINS = 5;   // 20% saturation increments
const SIZE = H_BINS * S_BINS;  // 180 total bins
```

### Pixel Filtering
```js
// Skip if: alpha < 0.05, lightness < 0.1, lightness > 0.92, saturation < 0.08
if (l < 0.1 || l > 0.92 || s < 0.08) continue;
```

### Pixel Weighting
```js
const w = a * (s * s) * (1 - Math.abs(l - 0.5) * 0.6);
// Favors: high alpha, high saturation (squared), mid-tone lightness
```

### Primary Color Selection
- Bin with highest accumulated weight

### Secondary Color Selection
- Must be >= 25 degrees away from primary hue
- Must have weight >= 60% of primary weight
- If no qualifying secondary: use lighter version of primary at L=0.72

### Color Enhancement
```js
// Primary: boost saturation by 1.15x, clamp to [0.45, 1.0], lightness = 0.5
s1 = Math.max(0.45, Math.min(1, s1 * 1.15));
c1 = hslToRgb(h1, s1, 0.5);

// Secondary (distinct): boost by 1.05x, lightness = 0.72
s2 = Math.max(0.45, Math.min(1, s2 * 1.05));
c2 = hslToRgb(h2, s2, 0.72);

// Secondary (from primary): same hue/sat as primary, lightness = 0.72
c2 = hslToRgb(h1, s1, 0.72);
```

### Fallback Colors (if extraction fails)
```js
const h = (idx * 37) % 360;  // Spread hues by golden-angle-ish
const s = 0.65;
c1 = hslToRgb(h, s, 0.52);
c2 = hslToRgb(h, s, 0.72);
```

---

## GSAP ENTRY ANIMATION

### Timeline Structure
```js
const tl = gsap.timeline();

// Per card (staggered by 0.05s):
tl.to(state, {
  p: 1,                    // 0 -> 1 progress
  duration: 0.6,
  ease: 'power3.out',
  // onUpdate applies interpolated transform
}, idx * 0.05);            // Stagger: 50ms between cards
```

### Entry Start State
```js
const START_SCALE = 0.92;
const START_Y = 40;        // 40px below final position
opacity: 0;

// Initial transform:
`translate3d(${screenX}px, -50%, ${tz}px) rotateY(${ry}deg) scale(0.92) translateY(40px)`
```

### Entry Animation Interpolation
```js
// For each progress value t (0->1):
const currentScale = START_SCALE + (baseScale - START_SCALE) * t;
// START_SCALE=0.92, baseScale depends on position (0.92-1.02)

const currentY = START_Y * (1 - t);
// 40px -> 0px

const opacity = t;
// 0 -> 1

// At t >= 0.999: snaps to final computed transform
```

### Entry Card Selection
```js
// Only cards within 60% of viewport width from center are animated
if (Math.abs(screenX) < viewportWidth * 0.6) {
  visibleCards.push(...);
}
// Sorted left-to-right before staggering
```

---

## INTERACTION STATES

### Cursor
```css
.stage.carousel-mode { cursor: grab; touch-action: none; }
.stage.carousel-mode.dragging { cursor: grabbing; }
```

### Pointer Capture
- Uses setPointerCapture/releasePointerCapture for reliable drag tracking

### Resize Handling
```js
// Debounced at 80ms
// Preserves scroll ratio: ratio = SCROLL_X / (items.length * prevStep)
// Reapplies after remeasuring: SCROLL_X = mod(ratio * TRACK, TRACK)
```

### Visibility Change
- Cancels both animation loops when tab hidden
- Restarts both when tab visible again

---

## GPU WARMUP (Compositing Pre-heat)

```js
// Scrolls through entire carousel in 0.5*STEP increments
// Forces rAF paint every 3 steps
// Prevents first-interaction jank from GPU layer creation
const stepSize = STEP * 0.5;
const numSteps = Math.ceil(TRACK / stepSize);
```

---

## FULL CSS (styles.css)

```css
* { box-sizing: border-box; }
html, body { height: 100%; }
body { margin: 0; }

:root {
  --bg: #f0f0f0;
  --fg: #0b0b0b;
  --perspective: 1800px;
  --ease: cubic-bezier(0.22, 1, 0.36, 1);
}

.stage {
  position: relative;
  width: 100vw;
  height: 100vh;
  background: var(--bg);
  color: var(--fg);
  overflow: hidden;
  perspective: var(--perspective);
  overscroll-behavior: none;
  -webkit-user-select: none;
  user-select: none;
}

.loader {
  position: absolute;
  inset: 0;
  z-index: 100;
  display: grid;
  place-items: center;
  background: #ffffff;
  transition: opacity 0.2s var(--ease), visibility 0.2s linear;
}
.loader--hide { opacity: 0; visibility: hidden; }
.loader__content { display: grid; gap: 12px; justify-items: center; min-width: 220px; }
.loader__ring {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 3px solid #ddd;
  border-top-color: #333;
  animation: spin 1s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

#bg {
  position: absolute;
  inset: 0;
  z-index: 0;
  width: 100%;
  height: 100%;
  display: block;
  filter: blur(24px) saturate(1.05);
  pointer-events: none;
}

.stage.carousel-mode { touch-action: none; cursor: grab; }
.stage.carousel-mode.dragging { cursor: grabbing; }

.cards {
  position: absolute;
  inset: 0;
  z-index: 10;
  transform-style: preserve-3d;
}

.card {
  position: absolute;
  top: 50%;
  left: 50%;
  width: min(26vw, 360px);
  aspect-ratio: 4/5;
  isolation: isolate;
  transform-style: preserve-3d;
  backface-visibility: hidden;
  will-change: transform, filter;
  transform-origin: 90% center;
  contain: layout paint;
}

.card__img {
  border-radius: 15px;
  opacity: 1;
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transform: translateZ(0);
  pointer-events: none;
  -webkit-user-drag: none;
  user-select: none;
}

@media (prefers-reduced-motion: reduce) {
  .card { transition: none !important; animation: none !important; }
}
```
