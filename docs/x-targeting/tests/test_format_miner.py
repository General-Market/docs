import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from format_miner import classify


def test_numbered_list():
    t = "Top gems today:\n1. $WIF\n2. $POPCAT\n3. $MOODENG\n4. $PNUT"
    assert "numbered_list" in classify(t)


def test_token_call_with_ca():
    t = "new runner $GOAT\nCA: CzLSujWBLFsSjncfkh59rUFqvafWcY5tzedWJSuypump"
    tags = classify(t)
    assert "token_call" in tags


def test_pnl_flex():
    assert "pnl_flex" in classify("turned $200 into $14,500 on this play. +7150% pnl")


def test_cn_daily_recap():
    assert "daily_recap" in classify("今日金狗复盘：\n1. $A 涨了30倍\n2. $B 内盘冲出")


def test_meme_short():
    assert "meme_short" in classify("ngmi if you fade the trenches")


def test_data_drop():
    t = "Hyperliquid 24h: $4.2B volume, OI $1.8B, funding 0.0021%"
    assert "data_drop" in classify(t)
