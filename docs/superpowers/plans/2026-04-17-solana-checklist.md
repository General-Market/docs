# Verification Checklist — Solana Prediction Market

Comprehensive list of every change the user requested across the design session. Used by verifier agents to check both `2026-04-17-solana-prediction-market.md` (plan) and `2026-04-17-solana-interactions.md` (graph).

Each item should be present, correct, and consistent across both documents.

---

## A. Product features (original 12-point spec + refinements)

1. **One-click trading** — user signs a single tx, no separate ATA setup, no pre-deposit.
2. **Batch open positions** — MM-focused, ALT-compatible, aims to save market-maker gas.
3. **Enter pool / exit pool during trading window** — place_bet + exit_bet.
4. **Trading window closes at `close_time`** — configurable per bet.
5. **Observation window from `close_time` to `settlement_time`** — no trades, oracle captures prices.
6. **Oracle pushes resolution on-chain** — not the frontend.
7. **Binary YES/NO with ±X% threshold** — chosen per bet.
8. **First trade creates the market** — lazy init_if_needed on Market PDA.
9. **Parimutuel payout** — pro-rata from total pool.
10. **Fee only on winners** — losers never claim, so no fee flow from them.
11. **Oracle mocked in tests** — MockOracleSet test helper.
12. **Multisig price verification with 24h admin-change delay** — OracleConfig, propose+activate.

## B. Architecture

13. **Admin whitelists `Source` only** — no threshold or durations on Source.
14. **User sets all bet params** — `(source_id, close_time, settlement_time, threshold_bps, side, amount)`.
15. **PDA normalization** — identical param tuples collide to the same Market PDA.
16. **Contract enforces param bounds** — threshold ≠ 0 and |bps| ≤ 10_000, close_time > now, settlement > close + 10s, settlement ≤ now + 30 days.
17. **Frontend supplies a curated menu** — out of scope for this plan, noted as such.
18. **Mini single-node oracle daemon** — Rust, reads data-node feed, signs + submits.
19. **Daemon is fully stateless** — no SQLite, no tick cache, no discovery list. Chain is the source of truth.
20. **Frontend is a separate project** — explicitly out of scope.

## C. Oracle flow (split into close + resolve)

21. **`close_market(baseline, sigs)`** — oracle-signed ix at close_time, writes `Market.baseline_price`, emits `MarketClosed`.
22. **`resolve_market(final, sigs)`** — oracle-signed ix at settlement_time, reads stored baseline, writes final + outcome, emits `MarketResolved`.
23. **Domain tags** — `TAG_CLOSE(1)` / `TAG_RESOLVE(2)` in signed payloads prevent cross-ix replay.
24. **OracleConfig two-state** — active + pending, with `pending_activation_ts`.
25. **Active signers keep operating during pending change** — no 24h freeze.
26. **Instant cancel via empty vector** — `propose_oracle_signers([], 0)` clears pending.
27. **Day-one threshold = 1, single signer** — multisig machinery preserved for N-of-M later.
28. **Ed25519 precompile ix** — built manually in daemon via `build_ed25519_ix`, no SDK helper.
29. **Ed25519Offsets Pod struct** — `#[repr(C, packed)]` + `bytemuck::Pod` + compile-time size assertion.
30. **Pinned `solana-program = "=1.18.26"`** — CI test hashes layout bytes.

## D. Claim (permissionless)

31. **Claim is permissionless** — `cranker: Signer`, not user.
32. **Payout to `position.owner`** — regardless of who signs.
33. **Fee to fee_vault PDA** — admin-withdrawable.
34. **Position closed to `position.owner`** — rent returned to trader.
35. **Users never click claim** — keeper bot sweeps resolved markets.
36. **Fee skipped when pool is fully one-sided** — `total_yes == 0 || total_no == 0` → fee = 0.
37. **Stranded-pool refund inside claim** — `winning_total == 0` refunds full `yes_amount + no_amount`.
38. **Loser-close inside claim** — `stake == 0 && resolved` just closes Position.
39. **Single unified `claim` handler** — winner, stranded, loser all go through one ix.

## E. Admin

40. **`upsert_source`** — single admin ix, `init_if_needed`, source_id + name + enabled.
41. **`set_pause`, `set_fee_bps`** — admin controls.
42. **`withdraw_fees`** — admin drains fee_vault to destination.
43. **Two-step admin transfer** — `propose_admin` + `accept_admin`, no delay.
44. **`admin_force_resolve`** — unlocks at `settlement_time + (settlement_time - close_time)`, one full observation window past settlement.
45. **No ops CLI** — admin monitors manually.
46. **`force_resolved` recorded in event**, not on Market struct.

## F. State

47. **Market PDA seeds** — `[b"market", source_id_le, close_time_le_i64, settlement_time_le_i64, threshold_bps_le_i32]`.
48. **Source PDA seeds** — `[b"source", source_id_le]`.
49. **Position PDA seeds** — `[b"position", market, owner]`.
50. **Fee vault PDA** — self-owned, seeds `[b"fee_vault"]`, bump stored on GlobalConfig.
51. **GlobalConfig holds** — admin, pending_admin, fee_bps, stake_mint, fee_vault, fee_vault_bump, paused, bump.
52. **Market does NOT carry** — cached `source_id` / `threshold_bps` (in seeds only), `force_resolved` (event-only).
53. **Source does NOT carry** — threshold, durations. Just id + name + enabled.

## G. Threshold semantics

