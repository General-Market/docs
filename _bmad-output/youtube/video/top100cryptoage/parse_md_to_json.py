#!/usr/bin/env python3
"""Parse founder markdown profiles into JSON format."""
import re, json, sys, glob, os

def parse_field(text, field_name):
    """Extract a field value from markdown text."""
    pattern = rf'\*\*{field_name}:\*\*\s*(.*?)(?:\n|$)'
    match = re.search(pattern, text, re.IGNORECASE)
    if match:
        return match.group(1).strip()
    return None

def parse_markdown_file(filepath):
    """Parse a markdown file into structured founder data."""
    with open(filepath, 'r') as f:
        content = f.read()

    founders = []

    # Split by ### headers (project sections)
    project_sections = re.split(r'^### ', content, flags=re.MULTILINE)

    for section in project_sections:
        if not section.strip():
            continue

        # Parse project header: "101. Benqi Staked Avax ($331M AUM)"
        proj_match = re.match(r'(\d+)\.\s+(.+?)\s*\(\$?([\d,.]+[BMK]?)\s*AUM\)', section)
        if not proj_match:
            # Try alternate format
            proj_match = re.match(r'(\d+)\.\s+(.+?)\s*\(', section)
            if not proj_match:
                continue

        proj_num = int(proj_match.group(1))
        proj_name = proj_match.group(2).strip()
        proj_aum = proj_match.group(3).strip() if proj_match.lastindex >= 3 else ""

        # Split by #### headers (founder sections)
        founder_sections = re.split(r'^#### ', section, flags=re.MULTILINE)

        for fsection in founder_sections[1:]:  # Skip the project header
            if not fsection.strip():
                continue

            # Parse founder name and role: "Sam Kazemian -- CEO"
            name_match = re.match(r'(.+?)\s*(?:--|—|–)\s*(.+?)(?:\n|$)', fsection)
            if not name_match:
                name_match = re.match(r'(.+?)(?:\n|$)', fsection)
                if not name_match:
                    continue
                name = name_match.group(1).strip()
                role = ""
            else:
                name = name_match.group(1).strip()
                role = name_match.group(2).strip()

            # Extract fields
            age = parse_field(fsection, 'Age')
            nationality = parse_field(fsection, 'Nationality')
            location = parse_field(fsection, 'Location')
            origin = parse_field(fsection, 'Origin')
            background = parse_field(fsection, 'Background')
            latest = parse_field(fsection, 'Latest projects \\(2025-2026\\)')
            if not latest:
                latest = parse_field(fsection, 'Latest projects')

            # Classify age
            age_status = "unknown"
            age_value = None
            if age:
                age_lower = age.lower()
                if age_lower == "unknown" or "unknown" in age_lower and len(age_lower) < 15:
                    age_status = "unknown"
                elif "born" in age_lower or "confirmed" in age_lower:
                    age_status = "confirmed"
                    # Try to extract number
                    num_match = re.search(r'~?(\d{2,3})', age)
                    if num_match:
                        age_value = int(num_match.group(1))
                elif "~" in age or "est" in age_lower or "approx" in age_lower or "around" in age_lower:
                    age_status = "estimated"
                    num_match = re.search(r'~?(\d{2,3})', age)
                    if num_match:
                        age_value = int(num_match.group(1))
                else:
                    # Has a number = estimated
                    num_match = re.search(r'(\d{2,3})', age)
                    if num_match:
                        age_status = "estimated"
                        age_value = int(num_match.group(1))
                    else:
                        age_status = "unknown"

            nat_status = "known" if nationality and nationality.lower() != "unknown" else "unknown"
            loc_status = "known" if location and location.lower() != "unknown" else "unknown"

            founder = {
                "project_rank": proj_num,
                "project_name": proj_name,
                "project_aum": proj_aum,
                "name": name,
                "role": role,
                "age_raw": age or "Unknown",
                "age_status": age_status,
                "age_value": age_value,
                "nationality": nationality or "Unknown",
                "nationality_status": nat_status,
                "location": location or "Unknown",
                "location_status": loc_status,
                "origin": origin or "",
                "background": background or "",
                "latest_projects": latest or "",
                "is_correction": "correction" in fsection.lower()[:200] or "misidentif" in fsection.lower()[:200] or "NOT the" in fsection[:500]
            }
            founders.append(founder)

    return founders

def main():
    base_dir = os.path.dirname(os.path.abspath(__file__))

    all_founders = []

    # Parse specified files or all batch files
    if len(sys.argv) > 1:
        files = sys.argv[1:]
    else:
        files = sorted(glob.glob(os.path.join(base_dir, 'batch*.md')))
        # Also include the original top 100
        top100 = os.path.join(base_dir, 'market-crypto-founders-top100-research-2026-02-16.md')
        if os.path.exists(top100):
            files = [top100] + files

    for f in files:
        print(f"Parsing {os.path.basename(f)}...", file=sys.stderr)
        founders = parse_markdown_file(f)
        print(f"  Found {len(founders)} founders", file=sys.stderr)
        all_founders.extend(founders)

    # Deduplicate by (project_rank, name)
    seen = set()
    deduped = []
    for f in all_founders:
        key = (f['project_rank'], f['name'])
        if key not in seen:
            seen.add(key)
            deduped.append(f)

    # Sort by project rank
    deduped.sort(key=lambda x: x['project_rank'])

    # Stats
    total = len(deduped)
    age_confirmed = sum(1 for f in deduped if f['age_status'] == 'confirmed')
    age_estimated = sum(1 for f in deduped if f['age_status'] == 'estimated')
    age_unknown = sum(1 for f in deduped if f['age_status'] == 'unknown')
    nat_known = sum(1 for f in deduped if f['nationality_status'] == 'known')
    loc_known = sum(1 for f in deduped if f['location_status'] == 'known')
    corrections = sum(1 for f in deduped if f['is_correction'])

    output = {
        "metadata": {
            "date": "2026-02-16",
            "total_founders": total,
            "source_files": [os.path.basename(f) for f in files],
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
                "corrections": corrections
            }
        },
        "founders": deduped
    }

    print(json.dumps(output, indent=2, ensure_ascii=False))

    # Print stats to stderr
    print(f"\n=== STATS ===", file=sys.stderr)
    print(f"Total founders: {total}", file=sys.stderr)
    print(f"Age: {age_confirmed} confirmed, {age_estimated} estimated, {age_unknown} unknown ({round((age_confirmed+age_estimated)/total*100,1)}% coverage)", file=sys.stderr)
    print(f"Nationality: {nat_known} known ({round(nat_known/total*100,1)}%)", file=sys.stderr)
    print(f"Location: {loc_known} known ({round(loc_known/total*100,1)}%)", file=sys.stderr)
    print(f"Corrections: {corrections}", file=sys.stderr)

if __name__ == '__main__':
    main()
