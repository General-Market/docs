# ShotForge — Schema Mappings

## direction.json → ShotDef Field Mapping

### Direct Mappings (1:1)
| direction.json | ShotDef | Transform |
|---|---|---|
| `id` | `id` | None |
| `scriptLine` | `line` | Rename |
| `durationSeconds` | `durationSeconds` | None |
| `captionMode` | `captionMode` | None |
| `wordHighlights` | `wordHighlights` | Add defaults: scale=1.0, glow=false |
| `callouts` | `callouts` | None (use [] if empty) |

### Enum Mappings

#### chibiEmotion (direction → ShotDef)
| Direction Value | ShotDef Value | Rationale |
|---|---|---|
| content | thinking | Contemplative state |
| impressed | confident | Positive admiration |
| envious | panic | Agitated desire |
| determined | idea | Focused intent |
| confident | proud | Self-assured |
| curious | thinking | Wondering |
| smug | shrug | Casual superiority |
| proud | proud | Direct match |
| mesmerized | idea | Wide-eyed wonder |
| excited | teaching | Energetic expression |
| manic | panic | Frenzied energy |
| shocked | scared | Surprise/alarm |
| defeated | tired | Drained |
| exasperated | confused | Frustrated confusion |
| scheming | idea | Plotting (bright-eyed) |
| hopeful | confident | Optimistic |
| crushed | scared | Devastated |
| resigned-then-peaceful | tired | Use chibiExpressions for sequence |
| wise | teaching | Knowing |
| frustrated-then-hopeful | panic | Use chibiExpressions: panic→idea |

#### chibiAnimation (direction → ShotDef)
| Direction Value | ShotDef Value | Rationale |
|---|---|---|
| wiping-sweat | idle | Subtle nervous motion |
| eyes-wide | snap | Sharp attention snap |
| jaw-drop | snap | Sudden reaction |
| fist-pump | punch | Forceful gesture |
| arms-crossed | idle | Static confident pose |
| arms-raised | punch | Upward energy |
| chest-puff | heartbeat | Expanding pride |
| looking-up | drift | Slow upward gaze |
| shrug | wobble | Loose body motion |
| pointing | punch | Directed gesture |
| face-palm | shake | Head shake frustration |
| running | drift | Lateral motion |
| slow-nod | dim | Gentle agreement |
| step-back | shake | Recoil motion |
| shoulders-slump | dim | Deflating energy |
| chin-stroke | idle | Thinking pose |
| rapid-typing | shake | Fast vibration |
| head-in-hands | dim | Defeated stillness |
| nod | dim | Agreement |
| eyes-sparkle | zoom | Bright focus |
| glitch | zoom | Digital distortion effect |
| wink | blink | Quick eye motion |

#### chibiEntrance (direction → ShotDef)
| Direction Value | ShotDef Value | Notes |
|---|---|---|
| slide-in-left | left | Direct |
| slide-in-right | right | Direct |
| pop-in | bottom | Default upward pop |
| flash-in | bottom | Use chibiEntranceVfx: "glow-ring" |
| shrink | bottom | Use chibiExit on prev shot |
| none | none | No chibi |

#### transitionIn (direction → ShotDef)
| Direction Value | ShotDef Value | Additional Fields |
|---|---|---|
| hard_cut | cut | None |
| light_leak_flash | fade | lightLeak: { delay: 0, intensity: 1 } |
| fast_cut_montage | cut | screenBreak: true OR speedLines: true |

#### musicState (direction → ShotDef)
| Direction Value | ShotDef Value |
|---|---|
| playing | playing |
| building | building |
| ducked | ducked |
| bass_drop | bass-drop |
| playing_then_takeover | playing |
| silence | silence |

### Camera Decomposition (cameraMotion → multiple fields)
| Direction Value | fullScreenZoom | cameraTilt | cameraDrift |
|---|---|---|---|
| slow_zoom_in | "in" | — | — |
| slow_zoom_out | "out" | — | — |
| static_zoom_in | "in" | — | — |
| static_zoom_out | "out" | — | — |
| static | — | — | — |
| tilt_down | — | "cw" | — |
| rapid_zoom_montage_to_static | "in" | — | — |

### VFX Array Flattening (vfx[] → ShotDef fields)
| VFX Type | ShotDef Field | Mapping |
|---|---|---|
| light_leak | lightLeak | { delay: startFrame, intensity: 1 } |
| duotone | duotone | { baseHue: computed, speed: 1 } |
| glow_ring | shotVfx | "neon-glow" + shotVfxColor from color |
| screen_break | screenBreak | true |
| fade_to_white | flash | { frame: startFrame, duration: durationFrames } |

### SFX Mapping
| direction.json | ShotDef | Notes |
|---|---|---|
| { frame, type, file } | { frame, file, volume: 1.0 } | type field dropped; use for volume heuristic |

#### Volume Heuristics by SFX Type
| SFX Type | Default Volume |
|---|---|
| ambient_bed | 0.3 |
| tom/body_hit | 0.8 |
| dark_texture | 0.4 |
| shimmer/riser | 0.5 |
| low_rumble | 0.5 |
| mid_percussion | 0.7 |
| noise_sweep | 0.4 |
| impact-transform | 0.9 |
| synth-reveal | 0.6 |

### Default Values (fields not in direction.json)
| ShotDef Field | Default |
|---|---|
| chibiDelay | 0 |
| chibiEntranceVfx | "auto" |
| chibiExit | "auto" |
| chibiZoomDrift | "none" |
| chibiFlipY | false |
| transitionDuration | 9 |
| hideCaptions | false |
| isFirstShot | true (only for id=1) |

### Multi-Emotion Shots
When direction.json has hybrid emotions like "frustrated-then-hopeful":
```typescript
chibiEmotion: "panic",  // initial state
chibiExpressions: [
  { emotion: "panic", atFrame: 0 },
  { emotion: "idea", atFrame: Math.floor(durationFrames * 0.5) }
]
```
