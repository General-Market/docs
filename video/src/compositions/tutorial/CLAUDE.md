## Tutorial Composition — Local Rules

### SFX: WHITELIST ONLY

Only use SFX from the reviewed whitelist (`public/sfx/sfx-review.json` where value = "white"). Using blacklisted SFX will fail review.

**62 whitelisted SFX:**
```
balloon-pop, bass-drop-clean, bass-drop-ripple, bass-drop-sub, boom-cinematic,
cash-register-classic, code-compile-success, comedy-bounce-series, comedy-plop,
comedy-rubber-duck, comedy-sad-tuba, comedy-zip, cursor-click-soft, cut-fast-swish,
dramatic-countdown-tick, dramatic-danger-warning, dramatic-explosion,
dramatic-heartbeat-fast, dramatic-reveal, dramatic-suspense-drone,
drop-cinematic-hit, energy-lighter-flick, energy-match-strike, env-clock-tick,
glitch-short, heartbeat, hit-punch-body, hit-slap, impact-kick,
logo-shimmer-resolve, metal-coin-flip, metal-gate-open, metal-latch-unlock,
metric-count-up, money-count, nature-rain-heavy, object-balloon-pop,
object-cork-pop, object-door-slam, phone-notification, phys-stomp-heavy,
pop-cork, scroll-tick, shape-drop-bounce, shape-settle-line, static-radio,
stinger-logo-reveal, text-appear-blip, text-glitch-reveal, text-knock-wood,
text-pop-rapid-sequence, text-shatter-glass, tool-knife-sharpen,
tool-sewing-machine, transition-bridge, vehicle-car-engine, vehicle-rocket-launch,
vehicle-tire-screech, whoosh-flyby-jet, whoosh-punch, whoosh-scene-grid,
whoosh-spin-fast
```

**Recommended mapping for this video:**
- Title cards / bold text: `text-appear-blip`, `text-glitch-reveal`
- Bullet points appearing: `text-pop-rapid-sequence`, `scroll-tick`
- Scene transitions: `cut-fast-swish`, `whoosh-scene-grid`
- Checkmarks: `cursor-click-soft`, `metal-latch-unlock`
- Numbers/counters: `metric-count-up`, `money-count`
- Terminal typing: `cursor-click-soft` (rapid)
- Bot ready: `code-compile-success`
- Insert cards: `dramatic-reveal`, `logo-shimmer-resolve`
- Key impact moments: `boom-cinematic`, `drop-cinematic-hit`
- End card: `stinger-logo-reveal`

### Imports
- Colors: `import { C } from "../../../common/colors"`
- Fonts: `import { font, monoFont } from "../../../common/fonts"`
- Easing: `import { EASE } from "../../../common/easing"`
- Utility: `import { lerp } from "../../../common/utils"`
- Reusable: `import { TextTrailTitle } from "../../general-market/components/TextTrailTitle"`
- Reusable: `import { Counter } from "../../general-market/components/Counter"`
- Reusable: `import { SvgWipe } from "../../general-market/components/SvgWipe"`

### Design
- Source video: `staticFile("tutorial-raw.mp4")` — always the bottom layer
- All overlays are TRANSPARENT LAYERS over the video
- Dark panels: `rgba(10, 10, 10, 0.85)` with `borderRadius: 12`
- Lower-third panels: bottom 25% of screen
- Full diagrams: center of screen with dark backdrop
- Text: Inter (sans) for body, JetBrains Mono for numbers/code/terminal
- Animations: always use `extrapolateLeft: "clamp", extrapolateRight: "clamp"`
- Physics: use `spring()` for enter animations
- Brand green: `#00C853`

### FPS
Composition runs at **30fps**. Source video is 25fps — `<Video>` handles mismatch.
Convert seconds to frames: `Math.round(seconds * 30)`.
