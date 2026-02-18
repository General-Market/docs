# Curator + Morpho: Intent Lending — Superseded

> **This document has been superseded by the v2 architecture.**
> See: `_bmad-output/planning-artifacts/itp-morpho-lending-architectures.md`
>
> Key changes in v2:
> - **CuratorRateIRM** replaces AdaptiveCurveIRM — curator sets rates globally, not per-pool organic utilization
> - **SERM** (Shared Exposure Rate Model) — correlated risk pricing across ITPs sharing underlying assets
> - **Intent-based flow** — user gets quote, user pushes BLS price, user executes all on-chain txs. Curator does zero on-chain during borrow.
> - **Self-funding liquidation bot** — curator uses USDC → liquidate → sell ITP on Index.sol → recover USDC → loop
