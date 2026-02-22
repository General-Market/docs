import json
import os
import tempfile
from unittest.mock import MagicMock, patch

import pytest

from framework.tracker import Tracker


def make_mock_executor():
    executor = MagicMock()
    executor.bot_addr = "0x1234567890abcdef1234567890abcdef12345678"
    return executor


def make_tracker(config=None, pnl_file=None):
    """Build a Tracker with mocked executor and a temp pnl_file."""
    executor = make_mock_executor()
    cfg = config or {}
    if pnl_file:
        cfg["pnl_file"] = pnl_file
    elif "pnl_file" not in cfg:
        # Use a temp file so tests don't collide
        cfg["pnl_file"] = tempfile.mktemp(suffix=".json")
    urls_fn = MagicMock(return_value=["http://issuer1:8080"])
    return Tracker(executor, cfg, urls_fn), executor, urls_fn


# ─── Test 1: on_join creates position ──────────────────────────────────────────

def test_on_join_creates_position():
    tracker, _, _ = make_tracker()
    bitmap = b"\x01\x02"
    bets = ["BTC-UP", "ETH-DOWN"]
    tracker.on_join(42, 10_000_000, bitmap, bets)

    assert 42 in tracker._positions
    pos = tracker._positions[42]
    assert pos["batch_id"] == 42
    assert pos["deposited"] == 10_000_000
    assert pos["balance"] == 10_000_000
    assert pos["pnl"] == 0
    assert pos["bitmap"] == bitmap
    assert pos["bets"] == bets
    assert pos["joined_at"] > 0
    assert pos["last_claimed_tick"] == 0


# ─── Test 2: check_all fetches balance and updates PnL ────────────────────────

def test_check_all_updates_pnl():
    tracker, _, _ = make_tracker({"auto_claim": False, "auto_withdraw": False})
    tracker.on_join(1, 10_000_000, b"\x00", ["BTC-UP"])

    with patch.object(tracker, "_fetch_balance", return_value=15_000_000):
        tracker.check_all()

    assert tracker._positions[1]["balance"] == 15_000_000
    assert tracker._positions[1]["pnl"] == 5_000_000


# ─── Test 3: check_all handles API errors ─────────────────────────────────────

def test_check_all_handles_api_errors():
    tracker, _, _ = make_tracker({"auto_claim": False, "auto_withdraw": False})
    tracker.on_join(1, 10_000_000, b"\x00", ["BTC-UP"])

    with patch.object(tracker, "_fetch_balance", return_value=None):
        tracker.check_all()  # Should not crash

    # Balance and pnl unchanged
    assert tracker._positions[1]["balance"] == 10_000_000
    assert tracker._positions[1]["pnl"] == 0


# ─── Test 4: _try_claim with BLS sig calls executor.claim_rewards ─────────────

def test_try_claim_with_bls_sig():
    tracker, executor, _ = make_tracker()
    tracker.on_join(5, 10_000_000, b"\x00", ["BTC-UP"])
    pos = tracker._positions[5]

    mock_resp = MagicMock()
    mock_resp.ok = True
    mock_resp.json.return_value = {
        "bls_signature": "0xaabb",
        "current_tick": 5,
        "balance": 15_000_000,
    }

    with patch("framework.tracker.requests.get", return_value=mock_resp):
        tracker._try_claim(5, pos)

    executor.claim_rewards.assert_called_once_with(
        5, 0, 5, 15_000_000, bytes.fromhex("aabb")
    )
    assert pos["last_claimed_tick"] == 5
    assert pos["balance"] == 15_000_000


# ─── Test 5: _try_claim without BLS sig logs and skips ────────────────────────

def test_try_claim_without_bls_sig_skips():
    tracker, executor, _ = make_tracker()
    tracker.on_join(5, 10_000_000, b"\x00", ["BTC-UP"])
    pos = tracker._positions[5]

    mock_resp = MagicMock()
    mock_resp.ok = True
    mock_resp.json.return_value = {"balance": 15_000_000}

    with patch("framework.tracker.requests.get", return_value=mock_resp):
        tracker._try_claim(5, pos)

    executor.claim_rewards.assert_not_called()


# ─── Test 6: _try_withdraw with BLS sig calls executor.withdraw ───────────────

def test_try_withdraw_with_bls_sig():
    tracker, executor, _ = make_tracker()
    tracker.on_join(7, 10_000_000, b"\x00", ["ETH-UP"])
    pos = tracker._positions[7]

    mock_resp = MagicMock()
    mock_resp.ok = True
    mock_resp.json.return_value = {
        "bls_signature": "0xccdd",
        "balance": 500_000,
    }

    with patch("framework.tracker.requests.get", return_value=mock_resp):
        result = tracker._try_withdraw(7, pos)

    assert result is True
    executor.withdraw.assert_called_once_with(
        7, 500_000, bytes.fromhex("ccdd")
    )
    assert pos["balance"] == 0


