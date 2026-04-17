// Auto-generated ITP page content for 107 ITPs
// Maps ticker -> { whyPoints, objective, label }

export const ITP_PAGE_CONTENT: Record<string, {
  whyPoints: string[]
  objective: string
  label: string
}> = {
  BRDG: {
    label: "TradFi Index",
    whyPoints: [
      "Every new L2 and L1 deployment increases demand for cross-chain asset transfer. Bridge protocols collect tolls on this traffic. As the multi-chain thesis matures, these tolls compound.",
      "Market-cap weighted across 10 cross-chain communication tokens, rebalanced monthly. Larger protocols earn higher weight, reflecting the market's capital allocation to proven infrastructure.",
      "Unlike holding a single bridge token, the index rotates into whichever interoperability solution the market currently values most. Concentration risk drops; sector exposure stays.",
    ],
    objective:
      "Tracks the top 10 cross-chain communication protocols by market cap. Monthly rebalancing tilts toward whichever bridge or messaging protocol leads in market valuation, capturing the toll economics of multi-chain asset movement.",
  },
  PRIV: {
    label: "TradFi Index",
    whyPoints: [
      "Financial privacy is a permanent demand. Regulated institutions need compliant privacy layers, and the protocols building them remain structurally underpriced relative to their addressable market.",
      "Equal weighting across 5 privacy tokens prevents single-project dominance, giving balanced exposure to ZK proofs, MPC, and confidential computing approaches. Rebalanced every 60 days.",
      "Privacy infrastructure is fragmented across competing technical approaches. An equal-weight basket diversifies across paradigms rather than betting on one cryptographic method.",
    ],
    objective:
      "Provides diversified exposure to privacy-preserving blockchain infrastructure by equally weighting the top 5 privacy tokens. Rebalances every 60 days, rotating into whichever privacy approaches the market supports.",
  },
  RWAI: {
    label: "TradFi Index",
    whyPoints: [
      "RWA tokenization sits at the convergence of TradFi and DeFi. The protocols enabling tokenized treasuries, real estate, and credit are building rails between two markets worth hundreds of trillions.",
      "Market-cap weighted across 10 RWA protocols, rebalanced monthly. Natural concentration in infrastructure and issuance leaders while maintaining tail exposure to emerging platforms.",
      "Buying individual RWA tokens requires picking winners in a nascent sector. The index abstracts that decision, holding the full stack from data feeds to issuance platforms.",
    ],
    objective:
      "Tracks the top 10 RWA tokenization protocols by market cap, rebalanced monthly. Captures the growth of tokenized treasuries, credit, and real-estate infrastructure as traditional assets migrate to blockchain rails.",
  },
  RWATVL: {
    label: "Macro Index",
    whyPoints: [
      "TVL-weighted RWA exposure means capital follows actual deposits, not speculation. Where real money sits is a stronger signal than where narratives point.",
      "Weighting by total value locked surfaces the RWA protocols with genuine institutional adoption. The methodology naturally tilts toward tokenized commodities and stablecoins where deposits are deepest.",
      "Among all RWA approaches, TVL weighting produces the lowest drawdowns because real backing creates real price floors. The index buys what institutions actually hold, not what they discuss.",
    ],
    objective:
      "Tracks tokenized real-world assets weighted by total value locked, capturing where institutional capital actually deposits rather than where speculation flows. Monthly rebalancing adjusts to shifts in deposit allocation across RWA protocols.",
  },
  LSTKTVL: {
    label: "Yield Index",
    whyPoints: [
      "Liquid staking is the base layer of DeFi yield. Every ETH and SOL staked through these protocols generates fees that accrue to governance token holders. The demand is structural.",
      "TVL weighting reflects the actual market structure of liquid staking. Dominant platforms earn proportionally higher weight because depositor preference is the strongest endorsement.",
      "Rather than picking a single staking provider, the index holds the full landscape weighted by where capital chooses to stake. Monthly rebalancing tracks shifts in depositor loyalty.",
    ],
    objective:
      "Holds the top 10 liquid staking protocol tokens weighted by staked TVL. Naturally concentrates in dominant staking platforms, rebalancing monthly to track shifts in depositor preference.",
  },
  CLVL60: {
    label: "Risk Index",
    whyPoints: [
      "Low-volatility factor investing, applied to crypto. The 20 least volatile tokens over 60 days are selected, producing smoother equity curves than broad market exposure.",
      "The 60-day lookback smooths regime changes compared to shorter windows. The selection gravitates toward large caps and stablecoins during turbulence, exactly what low-vol should do.",
      "In equities, the low-volatility anomaly has persisted for decades. This index tests whether the same factor premium exists in crypto, where volatility dispersion is far wider.",
    ],
    objective:
      "Selects the 20 least volatile tokens from the entire market over a 60-day lookback window, rebalanced monthly. Systematically avoids drawdown-heavy assets, producing smoother returns than broad market exposure.",
  },
  CDMOM60: {
    label: "Momentum Index",
    whyPoints: [
      "Dual momentum combines absolute and relative strength. Only tokens trending up on both axes make the cut, filtering out mean-reversion traps that catch single-factor momentum strategies.",
      "The 60-day window provides longer trend confirmation with fewer whipsaws. Fewer false signals means lower turnover and higher conviction per position.",
      "Compared to simpler momentum approaches, dual momentum avoids buying tokens that are rising only because the entire market is rising. The relative filter demands genuine outperformance.",
    ],
    objective:
      "Applies dual momentum scoring across all tokens, selecting the top 15 by combined absolute and relative performance over 60 days. Monthly rebalancing rotates into confirmed trends while exiting fading ones.",
  },
  FANS: {
    label: "Culture Index",
    whyPoints: [
      "Fan tokens capture the loyalty economy of professional sports. Clubs with hundreds of millions of fans create recurring engagement cycles tied to matchdays, transfers, and tournaments.",
      "Equal weighting across 10 fan tokens ensures no single club dominates. Each sports season creates volume independent of broader crypto sentiment, making this a genuine diversifier.",
      "Sports engagement is seasonal, recurring, and largely uncorrelated to crypto market cycles. The index captures a demand pattern that exists outside the usual BTC-driven correlation structure.",
    ],
    objective:
      "Provides equal-weighted exposure to the top 10 sports fan tokens, rebalanced monthly. Captures the intersection of crypto and professional sports, where engagement is seasonal, recurring, and largely uncorrelated to broader crypto markets.",
  },
  MEME5: {
    label: "Culture Index",
    whyPoints: [
      "The top 5 AI meme tokens by market cap. The Lindy effect in meme culture is real: tokens that survive the initial hype cycle gain cultural gravity that newcomers cannot replicate.",
      "Market-cap weighting concentrates in the memes that achieved escape velocity. Biweekly rebalancing catches rotation fast, dropping fading memes and adding new survivors.",
      "Meme tokens follow extreme power laws. A 5-token concentrated basket captures the head of that distribution while monthly rotation prevents holding yesterday's joke.",
    ],
    objective:
      "Holds the 5 largest AI meme tokens by market cap, rebalanced every 14 days. Bets that the biggest memes survive while smaller ones die, capturing the power law of meme culture through systematic market-cap selection.",
  },
  CDPMOM: {
    label: "Momentum Index",
    whyPoints: [
      "CDP stablecoin protocols are the commercial banks of DeFi. Momentum weighting captures which lending protocols are gaining adoption in the stablecoin wars.",
      "30-day momentum applied to the top 5 lending protocols, rebalanced biweekly. The strategy exits losers fast and concentrates in growth, treating market share shifts as the signal.",
      "Unlike static allocation to lending, momentum weighting adapts to which stablecoin issuer is winning this cycle. DeFi lending leadership changes; the index follows the change.",
    ],
    objective:
      "Applies 30-day momentum weighting to the top 5 lending protocols, rebalanced every 14 days. Systematically rotates into whichever stablecoin or lending platform is gaining market share.",
  },
  RWADEF: {
    label: "Risk Index",
    whyPoints: [
      "Minimum variance weighting across RWA protocols produces the lowest-volatility macro exposure available in crypto. The optimizer tilts toward the least correlated tokenized assets.",
      "The min-var approach naturally gravitates toward tokenized commodities and stablecoins, producing a defensive allocation that conventional market-cap weighting cannot replicate.",
      "For portfolios that need crypto exposure without crypto-grade volatility, defensive RWA construction offers a middle ground. The covariance matrix decides the allocation, not a committee.",
    ],
    objective:
      "Applies minimum variance optimization to the top 10 RWA protocols, rebalanced monthly. Minimizes portfolio volatility by overweighting the least correlated tokenized assets, producing a naturally defensive allocation.",
  },
  MSEC: {
    label: "Tech Index",
    whyPoints: [
      "Shared security marketplaces let new chains bootstrap validators without starting from zero. The restaking thesis turns existing staked capital into a scalable resource.",
      "TVL weighting reflects where the market deposits capital for restaking. Dominant platforms earn proportional allocation because validator trust is not distributed evenly.",
      "Modular security is an infrastructure bet: as the number of chains grows, the demand for shared validation grows with it. The index captures this structural tailwind.",
    ],
    objective:
      "Tracks liquid restaking governance tokens weighted by TVL, rebalanced monthly. Captures the shared security marketplace thesis by concentrating in protocols where the most capital has been deposited for restaking.",
  },
  VCFUND: {
    label: "Tech Index",
    whyPoints: [
      "VC-funded protocols tend to have the longest runways and most aggressive builder teams. Smart money leads; this index follows the signal.",
      "The VC overlay filters the top 20 DeFi protocols by TVL, then weights by market cap. Only projects with verified venture backing qualify, combining fundamental scale with institutional endorsement.",
      "Venture-backed DeFi protocols survive bear markets at higher rates because their treasuries are designed for multi-year runways. The filter selects for survival.",
    ],
    objective:
      "Selects the top 20 DeFi protocols by TVL, filtered by VC funding status and weighted by market cap. Rebalances monthly, systematically tracking where institutional venture capital flows in DeFi.",
  },
  VCVAL: {
    label: "Tech Index",
    whyPoints: [
      "Highest VC valuation reflects maximum institutional conviction. The index admits only protocols that top venture firms valued highly enough to write large checks.",
      "The valuation overlay selects for protocols that attracted the largest round sizes, filtering out projects with small or no institutional backing. Round size is a proxy for due diligence depth.",
      "By combining VC valuation filtering with market-cap weighting, the index captures both institutional pre-market conviction and post-launch market validation.",
    ],
    objective:
      "Holds the top 20 DeFi protocols by TVL filtered by VC valuation, weighted by market cap and rebalanced monthly. Captures the subset of DeFi that institutional investors valued most highly.",
  },
  TOPYLD: {
    label: "Yield Index",
    whyPoints: [
      "Yield is DeFi's gravity. Capital flows to the best returns, and this index weights by native protocol yield to track exactly where that gravity pulls hardest.",
      "Yield-weighted selection across 15 protocols means the highest-paying platforms carry the basket. Biweekly rebalancing captures yield regime shifts as they happen.",
      "Most DeFi users rotate yield farms manually. This index automates the rotation, systematically overweighting wherever yields are richest without the operational overhead.",
    ],
    objective:
      "Selects the 15 highest-yielding DeFi protocols and weights them by native yield, rebalanced every 14 days. Automates the yield-farming rotation that most DeFi users do manually.",
  },
  YLDTVL: {
    label: "Yield Index",
    whyPoints: [
      "TVL-weighted yield protocols capture where capital actually deposits for returns. Deposit volume is a trust signal that yield percentage alone cannot provide.",
      "Pure yield chasing rewards unsustainable rates. TVL weighting anchors to deposit volumes, concentrating in platforms where yield-seekers have placed the most capital over time.",
      "The divergence between high-yield and high-TVL protocols reveals sustainability. This index bets on the latter, the platforms that keep deposits, not just attract them.",
    ],
    objective:
      "Tracks the top 15 yield protocols weighted by total value locked, rebalanced biweekly. Capital allocation by depositors serves as the weighting signal, concentrating in protocols where yield-seekers have placed the most trust.",
  },
  LENDREV: {
    label: "Yield Index",
    whyPoints: [
      "Lending protocols weighted by interest revenue. The DeFi equivalent of buying commercial banks by net interest margin, revenue proves demand, not just speculation.",
      "Revenue weighting selects for lending platforms that actually generate income, not just attract speculative TVL. Protocols earning the most spread income get the highest allocation.",
      "Interest revenue is the hardest metric to fake in DeFi. Unlike TVL, which can be inflated by incentives, revenue reflects genuine borrowing demand.",
    ],
    objective:
      "Holds the top 10 lending protocols weighted by interest revenue, rebalanced monthly. Systematically overweights the platforms generating the most spread income from borrowing and lending activity.",
  },
  BRDGREV: {
    label: "Macro Index",
    whyPoints: [
      "Every cross-chain swap pays a toll. Revenue-weighted bridge tokens capture the protocols earning the most from inter-chain traffic, not just the ones with the loudest narrative.",
      "Equal weighting across 5 bridge tokens provides balanced exposure to different bridging approaches and fee models. Revenue qualification ensures each one actually generates income.",
      "Bridge revenue correlates with multi-chain adoption. As L2 proliferation continues, the protocols collecting transfer fees become infrastructure tollbooths with recurring income.",
    ],
    objective:
      "Tracks cross-chain bridge protocols weighted by transfer fee revenue, rebalanced monthly. Captures the toll economics of multi-chain asset movement by overweighting bridges that generate the most transaction fees.",
  },
  YLDSQRT: {
    label: "Yield Index",
    whyPoints: [
      "Square root of TVL weighting balances established protocols with emerging yield sources. The sqrt function compresses the gap between dominant and mid-tier platforms.",
      "Pure TVL weighting creates extreme concentration. The sqrt transform gives mid-tier yield sources a meaningful allocation without abandoning the capital-trust signal of TVL.",
      "For yield-seekers who want diversification beyond the single largest protocol, sqrt weighting is a mathematical compromise between equal weight and pure TVL concentration.",
    ],
    objective:
      "Applies square-root TVL weighting to the top 15 yield protocols, rebalanced biweekly. The square-root function reduces the dominance of the largest protocol while still respecting the capital-allocation signal of TVL.",
  },
  GAME5: {
    label: "Culture Index",
    whyPoints: [
      "Maximum conviction in gaming infrastructure winners. Top 5 by market cap concentrates capital in the platforms most likely to capture any blockchain gaming adoption wave.",
      "Concentrated 5-token exposure amplifies any gaming adoption curve. The thesis is binary: if on-chain gaming works, market-cap leaders absorb the majority of the upside.",
      "Blockchain gaming has underperformed broadly. A concentrated index accepts that binary risk explicitly, either the sector inflects, or it does not. No middle ground.",
    ],
    objective:
      "Holds the 5 largest gaming tokens by market cap, rebalanced monthly. Provides maximum-conviction exposure to blockchain gaming infrastructure, betting that market-cap leaders will capture the largest share of any gaming adoption wave.",
  },
  M2E: {
    label: "Culture Index",
    whyPoints: [
      "Fitness meets crypto. Move-to-earn and play-to-earn protocols reward physical activity and engagement with tokens, creating a mass adoption vector through lifestyle gamification.",
      "Equal weighting provides diversified exposure across the play-to-earn and move-to-earn ecosystem. No single game or fitness protocol dominates the allocation.",
      "The lifestyle gamification thesis targets users who would never buy crypto directly. Token rewards for physical activity lower the barrier to entry for an entirely new demographic.",
    ],
    objective:
      "Provides equal-weighted exposure to the top 5 play-to-earn and move-to-earn tokens, rebalanced monthly. Captures the lifestyle gamification thesis where physical activity and gaming generate token rewards.",
  },
  LOVOL: {
    label: "Risk Index",
    whyPoints: [
      "The low-volatility anomaly, assets with lower volatility delivering superior risk-adjusted returns, is one of the most persistent factors in equity markets. This index tests it in crypto.",
      "30-day low-volatility lookback with biweekly rebalancing selects the 20 calmest tokens. The selection gravitates toward large caps and stablecoins during turbulence, which is correct behavior.",
      "Shorter lookback windows react faster to regime changes than the 60-day variant. Biweekly rebalancing keeps the portfolio aligned with the current volatility regime.",
    ],
    objective:
      "Selects the 20 least volatile tokens over a 30-day window, rebalanced biweekly. Applies the low-volatility anomaly from equity markets to crypto, systematically avoiding high-drawdown assets.",
  },
  ORAMV: {
    label: "Risk Index",
    whyPoints: [
      "Minimum variance optimization applied to data infrastructure tokens. The covariance matrix allocates weight, producing the lowest-volatility portfolio possible from this sector.",
      "The min-var optimizer distributes weight across 10 data-feed and analytics tokens based on their co-movement patterns. Correlation structure, not market cap, drives the allocation.",
      "Data infrastructure is critical to every blockchain application. A minimum-variance construction captures the sector while explicitly minimizing portfolio-level drawdowns.",
    ],
    objective:
      "Applies minimum variance optimization to the top 10 analytics and data-feed tokens, rebalanced every 60 days. Constructs the lowest-volatility portfolio possible from blockchain data infrastructure tokens.",
  },
  DCOUP: {
    label: "Contrarian Index",
    whyPoints: [
      "Tokens whose correlation to BTC drops below 0.3 have independent demand catalysts. This index hunts decoupling events, assets moving on their own fundamentals, not BTC gravity.",
      "Inverse-volatility weighting concentrates in the calmest decoupled assets. The methodology favors stability over magnitude, seeking uncorrelated calm rather than uncorrelated chaos.",
      "During high-correlation regimes, most crypto portfolios move as one. This index systematically exits that co-movement, providing genuine diversification when other holdings correlate.",
    ],
    objective:
      "Tracks tokens with low Bitcoin correlation, weighted by inverse volatility and rebalanced biweekly. Captures independent demand catalysts by overweighting assets that move on their own fundamentals rather than following BTC.",
  },
  NFTPH: {
    label: "Culture Index",
    whyPoints: [
      "NFT marketplace infrastructure has declined dramatically, but NFTs as technology keep expanding into gaming, identity, and ticketing. The picks-and-shovels play at maximum narrative despair.",
      "Equal weighting across NFT marketplace tokens provides balanced exposure to the recovery thesis without concentrating in any single platform's execution risk.",
      "Contrarian positioning at narrative lows creates maximum asymmetry. The downside from current levels is bounded by how far the sector has already fallen.",
    ],
    objective:
      "Equally weights the top 10 NFT marketplace tokens, rebalanced monthly. A contrarian bet on NFT infrastructure recovery, positioned at maximum narrative despair where any adoption surprise creates outsized returns.",
  },
  METAB: {
    label: "Culture Index",
    whyPoints: [
      "Metaverse tokens at maximum narrative despair. Any corporate metaverse announcement creates volume spikes in these tokens. The asymmetry between current prices and potential catalysts is the thesis.",
      "Equal weighting across 10 metaverse tokens provides broad exposure to the virtual worlds narrative at distressed valuations. No single project dominates the downside risk.",
      "The underlying technology, 3D rendering, spatial computing, virtual economies, continues to develop regardless of token prices. The index captures the gap between progress and price.",
    ],
    objective:
      "Equally weights 10 metaverse tokens, rebalanced monthly. Captures the extreme asymmetry of metaverse infrastructure at narrative lows, where tokens have declined sharply but the underlying technology continues to develop.",
  },
  PREDCON: {
    label: "Culture Index",
    whyPoints: [
      "Prediction market infrastructure during narrative valleys, with a Fear & Greed contrarian overlay. Information markets are permanently valuable; the sentiment cycles around them are temporary.",
      "The FNG overlay accumulates during market panic and reduces during euphoria. It treats prediction market tokens as a structural asset class distorted by short-term fear.",
      "Prediction markets are one of the few crypto applications with clear, non-speculative utility. The contrarian overlay buys that utility when others are selling it.",
    ],
    objective:
      "Equally weights 5 derivatives and prediction market protocols with a Fear & Greed contrarian overlay, rebalanced every 60 days. Accumulates prediction market exposure during fear and reduces during greed.",
  },
  DMOM60: {
    label: "Momentum Index",
    whyPoints: [
      "60-day dual momentum across the top 20 tokens provides broad trend exposure with longer confirmation windows. The extended lookback reduces false signals compared to 30-day alternatives.",
      "The dual filter requires both absolute and relative strength. Tokens must be trending up in isolation and outperforming the field. Marginal trends get rejected.",
      "Broader than the concentrated 5-token variant, the 20-token selection balances momentum concentration with diversification. Enough positions to capture multiple sector trends simultaneously.",
    ],
    objective:
      "Applies 60-day dual momentum scoring to the top 20 tokens across all categories, rebalanced biweekly. The extended lookback reduces false signals and increases conviction per position.",
  },
  AIDMOM: {
    label: "Momentum Index",
    whyPoints: [
      "Dual momentum on AI tokens with weekly rebalancing captures the intersection of the AI narrative and trend-following discipline. The AI sector moves fast; weekly rotation keeps pace.",
      "30-day dual momentum applied specifically to DeFAI tokens. The AI narrative in crypto is noisy, momentum filtering separates genuine adoption trends from announcement-driven spikes.",
      "AI tokens have high narrative beta. Momentum weighting harnesses that volatility rather than suffering from it, riding confirmed trends and exiting reversals quickly.",
    ],
    objective:
      "Applies 30-day dual momentum to the top 10 DeFAI tokens, rebalanced weekly. Rides the AI narrative in crypto by holding only tokens trending up on both absolute and relative axes.",
  },
  GAMM60: {
    label: "Momentum Index",
    whyPoints: [
      "60-day gaming momentum captures sustained game launch adoption curves rather than short-lived hype spikes. Longer windows filter the noise that dominates gaming token price action.",
      "15 gaming tokens scored by 60-day momentum, rebalanced biweekly. Sustained gaming adoption is rare and concentrated, the methodology surfaces it when it appears.",
      "Gaming tokens are driven by launch cycles and player adoption curves. 60-day momentum aligns with the typical timeline of a game gaining traction after release.",
    ],
    objective:
      "Ranks the top 15 gaming tokens by 60-day price momentum, rebalanced biweekly. Filters short-term noise to identify games and gaming infrastructure with sustained adoption curves.",
  },
  GAMDM: {
    label: "Momentum Index",
    whyPoints: [
      "Dual momentum on gaming selects only tokens trending up on both absolute and relative basis. Most gaming tokens fail both tests most of the time, the strategy is maximally selective.",
      "Weekly rebalancing with 30-day dual momentum exits failing games fast. In a sector with high attrition, speed of exit matters as much as entry timing.",
      "The dual filter is particularly valuable in gaming, where narrative hype can push prices up without genuine adoption. Relative momentum demands outperformance, not just a rising tide.",
    ],
    objective:
      "Applies 30-day dual momentum to the top 10 gaming tokens, rebalanced weekly. Holds only gaming tokens simultaneously trending up in absolute terms and outperforming the broader market.",
  },
  DFIMFNG: {
    label: "Momentum Index",
    whyPoints: [
      "Smart contract platform momentum with an FNG trigger. The FNG overlay exits to cash during extreme fear, preserving gains through crashes that would destroy raw momentum strategies.",
      "The fear exit mechanism accounts for most of the improvement over raw momentum. One simple rule, go to cash during panic, transforms the risk profile of trend-following.",
      "L1 tokens have the highest beta in crypto. Momentum captures their upside; the FNG trigger limits the downside. The combination produces a fundamentally different return distribution.",
    ],
    objective:
      "Applies 30-day momentum to the top 10 smart contract platforms with a Fear & Greed trigger overlay, rebalanced weekly. During extreme fear, the strategy exits to cash. During neutral or greedy markets, it rides the strongest L1 trends.",
  },
  TVLMPP: {
    label: "Momentum Index",
    whyPoints: [
      "Perp DEX protocols ranked by TVL momentum. Open interest growth signals the on-chain derivatives migration, capital flowing into perp platforms faster than it flows out.",
      "TVL momentum captures protocols attracting new deposits, not just experiencing price appreciation. Deposit growth is a leading indicator of trading volume and fee revenue.",
      "The on-chain derivatives thesis is structural: as trust in CEXes erodes, trading volume migrates to transparent venues. TVL momentum identifies which venues are winning that migration.",
    ],
    objective:
      "Tracks the top 10 perpetual DEX protocols ranked by 30-day TVL momentum, rebalanced weekly. Captures the on-chain derivatives migration by overweighting platforms experiencing the fastest deposit growth.",
  },
  MOM5FNG: {
    label: "Momentum Index",
    whyPoints: [
      "Top 5 momentum tokens with an FNG trigger. Concentrated positions amplify both the momentum signal and the fear exit. The simplest high-conviction systematic strategy in the catalog.",
      "The FNG trigger transforms the drawdown profile. Raw momentum loses catastrophically in bear markets; the fear exit converts those drawdowns into flat periods.",
      "Five positions is aggressive concentration. The trade-off is intentional: fewer holdings mean each momentum signal carries maximum weight, and the FNG trigger manages the tail risk.",
    ],
    objective:
      "Holds the top 5 tokens by 30-day momentum with a Fear & Greed trigger, rebalanced weekly. Combines concentrated trend-following with a systematic fear exit.",
  },
  TVLMOM: {
    label: "Momentum Index",
    whyPoints: [
      "TVL leaders filtered by price momentum. A hybrid fundamental-technical approach: start with protocols that have real deposits, then weight by which ones are trending.",
      "20 tokens from the highest-TVL DeFi protocols, weighted by 30-day momentum and rebalanced biweekly. The TVL base provides stability; the momentum overlay provides timing.",
      "Pure TVL weighting ignores price trends. Pure momentum ignores fundamentals. This index takes the intersection, large protocols with positive price action.",
    ],
    objective:
      "Selects the top 20 DeFi protocols by TVL, then weights them by 30-day price momentum and rebalances biweekly. Combines the stability of large TVL protocols with the timing advantage of momentum selection.",
  },
  ROTATE: {
    label: "Momentum Index",
    whyPoints: [
      "Cross-sector momentum rotation across 50 tokens. Captures which crypto sector is leading this cycle without requiring a view on which sector that will be.",
      "50 tokens weighted by 30-day momentum, rebalanced weekly. The broadest momentum strategy in the catalog, rotating through L1s, DeFi, stablecoins, and memes as leadership shifts.",
      "Sector rotation is the defining feature of crypto cycles. This index automates the rotation that active traders attempt manually, with consistent methodology and no emotional drag.",
    ],
    objective:
      "Applies 30-day momentum to 50 tokens across every crypto category, rebalanced weekly. A pure sector-rotation strategy that systematically overweights whichever corner of crypto is trending strongest.",
  },
  BRMFNG: {
    label: "Momentum Index",
    whyPoints: [
      "Bridge protocol momentum with an FNG trigger. The fear exit matters here because bridge tokens are among the most volatile in crypto, they amplify both directions.",
      "30-day momentum across 10 bridge tokens, rebalanced biweekly. The strategy rides cross-chain infrastructure trends while the FNG overlay manages regime risk.",
      "Bridge tokens move sharply on adoption events and security incidents. Momentum captures the adoption moves; the FNG trigger limits exposure during market-wide panic.",
    ],
    objective:
      "Applies 30-day momentum to the top 10 bridge tokens with a Fear & Greed trigger overlay, rebalanced biweekly. Rides cross-chain infrastructure trends while exiting to cash during extreme market fear.",
  },
  ZKMVC: {
    label: "Momentum Index",
    whyPoints: [
      "Zero-knowledge proofs are the endgame for blockchain scaling and privacy. The VC filter ensures only venture-backed ZK projects qualify, selecting for teams with multi-year runway.",
      "30-day momentum across 10 ZK tokens, rebalanced biweekly. ZK technology has a long development cycle, momentum identifies which projects are breaking through commercially.",
      "The intersection of ZK technology and venture backing narrows the field to projects with both technical ambition and institutional support. Momentum then selects the current leaders.",
    ],
    objective:
      "Applies 30-day momentum to the top 10 zero-knowledge tokens, filtered by VC funding status and rebalanced biweekly. Captures the ZK scaling narrative through venture-validated projects showing price momentum.",
  },
  MODMVC: {
    label: "Momentum Index",
    whyPoints: [
      "Modular blockchain momentum with a VC overlay. Data availability layers are the newest infrastructure thesis, venture backing validates which DA projects have institutional credibility.",
      "Few modular projects pass both the VC and momentum filters simultaneously. Extreme selectivity is a feature: the index holds positions only when conviction signals align.",
      "The modular stack thesis requires patience. VC filtering selects for funded patience; momentum confirms when the market begins to agree.",
    ],
    objective:
      "Applies 30-day momentum to the top 10 data availability tokens, filtered by VC funding and rebalanced biweekly. Captures the modular blockchain thesis through the intersection of venture validation and price trend.",
  },
  CDM5: {
    label: "Momentum Index",
    whyPoints: [
      "Top 5 by dual momentum, rebalanced weekly. Maximum concentration in the strongest combined absolute and relative signals across the entire market.",
      "Dual momentum in a 5-token basket means each position passed two independent trend tests. The concentration amplifies conviction, and risk, by design.",
      "When broad market trends are strong, the selection gravitates toward large caps. When trends are narrow, it concentrates in sector leaders. The behavior adapts to the regime.",
    ],
    objective:
      "Holds the top 5 tokens by 30-day dual momentum, rebalanced weekly. Combines maximum concentration with the dual momentum signal, holding only assets trending up both in absolute and relative terms.",
  },
  DTVMVC: {
    label: "Momentum Index",
    whyPoints: [
      "DeFi TVL momentum with a VC overlay. Three signals must align before capital is allocated: high TVL, growing deposits, and venture backing. Triple confirmation.",
      "The VC filter ensures only institutionally-validated DeFi protocols enter the portfolio. TVL momentum ensures they are gaining adoption, not coasting on legacy deposits.",
      "Each additional filter narrows the universe. The trade-off is intentional, fewer holdings with higher conviction, backed by three independent validation signals.",
    ],
    objective:
      "Selects the top 10 DeFi protocols by TVL momentum with a VC funding filter, rebalanced weekly. Requires triple confirmation: high TVL, growing deposits, and institutional venture backing.",
  },
  LNMVC: {
    label: "Yield Index",
    whyPoints: [
      "Lending momentum with a VC overlay. Only venture-backed lending protocols showing price momentum qualify, smart money endorsement combined with market trend confirmation.",
      "The VC filter narrows the lending universe to institutionally-validated platforms. Momentum weighting then ranks the survivors by current market performance.",
      "Lending is the most commoditized sector in DeFi. VC backing selects for differentiation; momentum selects for market recognition of that differentiation.",
    ],
    objective:
      "Applies 30-day momentum to the top 10 lending protocols filtered by VC funding status, rebalanced biweekly. Captures lending sector growth through the intersection of institutional validation and price trend.",
  },
  YTMVC: {
    label: "Yield Index",
    whyPoints: [
      "Yield TVL momentum with a VC overlay. Three filters ensure only the strongest yield platforms qualify: growing deposits, venture backing, and sustained momentum.",
      "TVL momentum in yield protocols means capital is flowing in faster than it is leaving. The VC overlay confirms institutional confidence in the platform's sustainability.",
      "Yield-chasing without filters leads to rugs and unsustainable APYs. Triple-signal confirmation selects for yield platforms that are both growing and institutionally vetted.",
    ],
    objective:
      "Tracks the top 10 yield protocols by TVL momentum with a VC funding filter, rebalanced weekly. Automates yield-farm selection through capital flow momentum validated by institutional backing.",
  },
  PPVCFNG: {
    label: "Momentum Index",
    whyPoints: [
      "Perp DEX momentum with VC backing and FNG trigger. Three overlays on one strategy: venture validation selects credible platforms, momentum captures trends, and the FNG trigger exits during panic.",
      "The triple-overlay approach means capital is only deployed when venture-backed perp platforms are trending up in non-fearful markets. Maximum selectivity by design.",
      "Perpetual DEX tokens have high narrative beta. Three independent filters dampen that noise, deploying capital only when structural, technical, and sentiment signals agree.",
    ],
    objective:
      "Applies 30-day momentum to the top 10 perpetual DEX tokens with VC funding filter and Fear & Greed trigger, rebalanced weekly. Requires three confirmations: venture backing, price momentum, and neutral-to-greedy market sentiment.",
  },
  GMVCFNG: {
    label: "Momentum Index",
    whyPoints: [
      "Gaming momentum with VC backing and FNG trigger. Triple-filtered gaming exposure that only deploys capital when structural, technical, and sentiment signals align.",
      "The FNG trigger exits during fear, which matters in gaming where sentiment crashes are severe. The VC overlay ensures the studios have runway to survive those crashes.",
      "Gaming is the highest-attrition sector in crypto. Three filters exist because the base rate of failure is high, only multiply-validated projects deserve capital.",
    ],
    objective:
      "Applies 30-day momentum to the top 10 gaming tokens with VC funding filter and Fear & Greed trigger, rebalanced weekly. Captures gaming infrastructure momentum only when backed by venture capital and deployed in favorable sentiment.",
  },
  L1MFFD: {
    label: "Momentum Index",
    whyPoints: [
      "The most engineered L1 strategy in the catalog. Multi-factor scoring, FNG trigger, and BTC dominance switching work together to navigate the most complex sector in crypto.",
      "BTC dominance switching rotates between BTC-heavy and alt-heavy exposure based on the dominance regime. The FNG trigger exits during panic. Multi-factor selects the best risk-reward L1s.",
      "Three systematic overlays with zero discretionary decisions. Each overlay addresses a different failure mode: factor scoring handles selection, FNG handles sentiment, dominance handles regime.",
    ],
    objective:
      "Applies multi-factor scoring to the top 10 L1 tokens with Fear & Greed trigger and BTC dominance switching, rebalanced biweekly. Combines factor investing with regime awareness and sentiment protection.",
  },
  GOV15EQ: {
    label: "Macro Index",
    whyPoints: [
      "Top 15 governance tokens equally weighted, rebalanced quarterly. Patient allocation to the DAO ecosystem with 90-day holding periods that match the pace of governance participation.",
      "Quarterly rebalancing reduces turnover and trading costs. Equal weighting prevents concentration in any single DAO, distributing risk across the governance landscape.",
      "Governance tokens derive value from protocol revenue, voting power, and treasury claims. The quarterly cadence aligns with DAO budget cycles and proposal timelines.",
    ],
    objective:
      "Equally weights the top 15 liquid staking governance tokens, rebalanced every 90 days. Provides broad DAO ecosystem exposure with low turnover, matching the patient timeframe of governance participation.",
  },
  LND10FEB: {
    label: "Yield Index",
    whyPoints: [
      "Fee efficiency weighting selects the most capital-efficient lenders. The protocols generating the most revenue per unit of locked capital get the highest weight.",
      "Biweekly rebalancing across 10 lending protocols ranked by fee efficiency. The methodology rewards lean operations and strong pricing power over raw size.",
      "TVL and revenue tell different stories. Fee efficiency, the ratio between them, tells the most important one: which platforms extract the most value from each deposited unit.",
    ],
    objective:
      "Weights the top 10 lending protocols by fee efficiency, rebalanced every 14 days. Systematically overweights the most capital-efficient lenders, favoring protocols that generate the most interest revenue per unit of locked capital.",
  },
  CDP5TQ: {
    label: "Macro Index",
    whyPoints: [
      "Top 5 CDP protocols by TVL, rebalanced quarterly. Stablecoin issuance infrastructure with patient 90-day holding periods that reduce trading friction.",
      "Quarterly rebalancing in a concentrated basket means low turnover. The strategy holds through volatility rather than trading through it, aligning with the slow-moving nature of stablecoin infrastructure.",
      "CDP protocols are the central banks of DeFi. A concentrated TVL-weighted basket owns the institutions that issue the money supply, not the money itself.",
    ],
    objective:
      "Holds the top 5 lending protocols by TVL, rebalanced every 90 days. Provides concentrated stablecoin infrastructure exposure with patient quarterly rebalancing that reduces transaction costs.",
  },
  VCF10MF: {
    label: "Momentum Index",
    whyPoints: [
      "Top 10 VC-funded protocols ranked by multi-factor score. Combines momentum, volatility, and value signals, filtered by institutional venture backing for quality assurance.",
      "Multi-factor scoring provides diversified alpha sources beyond simple momentum. The VC overlay ensures the portfolio only contains protocols with institutional runway and validation.",
      "Single-factor strategies are fragile. Multi-factor construction hedges against any one signal failing, while the VC filter provides an independent quality gate.",
    ],
    objective:
      "Applies multi-factor scoring to the top 10 DeFi protocols filtered by VC funding, rebalanced biweekly. Combines quantitative factor signals with institutional venture validation.",
  },
  VLDM: {
    label: "Momentum Index",
    whyPoints: [
      "Volume leaders with dual momentum. High-activity protocols that are also trending up on both absolute and relative axes, liquidity depth confirmed by price trend.",
      "Dual momentum on the highest-volume DeFi protocols filters for projects with both trading activity and genuine price appreciation. The intersection is small and selective.",
      "Volume without momentum is stagnation. Momentum without volume is fragile. This index demands both, selecting protocols where depth and trend converge.",
    ],
    objective:
      "Applies 30-day dual momentum to the top 15 DeFi protocols by TVL, rebalanced weekly. Selects protocols that combine high trading activity with confirmed upward trends on both absolute and relative measures.",
  },
  DPULTRA: {
    label: "Macro Index",
    whyPoints: [
      "DePIN revenue-weighted with all three overlays: FNG trigger, BTC dominance switching, and VC filter. The maximum-systematic approach to decentralized physical infrastructure.",
      "Revenue weighting ensures only DePIN protocols generating real income qualify. Storage, bandwidth, and compute revenue represent genuine demand for decentralized resources.",
      "Three protective overlays on a revenue base. The strategy deploys capital into physical infrastructure only when venture-backed, momentum-positive, and in favorable market conditions.",
    ],
    objective:
      "Weights the top 10 DePIN protocols by revenue with FNG trigger, BTC dominance switching, and VC filter, rebalanced biweekly. Captures real infrastructure revenue from storage, bandwidth, and compute with maximum systematic protection.",
  },
  LNRVVC: {
    label: "Yield Index",
    whyPoints: [
      "Lending revenue with FNG trigger and VC filter. Only venture-backed, revenue-generating lending protocols that pass sentiment screening qualify. The most conservative lending approach.",
      "Triple filtering means capital is only allocated to lending platforms generating real interest income, backed by institutional investors, during non-fearful market conditions.",
      "Each filter addresses a different risk: revenue screens for sustainability, VC screens for quality, FNG screens for regime. Together they produce the most selective lending exposure available.",
    ],
    objective:
      "Weights the top 10 lending protocols by revenue with FNG trigger and VC funding filter, rebalanced biweekly. Applies three layers of filtering to lending exposure: revenue generation, institutional backing, and sentiment protection.",
  },
  DX10VFD: {
    label: "Macro Index",
    whyPoints: [
      "DEX volume weighting with FNG trigger and BTC dominance switching. Captures the most-traded decentralized exchanges while managing exposure through sentiment and BTC regime awareness.",
      "Volume weighting selects DEXes that are actually being used for trading, not just holding idle liquidity. The protective overlays add timing discipline.",
      "DEX volume is a real-time measure of decentralized trading adoption. The FNG and dominance overlays prevent deploying capital during hostile market regimes.",
    ],
    objective:
      "Weights the top 10 DEX tokens by trading volume with FNG trigger and BTC dominance switching, rebalanced weekly. Captures DEX activity leaders while managing exposure through sentiment and BTC regime awareness.",
  },
  PP10ULTRA: {
    label: "Macro Index",
    whyPoints: [
      "Perp DEX revenue with all three overlays. The most systematic approach to on-chain derivatives exposure: revenue base validates demand, three overlays manage timing and risk.",
      "Revenue weighting ensures only fee-generating perp platforms qualify. Three overlays filter the timing, deploying capital only when multiple signals confirm favorable conditions.",
      "The on-chain derivatives migration is a multi-year structural trend. Maximum systematic filtering ensures participation only under the most favorable convergence of signals.",
    ],
    objective:
      "Weights the top 10 perpetual DEX tokens by revenue with FNG trigger, BTC dominance switching, and VC filter, rebalanced weekly. Captures on-chain derivatives revenue through the most heavily filtered strategy in the catalog.",
  },
  YLD10ULTRA: {
    label: "Yield Index",
    whyPoints: [
      "Yield TVL momentum with all three overlays. The maximum-systematic yield strategy requiring four independent signals to align before capital is deployed.",
      "TVL must be growing, the protocol must be venture-backed, fear must not be extreme, and BTC dominance must favor alts. Quadruple confirmation eliminates the majority of yield-chasing mistakes.",
      "Most yield strategies fail because they deploy capital indiscriminately. This one deploys capital rarely, only when structural, institutional, technical, and sentiment signals converge.",
    ],
    objective:
      "Tracks the top 10 yield protocols by TVL momentum with FNG trigger, BTC dominance switching, and VC filter, rebalanced weekly. Deploys capital into yield only when four independent signals align.",
  },
  B100SM: {
    label: "Macro Index",
    whyPoints: [
      "The broadest index in the catalog. 100 tokens with sqrt market-cap weighting, which compresses the gap between large and small tokens. Mid-caps get real allocation.",
      "Sqrt market cap reduces the dominance of the top two tokens while still respecting relative size. The result is 100 holdings with meaningful weight in the long tail.",
      "For broad crypto market exposure without extreme large-cap concentration, sqrt weighting offers a mathematical middle ground between equal weight and pure market-cap dominance.",
    ],
    objective:
      "Holds 100 tokens weighted by the square root of market cap, rebalanced monthly. The sqrt function tilts allocation toward mid-caps, producing a more diversified index than pure market-cap weighting while still respecting relative size.",
  },
  B100CQ: {
    label: "Macro Index",
    whyPoints: [
      "Maximum diversification with no single-token dominance. 100 tokens capped at a maximum individual weight, rebalanced quarterly. True broad market exposure.",
      "The cap forces diversification beyond the largest two tokens. Tokens that hit the cap are trimmed; the remainder is distributed by market cap. Concentration risk is bounded by construction.",
      "Quarterly rebalancing minimizes turnover across 100 positions, keeping trading costs low while maintaining broad representation of the entire crypto market.",
    ],
    objective:
      "Holds 100 tokens with market-cap weighting capped at 10% per token, rebalanced quarterly. The cap prevents concentration while quarterly rebalancing minimizes turnover, producing broad crypto market exposure with controlled risk.",
  },
  MEGAMOM: {
    label: "Momentum Index",
    whyPoints: [
      "The mega-system: 50 tokens, 60-day dual momentum, FNG trigger, and BTC dominance switching. The broadest and most heavily overlaid momentum strategy in the catalog.",
      "Three overlays working together: momentum selects trends, FNG exits during panic, dominance switching rotates between BTC-heavy and alt-heavy regimes. No single overlay can accomplish what three do together.",
      "50 tokens provide broad sector coverage. Three overlays provide disciplined risk management. The combination captures trend across the entire market with regime-aware protection.",
    ],
    objective:
      "Applies 60-day dual momentum to 50 tokens with FNG trigger and BTC dominance switching, rebalanced weekly. The broadest and most heavily overlaid momentum strategy, combining trend selection with regime and sentiment awareness across the entire crypto market.",
  },
  YF30M: {
    label: "Founder Index",
    whyPoints: [
      "Founders under 30 build with urgency the market discounts as inexperience. Young builders gravitate toward AI and DeFi infrastructure, the sectors with the highest technical velocity.",
      "Momentum weighting across under-30 founder tokens, rebalanced biweekly. The methodology captures which young founders are winning now, not which ones exist.",
      "Age as a selection signal is unconventional. The thesis: founders in their twenties have fewer priors, iterate faster, and build for the current paradigm rather than the last one.",
    ],
    objective:
      "Applies 30-day momentum to tokens from founders aged under 30 at founding, rebalanced biweekly. Captures the urgency and technical velocity of young builder projects through systematic momentum selection.",
  },
  PB34: {
    label: "Founder Index",
    whyPoints: [
      "The 30-34 age bracket is the consensus sweet spot for crypto founding. These builders reach market recognition fastest, reflecting the age the market already trusts most.",
      "Equal weighting across 13 tokens from 30-34 founders ensures broad exposure to the bracket without concentrating in any single project. Monthly rebalancing keeps allocation current.",
      "The strength of this bracket, market trust, is also its limitation. The thesis is priced in more than any other age cohort. The index captures the consensus, not the edge.",
    ],
    objective:
      "Equally weights 13 tokens from founders aged 30-34 at founding, rebalanced monthly. Captures the age bracket with the fastest time to market recognition, reflecting the market's consensus view of peak builder productivity.",
  },
  PB34M: {
    label: "Founder Index",
    whyPoints: [
      "Market-cap weighted 30-34 bracket. Cap weighting naturally concentrates in the largest protocol from this age cohort, making it effectively a single-asset bet with diversified tail exposure.",
      "The 30-34 bracket produced several of the most valuable protocols in crypto. Market-cap weighting lets the market's valuation hierarchy determine the allocation.",
      "For investors who believe the peak-builder age thesis but want market-proportional exposure rather than equal weight, this is the cap-weighted expression of that conviction.",
    ],
    objective:
      "Weights 13 tokens from 30-34 founders by market cap, rebalanced monthly. The largest protocol from this age cohort dominates, making this effectively a concentrated bet with diversified exposure to the 30-34 age cohort.",
  },
  EF39: {
    label: "Founder Index",
    whyPoints: [
      "35-39 founders have survived at least one crash and built through it. The bracket where scar tissue meets remaining ambition, enough experience to navigate bear markets, enough drive to keep shipping.",
      "Equal weighting across 20 tokens provides the broadest founder-age basket, diversified across chains, DeFi, and infrastructure categories.",
      "Experience is an asset in crypto precisely because most participants lack it. Founders who have seen a cycle build differently than those who have not.",
    ],
    objective:
      "Equally weights 20 tokens from founders aged 35-39 at founding, rebalanced monthly. Captures the balance point where builders have enough cycle experience to navigate downturns and enough drive to keep building.",
  },
  VF44: {
    label: "Founder Index",
    whyPoints: [
      "Second-act founders. The 40-44 bracket includes people who left traditional finance, sold a startup, or had a full career before entering crypto. Domain expertise from a prior life.",
      "Equal weighting across 8 tokens ensures no single second-act founder dominates. The basket spans smart contracts, meme culture, L1 infrastructure, and DeFi lending.",
      "Late entry into crypto correlates with strong prior-domain expertise. These founders do not build for the ecosystem's approval, they build what they already know is missing.",
    ],
    objective:
      "Equally weights 8 tokens from founders aged 40-44 at founding, rebalanced monthly. Captures second-act founders who entered crypto with prior career experience in finance, technology, or entrepreneurship.",
  },
  ES45: {
    label: "Founder Index",
    whyPoints: [
      "45+ founders build infrastructure that lasts. The protocols built by people who remember life before the internet tend toward resilience over novelty.",
      "Equal weighting across 19 tokens. The bracket includes some of the most valuable assets in crypto, built by veteran technologists the market systematically underestimates.",
      "The market discounts older founders because crypto culture worships youth. The data disagrees. Veteran builders produce surprisingly resilient protocols.",
    ],
    objective:
      "Equally weights 19 tokens from founders aged 45 or older at founding, rebalanced monthly. Holds the protocols built by veteran technologists, capturing a demographic bracket the market consistently underestimates.",
  },
  ES45M: {
    label: "Founder Index",
    whyPoints: [
      "Market-cap weighted elders. The oldest founder in crypto built the most valuable protocol. Cap weighting makes this effectively a single-asset index with tail exposure to other veteran-founded projects.",
      "The 45+ bracket has produced the market's most valuable assets. Cap weighting lets that fact express itself fully in the allocation.",
      "For investors who believe in the elder-founder thesis but want exposure proportional to market valuation, this is the cap-weighted expression of veteran-builder conviction.",
    ],
    objective:
      "Weights 19 tokens from 45+ founders by market cap, rebalanced monthly. The largest protocol dominates, making this effectively a concentrated bet that adds exposure to other elder-founded protocols.",
  },
  USAM: {
    label: "Founder Index",
    whyPoints: [
      "Silicon Valley crypto. American-founded protocols benefit from US market access, regulatory familiarity, and proximity to the deepest capital pools in the world.",
      "Market-cap weighting concentrates in the largest American-founded protocols. The thesis is straightforward: US market access and technical talent create structural advantages.",
      "Geographic founder selection is a proxy for regulatory arbitrage, talent access, and market proximity. The US corridor dominates crypto founding for the same reasons it dominates tech.",
    ],
    objective:
      "Weights tokens from American founders by market cap, rebalanced monthly. Captures the Silicon Valley crypto corridor, concentrating in protocols with US market access and regulatory familiarity.",
  },
  ASIF: {
    label: "Founder Index",
    whyPoints: [
      "Asian founding teams bring different market access and regulatory arbitrage. They historically reach ATH faster than any other geographic cohort, reflecting the speed of Asian crypto retail markets.",
      "Equal weighting across 11 tokens provides broad exposure to Asian-founded projects spanning L1 infrastructure, cross-chain protocols, and privacy solutions.",
      "The fastest-moving crypto retail markets are in Asia. Founders with native access to these markets build with a speed and feedback loop that Western founders cannot replicate.",
    ],
    objective:
      "Equally weights 11 tokens from Asian founders, rebalanced monthly. Captures the market access and speed advantages of Asian founding teams, who historically reach peak market recognition faster than any other geographic cohort.",
  },
  EURF: {
    label: "Founder Index",
    whyPoints: [
      "European founders build under regulatory pressure that forces patience and rigor. In crypto, patience means building well, the protocols that survive regulation tend to outlast the ones that avoid it.",
      "Equal weighting across 17 tokens spanning L1s, DeFi, and infrastructure. European founders are distributed across more categories than any other geographic cohort.",
      "Regulation teaches discipline. European founders build more slowly but the resulting protocols tend to have stronger legal foundations and institutional credibility.",
    ],
    objective:
      "Equally weights 17 tokens from European founders, rebalanced monthly. Captures the regulatory patience advantage of European teams, who build more slowly but historically produce strong market performance.",
  },
  GBRF: {
    label: "Founder Index",
    whyPoints: [
      "The smallest national basket in the catalog. British-founded protocols are few but deeply ambitious, concentrated in storage, compute, and parachain infrastructure.",
      "Equal weighting across 4 tokens. The concentration is a feature: each position represents a distinct infrastructure thesis from the British engineering tradition.",
      "Four tokens is not diversification. It is a concentrated bet on a specific engineering culture that produces infrastructure projects with multi-decade technical ambition.",
    ],
    objective:
      "Equally weights 4 tokens from British founders, rebalanced monthly. The most concentrated national founder basket, holding infrastructure projects built with the persistence that British engineering culture selects for.",
  },
  STAN: {
    label: "Founder Index",
    whyPoints: [
      "Stanford produces crypto founders prolifically. The quantity, however, may dilute the edge, too many Stanford-pedigreed projects compete against each other for the same narrative space.",
      "6 tokens equally weighted from the Stanford pipeline. The basket spans data availability, identity, storage, and cross-chain infrastructure.",
      "The credential premium is an empirical question. This index tests whether Stanford's network effect compounds or dilutes when applied to a market that rewards differentiation.",
    ],
    objective:
      "Equally weights 6 tokens from Stanford-affiliated founders, rebalanced monthly. Tests the Ivy League founder premium hypothesis in a market where oversupply of similarly-pedigreed projects may dilute the credential edge.",
  },
  MITX: {
    label: "Founder Index",
    whyPoints: [
      "MIT founders tilt toward cryptography and formal methods. The institution selects for mathematical rigor, producing protocols with technically sound foundations.",
      "5 tokens equally weighted from MIT alumni. The basket spans consensus algorithms, marketplace infrastructure, and privacy solutions, all areas where formal training provides an edge.",
      "Rigor does not guarantee returns. But in a market where most protocols fail on technical fundamentals, MIT's selection for mathematical precision is a meaningful quality signal.",
    ],
    objective:
      "Equally weights 5 tokens from MIT-affiliated founders, rebalanced monthly. Captures the intersection of cryptographic rigor and blockchain infrastructure, holding protocols built by founders with formal training in the mathematics underlying crypto.",
  },
  HVRD: {
    label: "Founder Index",
    whyPoints: [
      "Harvard founders in crypto are rarer than expected. The institution's strengths, finance, governance, policy, produce fewer protocol builders but strong DeFi architects.",
      "The smallest Ivy basket. Harvard's network effect is real in TradFi but its translation to crypto is limited by the institution's distance from systems engineering.",
      "An honest test of whether Harvard's institutional prestige translates to crypto protocol value. The data is sparse enough that the answer remains genuinely uncertain.",
    ],
    objective:
      "Equally weights 3 tokens from Harvard-affiliated founders, rebalanced monthly. The leanest university basket, testing whether Harvard's institutional prestige translates to crypto protocol value.",
  },
  IVYX: {
    label: "Founder Index",
    whyPoints: [
      "11 tokens from Ivy League founders. The Ivy premium in crypto is real but modest, enough to outperform random selection, not enough to dominate.",
      "Equal weighting across Ivy-founded tokens spanning smart contracts, payments, rendering, DeFi, and infrastructure. The traditional prestige pipeline applied to a non-traditional market.",
      "Credentials provide network access and credibility in fundraising. Whether those advantages compound into protocol value is the question this index continuously answers.",
    ],
    objective:
      "Equally weights 11 tokens from Ivy League-affiliated founders, rebalanced monthly. Captures the modest but real Ivy premium in crypto, where institutional networks provide a small systematic edge.",
  },
  IVYM: {
    label: "Founder Index",
    whyPoints: [
      "Market-cap weighted Ivy founders. Cap weighting reveals that the Ivy premium concentrates in a few outsized winners rather than distributing evenly across the cohort.",
      "The largest Ivy-founded protocol dominates the allocation. The remaining tokens provide tail exposure but minimal weight, the power law in Ivy crypto is extreme.",
      "Equal weight vs. cap weight tells different stories about the same cohort. Cap weight reveals concentration; equal weight reveals breadth. This index chooses concentration.",
    ],
    objective:
      "Weights 11 tokens from Ivy League founders by market cap, rebalanced monthly. Reveals that the Ivy premium in crypto concentrates in a few outsized winners rather than distributing evenly.",
  },
  CSFI: {
    label: "Founder Index",
    whyPoints: [
      "Founders from Stanford, MIT, CMU, Berkeley, Caltech, Georgia Tech, and Waterloo. The institutions that teach systems engineering produce founders who build protocol-level infrastructure.",
      "Equal weighting across 16 tokens spanning every chain category. The broadest academic basket, testing whether elite CS education produces a measurable founder quality signal.",
      "Systems engineering training translates directly to blockchain architecture. The index captures this translation across the full spectrum of top CS programs.",
    ],
    objective:
      "Equally weights 16 tokens from founders affiliated with top computer science programs, rebalanced monthly. Captures the engineering rigor that elite CS education provides, applied as a systematic founder quality signal.",
  },
  CSMM: {
    label: "Founder Index",
    whyPoints: [
      "Momentum weighting across CS school alumni projects. Ride the technically sound winners among the academic pipeline, the projects built with rigor that the market is currently rewarding.",
      "30-day momentum across 16 CS-alumni tokens, rebalanced biweekly. The momentum filter identifies which academically rigorous projects are breaking through commercially right now.",
      "Quality without timing is patience. Momentum without quality is gambling. This index demands both, technical founder pedigree confirmed by current market trend.",
    ],
    objective:
      "Applies 30-day momentum to 16 tokens from top CS school founders, rebalanced biweekly. Combines the quality signal of elite CS education with momentum timing, riding the academically rigorous projects currently trending.",
  },
  WATO: {
    label: "Founder Index",
    whyPoints: [
      "The Waterloo-Toronto research corridor produced the most valuable crypto asset and continues to generate high-impact blockchain projects. Geographic clustering in research creates compounding talent effects.",
      "5 tokens equally weighted from the Waterloo-Toronto pipeline. The corridor's output spans smart contracts, L1 infrastructure, AI, identity, and cross-chain protocols.",
      "Academic research corridors produce disproportionate innovation in specific fields. For crypto, the Waterloo-Toronto axis is the most productive corridor per capita.",
    ],
    objective:
      "Equally weights 5 tokens from Waterloo and Toronto-affiliated founders, rebalanced monthly. Captures the research corridor that produced Ethereum and continues to generate high-impact blockchain projects.",
  },
  CRNL: {
    label: "Founder Index",
    whyPoints: [
      "Cornell's IC3 lab shaped the theoretical foundations of DeFi and MEV research. The academic-industrial pipeline translates directly into protocol design.",
      "4 tokens equally weighted from Cornell-affiliated founders. The institution's blockchain research program has influenced protocol architecture across the industry.",
      "Academic labs that produce both papers and founders create a rare feedback loop. Cornell's IC3 is the clearest example of this loop in crypto.",
    ],
    objective:
      "Equally weights 4 tokens from Cornell-affiliated founders, rebalanced monthly. Captures the academic-industrial pipeline from Cornell's IC3 lab, which shaped the theoretical foundations of DeFi and MEV research.",
  },
  DROP: {
    label: "Founder Index",
    whyPoints: [
      "No-degree founders return the highest multiples of any education bracket. Dropouts and autodidacts build with nothing to fall back on. That desperation is the alpha.",
      "35 tokens equally weighted, the broadest founder basket in the catalog. Autodidacts build in every category because no curriculum directed them elsewhere.",
      "The anti-credential thesis is empirically supported. The data shows no-degree founders outperform Ivy League founders, likely because the absence of a safety net selects for conviction.",
    ],
    objective:
      "Equally weights 35 tokens from founders without traditional degrees, rebalanced monthly. Captures the highest-returning education bracket in crypto, where the absence of institutional safety nets selects for builders who ship under pressure.",
  },
  DRMO: {
    label: "Founder Index",
    whyPoints: [
      "Momentum among no-degree founders. The autodidacts who are winning right now, not just the ones who exist. Momentum separates active shipping from historical presence.",
      "30-day momentum across 35 no-degree tokens, rebalanced biweekly. The broadest momentum universe in the founder catalog, applied to the highest-performing education bracket.",
      "The no-degree bracket is large enough that momentum filtering adds genuine signal. 35 tokens provide enough selection pressure for trend-following to separate winners from survivors.",
    ],
    objective:
      "Applies 30-day momentum to 35 tokens from no-degree founders, rebalanced biweekly. Combines the structural alpha of the dropout bracket with systematic trend selection, identifying which autodidact-built projects the market currently rewards.",
  },
  NVIY: {
    label: "Founder Index",
    whyPoints: [
      "The anti-prestige trade. No-degree founders outperform Ivy League teams by a significant margin to ATH. The gap is wide enough to be investable, not just anecdotal.",
      "20 no-degree tokens equally weighted, rebalanced biweekly. The basket includes some of the most valuable assets in crypto, built by founders who never graduated.",
      "Credentials are a liability when the market rewards speed and conviction over institutional approval. This index bets on that structural disadvantage of prestige.",
    ],
    objective:
      "Equally weights 20 tokens from no-degree founders, rebalanced biweekly. The investable expression of the anti-prestige thesis, where dropout-founded projects systematically outperform Ivy League ones.",
  },
  DENG: {
    label: "Founder Index",
    whyPoints: [
      "German-founded protocols share a characteristic precision in their technical architecture. Three tokens spanning payments, data indexing, and modular infrastructure.",
      "Equal weighting across 3 tokens. The small basket size means each position represents a distinct infrastructure thesis from a culture that values engineering discipline.",
      "Engineering culture matters in protocol design. German founding teams tend toward infrastructure that prioritizes correctness over speed to market, a trade-off that compounds over years.",
    ],
    objective:
      "Equally weights 3 tokens from German-affiliated founders, rebalanced monthly. Captures the engineering culture of precision and rigor applied to blockchain infrastructure across payments, data indexing, and modular architecture.",
  },
  CNFI: {
    label: "Founder Index",
    whyPoints: [
      "Chinese founders reach ATH faster than any other nationality. The efficiency of a market that does not wait, applied to protocol founding.",
      "Equal weighting across 5 tokens spanning infrastructure for the most active crypto retail market in the world. Chinese founding teams build for speed and scale.",
      "Speed to market recognition is a measurable advantage. Chinese founders achieve it consistently, suggesting a structural edge in market access and execution velocity.",
    ],
    objective:
      "Equally weights 5 tokens from Chinese founders, rebalanced monthly. Captures the speed and efficiency of Chinese founding teams, who historically reach peak market recognition faster than any other nationality.",
  },
  BERK: {
    label: "Founder Index",
    whyPoints: [
      "Berkeley's crypto researchers have influenced consensus algorithms, staking infrastructure, and payments protocols. The public university that rivals any Ivy for protocol-level impact.",
      "Equal weighting across 3 Berkeley-affiliated tokens. The basket spans consensus, staking, and payments, all areas where Berkeley's research program has produced foundational work.",
      "Public university research creates open intellectual commons that private institutions cannot. Berkeley's contributions to crypto are disproportionate to its visibility in founder narratives.",
    ],
    objective:
      "Equally weights 3 tokens from UC Berkeley-affiliated founders, rebalanced monthly. Captures the public university's outsized influence on crypto infrastructure, from consensus research to staking and payments protocols.",
  },
  OZFI: {
    label: "Founder Index",
    whyPoints: [
      "The Australian contribution to crypto is eclectic, controversial, and entertaining. Three tokens spanning Bitcoin forks, meme culture, and gaming infrastructure.",
      "Equal weighting across 3 Australian-founded tokens. The diversity of the basket reflects Australia's position as a crypto market large enough to produce founders but small enough to force global ambition.",
      "Australian founders build for export by necessity. A small domestic market means every project must compete globally from day one, a selection pressure that shapes the resulting protocols.",
    ],
    objective:
      "Equally weights 3 tokens from Australian founders, rebalanced monthly. Captures the eclectic range of Australian contributions to crypto, from Bitcoin forks to meme culture to blockchain gaming.",
  },
  CANF: {
    label: "Founder Index",
    whyPoints: [
      "Canadian founders span privacy-first browsing, L1 consensus innovation, and decentralized AI. Three tokens from a country that produces fewer crypto projects but invests deeply in technical ambition.",
      "Equal weighting across 3 tokens. Canada's contribution to crypto is narrow but technically deep, concentrated in areas where research intensity matters more than market speed.",
      "The Canadian corridor produces founders who prioritize technical correctness. In infrastructure categories, that priority translates to protocols that age well.",
    ],
    objective:
      "Equally weights 3 tokens from Canadian founders, rebalanced monthly. Captures the Canadian corridor's technical ambition across privacy-first browsing, L1 consensus innovation, and decentralized AI.",
  },
  AGSP: {
    label: "Founder Index",
    whyPoints: [
      "Teams with wide age spreads between co-founders produce the highest ATH multiplier of any demographic signal in the research. Intergenerational teams combine veteran wisdom with youthful urgency.",
      "The FNG quality rotation overlay shifts between equal weight and quality-tilted allocation during fear. Sentiment awareness applied to the strongest demographic signal available.",
      "Age diversity in founding teams is an unconventional selection criterion. The data supports it strongly enough to build an index around it, wisdom and urgency are complementary, not competing.",
    ],
    objective:
      "Holds tokens from founding teams with 10-19 year age spreads, with FNG quality rotation overlay and monthly rebalancing. Captures the highest demographic signal in the research: intergenerational teams that combine veteran wisdom with youthful urgency.",
  },
  NDFQ: {
    label: "Founder Index",
    whyPoints: [
      "No-degree founders with FNG quality rotation. When fear strikes, the strategy concentrates in the highest-quality dropout-founded projects, the blue chips of the anti-credential thesis.",
      "The FNG rotation shifts allocation during fear because autodidacts keep building through downturns. They have no safety net to retreat to, which is both their vulnerability and their strength.",
      "Quality rotation adds a defensive layer to the no-degree thesis. During greed, broad exposure captures the full bracket. During fear, concentration in proven survivors preserves capital.",
    ],
    objective:
      "Holds 35 tokens from no-degree founders with Fear & Greed quality rotation, rebalanced biweekly. During fear, concentrates in the highest-quality dropout-founded projects; during greed, spreads across the full universe.",
  },
  SERI: {
    label: "Founder Index",
    whyPoints: [
      "Founders who built and sold before. Repeat founders apply pattern recognition from prior exits to new protocol design. Experience compounds in crypto as everywhere else.",
      "Equal weighting across 33 serial-founder tokens, the broadest professional-experience basket. Serial founders build in every category because their edge is process, not domain.",
      "The repeat-founder premium exists because building a protocol is less about technical novelty and more about execution under uncertainty. Second-time founders have calibrated their judgment.",
    ],
    objective:
      "Equally weights 33 tokens from repeat founders, rebalanced monthly. Captures the experience premium of serial entrepreneurs who have built and exited before, applying pattern recognition to blockchain projects.",
  },
  SEMO: {
    label: "Founder Index",
    whyPoints: [
      "Momentum among serial founders. Ride the winners from people who have won before, the intersection of experience and current market validation.",
      "30-day momentum across 33 serial-founder tokens, rebalanced biweekly. The momentum filter identifies which repeat builders are shipping products the market currently values.",
      "Serial founders who are also trending up represent a double signal: proven execution ability meeting current market demand. The combination is selective and powerful.",
    ],
    objective:
      "Applies 30-day momentum to 33 tokens from serial founders, rebalanced biweekly. Combines the quality signal of repeat entrepreneurship with systematic trend selection, overweighting the serial builders whose projects the market currently rewards.",
  },
  STLM: {
    label: "Founder Index",
    whyPoints: [
      "Stealth founders weighted by market cap. The protocols that grew without a founder publicity tour, where the product spoke before the founder did.",
      "Cap weighting means the biggest stealth-founded protocols dominate. The information asymmetry advantage of building in obscurity compounds once the market discovers the product.",
      "Low founder visibility correlates with product-first development culture. The market eventually finds these protocols, and cap weighting captures the ones it has valued most.",
    ],
    objective:
      "Weights 36 tokens from low-visibility founders by market cap, rebalanced monthly. Captures the information asymmetry advantage of protocols that grew without founder publicity, where market attention arrives after the product is built.",
  },
  STMO: {
    label: "Founder Index",
    whyPoints: [
      "Momentum among stealth founders. When a protocol from an invisible founder starts moving, the information asymmetry is maximum, the market is discovering something others have not noticed.",
      "30-day momentum across 36 stealth-founder tokens, rebalanced biweekly. Momentum applied to low-visibility projects captures the discovery phase before consensus forms.",
      "Stealth plus momentum equals surprise. The combination identifies protocols at the moment they transition from obscurity to recognition, the highest-alpha window in any asset's lifecycle.",
    ],
    objective:
      "Applies 30-day momentum to 36 tokens from low-visibility founders, rebalanced biweekly. Exploits the information asymmetry of stealth-built protocols by detecting when unknown projects start trending before the market pays full attention.",
  },
  HIVI: {
    label: "Founder Index",
    whyPoints: [
      "Founders with sustained public presence. The names that move markets through podcast appearances, conference keynotes, and media visibility. Narrative amplification as an investable signal.",
      "Equal weighting across 9 high-visibility tokens. The protocols whose founders have earned market attention through consistent public engagement over years, not viral moments.",
      "Founder visibility sustains community engagement and market attention. In crypto, where narratives drive price cycles, sustained visibility is a structural advantage.",
    ],
    objective:
      "Equally weights 9 tokens from founders with high public visibility, rebalanced monthly. Captures the narrative amplification effect of high-profile founders, where sustained public presence sustains community engagement.",
  },
  GOOG: {
    label: "Founder Index",
    whyPoints: [
      "Ex-Googlers who left to build decentralized systems. Google trains you to think in systems at scale, that training transfers directly to blockchain infrastructure design.",
      "Equal weighting across tokens from Google alumni. The basket concentrates in protocol-level infrastructure and AI because Google's engineering culture produces systems thinkers, not application builders.",
      "Big-tech alumni bring operational discipline and scale mentality. The trade-off: they sometimes over-engineer for a market that rewards shipping speed over architectural elegance.",
    ],
    objective:
      "Equally weights tokens from founders who worked at Google, rebalanced monthly. Captures the systems-thinking discipline that Google engineering culture instills, applied to decentralized infrastructure and AI protocols.",
  },
  META: {
    label: "Founder Index",
    whyPoints: [
      "The Diem diaspora. Engineers who tried to build crypto inside Facebook and now build it outside. They carried their technology, particularly the Move language, out the door.",
      "Equal weighting across 4 ex-Meta tokens. The Move language ecosystem dominates because the Diem team's technical contributions outlived the corporate project.",
      "Corporate crypto projects fail. But the engineers who built them carry institutional knowledge about scale, compliance, and user experience that independent founders lack.",
    ],
    objective:
      "Equally weights 4 tokens from founders who worked at Meta, rebalanced monthly. Captures the Diem diaspora: engineers who built Libra/Diem inside Facebook and now apply that experience to independent blockchain projects.",
  },
  PHDI: {
    label: "Founder Index",
    whyPoints: [
      "PhD teams build infrastructure that lasts decades. Doctorate holders gravitate toward consensus algorithms and cryptographic primitives, the deepest layers of the stack.",
      "Equal weighting across 8 PhD-founded tokens. The basket is heavy on L1 infrastructure because PhDs solve the hardest problems, which happen to live at the protocol layer.",
      "PhDs may not produce the fastest returns. But the protocols they build tend to survive because the underlying mathematics is correct, not merely functional.",
    ],
    objective:
      "Equally weights 8 tokens from PhD-holding founders, rebalanced monthly. Captures the durability premium of academically rigorous infrastructure, where protocols built by researchers with formal cryptographic training tend to survive longer.",
  },
  MBAM: {
    label: "Founder Index",
    whyPoints: [
      "MBA founders weighted by market cap. The protocols built by founders who read balance sheets and think in unit economics. Business acumen as a founder selection signal.",
      "Cap weighting concentrates in the largest MBA-founded smart contract platforms. MBA founders tend to build for adoption and revenue, not just technical elegance.",
      "The MBA premium is real but specific: it shows up in protocols that require business model innovation, not just cryptographic novelty. Cap weighting reveals where that premium concentrates.",
    ],
    objective:
      "Weights 11 tokens from MBA-holding founders by market cap, rebalanced monthly. Captures the business acumen premium, concentrating in protocols built by founders who combine technical understanding with financial and operational training.",
  },
  MILF: {
    label: "Founder Index",
    whyPoints: [
      "Founders with military or intelligence backgrounds bring discipline, operational security, and comfort with controlled chaos. Skills that translate directly to protocol design under adversarial conditions.",
      "Equal weighting across 14 tokens. The broadest professional-background basket, spanning L1s, DeFi, AI, and meme culture, military founders build across the full spectrum.",
      "Operational discipline is undervalued in a market that celebrates improvisation. Founders who planned operations under uncertainty apply that same rigor to protocol architecture.",
    ],
    objective:
      "Equally weights 14 tokens from founders with military or intelligence backgrounds, rebalanced monthly. Captures the operational discipline and security mindset that military training instills, applied across the full spectrum of crypto infrastructure.",
  },
  MNAT: {
    label: "Founder Index",
    whyPoints: [
      "Founding teams with 2+ nationalities consistently outperform homogeneous ones. Diversity of geographic perspective creates compound advantages in regulatory arbitrage and market access.",
      "Equal weighting across 20 multinational tokens, the most geographically diverse founder basket in the catalog. Different regulatory experiences and market access stack multiplicatively.",
      "Multinational teams are not a diversity thesis. They are an information advantage thesis. Each nationality on the team opens a market, a regulatory path, and a talent pool.",
    ],
    objective:
      "Equally weights 20 tokens from multinational founding teams, rebalanced monthly. Captures the ATH multiplier advantage of teams with diverse geographic backgrounds, where different regulatory experiences and market access create compound advantages.",
  },
  USIN: {
    label: "Founder Index",
    whyPoints: [
      "American founders paired with international co-founders. US market access combined with global technical talent, the partnership thesis where distribution meets engineering.",
      "Equal weighting across 12 tokens. The basket captures the specific synergy of American regulatory familiarity and fundraising access combined with international technical depth.",
      "Neither purely American nor purely international teams produce this combination. The partnership structure creates advantages that homogeneous teams on either side cannot replicate.",
    ],
    objective:
      "Equally weights 12 tokens from founding teams combining American and international founders, rebalanced monthly. Captures the partnership premium where US market access and regulatory familiarity combine with global technical depth.",
  },
  IMMG: {
    label: "Founder Index",
    whyPoints: [
      "Founders building outside their home country. Immigration selects for risk tolerance, and risk tolerance selects for crypto founders. The most personal founder signal in the catalog.",
      "Equal weighting across 14 immigrant-founded tokens. Crossing borders before crossing industries selects for the willingness to bet on the unknown, a trait crypto demands.",
      "The immigrant founder premium is not about geography. It is about self-selection. People who uproot their lives to build in a foreign country have already demonstrated the conviction that crypto requires.",
    ],
    objective:
      "Equally weights 14 tokens from founders who built outside their home country, rebalanced monthly. Captures the risk tolerance premium of immigrant founders, where crossing borders before crossing industries selects for willingness to bet on the unknown.",
  },
  IMMM: {
    label: "Founder Index",
    whyPoints: [
      "Immigrant founders by market cap. The immigrant premium concentrates in a few giants, cap weighting reveals the extreme power law within this cohort.",
      "The largest immigrant-founded protocol dominates the allocation. The remaining tokens provide tail exposure but minimal weight, revealing how concentrated the immigrant success story is.",
      "For investors who believe in the immigrant founder thesis but want market-proportional expression, cap weighting lets the market's valuation hierarchy determine allocation.",
    ],
    objective:
      "Weights 14 tokens from immigrant founders by market cap, rebalanced monthly. Reveals that the immigrant founder premium concentrates in a few outsized winners rather than distributing evenly across the cohort.",
  },
  TRFI: {
    label: "Founder Index",
    whyPoints: [
      "Alumni of major banks who defected to crypto. They know what they are replacing, the domain expertise of insiders who understood the financial system's flaws from within.",
      "Equal weighting across 3 ex-TradFi tokens. The smallest professional-background basket, concentrated in infrastructure that bridges traditional and decentralized finance.",
      "TradFi defectors build differently than crypto natives. They optimize for compliance, institutional adoption, and interoperability with existing financial infrastructure.",
    ],
    objective:
      "Equally weights 3 tokens from founders who left traditional finance, rebalanced monthly. Captures the domain expertise of bankers and traders who understood the financial system's flaws from inside and now build its replacement.",
  },
  SRFQ: {
    label: "Founder Index",
    whyPoints: [
      "Serial entrepreneurs with FNG quality rotation. The strongest combined founder-sentiment strategy. During fear, the quality rotation concentrates in proven serial-founder projects.",
      "The FNG overlay trusts serial founders' survival instinct. Repeat builders who have navigated downturns before conserve capital instinctively, the rotation mirrors that instinct.",
      "Quality rotation adds a defensive dimension to the serial-founder thesis. Broad exposure during greed captures upside; concentration during fear preserves it.",
    ],
    objective:
      "Holds 33 tokens from serial founders with Fear & Greed quality rotation, rebalanced biweekly. During fear, concentrates in the highest-quality serial-founder projects; during greed, spreads across the full universe of repeat-builder tokens.",
  },
  FDMO: {
    label: "Founder Index",
    whyPoints: [
      "Ex-FAANG founders with momentum. These founders left the most comfortable jobs in tech. When their protocols gain momentum, the market validates the leap they took.",
      "30-day momentum across 11 ex-FAANG tokens, rebalanced biweekly. The career-risk premium: founders who sacrificed FAANG compensation to build in crypto carry a different intensity.",
      "Big-tech defectors bring institutional engineering discipline. Momentum confirms when that discipline produces a product the market recognizes, the validation phase of the career bet.",
    ],
    objective:
      "Applies 30-day momentum to 11 tokens from ex-FAANG founders, rebalanced biweekly. Captures the career-risk premium of founders who left secure big-tech positions, overweighting the ones whose protocols the market currently validates.",
  },
  MNMO: {
    label: "Founder Index",
    whyPoints: [
      "Multinational teams riding momentum. Global teams ship globally, and when they move, the move is cross-market. Momentum captures the moment multinational coordination produces results.",
      "30-day momentum across 20 multinational tokens, rebalanced biweekly. The geographic diversity of the founding teams creates multiple market catalysts that can trigger momentum independently.",
      "Multinational teams access multiple markets simultaneously. When momentum confirms, the price action reflects adoption across geographies rather than a single market's enthusiasm.",
    ],
    objective:
      "Applies 30-day momentum to 20 tokens from multinational founding teams, rebalanced biweekly. Combines the ATH multiplier advantage of diverse teams with systematic trend selection, overweighting multinational projects gaining market traction.",
  },
}
