#!/bin/bash
# Scrape all finance creators in parallel
# Tiers S, A, B, C, D

SCRIPT="/Users/maxguillabert/Downloads/index/_bmad-output/youtube/scrape-shorts.py"
OUTDIR="/Users/maxguillabert/Downloads/index/_bmad-output/youtube/finance"
mkdir -p "$OUTDIR"

# Function to scrape a creator
scrape() {
    local handle="$1"
    local name="$2"
    local file="$3"
    python3 "$SCRIPT" "$handle" "$name" "$OUTDIR/$file" 50 2>&1
}

# Tier S (skip already done: Tilbury, Humphrey, HMW, Caleb Hammer)
scrape "AndreiJikh" "Andrei Jikh" "andrei-jikh-shorts.md" &
scrape "FinanceWithSharan" "Sharan Hegde" "sharan-hegde-shorts.md" &

# Tier A (skip Ben Felix, Damodaran - no shorts)
scrape "PatrickBoyleOnFinance" "Patrick Boyle" "patrick-boyle-shorts.md" &
scrape "Coffeezilla" "Coffeezilla" "coffeezilla-shorts.md" &
scrape "ThePlainBagel" "The Plain Bagel" "the-plain-bagel-shorts.md" &
scrape "MoneyMacro" "Money & Macro" "money-macro-shorts.md" &

wait
echo "=== Batch 1 done (Tier S + A) ==="

# Tier B
scrape "HumbledTrader" "Humbled Trader" "humbled-trader-shorts.md" &
scrape "DaytradeWarrior" "Warrior Trading" "warrior-trading-shorts.md" &
scrape "TheTradingChannel" "The Trading Channel" "the-trading-channel-shorts.md" &
scrape "ZipTrader" "ZipTrader" "ziptrader-shorts.md" &
scrape "adamkhoo" "Adam Khoo" "adam-khoo-shorts.md" &

wait
echo "=== Batch 2 done (Tier B part 1) ==="

scrape "tastyliveshow" "tastylive" "tastylive-shorts.md" &
scrape "SMBCapital" "SMB Capital" "smb-capital-shorts.md" &

# Tier C
scrape "CodingJesus" "Coding Jesus" "coding-jesus-shorts.md" &
scrape "TickerSymbolYOU" "Ticker Symbol YOU" "ticker-symbol-you-shorts.md" &
scrape "parttimelarry" "Part Time Larry" "part-time-larry-shorts.md" &

wait
echo "=== Batch 3 done (Tier B part 2 + C part 1) ==="

scrape "DimitriBianco" "Dimitri Bianco" "dimitri-bianco-shorts.md" &
scrape "sentdex" "Sentdex" "sentdex-shorts.md" &
scrape "Socratica" "Socratica" "socratica-shorts.md" &
scrape "QuantNomad" "QuantNomad" "quantnomad-shorts.md" &

# Tier D (TikTok crossposters with YouTube presence)
scrape "vivaborealismoney" "Vivian Tu" "vivian-tu-shorts.md" &

wait
echo "=== Batch 4 done (Tier C part 2 + D) ==="

# Tier D continued
scrape "KylaScanlon" "Kyla Scanlon" "kyla-scanlon-shorts.md" &
scrape "austinhankwitz" "Austin Hankwitz" "austin-hankwitz-shorts.md" &
scrape "WallStreetMillennial" "Wall Street Millennial" "wall-street-millennial-shorts.md" &
scrape "LogicallyAnswered" "Logically Answered" "logically-answered-shorts.md" &
scrape "NewMoneyChannel" "New Money" "new-money-shorts.md" &

wait
echo "=== All batches done ==="
echo "Files in $OUTDIR:"
ls -la "$OUTDIR"/*.md 2>/dev/null | wc -l
