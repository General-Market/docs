#!/usr/bin/env python3
"""
Merge three CSV files of crypto founder data:
1. Crypto Founders Name.csv — Main file (base)
2. Missing_Founders_Research.csv — Research fills for empty entries
3. New_Founders_Research.csv — Additional research entries (irregular formatting)

Strategy:
- Match by Business Name (case-insensitive, stripped)
- Fill empty fields in main file from research data
- Append unmatched research entries as new rows
- Never overwrite non-empty values with empty values
"""

import csv
import os

DIR = "/Users/maxguillabert/Downloads/index/_bmad-output/youtube/video/top100cryptoage"
MAIN_FILE = os.path.join(DIR, "Crypto Founders Name.csv")
MISSING_FILE = os.path.join(DIR, "Missing_Founders_Research.csv")
NEW_FILE = os.path.join(DIR, "New_Founders_Research.csv")
OUTPUT_FILE = os.path.join(DIR, "crypto_founders_merged.csv")

# Output columns (standardized)
OUT_COLS = ["l", "Business Name", "AUM", "First Name", "Last Name", "Role", "Linkedin", "Source"]


def normalize_biz_name(name):
    """Normalize business name for matching."""
    return name.strip().lower()


def is_empty(val):
    """Check if a value is effectively empty."""
    return val is None or val.strip() == ""


def read_main_csv():
    """Read the main CSV. Columns: l, Business Name, AUM, First Name, Last Name, Role, Linkedin, (empty col)"""
    rows = []
    with open(MAIN_FILE, "r", encoding="utf-8") as f:
        reader = csv.reader(f)
        header = next(reader)
        for row in reader:
            while len(row) < 8:
                row.append("")
            entry = {
                "l": row[0].strip(),
                "Business Name": row[1].strip(),
                "AUM": row[2].strip(),
                "First Name": row[3].strip(),
                "Last Name": row[4].strip(),
                "Role": row[5].strip(),
                "Linkedin": row[6].strip(),
                "Source": "",
            }
            rows.append(entry)
    return rows


def read_missing_csv():
    """Read Missing_Founders_Research.csv. Columns: l, Business Name, AUM, First Name, Last Name, Role, Linkedin, Source"""
    rows = []
    with open(MISSING_FILE, "r", encoding="utf-8") as f:
        reader = csv.reader(f)
        header = next(reader)
        for row in reader:
            while len(row) < 8:
                row.append("")
            entry = {
                "l": row[0].strip(),
                "Business Name": row[1].strip(),
                "AUM": row[2].strip(),
                "First Name": row[3].strip(),
                "Last Name": row[4].strip(),
                "Role": row[5].strip(),
                "Linkedin": row[6].strip(),
                "Source": row[7].strip(),
            }
            rows.append(entry)
    return rows


