"""Tests for framework.core — bitmap encoding, Strategy ABC, RiskCheck."""

import pytest

from framework.core import (
    encode_bitmap,
    hash_bitmap,
    RiskCheck,
    Strategy,
)


# ── encode_bitmap ────────────────────────────────────────────────


from framework.core import MAX_BITMAP_BYTES


class TestEncodeBitmap:
    """The bitmap is now padded to a fixed ceiling (MAX_BITMAP_BYTES = 1024).
    Tests verify the meaningful prefix bytes; trailing bytes must always be 0x00.
    The padding closes the race with the oracle's lifecycle market_count column.
    """

    def test_all_up_8_markets(self):
        """8 UP bets -> first byte 0xFF, rest zero."""
        result = encode_bitmap(["UP"] * 8, 8)
        assert len(result) == MAX_BITMAP_BYTES
        assert result[0] == 0xFF
        assert result[1:] == bytes(MAX_BITMAP_BYTES - 1)

    def test_all_down_8_markets(self):
        """8 DOWN bets -> all bytes zero."""
        result = encode_bitmap(["DOWN"] * 8, 8)
        assert len(result) == MAX_BITMAP_BYTES
        assert result == bytes(MAX_BITMAP_BYTES)

    def test_alternating_up_down(self):
        """[UP,DOWN,UP,DOWN,UP,DOWN,UP,DOWN] -> first byte 0xAA."""
        result = encode_bitmap(["UP", "DOWN"] * 4, 8)
        assert result[0] == 0xAA
        assert result[1:] == bytes(MAX_BITMAP_BYTES - 1)

    def test_partial_byte_3_markets_all_up(self):
        """3 UP bets -> first byte 0xE0 (top 3 bits set)."""
        result = encode_bitmap(["UP", "UP", "UP"], 3)
        assert result[0] == 0xE0
        assert result[1:] == bytes(MAX_BITMAP_BYTES - 1)

    def test_empty_bets_zero_count(self):
        """0 markets -> still padded to MAX_BITMAP_BYTES of zeros."""
        result = encode_bitmap([], 0)
        assert result == bytes(MAX_BITMAP_BYTES)

    def test_bets_shorter_than_count_raises(self):
        """Short bets must raise ValueError — silent truncation caused $55K loss."""
        with pytest.raises(ValueError, match="Bitmap underflow"):
            encode_bitmap(["UP"], 8)

    def test_bets_longer_than_count_ok(self):
        """Extra bets beyond count are harmlessly ignored."""
        result = encode_bitmap(["UP"] * 10, 8)
        assert result[0] == 0xFF
        assert result[1:] == bytes(MAX_BITMAP_BYTES - 1)

    def test_16_markets_two_bytes(self):
        """16 markets -> first two bytes 0xFF."""
        result = encode_bitmap(["UP"] * 16, 16)
        assert result[:2] == bytes([0xFF, 0xFF])
        assert result[2:] == bytes(MAX_BITMAP_BYTES - 2)

    def test_9_markets_needs_two_bytes(self):
        """9 markets: 9th market = MSB of 2nd byte."""
        result = encode_bitmap(["DOWN"] * 8 + ["UP"], 9)
        assert result[0] == 0x00
        assert result[1] == 0x80
        assert result[2:] == bytes(MAX_BITMAP_BYTES - 2)

    def test_overflow_above_ceiling_raises(self):
        """Counts above MAX_BITMAP_BITS must raise — never silently truncate."""
        with pytest.raises(ValueError, match="exceeds"):
            encode_bitmap(["UP"] * 9000, 9000)


# ── hash_bitmap ──────────────────────────────────────────────────


class TestHashBitmap:
    def test_deterministic(self):
        """Same input always produces the same hash."""
        bitmap = encode_bitmap(["UP", "DOWN", "UP"], 3)
        h1 = hash_bitmap(bitmap)
        h2 = hash_bitmap(bitmap)
        assert h1 == h2

    def test_returns_32_bytes(self):
        """keccak256 output is always 32 bytes."""
        bitmap = encode_bitmap(["UP"] * 8, 8)
        h = hash_bitmap(bitmap)
        assert len(h) == 32

    def test_different_inputs_different_hashes(self):
        """Different bitmaps produce different hashes."""
        b1 = encode_bitmap(["UP"] * 8, 8)
        b2 = encode_bitmap(["DOWN"] * 8, 8)
        assert hash_bitmap(b1) != hash_bitmap(b2)


