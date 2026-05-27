#!/usr/bin/env bash
# Deploy xwatch out of ~/Downloads (TCC-protected, unreadable by launchd) into
# ~/Library/Application Support/xwatch, then (re)load the LaunchAgent.
#
# The repo stays the source of truth. Edit code or .env in the repo, re-run this.
set -euo pipefail

SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"   # .../docs/x-targeting/xwatch
SRCPARENT="$(dirname "$SRC")"                          # .../docs/x-targeting
DEST="$HOME/Library/Application Support/xwatch"
PLIST_SRC="$SRC/io.generalmarket.xwatch.plist"
PLIST="$HOME/Library/LaunchAgents/io.generalmarket.xwatch.plist"
LABEL="io.generalmarket.xwatch"
UID_NUM="$(id -u)"

echo "→ deploying to $DEST"
mkdir -p "$DEST/xwatch/state"
cp "$SRC"/*.py "$DEST/xwatch/"
cp "$SRCPARENT/run_xwatch.py" "$DEST/run_xwatch.py"

# Secrets: repo .env is the source. Copy it over (it carries the bot token and,
# once you paste it, the twitterapi key). Preserve a hand-edited dest .env only
# if the repo has none.
if [[ -f "$SRC/.env" ]]; then
  cp "$SRC/.env" "$DEST/xwatch/.env"
  echo "→ copied .env"
elif [[ ! -f "$DEST/xwatch/.env" ]]; then
  echo "⚠ no .env in repo or dest — copy .env.example to $SRC/.env and fill it"
fi

echo "→ installing LaunchAgent"
mkdir -p "$HOME/Library/LaunchAgents"
cp "$PLIST_SRC" "$PLIST"

# Reliable reload: bootout (ignore if absent) then bootstrap + kickstart.
launchctl bootout "gui/$UID_NUM/$LABEL" 2>/dev/null || true
sleep 1
launchctl bootstrap "gui/$UID_NUM" "$PLIST"
launchctl kickstart -k "gui/$UID_NUM/$LABEL" 2>/dev/null || true
sleep 4

echo "→ status:"
launchctl list | grep -i xwatch || echo "  (not listed — check the err log)"
echo "→ err log:"
tail -5 "$DEST/xwatch/state/xwatch.err.log" 2>/dev/null || echo "  (empty — good)"
echo
echo "Done. The bot should have sent a fresh 'online' message."
echo "Logs:     $DEST/xwatch/state/"
echo "Stop:     launchctl bootout gui/$UID_NUM/$LABEL"
