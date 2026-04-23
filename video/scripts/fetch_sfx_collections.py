#!/usr/bin/env python3
"""Batch-download SFX collections from Freesound.org for launch videos.

Fetches 5 collections of ~20 sounds each, organized into subdirectories.
Reads API key from video/.env automatically.
"""
import sys
import os
import re
from pathlib import Path

def load_env():
    env_path = Path(__file__).resolve().parent.parent / ".env"
    if env_path.exists():
        for line in env_path.read_text().splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, _, val = line.partition("=")
                os.environ.setdefault(key.strip(), val.strip())

def slugify(name: str) -> str:
    return re.sub(r'[^a-z0-9]+', '-', name.lower()).strip('-')[:40]

def fetch_collection(client, collection_name: str, queries: list[dict], out_dir: Path):
    """Fetch a collection of SFX from multiple queries into one directory."""
    out_dir.mkdir(parents=True, exist_ok=True)
    total = 0

    for q in queries:
        query = q["query"]
        count = q.get("count", 5)
        min_dur = q.get("min_duration", 0.1)
        max_dur = q.get("max_duration", 5.0)

        print(f"\n  Searching: '{query}' (up to {count}, {min_dur}-{max_dur}s)")
        try:
            results = client.text_search(
                query=query,
                fields="id,name,previews,duration,license,avg_rating,tags",
                filter=f"duration:[{min_dur} TO {max_dur}]",
                sort="rating_desc",
                page_size=count,
            )
        except Exception as e:
            print(f"  ERROR searching '{query}': {e}")
            continue

        for sound in results:
            slug = slugify(sound.name)
            filename = out_dir / f"{slug}--{sound.id}.mp3"
            if filename.exists():
                print(f"    SKIP (exists): {filename.name}")
                continue
            try:
                sound.retrieve_preview(str(out_dir), str(filename))
                print(f"    [{sound.id}] {sound.name} ({sound.duration:.1f}s) -> {filename.name}")
                total += 1
            except Exception as e:
                print(f"    ERROR downloading {sound.name}: {e}")

    print(f"\n  => {collection_name}: {total} new sounds in {out_dir}")
    return total


COLLECTIONS = {
    "xylophone-bells": {
        "description": "Xylophone, glockenspiel, bells, chimes — bright melodic accents",
        "queries": [
            {"query": "xylophone single note", "count": 5, "max_duration": 3},
            {"query": "glockenspiel hit", "count": 4, "max_duration": 3},
            {"query": "bell chime notification", "count": 4, "max_duration": 4},
            {"query": "wind chimes gentle", "count": 3, "max_duration": 5},
            {"query": "marimba hit single", "count": 4, "max_duration": 3},
        ],
    },
    "whoosh-transitions": {
        "description": "Whooshes, swipes, swooshes — for scene transitions and motion",
        "queries": [
            {"query": "whoosh fast", "count": 5, "max_duration": 2},
            {"query": "swoosh transition", "count": 5, "max_duration": 2},
            {"query": "swipe sound effect", "count": 5, "max_duration": 2},
            {"query": "air whoosh soft", "count": 5, "max_duration": 3},
        ],
    },
    "impacts-hits": {
        "description": "Impacts, thuds, punches, bass drops — for emphasis and reveals",
        "queries": [
            {"query": "impact hit deep", "count": 5, "max_duration": 3},
            {"query": "bass drop cinematic", "count": 4, "max_duration": 4},
            {"query": "thud impact low", "count": 4, "max_duration": 3},
            {"query": "punch hit", "count": 4, "max_duration": 2},
            {"query": "slam impact", "count": 3, "max_duration": 3},
        ],
    },
    "ui-pops-clicks": {
        "description": "UI sounds, pops, clicks, blips — for data reveals and micro-interactions",
        "queries": [
            {"query": "pop bubble", "count": 5, "max_duration": 2},
            {"query": "click UI interface", "count": 5, "max_duration": 1},
            {"query": "blip notification", "count": 4, "max_duration": 2},
            {"query": "ding success", "count": 3, "max_duration": 3},
            {"query": "typing keyboard single", "count": 3, "max_duration": 2},
        ],
    },
    "risers-cinematic": {
        "description": "Risers, swells, stingers, drones — for tension and dramatic reveals",
        "queries": [
            {"query": "riser cinematic", "count": 5, "max_duration": 5},
            {"query": "tension build suspense", "count": 4, "max_duration": 5},
            {"query": "reveal stinger", "count": 4, "max_duration": 4},
            {"query": "logo reveal sound", "count": 4, "max_duration": 5},
            {"query": "dramatic swell orchestra", "count": 3, "max_duration": 5},
        ],
    },
}


def main():
    load_env()

    try:
        import freesound
    except ImportError:
        print("Install: pip3 install git+https://github.com/MTG/freesound-python.git")
        sys.exit(1)

    api_key = os.environ.get("FREESOUND_API_KEY")
    if not api_key:
        print("No FREESOUND_API_KEY found. Add it to video/.env")
        sys.exit(1)

    client = freesound.FreesoundClient()
    client.set_token(api_key)

    base_dir = Path(__file__).resolve().parent.parent / "public" / "sfx" / "collections"
    grand_total = 0

    print("=" * 60)
    print("Fetching 5 SFX collections for launch videos")
    print("=" * 60)

    for name, config in COLLECTIONS.items():
        print(f"\n{'─' * 50}")
        print(f"Collection: {name}")
        print(f"  {config['description']}")
        out_dir = base_dir / name
        count = fetch_collection(client, name, config["queries"], out_dir)
        grand_total += count

    print(f"\n{'=' * 60}")
    print(f"Done. {grand_total} total new sounds across 5 collections.")
    print(f"Location: {base_dir}")
    print("=" * 60)


if __name__ == "__main__":
    main()
