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


def test_query_hash_canonicalizes_whitespace():
    a = twapi.query_hash("pumpfun  lang:zh   min_faves:50", "Top")
    b = twapi.query_hash("pumpfun lang:zh min_faves:50", "Top")
    c = twapi.query_hash("pumpfun lang:zh min_faves:50", "Latest")
    assert a == b
    assert a != c


def test_search_dedup_blocks_within_ttl(tmp_path, monkeypatch):
    searches = tmp_path / "searches.jsonl"
    monkeypatch.setattr(twapi, "SEARCHES", searches)
    twapi.log_search("foo lang:ja", "Top", cell="perps-jp", n_tweets=20, n_new=20)
    assert twapi.search_done_recently("foo  lang:ja", "Top", ttl_days=7) is True
    assert twapi.search_done_recently("foo lang:ja", "Latest", ttl_days=7) is False


def test_followings_accepts_top_level_response(tmp_path, monkeypatch):
    monkeypatch.setattr(twapi, "PROFILES", tmp_path / "profiles.jsonl")
    monkeypatch.setattr(twapi, "LOCK_FILE", tmp_path / ".cache.lock")
    monkeypatch.setattr(twapi, "session_spent_credits", lambda: 0)

    def fake_metered_call(label, path, params, estimate=0):
        return {
            "status": "success",
            "followings": [
                {"userName": "edge_a", "id": "1", "followers": 1234},
                {"userName": "edge_b", "id": "2", "followers": 5678},
            ],
            "has_next_page": False,
            "next_cursor": "",
        }

    monkeypatch.setattr(twapi, "metered_call", fake_metered_call)
    twapi.cmd_followings("source_handle", max_results=200)

    rows = [json.loads(l) for l in (tmp_path / "profiles.jsonl").read_text().splitlines() if l.strip()]
    by_name = {r["screen_name"]: r for r in rows}
    assert by_name["edge_a"]["followed_by"] == ["source_handle"]
    assert by_name["edge_b"]["followed_by"] == ["source_handle"]


def test_upsert_profile_accepts_snake_case_counts(tmp_path, monkeypatch):
    monkeypatch.setattr(twapi, "PROFILES", tmp_path / "profiles.jsonl")
    monkeypatch.setattr(twapi, "LOCK_FILE", tmp_path / ".cache.lock")

    twapi.upsert_profile({
        "userName": "snake_counts",
        "id": "1",
        "followers_count": 12345,
        "following_count": 67,
        "favourites_count": 89,
        "statuses_count": 1011,
        "media_tweets_count": 12,
    })

    row = json.loads((tmp_path / "profiles.jsonl").read_text().splitlines()[0])
    assert row["followers_count"] == 12345
    assert row["friends_count"] == 67
    assert row["favourites_count"] == 89
    assert row["statuses_count"] == 1011
    assert row["media_count"] == 12
