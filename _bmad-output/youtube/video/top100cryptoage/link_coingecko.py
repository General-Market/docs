#!/usr/bin/env python3
"""
Link crypto_founders.csv with top2000_crypto_coingecko.csv by matching
Business Names to CoinGecko token names via multi-pass fuzzy matching.

Output: crypto_founders_linked.csv
"""

import csv
import json
import re
import os
from urllib.parse import urlparse
from collections import defaultdict

DIR = os.path.dirname(os.path.abspath(__file__))
FOUNDERS_PATH = os.path.join(DIR, "crypto_founders.csv")
CG_PATH = os.path.join(DIR, "top2000_crypto_coingecko.csv")
OUTPUT_PATH = os.path.join(DIR, "crypto_founders_linked.json")

# Suffixes to strip from Business Name to get the base name
# Order matters: longer/more-specific first so they get stripped before shorter ones
SUFFIXES_TO_STRIP = [
    "perpetual exchange", "perpetuals", "perpetual",
    "liquid staking", "staked sol", "staked eth",
    "yield assets", "yield aggregator",
    "core pool", "validator lsts",
    "cow amm", "clmm", "amm",
    "dex", "perps",
    "lending", "pooled", "bridge", "staking",
    "lsd", "lst",
    "yield", "farm", "farming",
    "swap", "exchange",
    "protocol", "finance", "network",
    "markets", "vaults", "cdp",
    "classic", "v2.1", "v2", "v3", "v4", "v5",
    "dao",
]


def normalize(s):
    """Lowercase, strip whitespace, collapse multiple spaces."""
    s = s.lower().strip()
    s = re.sub(r"\s+", " ", s)
    return s


def extract_base_name(biz_name):
    """Strip known suffixes from a Business Name to get the base project name."""
    name = normalize(biz_name)
    # Iteratively strip suffixes (may need multiple passes, e.g., "Balancer CoW AMM")
    changed = True
    while changed:
        changed = False
        for suffix in SUFFIXES_TO_STRIP:
            if name.endswith(" " + suffix):
                name = name[: -(len(suffix) + 1)].strip()
                changed = True
            elif name == suffix:
                # Don't strip the entire name
                break
    return name.strip()


def extract_domains(url):
    """Extract clean domain(s) from a URL string. Returns a set of domains."""
    if not url:
        return set()
    url = url.strip()
    # Handle multiple URLs separated by |
    urls = [u.strip() for u in url.split("|")]
    domains = set()
    for u in urls:
        if not u:
            continue
        if not u.startswith("http"):
            u = "https://" + u
        try:
            parsed = urlparse(u)
            host = parsed.hostname or ""
            # Strip www.
            if host.startswith("www."):
                host = host[4:]
            # Skip linkedin
            if "linkedin.com" in host:
                continue
            if host:
                domains.add(host)
        except Exception:
            continue
    return domains


