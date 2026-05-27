# xwatch — a cheap X engagement watcher in your pocket

Every thirty minutes, while you are awake, the bot asks X one question: *what is
the topic saying right now that people are already reacting to?* It fetches only
the tweets that have crossed your like threshold, drops the ones it has shown you
before, and pings the rest to Telegram. When the topic is quiet, the question
costs almost nothing — that is the whole design.

It runs on this Mac. The window that says "10:00 to 22:00" is read from the
machine's own clock, so *your time* needs no configuration; it is simply where
the laptop is.

---

## What it does

- **One cheap call per scan.** twitterapi.io's `advanced_search` is asked for the
  topic with a `min_faves:` filter baked into the query, so the server returns
  only already-popular tweets. You pay per tweet returned (~$0.00015 each); a
  quiet half-hour returns nothing and costs nothing.
- **Caught early, so the bar is low.** A tweet found an hour after posting has not
  finished climbing. The threshold is deliberately small (default 15 likes), and
  the bot will *recommend* a number for you — see calibration below.
- **Everything is settable from the chat.** Query, threshold, language, lookback,
  the active-hours window, the interval — all live commands. No file edits, no
  restart.
- **It only scans 10:00–22:00 local.** Outside that window the bot still answers
  commands; it just does not spend.

---

## Setup (one time)

1. **Make a bot.** Open Telegram, message **@BotFather**, send `/newbot`, follow
   the prompts, copy the token it gives you.

2. **Fill credentials.**
   ```bash
   cd /Users/maxguillabert/Downloads/index/docs/x-targeting/xwatch
   cp .env.example .env
   # edit .env:
   #   TWITTERAPI_API_KEY = your twitterapi.io key
   #   TELEGRAM_BOT_TOKEN = the @BotFather token
   ```
   `TELEGRAM_CHAT_ID` already defaults to your account.

3. **Say hello to the bot once.** In Telegram, open your new bot and send `/start`
   — Telegram will not deliver messages to a bot you have never opened.

4. **Install the always-on job.**
   ```bash
   bash /Users/maxguillabert/Downloads/index/docs/x-targeting/xwatch/install.sh
   ```
   To stop it: `launchctl bootout gui/$(id -u)/io.generalmarket.xwatch`

> **Why an installer, not a plain `launchctl load`?** This repo lives in
> `~/Downloads`, a macOS TCC-protected folder that launchd is *not* allowed to
> read — a LaunchAgent pointed there dies with `Operation not permitted`. So
> `install.sh` copies the code and your `.env` into
> `~/Library/Application Support/xwatch/` (ordinary app data, readable by
> launchd) and loads the job from there. The repo stays the source of truth.

### Applying the twitterapi.io key (or any code change)

The daemon runs from the *deployed copy*, so after editing the repo:

```bash
# 1. paste your key into the repo .env
#    TWITTERAPI_API_KEY=...
# 2. redeploy + restart
bash xwatch/install.sh
```

The bot will calibrate on its first run *with a key* and start scanning.

---

## Commands

Send these to the bot in Telegram:

| Command | What it does |
|---|---|
| `/status` | current settings + today's API spend |
| `/query <text>` | set the search topic (e.g. `/query insider trading`) |
| `/threshold <n>` | minimum likes to ping |
| `/lang <code\|off>` | restrict language (`en`) or disable |
| `/lookback <hours>` | how far back each scan looks (1–24) |
| `/window <start> <end>` | active hours, your clock — `/window 10 22` |
| `/interval <minutes>` | minutes between scans |
| `/max <n>` | max pings per scan |
| `/calibrate` | one pass: recommend a threshold + list the influencers |
| `/scan` | force a scan right now (ignores the window) |
| `/pause` · `/resume` | stop / start scanning |
| `/help` | the list |

---

## Calibration — why the threshold is low

The first time the daemon starts it runs `/calibrate` for you. Calibration casts
a wide net (no threshold), looks at the spread of likes across the topic's recent
tweets, and recommends a number at roughly the 60th percentile — high enough to
sit above the noise, low enough that an hour-old tweet can clear it. It also lists
the accounts driving the conversation, so you learn who the *influencers* are on
your topic. Re-run it any time the topic's volume changes:

```
/calibrate
```

Then accept its suggestion with, say, `/threshold 12`.

---

## Cost

A scan that finds nothing costs nothing. A busy scan returning ~15 tweets costs
about $0.002. Twenty-four scans a day, even all busy, stay under a dime. A soft
daily cap (`daily_cap_usd`, default $0.50 in `config.py`) stops automatic scans
once the day's estimate crosses it; `/scan` still works by hand.

The estimate ledger is `state/ledger.jsonl`. The truth — your real remaining
balance — is the twitterapi.io dashboard.

---

## Files

```
docs/x-targeting/
  run_xwatch.py    launcher — pins sys.path, the daemon's entry point
  xwatch/
    main.py        daemon loop: long-poll Telegram + timed scans
    scan.py        query building, ranking, calibration, message formatting
    twitter.py     advanced_search client + cost ledger
    tg.py          Telegram Bot API over stdlib urllib
    commands.py    every /command and the settings it mutates
    config.py      env, defaults, JSON state persistence
    .env           your secrets (git-ignored)
    state/         settings.json, seen.json, offset, ledger, logs (git-ignored)
    install.sh     deploy to ~/Library/Application Support + load the job
    io.generalmarket.xwatch.plist   launchd job (paths point at the deploy dir)
```

Deployed (running) copy lives at `~/Library/Application Support/xwatch/`. The
logs are in its `xwatch/state/`. No third-party packages — system `python3`
(3.9+) is enough.
