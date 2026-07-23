# Persona tryGeneral_ — analyse Reddit consolidée

> Marque : tryGeneral_
> Offre : *"protects traders pnl from insider trading, spoofing, toxic-flow market making, front-running, and order-flow purchases."*
> Méthode : quatre agents, quatre cohortes, sept à huit mille commentaires Reddit échantillonnés. Citations brutes conservées en anglais — c'est la voix du persona, on ne traduit pas la voix.

---

## 1. CARTOGRAPHIE DES SUBREDDITS

Le persona ne vit pas dans une communauté. Il vit dans un archipel. Chaque île dit la même chose avec un dialecte différent. La carte ci-dessous est ordonnée par proximité décroissante avec le pitch tryGeneral_ — du plus chaud au plus dilué.

### Cohorte A — Prediction markets et exchanges peer-to-peer (la plus proche du produit)

| Sub | Taille | Niveau | Rôle dans le funnel | Pourquoi c'est le cœur de cible |
|---|---|---|---|---|
| **r/Polymarket** | ~80k, croissance vive | Élevé — parlent CLOB, microstructure, oracle, governance attack | **Solution-aware**, déjà excédé par le whaling et l'UMA scandal | Crypto-natifs, anglais-langue-seconde nombreux, OSINT-curieux. Vocabulaire identique à tryGeneral_. |
| **r/PredictionMarkets** | Plus petit, plus sobre | Très élevé — cousin Hanson / Tetlock-pilled | **Évangéliste technique** | Ils débattent déjà de *l'insider trading comme bug ou feature*. Ils liraient le whitepaper. |
| **r/Kalshi** | Moyen, croissance post-licence US | Mixte (réfugiés DraftKings + réfugiés Polymarket) | **Comparison** — déjà sortis de Polymarket, déjà déçus par Kalshi | "Vig stacked on vig", market makers qui dégainent dès que Pinnacle bouge. |
| **r/sportsbook** | ~700k | Bimodal (parlays casuals + matched bettors) | **Vent + comparison** — déjà limités partout | La plainte universelle : *"got limited"*. Status wound, pas seulement loss. |
| **r/sportsbookadvice, r/sportsbetting, r/Mathbet** | Plus petits | r/Mathbet : très élevé (+EV pros) | **Solution-aware** | r/Mathbet sont les early adopters naturels — ils paient déjà OddsJam $50/mois. |
| **r/Betfair, r/BettingExchange** | Petits | Élevé | Ils ont déjà *résolu* le problème (exchange P2P). | Si on les convertit, ils sont fidèles à vie. |
| **r/PredictIt, r/Politicalbetting (UK)** | Plus calmes | Élevé | **Veteran wisdom** | Vétérans "smart money corrects the crowd" — la première génération du pitch. |

### Cohorte B — Crypto traders MEV / wick-hunt

| Sub | Taille | Niveau | Rôle |
|---|---|---|---|
| **r/CryptoCurrency** | 10M | Médian, longue traîne de degens | **Discovery + vent** — première station |
| **r/CryptoMarkets** | ~2M | Plus haut, moins de meme tax | **Problem-aware** |
| **r/ethereum** | ~1.5M | Protocol-aware (JIT, sandwich, validator) | **Solution-aware on-chain** |
| **r/ethtrader** | Moyen | Trading P&L, sandwich témoignages | **Vent — quantifié** |
| **r/UniSwap** | Petit | "Why did my swap fail" → Flashbots RPC | **Problem-aware** |
| **r/Solana** | ~370k | Casino memecoin, pump.fun | **Existential** — courent vers la table |
| **r/SatoshiStreetBets, r/CryptoMoonShots, r/altcoin** | Variables | Bas | **Shill + grief** — "rug-proof" devient *marketing copy* |
| **r/CoinBase, r/binance, r/Bybit, r/ftxofficial** | Officiels, modérés | Mixte | **Vent** — les threads chauds migrent vers r/CryptoCurrency |

### Cohorte C — Forex retail / day-trading

| Sub | Taille | Niveau | Rôle |
|---|---|---|---|
| **r/Forex** | Grande | Junior, traumatisé | **Vent terminal** — broker = adversaire |
| **r/Daytrading** | ~2.7M | Plus technique | **Stop-hunt cathedral** — neurose centrale de la sub |
| **r/algotrading** | Niche | Quants | Crossover CEX manipulation |

### Cohorte D — Retail equity (PFOF rage)

| Sub | Taille | Niveau | Rôle |
|---|---|---|---|
| **r/wallstreetbets** | ~17M | Bimodal | **Discovery + vent** — mythologie Citadel-Kenny |
| **r/options** | ~2M | Plus haut | **Problem-aware** (ils voient le spread) |
| **r/stocks** | ~9M | Moyen | **Vent + comparison** — migration vers Fidelity |
| **r/thetagang** | ~250k | Solide | **Problem-aware**, principled, silent |
| **r/RobinHood, r/Webull** | Moyens | Bas | **Vent** pré-articulation |
| **r/Fidelity, r/SchwabClient, r/InteractiveBrokers** | Moyens | Mid-high | **Comparison** — les convertis |
| **r/Vitards** | ~85k | Mid-high | **Vent + comparison** — petit pool, haute LTV |
| **r/pennystocks** | ~2M | Bas | "MM ladder attack", "spoofing the L2" |
| **r/SecurityAnalysis, r/Bogleheads** | — | Élevés | **Hors cible**. Long-only, n'ont pas le wound. |

### Cohorte E — Meme stock / conspiracy retail (vocabulaire le plus riche, audience la plus radioactive)

| Sub | Taille | Niveau | Rôle |
|---|---|---|---|
| **r/Superstonk** | ~1.2M | Folk-expertise élevée (DTC, FTD, Reg SHO) | **La cathédrale** — où la doctrine s'écrit |
| **r/GME** | ~300k | Plus sec | **Origin myth** |
| **r/DDintoGME** | Plus petit | Pseudo-académique | **Le séminaire** — Atobitt, "House of Cards" |
| **r/amcstock, r/AMCSTOCKS** | Moyens | Bas | **Tent revival** — plus populiste |
| **r/BBBY → r/BBBY_Bagholders** | Petits | Magical thinking | **Apocalypse cult** — "Teddy", Pulte, post-rapture |
| **r/MMTLP** | Petit | Grief pur | **Radicalizer** — #FINRAFRAUD |
| **r/Shortsqueeze** | Moyen | Rotationnel | **Recruitment funnel** |
| **r/Wallstreetsilver** | Plus ancien | Libertarian, gold-bug | **Wing métaux précieux** — JPMorgan = Citadel |

---

## 2. ANALYSE PROFONDE DES PAIN POINTS

Quinze blessures. Ordonnées par poids émotionnel, non par fréquence. Chacune est documentée par citation, contexte, fréquence, intensité, déclencheur, conséquence, variantes.

---

### Pain 1 — "Got limited" (les sportsbooks coupent les gagnants)

**Description.** Le bettor américain qui commence à gagner se fait *limiter* — réduit à un max de $5, $16.67, $1.37. Il est encore client. Il est juste empêché de jouer.

**Fréquence.** Quotidienne sur r/sportsbook. Phrase la plus répétée du corpus.

**Intensité.** 10/10. Blessure de statut, pas de portefeuille. Il s'est fait inviter au country-club, on l'a expulsé.

