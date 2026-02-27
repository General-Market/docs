# Simulation Tweet Gate Design

## Problem

Simulations are fully public with no rate limiting. We want to:
1. Drive organic X (Twitter) impressions for growth
2. Naturally throttle heavy simulation usage

## Solution

Gate simulations behind X posts with an escalating tier system. Verification is honor-based (no X account connection). Quota tracked client-side in localStorage, bound to wallet via signature.

## Quota Tiers

| Tier | Unlocked by | Total sims allowed |
|------|-------------|-------------------|
| 0 | Default | 3 |
| 1 | 1st post | 8 (3 + 5) |
| 2 | 2nd post | 18 (8 + 10) |
| 3 | 3rd post | Unlimited |

No wallet connected: 3 free sims, no escalation possible.

## Storage

localStorage key: `vision-sim-quota:{walletAddress}`

```json
{
  "tier": 0,
  "used": 1,
  "signatures": [],
  "lastUnlock": null
}
```

Each tier unlock requires wallet signature of: `"Vision Simulation Unlock | Tier {N} | {ISO timestamp}"`

On load, first signature is verified against connected wallet to prevent localStorage copy-paste.

Anonymous users: separate `vision-sim-anonymous` key, 3 sims, no escalation.

## Gate UX Flow

1. User hits 0 remaining sims, clicks "Run"
2. Modal appears with tweet preview + chart image preview
3. User clicks "Download Image" — client-side canvas export of simulation chart with `indexvision.com` watermark
4. User clicks "Open X" — opens `twitter.com/intent/tweet?text=...` (text only, user attaches image manually)
5. 15s timer starts after "Open X" is clicked
6. Timer expires, "I posted" button becomes clickable
7. User clicks "I posted" — MetaMask signature request
8. Signature stored, tier incremented, modal closes, simulation auto-runs

## Tweet Templates

No URL, no @mention, no hashtags in text. The chart image carries the brand via watermark.

**Tier 1:**
```
Should I tokenize this index?

{topN} {category} assets. {totalReturn}% since Jan 2020. {sharpe} Sharpe.
```

**Tier 2:**
```
Should I tokenize this one too?

{totalSimsRun} backtests deep. Best so far: {bestStrategy} at {bestReturn}%.
```

**Tier 3:**
```
{totalSimsRun} backtests. Still looking for the one to tokenize.
```

## Chart Image Generation

Client-side only, no backend changes:
1. Render existing Recharts chart to `<canvas>` element
2. Stamp `indexvision.com` watermark in bottom-right corner (subtle but legible)
3. Export as PNG for user to download
4. User attaches image to tweet manually

## In-App Copy (Jokes)

Counter messages below Run button:
- 3 remaining: "3 sims left"
- 2 remaining: "2 sims left"
- 1 remaining: "Last free sim"
- 0 remaining: "Time to pay... with a tweet"

Tier unlock toasts:
- Tier 1: "5 more unlocked. Marketing intern."
- Tier 2: "10 more. Employee of the month."
- Tier 3: "Unlimited. Basically a co-founder."

No wallet connected: "Connect your wallet to unlock more simulations"

## Technical Approach

- **Zero backend changes** — all client-side
- Honor system with friction (15s timer + wallet signature)
- `twitter.com/intent/tweet` for pre-filled tweets
- Wallet signature binds quota to specific wallet (non-transferable)
- localStorage clearable — acceptable tradeoff (re-posting 3 times is itself a deterrent, and generates more tweets)

## Key Decisions

- Tweet tone is institutional/BlackRock-style, not meme-format
- Jokes stay in-app UI only, not in public tweets
- "Should I tokenize this?" framing invites engagement and seeds the ITP deployment concept
- Image watermark replaces explicit @mentions and URLs in tweet text
- Client-side canvas generation, no server-side OG image endpoint
