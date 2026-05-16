# Bot Tutorial — Miro Storyboard

Ten-frame storyboard for a Claude Code-driven demo of `General-Market/vision-bot-examples`. One shot per frame. The recorded video runs the same commands in the same order.

## Layout

Board `uXjVOkYo-do=`. The predator-anatomy column sits at the center (x=0). This tutorial is its own column at **x=+4800** — past every other section of the board (rightmost existing content at x ≈ +2625). Hero text at y=0, frames stack down with 1300 px between centres, closer below frame 10.

| Frame | Title | What it shows | Command |
|---|---|---|---|
| 01 | The Repo | GitHub mock + file tree + zero-to-trading block | `git clone …/vision-bot-examples` |
| 02 | The Bootstrap | Terminal showing `./setup.sh --auto-fund` (venv, wallet, faucet) | `./setup.sh --auto-fund` |
| 03 | The Probe | RPC + contract + faucet + oracle health check | `main.py probe` |
| 04 | The Thesis | Strategy registry: momentum / rolling / contrarian / all_yes / xgb / ensemble / claude | (pick one) |
| 05 | The Backtest | Walk-forward over 72h of history, accuracy + lift + flip-catch | `main.py backtest --strategy ensemble --hours 72` |
| 06 | The Training | XGBoost on 18 features, validation curve, feature importance | `main.py train-xgb --hours 72 --max-assets 500` |
| 07 | The Dry Run | Build the tx, print it, don't sign | `main.py dryrun --strategy ensemble` |
| 08 | The Wager | First live join — sealed bitmap, oracle reveal, profile card | `live_trader.py --deposit 0.1 --max-joins 1` |
| 09 | The Race | Two wallets, two strategies, head-to-head PnL | `./race.sh ensemble all_yes 0.1` |
| 10 | The Ledger | SQLite ledger, per-strategy table, cumulative PnL chart | `race_report.py pnl-ensemble.db pnl-xgb.db` |

## Style

Cool slate base (`#F0F2F4`), royal blue accent (`#0052FF`), near-black ink (`#0A0A0A`). SF Mono in terminals, SF Pro Display in titles. Cioran captions. No drop shadows. Mock UIs are precise enough that the video can mirror each frame shot-for-shot.

## How to upload

```bash
cd /Users/maxguillabert/Downloads/index
export $(grep -E "^MIRO_" .env | xargs)
python3 docs/bot-tutorial/scripts/upload_to_miro.py
```

## How to iterate

- Edit an SVG → re-run the upload script. Old items stay; re-runs stack new ones on top. To replace cleanly, run `wipe_misplaced.py` (after adjusting its bounding box) or delete by hand in Miro first.
- Move the column: change `CENTRE_X` in `scripts/upload_to_miro.py`.
- Tighten pacing: change `GAP_Y`.
- Add a frame: drop a new `NN-name.svg` in `diagrams/` and add a row to `CARDS`.

## Notes

- Frames are 1500×1100 SVG viewBoxes, uploaded at width 1200 → renders to ~880 px tall on the board.
- Terminal output is mocked but reflects the real shapes from `AGENTS.md` of the example repo.
- The storyboard intentionally lives FAR right (x=+4800) — anything closer would have collided with the existing voices column (x=+1450) or refusal section (x up to +2625).