# ── Strategy ABC ─────────────────────────────────────────────────


class TestStrategy:
    """Strategy is no longer ABC-strict — `predict` has a default that raises
    NotImplementedError so subclasses must implement either it or
    `predict_with_context`. This was loosened to allow strategies that only
    override the context-aware hook."""

    def test_subclass_with_predict_works(self):
        """A concrete subclass that implements predict() can be instantiated."""

        class AllUp(Strategy):
            name = "all-up"

            def predict(self, markets: list[dict]) -> list[str]:
                return ["UP"] * len(markets)

        s = AllUp()
        assert s.name == "all-up"
        result = s.predict([{"id": "BTC", "price": 100.0, "change": None, "volume": None, "market_cap": None}])
        assert result == ["UP"]

    def test_subclass_missing_predict_raises_at_call_time(self):
        """A subclass that doesn't override either hook raises on call, not init."""

        class Broken(Strategy):
            name = "broken"

        s = Broken()  # construction is now allowed
        with pytest.raises(NotImplementedError):
            s.predict([])

    def test_subclass_with_only_predict_with_context(self):
        """Strategies may override only predict_with_context."""

        class AllDown(Strategy):
            name = "all-down"

            def predict_with_context(self, markets, feed=None, batch_id=None):
                return ["DOWN"] * len(markets)

        s = AllDown()
        result = s.predict_with_context([{"id": "BTC"}, {"id": "ETH"}])
        assert result == ["DOWN", "DOWN"]


# ── RiskCheck ────────────────────────────────────────────────────


class TestRiskCheck:
    def test_can_join_within_limits(self):
        rc = RiskCheck(max_batches=3, max_exposure=1000)
        assert rc.can_join(deposit=100) is True

    def test_can_join_over_max_batches(self):
        rc = RiskCheck(max_batches=2, max_exposure=10_000)
        rc.record_join(1, 100)
        rc.record_join(2, 100)
        assert rc.can_join(deposit=100) is False

    def test_can_join_over_max_exposure(self):
        rc = RiskCheck(max_batches=10, max_exposure=500)
        rc.record_join(1, 300)
        assert rc.can_join(deposit=300) is False  # 300 + 300 = 600 > 500

    def test_can_join_exactly_at_exposure_limit(self):
        rc = RiskCheck(max_batches=10, max_exposure=500)
        rc.record_join(1, 200)
        assert rc.can_join(deposit=300) is True  # 200 + 300 = 500 == limit

    def test_record_join_and_exit(self):
        rc = RiskCheck(max_batches=5, max_exposure=10_000)
        rc.record_join(10, 500)
        assert rc.active_count == 1
        assert 10 in rc.active_ids

        rc.record_exit(10)
        assert rc.active_count == 0
        assert 10 not in rc.active_ids

    def test_record_exit_unknown_batch_is_noop(self):
        rc = RiskCheck(max_batches=5, max_exposure=10_000)
        rc.record_exit(999)  # should not raise
        assert rc.active_count == 0

    def test_active_count_and_ids(self):
        rc = RiskCheck(max_batches=5, max_exposure=10_000)
        rc.record_join(1, 100)
        rc.record_join(2, 200)
        rc.record_join(3, 300)
        assert rc.active_count == 3
        assert rc.active_ids == {1, 2, 3}

    def test_exposure_frees_after_exit(self):
        """After exiting a batch, its deposit no longer counts toward exposure."""
        rc = RiskCheck(max_batches=10, max_exposure=500)
        rc.record_join(1, 400)
        assert rc.can_join(deposit=200) is False  # 400 + 200 = 600 > 500
        rc.record_exit(1)
        assert rc.can_join(deposit=200) is True  # 0 + 200 = 200 <= 500


# ── load_strategy (error path) ───────────────────────────────────


class TestLoadStrategy:
    def test_unknown_strategy_raises(self):
        """load_strategy raises ValueError for a name that doesn't exist."""
        from framework.core import load_strategy

        with pytest.raises(ValueError, match="Unknown strategy"):
            load_strategy("nonexistent-strategy-xyz")
