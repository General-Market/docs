#!/usr/bin/env python3
"""Compute stats: average TVL per protocol, average age of founders, grouped by country."""

import json
import re
from collections import defaultdict

with open("crypto_founders_all.json") as f:
    data = json.load(f)

founders = data["founders"]

def parse_aum(aum_str):
    """Parse AUM string like '$1.5B', '$500M', '$2M' to float in USD."""
    if not aum_str:
        return None
    aum_str = aum_str.strip().replace(",", "")
    m = re.match(r'\$?([\d.]+)\s*([BMKbmk])?', aum_str)
    if not m:
        return None
    val = float(m.group(1))
    suffix = (m.group(2) or "").upper()
    if suffix == "B":
        val *= 1_000_000_000
    elif suffix == "M":
        val *= 1_000_000
    elif suffix == "K":
        val *= 1_000
    return val

# ── Per-project stats (deduplicate by project_rank) ──
projects = {}  # rank -> {name, aum, founders: [{name, age, nationality}]}
for f in founders:
    rank = f.get("project_rank")
    if rank not in projects:
        projects[rank] = {
            "name": f.get("project_name", ""),
            "aum": f.get("project_aum", ""),
            "founders": []
        }
    age = f.get("age_value")
    nat = f.get("nationality", "")
    if f.get("nationality_status") in ("confirmed", "estimated", "known"):
        nat_val = nat
    else:
        nat_val = None
    if f.get("age_status") in ("confirmed", "estimated") and age:
        age_val = age
    else:
        age_val = None
    projects[rank]["founders"].append({
        "name": f.get("name"),
        "age": age_val,
        "nationality": nat_val,
        "location": f.get("location") if f.get("location_status") in ("confirmed", "estimated", "known") else None,
    })

# ── By country: avg TVL and avg age ──
country_tvl = defaultdict(list)      # country -> [aum values]
country_ages = defaultdict(list)     # country -> [ages]
country_founders = defaultdict(int)  # country -> count

for rank, proj in projects.items():
    aum = parse_aum(proj["aum"])
    for fd in proj["founders"]:
        nat = fd["nationality"]
        if not nat or nat.lower() in ("unknown", "n/a", ""):
            continue
        # Normalize country name
        nat = nat.strip().title()
        country_founders[nat] += 1
        if aum is not None:
            country_tvl[nat].append(aum)
        if fd["age"] is not None:
            try:
                country_ages[nat].append(int(fd["age"]))
            except (ValueError, TypeError):
                pass

# ── Global stats ──
all_ages = []
all_aums = []
for rank, proj in projects.items():
    aum = parse_aum(proj["aum"])
    if aum is not None:
        all_aums.append(aum)
    for fd in proj["founders"]:
        if fd["age"] is not None:
            try:
                all_ages.append(int(fd["age"]))
            except (ValueError, TypeError):
                pass

print("=" * 80)
print("GLOBAL STATS")
print("=" * 80)
print(f"Total projects: {len(projects)}")
print(f"Total founders: {len(founders)}")
print(f"Average protocol TVL: ${sum(all_aums)/len(all_aums):,.0f}" if all_aums else "N/A")
print(f"Median protocol TVL: ${sorted(all_aums)[len(all_aums)//2]:,.0f}" if all_aums else "N/A")
print(f"Average founder age: {sum(all_ages)/len(all_ages):.1f}" if all_ages else "N/A")
print(f"Median founder age: {sorted(all_ages)[len(all_ages)//2]}" if all_ages else "N/A")
print(f"Age range: {min(all_ages)}-{max(all_ages)}" if all_ages else "N/A")
print()

# ── Top 20 countries by founder count ──
print("=" * 80)
print("TOP 20 COUNTRIES BY FOUNDER COUNT")
print("=" * 80)
print(f"{'Country':<25} {'Founders':>8} {'Avg Age':>8} {'Avg TVL':>15} {'Med TVL':>15}")
print("-" * 80)

sorted_countries = sorted(country_founders.items(), key=lambda x: -x[1])
for country, count in sorted_countries[:20]:
    avg_age = f"{sum(country_ages[country])/len(country_ages[country]):.1f}" if country_ages[country] else "N/A"
    if country_tvl[country]:
        avg_tvl = f"${sum(country_tvl[country])/len(country_tvl[country]):,.0f}"
        med_tvl = f"${sorted(country_tvl[country])[len(country_tvl[country])//2]:,.0f}"
    else:
        avg_tvl = "N/A"
        med_tvl = "N/A"
    print(f"{country:<25} {count:>8} {avg_age:>8} {avg_tvl:>15} {med_tvl:>15}")

print()

