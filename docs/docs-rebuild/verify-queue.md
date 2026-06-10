# Verify queue — compiled from all 12 writer reports + porters

The second-round verifiers work this list FIRST, then their general sweep. Items marked FIX = correct the page; REPORT = confirm and note, don't edit code.

## Cross-page consistency (global checker)

1. **Faucet amounts story** — UI buttons send `amount: '1000'` (HeaderBalanceBar, BatchEntryPanel; BuyItpModal mints 10,000 test USDC for ITP leg); API default is 100 when amount omitted; cap 10,000 (clamped, not rejected). Pages that mention amounts: get-started/connect-and-fund, vision/first-predictions, index/buy-and-sell, developers/vision-api/faucet, bots/quickstart. They must tell ONE coherent story (button mints 1,000; default 100 only when the field is omitted).
2. **`/vision/balance` is DEAD** (handler exists, never routed — verified by W10). facts-vision.md's API table is wrong on that row. Grep all content for `/vision/balance` — only developers/vision-api/players may mention it, as the documented-dead endpoint.
3. **Live Vision address `0x36a28967…`** appears on get-started/network AND bots/quickstart (facts-gaps arbitration) — must be byte-identical; nowhere else.
4. **Batch struct field order** — W6's Python snippet (b[3]=tickDuration, b[4]=lockOffset, b[7]=paused, b[8]=settled) vs W9's contracts.md struct table vs IVision.sol. Three must agree.
5. **Strategies "as shipped" claims** (bots/strategies: momentum/contrarian receive `change: None` → all-UP/all-DOWN) — W5 fixed bot.py concurrently; confirm bot.py:~446 strategy call is untouched and the claim still holds.
6. **Timing claims**: "the previous block settles the moment this one closes" (W3, first-predictions) and "roughly one full tick to join, minus the lock window" (W2) — re-check against oracle/src/vision/lifecycle.rs heartbeat timing.
7. **Terminology**: product = Vision; "block" (player pages) = batch (contract pages) — defined once per page on first use; no page says "Blocks" as a product; zero hits for "BLS-signed withdrawal proofs", `0x821D7c`, 5-param joinBatchDirect, "TradFi".
8. **Mode purity + method.md compliance** per page: gmplain present; gmsummary heading text == ## text; question headings; no TL;DR; Next: line with time estimate; **Testnet only** + **18 decimals** lines where money appears.
9. **Settlement chain id** — pages say 14601 (env-decided; wagmi hardcoded fallback is 421611337). settlement-and-bridge + network must agree and not overclaim.

## Per-page hard checks

- vision/payouts — recompute the worked example against oracle/src/vision/side_matching.rs + settlement.rs (FIX if off by a wei).
- vision/risks — "updates still allowed while paused" (updateBitmap lacks pause check) — confirm no other gate (FIX text if wrong).
- vision/vaults + developers/vision-api/vaults — redeem-queue wait phrasing ("depends on deployed cash"), 5% MAX_BATCH_BPS, fee cap 5000 bps. REPORT: VaultActions.tsx:334 divides performanceFeeRate by 1e16 (bps-vs-1e18 scale suspicion — possible UI display bug).
- developers/contracts — recompute a random sample of ~10 error selectors with `cast sig`; confirm BotRegistry "source-only, no deployment.json entry" still true; E052 duplicate is intentional and flagged in-page.
- developers/vision-api/history — "bitmaps revealed only resolution→settlement, then purged" claim; tie-rates page-level honesty line ("static snapshot") stays unless an oracle handler exists.
- developers/index-api — lending/quote has NO in-repo route (UI calls it; curator serves it; production proxy unverified) — caveat must stay. nav-series rejects `1m` though its error text offers it (REPORT upstream bug).
- get-started/faq — Discord invite `discord.gg/xsfgzwR6` (3× in code) vs linktree's `QbasycShP` — pick one, REPORT which.
- get-started/connect-and-fund — "Switch to Index Settlement" button label is the literal i18n string but switches to L3 — keep the literal label, confirm wording warns the reader.
- get-started/network — L3 explorer is env-driven bare-IP `http://159.195.79.153` — confirm phrasing doesn't promise a domain.
- index/lending — ~7% liquidation discount is DERIVED from vendored Morpho constants (cursor 0.3, cap 1.15, LLTV 77%) — recheck the arithmetic; soften if shaky.
- index/order-lifecycle — "BATCHED orders cannot be cancelled" (cancelOrder is PENDING-only) — confirm no other user-facing cancel path.
- index/buy-and-sell + vision/first-predictions — click-path labels were derived from component code while the origin was 502; if the live origin is reachable, spot-check labels (Login, Get USDC, ring phases Submit→Batch→Fill, Approving…→Committing…→Publishing…).
- bots/quickstart — repo-root config.toml still pins the retired address + dead batch_ids [93306]; the page tells readers to fix config.toml — VERIFY the page's instruction matches the file as committed (the cleanup phase may fix config.toml itself; if it does, simplify the page).
- bots/update-predictions — title deviates from spec ("before the lock", not "each tick") for factual reasons — accept; confirm sidebar navTitle reads cleanly.

## Code items (cleanup phase, not content)

- FIX repo-root config.toml: live address, drop pinned batch_ids.
- FIX root AGENTS.md Vision section constants: live address, 4-param joinBatchDirect, real faucet behavior (waitlist + /api/bot/faucet), bot errors (DepositBelowMinimum, not InsufficientDeposit/StakeBelowMinimum).
- FIX facts-vision.md: /vision/balance row (dead), bot-faucet per-address lock note.
- REPORT only: vision-bot/, example-vision-bot/, examples/vision-bot-python/ still stale; FirstTradeGuide.tsx describes retired scoring; VaultActions fee-scale suspicion; nav-series 1m error text; wagmi fallback chain id 421611337.