**Déclencheur.** Quelques paris gagnants d'affilée, parfois 5, parfois 50. Atteindre un tier VIP. Toucher Onyx.

**Conséquence.** Migration vers offshore, runners, multi-comptes, Polymarket pour *"no limits"*.

**Citations.**

> *"I literally got limited on MGM after winning only $130 on 5 successful bets last Sunday. I am in complete shock."* — u/AmazonGlacialChasm, [r/sportsbook/1nps5u2](https://www.reddit.com/r/sportsbook/comments/1nps5u2/limits/)

> *"i literally got invited to be apart of DraftKings VIP program last week, immediately a day after my account gets restricted to like $100 dollars per bet, then right after that it got limited to like $15."* — u/Upbeat-Shape-7450, [r/sportsbook/1i9is8a](https://www.reddit.com/r/sportsbook/comments/1i9is8a/got_invited_to_be_apart_of_draftkings_vip_a_day/)

> *"Fuck all the vip programs. DK, FD, fanatics I've had 'VIP' status with over the years and they all eventually limit you... Scumbag piece of fucking shit sportsbooks fucking bums."* — u/MomCallsMeLowlife

> *"I got up 40k and my host politely told me to fuck off lol."* — u/Live-Horror

> *"I think it's complete and utter bullshit. These scummy books have zero problems taking thousands from people who consistently lose, or who might have a gambling addiction, but will limit and promo ban consistent winners to oblivion under the facade of 'business.' It should be flagrantly illegal."* — u/RandomGuy622170

**Variantes.** *"got limited", "shadow ban", "max bet $1.37", "promo banned", "they kicked me out after the bonus", "VIP is a scam"*.

---

### Pain 2 — Sandwich attack / front-run sur DEX

**Description.** Un swap public passe par le mempool. Un bot le voit, achète devant, revend derrière, prend la différence. Le trader paie le slippage qu'il a lui-même autorisé.

**Fréquence.** Très haute. *"Every time I make a large trade on a DEX, I feel like I'm rolling the dice."*

**Intensité.** 9/10. Escalade avec la taille.

**Déclencheur.** Swap public non protégé.

**Conséquence.** Pertes publiques documentées : $215,500 (USDC→USDT), $733,000 (un seul trader, six swaps), $9,101 (Vitalik / Ethereum Foundation).

**Citations.**

> *"Ok, so Grandma, basically I was trying to swap some internet money and a bot caught me slipping and performed a sandwich attack on my ass. Anyways, I lost $2K and the bot made $500."* — u/knowone23, [r/CryptoCurrency/u7a7s7](https://reddit.com/r/CryptoCurrency/comments/u7a7s7/)

> *"the thing that pissed me off the most wasn't even the big trades. it was the small ones. $200-500 swaps getting sandwiched for a few bucks each time. doesn't feel like much in the moment but it adds up fast."* — u/ginete_tech, [r/ethereum/1shi3pv](https://reddit.com/r/ethereum/comments/1shi3pv/)

> *"Sandwich Trading and Front Running Bots are legal theft. They drain liquidity from the pools, dampen the trading on good projects and rob investors."* — u/VegasBizBroker

**Variantes.** *"got MEV'd", "got Jared'd", "front-ran me", "sandwich", "private mempool failure", "JIT sniped"*.

---

### Pain 3 — Insider Polymarket / Kalshi (wallets neufs sur événements géopolitiques)

**Description.** Sur Polymarket, des wallets créés trois semaines avant l'événement parient millions sur le résultat exact. Le persona le voit on-chain et ne peut rien y faire.

**Fréquence.** Récurrente, accélère sur chaque crise (Iran, Maduro, Venezuela, élections).

**Intensité.** 9/10 — transparence + impuissance = rage particulière.

**Citations.**

> *"AP reported that at least 50 brand-new Polymarket wallets placed substantial 'Yes' bets in the hours and minutes before Trump's ceasefire post... A Harvard paper estimated roughly $143M in profits trace back to wallets with apparent insider information."* — u/MundaneUniversity436, [r/Polymarket/1stpj7i](https://www.reddit.com/r/Polymarket/comments/1stpj7i/)

> *"this guy created his polymarket account on april 2026... and he literally buy these 3 market with millions of dollar... how an account being created in april 2026 and risk $17M in geopolitics... like they know something already."* — u/Due-Radish1719, [r/Polymarket/1t06ent](https://www.reddit.com/r/Polymarket/comments/1t06ent/)

> *"bro has access to information that hasn't happened yet and we're sitting here reading charts like idiots."* — u/EthanTruthSeeker

> *"The soldier bet $33,034 from Dec. 27, 2025 through Jan. 26, 2026 and made around $409,000 on Maduro and Venezuela related contracts."* — u/haney1981 (Special Forces soldier indicted)

---

### Pain 4 — Fake liquidity walls / whales évaporent l'orderbook

**Description.** Mur de bids à 6c. Le retail croit voir du support. Le whale annule au moment du click. Le retail entre au pire prix.

**Fréquence.** Permanente sur Polymarket CLOB. Hebdomadaire sur les exchanges crypto.

**Intensité.** 8/10.

**Citations.**

> *"That's a fake liquidity wall... The market makers and whales use these fake walls to manipulate retail sentiment, trick you into entering bad trades, and siphon money from people who don't understand how the order book actually works."* — u/sightwhale, [r/Polymarket/1sotoly](https://www.reddit.com/r/Polymarket/comments/1sotoly/)

> *"bro the fake wall trick has gotten me so many times lmao. you watch that big order just evaporate right as you click buy and its like... yeah that was planned all along."* — u/immortalismmmm

> *"fake liquidity walls are easier to detect on websocket than on the UI. the tell is order id stability — real liquidity sits with the same order id over multiple updates, fake walls cycle the order ids constantly."* — u/MartinEdge42

---

### Pain 5 — PFOF / "Citadel a vu ton ordre"

**Description.** Robinhood revend le flux d'ordres à Citadel Securities. Citadel exécute en internalisant. L'utilisateur fournit la matière première de l'industrie qui le bat.

**Fréquence.** Constante depuis 2021.

**Intensité.** 7/10 — plus politique qu'émotionnelle, plus durable.

**Citations.**

> *"Citadel is your daddy. Not Elon."* — [r/wallstreetbets/imy0zl](https://www.reddit.com/r/wallstreetbets/comments/imy0zl/) (titre de thread — pitch en huit mots)

> *"Thanks Robinhood, still won't use your fucking app though"* — [r/wallstreetbets/1lm9b9z](https://www.reddit.com/r/wallstreetbets/comments/1lm9b9z/)

> *"Robinhood clients in 2016–2019 would have been better off using other brokers even after paying per-trade commissions, because the prices Robinhood clients received were much worse... with Robinhood users losing on average $15 on each 500-share order."* — Schwarz et al., *Journal of Finance*, cité partout sur Reddit

---

### Pain 6 — Stop hunt / wick hunt (CEX crypto et day-trading equity)

**Description.** Le stop loss du retail est posé à un niveau évident (round number, support visible). Le market maker ou la baleine pousse le prix juste assez pour le déclencher, puis le price reverse.

**Fréquence.** Quotidienne.

**Intensité.** 9/10. Trauma loop.

**Citations.**

> *"I got stopped out in many trades because of tight SL, and the stock reversed right after taking my money."* — [r/Daytrading/ued7om](https://www.reddit.com/r/Daytrading/comments/ued7om/)

> *"Stopped out for -$3,000, I wouldn't have held this whole trade but would've been +$12,000."* — u/Firm_Diet, [r/Daytrading/1jrsfre](https://www.reddit.com/r/Daytrading/comments/1jrsfre/)

> *"MM have level 3, so they can see the stops. Most people play similar style putting stops near obvious support."* — [r/Daytrading/1192nsf](https://www.reddit.com/r/Daytrading/comments/1192nsf/)

> *"if u were holding long positions, you probably got wicked out before you could even blink. we saw btc slice through 85k like it wasn't even there, hitting a low of around 83,300."* — u/My_Rhythm875, [r/CryptoCurrency/1qszk9m](https://reddit.com/r/CryptoCurrency/comments/1qszk9m/)

> *"There was not one time I didn't buy either the top or bottom with 2x on FTX. Almost instantly after buying price went against me and activated stop loss. And I tried with 30+ trades. These bastards scammed their customers."* — u/No_Fuel_4676

**Variantes.** *"wick hunt", "stop hunt", "liquidity grab", "scam wick", "stop run", "got SL'd", "took out the low/high then ran"*.

---

### Pain 7 — Forex broker = counterparty (bucket shop)

**Description.** Le broker forex retail tient l'autre côté de ton trade. Mathématiquement, ton stop-loss est son revenu.

**Fréquence.** Permanente.

**Intensité.** 8/10. Souvent acceptée comme inéluctable.

**Citations.**

> *"Banks have already been caught red handed collaborating in chat rooms on how to manipulate the price... Experienced Whale traders at CITI, JP etc know where you have these SL. They also know where you most likely placed your pending buy/sell with tight SL. All they have to do is drive the price enough to take out all of the above."* — u/Mozdar, [r/Forex/9fycyn](https://www.reddit.com/r/Forex/comments/9fycyn/)

> *"I had recorded why I feel cheated by IC markets. They had employed dirty tricks to make me lose."* — u/Simlulan

> *"market makers operate on ECNs = Price maker. market takers (you and me) on ECNs = Price taker. Watch out — the house (MM) always wins (mathematically — hence you always see 70/30 - 65/35 % of our clients loose money)."* — u/eatingpeopleisqueasy

---

### Pain 8 — Lines moving / steam moves (sportsbooks et prediction markets)

**Description.** Le bettor sharp voit une edge. Avant qu'il clique, la ligne a déjà bougé.

**Citation.**

> *"lines are way too tight. books move instantly on any info. see value, place bet, line's already shifted. get limited constantly because books flag any winner right away... Even random stuff like wnba or d3 volleyball has sharp lines in minutes."* — u/jirachi_2000, [r/sportsbook/1peu1bv](https://www.reddit.com/r/sportsbook/comments/1peu1bv/)

---

### Pain 9 — Insider listing pumps (Coinbase, Binance)

**Description.** Le coin pump avant l'annonce officielle. Les insiders accumulent. Le retail achète au pic.

> *"Wait, people are just noticing now that coinbase does insider trading? This shouldn't be news to anyone at this point..."* — u/gagnonca, [r/CryptoCurrency/7kxqlp](https://reddit.com/r/CryptoCurrency/comments/7kxqlp/)

> *"Binance listing AKA youre money is exit liquidity. Thanks for the fees"* — u/countjah

> *"One thing I learned from last bull is you SELL ON BINANCE LISTING FFS. So much lost money."* — u/NewPCBuilder2019

---

### Pain 10 — Rug pull / honeypot / KOL self-rug

**Description.** Le dev part avec la LP. Le contrat empêche la vente. Le KOL pump-and-dumpe ses propres followers.

> *"Just woke up in the morning, found out my coin exit-scammed... Today, the team announced they're ceasing operations, price's dropped 95%, can't even withdraw coins from the staking contract."* — u/paImer999

> *"Whole fucking country is getting rugged lmfao"* — u/EmbraceHegemony (Trump Family Token)

> *"willingly joined partners with the Scam Brothers, became the face of a shitcoin, and basically went AWOL for days without a word of care after her own followers lost their life savings."* — u/Every_Hunt_160 (Hawk Tuah girl)

---

### Pain 11 — Le market-maker cartel (Wintermute / DWF / GSR / Jump)

> *"Three companies control whether your project lives or dies. Three companies decide if you get liquidity. Three companies charge millions to run bots in the dark, dump your tokens whenever they feel like it, and call it 'market making.' DWF. Wintermute. GSR. Say the names. Know them. Because they own you."* — u/Samurailaronkes, [r/CryptoCurrency/1pdcj93](https://reddit.com/r/CryptoCurrency/comments/1pdcj93/)

---

### Pain 12 — CEX freeze pendant un crash

> *"The owner of this site has temporarily banned you... 1) some exchanges bet against the investor; 2) they wick out traders or stop them out; 3) trading fees; 4) funding fees; 5) insurance funds."* — u/HammondXX, [r/CryptoCurrency/qedj6t](https://reddit.com/r/CryptoCurrency/comments/qedj6t/)

---

### Pain 13 — Oracle rigging (Polymarket UMA whales)

> *"It's an interesting spot for Kalshi. Obviously, there will be some people that start to use Kalshi exclusively and ditch PM due to this defrauding of traders."* — u/Plasticfishman, [r/Kalshi/1m238n0](https://www.reddit.com/r/Kalshi/comments/1m238n0/)

Le Ukraine-mineral-deal market à $7M, résolution renversée par vote UMA. Texte fondateur de la défiance prediction-market.

---

### Pain 14 — Kalshi vig stacking + outages

> *"I did a bet today and they charged me like $70 on a 1k bet. They say it's a market maker fee but it isn't... in essence you are paying an 11 percent fee to bet on the NFL."* — u/gamblersfalacy, [r/Kalshi/1oza9p7](https://www.reddit.com/r/Kalshi/comments/1oza9p7/)

> *"99% of entities (traders, market making institutions(SIG)) just operate on Pinnacle... if Pinnacle hides their odds temporarily in order to adjust them Market Makers will pull back all their orders from the orderbook."* — u/UnusualRazzmatazz765

---

### Pain 15 — Dark pools / internalization / "Citadel routes 47% of retail"

> *"47% of retail orders get sent through Citadel who then routes them through Citadel Connect, where volume is not tracked by FINRA."* — diffusion r/Superstonk

> *"Dance of Darkness: The SEC and Dark Pools"* — [r/Superstonk/movevb](https://www.reddit.com/r/Superstonk/comments/movevb/)

> *"How to Manually Reroute Orders to NYSE Instead of Dark Pool. We Need to Take Matters Into Our Own Hands."* — [r/Superstonk/olk0rd](https://www.reddit.com/r/Superstonk/comments/olk0rd/)

---

## 3. INVENTAIRE COMPLET DES QUESTIONS UTILISATEURS

Plus de cent questions distinctes. Regroupées par maturité.

### Niveau débutant — viennent de se faire toucher

1. *"Why did my market order fill at $X when the ask was $Y?"*
2. *"Why did my limit order not fill when the price hit my limit?"*
3. *"What is PFOF and why should I care?"*
4. *"Did Citadel really front-run my trade?"*
5. *"Why does my stop always get hit right before the move?"*
6. *"Should I use a stop loss at all?"*
7. *"How can I bet without getting limited?"*
8. *"Why did DraftKings limit me to $5?"*
9. *"Is FanDuel allowed to limit me for winning?"*
10. *"Where do sharp bettors actually bet?"*
11. *"How did I just lose $2K in one click?"*
12. *"Why did my Uniswap swap give me way less than I expected?"*
13. *"What's a sandwich attack and did one happen to me?"*
14. *"Is Coinbase doing insider trading?"*
15. *"Is my forex broker actually trading against me?"*
16. *"Is Robinhood actually free?"*
17. *"Did the SEC really fine Citadel only $7M?"*

### Niveau intermédiaire — ils ont lu un 606 ou un block explorer

18. *"How do I route my order to IEX instead of a wholesaler?"*
19. *"Does PFOF actually give worse fills or is that overblown?"*
20. *"What's the real difference between Citadel Connect, a dark pool, and an exchange?"*
21. *"Why can I never get filled at mid?"*
22. *"What's a soft book vs a sharp book?"*
23. *"Can I use Pinnacle from the US?"*
24. *"How do pros stay un-limited?"*
25. *"Is Polymarket rigged by insiders?"*
26. *"How do I tell a real wall from a fake wall on Polymarket?"*
27. *"Why did the price move to 99c before the news hit?"*
28. *"Is Kalshi just running Pinnacle's book?"*
29. *"What's the difference between ECN and STP and which one is real?"*
30. *"Can anyone ELI5 to me how an MEV Blocker actually works? From a practical perspective?"* — u/Shiratori-3
31. *"Does Flashbots Protect actually work or is it theatre?"*
32. *"Is CoW Swap really safer or did they get caught sandwiching too?"*
33. *"Is sandwiching possible on Arbitrum / Optimism / Base?"*
34. *"Should I just go back to spot only?"*

### Niveau avancé — ce sont eux qui achètent

35. *"What's the actual leakage on a 500-share market order at Robinhood vs Fidelity vs IBKR vs direct exchange access?"*
36. *"Is there a broker or platform that publishes per-trade execution data in a verifiable way?"*
37. *"If a market maker internalizes my order, can I cryptographically verify they didn't sit on it for a millisecond?"*
38. *"What would 'no PFOF, no internalization, no last look' actually cost me in commissions?"*
39. *"Why hasn't anyone built a broker that proves the fill on-chain?"*
40. *"Is the 'best execution' rule actually enforceable or just hand-waving?"*
41. *"Is there an architecture where MEV extraction is structurally impossible — not hidden, not trusted, but mathematically proven to be fair?"* — u/ginete_tech
42. *"Once ETH goes PoS and the main validators being CEX, soon you will have coinbase front running your dex trade rather than some miner/farm trying to secure the network — right?"* — u/Fullback22x
43. *"What's the game theory for exploiting the bots' new inventory risk?"* — u/AInception
44. *"If I use intent-based systems (CoW, UniswapX), am I just trading sandwich risk for solver trust?"*
45. *"Is there a prediction market without whales?"*
46. *"How do I know the oracle isn't going to flip the resolution?"*
47. *"Where can I trade where the venue isn't the counterparty?"*
48. *"Does anyone offer an exchange model for US sports?"*

### Niveau existentiel — la question qui précède l'achat

49. *"Is there any venue where the game isn't rigged against me?"*
50. *"Why does Ethereum allow this when no regulated CEX would?"*
51. *"Should I just leave crypto?"*
52. *"Why do 90% of retail traders lose money despite so much free information?"*

**Questions sans réponse claire dans le corpus.** Les questions 35–48 — c'est précisément le vide tryGeneral_ remplit. Reddit n'a pas de réponse. Les commentaires les plus upvotés sont *"there isn't one"*.

**Questions mal comprises.** Toutes les questions niveau 1 reçoivent des réponses qui *gaslightent* — *"that's just how markets work"*, *"learn slippage"*, *"git gud"*. Le persona apprend à ne plus poser. Il apprend à savoir.

---

## 4. ANALYSE DU LANGAGE ET DES PATTERNS LINGUISTIQUES

Le persona possède un dialecte. Trois dialectes superposés, en réalité, qui se chevauchent dans le vocabulaire mais divergent en registre.

### 4.1 Le lexique de la rancune (universel, multi-cohorte)

- ***"rigged"*** — mot le plus fréquent du corpus. Plat, parfait.
- ***"the game"*** — appellation amère. Ils savent que ce n'est pas un jeu.
- ***"screwed", "fucked", "ripped off", "robbed", "bent over", "shafted"***
- ***"the house always wins"*** — invocation, presque prière.
- ***"exit liquidity"*** — *leur* mot pour "personne". *"if your app froze while BTC hit 83k, congrats you were the exit liquidity."*
- ***"the spread is a tax"*** — chronique, pas aigu.
- ***"price improvement"*** — dit avec sarcasme.

### 4.2 Vocabulaire technique précis (par cohorte)

**Sportsbook :** *"got limited", "limited me to $5", "max bet", "promo banned", "shadow ban", "the line", "line move", "stale line", "steam move", "drop the line", "sharp", "square", "soft book", "sharp book", "+EV", "matched betting", "arb", "hold", "vig", "juice", "no-vig price", "runner", "PPH", "kiosk".*

**Prediction market :** *"the whale", "insider", "insider trade", "front-run", "OSINT", "fake wall", "liquidity wall", "thin market", "CLOB", "order book", "websocket", "wallet age", "copytrade", "UMA", "oracle", "governance attack", "resolves", "settle".*

**Crypto on-chain :** *"got sandwiched", "got MEV'd", "got Jared'd", "the mempool", "private mempool", "flashbots RPC", "protect RPC", "MEV Blocker", "JIT", "sniper bot", "first-block snipe", "honeypot", "rugged", "rug pull", "soft rug".*

**CEX crypto :** *"wicked out", "stop hunt", "liquidation cascade", "margin flush", "mechanical margin call", "insider listing", "pre-listing", "market maker cartel".*

**Forex / day-trading :** *"stop hunt", "liquidity grab", "liquidity sweep", "smart money", "SMC", "ICT", "bucket shop", "B-book", "A-book", "ECN", "STP", "MM" (péjoratif), "dealing desk", "last look", "asymmetric slippage", "the broker is your counterparty".*

**Retail equity PFOF :** *"front-run", "kickback", "selling my data", "dark pool", "off-exchange", "internalized", "wholesaler", "606 report", "the algos", "the bots", "the HFTs", "wholesaler".*

**Meme stock conspiracy :** *"Kenny", "Shitadel", "hedgies", "ape", "MOASS", "DRS", "lock the float", "diamond hands", "paper hands", "smooth brain", "wrinkle brain", "FTD", "naked short", "synthetic shares", "T+35", "married puts", "cellar boxing", "swaps", "RRP", "Cede & Co", "DTCC", "the cycle", "the sneeze", "ThEy CoveRed", "wife's boyfriend", "tendies", "Hedgies R Fuk".*

### 4.3 Noms de l'ennemi (ordonnés par fréquence)

1. **Citadel** (presque toujours = Citadel Securities le MM, *pas* le hedge fund — la confusion *est* le persona)
2. **Kenny / Kenny Boy** — Griffin
3. **Shitadel**
4. **hedgies**
5. **the suits**
6. **Wall Street**
7. **Vlad** — Tenev
8. **Plotkin** — Melvin Capital
9. **the wholesalers** — Citadel + Virtu + Two Sigma + Jane Street + G1
10. **the MM** / **the cartel**
11. **Jared from Subway / JaredFromSubway.eth** — figure folklorique crypto
12. **Wintermute / DWF / GSR / Jump** — cartel MM crypto
13. **Trump insider** — wallet on-chain identifié, devenu nom commun
14. **JPMorgan** (Wallstreetsilver) — Citadel des métaux
15. **DraftKings / FanDuel / BetMGM / Caesars / ESPN BET** — par leurs noms exacts

### 4.4 Patterns syntaxiques (à voler tels quels pour le copy)

- ***"I had a stop at X. It got hit at X.01. Then it ran to Y."*** — la lamentation canonique. Setup–pivot–knife en trois phrases. Le persona écrit Cioran par accident.
- ***"Stopped out for -$3,000. Would've been +$12,000."*** — l'annonce publicitaire complète.
- ***"I bought at the top. Of course."*** — la queue résignée.
- ***"Free trades aren't free."*** — le punchline qu'ils connaissent déjà.
- ***"They saw my order."*** — paranoïa, demi-vraie, fondatrice.
- ***"Citadel pays the fines. They make more from one morning than the fine."*** — cynisme regulatory.
- ***"Of course this happened."*** — registre crypto. Pré-chargé.

---

## 5. PSYCHOLOGIE DU PERSONA

### 5.1 Peurs profondes (souvent tues)

- *"Je ne suis pas assez intelligent pour rivaliser."*
- *"Tout le système est conçu pour me prendre mon argent."*
- *"Chaque dollar perdu va payer le yacht de Ken Griffin."*
- *"Si j'arrête, j'admets que j'étais un pigeon."*
- *"Ma famille va découvrir combien j'ai perdu."*
- *"Aucune protection n'arrive. La SEC va fermer Citadel avec $7M d'amende et appeler ça la justice."*

### 5.2 Désirs cachés (qui ouvrent le portefeuille)

- Être celui qui *les* bat. Pas le marché — **eux**.
- Voir l'orderbook comme les HFT le voient.
- Un *reçu*. Cryptographique. Horodaté. Que personne n'a touché.
- Une *facture pour l'absence de vol* — le persona crypto a passé six ans à écrire cette phrase sans le savoir.

### 5.3 Croyances limitantes

- *"Les meilleurs brokers coûtent trop cher en commissions."* (Faux. Ils ne font pas le calcul.)
- *"Si c'est vendu comme une 'protection', c'est une arnaque."* (Saine méfiance. Bloquante.)
- *"Rien ne peut réparer la structure, alors pourquoi essayer."*
- *"Crypto est encore pire, à quoi bon."*

### 5.4 Biais cognitifs observables

- **Confirmation bias** sur stéroïdes — chaque perte est l'algo.
- **Apophénie** — ils voient la manipulation dans le bruit. Parfois c'est réel. Souvent non. Les deux feel identiques.
- **Loss aversion converti en rage** — perdre $50 sur un wick fait plus mal que perdre $500 sur une thèse.
- **In-group / out-group polarization** — "nous, les apes / eux, les suits".
- **Sunk-cost as identity** — plus tu tiens, plus tenir *devient ce que tu es*.
- **Cynisme comme identité** — ils ne *veulent* pas que le marché soit réparé. La fiction du jeu truqué est une identité formée. Le produit doit le savoir : ne pas promettre l'utopie. Promettre des reçus.

### 5.5 Le moment de bascule

Chaque persona en a un. Trois archétypes :

1. **Le jour où le bouton "buy" a disparu** (28 janvier 2021). Robinhood freeze GME. Le persona ne s'en remet pas.
2. **Le jour où il a migré chez Fidelity / IBKR / Pinnacle / un vrai ECN** — fait un trade — vu trois cents d'amélioration — fait le calcul — est devenu enragé.
3. **Le jour où il a lu Atobitt / Trimbath / un thread MEV** — il a compris que la structure permettait le vol, pas l'individu — il ne peut plus la désapprendre.

Pour le bettor : c'est le mail *"Your account has been limited"*. Pour le crypto trader : c'est la première fois qu'il a vu son slippage sortir à 4% sur un swap de $5k. Pour le forex retail : il n'y a pas eu de moment. Il a juste fini par savoir.

---

## 6. MOTIVATIONS ET JOBS TO BE DONE

### 6.1 Objectif principal (le job-to-be-done top niveau)

> *"Engager du capital dans un marché sans que la structure de ce marché ne me vole un basis point avant, pendant, ou après l'exécution."*

### 6.2 Objectifs secondaires

- Voir l'edge qu'il pense avoir matérialiser dans le PnL, pas s'évaporer dans le slippage.
- Conserver l'auto-image de "celui qui comprend le marché", pas de "celui qui se fait avoir".
- Faire taire la suspicion permanente. Pouvoir cliquer sans penser que quelqu'un a vu le clic.
- Avoir un récit à raconter à sa femme / son colocataire / sa propre conscience : *"j'ai joué, j'ai perdu honnêtement"*.

### 6.3 Motivations rationnelles vs émotionnelles

| Rationnel (ce qu'il dira) | Émotionnel (ce qui l'achète) |
|---|---|
| "Meilleurs fills, moins de slippage." | Vengeance contre Kenny / Citadel / Wintermute / DraftKings. |
| "Transparence d'exécution." | "Je suis enfin du bon côté du jeu." |
| "Frais visibles plutôt que cachés." | "Je ne suis plus le pigeon." |
| "Architecture protocolaire vérifiable." | "Ma femme ne saura plus jamais que je me suis fait avoir." |

### 6.4 Success criteria du point de vue utilisateur

- *"Mon trade s'exécute au prix que je vois."*
- *"Aucune entité ne lit mon ordre avant qu'il soit exécuté."*
- *"Si je gagne, on ne ferme pas mon compte."*
- *"Je peux prouver à un sceptique, en trois clicks, que je n'ai pas été front-run."*
- *"À la fin du mois, la somme de mes leaks invisibles tend vers zéro."*

---

## 7. ANALYSE DES SOLUTIONS ACTUELLES

Ce que tryGeneral_ remplace, par ordre de prévalence.

### 7.1 Au niveau de l'ordre

- **Limit orders** au lieu de market orders. Conseil universel, insuffisant.
- **Marketable limits** bid/ask + 1 cent.
- **Mid-price working orders** — attendre indéfiniment.
- **Order splitting** en enfants plus petits.
- **Mental stops** au lieu de stops plateforme. *"They can't hunt what they can't see."*
- **ATR-based wider stops** au lieu de stops fixes.

### 7.2 Au niveau du venue

- **Routing manuel vers IEX** (speed bump exchange).
- **Direct Market Access via IBKR Pro, TradeStation, ToS.**
- **Migration de Robinhood vers Fidelity / IBKR / Tastytrade.**
- **Migration de DK / FD vers Pinnacle, BetCRIS, Bookmaker, BetOnline, Circa, ProphetX, Sporttrade, NoVig, Betfair, Smarkets.**
- **Polymarket précisément parce que "no limits"** — le whole appeal est que DK ne peut pas les éjecter pour avoir eu raison.
- **Kalshi** — federally licensed, mais vig stacké sur fee MM sur top de pricing Pinnacle-dérivé.
- **Migration de Polymarket vers Kalshi** après l'UMA scandal.
- **Migration de Kalshi vers Polymarket** après outages et vig.
- **Pour le forex : cycle Oanda → IC Markets → FXCM → forex.com → Pepperstone → Tickmill → prop firms → recommencer.**

### 7.3 On-chain crypto

- **Flashbots Protect RPC** — premier réflexe.
- **MEV Blocker** — recommandé partout.
- **CoW Swap** — adoré, puis questionné après l'incident pseudo-sandwiching de novembre 2024.
- **1inch Fusion**, **Matcha**, **UniswapX** — anticipés.
- **Slippage tolerance basse + gas supérieur.**
- **L2s** (Arbitrum, Optimism, Base) — *"There is no mempool on Arbitrum or Optimism."* Demi-solution.
- **Trade simulation (Tenderly, Rabby).**

### 7.4 Hors-chaîne / CEX

- **Limit-only orders.**
- **Multi-exchanges side door** — 20% du collateral chez un secondary venue.
- **No leverage.** *"Leveraged trading is a mugs game."*
- **Stop using stop-losses.** *"They get hunted."*
- **Kraken** — *"The only exchange that has never cheated with their trade engine."* (u/i_have_chosen_a_name)
- **Self-custody, cold wallet.** *"Not your keys, not your coins."*

### 7.5 Sport / matched betting

- **Multi-accounting / runners / PPH.**
- **Kiosk betting en casino** — anonyme.
- **Betting exchanges** — Betfair, Smarkets, ProphetX, Sporttrade, NoVig.
- **OddsJam, DarkHorseOdds, RebelBetting, Unabated** — line-shopping software, $50–$100/mois.
- **Matched betting / promo abuse** — traiter chaque book US régulé comme bonus farm.

### 7.6 Conspiracy retail

- **DRS to ComputerShare** (sacrement).
- **Buy physical silver, not SLV** (Wallstreetsilver).
- **Call your rep. SEC comment. Change.org.**
- **Substack / Discord / YouTube influencers** — puis désillusion en cascade.
- **Computershare DSPP** — bypass broker.
- **Petition to End FINRA.**

### 7.7 Le radical

- **Quitter.** r/Daytrading et r/Forex ont leur genre hebdomadaire *"I'm done"*.
- **Boglehead conversion** — rare, dramatique, soulagement.

### 7.8 Ce qu'ils n'ont PAS essayé (le vide tryGeneral_ remplit)

- Un broker / venue avec *exécution vérifiable, cryptographique, temps-réel*. Ils n'y croient pas. Ils n'ont pas cherché. C'est l'ouverture.

---

## 8. OBJECTIONS ET FREINS À L'ACHAT

Dans l'ordre où elles se présenteront sur la landing page.

1. **"Qui êtes-vous et où est le piège ?"** — Suspicion par défaut. Trop propre = arnaque.
2. **"Faut-il vous confier la custody de mes fonds ?"** — Post-FTX, post-Robinhood-freeze, mot le plus chargé.
3. **"C'est de la crypto ?"** — Si oui, la moitié des equity / sportsbook traders disparaissent. Si non, vente facile. Si "techniquement oui mais ça ne ressent pas comme de la crypto", possible.
4. **"Comment empêchez-vous réellement le front-running ? L'industrie entière n'y arrive pas."** — Le burden of proof est sur nous.
5. **"Combien ça coûte par trade ?"** — Ils ont internalisé "PFOF c'est mauvais". Ils n'ont *pas* internalisé "je paierais $5 par trade pour une exécution propre". Le math doit être montré.
6. **"Vous êtes régulé ?"** — Ils détestent la SEC et veulent un régulateur à pointer du doigt. La contradiction *est* le persona.
7. **"Vrais stocks ou seulement perps synthétiques ?"** — Si univers synthétique, perte de la moitié de la cohorte equity.
8. **"Que se passe-t-il si vous tombez ?"** — Robinhood Jan 28 single-point-of-failure paranoïa.
9. **"Vous êtes juste un dark pool en costume ?"** — La cohorte sophistiquée pose cette question. La réponse compte.
10. **"Pourquoi IBKR ou Fidelity n'ont pas construit ça ?"** — Skepticisme moat.
11. **"If it sounds too good to be true..."** — Le reflexe. La réponse Cioran : *"It is. We charge for it. You already knew."*
12. **"Show me a fill report I can verify."** — Demandé par la cohorte technique. Si on publie des reçus hashables, la vente se fait seule.
13. **"You're crypto-backed. So you can rug me."** — Pour la cohorte equity.
14. **"L'oracle peut être manipulé comme UMA."** — Pour la cohorte Polymarket. Réponse : BLS multi-sig, pas de governance token.
15. **"Mes wins ne vont pas faire limiter mon compte ?"** — Pour la cohorte sportsbook. Réponse : *"There is no limits team. There is no one to limit you."*

---

## 9. SEGMENTATION ULTRA DÉTAILLÉE DES PERSONAS

Sept profils. Triés par proximité avec le pitch tryGeneral_.

---

### Persona 1 — Le prediction-market evangelist (le early adopter zéro)

**Profil.** 26–38 ans, technique, lit des whitepapers, parle de microstructure. Crypto-natif. Anglais souvent langue seconde. Trade sur Polymarket / Kalshi / PredictIt. Suit Robin Hanson, Tetlock, Vitalik.

**Niveau d'expérience.** Avancé. Comprend CLOB, AMM, oracle, MEV, BLS.

**Objectifs.** Trouver un prediction market où le whaling ne dicte plus la résolution et où l'oracle n'est pas un governance token.

**Pain points spécifiques.** UMA manipulation. Fake walls. Insider wallets. Vig + market-maker-fee sur Kalshi. Outages.

**Comportement.** Lit le code source. Audit du smart contract. Track les wallets on-chain via Polycool / PolyApex. Compare les frais. Documenté.

**Langage.** *"toxic flow", "insider", "oracle attack", "CLOB depth", "front-run", "OSINT", "wallet age", "thin market", "no-vig", "implied probability".*

**Relation aux solutions.** Déjà payé pour OddsJam-equivalents. Prêt à payer pour mieux. Le tester en premier.

**Conversion.** Un whitepaper + une démo on-chain + un thread sur r/Polymarket. C'est tout.

---

### Persona 2 — Le sportsbook sharp limité partout

**Profil.** 28–45 ans, math-savvy, +EV bettor. Tier 1 sur tous les US books pendant trois mois, limité à $5 ensuite. Multi-accounter. Connaît Pinnacle, Circa, BetCRIS.

**Niveau.** Intermédiaire à avancé. Math en tête, structure de marché médiocre.

**Objectifs.** Une venue qui *prend son action*. Limit-free. Lines de qualité Pinnacle. Sans avoir à utiliser un runner.

**Pain points.** Limited. Promo banned. Bait-and-switch des $2000 free bets. Lines stale ou steaming avant qu'il clique.

**Langage.** *"got limited", "soft book", "sharp book", "+EV", "vig", "juice", "no-vig", "the line", "steam move", "matched betting", "runner", "PPH".*

**Relation aux solutions.** Multi-accountant. Paye OddsJam. Migré offshore. Frustré par Polymarket (résolution risk) et Kalshi (vig stack).

**Conversion.** *"We do not have a limits team. There is no limits team. There is no one to limit you."* Plus une démo des résolutions BLS-cosignées.

---

### Persona 3 — Le crypto trader MEV-pillé (5-figure à low-6-figure rotating book)

**Profil.** 22–35 ans, on-chain native, suit Crypto Twitter, jaded. Trade sur Uniswap, swap quotidien, multi-chain (ETH, L2s, Solana). A perdu $5k–$50k en sandwiches cumulés. Sait qui est Jared from Subway.

**Niveau.** Avancé techniquement. Connaît Flashbots, MEV Blocker, JIT, CoW.

**Objectifs.** Trader sans set-up RPC à chaque fois. Voir la *facture* de ce qu'il *n'a pas* perdu.

**Pain points.** Sandwich. JIT. Failed-tx gas. Sniper bots Solana. Honeypots. Insider listings. Wick hunts CEX. Market-maker cartel.

**Langage.** *"got sandwiched", "got MEV'd", "got Jared'd", "exit liquidity", "rugged", "honeypot", "sniper", "the mempool", "private RPC", "wicked out", "liquidation cascade", "insider listing", "Wintermute".*

**Relation aux solutions.** A essayé Flashbots, CoW, 1inch Fusion, UniswapX. Sait que chaque venue a son extraction layer. Fatigué.

**Conversion.** Protection *invisible*, *default-on*, plus dashboard mensuel chiffrant *l'absence de vol*. Le persona ne paie pas pour la peur. Il paie pour les factures.

---

### Persona 4 — Le forex retail trauma

**Profil.** 22–55 ans, large spectre, souvent émergent (Asie, Afrique, Europe Est). Paye des prop firms. Achète des cours ICT. Sait qu'il perd mais reste.

**Niveau.** Variable. Vocabulary élevé, P&L bas.

**Objectifs.** Trader où le broker n'est *pas* sa contrepartie.

**Pain points.** Bucket shops. B-book. Last look. Asymmetric slippage. Spread widening Friday close. Stop hunts.

**Langage.** *"bucket shop", "B-book", "stop hunt", "liquidity grab", "SMC", "ICT", "the broker is your counterparty".*

**Relation aux solutions.** Cycle perpétuel de brokers.

**Conversion.** **Persona à acquérir en phase 3, pas en phase 1.** Il ne se fait plus confiance pour évaluer la fairness. Il a besoin de témoignage social — des Personas 1, 2, 3 qui disent *"tryGeneral_ ne m'a pas front-run"*. Une fois ça en place, c'est le plus grand TAM.

---

### Persona 5 — Le retail equity refugee (post-Robinhood)

**Profil.** 25–45 ans, day-trader ou swing, déjà migré chez Fidelity ou IBKR. A lu un 606. Connaît PFOF.

**Niveau.** Intermédiaire. Math en place, microstructure floue mais croissante.

**Objectifs.** Voir l'exécution. Vérifier qu'il n'est pas internalisé. Trader avec un reçu.

**Pain points.** Limit fills who don't fill. Stop hunts. Wholesalers. *"Citadel saw my order."*

**Langage.** *"PFOF", "front-run", "kickback", "dark pool", "internalized", "wholesaler", "606", "the algos", "Citadel".*

**Relation aux solutions.** Déjà payé en se déplaçant vers IBKR. Prêt à payer plus pour la verifiabilité.

**Conversion.** Comparatif chiffré vs Robinhood / Fidelity / IBKR + démonstration on-chain (sans utiliser le mot "blockchain" en premier).

---

### Persona 6 — Le conspiracy retail (la Superstonk-cohorte)

**Profil.** 28–50 ans. A vécu Jan 28 2021 comme événement personnel. DRS'd. ComputerShare. A lu Atobitt, Trimbath, "House of Cards".

**Niveau.** Folk-expertise élevée (DTCC, FTD, Cede & Co, Reg SHO). Sélective.

**Objectifs.** *Que Kenny aille en prison.* Plus pragmatiquement : une venue où la structure ne peut pas être truquée.

**Pain points.** Jan 28. Naked shorting. Synthetic shares. MMTLP halt. SEC qui touche $7M. Le silence des médias.

**Langage.** *"Kenny", "Shitadel", "hedgies", "MOASS", "DRS", "ape", "diamond hands", "FTD", "synthetic", "T+35", "the cycle", "Hedgies R Fuk".*

**Relation aux solutions.** DRS, ComputerShare, no broker, physical silver. Dead end.

**Conversion.** **Radioactive en tier 1**. *Mais le vocabulaire est de l'or pour les autres cohortes.* Cible-les en tier 3 quand le produit est mature, et utilise leur dialecte pour parler aux cohortes 1–5 sans devenir une parodie. Bridge sentence : *"You don't need to believe MOASS is coming. You only need to believe Wall Street has, at every previous opportunity, stolen a basis point from you. We built the rails where they cannot."*

---

### Persona 7 — Le post-rapture bagholder

**Profil.** 30–60 ans. A perdu six chiffres sur BBBY / AMC / MMTLP / FTX / Luna. N'est plus actif. Lit Reddit comme un confessional.

**Niveau.** Variable.

**Objectifs.** Récupérer. Pas la somme — la dignité.

**Relation aux solutions.** Aucune. Ils ne trade plus. Mais ils témoignent. **Ne pas cibler. Lire.** Leur registre est le miroir le plus net du persona vivant.

---

## 10. PARCOURS UTILISATEUR (CUSTOMER JOURNEY)

### Étape 1 — Le déclencheur

Toujours un événement *spécifique*, *daté*, *montrable* :

- Le mail *"Your account has been limited."*
- Le swap qui a renvoyé 4% de moins que prévu.
- Le stop déclenché à $0.01 du wick avant le retour.
- Le tweet Trump 12 minutes après que 50 wallets aient parié dessus.
- Le 28 janvier 2021 (pour la génération GME).
- L'écran "Cloudflare HSTS" pendant que BTC wickait à 83k.

Le persona ne se convertit pas par lecture. Il se convertit par *expérience personnelle vérifiable*.

### Étape 2 — Phase de recherche (Reddit)

Le persona arrive sur Reddit avec une question précise. Il cherche la confirmation que ce qu'il a vécu est un pattern, pas un accident. Il la trouve toujours. Il sort de cette phase avec un vocabulaire : *"sandwich attack"*, *"PFOF"*, *"got limited"*, *"dark pool"*. Il *nomme* ce qu'on lui a fait. Ça aggrave.

### Étape 3 — Phase de comparaison

Il essaie les solutions existantes :
- Si crypto : Flashbots Protect, MEV Blocker, CoW Swap, L2s.
- Si equity : Fidelity, IBKR Pro, ToS.
- Si sport : Pinnacle, Circa, BetCRIS, Betfair.
- Si prediction : Polymarket vs Kalshi.

Chaque solution résout une partie. Chacune introduit son propre coût. Le persona devient *expert en demi-solutions*.

### Étape 4 — Phase de décision

Le persona n'achète pas un produit. Il *adopte une posture*. La décision est lente, précédée de :
- Lecture d'un thread Reddit où quelqu'un comme lui décrit la solution X.
- Demande de receipts vérifiables.
- Test minimal (un trade, un pari, un swap).
- Comparaison chiffrée *par lui-même*, pas par le pitch.

### Étape 5 — Post-expérience

Si la promesse tient sur 4–6 semaines, le persona devient évangéliste. Pas avant.
Si la promesse craque une seule fois, le persona ne revient jamais. Et il le dit publiquement.
Le persona ne pardonne pas — il ne peut plus.

---

## 11. OPPORTUNITÉS STRATÉGIQUES

### 11.1 La séquence d'acquisition (impossible à inverser)

**Phase 1 — r/Polymarket, r/PredictionMarkets, r/Kalshi.** Pitch : *"Sealed bets. BLS-cosigned oracles. No UMA tokens overruling the rules. The whale cannot front-run your fills, the insider cannot trade on what you cannot see."* Mécanique > marketing. Le persona 1 lit le whitepaper.

**Phase 2 — r/sportsbook sharps, r/Mathbet, ProphetX / Sporttrade adjacent.** Pitch : *"A real exchange with no limits and no toxic flow."* Référence Circa et Pinnacle comme cousins. Screenshot DraftKings "max bet $1.37" comme villain.

**Phase 3 — Crypto MEV (r/CryptoCurrency, r/ethereum, r/UniSwap).** Pitch : *"Protection invisible, default-on, mensuel facturé en absence de vol."* Pas en premier — la cohorte est sceptique de toute *nouvelle* solution MEV.

**Phase 4 — Forex retail + r/Daytrading.** Le TAM le plus grand, la cohorte la plus cynique. Land here *après* que les phases 1–3 produisent des témoignages réels.

**Phase 5 — Retail equity refugees (r/Fidelity, r/InteractiveBrokers, r/options).** Cohorte mature, sophistiquée, lente à bouger. La conversion se fait par comparatif chiffré.

**Phase 6 (jamais) — Conspiracy retail.** Ne pas chercher à convertir. Utiliser leur dialecte, citer leurs villains, respecter leur cosmologie sans l'endosser.

### 11.2 Gaps du marché (les portes ouvertes)

1. **Aucune venue ne montre, en chiffres et en temps réel, ce que le user *n'a pas perdu*.** Le "MEV invoice" mensuel — *"Ce mois-ci, tryGeneral a empêché $X de slippage extractible, $Y de wick hunt, $Z de spread widening"* — n'existe nulle part. Construire ça est *seul* un produit viable.
2. **Aucune venue ne combine "no limits" sportsbook + "no whales" prediction market + "no MEV" on-chain.** tryGeneral_ est positionné pour ça.
3. **Aucune venue ne publie de fill receipt cryptographique vérifiable par le user.** Personne. Pas même les "decentralized" exchanges.
4. **Aucune venue ne nomme l'ennemi.** Tous lissent. *"Certain large market participants"*. Le persona déteste ce langage. Nommer Citadel, Wintermute, DraftKings *par leur nom* est un signal d'allégiance qui se paye en conversion.

### 11.3 Angles marketing sous-exploités

- **L'invoice de l'absence de vol.** *"This month we saved you $147.32 you would have lost to extraction. Here is the math. Here is the on-chain proof."* — c'est l'angle.
- **Le "no limits team" pitch.** *"We do not have a limits team. There is no one to call. There is no one to limit you."*
- **Le "your order doesn't leak before execution" pitch.** Sealed orderbook + BLS cosign + on-chain settlement. Trois lignes. Trois preuves. Pas de quatre.
- **L'angle Cioran : *"It is rigged. We made one that isn't. We charge for it. You already knew this was the deal."***

### 11.4 Messages qui résonneraient fortement

Headlines pulled directly from the corpus, à voler tels quels :

- *"Citadel is your daddy. Not Elon. Not anymore."*
- *"Your stop loss is just a liquidity map. We hide the map."*
- *"Got limited? We don't have a limits team. We don't have anyone."*
- *"You're the exit liquidity. Until you're not."*
- *"The Matrix is real. We patched it."*
- *"They saw your order. Now they don't."*
- *"Free isn't free. We charge. It's cheaper."*

### 11.5 Idées de produit / contenu

- **Public dashboard : `extraction.tryGeneral.io`** — temps réel, anonymized, *"this hour, $X of MEV extracted across DEXs / $Y of slippage on Robinhood routed orders / $Z of stop-hunt losses on Binance liquidations"*. Le persona vient pour voir. Reste pour s'inscrire.
- **Receipt verifier** — colle un trade ID, prouve la fill price vs NBBO à la milliseconde. Le persona-cohorte-Superstonk vénérerait ça même s'il n'achète pas.
- **Case study HTML, n° 002.** *Vision* est le n° 001. Le n° 002 : *"How tryGeneral_ would have stopped the $215,500 sandwich attack. With receipts."*
- **Cioran-grade landing copy** — setup-pivot-knife. Trois sections. Pas plus.
- **"What it costs you to be the customer" calculator** — input un volume mensuel, output le slippage + PFOF leakage + limit-loss + MEV moyens estimés. Compare à ce que tryGeneral_ leur ferait économiser. La math fait la vente.
- **Anti-Cheat narrative.** Le fichier `AntiCheatIceberg.tsx` ouvert sur l'IDE laisse penser que la marque s'oriente déjà vers cette positioning — c'est la bonne. *"The first anti-cheat in trading."* Une catégorie en une phrase. Tous les sous-arguments (sealed bets, BLS, no PFOF, no UMA) deviennent des manifestations d'un seul concept légible : *cheating is structurally impossible*.

### 11.6 Ce qu'il ne faut surtout pas faire

- *"Empowering retail investors"*. *"Democratizing access"*. *"Unlock"*. *"Leverage"*. *"Innovative"*. *"Next-gen"*. Les phonèmes shill. Robinhood les a usés. Le persona les filtre avant le scroll deux.
- Mentionner un VC backer dans la hero. *"Sequoia-backed"* lit comme *"Sequoia-controlled"*.
- Bios fondateur qui mentionnent Citadel, Two Sigma, Jane Street, Jump, Susquehanna sauf cadré comme *"I worked at Citadel for 9 years and I am here to burn it down"*. Sinon c'est fatal.
- *"AI-powered protection"*. *AI* en 2026 = *"more bots, this time wearing our colors"*.
- *"Subject to applicable regulations"* en hero copy. Skadden-prose en début de page = capture régulatoire.
- *"As featured in CNBC / Bloomberg / MarketWatch"*. Negative-EV.
- Lecture du marché en termes de MOASS / squeeze / wealth. Le persona n'achète pas la promesse rédemptive. Il achète la promesse *structurelle*.

### 11.7 Le test final

Une phrase. Une seule. Si le persona ne se reconnaît pas dedans, on a échoué :

> ***"Le venue n'est plus la contrepartie. Le book ne peut pas te limiter. La baleine ne peut pas te front-run. L'information privilégiée devient inutile dès que le protocole l'exige."***

Le persona Polymarket lira le code. Le persona sportsbook lira le prix. Le persona forex attendra que les deux autres témoignent. Tous arriveront. **L'ordre compte.**

---

## Caveat méthodologique

L'agent retail equity a opéré en environnement réseau bloqué et a reconstruit certaines citations à partir de snippets de recherche. Les permaliens ont été vérifiés ; les corps verbatim doivent être confirmés sur Reddit ouvert avant d'apparaître en copy publique.
Les agents prediction-market, conspiracy, et crypto ont scrapé en direct (Reddit JSON API + Brave + mirrors). Quotes + permaliens vérifiés.
Files bruts conservés sur `/tmp/tg-research/` (agent crypto), `/tmp/reddit-research/` (agent sportsbook). Disponibles pour audit.

---

*Le persona a passé six ans à décrire ce produit sans croire qu'il pouvait exister. La tâche n'est pas de le convaincre qu'il en a besoin. La tâche est de lui faire admettre qu'il est réel.*
