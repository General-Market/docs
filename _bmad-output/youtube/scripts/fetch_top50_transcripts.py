#!/usr/bin/env python3
"""Fetch transcripts for top 50 storytelling shorts channels.
Run after YouTube IP ban lifts (~1-24h after rate limit)."""

import json, time, os
from youtube_transcript_api import YouTubeTranscriptApi

VIDEOS = {
    "oJcNzBDmw9M": "5-Minute Crafts",
    "fgbyNUe6cUw": "BRIGHT SIDE",
    "4mpgLQep6OE": "WatchMojo",
    "lAMOX_sdudg": "Zack D. Films",
    "dwZgy7SNMRc": "Kurzgesagt",
    "9BsQpGhwVAY": "Mark Rober",
    "4v9TW3okslA": "Daily Dose of Internet",
    "Bt3boxwRF84": "Veritasium",
    "q4eBzp8KIFY": "FactTechz",
    "Pvj5-5IwhqA": "The Infographics Show",
    "l34kkOK-_60": "Jake Fellman",
    "tQfhQvsuiwA": "Nas Daily",
    "MkmFDKU0zyE": "Vox",
    "dF_f92aW2TI": "RealLifeLore",
    "NDU1lkkK0U4": "Johnny Harris",
    "-kwF6M4juiU": "MinutePhysics",
    "YYFDCxgUp6c": "Simple History",
    "2qOya17le0A": "Vsauce",
    "PoF_doh3NOE": "Casual Geographic",
    "wPcgok7gPBM": "TierZoo",
    "rEabdfDchTE": "Half as Interesting",
    "DmMmnSIQmx8": "Economics Explained",
    "3KEi3lUXVoU": "PolyMatter",
    "N6IWoMOSPEU": "MagnatesMedia",
    "VQ2bV58QbH0": "Two Minute Papers",
    "sKjZg5I5CcQ": "Joe Scott",
    "TwiAVzGYZqc": "Jay Shetty",
    "mcl19kck9QE": "SciShow",
    "nhgoun96PA8": "What If",
    "EXzFQauTBnI": "MinuteEarth",
    "onR2CjW-NBY": "Epic History TV",
    "KdylgKfrUdM": "Mr. Nightmare",
    "u-NCTZ8oaHE": "Top5s",
    "_7AGD_bBsVY": "Ben Lionel Scott",
    "TPju_zfhCJU": "Low Budget Stories",
    "jJZ_B5SEviw": "National Geographic",
    "dgu3rY2rzeQ": "Big Think",
    "fwBIZRq-vzY": "Fireship",
    "-W_I5mdsjqc": "Storybooth",
    "JDnBqIlyYwk": "DaFuq!?Boom!",
    "VUk_oJctE-M": "Nutshell Animations",
    "I7GIQHZOJL4": "How To Survive",
    "FgEiXbydeHI": "The Why Files",
    "q36rH2ER-I8": "Cleo Abram",
}

