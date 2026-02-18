#!/bin/bash
# Retry all finance creators - SEQUENTIAL to avoid IP blocking
# Run this after YouTube IP block lifts (wait 1-24 hours)

SCRIPT="/Users/maxguillabert/Downloads/index/_bmad-output/youtube/scrape-shorts.py"
OUTDIR="/Users/maxguillabert/Downloads/index/_bmad-output/youtube/finance"
mkdir -p "$OUTDIR"

scrape() {
    local handle="$1"
    local name="$2"
    local file="$3"
    echo ""
    echo "=========================================="
    echo "Scraping: $name (@$handle)"
    echo "=========================================="
    python3 "$SCRIPT" "$handle" "$name" "$OUTDIR/$file" 50 2>&1
    echo "--- Sleeping 30s between creators ---"
    sleep 30
}

# --- RE-SCRAPE: Creators with 50/50 errors (completely failed) ---
# These need full re-scrape since they hit IP block immediately

scrape "adamkhoo" "Adam Khoo" "adam-khoo-shorts.md"
scrape "DaytradeWarrior" "Warrior Trading" "warrior-trading-shorts.md"
scrape "TheTradingChannel" "The Trading Channel" "the-trading-channel-shorts.md"
scrape "tastyliveshow" "tastylive" "tastylive-shorts.md"
scrape "SMBCapital" "SMB Capital" "smb-capital-shorts.md"
scrape "CodingJesus" "Coding Jesus" "coding-jesus-shorts.md"
scrape "DimitriBianco" "Dimitri Bianco" "dimitri-bianco-shorts.md"

# --- RE-SCRAPE: Partial failures ---
scrape "AndreiJikh" "Andrei Jikh" "andrei-jikh-shorts.md"
scrape "FinanceWithSharan" "Sharan Hegde" "sharan-hegde-shorts.md"
scrape "Socratica" "Socratica" "socratica-shorts.md"
scrape "sentdex" "Sentdex" "sentdex-shorts.md"
scrape "QuantNomad" "QuantNomad" "quantnomad-shorts.md"
scrape "TickerSymbolYOU" "Ticker Symbol YOU" "ticker-symbol-you-shorts.md"
scrape "WallStreetMillennial" "Wall Street Millennial" "wall-street-millennial-shorts.md"

# --- RE-SCRAPE: Bad handles (404) - use correct channel IDs ---
# Patrick Boyle: UCASM0cgfkJxQ1ICmRilfHLw
echo ""
echo "=========================================="
echo "Scraping: Patrick Boyle (via channel ID)"
echo "=========================================="
python3 -c "
import sys
sys.path.insert(0, '$(dirname "$SCRIPT")')
from importlib.util import spec_from_file_location, module_from_spec
spec = spec_from_file_location('scrape', '$SCRIPT')
mod = module_from_spec(spec)
spec.loader.exec_module(mod)

# Override get_shorts_list to use channel ID URL
import subprocess
def get_shorts_by_channel_id(channel_id, max_count=50):
    url = f'https://www.youtube.com/channel/{channel_id}/shorts'
    cmd = ['yt-dlp', '--flat-playlist', '--print', '%(id)s\t%(title)s\t%(view_count)s\t%(upload_date)s', '--playlist-end', str(max_count), url]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
    shorts = []
    for line in result.stdout.strip().split('\n'):
        if not line.strip(): continue
        parts = line.split('\t')
        if len(parts) >= 4:
            shorts.append({'id': parts[0], 'title': parts[1], 'views': parts[2], 'date': parts[3]})
        elif len(parts) >= 2:
            shorts.append({'id': parts[0], 'title': parts[1], 'views': 'NA', 'date': 'NA'})
    return shorts

mod.get_shorts_list = lambda h, m=50: get_shorts_by_channel_id('UCASM0cgfkJxQ1ICmRilfHLw', m)
mod.scrape_channel('PatrickBoyle', 'Patrick Boyle', '$OUTDIR/patrick-boyle-shorts.md', 50)
" 2>&1
sleep 30

