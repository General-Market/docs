---
title: FAQ
navTitle: FAQ
description: Quick answers that fit nowhere else, with links onward.
order: 5
group: Get Started
mode: reference
---

```gmplain
The short answers: the money is not real; deposits cost nothing; there is a points program but no token; you can play by hand and run a bot at the same time if you set it up right; the API needs no key; and help is an email or a Discord message away.
```

```gmsummary
Is this real money? :: No. Testnet only — faucet money, nothing redeemable
Do deposits cost anything? :: No fee on deposits anywhere; Vision charges 0.05% on profit
Is there an airdrop? :: A points program exists; no token, no published terms
Can I play manually and run a bot at the same time? :: Yes — separate wallets, or one wallet updating one position
Do I need an API key? :: No
Why does the faucet refuse my wallet? :: The waitlist gate — redeem a code first
Where do I get help? :: Email, Discord, GitHub, or X
```

## Is this real money?

No. **Testnet only.** USDC here is minted by a faucet, GM gas is dripped for free, and neither can be withdrawn to a real network or redeemed for anything. Win or lose, no real value moves.

## Do deposits cost anything?

No. There is no fee on deposits anywhere in the system. Vision charges 0.05% on **profit** only — nothing on losses or refunds; the exact numbers live at [Fees and minimums](/docs/vision/fees) (~2 min). DTF orders charge no fee in the on-chain fill path. Gas is paid in GM, which the faucet gives you.

## Is there an airdrop?

There is a points program, and the app's own copy says points "convert to an allocation at the early stage" — nothing more is promised. Playing Vision rounds and creating or holding well-performing DTFs earns daily points; see [generalmarket.io/points](https://generalmarket.io/points). **No token exists today, and no terms beyond that one line are published.** Do not build plans on it.

## Can I play manually and run a bot at the same time?

Yes, two ways. A wallet holds exactly one position per block — a second join from the same address is rejected (`AlreadyJoined`) — so either:

- **Use separate wallets.** Play by hand with one key, run the bot on another. Clean and simple.
- **Share one wallet.** Whoever joined the block holds the position, but both you and the bot can replace its predictions any time before the lock window — the last update before lock counts.

How updates work: [How predictions are sealed](/docs/vision/predictions-and-bitmaps) (~4 min). What a bot does all day: [Why run a bot?](/docs/bots/overview) (~3 min).

## Do I need an API key?

No. The API is open, with no authentication. Start at the [API overview](/docs/developers/overview) (~3 min).

## Why does the faucet refuse my wallet?

The waitlist gate. New wallets must redeem a waitlist code once before the faucet serves them — the fix takes about a minute: [What is the waitlist gate?](/docs/get-started/connect-and-fund) (~4 min).

## Where do I get help?

- **Email:** [hello@generalmarket.io](mailto:hello@generalmarket.io)
- **Discord:** [discord.gg/xsfgzwR6](https://discord.gg/xsfgzwR6)
- **GitHub:** [github.com/General-Market](https://github.com/General-Market)
- **X:** [@tryGeneral_](https://x.com/tryGeneral_)

Found something broken in these docs? Say so in any of the channels above — addresses and endpoints are re-verified against the running system, and reports get folded in.

```gmseealso
[{"title": "How do I connect and get funds?", "href": "/docs/get-started/connect-and-fund"}, {"title": "What can go wrong (Vision)", "href": "/docs/vision/risks"}]
```

Next: [How Vision works](/docs/vision/how-vision-works) (~5 min)
