"""HTML message formatters for Telegram. One colour of meaning per line; numbers thousands-grouped."""
from __future__ import annotations

import html
from datetime import datetime, timezone

from . import hl_filter


def _age(created_at: str) -> str:
    created = hl_filter.parse_x_date(created_at)
    if not created:
        return "?"
    mins = int((datetime.now(timezone.utc) - created).total_seconds() // 60)
    if mins < 90:
        return f"{mins}m"
    return f"{mins // 60}h{mins % 60:02d}m"


def _clip(text: str, n: int = 280) -> str:
    text = html.escape(text.strip())
    return text if len(text) <= n else text[: n - 1] + "…"


def format_alert(hit: dict) -> str:
    handle = html.escape(hit["handle"])
    foll = hit.get("followers") or 0
    ratio = hit.get("views_vs_author_avg") or 0
    ratio_txt = f"{ratio:g}× their average" if ratio > 0 else "no baseline yet"
    return (
        f"⚡ <b>@{handle}</b> · {foll:,} followers · {_age(hit.get('created_at',''))} old\n"
        f"{hit['views']:,} views · {hit['likes']:,} likes · "
        f"{hit.get('retweets',0):,} RT · {hit.get('replies',0):,} replies\n"
        f"<b>{ratio_txt}</b> · score {hit['outlier_score']:,.0f}\n\n"
        f"{_clip(hit['text'])}\n\n"
        f'<a href="{html.escape(hit["url"])}">open on X</a>'
    )


def format_status(
    *,
    subscriber_count: int,
    accounts: dict,
    calibration: dict,
    spend_usd: float,
    calls_today: int,
    fired_today: int,
    last_scan_ago_min: float | None,
    cfg,
) -> str:
    if calibration:
        dist = calibration.get("score_distribution", {})
        cal_line = (
            f"threshold <b>{calibration.get('threshold', 0):,.0f}</b> "
            f"(p{calibration.get('threshold_percentile', '?')}) · "
            f"floors {calibration.get('min_views', 0):,} views / "
            f"{calibration.get('min_engagement', 0):,} eng\n"
            f"history p90 {dist.get('p90', 0):,.0f} · p95 {dist.get('p95', 0):,.0f} · "
            f"max {dist.get('max', 0):,.0f} ({calibration.get('sample_size', 0)} tweets)"
        )
        computed = calibration.get("computed_at", "?")[:16].replace("T", " ")
    else:
        cal_line = "<i>not calibrated yet — run /calibrate</i>"
        computed = "never"

    last_scan = f"{last_scan_ago_min:.0f}m ago" if last_scan_ago_min is not None else "not yet"
    return (
        f"<b>hyperfeed status</b>\n"
        f"subscribers: {subscriber_count}\n"
        f"accounts watched: {len(accounts)}\n"
        f"scan: every {cfg.scan_interval_min}m, last {last_scan}\n"
        f"{cal_line}\n"
        f"calibrated: {computed}\n"
        f"fired today: {fired_today}\n"
        f"twitterapi spend today: ${spend_usd:.4f} ({calls_today} calls, cap ${cfg.daily_cap_usd:.2f})"
    )


def format_calibration(cal: dict) -> str:
    if not cal or not cal.get("sample_size"):
        return "Calibration found no mature history — the accounts are quiet or the key is missing."
    dist = cal.get("score_distribution", {})
    lines = [
        f"<b>Calibration</b> — {len(cal.get('accounts', {}))} accounts, "
        f"{cal['sample_size']} tweets over {cal.get('window_days')}d",
        "",
        "outlier_score distribution:",
        f"  p50 {dist.get('p50',0):,.0f} · p75 {dist.get('p75',0):,.0f} · "
        f"p90 {dist.get('p90',0):,.0f} · p95 {dist.get('p95',0):,.0f} · max {dist.get('max',0):,.0f}",
        "",
        f"<b>fire when</b> score ≥ {cal.get('threshold',0):,.0f} "
        f"AND views ≥ {cal.get('min_views',0):,} AND eng ≥ {cal.get('min_engagement',0):,}",
        "",
        "<b>Top historical outliers</b> (what would have fired):",
    ]
    for r in cal.get("top_outliers", [])[:6]:
        ratio = r.get("views_vs_author_avg", 0)
        lines.append(
            f"  @{html.escape(r['handle'])} — {r['views']:,} views · "
            f"{ratio:g}× avg · score {r['outlier_score']:,.0f}"
        )
        snippet = html.escape((r.get("text") or "")[:90])
        lines.append(f"    <i>{snippet}</i>")
    return "\n".join(lines)


def format_recent(rows: list[dict]) -> str:
    if not rows:
        return "Nothing has fired yet."
    lines = ["<b>Recent outliers</b>"]
    for r in rows:
        ratio = r.get("views_vs_author_avg", 0)
        lines.append(
            f"⚡ @{html.escape(r.get('handle','?'))} · {r.get('views',0):,} views · "
            f"{ratio:g}× avg · score {r.get('outlier_score',0):,.0f}"
        )
        lines.append(f'    <a href="{html.escape(r.get("url",""))}">open on X</a>')
    return "\n".join(lines)


def format_accounts(accounts: dict) -> str:
    if not accounts:
        return "No accounts harvested yet."
    rows = sorted(accounts.items(), key=lambda kv: kv[1].get("followers", 0), reverse=True)
    lines = [f"<b>{len(accounts)} accounts watched</b>"]
    for handle, meta in rows:
        foll = meta.get("followers", 0)
        lines.append(f"  @{html.escape(handle)} — {foll:,}f" if foll else f"  @{html.escape(handle)}")
    return "\n".join(lines)
