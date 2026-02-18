# Aim Trainer Bot - Session Notes

## Session: 2026-02-13

### Architecture
- VPS: 161.97.84.152 (Contabo, 1920x1200, Xvfb display :1)
- Grid: 12x8 (A1-L8), cells 160x150px, letter-number system
- Vision: Sonnet sub-agent for grid analysis
- Cursor: Human-like bezier movement (cursor.js)
- Screenshots: scrot/import pipeline (~200ms)
- Decision tree: scan → analyze → decide → act → verify

### Grid System
- 12 cols (A-L): 160px each
- 8 rows (1-8): 150px each
- Yellow cell IDs (22pt), coordinate labels (9pt)
- Red grid lines (0.5 opacity, 1px)
- Tick marks on edges

### Corrections Log
| Target | Sonnet Cell | Sonnet X,Y | Actual X,Y | Hit/Miss | Offset |
|--------|-------------|------------|------------|----------|--------|
| 30→29  | manual      | 950,500    | 950,500    | HIT      | 0,0    |
| 29→28  | G3→manual   | 1120,650   | 1085,445   | HIT      | -35,-205|
| 28→27  | -           | 1250,635   | ~correct   | HIT      | ~0     |
| 27→26  | G3(1056,405)| 1056,405   | ~1056,405  | HIT      | ~0     |
| 26→?   | Autonomous agent running... | | | |

### Key Learnings
1. Sonnet's Y-coordinate estimates are often 100-200px too high (display compression artifact)
2. Grid cell identification is more reliable than precise coordinate estimation
3. Mark-and-verify loop catches errors before clicking
4. Keyboard Tab+Enter works for consent popups when clicks don't reach iframes
5. Chrome --disable-session-crashed-bubble prevents Restore dialog
6. Cookie consent overlay blocks ALL other clicks until dismissed
