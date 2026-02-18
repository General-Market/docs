#!/usr/bin/env python3
"""Stats v2: 4-year age brackets TVL, co-founder age gap, education types, PhD vs others."""

import json
import re
from collections import defaultdict, Counter

with open("crypto_founders_all.json") as f:
    data = json.load(f)

founders = [f for f in data["founders"] if isinstance(f, dict)]

def parse_aum(aum_str):
    if not aum_str:
        return None
    aum_str = aum_str.strip().replace(",", "")
    m = re.match(r'\$?([\d.]+)\s*([BMKbmk])?', aum_str)
    if not m:
        return None
    val = float(m.group(1))
    suffix = (m.group(2) or "").upper()
    if suffix == "B": val *= 1_000_000_000
    elif suffix == "M": val *= 1_000_000
    elif suffix == "K": val *= 1_000
    return val

# Build project map: rank -> {aum, founders: [{name, age, background, role}]}
projects = {}
for f in founders:
    rank = f.get("project_rank")
    if rank not in projects:
        projects[rank] = {
            "name": f.get("project_name", ""),
            "aum": f.get("project_aum", ""),
            "founders": []
        }
    age_val = None
    if f.get("age_status") in ("confirmed", "estimated") and f.get("age_value"):
        try:
            a = int(f["age_value"])
            if 18 <= a <= 90:  # filter bad data
                age_val = a
        except:
            pass
    projects[rank]["founders"].append({
        "name": f.get("name", ""),
        "age": age_val,
        "background": f.get("background", ""),
        "role": f.get("role", ""),
    })

# ════════════════════════════════════════════════════════════════════
# 1. AVG TVL PER 4-YEAR AGE BRACKET
# ════════════════════════════════════════════════════════════════════
print("=" * 80)
print("1. AVERAGE TVL PER 4-YEAR AGE BRACKET")
print("=" * 80)
print("  (Each founder's protocol TVL is attributed to their age bracket)")
print()