54. **Signed `threshold_bps: i32`** — sign picks direction.
55. **Positive threshold** — YES if final ≥ baseline × (1 + bps/10_000).
56. **Negative threshold** — YES if final ≤ baseline × (1 + bps/10_000).
57. **`threshold_bps == 0` rejected** — `BadThreshold`.
58. **`|threshold_bps| > 10_000` rejected** — `BadThreshold`.

## H. Events

59. **`BetPlaced`** — every place_bet + every batch entry.
60. **`BetExited`** — every exit_bet.
61. **`MarketInstantiated`** — first bet on a new Market (distinct from BetPlaced).
62. **`MarketClosed`** — on close_market.
63. **`MarketResolved`** — on resolve_market + admin_force_resolve, with `force_resolved: bool` field.
64. **`Claimed`** — on claim (winner path).
65. **`OracleSignersActivated`** — on activate_oracle_signers.
66. **Admin events are open question** — MR10 flags them.

## I. Daemon lifecycle

67. **Stateless** — no local files beyond the oracle keypair.
68. **Three chain queries on wake** — markets needing close, markets needing resolve, markets needing claim crank.
69. **Solana pubkey = ed25519 pubkey invariant** — asserted at boot.
70. **SOL balance gauge** — Prometheus + Rust boot-time refusal below 0.1 SOL.
71. **`build_payload` duplicated between program and daemon** — kept in sync by golden-vector test.
72. **Daemon doubles as claim cranker** — or separate bot; either way users never sign claim.

## J. Frontend assumptions (not implemented here)

73. **Frontend menu ships in its build** — hardcoded catalog of (source, threshold, lock_offset, settle_offset).
74. **Frontend handles ATA creation / SOL funding hints** — balance check pre-flight.
75. **Frontend tracks positions via `getProgramAccounts` + events** — no on-chain directory.
76. **No backend required at MVP** — optional later for dynamic menu updates.

## K. Cuts (must NOT appear in the plan)

77. `MarketType` — removed entirely, replaced by Source.
78. `reclaim_stranded` ix — folded into claim.
79. `close_losing_position` ix — folded into claim.
80. `cancel_pending_oracle_signers` ix — merged into propose via empty vector.
81. `set_market_type_enabled` ix — collapsed into upsert_source.
82. `FORCE_RESOLVE_DELAY = 12h` constant — replaced by `settlement_time - close_time`.
83. `SigEntry { signer, sig }` struct — dropped, now `Vec<[u8; 64]>`.
84. `BatchEntry.market_index` field — dropped, position IS index.
85. `payload-spec` crate — inlined into `oracle.rs`.
86. `Market.force_resolved` field — event-only.
87. `Market.source_id` / `Market.threshold_bps` cached fields — in seeds only.
88. `crates/baselines.rs` / SQLite tick cache — daemon stateless.
89. Daemon rediscovery loop — optional boot-time startup assert instead.
90. `oracle-daemon/src/signer.rs` — folded into submitter.rs.
91. `AdminOnly` accounts wrapper — dropped, `require_admin` helper instead.
92. H1 (auto-ATA task) — shipped in Task 6.
93. H3/H4/H5 (events as separate tasks) — events in Phase 1 handlers.
94. H10 (ops CLI) — deleted.
95. H11 (tick cache) — deleted.
96. H13 (seed-markets.ts) — deleted, batch_bets inlines init_if_needed.

## L. Kept against pressure (rejected simplifications — must appear in SR list)

97. **Manual PDA derivation in batch_bets** — no macro-generated Accounts.
98. **OracleConfig two-state** — rejected single-epoch collapse.
99. **80-byte signed payload** — rejected keccak256 (preserves auditability).
100. **MarketInstantiated as distinct event** — rejected folding into BetPlaced.
101. **Ed25519Offsets Pod + CI hash** — rejected raw byte indexing.
102. **Instant empty-vector cancel** — rejected timelock on cancel.

## M. Interactions doc (`2026-04-17-solana-interactions.md`)

103. **Section 1: Actors table** — lists all parties, correct kinds.
104. **Section 2: System topology** — shows all arrows, no frontend-to-daemon.
105. **Section 3: Instruction surface table** — includes close_market, permissionless claim, upsert_source.
106. **Section 4: Admin bootstrap sequence** — upsert_source (not upsert_market_type).
107. **Section 5: Trader lifecycle sequence** — baseline captured at close_time (not at bet).
108. **Section 6: MM batch sequence** — mermaid syntax valid (no `alt` keyword confusion).
109. **Section 7: Oracle resolution sequence** — shows split close + resolve, no `<>[]` in message labels.
110. **Section 8: 12h/escape sequence** — reflects proportional delay, no ops CLI.
111. **Section 9: Market state machine** — transitions include MarketClosed state.
112. **Section 10: OracleConfig state machine** — matches two-state design.
113. **Section 11: Data flows** — should reflect stateless daemon (SQLite removed).
114. **Section 12: Per-actor surface** — trader/MM never signs claim; keeper does.
115. **Section 13: Failure matrix** — should remove baseline-loss entry (chain-stored now).
116. **Section 14: Out of scope list** — frontend, governance tokens, etc.
117. **Section 15: Sanity invariants** — six invariants reflect current design (wallet sigs never forged, close_market in writer list, Source not MarketType, stateless daemon, proportional force-resolve).

---

## How to verify

For each numbered item, determine:
- **Present and correct** in the plan? (pass)
- **Present and correct** in the interactions doc? (pass, where applicable — items 1-102 mostly live in the plan; items 103-117 in the interactions doc)
- **Contradicted somewhere** between the two docs?
- **Missing** from where it should be?

Report per-item status: `PASS`, `MISSING: <where>`, `INCONSISTENT: <what differs>`, or `WRONG: <details>`.