def read_new_csv():
    """Read New_Founders_Research.csv. Header: URL, Business Name, AUM, First Name, Last Name, Role, Linkedin, Source

    Irregular formatting:
    - 8 cols: URL, Business Name, AUM, First Name, Last Name, Role, Linkedin, Source (standard)
    - 7 cols: URL, Business Name, First Name, Last Name, Role, Linkedin, Source (missing AUM)
    - 9 cols: URL, Business Name, AUM, First Name, Last Name, Role, Linkedin, Source1, Source2
    """
    rows = []
    with open(NEW_FILE, "r", encoding="utf-8") as f:
        reader = csv.reader(f)
        header = next(reader)
        for row_num, row in enumerate(reader):
            ncols = len(row)
            if ncols == 8:
                entry = {
                    "l": row[0].strip(),
                    "Business Name": row[1].strip(),
                    "AUM": row[2].strip(),
                    "First Name": row[3].strip(),
                    "Last Name": row[4].strip(),
                    "Role": row[5].strip(),
                    "Linkedin": row[6].strip(),
                    "Source": row[7].strip(),
                }
            elif ncols == 7:
                # Missing AUM: URL, Business Name, First Name, Last Name, Role, Linkedin, Source
                entry = {
                    "l": row[0].strip(),
                    "Business Name": row[1].strip(),
                    "AUM": "",
                    "First Name": row[2].strip(),
                    "Last Name": row[3].strip(),
                    "Role": row[4].strip(),
                    "Linkedin": row[5].strip(),
                    "Source": row[6].strip(),
                }
            elif ncols == 9:
                # Extra source: URL, BN, AUM, FN, LN, Role, Linkedin, Source1, Source2
                source = "; ".join(s.strip() for s in row[7:9] if s.strip())
                entry = {
                    "l": row[0].strip(),
                    "Business Name": row[1].strip(),
                    "AUM": row[2].strip(),
                    "First Name": row[3].strip(),
                    "Last Name": row[4].strip(),
                    "Role": row[5].strip(),
                    "Linkedin": row[6].strip(),
                    "Source": source,
                }
            else:
                while len(row) < 8:
                    row.append("")
                entry = {
                    "l": row[0].strip(),
                    "Business Name": row[1].strip(),
                    "AUM": row[2].strip(),
                    "First Name": row[3].strip(),
                    "Last Name": row[4].strip(),
                    "Role": row[5].strip(),
                    "Linkedin": row[6].strip(),
                    "Source": row[7].strip() if len(row) > 7 else "",
                }
                print(f"  Warning: New_Founders row {row_num+2} has {ncols} columns, mapped best-effort")
            rows.append(entry)
    return rows


def merge_entry(base_entry, research_entry):
    """Merge research data into a base entry. Only fill empty fields. Returns number of fields filled."""
    fills = 0
    for field in ["First Name", "Last Name", "Role", "Linkedin", "Source"]:
        if is_empty(base_entry.get(field, "")) and not is_empty(research_entry.get(field, "")):
            base_entry[field] = research_entry[field]
            fills += 1
    # Also fill AUM if base is empty and research has it
    if is_empty(base_entry.get("AUM", "")) and not is_empty(research_entry.get("AUM", "")):
        base_entry["AUM"] = research_entry["AUM"]
        fills += 1
    # Also fill URL/l if base is empty and research has it
    if is_empty(base_entry.get("l", "")) and not is_empty(research_entry.get("l", "")):
        base_entry["l"] = research_entry["l"]
        fills += 1
    return fills


