# Aim Trainer Bot

Autonomous aim training bot for [humanbenchmark.com/tests/aim](https://humanbenchmark.com/tests/aim).
Screenshot-only approach (no DOM manipulation, no OpenCV).

## Architecture

```
LOCAL (Mac)                          VPS (Contabo)
+------------------+                +------------------+
|  Claude Code     |  SSH/SCP       |  Xvfb :1         |
|  (brain)         | <----------->  |  1920x1200       |
|                  |                |                  |
|  - Vision        |                |  Chrome          |
|  - Decision tree |                |  humanbenchmark  |
|  - Metrics       |                |                  |
+------------------+                +------------------+
        |                                   |
   Dashboard                          aim-bot/
   localhost:3847                      - cursor.js
                                       - screenshot.js
                                       - aim-loop.js
                                       - ...
```

**Principle:** VPS = hands (Chrome, cursor, screenshots), Local Claude = brain (vision analysis, decisions).

### Decision Loop
1. `scan` - take screenshot + apply grid overlay
2. **Analyze** - vision model identifies target cell + coordinates
3. `click x y` - human-like bezier cursor move + click
4. **Verify** - check remaining count decreased
5. Repeat

### Grid System
- 12x8 grid (A1-L8), cells 160x150px
- Yellow cell IDs (22pt), coordinate labels (9pt)
- Sub-sector zoom: 4x4 within any cell, 3x scale
- All screenshots get grid overlay by default

## VPS Access

| Key | Value |
|-----|-------|
| **IP** | `161.97.84.152` |
| **SSH** | `ssh root@161.97.84.152` |
| **Password** | `a7LfaesF789MQru5$` |
| **VNC** | port `5900`, password: `maxvps26` |
| **Display** | Xvfb `:1`, 1920x1200 |
| **Bot dir** | `/root/aim-bot/` |

### Quick SSH
```bash
sshpass -p 'a7LfaesF789MQru5$' ssh -o StrictHostKeyChecking=no root@161.97.84.152
```

## Setup (VPS)

```bash
# Already installed: Xvfb, x11vnc, Chrome, Node.js, ImageMagick, xdotool, scrot
# Start display
Xvfb :1 -screen 0 1920x1200x24 &
x11vnc -display :1 -passwd maxvps26 -forever -shared &

# Start Chrome
DISPLAY=:1 google-chrome --no-first-run --disable-session-crashed-bubble \
  --hide-crash-restore-bubble humanbenchmark.com/tests/aim &

# Run bot commands
cd /root/aim-bot
node aim-loop.js scan              # screenshot + grid
node aim-loop.js zoom F3           # sub-sector zoom
node aim-loop.js click 950 500     # click + verify
node aim-loop.js start             # click start target
```

## Files

| File | Location | Purpose |
|------|----------|---------|
| `cursor.js` | VPS | Human-like bezier cursor movement |
| `screenshot.js` | VPS | Fast capture pipeline (scrot ~190ms) |
| `screen-aware.js` | VPS | Screen state + action execution |
| `sector-overlay.js` | VPS | Grid overlay with cell labels |
| `aim-loop.js` | VPS | Game orchestrator (scan/zoom/click/mark/start) |
| `grid-overlay.js` | VPS | Basic coordinate grid (superseded by sector-overlay) |
| `vps-action.js` | VPS | CLI wrapper for individual actions |
| `dashboard.js` | Local | Live monitoring (SSE, localhost:3847) |

## Dashboard

```bash
node aim-bot/dashboard.js
# Open http://localhost:3847
```

- SSE push updates (no polling)
- ETag-based image caching
- Tracks: hits, misses, miss rate, avg/best/worst time-to-click
- Per-target log with hit/miss status

## Performance Baseline

| Metric | v1 (slow agent) | Target |
|--------|-----------------|--------|
| Avg time/target | ~146s | <10s |
| Miss rate | 0% | <5% |
| Method | scan+zoom+mark+verify+click | scan+click |