# ── All countries (sorted by founder count) ──
print("=" * 80)
print("ALL COUNTRIES")
print("=" * 80)
print(f"{'Country':<25} {'Founders':>8} {'Avg Age':>8} {'Avg TVL':>15}")
print("-" * 65)

for country, count in sorted_countries:
    avg_age = f"{sum(country_ages[country])/len(country_ages[country]):.1f}" if country_ages[country] else "N/A"
    if country_tvl[country]:
        avg_tvl = f"${sum(country_tvl[country])/len(country_tvl[country]):,.0f}"
    else:
        avg_tvl = "N/A"
    print(f"{country:<25} {count:>8} {avg_age:>8} {avg_tvl:>15}")

print()

# ── Age distribution ──
print("=" * 80)
print("AGE DISTRIBUTION")
print("=" * 80)
brackets = {"20-29": 0, "30-39": 0, "40-49": 0, "50-59": 0, "60-69": 0, "70+": 0}
for age in all_ages:
    if age < 30:
        brackets["20-29"] += 1
    elif age < 40:
        brackets["30-39"] += 1
    elif age < 50:
        brackets["40-49"] += 1
    elif age < 60:
        brackets["50-59"] += 1
    elif age < 70:
        brackets["60-69"] += 1
    else:
        brackets["70+"] += 1

for bracket, count in brackets.items():
    pct = count / len(all_ages) * 100 if all_ages else 0
    bar = "█" * int(pct / 2)
    print(f"  {bracket}: {count:>4} ({pct:>5.1f}%) {bar}")

print()

# ── TVL distribution by rank tier ──
print("=" * 80)
print("AVG TVL BY RANK TIER")
print("=" * 80)
tiers = [(1, 100), (101, 200), (201, 300), (301, 400), (401, 500),
         (501, 600), (601, 700), (701, 800), (801, 900), (901, 1000)]

for lo, hi in tiers:
    tier_aums = []
    tier_ages = []
    for rank, proj in projects.items():
        if lo <= rank <= hi:
            aum = parse_aum(proj["aum"])
            if aum is not None:
                tier_aums.append(aum)
            for fd in proj["founders"]:
                if fd["age"] is not None:
                    try:
                        tier_ages.append(int(fd["age"]))
                    except:
                        pass
    avg_aum = f"${sum(tier_aums)/len(tier_aums):>12,.0f}" if tier_aums else "N/A"
    avg_age = f"{sum(tier_ages)/len(tier_ages):.1f}" if tier_ages else "N/A"
    print(f"  Rank {lo:>4}-{hi:<4}: Avg TVL {avg_aum:>15}  |  Avg Age: {avg_age}")

# ── Also output as JSON ──
stats_output = {
    "global": {
        "total_projects": len(projects),
        "total_founders": len(founders),
        "avg_protocol_tvl": sum(all_aums)/len(all_aums) if all_aums else None,
        "median_protocol_tvl": sorted(all_aums)[len(all_aums)//2] if all_aums else None,
        "avg_founder_age": round(sum(all_ages)/len(all_ages), 1) if all_ages else None,
        "median_founder_age": sorted(all_ages)[len(all_ages)//2] if all_ages else None,
    },
    "by_country": [],
    "by_rank_tier": [],
    "age_distribution": brackets,
}

for country, count in sorted_countries:
    entry = {
        "country": country,
        "founder_count": count,
        "avg_age": round(sum(country_ages[country])/len(country_ages[country]), 1) if country_ages[country] else None,
        "age_sample_size": len(country_ages[country]),
        "avg_tvl": round(sum(country_tvl[country])/len(country_tvl[country])) if country_tvl[country] else None,
        "tvl_sample_size": len(country_tvl[country]),
    }
    stats_output["by_country"].append(entry)

for lo, hi in tiers:
    tier_aums = []
    tier_ages = []
    for rank, proj in projects.items():
        if lo <= rank <= hi:
            aum = parse_aum(proj["aum"])
            if aum is not None:
                tier_aums.append(aum)
            for fd in proj["founders"]:
                if fd["age"] is not None:
                    try:
                        tier_ages.append(int(fd["age"]))
                    except:
                        pass
    stats_output["by_rank_tier"].append({
        "tier": f"{lo}-{hi}",
        "avg_tvl": round(sum(tier_aums)/len(tier_aums)) if tier_aums else None,
        "avg_age": round(sum(tier_ages)/len(tier_ages), 1) if tier_ages else None,
        "projects": len([r for r in projects if lo <= r <= hi]),
        "founders_with_age": len(tier_ages),
    })

with open("crypto_founders_stats.json", "w") as f:
    json.dump(stats_output, f, indent=2, ensure_ascii=False)

print(f"\nStats JSON written to crypto_founders_stats.json")
