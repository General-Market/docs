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


def test_project_budget_math(tmp_path, monkeypatch):
    budget = tmp_path / "budget.json"
    budget.write_text(json.dumps({
        "cap_usd": 15.0, "baseline_credits": 1_000_000, "spent_locked_credits": 100_000,
    }))
    monkeypatch.setattr(twapi, "BUDGET_FILE", budget)
    monkeypatch.setattr(twapi, "balance", lambda: (700_000, 0))
    # spent = locked 100k + (baseline 1,000k - current 700k) = 400k credits = $4
    assert twapi.project_spent_credits() == 400_000
    # cap 15 USD = 1.5M credits; 400k spent + 1.2M estimate would breach
    try:
        twapi.check_budget(1_200_000)
        assert False, "should have exited"
    except SystemExit as e:
        assert e.code == 2
    # small estimate passes
    twapi.check_budget(10_000)
