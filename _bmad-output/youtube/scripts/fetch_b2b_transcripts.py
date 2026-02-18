#!/usr/bin/env python3
"""Fetch transcripts for B2B finance inspiration shorts.
Run after YouTube IP ban lifts."""

import json, time, os
from youtube_transcript_api import YouTubeTranscriptApi

VIDEOS = {
    # Economics Explained
    "DmMmnSIQmx8": ("Economics Explained", "Is German Precision Manufacturing Over?"),
    "gP-Fm4YdGN4": ("Economics Explained", "Indonesia Could Overtake The USA By 2050"),
    "C5Qk5TRnX7U": ("Economics Explained", "Why Does Everybody Keep Borrowing Money From China?"),
    "rT5iXZQFKjw": ("Economics Explained", "Is It Good For The Rich To Spend Now?"),
    "qmd5EdhPNwQ": ("Economics Explained", "Why is lithium important?"),
    "QHPwv0D6Rko": ("Economics Explained", "The Billion $ Gambler"),
    "0AC15rUxJOc": ("Economics Explained", "Should we be worried about Zimbabwe's lithium ban?"),
    "knwYdobnRLo": ("Economics Explained", "How ban on exports can solve Zimbabwe's issues"),
    "-9vJeGPyZJQ": ("Economics Explained", "The Poorest Countries Will Be Hit Hardest"),
    "AaUheN1r5M8": ("Economics Explained", "The state of Zimbabwe's mining industry"),
    # MagnatesMedia
    "N6IWoMOSPEU": ("MagnatesMedia", "The Fugitive CEO Who Escaped In A Box"),
    "3EaFIzdWnm8": ("MagnatesMedia", "The Richest Family In Italy"),
    "LrE_IznjvUY": ("MagnatesMedia", "Is This Genius Or Crazy?"),
    "jJ-BUyhNStk": ("MagnatesMedia", "Why Post-It Notes Were a FAILURE"),
    "PiOD0C61UiQ": ("MagnatesMedia", "YouTube Is Like An Online Game"),
    "xxO81tbylKs": ("MagnatesMedia", "Crazy Richard Branson Airline Story"),
    "tnakppz0QNk": ("MagnatesMedia", "Why is it called a Ponzi Scheme?"),
    "rJyqYxeQtY0": ("MagnatesMedia", "Quibi: A Spectacular Disaster"),
    "OXOB8ld1Uv4": ("MagnatesMedia", "The Weird TRUTH About Michelin Stars"),
    "d4hypdMl3G4": ("MagnatesMedia", "If you think you've made a bad choice"),
    # Fireship
    "fwBIZRq-vzY": ("Fireship", "5 life-changing Linux tips"),
    "oRBvLbdMKM0": ("Fireship", "This rubber duck can debug your code"),
    "WbF2bLbAUik": ("Fireship", "Big O explained with a deck of cards"),
    "tUjjsqRp3mg": ("Fireship", "CrowdStrike attacks a clown website"),
    "ZRjmGq1gAEQ": ("Fireship", "Does your code suck? JavaScript Variables"),
    "X8LglXSG53A": ("Fireship", "How god programmed birds probably"),
    "gGWQfV1FCis": ("Fireship", "Real HTML programmers debug in 3D"),
    "aXcuz6fn8_w": ("Fireship", "The untold history of web development"),
    "7bmsDg4BaKw": ("Fireship", "My browser, my paste"),
    "0xnuhmqRvVQ": ("Fireship", "Yo mama so FAT32"),
    # Veritasium
    "Bt3boxwRF84": ("Veritasium", "World's Largest Spiderweb"),
    "w2TLv30F6UU": ("Veritasium", "How They Prevented The Citicorp Disaster"),
    "itSkBESLZeY": ("Veritasium", "What happens if you cut the green rope?"),
    "fkxoaD47-Vo": ("Veritasium", "You're Only 6 Steps Away From Anyone On Earth"),
    "nMqWWO6p7-c": ("Veritasium", "Strange pattern down the east coast of America"),
    "Bb0uDpvitoE": ("Veritasium", "I Turned My Phone Into A Microscope"),
    "gGtuw7Rejtk": ("Veritasium", "How Strong Is Super Glue?"),
    "HVySQLuxLkI": ("Veritasium", "Seeing Inside A Thermite Reaction"),
    "tWRyiCP17do": ("Veritasium", "Why didn't this skateboard stunt start from the top?"),
    "h830G5mkTF4": ("Veritasium", "How To Solve a Quadratic Equation"),
    # PolyMatter
    "3KEi3lUXVoU": ("PolyMatter", "This is Not Target"),
    # Zack D. Films (top 9)
    "V93a8gUK_kE": ("Zack D. Films", "Are Paternoster Elevators Actually Safe"),
    "3SW79xJSo_A": ("Zack D. Films", "The 10-Year-Old Who Hacked The FBI"),
    "zOWRK92h9ek": ("Zack D. Films", "Why You Need A Peephole Cover"),
    "wMOSankDzS4": ("Zack D. Films", "How Climbers Hang Without Hands"),
    "KkCCQXdAh24": ("Zack D. Films", "Can Being Underwater Protect You From Bullets?"),
    "PvdQxEoN1ZQ": ("Zack D. Films", "Why Smart Work Beats Hard Work"),
    "ARCGPWRW_48": ("Zack D. Films", "How Could Two Kids Pretend To Be One Adult"),
    "wjDkEuzFRUk": ("Zack D. Films", "How SEAL Drownproof Training Works"),
    "9MJTyvgP7Io": ("Zack D. Films", "What Happens If Sand Hits Earth At Light Speed"),
}

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
TRANSCRIPT_DIR = os.path.join(SCRIPT_DIR, "transcripts")
os.makedirs(TRANSCRIPT_DIR, exist_ok=True)

