#!/usr/bin/env python3
"""Source audit — flag DEAD/GHOST/DEGENERATE/NO_VAULTS/NO_BOTS sources.

Pulls everything in one pass from the oracle API on VPS 1, cross-references
with funds.toml and data/fund-branding.json, writes a JSON snapshot + a
markdown report. No fixes, only diagnosis.

Run from the repo root:
    ssh index-maker/prod/be 'cd /home/max/index && python3 scripts/audit/source_audit.py'

Or locally if oracle ports are forwarded.
"""
from __future__ import annotations

import json
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib import request as urlreq
from urllib.error import HTTPError, URLError

REPO_ROOT = Path(__file__).resolve().parents[2]
ORACLE_URL = os.environ.get("ORACLE_URL", "http://localhost:10001")
OUT_DIR = REPO_ROOT / "audit-data"
OUT_DIR.mkdir(parents=True, exist_ok=True)

# Sources flagged DEAD if no settlement within this many seconds.
# Tick durations vary widely (1m to 24h). We use 4× the longest expected
# meaningful cadence — anything older than 4h is genuinely silent.
DEAD_THRESHOLD_S = 4 * 3600

# Number of recent batches inspected per source.
RECENT_BATCHES = 5


def http_get_json(url: str, timeout: float = 10.0) -> dict | None:
    try:
        with urlreq.urlopen(url, timeout=timeout) as r:
            return json.loads(r.read().decode("utf-8"))
    except (HTTPError, URLError, TimeoutError, json.JSONDecodeError):
        return None


def load_funds_toml() -> dict[str, list[str]]:
    """Return {source_name: [vault_addr_lowercase, ...]} from funds.toml."""
    path = REPO_ROOT / "vision-bot" / "funds.toml"
    if not path.exists():
        return {}
    text = path.read_text()
    funds_by_source: dict[str, list[str]] = {}
    cur_sources: list[str] = []
    cur_vault: str | None = None
    for line in text.splitlines():
        s = line.strip()
        if s.startswith("[[funds]]"):
            if cur_vault and cur_sources:
                for src in cur_sources:
                    funds_by_source.setdefault(src, []).append(cur_vault.lower())
            cur_sources = []
            cur_vault = None
        elif s.startswith("vault"):
            # vault = "0x..."
            try:
                cur_vault = s.split("=", 1)[1].strip().strip('"').strip("'")
            except IndexError:
                cur_vault = None
        elif s.startswith("sources"):
            # sources = ["foo", "bar"]
            try:
                rhs = s.split("=", 1)[1].strip()
                rhs = rhs.strip("[]")
                items = [
                    p.strip().strip('"').strip("'")
                    for p in rhs.split(",")
                    if p.strip()
                ]
                cur_sources = [i for i in items if i]
            except IndexError:
                cur_sources = []
    if cur_vault and cur_sources:
        for src in cur_sources:
            funds_by_source.setdefault(src, []).append(cur_vault.lower())
    return funds_by_source


def load_fund_branding() -> set[str]:
    path = REPO_ROOT / "frontend" / "data" / "fund-branding.json"
    if not path.exists():
        return set()
    data = json.loads(path.read_text())
    out: set[str] = set()
    for f in data.get("funds", []):
        v = f.get("vault")
        if isinstance(v, str):
            out.add(v.lower())
    return out


def parse_iso(ts: str | None) -> datetime | None:
    if not ts:
        return None
    try:
        # The API returns Z-suffix or +00:00. Normalise.
        return datetime.fromisoformat(ts.replace("Z", "+00:00"))
    except ValueError:
        return None