# Vivian Tu: UCkIR1fGlhdr5RQvxAEpj1SQ
echo ""
echo "=========================================="
echo "Scraping: Vivian Tu (via channel ID)"
echo "=========================================="
python3 -c "
import sys, subprocess
sys.path.insert(0, '$(dirname "$SCRIPT")')
from importlib.util import spec_from_file_location, module_from_spec
spec = spec_from_file_location('scrape', '$SCRIPT')
mod = module_from_spec(spec)
spec.loader.exec_module(mod)
def get_shorts_by_channel_id(channel_id, max_count=50):
    url = f'https://www.youtube.com/channel/{channel_id}/shorts'
    cmd = ['yt-dlp', '--flat-playlist', '--print', '%(id)s\t%(title)s\t%(view_count)s\t%(upload_date)s', '--playlist-end', str(max_count), url]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
    shorts = []
    for line in result.stdout.strip().split('\n'):
        if not line.strip(): continue
        parts = line.split('\t')
        if len(parts) >= 4:
            shorts.append({'id': parts[0], 'title': parts[1], 'views': parts[2], 'date': parts[3]})
        elif len(parts) >= 2:
            shorts.append({'id': parts[0], 'title': parts[1], 'views': 'NA', 'date': 'NA'})
    return shorts
mod.get_shorts_list = lambda h, m=50: get_shorts_by_channel_id('UCkIR1fGlhdr5RQvxAEpj1SQ', m)
mod.scrape_channel('VivianTu', 'Vivian Tu', '$OUTDIR/vivian-tu-shorts.md', 50)
" 2>&1
sleep 30

# New Money: UCvSXMi2LebwJEM1s4bz5IBA
echo ""
echo "=========================================="
echo "Scraping: New Money (via channel ID)"
echo "=========================================="
python3 -c "
import sys, subprocess
sys.path.insert(0, '$(dirname "$SCRIPT")')
from importlib.util import spec_from_file_location, module_from_spec
spec = spec_from_file_location('scrape', '$SCRIPT')
mod = module_from_spec(spec)
spec.loader.exec_module(mod)
def get_shorts_by_channel_id(channel_id, max_count=50):
    url = f'https://www.youtube.com/channel/{channel_id}/shorts'
    cmd = ['yt-dlp', '--flat-playlist', '--print', '%(id)s\t%(title)s\t%(view_count)s\t%(upload_date)s', '--playlist-end', str(max_count), url]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
    shorts = []
    for line in result.stdout.strip().split('\n'):
        if not line.strip(): continue
        parts = line.split('\t')
        if len(parts) >= 4:
            shorts.append({'id': parts[0], 'title': parts[1], 'views': parts[2], 'date': parts[3]})
        elif len(parts) >= 2:
            shorts.append({'id': parts[0], 'title': parts[1], 'views': 'NA', 'date': 'NA'})
    return shorts
mod.get_shorts_list = lambda h, m=50: get_shorts_by_channel_id('UCvSXMi2LebwJEM1s4bz5IBA', m)
mod.scrape_channel('NewMoney', 'New Money', '$OUTDIR/new-money-shorts.md', 50)
" 2>&1
sleep 30

# --- Tier D: Kyla Scanlon, Austin Hankwitz, Logically Answered ---
scrape "KylaScanlon" "Kyla Scanlon" "kyla-scanlon-shorts.md"
scrape "austinhankwitz" "Austin Hankwitz" "austin-hankwitz-shorts.md"
scrape "LogicallyAnswered" "Logically Answered" "logically-answered-shorts.md"

echo ""
echo "=========================================="
echo "=== ALL DONE ==="
echo "=========================================="

# Summary
echo ""
echo "=== RESULTS SUMMARY ==="
for f in "$OUTDIR"/*.md; do
    name=$(basename "$f" .md)
    total=$(grep -c "^## [0-9]" "$f" 2>/dev/null || echo 0)
    errors=$(grep -c "^ERROR:" "$f" 2>/dev/null || echo 0)
    good=$((total - errors))
    printf "%-35s %2d/%2d OK" "$name" "$good" "$total"
    if [ "$errors" -gt 0 ]; then
        printf "  (%d errors)\n" "$errors"
    else
        printf "  ✓\n"
    fi
done