age_brackets = {}  # bracket_label -> [tvl values]
for rank, proj in projects.items():
    aum = parse_aum(proj["aum"])
    if aum is None:
        continue
    for fd in proj["founders"]:
        if fd["age"] is None:
            continue
        age = fd["age"]
        bracket_start = (age // 4) * 4
        label = f"{bracket_start}-{bracket_start+3}"
        if label not in age_brackets:
            age_brackets[label] = []
        age_brackets[label].append(aum)

sorted_brackets = sorted(age_brackets.items(), key=lambda x: int(x[0].split("-")[0]))
print(f"  {'Age Bracket':<14} {'Founders':>9} {'Avg TVL':>15} {'Median TVL':>15} {'Total TVL':>18}")
print("  " + "-" * 75)

for label, tvls in sorted_brackets:
    avg = sum(tvls) / len(tvls)
    med = sorted(tvls)[len(tvls) // 2]
    total = sum(tvls)
    bar_len = int(avg / 20_000_000)
    bar = "█" * min(bar_len, 40)
    print(f"  {label:<14} {len(tvls):>9} ${avg:>13,.0f} ${med:>13,.0f} ${total:>16,.0f}  {bar}")

print()

# ════════════════════════════════════════════════════════════════════
# 2. CO-FOUNDER AGE DIFFERENCE vs TVL
# ════════════════════════════════════════════════════════════════════
print("=" * 80)
print("2. CO-FOUNDER AGE DIFFERENCE vs TVL")
print("=" * 80)
print("  (Only projects with 2+ founders where both have known ages)")
print()

gap_data = []  # (age_gap, tvl, project_name, founders)
solo_tvls = []
multi_no_age_tvls = []

for rank, proj in projects.items():
    aum = parse_aum(proj["aum"])
    if aum is None:
        continue
    aged_founders = [fd for fd in proj["founders"] if fd["age"] is not None]

    if len(proj["founders"]) == 1:
        if aged_founders:
            solo_tvls.append(aum)
        continue

    if len(aged_founders) < 2:
        multi_no_age_tvls.append(aum)
        continue

    ages = [fd["age"] for fd in aged_founders]
    age_gap = max(ages) - min(ages)
    names = " & ".join([fd["name"] for fd in aged_founders])
    gap_data.append((age_gap, aum, proj["name"], names, ages))

# Group by gap ranges
gap_ranges = {
    "0 (same age)": [],
    "1-3 years": [],
    "4-7 years": [],
    "8-12 years": [],
    "13-20 years": [],
    "20+ years": [],
}

for gap, tvl, pname, fnames, ages in gap_data:
    if gap == 0:
        gap_ranges["0 (same age)"].append(tvl)
    elif gap <= 3:
        gap_ranges["1-3 years"].append(tvl)
    elif gap <= 7:
        gap_ranges["4-7 years"].append(tvl)
    elif gap <= 12:
        gap_ranges["8-12 years"].append(tvl)
    elif gap <= 20:
        gap_ranges["13-20 years"].append(tvl)
    else:
        gap_ranges["20+ years"].append(tvl)

print(f"  {'Age Gap':<18} {'Teams':>6} {'Avg TVL':>15} {'Median TVL':>15}")
print("  " + "-" * 58)
for label, tvls in gap_ranges.items():
    if tvls:
        avg = sum(tvls) / len(tvls)
        med = sorted(tvls)[len(tvls) // 2]
        print(f"  {label:<18} {len(tvls):>6} ${avg:>13,.0f} ${med:>13,.0f}")
    else:
        print(f"  {label:<18} {0:>6} {'N/A':>15} {'N/A':>15}")

print()
if solo_tvls:
    print(f"  Solo founders:     {len(solo_tvls):>4} teams | Avg TVL: ${sum(solo_tvls)/len(solo_tvls):>13,.0f}")
if gap_data:
    all_multi = [t for _, t, _, _, _ in gap_data]
    print(f"  Multi-founder:     {len(all_multi):>4} teams | Avg TVL: ${sum(all_multi)/len(all_multi):>13,.0f}")

print()

# Top 10 largest age gaps
print("  Top 10 largest co-founder age gaps:")
print("  " + "-" * 70)
for gap, tvl, pname, fnames, ages in sorted(gap_data, key=lambda x: -x[0])[:10]:
    print(f"  {gap:>2}y gap | ${tvl/1e6:>8,.0f}M | {pname:<25} | Ages: {ages}")

print()

# ════════════════════════════════════════════════════════════════════
# 3. EDUCATION TYPES
# ════════════════════════════════════════════════════════════════════
print("=" * 80)
print("3. EDUCATION & BACKGROUND TYPES")
print("=" * 80)
print()

# Education patterns
edu_patterns = {
    "PhD/Doctorate": r'\b(ph\.?d|doctorate|doctoral)\b',
    "MBA": r'\bmba\b',
    "Master's/MS/MSc": r'\b(master|m\.?s\.?c?|m\.?eng)\b',
    "Bachelor's/BS/BA": r'\b(bachelor|b\.?s\.?c?|b\.?a\.?|b\.?eng|bse)\b',
    "Law/JD": r'\b(j\.?d\.?|law degree|juris doctor|llb|llm)\b',
    "MD/Medical": r'\b(m\.?d\.?|mbbs|medical doctor|medical degree)\b',
    "CPA/CFA": r'\b(cpa|cfa|chartered)\b',
    "Dropped out": r'\b(drop.?out|dropped out|left college|left university|did not complete)\b',
}

edu_counts = {}
edu_tvls = {}
edu_ages = {}

for f in founders:
    bg = (f.get("background", "") or "").lower()
    if not bg:
        continue

    age_val = None
    if f.get("age_status") in ("confirmed", "estimated") and f.get("age_value"):
        try:
            a = int(f["age_value"])
            if 18 <= a <= 90:
                age_val = a
        except:
            pass

    aum = parse_aum(f.get("project_aum", ""))

    for label, pattern in edu_patterns.items():
        if re.search(pattern, bg):
            edu_counts[label] = edu_counts.get(label, 0) + 1
            if aum is not None:
                edu_tvls.setdefault(label, []).append(aum)
            if age_val is not None:
                edu_ages.setdefault(label, []).append(age_val)

print(f"  {'Education Type':<20} {'Count':>6} {'Avg TVL':>15} {'Avg Age':>8}")
print("  " + "-" * 55)
for label in edu_patterns.keys():
    cnt = edu_counts.get(label, 0)
    if cnt == 0:
        continue
    tvls = edu_tvls.get(label, [])
    ages = edu_ages.get(label, [])
    avg_tvl = f"${sum(tvls)/len(tvls):>12,.0f}" if tvls else "N/A"
    avg_age = f"{sum(ages)/len(ages):.1f}" if ages else "N/A"
    print(f"  {label:<20} {cnt:>6} {avg_tvl:>15} {avg_age:>8}")

print()

# Prior career patterns
career_patterns = {
    "Goldman Sachs": r'goldman.?sachs',
    "Google": r'\bgoogle\b',
    "Meta/Facebook": r'\b(meta|facebook)\b',
    "McKinsey/BCG/Bain": r'\b(mckinsey|bcg|boston consulting|bain & co)\b',
    "Morgan Stanley": r'morgan.?stanley',
    "JPMorgan": r'j\.?p\.?\s?morgan',
    "Amazon/AWS": r'\b(amazon|aws)\b',
    "Microsoft": r'\bmicrosoft\b',
    "Apple": r'\bapple\b',
    "Binance": r'\bbinance\b',
    "Coinbase": r'\bcoinbase\b',
    "ConsenSys": r'\bconsensys\b',
    "Traditional Finance": r'\b(hedge fund|investment bank|wall street|private equity|venture capital)\b',
    "Academic/Research": r'\b(professor|research|university|academic|postdoc)\b',
    "Military/Gov": r'\b(military|army|navy|air force|government|defense|intelligence)\b',
}

print("  Prior career backgrounds:")
print("  " + "-" * 60)
print(f"  {'Background':<25} {'Count':>6} {'Avg TVL':>15}")
print("  " + "-" * 60)

career_data = []
for label, pattern in career_patterns.items():
    count = 0
    tvls = []
    for f in founders:
        if not isinstance(f, dict):
            continue
        bg = (f.get("background", "") or "").lower()
        if bg and re.search(pattern, bg):
            count += 1
            aum = parse_aum(f.get("project_aum", ""))
            if aum is not None:
                tvls.append(aum)
    if count > 0:
        avg = sum(tvls)/len(tvls) if tvls else 0
        career_data.append((label, count, avg, tvls))

for label, count, avg, tvls in sorted(career_data, key=lambda x: -x[1]):
    avg_str = f"${avg:>12,.0f}" if tvls else "N/A"
    print(f"  {label:<25} {count:>6} {avg_str:>15}")

print()

# Top universities
print("  Top universities mentioned:")
print("  " + "-" * 50)

uni_patterns = {
    "MIT": r'\bmit\b',
    "Stanford": r'\bstanford\b',
    "Harvard": r'\bharvard\b',
    "Oxford": r'\boxford\b',
    "Cambridge": r'\bcambridge\b',
    "Princeton": r'\bprinceton\b',
    "Wharton/UPenn": r'\b(wharton|upenn|university of pennsylvania)\b',
    "Yale": r'\byale\b',
    "Columbia": r'\bcolumbia\b',
    "Berkeley/UC Berkeley": r'\b(berkeley|uc berkeley)\b',
    "ETH Zurich": r'\beth zurich\b',
    "Imperial College": r'\bimperial college\b',
    "Cornell": r'\bcornell\b',
    "NYU": r'\bnyu\b',
    "UCLA": r'\bucla\b',
    "Waterloo": r'\bwaterloo\b',
    "NUS/NTU Singapore": r'\b(nus|ntu|nanyang)\b',
    "IIT (India)": r'\biit\b',
}

uni_data = []
for label, pattern in uni_patterns.items():
    count = 0
    tvls = []
    for f in founders:
        bg = (f.get("background", "") or "").lower()
        if bg and re.search(pattern, bg):
            count += 1
            aum = parse_aum(f.get("project_aum", ""))
            if aum is not None:
                tvls.append(aum)
    if count > 0:
        avg = sum(tvls)/len(tvls) if tvls else 0
        uni_data.append((label, count, avg))

for label, count, avg in sorted(uni_data, key=lambda x: -x[1]):
    print(f"  {label:<25} {count:>4} founders | Avg TVL: ${avg:>12,.0f}")

print()

# ════════════════════════════════════════════════════════════════════
# 4. PhD/Dr. vs OTHERS
# ════════════════════════════════════════════════════════════════════
print("=" * 80)
print("4. PhD/Dr. FOUNDERS vs NON-PhD FOUNDERS")
print("=" * 80)
print()

phd_founders = []
non_phd_founders = []
no_bg_founders = []

phd_pattern = re.compile(r'\b(ph\.?d|doctorate|doctoral|dr\.?\s)', re.IGNORECASE)
# Also check name for Dr.
dr_name_pattern = re.compile(r'^dr\.?\s', re.IGNORECASE)

for f in founders:
    bg = f.get("background", "") or ""
    name = f.get("name", "") or ""

    age_val = None
    if f.get("age_status") in ("confirmed", "estimated") and f.get("age_value"):
        try:
            a = int(f["age_value"])
            if 18 <= a <= 90:
                age_val = a
        except:
            pass

    aum = parse_aum(f.get("project_aum", ""))
    entry = {"name": name, "age": age_val, "aum": aum, "bg": bg}

    if not bg and not dr_name_pattern.search(name):
        no_bg_founders.append(entry)
    elif phd_pattern.search(bg) or dr_name_pattern.search(name):
        phd_founders.append(entry)
    else:
        non_phd_founders.append(entry)

def group_stats(group, label):
    tvls = [e["aum"] for e in group if e["aum"] is not None]
    ages = [e["age"] for e in group if e["age"] is not None]
    print(f"  {label}:")
    print(f"    Count:      {len(group)}")
    if tvls:
        print(f"    Avg TVL:    ${sum(tvls)/len(tvls):>12,.0f}")
        print(f"    Median TVL: ${sorted(tvls)[len(tvls)//2]:>12,.0f}")
        print(f"    Total TVL:  ${sum(tvls):>12,.0f}")
    if ages:
        print(f"    Avg Age:    {sum(ages)/len(ages):.1f}")
        print(f"    Median Age: {sorted(ages)[len(ages)//2]}")
    print()

group_stats(phd_founders, "PhD / Dr. Founders")
group_stats(non_phd_founders, "Non-PhD Founders (with background)")
group_stats(no_bg_founders, "Founders (no background data)")

# List PhD founders
print("  PhD/Dr. founders list:")
print("  " + "-" * 75)
print(f"  {'Name':<30} {'Age':>4} {'TVL':>12} {'Project':<20}")
print("  " + "-" * 75)

# Get project name for each PhD founder
phd_with_proj = []
for f in founders:
    bg = f.get("background", "") or ""
    name = f.get("name", "") or ""
    if phd_pattern.search(bg) or dr_name_pattern.search(name):
        age_val = None
        if f.get("age_status") in ("confirmed", "estimated") and f.get("age_value"):
            try:
                a = int(f["age_value"])
                if 18 <= a <= 90:
                    age_val = a
            except:
                pass
        aum = parse_aum(f.get("project_aum", ""))
        phd_with_proj.append((name, age_val, aum, f.get("project_name", "")))

for name, age, aum, proj in sorted(phd_with_proj, key=lambda x: -(x[2] or 0)):
    age_str = str(age) if age else "?"
    aum_str = f"${aum/1e6:,.0f}M" if aum else "?"
    print(f"  {name:<30} {age_str:>4} {aum_str:>12} {proj:<20}")

print()

# ════════════════════════════════════════════════════════════════════
# Also save as JSON
# ════════════════════════════════════════════════════════════════════
stats_v2 = {
    "age_brackets_4yr": {},
    "cofounder_age_gap": {},
    "education_types": {},
    "phd_vs_others": {},
}

for label, tvls in sorted_brackets:
    stats_v2["age_brackets_4yr"][label] = {
        "founders": len(tvls),
        "avg_tvl": round(sum(tvls)/len(tvls)),
        "median_tvl": sorted(tvls)[len(tvls)//2],
    }

for label, tvls in gap_ranges.items():
    if tvls:
        stats_v2["cofounder_age_gap"][label] = {
            "teams": len(tvls),
            "avg_tvl": round(sum(tvls)/len(tvls)),
            "median_tvl": sorted(tvls)[len(tvls)//2],
        }

for label in edu_patterns.keys():
    cnt = edu_counts.get(label, 0)
    if cnt > 0:
        tvls = edu_tvls.get(label, [])
        ages = edu_ages.get(label, [])
        stats_v2["education_types"][label] = {
            "count": cnt,
            "avg_tvl": round(sum(tvls)/len(tvls)) if tvls else None,
            "avg_age": round(sum(ages)/len(ages), 1) if ages else None,
        }

for group, label in [(phd_founders, "phd"), (non_phd_founders, "non_phd")]:
    tvls = [e["aum"] for e in group if e["aum"] is not None]
    ages = [e["age"] for e in group if e["age"] is not None]
    stats_v2["phd_vs_others"][label] = {
        "count": len(group),
        "avg_tvl": round(sum(tvls)/len(tvls)) if tvls else None,
        "median_tvl": sorted(tvls)[len(tvls)//2] if tvls else None,
        "avg_age": round(sum(ages)/len(ages), 1) if ages else None,
    }

with open("crypto_founders_stats_v2.json", "w") as f:
    json.dump(stats_v2, f, indent=2, ensure_ascii=False)

print("Stats v2 JSON written to crypto_founders_stats_v2.json")
