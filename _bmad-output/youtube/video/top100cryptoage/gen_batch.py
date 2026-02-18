#!/usr/bin/env python3
"""Generate batch prompts for founder research agents.
Usage: python3 gen_batch.py <start> <end> <sub_batch_num>
  e.g. python3 gen_batch.py 201 300 1  → outputs sub-batch 1 of 5 for businesses 201-300
"""
import csv, sys, json

def get_all_businesses():
    seen = []
    founders = {}
    with open('Crypto Founders Name.csv', 'r') as f:
        reader = csv.reader(f)
        header = next(reader)
        for row in reader:
            biz = row[1].strip() if len(row) > 1 else ''
            if not biz:
                continue
            if biz not in seen:
                seen.append(biz)
            aum = row[2].strip() if len(row) > 2 else ''
            first = row[3].strip() if len(row) > 3 else ''
            last = row[4].strip() if len(row) > 4 else ''
            role = row[5].strip() if len(row) > 5 else ''
            linkedin = row[6].strip() if len(row) > 6 else ''
            if first or last:
                name = f'{first} {last}'.strip()
                if biz not in founders:
                    founders[biz] = {'aum': aum, 'people': []}
                existing = [p['name'] for p in founders[biz]['people']]
                if name not in existing:
                    founders[biz]['people'].append({'name': name, 'role': role, 'linkedin': linkedin})
    return seen, founders

def main():
    start = int(sys.argv[1])  # 1-indexed
    end = int(sys.argv[2])    # inclusive
    sub = int(sys.argv[3])    # 1-5

    seen, founders = get_all_businesses()

    # Get businesses in range that have founders
    chunk = seen[start-1:end]
    with_founders = [b for b in chunk if b in founders]
    no_founders = [b for b in chunk if b not in founders]

    # Split into 5 sub-batches
    batch_size = (len(with_founders) + 4) // 5  # ceiling division
    if batch_size < 1:
        batch_size = 1

    if sub == 0:
        # Output summary
        print(f"Range {start}-{end}: {len(chunk)} businesses, {len(with_founders)} with founders, {len(no_founders)} without")
        total_profiles = sum(len(founders[b]['people']) for b in with_founders)
        print(f"Total profiles: {total_profiles}")
        for i in range(5):
            sb = with_founders[i*batch_size:(i+1)*batch_size]
            if sb:
                sb_profiles = sum(len(founders[b]['people']) for b in sb)
                print(f"  Sub-batch {i+1}: {len(sb)} businesses, {sb_profiles} profiles (#{seen.index(sb[0])+1}-#{seen.index(sb[-1])+1})")
        print(f"\nNo founders ({len(no_founders)}):")
        for b in no_founders:
            print(f"  - {b}")
        return

    sub_batch = with_founders[(sub-1)*batch_size:sub*batch_size]
    if not sub_batch:
        print("EMPTY")
        return

    first_num = seen.index(sub_batch[0]) + 1
    last_num = seen.index(sub_batch[-1]) + 1

    lines = []
    for biz in sub_batch:
        num = seen.index(biz) + 1
        f = founders[biz]
        aum_raw = f['aum'].replace(',', '')
        try:
            aum_m = float(aum_raw) / 1e6
            aum_str = f"${aum_m:.0f}M"
        except:
            aum_str = f"${f['aum']}"
        people_parts = []
        for p in f['people']:
            people_parts.append(f"{p['name']} ({p['role']})")
        lines.append(f"{num}. {biz} ({aum_str} AUM): {'; '.join(people_parts)}")

    print(f"RANGE: {first_num}-{last_num}")
    print(f"COUNT: {len(sub_batch)} businesses")
    print(f"FILENAME: batch_{start}_{end}_sub{sub}.md")
    print("---")
    print('\n'.join(lines))

if __name__ == '__main__':
    main()