TITLES = {
    "oJcNzBDmw9M": "Valentine or Birthday idea that you will gasp about!",
    "fgbyNUe6cUw": "Internet Panics After Hearing Leaked Audio From The ISS",
    "4mpgLQep6OE": "One Piece Season 2 Trailer: Live Action vs Anime",
    "lAMOX_sdudg": "How Cafe Robots Let People Work From Home",
    "dwZgy7SNMRc": "The Virus We Almost Beat",
    "9BsQpGhwVAY": "pride comes before flop",
    "4v9TW3okslA": "Incredible Plate Art",
    "Bt3boxwRF84": "World's Largest Spiderweb",
    "q4eBzp8KIFY": "Dubai FIRED Unexpected WAR on Sugar!",
    "Pvj5-5IwhqA": "You've Been Wrong About T-Rex Arms",
    "l34kkOK-_60": "First Time Skiing",
    "tQfhQvsuiwA": "the fastest way to make your first dollar online",
    "MkmFDKU0zyE": "A look inside Australia's bat hospital",
    "dF_f92aW2TI": "Why Morocco & Algeria Hate Each Other",
    "NDU1lkkK0U4": "The World's Most Important Ocean?",
    "-kwF6M4juiU": "Not a rainbow!",
    "YYFDCxgUp6c": "A Tank That Can Fly?!",
    "2qOya17le0A": "Album Art Origins",
    "PoF_doh3NOE": "Meet the Megabat (Real Life Dracula??)",
    "wPcgok7gPBM": "Jumping spider charges up a pouncing attack",
    "rEabdfDchTE": "Why Blackcurrant Flavor Doesn't Exist in the US",
    "DmMmnSIQmx8": "Is German Precision Manufacturing Over?",
    "3KEi3lUXVoU": "This is Not Target",
    "N6IWoMOSPEU": "The Fugitive CEO Who Escaped In A Box",
    "VQ2bV58QbH0": "AlphaFold - The Most Important AI Breakthrough Ever Made",
    "sKjZg5I5CcQ": "In case you ever wondered the finer points of chair spinning",
    "TwiAVzGYZqc": "I wish someone told me this sooner",
    "mcl19kck9QE": "SciShow is in the field NOW!",
    "nhgoun96PA8": "What If You Travelled 1 Billion Years into the Future?",
    "EXzFQauTBnI": "Where do we get snake antivenom?",
    "onR2CjW-NBY": "Napoleon's Genius at Austerlitz vs. Trafalgar Disaster",
    "KdylgKfrUdM": "Boy cuts through cornfield, hears rustling in the crops",
    "u-NCTZ8oaHE": "Who's Stood BEHIND Them?",
    "_7AGD_bBsVY": "RECIPE FOR SUCCESS - Motivational Speech",
    "TPju_zfhCJU": "Holidays be like",
    "jJZ_B5SEviw": "Paid content for Nevada Tourism",
    "dgu3rY2rzeQ": "Why conflict is good",
    "fwBIZRq-vzY": "5 life-changing Linux tips",
    "-W_I5mdsjqc": "I Had To Escape My Mother",
    "JDnBqIlyYwk": "everything you need to know about skibidi toilet",
    "VUk_oJctE-M": "Stop Pronouncing The T",
    "I7GIQHZOJL4": "Can Sleep Paralysis Kill You?",
    "FgEiXbydeHI": "Surviving the Apocalypse: When the Stars Fell on Christmas Day",
    "q36rH2ER-I8": "This Cancer Is Not Incurable (Anymore)",
}

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
TRANSCRIPT_DIR = os.path.join(SCRIPT_DIR, "transcripts")
os.makedirs(TRANSCRIPT_DIR, exist_ok=True)

api = YouTubeTranscriptApi()
results = {}
ok = 0
fail = 0

for vid_id, channel in VIDEOS.items():
    try:
        transcript = api.fetch(vid_id, languages=['en'])
        text = ' '.join([t.text for t in transcript.snippets])
        results[vid_id] = {"channel": channel, "text": text}

        with open(os.path.join(TRANSCRIPT_DIR, f"{vid_id}.txt"), "w") as f:
            f.write(text)

        ok += 1
        print(f"OK [{ok}/{len(VIDEOS)}]: {channel} ({vid_id}) - {len(text)} chars")
        time.sleep(1)  # Rate limit protection
    except Exception as e:
        fail += 1
        err = str(e).split('\n')[0]
        results[vid_id] = {"channel": channel, "text": f"ERROR: {err}"}
        print(f"FAIL: {channel} ({vid_id}): {err}")

# Build scripts markdown
md = "# Top 50 Storytelling Shorts - Scripts\n\n"
md += f"Transcripts from top storytelling/explainer YouTube Shorts channels (2025).\n"
md += f"Successfully fetched: {ok}/{len(VIDEOS)}\n\n---\n\n"

for i, (vid_id, channel) in enumerate(VIDEOS.items(), 1):
    title = TITLES.get(vid_id, "Unknown")
    data = results.get(vid_id, {})
    text = data.get("text", "N/A")

    md += f"## {i}. {title}\n"
    md += f"**Channel:** {channel} | **ID:** {vid_id}\n"
    md += f"**Link:** https://youtube.com/shorts/{vid_id}\n\n"
    if text.startswith("ERROR"):
        md += f"### Script:\n_{text}_\n\n---\n\n"
    else:
        md += f"### Script:\n{text}\n\n---\n\n"

output_path = os.path.join(SCRIPT_DIR, "top50-storytelling-shorts-scripts.md")
with open(output_path, "w") as f:
    f.write(md)

print(f"\nDone! {ok} OK, {fail} failed")
print(f"Scripts saved to: {output_path}")
