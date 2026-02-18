#!/usr/bin/env python3
"""Helper: generate batch prompts that output JSON directly."""
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

def format_aum(aum_str):
    try:
        val = float(aum_str.replace(',', ''))
        if val >= 1e9:
            return f"${val/1e9:.2f}B"
        return f"${val/1e6:.0f}M"
    except:
        return f"${aum_str}"

def main():
    start = int(sys.argv[1])
    end = int(sys.argv[2])
    sub = int(sys.argv[3]) if len(sys.argv) > 3 else 0

    seen, founders = get_all_businesses()
    chunk = seen[start-1:end]
    with_founders = [b for b in chunk if b in founders]
    no_founders = [b for b in chunk if b not in founders]

    if sub == 0:
        # Summary
        batch_size = max(1, (len(with_founders) + 4) // 5)
        total_profiles = sum(len(founders[b]['people']) for b in with_founders)
        print(f"Range {start}-{end}: {len(chunk)} biz, {len(with_founders)} with founders, {total_profiles} profiles")
        for i in range(5):
            sb = with_founders[i*batch_size:(i+1)*batch_size]
            if sb:
                sb_profiles = sum(len(founders[b]['people']) for b in sb)
                first_n = seen.index(sb[0]) + 1
                last_n = seen.index(sb[-1]) + 1
                print(f"  Sub {i+1}: {len(sb)} biz, {sb_profiles} profiles (#{first_n}-#{last_n})")
        print(f"  No founders: {len(no_founders)}")
        return

    batch_size = max(1, (len(with_founders) + 4) // 5)
    sub_batch = with_founders[(sub-1)*batch_size:sub*batch_size]
    if not sub_batch:
        print("EMPTY")
        return

    entries = []
    for biz in sub_batch:
        num = seen.index(biz) + 1
        f = founders[biz]
        for p in f['people']:
            entries.append({
                'rank': num,
                'project': biz,
                'aum': format_aum(f['aum']),
                'name': p['name'],
                'role': p['role'],
                'linkedin': p['linkedin']
            })

    first_num = seen.index(sub_batch[0]) + 1
    last_num = seen.index(sub_batch[-1]) + 1
    print(f"RANGE: {first_num}-{last_num}")
    print(f"COUNT: {len(sub_batch)} businesses, {len(entries)} profiles")
    print(f"OUTFILE: founders_{start}_{end}_sub{sub}.json")
    print("---ENTRIES---")
    print(json.dumps(entries, indent=2))

if __name__ == '__main__':
    main()