def collect() -> dict:
    """Pull every signal we need into one JSON blob. No analysis."""
    snapshot = {
        "collected_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "oracle_url": ORACLE_URL,
        "sources": {},
    }

    src_stats = http_get_json(f"{ORACLE_URL}/vision/explorer/source-stats")
    if not src_stats:
        print(f"FATAL: source-stats unreachable at {ORACLE_URL}", file=sys.stderr)
        sys.exit(1)
    raw_sources = src_stats.get("sources", [])
    print(f"[1/3] {len(raw_sources)} sources from source-stats", file=sys.stderr)

    funds_by_source = load_funds_toml()
    vault_addrs = load_fund_branding()
    snapshot["funds_by_source"] = funds_by_source
    snapshot["vault_addrs_known"] = sorted(vault_addrs)
    print(
        f"[2/3] {len(funds_by_source)} sources in funds.toml, "
        f"{len(vault_addrs)} known vault addresses",
        file=sys.stderr,
    )

    print(f"[3/3] Pulling history+results for {len(raw_sources)} sources...", file=sys.stderr)
    for i, s in enumerate(raw_sources):
        src_id = s["source_id"]
        if (i + 1) % 10 == 0:
            print(f"     {i+1}/{len(raw_sources)} ({src_id})", file=sys.stderr)
        entry = {
            "source_id": src_id,
            "last_settled_at": s.get("last_settled_at"),
            "settled_batches_total": s.get("settled_batches", 0),
            "trader_count_total": s.get("trader_count", 0),
            "total_deposited_wei": s.get("total_deposited_wei", "0"),
            "history": [],
            "configured_funds": funds_by_source.get(src_id, []),
        }
        hist = http_get_json(
            f"{ORACLE_URL}/vision/source/{src_id}/history?limit={RECENT_BATCHES}"
        )
        batches = (hist or {}).get("batches", []) if hist else []
        # Pull players + ratios for each recent batch in parallel-ish (sequential
        # with 5 calls is fine, ~50 sources × 5 = 250 HTTP calls).
        for b in batches[:RECENT_BATCHES]:
            bid = b.get("batchId")
            if bid is None:
                continue
            results = http_get_json(f"{ORACLE_URL}/vision/rounds/{bid}/results")
            ratios = http_get_json(f"{ORACLE_URL}/vision/batch/{bid}/ratios")
            players = (results or {}).get("players", []) if results else []
            markets = (ratios or {}).get("markets", []) if ratios else []
            entry["history"].append({
                "batchId": bid,
                "settledAt": b.get("settledAt"),
                "status": b.get("status"),
                "marketCount": b.get("marketCount", 0),
                "playerCount": b.get("playerCount", 0),
                "totalPool": b.get("totalPool", 0),
                "topEarnerAddress": (b.get("topEarnerAddress") or "").lower() or None,
                "players": [
                    {
                        "addr": str(p.get("player", "")).lower(),
                        "deposited": p.get("deposited", "0"),
                        "payout": p.get("payout", "0"),
                        "correct": p.get("correctCount", 0),
                        "total_markets": p.get("totalMarkets", 0),
                    }
                    for p in players
                ],
                "markets": [
                    {
                        "assetId": m.get("assetId"),
                        "outcome": m.get("outcome"),
                        "upPct": m.get("upPct", 0),
                        "downPct": m.get("downPct", 0),
                        "pctChangeBps": m.get("pctChangeBps", 0),
                    }
                    for m in markets
                ],
            })
        snapshot["sources"][src_id] = entry

    return snapshot


