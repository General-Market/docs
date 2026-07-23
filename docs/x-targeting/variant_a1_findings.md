# Variant A1 — Network Triangulation Findings

## Method recap
Intersection mining across the 7 PASS seeds. Three of the four corporate/protocol seeds
(@ThalexGlobal, @RoboNetHQ, @NeutraFinance, @rf_extended) return zero followings via
TwAPI either because they follow nobody or the endpoint refuses thin/protected lists.
ThalexGlobal's page-0 (200 entries) did persist into `profiles.jsonl` via `followed_by`
edges before the response shape diverged from the wrapper's expectation, so we recover
4 useful seeds in total: **0xLoris, chameleon_jeff, quantymacro, ThalexGlobal**.

## Frequency distribution
- ≥3 overlap: 20 candidates
- =2 overlap: 90 candidates
- =1 overlap: 718 candidates

The ≥3 bucket is the "cohort consensus core". The =2 bucket holds the operator names
two of the seeds agreed on — most of them are smaller, niche operators, which is
exactly the signal the intersection method is supposed to surface.

## Anti-Polymarket/KOL/protocol filter
Excluded from PASS unconditionally: @HyperliquidX, @ThinkingUSD, @HsakaTrades, @cobie,
@Rewkang, @blknoiz06, @tier10k, @ScottPh77711570, @loraclexyz, @0xSisyphus, @CL207,
@TheFlowHorse (KOL-leaning), @Kinetiq_xyz, @ventuals, @nadoHQ, @PhoenixTrade, @Hypurr,
@HyperFND, @Markets_xyz, @gdog97_ (Ethena founder), @jchervinsky (lawyer),
@danrobinson (Paradigm researcher), @hypurr_co, @hal2001 (Across cofounder),
@nativemarkets, @Mclader, @smartestmoney, @goodalexander, @0xdoug (Ambient founder),
@felixprotocol, @choffstein (TradFi ETF), @rediamondjr (TradFi bank CEO),
@HyperliquidPC (research org), @Bonecondor (shitposter), @maruushae (game/meme).