def load_founders():
    """Load founders CSV, return list of dicts."""
    with open(FOUNDERS_PATH, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        return list(reader)


def load_coingecko():
    """Load CoinGecko CSV, return list of dicts."""
    with open(CG_PATH, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        return list(reader)


def main():
    founders = load_founders()
    cg_tokens = load_coingecko()

    print(f"Loaded {len(founders)} founder rows")
    print(f"Loaded {len(cg_tokens)} CoinGecko tokens")
    print()

    # Build CG lookup structures
    cg_by_norm_name = {}       # normalized name -> cg row
    cg_by_symbol = {}          # lowercase symbol -> cg row
    cg_by_domains = {}         # domain -> cg row

    for cg in cg_tokens:
        norm = normalize(cg["name"])
        cg_by_norm_name[norm] = cg

        sym = cg["symbol"].strip().lower()
        # Only store first occurrence (higher rank = lower number = better)
        if sym not in cg_by_symbol:
            cg_by_symbol[sym] = cg

        domains = extract_domains(cg.get("website", ""))
        for d in domains:
            if d not in cg_by_domains:
                cg_by_domains[d] = cg

    # Collect unique Business Names and pre-compute their base names
    unique_biz_names = set(r["Business Name"] for r in founders)
    biz_base_names = {}  # Business Name -> base name (normalized)
    biz_norm_names = {}  # Business Name -> normalized name
    for bn in unique_biz_names:
        biz_norm_names[bn] = normalize(bn)
        biz_base_names[bn] = extract_base_name(bn)

    # Matching: for each Business Name, find the best CG match
    # We track: biz_name -> (cg_row, pass_number)
    biz_to_cg = {}  # Business Name -> (cg_row, pass_num)

    # Track which CG tokens got matched (by cg id)
    matched_cg_ids = set()

    # --- Pass 1: Exact match (normalized base name == normalized CG name) ---
    pass1_count = 0
    for bn in unique_biz_names:
        base = biz_base_names[bn]
        if base in cg_by_norm_name:
            biz_to_cg[bn] = (cg_by_norm_name[base], 1)
            matched_cg_ids.add(cg_by_norm_name[base]["id"])
            pass1_count += 1
    print(f"Pass 1 (exact base match):       {pass1_count} business names matched")

    # --- Pass 2: CG name contained in Business Name ---
    # Sort CG tokens by name length descending to prefer longer matches
    # (e.g., "Jito" should match "Jito Liquid Staking", not "Liquid")
    cg_sorted_by_name_len = sorted(cg_tokens, key=lambda c: len(c["name"]), reverse=True)

    pass2_count = 0
    for bn in unique_biz_names:
        if bn in biz_to_cg:
            continue
        norm_bn = biz_norm_names[bn]
        best_match = None
        best_len = 0
        for cg in cg_sorted_by_name_len:
            cg_norm = normalize(cg["name"])
            cg_len = len(cg_norm)
            if cg_len < 4:
                continue  # Skip very short CG names to avoid false positives
            # CG name must appear as a word boundary in the business name
            pattern = r"(?:^|\s)" + re.escape(cg_norm) + r"(?:\s|$)"
            if re.search(pattern, norm_bn):
                if cg_len > best_len:
                    best_match = cg
                    best_len = cg_len
        if best_match:
            biz_to_cg[bn] = (best_match, 2)
            matched_cg_ids.add(best_match["id"])
            pass2_count += 1
    print(f"Pass 2 (CG name in BizName):     {pass2_count} business names matched")

    # --- Pass 3: Base Business Name contained in CG name ---
    pass3_count = 0
    for bn in unique_biz_names:
        if bn in biz_to_cg:
            continue
        base = biz_base_names[bn]
        if len(base) < 4:
            continue  # Skip very short base names
        best_match = None
        best_rank = float("inf")
        for cg in cg_tokens:
            cg_norm = normalize(cg["name"])
            # Base name must appear as a word boundary in CG name
            pattern = r"(?:^|\s)" + re.escape(base) + r"(?:\s|$)"
            if re.search(pattern, cg_norm):
                rank = int(cg["rank"])
                if rank < best_rank:
                    best_match = cg
                    best_rank = rank
        if best_match:
            biz_to_cg[bn] = (best_match, 3)
            matched_cg_ids.add(best_match["id"])
            pass3_count += 1
    print(f"Pass 3 (BizName base in CG):     {pass3_count} business names matched")

    # --- Pass 4: Symbol match ---
    # CG symbol (lowercase) matches first word of Business Name (lowercase)
    pass4_count = 0
    for bn in unique_biz_names:
        if bn in biz_to_cg:
            continue
        first_word = normalize(bn).split()[0] if normalize(bn).split() else ""
        if len(first_word) < 2:
            continue
        if first_word in cg_by_symbol:
            biz_to_cg[bn] = (cg_by_symbol[first_word], 4)
            matched_cg_ids.add(cg_by_symbol[first_word]["id"])
            pass4_count += 1
    print(f"Pass 4 (symbol match):           {pass4_count} business names matched")

    # --- Pass 5: Domain match ---
    # Pre-build founders domain index: domain -> set of Business Names
    biz_domains = defaultdict(set)  # Business Name -> set of domains
    for r in founders:
        bn = r["Business Name"]
        if bn in biz_to_cg:
            continue
        ds = extract_domains(r.get("l", ""))
        biz_domains[bn].update(ds)

    pass5_count = 0
    for bn in unique_biz_names:
        if bn in biz_to_cg:
            continue
        for fd in biz_domains.get(bn, set()):
            if fd in cg_by_domains:
                biz_to_cg[bn] = (cg_by_domains[fd], 5)
                matched_cg_ids.add(cg_by_domains[fd]["id"])
                pass5_count += 1
                break
    print(f"Pass 5 (domain match):           {pass5_count} business names matched")
    print()

    # --- Build output ---
    # CG columns to add
    cg_output_cols = ["cg_rank", "cg_id", "cg_symbol", "cg_name", "market_cap_usd", "cg_url"]
    founder_cols = list(founders[0].keys()) if founders else []
    output_cols = founder_cols + ["linked"] + cg_output_cols

    output_rows = []
    linked_founder_count = 0
    unlinked_founder_count = 0

    for r in founders:
        out = dict(r)
        bn = r["Business Name"]
        if bn in biz_to_cg:
            cg, _ = biz_to_cg[bn]
            out["linked"] = "1"
            out["cg_rank"] = cg["rank"]
            out["cg_id"] = cg["id"]
            out["cg_symbol"] = cg["symbol"]
            out["cg_name"] = cg["name"]
            out["market_cap_usd"] = cg.get("market_cap_usd", "")
            out["cg_url"] = cg.get("coingecko_url", "")
            linked_founder_count += 1
        else:
            out["linked"] = "0"
            for c in cg_output_cols:
                out[c] = ""
            unlinked_founder_count += 1
        output_rows.append(out)

    # Append unmatched CG tokens as new rows
    unmatched_cg = [cg for cg in cg_tokens if cg["id"] not in matched_cg_ids]
    unmatched_cg.sort(key=lambda c: int(c["rank"]))

    for cg in unmatched_cg:
        out = {}
        for c in founder_cols:
            out[c] = ""
        # Fill website from CoinGecko data
        website = cg.get("website", "").strip()
        if website:
            # Take first URL if multiple separated by |
            first_url = website.split("|")[0].strip()
            out["l"] = first_url
        out["Business Name"] = cg["name"]
        out["linked"] = "0"
        out["cg_rank"] = cg["rank"]
        out["cg_id"] = cg["id"]
        out["cg_symbol"] = cg["symbol"]
        out["cg_name"] = cg["name"]
        out["market_cap_usd"] = cg.get("market_cap_usd", "")
        out["cg_url"] = cg.get("coingecko_url", "")
        output_rows.append(out)

    # Write output as JSON
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(output_rows, f, indent=2, ensure_ascii=False)

    # --- Stats ---
    total_matched_biz = len(biz_to_cg)
    total_unmatched_biz = len(unique_biz_names) - total_matched_biz

    # Pass breakdown for matched business names
    pass_counts = defaultdict(int)
    for bn, (cg, pass_num) in biz_to_cg.items():
        pass_counts[pass_num] += 1

    print("=" * 60)
    print("RESULTS SUMMARY")
    print("=" * 60)
    print(f"Total founder rows:              {len(founders)}")
    print(f"Unique business names:           {len(unique_biz_names)}")
    print(f"Total CoinGecko tokens:          {len(cg_tokens)}")
    print()
    print(f"Business names matched:          {total_matched_biz} / {len(unique_biz_names)}")
    print(f"  Pass 1 (exact base):           {pass_counts.get(1, 0)}")
    print(f"  Pass 2 (CG in BizName):        {pass_counts.get(2, 0)}")
    print(f"  Pass 3 (base in CG):           {pass_counts.get(3, 0)}")
    print(f"  Pass 4 (symbol):               {pass_counts.get(4, 0)}")
    print(f"  Pass 5 (domain):               {pass_counts.get(5, 0)}")
    print(f"Business names unmatched:        {total_unmatched_biz}")
    print()
    print(f"Founder rows linked:             {linked_founder_count}")
    print(f"Founder rows unlinked:           {unlinked_founder_count}")
    print()
    print(f"CG tokens matched:               {len(matched_cg_ids)} / {len(cg_tokens)}")
    print(f"CG tokens unmatched:             {len(unmatched_cg)}")
    print(f"New CG rows appended:            {len(unmatched_cg)}")
    print()
    print(f"Final output rows:               {len(output_rows)}")
    print(f"Output file:                     {OUTPUT_PATH}")
    print()

    # Show top 20 unmatched CG tokens by market cap
    print("Top 20 unmatched CoinGecko tokens (by rank):")
    print("-" * 60)
    for i, cg in enumerate(unmatched_cg[:20]):
        mcap = cg.get("market_cap_usd", "N/A")
        try:
            mcap_fmt = f"${float(mcap):,.0f}"
        except (ValueError, TypeError):
            mcap_fmt = mcap
        print(f"  {cg['rank']:>5}. {cg['name']:<30} ({cg['symbol']}) mcap={mcap_fmt}")


if __name__ == "__main__":
    main()
