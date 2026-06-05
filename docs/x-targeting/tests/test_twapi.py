import json
import multiprocessing as mp
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import twapi


def _worker(i, cache_dir):
    # Redirect cache into tmp dir
    twapi.PROFILES = Path(cache_dir) / "profiles.jsonl"
    twapi.TWEETS = Path(cache_dir) / "tweets.jsonl"
    twapi.LOCK_FILE = Path(cache_dir) / ".cache.lock"
    twapi.upsert_profile({"userName": f"user{i}", "id": str(i), "followers": i})


def test_concurrent_upserts_lose_nothing(tmp_path):
    procs = [mp.Process(target=_worker, args=(i, str(tmp_path))) for i in range(20)]
    [p.start() for p in procs]
    [p.join() for p in procs]
    rows = [json.loads(l) for l in (tmp_path / "profiles.jsonl").read_text().splitlines() if l.strip()]
    names = {r["screen_name"] for r in rows}
    assert names == {f"user{i}" for i in range(20)}, f"lost writes: {sorted(names)}"
