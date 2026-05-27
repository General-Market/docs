# Daily winners reel

Each day this rebuilds the DeFi "WinnersReel" data from live DefiLlama numbers,
picks the category with the biggest 7-day mover, renders that one reel to an mp4,
finds the most-engaged tweet about the winning protocol in the last hour, and
drops a ready-to-post bundle into `~/Downloads/winners-daily/<date>/`.

You open the folder, drag the mp4 onto Twitter, and quote-tweet the linked tweet.

## Run it by hand

```bash
bash scripts/winners-daily/run.sh
```

Or the steps alone:

```bash
node scripts/winners-daily/fetch-flows.mjs    # → live-data.generated.ts + selection.json
node scripts/winners-daily/build-bundle.mjs   # → tweet search + render + post.txt + notify
```

## What lands in the bundle

`~/Downloads/winners-daily/2026-05-27/`
- `<category>-winners-2026-05-27.mp4` — the reel
- `post.txt` — headline, the winner + its number, the tweet to quote, a suggested caption
- `tweet.json` — the raw tweet pick

## The metric

7-day **TVL change**, every category, pulled from the free `api.llama.fi/protocols`.
Volume was the first choice for perps and prediction markets, but DefiLlama's volume
dashboards now return HTTP 402 (paid Pro tier), and the data-node's perp volume series
is empty — so TVL change, the metric the shipped reels already use, is what runs.

Rosters are the curated slug lists in `data-node/src/config/dl-curated.json`. Five
categories: perps, prediction markets, privacy, RWA, lending.

Two guards keep the headline honest (`fetch-flows.mjs`):
- a `$2M` floor on TVL both now and a week ago, so dust can't win;
- a `150%`/week ceiling, so a listing artifact (Rain went `$3.4M→$26M = +676%`) can't
  ship a chart-breaking bar.

A category with no qualifying winner is skipped. The day's pick is the category whose
top winner grew the most in percent (the only unit comparable across protocol sizes).

## The Twitter key

The picker reads the twitterapi.io key from, in order:
1. `$TWAPI_KEY`
2. `~/.config/twitterapi/key`
3. `/tmp/.twapi_key`

`/tmp` is cleared on reboot, which would silently break the daily job. **Park the key
durably once:**

```bash
mkdir -p ~/.config/twitterapi && printf '%s' '<your-key>' > ~/.config/twitterapi/key
```

Without a key the reel still renders; `post.txt` just says there's no quote target.

Cost: one `advanced_search` page per run ≈ **$0.003–0.006**. DefiLlama and rendering
are free. Daily ≈ **$0.10–0.18 / month**.

## Schedule it (launchd)

Fires daily at 14:00 local time.

```bash
mkdir -p ~/Downloads/winners-daily/logs
cp scripts/winners-daily/com.generalmarket.winners-daily.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.generalmarket.winners-daily.plist
# change the time: edit Hour/Minute in the plist, then unload + load again
# stop it:   launchctl unload ~/Library/LaunchAgents/com.generalmarket.winners-daily.plist
```

launchd logs to `~/Downloads/winners-daily/logs/launchd.{out,err}.log`. If a render is
missed because the Mac was asleep, launchd runs it on next wake.

## Notes

- The reel is `CrtBarReel` (1920×1080, ~5s) — the one the defi-flows README marks "ships
  to Twitter". `fetch-flows.mjs` writes only `live-data.generated.ts`; the prose in
  `datasets.ts` is never touched.
- The existing `LendingWinnersReel` (risk curators) is a different data source and is left
  alone; this pipeline's lending reel is `LendingProtocolsWinnersReel`.
- Each `remotion render` copies all of `public/` to a temp bundle (~GB). Expect disk churn;
  it cleans up after itself. Never pipe `remotion render` stdout to `head`/`tail` — it
  detaches a runaway copy that fills the disk.