def main():
    print("=" * 70)
    print("CRYPTO FOUNDERS CSV MERGE")
    print("=" * 70)

    # Read all files
    print("\nReading input files...")
    main_rows = read_main_csv()
    missing_rows = read_missing_csv()
    new_rows = read_new_csv()

    main_count = len(main_rows)
    print(f"  Main file:              {main_count} rows")
    print(f"  Missing_Founders:       {len(missing_rows)} rows")
    print(f"  New_Founders:           {len(new_rows)} rows")

    # Count empty founder rows before merge
    empty_before = sum(
        1 for r in main_rows
        if is_empty(r.get("First Name", "")) and is_empty(r.get("Last Name", ""))
    )
    print(f"\n  Main rows with empty First+Last Name (before merge): {empty_before}")

    # Build index of main rows by business name
    main_by_biz = {}
    for i, entry in enumerate(main_rows):
        key = normalize_biz_name(entry["Business Name"])
        if key not in main_by_biz:
            main_by_biz[key] = []
        main_by_biz[key].append(i)

    # Track stats
    total_fills = 0
    total_research_entries_matched = 0
    new_rows_added = 0

    # Process Missing_Founders_Research
    print("\nMerging Missing_Founders_Research...")
    missing_matched = 0
    missing_fills = 0
    missing_new = 0
    for research_entry in missing_rows:
        key = normalize_biz_name(research_entry["Business Name"])
        if key in main_by_biz:
            matched = False
            for idx in main_by_biz[key]:
                base = main_rows[idx]
                needs_fill = any(
                    is_empty(base.get(f, ""))
                    for f in ["First Name", "Last Name", "Role", "Linkedin"]
                )
                if needs_fill:
                    fills = merge_entry(base, research_entry)
                    missing_fills += fills
                    total_fills += fills
                    matched = True
                    break
            if matched:
                missing_matched += 1
                total_research_entries_matched += 1
            else:
                # All matching rows already have data -- append as additional person
                main_rows.append(research_entry)
                idx = len(main_rows) - 1
                if key not in main_by_biz:
                    main_by_biz[key] = []
                main_by_biz[key].append(idx)
                missing_new += 1
                new_rows_added += 1
        else:
            main_rows.append(research_entry)
            idx = len(main_rows) - 1
            if key not in main_by_biz:
                main_by_biz[key] = []
            main_by_biz[key].append(idx)
            missing_new += 1
            new_rows_added += 1

    print(f"  Entries matched & filled: {missing_matched}")
    print(f"  Fields filled:            {missing_fills}")
    print(f"  New rows appended:        {missing_new}")

    # Process New_Founders_Research
    print("\nMerging New_Founders_Research...")
    new_matched = 0
    new_fills = 0
    new_appended = 0
    for research_entry in new_rows:
        key = normalize_biz_name(research_entry["Business Name"])
        if key in main_by_biz:
            matched = False
            for idx in main_by_biz[key]:
                base = main_rows[idx]
                needs_fill = any(
                    is_empty(base.get(f, ""))
                    for f in ["First Name", "Last Name", "Role", "Linkedin"]
                )
                if needs_fill:
                    fills = merge_entry(base, research_entry)
                    new_fills += fills
                    total_fills += fills
                    matched = True
                    break
            if matched:
                new_matched += 1
                total_research_entries_matched += 1
            else:
                main_rows.append(research_entry)
                idx = len(main_rows) - 1
                if key not in main_by_biz:
                    main_by_biz[key] = []
                main_by_biz[key].append(idx)
                new_appended += 1
                new_rows_added += 1
        else:
            main_rows.append(research_entry)
            idx = len(main_rows) - 1
            if key not in main_by_biz:
                main_by_biz[key] = []
            main_by_biz[key].append(idx)
            new_appended += 1
            new_rows_added += 1

    print(f"  Entries matched & filled: {new_matched}")
    print(f"  Fields filled:            {new_fills}")
    print(f"  New rows appended:        {new_appended}")

    # Write output
    print(f"\nWriting merged output to:\n  {OUTPUT_FILE}")
    with open(OUTPUT_FILE, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=OUT_COLS)
        writer.writeheader()
        for entry in main_rows:
            writer.writerow({col: entry.get(col, "") for col in OUT_COLS})

    # Final stats
    empty_after = sum(
        1 for r in main_rows
        if is_empty(r.get("First Name", "")) and is_empty(r.get("Last Name", ""))
    )
    has_data_after = len(main_rows) - empty_after

    print("\n" + "=" * 70)
    print("MERGE SUMMARY")
    print("=" * 70)
    print(f"  Input rows (main):                  {main_count}")
    print(f"  Input rows (Missing_Founders):      {len(missing_rows)}")
    print(f"  Input rows (New_Founders):          {len(new_rows)}")
    print(f"  ---")
    print(f"  Research entries matched:            {total_research_entries_matched}")
    print(f"  Total fields filled:                {total_fills}")
    print(f"  New rows appended:                  {new_rows_added}")
    print(f"  ---")
    print(f"  Final output rows:                  {len(main_rows)}")
    print(f"  Rows with empty First+Last (before): {empty_before}")
    print(f"  Rows with empty First+Last (after):  {empty_after}")
    print(f"  Rows with founder data:              {has_data_after}")
    print("=" * 70)


if __name__ == "__main__":
    main()