api = YouTubeTranscriptApi()
results = {}
ok = 0
fail = 0

for vid_id, (channel, title) in VIDEOS.items():
    # Check if already fetched
    txt_path = os.path.join(TRANSCRIPT_DIR, f"{vid_id}.txt")
    if os.path.exists(txt_path) and os.path.getsize(txt_path) > 10:
        with open(txt_path) as f:
            text = f.read()
        results[vid_id] = {"channel": channel, "title": title, "text": text}
        ok += 1
        print(f"CACHED [{ok}/{len(VIDEOS)}]: {channel} - {title}")
        continue

    try:
        transcript = api.fetch(vid_id, languages=['en'])
        text = ' '.join([t.text for t in transcript.snippets])
        results[vid_id] = {"channel": channel, "title": title, "text": text}
        with open(txt_path, "w") as f:
            f.write(text)
        ok += 1
        print(f"OK [{ok}/{len(VIDEOS)}]: {channel} - {title} ({len(text)} chars)")
        time.sleep(2)  # Gentle rate limit
    except Exception as e:
        fail += 1
        err = str(e).split('\n')[0]
        results[vid_id] = {"channel": channel, "title": title, "text": f"ERROR: {err}"}
        print(f"FAIL: {channel} - {title}: {err}")

# Update the markdown file with transcripts
md = "# B2B Finance Inspiration - Top 50 Shorts Scripts\n\n"
md += f"Transcripts from 6 channels most relevant for B2B finance content.\n"
md += f"Successfully fetched: {ok}/{len(VIDEOS)}\n\n---\n\n"

current_channel = ""
for i, (vid_id, (channel, title)) in enumerate(VIDEOS.items(), 1):
    if channel != current_channel:
        md += f"\n## {channel}\n\n"
        current_channel = channel

    data = results.get(vid_id, {})
    text = data.get("text", "N/A")

    md += f"### {i}. {title}\n"
    md += f"**Channel:** {channel} | **ID:** {vid_id}\n"
    md += f"**Link:** https://youtube.com/shorts/{vid_id}\n\n"
    if text.startswith("ERROR"):
        md += f"#### Script:\n_{text}_\n\n---\n\n"
    else:
        md += f"#### Script:\n{text}\n\n---\n\n"

output_path = os.path.join(SCRIPT_DIR, "b2b-finance-inspiration-shorts.md")
with open(output_path, "w") as f:
    f.write(md)

print(f"\nDone! {ok} OK, {fail} failed")
print(f"Scripts saved to: {output_path}")