def analyse(snapshot: dict) -> list[dict]:
    """Turn the snapshot into a list of per-source verdicts.

    One source produces one row. The first matching category wins; all signals
    are recorded for the report regardless.
    """
    now = datetime.now(timezone.utc)
    vault_addrs = set(snapshot.get("vault_addrs_known", []))
    funds_by_source = snapshot.get("funds_by_source", {})
    rows: list[dict] = []

    for src_id, e in snapshot["sources"].items():
        last = parse_iso(e.get("last_settled_at"))
        age_s = (now - last).total_seconds() if last else None

        history = e.get("history", [])
        recent_settled = [h for h in history if h.get("status") == "settled"]
        market_outcomes: list[str] = []
        bot_count_per_round: list[int] = []
        vault_count_per_round: list[int] = []
        empty_player_rounds = 0
        for h in recent_settled:
            addrs = [p["addr"] for p in h.get("players", []) if p.get("addr")]
            vaults_here = [a for a in addrs if a in vault_addrs]
            bots_here = [a for a in addrs if a not in vault_addrs]
            vault_count_per_round.append(len(vaults_here))
            bot_count_per_round.append(len(bots_here))
            # Empty PLAYER round = round settled but nobody recorded a side
            if h.get("playerCount", 0) > 0 and len(addrs) == 0:
                empty_player_rounds += 1
            for m in h.get("markets", []):
                outcome = m.get("outcome")
                if outcome:
                    market_outcomes.append(outcome)

        avg_bots = (sum(bot_count_per_round) / len(bot_count_per_round)) if bot_count_per_round else 0
        avg_vaults = (sum(vault_count_per_round) / len(vault_count_per_round)) if vault_count_per_round else 0
        configured_vaults = funds_by_source.get(src_id, [])
        # DEGENERATE: same outcome for every market in last 3 rounds
        outcome_set = set(market_outcomes) if market_outcomes else set()
        is_degenerate = (
            len(market_outcomes) >= 5
            and len(outcome_set) == 1
        )
        # GHOST: settled rounds where chain reports playerCount > 0 but the
        # results endpoint returns zero recorded players. That is exactly the
        # "joined but bitmap never landed" pattern.
        is_ghost = empty_player_rounds >= max(1, len(recent_settled) // 3)

        # Categorise — first match wins.
        if not last:
            status = "DEAD"
            reason = "no settlements ever recorded"
        elif age_s is not None and age_s > DEAD_THRESHOLD_S:
            status = "DEAD"
            reason = f"last settlement {int(age_s/3600)}h ago"
        elif is_ghost:
            status = "GHOST"
            reason = f"{empty_player_rounds}/{len(recent_settled)} recent rounds had 0 recorded players"
        elif is_degenerate:
            status = "DEGENERATE"
            reason = f"all {len(market_outcomes)} markets settled {next(iter(outcome_set))}"
        elif configured_vaults and avg_vaults < 1:
            status = "NO_VAULTS"
            reason = f"{len(configured_vaults)} funds configured, none joining recent rounds"
        elif avg_bots < 3:
            status = "NO_BOTS"
            reason = f"avg {avg_bots:.1f} bots/round (want ≥3)"
        elif not configured_vaults:
            status = "UNCONFIGURED"
            reason = "rounds settling but no fund configured in funds.toml"
        else:
            status = "HEALTHY"
            reason = ""

        rows.append({
            "source_id": src_id,
            "status": status,
            "reason": reason,
            "last_settled_at": e.get("last_settled_at"),
            "age_h": round(age_s / 3600, 1) if age_s is not None else None,
            "settled_batches_total": e.get("settled_batches_total", 0),
            "trader_count_total": e.get("trader_count_total", 0),
            "recent_batches_inspected": len(recent_settled),
            "avg_bots_per_round": round(avg_bots, 1),
            "avg_vaults_per_round": round(avg_vaults, 1),
            "configured_funds": len(configured_vaults),
            "empty_player_rounds": empty_player_rounds,
            "market_outcomes_in_window": len(market_outcomes),
            "outcome_distribution": (
                f"{sum(1 for o in market_outcomes if o == 'Up')}U/"
                f"{sum(1 for o in market_outcomes if o == 'Down')}D/"
                f"{sum(1 for o in market_outcomes if o not in ('Up', 'Down'))}other"
                if market_outcomes else "—"
            ),
        })

    severity = {
        "DEAD": 0,
        "GHOST": 1,
        "DEGENERATE": 2,
        "NO_VAULTS": 3,
        "NO_BOTS": 4,
        "UNCONFIGURED": 5,
        "HEALTHY": 6,
    }
    rows.sort(key=lambda r: (severity.get(r["status"], 99), -r.get("settled_batches_total", 0)))
    return rows


def render_md(rows: list[dict], snapshot: dict) -> str:
    counts: dict[str, int] = {}
    for r in rows:
        counts[r["status"]] = counts.get(r["status"], 0) + 1

    lines = []
    lines.append(f"# Vision Source Audit — {snapshot['collected_at']}")
    lines.append("")
    lines.append(f"Oracle: `{snapshot['oracle_url']}`")
    lines.append(f"Sources: **{len(rows)}**")
    lines.append("")
    lines.append("## Summary")
    lines.append("")
    lines.append("| Status | Count |")
    lines.append("|---|---|")
    for status in ("DEAD", "GHOST", "DEGENERATE", "NO_VAULTS", "NO_BOTS", "UNCONFIGURED", "HEALTHY"):
        lines.append(f"| {status} | {counts.get(status, 0)} |")
    lines.append("")
    lines.append("## Detail (sorted: most broken first)")
    lines.append("")
    lines.append("| Source | Status | Last Settled | Age (h) | Total Batches | Bots/Round | Vaults/Round | Funds | Outcome Mix | Notes |")
    lines.append("|---|---|---|---|---:|---:|---:|---:|---|---|")
    for r in rows:
        last = r["last_settled_at"] or "—"
        age = f"{r['age_h']}" if r["age_h"] is not None else "—"
        lines.append(
            f"| `{r['source_id']}` | **{r['status']}** | {last} | {age} | "
            f"{r['settled_batches_total']} | {r['avg_bots_per_round']} | "
            f"{r['avg_vaults_per_round']} | {r['configured_funds']} | "
            f"{r['outcome_distribution']} | {r['reason']} |"
        )
    return "\n".join(lines) + "\n"


def main() -> int:
    snapshot = collect()
    rows = analyse(snapshot)
    snapshot["verdicts"] = rows

    ts = int(time.time())
    json_path = OUT_DIR / f"source-audit-{ts}.json"
    md_path = OUT_DIR / f"source-audit-{ts}.md"
    latest_json = OUT_DIR / "source-audit-latest.json"
    latest_md = OUT_DIR / "source-audit-latest.md"

    json_path.write_text(json.dumps(snapshot, indent=2, default=str))
    md_path.write_text(render_md(rows, snapshot))
    latest_json.write_text(json.dumps(snapshot, indent=2, default=str))
    latest_md.write_text(render_md(rows, snapshot))

    print(f"\nWrote {json_path}", file=sys.stderr)
    print(f"Wrote {md_path}", file=sys.stderr)
    print(f"\n=== Summary ===", file=sys.stderr)
    counts: dict[str, int] = {}
    for r in rows:
        counts[r["status"]] = counts.get(r["status"], 0) + 1
    for status in ("DEAD", "GHOST", "DEGENERATE", "NO_VAULTS", "NO_BOTS", "UNCONFIGURED", "HEALTHY"):
        print(f"  {status:<14} {counts.get(status, 0)}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
