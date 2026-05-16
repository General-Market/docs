# Bot Tutorial — Miro Storyboard

Three-frame storyboard for a Claude Code-driven demo of `General-Market/vision-bot-examples`. Goal: one shot per frame, matched by a video where the user runs the same command on screen.

## Layout

The predator-anatomy column lives at the center of board `uXjVOkYo-do=` (x=0). This tutorial sits in an independent right column at `centre_x = +1800`, three frames stacked vertically.

| Frame | Title | Mock UI shown | Command |
|---|---|---|---|
| 01 | Clone the bot | GitHub repo page with file tree + Zero-to-trading block | `git clone https://github.com/General-Market/vision-bot-examples` |
| 02 | Let it assemble itself | Dark terminal showing `./setup.sh --auto-fund` output | `./setup.sh --auto-fund` |
| 03 | Trade one block | Live trader output + profile card with first PnL | `.venv/bin/python twitch/live_trader.py --deposit 0.1 --max-joins 1` |

Hero text above frame 01, closer text below frame 03.

## Style

Apple chrome. Same palette as `docs/predator-anatomy/STYLE.md`. SF Mono for the terminal panels, SF Pro Display for titles. No drop shadows. Blue used once per frame at most.

## How to upload

```bash
cd /Users/maxguillabert/Downloads/index
export $(grep -E "^MIRO_" .env | xargs)
python3 docs/bot-tutorial/scripts/upload_to_miro.py
```

The script:
1. Uploads `diagrams/01-clone.svg`, `02-bootstrap.svg`, `03-trade.svg` as Miro images at `centre_x=+1800`, width 1200, 1160 px gap between centers.
2. Posts hero text, sub-tagline, and closer text directly as Miro text items.

## How to iterate

- Edit an SVG → re-run the script. Old items stay; re-running stacks new ones on top. To replace, delete the old images by hand in Miro first, or extend the script with a delete-by-tag pass (not implemented).
- To shift the column, change `CENTRE_X` in `scripts/upload_to_miro.py`.
- To tighten/loosen vertical pacing, change `GAP_Y`.

## Notes

- Frames are 1500×1100 SVG viewBoxes uploaded at width 1200 → renders to ~880 px tall on the board.
- Terminal output is mocked but matches the real shapes in `AGENTS.md` of the example repo: bootstrap banner, wallet address line, faucet confirmations, trader/reveal/PlayerSettled sequence.
- This is a storyboard, not a screenshot dump. The user records the real video; the Miro side is the script.
