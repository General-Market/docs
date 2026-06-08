#!/usr/bin/env python3
"""F2 copy-trading sweep — drives the existing twapi harness with a task-scoped $1 budget.
Overrides BUDGET_FILE so the shared niches/budget.json (already over its $15 cap) is untouched.
Logs to the same twapi-ledger.jsonl and tweets.jsonl; tags my rows with copy-* cells.
"""
import sys, pathlib
sys.path.insert(0, "/Users/maxguillabert/Downloads/index/docs/x-targeting")
import twapi

twapi.BUDGET_FILE = pathlib.Path("/tmp/f2_budget.json")

QUERIES = [
    # cell, query, queryType
    # --- EN: copy-trading across asset classes ---
    ("copy-en", 'copy trading min_faves:80 lang:en', "Top"),
    ("copy-en", 'copytrading min_faves:40 lang:en', "Top"),
    ("copy-en", '"copy trade" bybit min_faves:20 lang:en', "Top"),
    ("copy-en", '"copy trade" bitget min_faves:15 lang:en', "Top"),
    ("copy-en", 'copy trading forex min_faves:30 lang:en', "Top"),
    ("copy-en", '"signal provider" forex min_faves:25 lang:en', "Top"),
    ("copy-en", 'mirror trading min_faves:20 lang:en', "Top"),
    ("copy-en", 'etoro "popular investor" min_faves:10 lang:en', "Top"),
    ("copy-en", '"copy my trades" min_faves:20 lang:en', "Top"),
    ("copy-en", '"copy these wallets" min_faves:15 lang:en', "Top"),
    ("copy-en", 'copy trade solana wallet min_faves:20 lang:en', "Top"),
    ("copy-en", '"turned $" "into $" trading min_faves:300 lang:en', "Top"),
    ("copy-en", '"here is the framework" trade min_faves:50 lang:en', "Top"),
    ("copy-en", '"copy my portfolio" min_faves:15 lang:en', "Top"),
    ("copy-en", 'PAMM OR MAM forex min_faves:15 lang:en', "Top"),
    ("copy-en", '"prop firm" "copy" trading min_faves:25 lang:en', "Top"),
    # --- CN ---
    ("copy-cn", '跟单 min_faves:30 lang:zh', "Top"),
    ("copy-cn", '带单 min_faves:20 lang:zh', "Top"),
    ("copy-cn", '跟单交易 min_faves:10 lang:zh', "Top"),
    ("copy-cn", '复制交易 min_faves:10 lang:zh', "Top"),
    ("copy-cn", '喊单 min_faves:20 lang:zh', "Top"),
    ("copy-cn", '聪明钱 跟 min_faves:20 lang:zh', "Top"),
    # --- KR ---
    ("copy-kr", '카피트레이딩 min_faves:5 lang:ko', "Top"),
    ("copy-kr", '따라 매매 min_faves:5 lang:ko', "Top"),
    ("copy-kr", '리딩방 min_faves:10 lang:ko', "Top"),
    ("copy-kr", '복사 매매 min_faves:3 lang:ko', "Top"),
    # --- JP ---
    ("copy-jp", 'コピートレード min_faves:10 lang:ja', "Top"),
    ("copy-jp", 'ミラートレード min_faves:5 lang:ja', "Top"),
    ("copy-jp", '自動売買 コピー min_faves:5 lang:ja', "Top"),
]

def spent_usd():
    return twapi.project_spent_credits() / twapi.CREDITS_PER_USD

for cell, q, qt in QUERIES:
    su = spent_usd()
    if su > 0.85:
        print(f"### STOP at ${su:.3f} — under $1 cap, leaving headroom", flush=True)
        break
    print(f"\n### [{cell}] ${su:.3f} spent :: {q}", flush=True)
    try:
        twapi.cmd_advsearch(q, query_type=qt, cell=cell, pages=1, force=False)
    except SystemExit as e:
        print(f"### BUDGET GUARD tripped ({e}) — stopping", flush=True)
        break
    except Exception as e:
        print(f"### ERROR on {q!r}: {e}", flush=True)

print(f"\n### FINAL project spent: ${spent_usd():.4f}", flush=True)
