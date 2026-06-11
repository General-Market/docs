---
title: Read the leaderboard
navTitle: Leaderboard
description: Every column defined, player profiles, and where each number comes from.
order: 10
group: Leaderboard & risks
mode: how-to
---

```gmplain
The leaderboard ranks every player by realized profit across all settled rounds. Click any row to open that player's profile — a profit chart and their full round history. The numbers are not self-reported: they come from the same settlement results that pay the wallets.
```

```gmsummary
How do I open the leaderboard? :: Left rail → Leaderboard; ranked by realized P&L
What do the columns mean? :: P&L, ROI, Volume, Rounds, Win% — all from settled rounds
How do I see one source's board? :: Each source page carries its own filtered leaderboard
How do I open a player profile? :: Click a row — P&L chart, tabs, round history
Where do the numbers come from? :: Oracle settlement results, summed per player, zero-sum
```

## How do I open the leaderboard?

Click **Leaderboard** (the trophy icon) in the left rail, or go to `/leaderboard`.

1. The board loads ranked by **realized P&L** — profit and loss across every settled round, biggest winners first. The top three ranks wear medals.
2. The first 50 rows show; **Show more** extends the list.
3. Players with under **$100 total volume** are hidden by default as noise. A button at the bottom — "Show N hidden traders under $100 volume" — reveals them. If you are connected, your own row always survives the filter and is tagged **You**.
4. The board refreshes itself every 30 seconds.

```gm-shot
Full leaderboard page: ranked rows with medals on the top three, the connected wallet's row highlighted and tagged You.
```

If the board is empty, no round has settled yet for that scope. If it fails to load, a **Retry** button refetches — the data service may be momentarily unreachable.

## What do the columns mean?

Every figure counts **settled rounds only**. An open round you are currently in contributes nothing until it settles.

| Column | Meaning | How it is computed |
|---|---|---|
| **P&L** | Realized profit or loss, in USDC | total payouts received − total deposits made |
| **ROI** | Return on everything you have put in | P&L ÷ total deposited × 100 |
| **Volume** | Total deposited across all rounds | sum of your deposits |
| **Rounds** | Settled rounds you joined | count of your settled rounds |
| **Win%** | Share of rounds you ended in profit | rounds with positive P&L ÷ rounds played |

Three honest details:

- **The board is zero-sum.** Vision moves money between players, and the board's P&L is computed from settlement payouts *before* the 0.05% fee on profit — so summed over every player it comes to exactly zero. Your wallet receives the payout minus the fee, so a winner's board P&L runs a hair above what actually arrived — see [Fees and minimums](/docs/vision/fees) (~2 min).
- Win% counts whole rounds, not individual markets. The API also reports a per-market accuracy figure (`avgCorrectPct` — correct predictions ÷ markets predicted), which the table does not display.
- **Testnet only.** The P&L is real arithmetic over test money. **L3 USDC has 18 decimals** — the board shows human units, rounded to whole cents from the exact on-chain figures.

## How do I see one source's board?

Each source page has its own **Leaderboard** tab — the same table filtered to rounds on that source, at `/source/{source}/leaderboard`. A "Filtered" chip names the scope; **View all →** clears it back to the global board.

## How do I open a player profile?

Click any leaderboard row. It opens `/profile/{address}` — yours or anyone's, since all results are public.

1. The hero shows the wallet's **P&L curve** over time, switchable between 1D / 1W / 1M / ALL.
2. Tabs split the account: **Vision** (prediction rounds), **Index** (DTF positions), **Vaults** (vault deposits — shown only on your own profile, because vault positions are private to their owner).
3. The Vision tab lists the wallet's rounds and their results — what was deposited, what came back, round by round.

```gm-shot
Player profile page: P&L curve in the hero, Vision tab open with a list of settled rounds.
```

Your own profile is the same URL with your address — open the leaderboard and click your **You** row to reach it.

## Where do the numbers come from?

From settlement, and nowhere else. When the oracle network settles a block (a *batch*, in contract terms), it grades every player's revealed predictions against the resolved markets and computes each payout — the contract then transfers that payout, minus the 0.05% fee on profit, to the wallet (the mechanism is in [How payouts work](/docs/vision/payouts) (~4 min)). Each settlement writes one result row per player: deposit, payout, and how many markets they called correctly. The leaderboard is a sum over those rows; the profile is one player's slice of them.

Because the displayed numbers and the paid money come from the same settlement output, there is no separate scoring system to drift out of sync.

For programmatic access: `GET /vision/leaderboard` (filters: `source_id` or `batch_id`; paginated, `limit` ≤ 200) and `GET /vision/player/{address}/profile`. Full request and response shapes: [Leaderboard and stats](/docs/developers/vision-api/stats) (~3 min) and [Players and balances](/docs/developers/vision-api/players) (~3 min).

```gmseealso
[{"title": "How payouts work", "href": "/docs/vision/payouts"}, {"title": "Leaderboard and stats", "href": "/docs/developers/vision-api/stats"}, {"title": "Players and balances", "href": "/docs/developers/vision-api/players"}]
```

Next: [Risks and recovery](/docs/vision/risks) (~3 min)
