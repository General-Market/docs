#!/usr/bin/env python3
"""Merge all founder JSON files into one master file with stats."""
import json, glob, os, sys, unicodedata, re

base_dir = os.path.dirname(os.path.abspath(__file__))

all_founders = []

# 1. Parse the original top 100 markdown into JSON (use existing parser)
# 2. Load all JSON sub-batch files

# Load any base JSON files (parsed from markdown, etc.)
for base_name in ['crypto_founders.json', 'crypto_founders_1_100.json']:
    base_file = os.path.join(base_dir, base_name)
    if os.path.exists(base_file):
        with open(base_file) as f:
            existing = json.load(f)
        entries = existing.get('founders', []) if isinstance(existing, dict) else existing
        all_founders.extend(entries)
        print(f"Loaded {len(entries)} from {base_name}", file=sys.stderr)

# Load all sub-batch JSON files
json_files = sorted(glob.glob(os.path.join(base_dir, 'founders_*_sub*.json')))
for jf in json_files:
    try:
        with open(jf) as f:
            batch = json.load(f)
        if isinstance(batch, list):
            all_founders.extend(batch)
            print(f"  + {len(batch)} from {os.path.basename(jf)}", file=sys.stderr)
        elif isinstance(batch, dict) and 'founders' in batch:
            all_founders.extend(batch['founders'])
            print(f"  + {len(batch['founders'])} from {os.path.basename(jf)}", file=sys.stderr)
    except Exception as e:
        print(f"  ERROR parsing {os.path.basename(jf)}: {e}", file=sys.stderr)

def clean_name(name):
    """Normalize and clean a founder name."""
    if not name:
        return name
    # Unicode normalize (NFC)
    name = unicodedata.normalize('NFC', name)
    # Strip whitespace
    name = name.strip()
    # Collapse multiple spaces
    name = re.sub(r'\s+', ' ', name)
    # Title case if all lower or all upper
    if name == name.lower() or name == name.upper():
        name = name.title()
    return name

def clean_string(val):
    """Strip and normalize a string value."""
    if not isinstance(val, str):
        return val
    return unicodedata.normalize('NFC', val.strip())

# Clean all entries
for f in all_founders:
    if 'name' in f:
        f['name'] = clean_name(f['name'])
    for k in ['project_name', 'role', 'nationality', 'location', 'origin', 'background', 'age_source', 'nationality_source', 'latest_projects']:
        if k in f:
            f[k] = clean_string(f[k])

# Deduplicate by (project_rank, name)
seen = set()
deduped = []
for f in all_founders:
    key = (f.get('project_rank'), f.get('name'))
    if key not in seen:
        seen.add(key)
        deduped.append(f)

deduped.sort(key=lambda x: (x.get('project_rank', 9999), x.get('name', '')))

# Stats
total = len(deduped)
age_confirmed = sum(1 for f in deduped if f.get('age_status') == 'confirmed')
age_estimated = sum(1 for f in deduped if f.get('age_status') == 'estimated')
age_unknown = sum(1 for f in deduped if f.get('age_status') == 'unknown')
nat_known = sum(1 for f in deduped if f.get('nationality_status') in ('known', 'confirmed', 'estimated'))
loc_known = sum(1 for f in deduped if f.get('location_status') in ('known', 'confirmed', 'estimated'))
corrections = sum(1 for f in deduped if f.get('is_correction'))

# Range coverage
from collections import defaultdict
ranges = defaultdict(lambda: {'total': 0, 'age_known': 0, 'nat_known': 0, 'loc_known': 0})
for f in deduped:
    r = ((f.get('project_rank', 1)-1) // 100) * 100 + 1
    key = f'{r}-{r+99}'
    ranges[key]['total'] += 1
    if f.get('age_status') != 'unknown':
        ranges[key]['age_known'] += 1
    if f.get('nationality_status') in ('known', 'confirmed', 'estimated'):
        ranges[key]['nat_known'] += 1
    if f.get('location_status') in ('known', 'confirmed', 'estimated'):
        ranges[key]['loc_known'] += 1

range_stats = {}
for key in sorted(ranges.keys(), key=lambda x: int(x.split('-')[0])):
    r = ranges[key]
    t = r['total']
    range_stats[key] = {
        'founders': t,
        'age_pct': round(r['age_known']/t*100, 1) if t else 0,
        'nationality_pct': round(r['nat_known']/t*100, 1) if t else 0,
        'location_pct': round(r['loc_known']/t*100, 1) if t else 0
    }

output = {
    "metadata": {
        "date": "2026-02-16",
        "total_founders": total,
        "stats": {
            "age": {
                "confirmed": age_confirmed,
                "estimated": age_estimated,
                "unknown": age_unknown,
                "pct_known": round((age_confirmed + age_estimated) / total * 100, 1) if total else 0
            },
            "nationality": {
                "known": nat_known,
                "unknown": total - nat_known,
                "pct_known": round(nat_known / total * 100, 1) if total else 0
            },
            "location": {
                "known": loc_known,
                "unknown": total - loc_known,
                "pct_known": round(loc_known / total * 100, 1) if total else 0
            },
            "corrections": corrections,
            "by_range": range_stats
        }
    },
    "founders": deduped
}

outfile = os.path.join(base_dir, 'crypto_founders_all.json')
with open(outfile, 'w') as f:
    json.dump(output, f, indent=2, ensure_ascii=False)

print(f"\n=== MASTER STATS ===", file=sys.stderr)
print(f"Total founders: {total}", file=sys.stderr)
print(f"Age: {age_confirmed} confirmed + {age_estimated} estimated = {age_confirmed+age_estimated} known ({round((age_confirmed+age_estimated)/total*100,1)}%)", file=sys.stderr)
print(f"Nationality: {nat_known} known ({round(nat_known/total*100,1)}%)", file=sys.stderr)
print(f"Location: {loc_known} known ({round(loc_known/total*100,1)}%)", file=sys.stderr)
print(f"Corrections: {corrections}", file=sys.stderr)
print(f"\nBy range:", file=sys.stderr)
for key, rs in range_stats.items():
    print(f"  {key}: {rs['founders']} founders | Age {rs['age_pct']}% | Nat {rs['nationality_pct']}% | Loc {rs['location_pct']}%", file=sys.stderr)
print(f"\nWritten to {outfile}", file=sys.stderr)

if __name__ == '__main__':
    pass
