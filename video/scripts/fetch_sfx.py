#!/usr/bin/env python3
"""Search and download free sound effects from Freesound.org.

First-time setup:
  1. Get an API key at https://freesound.org/apiv2/apply/
  2. Set it: export FREESOUND_API_KEY=your_key_here
"""
import sys
import os

def main():
    try:
        import freesound
    except ImportError:
        print("Install: pip3 install git+https://github.com/MTG/freesound-python.git")
        sys.exit(1)

    api_key = os.environ.get("FREESOUND_API_KEY")
    if not api_key:
        print("Set your API key: export FREESOUND_API_KEY=your_key")
        print("Get one at: https://freesound.org/apiv2/apply/")
        sys.exit(1)

    if len(sys.argv) < 2:
        print("Usage: python3 fetch_sfx.py <search query> [max_results]")
        print("Examples:")
        print("  python3 fetch_sfx.py 'whoosh'")
        print("  python3 fetch_sfx.py 'explosion' 5")
        print("  python3 fetch_sfx.py 'UI click'")
        print("  python3 fetch_sfx.py 'cinematic boom'")
        sys.exit(1)

    query = sys.argv[1]
    max_results = int(sys.argv[2]) if len(sys.argv) > 2 else 3

    client = freesound.FreesoundClient()
    client.set_token(api_key)

    print(f"Searching Freesound for: '{query}'")
    results = client.text_search(
        query=query,
        fields="id,name,previews,duration,license,avg_rating",
        sort="rating_desc",
        page_size=max_results,
    )

    os.makedirs("public/sfx", exist_ok=True)

    for sound in results:
        print(f"\n  [{sound.id}] {sound.name} ({sound.duration:.1f}s) - {sound.license}")
        filename = f"public/sfx/{sound.id}_{sound.name.replace(' ', '_')[:30]}.mp3"
        sound.retrieve_preview(".", filename)
        print(f"  -> {filename}")

    print(f"\nDownloaded {max_results} sounds to public/sfx/")

if __name__ == "__main__":
    main()