# ─── Test 7: _try_withdraw without BLS sig logs and skips ─────────────────────

def test_try_withdraw_without_bls_sig_skips():
    tracker, executor, _ = make_tracker()
    tracker.on_join(7, 10_000_000, b"\x00", ["ETH-UP"])
    pos = tracker._positions[7]

    mock_resp = MagicMock()
    mock_resp.ok = True
    mock_resp.json.return_value = {"balance": 500_000}

    with patch("framework.tracker.requests.get", return_value=mock_resp):
        result = tracker._try_withdraw(7, pos)

    assert result is False
    executor.withdraw.assert_not_called()


# ─── Test 8: claim failure keeps position active ──────────────────────────────

def test_claim_failure_keeps_position():
    tracker, executor, _ = make_tracker()
    tracker.on_join(3, 10_000_000, b"\x00", ["BTC-UP"])
    pos = tracker._positions[3]

    executor.claim_rewards.side_effect = RuntimeError("tx reverted")

    mock_resp = MagicMock()
    mock_resp.ok = True
    mock_resp.json.return_value = {
        "bls_signature": "0xeeff",
        "current_tick": 2,
        "balance": 20_000_000,
    }

    with patch("framework.tracker.requests.get", return_value=mock_resp):
        tracker._try_claim(3, pos)

    # Position still active
    assert 3 in tracker._positions


# ─── Test 9: active_ids and active_count ──────────────────────────────────────

def test_active_ids_and_count():
    tracker, _, _ = make_tracker()
    assert tracker.active_count == 0
    assert tracker.active_ids == set()

    tracker.on_join(10, 1_000_000, b"\x01", ["A"])
    tracker.on_join(20, 2_000_000, b"\x02", ["B"])

    assert tracker.active_count == 2
    assert tracker.active_ids == {10, 20}


# ─── Test 10: get_summary aggregates across batches ───────────────────────────

def test_get_summary():
    tracker, _, _ = make_tracker({"auto_claim": False, "auto_withdraw": False})
    tracker.on_join(1, 10_000_000, b"\x00", ["BTC-UP"])
    tracker.on_join(2, 5_000_000, b"\x00", ["ETH-DOWN"])

    # Simulate PnL updates
    tracker._positions[1]["pnl"] = 3_000_000
    tracker._positions[1]["balance"] = 13_000_000
    tracker._positions[2]["pnl"] = -1_000_000
    tracker._positions[2]["balance"] = 4_000_000

    # Add a completed position to history
    tracker._history.append({"pnl": 7_000_000})

    summary = tracker.get_summary()
    assert summary["active_batches"] == 2
    assert summary["active_pnl"] == 2_000_000  # 3M + (-1M)
    assert summary["completed_batches"] == 1
    assert summary["completed_pnl"] == 7_000_000
    assert summary["total_pnl"] == 9_000_000


# ─── Test 11: save/load history roundtrip ─────────────────────────────────────

def test_save_load_roundtrip(tmp_path):
    pnl_file = str(tmp_path / "pnl.json")
    tracker1, executor1, urls_fn1 = make_tracker(pnl_file=pnl_file)

    tracker1.on_join(42, 10_000_000, b"\xab\xcd", ["BTC-UP", "ETH-DOWN"])
    tracker1._positions[42]["pnl"] = 2_000_000
    tracker1._positions[42]["balance"] = 12_000_000
    tracker1._history.append({"batch_id": 99, "pnl": 5_000_000})
    tracker1._save_history()

    # Verify file was written
    assert os.path.exists(pnl_file)

    # Create new tracker loading from same file
    executor2 = make_mock_executor()
    urls_fn2 = MagicMock(return_value=["http://issuer1:8080"])
    tracker2 = Tracker(executor2, {"pnl_file": pnl_file}, urls_fn2)

    assert 42 in tracker2._positions
    pos = tracker2._positions[42]
    assert pos["batch_id"] == 42
    assert pos["deposited"] == 10_000_000
    assert pos["balance"] == 12_000_000
    assert pos["pnl"] == 2_000_000
    assert pos["bitmap"] == b"\xab\xcd"
    assert pos["bets"] == ["BTC-UP", "ETH-DOWN"]

    assert len(tracker2._history) == 1
    assert tracker2._history[0]["pnl"] == 5_000_000


# ─── Test 12: missing history file doesn't crash ─────────────────────────────

def test_missing_history_file():
    tracker, _, _ = make_tracker(pnl_file="/tmp/nonexistent_test_pnl_xyz.json")
    assert tracker.active_count == 0
    assert tracker._history == []
