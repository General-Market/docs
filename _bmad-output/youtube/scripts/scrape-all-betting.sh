#!/bin/bash
# Scrape last 50 shorts for top betting creators (Tiers 1-3)
# Handles verified 2026-02-13

SCRIPT="/Users/maxguillabert/Downloads/index/_bmad-output/youtube/scripts/scrape-shorts.py"
OUTDIR="/Users/maxguillabert/Downloads/index/_bmad-output/youtube/channels/betting"
mkdir -p "$OUTDIR"

scrape() {
    local handle="$1"
    local name="$2"
    local file="$3"
    python3 "$SCRIPT" "$handle" "$name" "$OUTDIR/$file" 50 2>&1
}

# ============================================================
# TIER 1: Mega-Creators (1M+ following, 200K+ avg views/Short)
# ============================================================

scrape "thepatmcafeeshow" "Pat McAfee" "pat-mcafee-shorts.md" &
scrape "barstoolsportstv" "Barstool Sports" "barstool-sports-shorts.md" &
scrape "shannonsharpe954" "Shannon Sharpe" "shannon-sharpe-shorts.md" &
scrape "ClubShayShay" "Club Shay Shay" "club-shay-shay-shorts.md" &

wait
echo "=== Tier 1 batch 1 done ==="

scrape "BenderWinsSportsBetting" "Ryan Bender" "ryan-bender-shorts.md" &
scrape "sportsbettingtiktok" "SportsBettingTikTok" "sportsbettingtiktok-shorts.md" &
scrape "pardonmytakepodcast" "Big Cat (Pardon My Take)" "big-cat-pmt-shorts.md" &
scrape "LucasTyltyOficial" "Lucas Tylty" "lucas-tylty-shorts.md" &
scrape "VegasMatt" "Vegas Matt" "vegas-matt-shorts.md" &

wait
echo "=== Tier 1 batch 2 done ==="
# Skipped: Mazi VS (IG/TikTok only), Vegas Dave (no shorts tab)

# ============================================================
# TIER 2: Major Creators (100K-1M following, 50K-200K avg views)
# ============================================================

scrape "bookitsports" "BookItWithTrent" "bookitwithtrent-shorts.md" &
scrape "pickdawgz" "PickDawgz" "pickdawgz-shorts.md" &
scrape "BleacherReport" "B/R Betting" "br-betting-shorts.md" &
scrape "TheoBorges" "Theo Borges" "theo-borges-shorts.md" &
scrape "Wagertalk" "WagerTalk TV" "wagertalk-tv-shorts.md" &

wait
echo "=== Tier 2 done ==="
# Skipped: Mundo Bet (no shorts), Footy Accumulators (no YT),
#   Cody Covers, Amanda Casey Vance, TCO Fantasy, DNR Sports,
#   CorpCorey, Sal Vetri, Dr. Locks, MattyBetss (all TikTok-only)

# ============================================================
# TIER 3: Established Mid-Size (25K-250K following, 10K-50K avg)
# ============================================================

scrape "callingourshot" "Calling Our Shot" "calling-our-shot-shorts.md" &
scrape "TiquinhoQA" "Quero Apostar" "quero-apostar-shorts.md" &
scrape "MaskedBettor" "Masked Bettor" "masked-bettor-shorts.md" &
scrape "GuyBostonSports" "Guy Boston Sports" "guy-boston-sports-shorts.md" &
scrape "OddsJam" "OddsJam" "oddsjam-shorts.md" &

wait
echo "=== Tier 3 batch 1 done ==="

scrape "DraftKings" "DraftKings" "draftkings-shorts.md" &

wait
echo "=== Tier 3 batch 2 done ==="
# Skipped: World Wide Wob (no shorts), Kelly In Vegas (no shorts),
#   Cash Out Sports (no shorts), Joe Holka, HooveLocks, ComeUpNate,
#   JBigsDFS, KenzBrooksBets, Swicks Picks (all TikTok-only)

echo "=== All betting tiers done ==="
echo "Files in $OUTDIR:"
ls -la "$OUTDIR"/*.md 2>/dev/null | wc -l
