// ITP page content for the current 97-ITP roster.
// Maps ticker -> { whyPoints, objective, label }. The lookup chain is:
// itpId (hex) -> itp-id-names.json -> ticker -> this file.

export const ITP_PAGE_CONTENT: Record<string, {
  whyPoints: string[]
  objective: string
  label: string
}> = {
  BRDG: {
    label: "Sector Index",
    whyPoints: [
      "Every new chain creates demand for the rails between chains. Bridge protocols collect a toll on every asset that has to move from one place to another. The toll grows with fragmentation.",
      "Market-cap weighted across the top cross-chain communication tokens. The largest protocols earn proportionally larger weight because depositor capital is the only honest signal of trust.",
      "Picking one bridge means picking one bet on which messaging standard wins. The basket lets the market pick. The right answer changes; the index changes with it.",
    ],
    objective:
      "Tracks the leading cross-chain communication protocols by market cap. Captures the toll economics of multi-chain asset movement without committing to any single messaging standard.",
  },
  RWA: {
    label: "Sector Index",
    whyPoints: [
      "Tokenization sits at the seam between two markets that historically refused to speak. The protocols stitching them together are pricing infrastructure that has not yet been priced.",
      "Market-cap weighted across the top RWA protocols. Concentration in issuance and infrastructure leaders, with tail exposure to the platforms that have not yet won.",
      "Buying a single RWA token is betting on one corner of the migration. The basket buys the migration itself.",
    ],
    objective:
      "Holds the top RWA tokenization protocols by market cap. Captures the slow movement of treasuries, credit, and real estate from off-chain custody to on-chain rails.",
  },
  MEMES: {
    label: "Sector Index",
    whyPoints: [
      "Memes are the only asset class where attention is the fundamental. Cap-weighted memecoins concentrate in the jokes that have already survived the first laugh.",
      "Market-cap weighting is honest about meme economics. The biggest memes already escaped extinction; the small ones mostly will not. Survivor bias is the strategy.",
      "Memecoins follow extreme power laws. A concentrated cap-weighted basket captures the head of the distribution and rotates as the cultural winners change.",
    ],
    objective:
      "Holds the largest memecoins by market cap. Bets that meme survival is path-dependent and that the biggest jokes today will outlast tomorrow's newcomers.",
  },
  L1S: {
    label: "Sector Index",
    whyPoints: [
      "Layer-one chains are the substrate every application sits on. Owning the top L1s is owning the floor under the entire industry.",
      "Market-cap weighting reflects where settlement actually happens. The chain with the most economic activity earns the most weight; everything else is opinion.",
      "Application-layer winners change every cycle. The base layer changes more slowly. The basket holds the slow-moving part of the stack.",
    ],
    objective:
      "Tracks the leading layer-one settlement chains by market cap. Captures the structural economics of the chains where applications choose to live.",
  },
  MOVE: {
    label: "Strategy Index",
    whyPoints: [
      "The simplest momentum signal: hold what just moved. Performance over the trailing window does the selection; conviction comes later.",
      "Top movers by trailing return, rebalanced often enough to catch rotation. The strategy is willing to look stupid right before it looks smart.",
      "Momentum works because attention is sticky. The tokens the market has just rewarded keep being rewarded — until they suddenly do not.",
    ],
    objective:
      "Selects the top trailing-return tokens and rebalances on a short cycle. Captures the persistence in price momentum that survives even when the names change.",
  },
  DEFI: {
    label: "Sector Index",
    whyPoints: [
      "DeFi is the one part of crypto where the cash flows are visible. Fee revenue, TVL, lending volume — the protocols print receipts.",
      "Market-cap weighted across the leading DeFi blue chips. The weighting follows where capital has already chosen to settle.",
      "Picking a single DeFi winner means picking a single primitive. The basket holds the primitives — exchanges, lenders, derivatives — together.",
    ],
    objective:
      "Holds the leading DeFi protocols by market cap, rebalanced on a regular cycle. Captures the on-chain financial system as a sector rather than as a series of single bets.",
  },
  PERP: {
    label: "Sector Index",
    whyPoints: [
      "Perpetual futures are the highest-volume product in crypto. The DEXes that host them collect a fee on every flip of leverage.",
      "Market-cap weighting concentrates in the perp DEXes that already hold market share. Volume is the moat; the moat compounds.",
      "Centralized exchanges keep the bulk of perp volume — for now. The on-chain venues are taking it back, basis point by basis point.",
    ],
    objective:
      "Tracks the leading on-chain perpetual futures DEXes by market cap. Captures the slow migration of leverage from centralized order books to permissionless ones.",
  },
  STDY: {
    label: "Risk Index",
    whyPoints: [
      "Selecting the lowest-volatility tokens in a market that worships volatility. The factor premium that worked in equities for decades has not been tested here.",
      "The bottom of the volatility distribution gravitates toward stablecoins, large caps, and yield-bearing wrappers. The selection is defensive by construction.",
      "Crypto rewards conviction in violent assets. The index does the opposite — and gets paid for the discomfort.",
    ],
    objective:
      "Selects the lowest-volatility tokens across the market over a trailing window, rebalanced regularly. Tests whether the low-volatility anomaly survives in an asset class built for the opposite.",
  },
  DCOUP: {
    label: "Risk Index",
    whyPoints: [
      "Crypto correlations collapse to one in stress. The tokens that hold their independence are the ones worth holding when everything else moves together.",
      "Selection by trailing correlation to BTC, lowest first. The basket tilts toward DePIN, prediction markets, and niche infrastructure where the price has its own reasons.",
      "A portfolio with one source of variance is one bet. This is the part of crypto that does not move when BTC moves.",
    ],
    objective:
      "Selects tokens with the lowest trailing correlation to BTC, rebalanced monthly. Captures the part of the market that has decoupled from the dominant cycle.",
  },
  BUILD: {
    label: "Founder Index",
    whyPoints: [
      "Repeat founders compound. The second protocol benefits from every mistake the first one made — and from the operator network the first one built.",
      "Filter to projects whose founders have shipped before. Market-cap weighted within the filter. The cohort is small; the cohort is also where most of the survivorship happens.",
      "Founders without a track record are a coin flip. Founders with one have a distribution skewed toward the right. The basket buys the skew.",
    ],
    objective:
      "Holds protocols whose founders have shipped previous projects, weighted by market cap. Captures the structural advantage of operators who have already failed and learned.",
  },
  MSEC: {
    label: "Sector Index",
    whyPoints: [
      "Restaking turns staked capital into a market. The chains that need security can rent it; the validators that have it can sell it.",
      "TVL-weighted across liquid restaking governance tokens. The market deposits where it trusts; the index follows the deposits.",
      "Modular chains will keep multiplying. Each one needs validators it cannot afford to recruit alone. The shared-security thesis is structural, not narrative.",
    ],
    objective:
      "Tracks liquid restaking governance tokens weighted by TVL, rebalanced monthly. Captures the marketplace forming around shared validation as modular chains proliferate.",
  },
  SELF: {
    label: "Founder Index",
    whyPoints: [
      "Self-taught founders did not have the option of risk aversion. The protocols they ship carry the urgency of people who had no fallback.",
      "Filter to founders without formal CS degrees, market-cap weighted within. The selection skews toward DeFi and infrastructure — the parts of crypto built before the curriculum existed.",
      "Credentials predict average outcomes. They predict the tails poorly. The tails are where compounding lives.",
    ],
    objective:
      "Holds protocols whose founders are self-taught engineers without formal computer-science degrees, weighted by market cap. Tests whether the absence of credentials is the signal credentialed allocators consistently miss.",
  },
  PRED: {
    label: "Sector Index",
    whyPoints: [
      "Prediction markets price truth in a way polls cannot. The protocols that host them collect a fee on every disagreement.",
      "Market-cap weighted across the leading prediction-market platforms. Volume on these venues lives in cycles — election years, sports seasons, regulatory inflections.",
      "The category was a graveyard for a decade. Then it worked. Owning the survivors is owning the lesson.",
    ],
    objective:
      "Tracks the leading prediction-market protocols by market cap. Captures the venue economics of platforms that turned binary disagreement into a tradeable asset.",
  },
  BUILD2: {
    label: "Founder Index",
    whyPoints: [
      "A second basket of repeat-founder protocols, deeper than the first cut. Reaches into projects whose founders shipped less televised wins.",
      "Wider filter, longer rebalance cycle. The thesis is identical to the first cohort; the bench is broader.",
      "Repeat founders below the headline tier. The compounding still applies; the visibility lags.",
    ],
    objective:
      "A second cohort of protocols led by repeat founders, broader than the headline basket. Captures the long tail of operators whose track record has not yet been priced.",
  },
  CSCH: {
    label: "Education Index",
    whyPoints: [
      "Top computer-science programs cluster certain kinds of engineering taste. The protocols that emerge from them carry that taste in their codebases.",
      "Filter to founders from the leading CS programs, market-cap weighted within. The selection tilts toward infrastructure and language-design heavy projects.",
      "The school is a proxy for an early peer network — the early hires, the technical advisors, the first round of capital. The proxy holds longer than it should.",
    ],
    objective:
      "Holds protocols whose founders graduated from leading computer-science programs, weighted by market cap. Captures the structural advantage of early peer networks formed in dense engineering environments.",
  },
  STDY2: {
    label: "Risk Index",
    whyPoints: [
      "A second pass at the low-volatility factor — different lookback, deeper basket. The smoother equity curve at the cost of slower regime switches.",
      "Selection extended further down the volatility distribution. The constituent set leans more conservative than the headline cohort.",
      "Volatility is path-dependent in crypto. A second basket with different parameters is a hedge against the choice of parameters.",
    ],
    objective:
      "A second cohort of low-volatility tokens with a deeper basket and longer lookback. Tests whether parameter choice matters more than the factor itself.",
  },
  AINT: {
    label: "Sector Index",
    whyPoints: [
      "Crypto×AI is the rare narrative where the underlying technology is moving faster than the speculation. The infrastructure tokens are pricing a future the spot market has not finished imagining.",
      "Market-cap weighted across the leading AI-related crypto tokens. The basket spans compute, data, and agent infrastructure.",
      "Half of these projects will not exist in two years. The other half will be the floor of the category. The basket survives the half-life.",
    ],
    objective:
      "Tracks the leading AI-adjacent crypto protocols by market cap, rebalanced monthly. Captures the convergence of crypto incentives and AI compute, training, and agent infrastructure.",
  },
  SELF2: {
    label: "Founder Index",
    whyPoints: [
      "A second cohort of self-taught founders, reaching deeper into the long tail. Names that have shipped without the credential filter and without the headline coverage.",
      "Wider filter, smaller average market cap. The asymmetric upside lives below the headline tier.",
      "The first basket has the survivors. This one has the compounders that have not yet been recognized.",
    ],
    objective:
      "A second cohort of self-taught founder protocols, deeper than the headline basket. Captures the long tail of uncredentialed engineers building systems credentialed allocators have not yet read.",
  },
  PEAK: {
    label: "Founder Index",
    whyPoints: [
      "The peak entrepreneurial age sits in the mid-thirties to mid-forties. Founders in that window have enough scar tissue to avoid the easy mistakes and enough energy to make the hard ones.",
      "Filter to founders within the peak-age window, market-cap weighted. The basket selects against both inexperience and burnout.",
      "Both ends of the age distribution underperform. The middle is where execution lives. The middle is where the basket lives.",
    ],
    objective:
      "Holds protocols whose founders fall within the peak entrepreneurial age window, weighted by market cap. Captures the structural advantage of operators who have learned but not yet tired.",
  },
  STLTH: {
    label: "Founder Index",
    whyPoints: [
      "Stealth-mode protocols are priced before the marketing arrives. The tokens are illiquid, the documentation is partial, and the asymmetry is real.",
      "Filter to projects still in stealth or pre-public phase, market-cap weighted within. The basket carries explicit information risk in exchange for time premium.",
      "Most stealth projects fail. The ones that emerge tend to emerge violently. The basket is built for the tails.",
    ],
    objective:
      "Holds protocols still in stealth or pre-public development, weighted by market cap. Captures the asymmetric returns of early-cycle exposure at the cost of explicit information risk.",
  },
  CATEC: {
    label: "Geographic Index",
    whyPoints: [
      "Canadian tech runs on cheap engineering talent and a weaker currency than its capital sources. The cost structure produces protocols that survive longer per dollar raised.",
      "Filter to Canadian-headquartered crypto projects, market-cap weighted within. The basket overlaps strongly with Toronto, Vancouver, and Montreal engineering ecosystems.",
      "Canada's regulatory regime is friendlier than the United States and stricter than Europe. The middle path produces protocols built for both.",
    ],
    objective:
      "Holds protocols led by Canadian-based founding teams, weighted by market cap. Captures the cost-structure advantage of teams building from a high-quality, lower-capital ecosystem.",
  },
  IMMIG: {
    label: "Founder Index",
    whyPoints: [
      "Immigrant founders self-select for tolerance to displacement. The protocols they ship inherit the same comfort with the uncertain.",
      "Filter to founders building outside their country of origin, market-cap weighted within. The cohort overlaps with global teams but is selected on the founder, not the team.",
      "The decision to immigrate is itself a startup. The second startup tends to feel familiar.",
    ],
    objective:
      "Holds protocols whose founders are immigrants — building outside their country of origin — weighted by market cap. Captures the founder selection effect of voluntary displacement.",
  },
  VET: {
    label: "Founder Index",
    whyPoints: [
      "Veteran founders have shipped through more than one cycle. The protocols they build assume the cycle exists; the design reflects the assumption.",
      "Filter to founders with a decade or more of operating experience, market-cap weighted within. The basket skews toward infrastructure and against narrative.",
      "Experience does not predict the next product. It predicts how the team handles the moments when the product is wrong.",
    ],
    objective:
      "Holds protocols led by founders with extensive prior operating experience, weighted by market cap. Captures the structural advantage of teams that have already lived through a market they expected to end.",
  },
  GLOBE: {
    label: "Founder Index",
    whyPoints: [
      "Globally distributed teams hire from outside the salary bands of any single market. The cost-to-quality ratio is structurally better than concentrated teams can match.",
      "Filter to teams with no dominant geographic concentration, market-cap weighted within. The basket overlaps with remote-first DeFi and infrastructure projects.",
      "Distributed teams ship slowly until they ship fast. The asynchronous coordination tax disappears once the team learns to pay it.",
    ],
    objective:
      "Holds protocols built by globally distributed founding teams, weighted by market cap. Captures the cost-structure and time-zone arbitrage of teams that do not share an office.",
  },
  BROAD: {
    label: "Strategy Index",
    whyPoints: [
      "Broad-market exposure is the default position. Owning the whole market is the bet that no specific sector wins this cycle.",
      "Market-cap weighted across the largest tokens. The composition tracks where capital has already settled.",
      "Active selection adds risk. Passive selection accepts the market's current consensus. Both have a place; this is the one that does not require an opinion.",
    ],
    objective:
      "Holds the broad cap-weighted market, rebalanced monthly. Captures the average return of the asset class without requiring any specific thesis to be correct.",
  },
  SELFV: {
    label: "Founder Index",
    whyPoints: [
      "Self-taught founders against Ivy-credentialed ones. The spread captures the cost of credentials in a market where credentials never had to matter.",
      "Long basket selects self-taught founder protocols, weighted equally. The construction is comparative — the index reads as a vote on what background still rewards.",
      "If credentials predict outcomes the way they used to, the spread compresses. If they no longer do, it widens. The basket is the wager.",
    ],
    objective:
      "A spread-style index pairing self-taught founder protocols against Ivy-credentialed ones. Captures the relative outcome of background as a long-term selection signal in crypto.",
  },
  IVY: {
    label: "Education Index",
    whyPoints: [
      "Ivy-League founders carry concentrated peer networks worth more than the degree. The first hires, the first cap table, the first introductions — all priced into the network and not the diploma.",
      "Filter to founders from Ivy schools, market-cap weighted within. The basket skews toward fintech-adjacent and institutional protocols.",
      "Pedigree compresses fundraising cycles. Compression is alpha when capital is the bottleneck.",
    ],
    objective:
      "Holds protocols whose founders graduated from Ivy League institutions, weighted by market cap. Captures the structural fundraising and network advantage of concentrated alumni circles.",
  },
  MOVE2: {
    label: "Strategy Index",
    whyPoints: [
      "A second momentum cohort with a longer lookback. The window selects against noise; the basket runs cooler.",
      "Top movers by 60-day trailing return, rebalanced less often than the headline cohort. Lower turnover, higher conviction per name.",
      "Short momentum catches the move; long momentum catches the trend. The two basket types coexist because they answer different questions.",
    ],
    objective:
      "Selects the top trailing performers over a longer lookback window, rebalanced on a slower cadence. Captures persistent trend rather than short-term thrust.",
  },
  FACE: {
    label: "Founder Index",
    whyPoints: [
      "Public-facing founders trade reputation for liquidity. The protocols they front carry implicit guarantees that anonymous teams cannot offer.",
      "Filter to founders with active public personas, market-cap weighted. The basket skews toward consumer-facing crypto where trust is the product.",
      "A public founder cannot disappear quietly. The constraint is itself a feature.",
    ],
    objective:
      "Holds protocols led by founders with prominent public personas, weighted by market cap. Captures the implicit guarantee that comes with reputational stake.",
  },
  BUILD3: {
    label: "Founder Index",
    whyPoints: [
      "A third cohort of repeat founders, reaching past the obvious names and the secondary names into the late-cycle bench.",
      "Smallest of the three repeat-founder baskets. Higher dispersion, longer odds, larger asymmetric upside per position.",
      "The first basket already knew it would compound. The third does not yet know. That is the entire reason it is interesting.",
    ],
    objective:
      "A third cohort of repeat-founder protocols, the smallest and most asymmetric of the three. Captures the late-cycle bench of operators whose compounding has not yet been televised.",
  },
  PEAK2: {
    label: "Founder Index",
    whyPoints: [
      "A second peak-age cohort with a tighter window — narrowing further onto the optimal entrepreneurial decade.",
      "Filter to founders in a tighter age band, market-cap weighted. The basket selects more aggressively against both ends of the distribution.",
      "Sharper window, smaller basket, fewer compromises. The cost is concentration risk; the benefit is honest selection.",
    ],
    objective:
      "A second peak-age founder cohort with a tighter age window. Captures a more concentrated version of the same age-as-execution-signal thesis.",
  },
  GLOBE2: {
    label: "Founder Index",
    whyPoints: [
      "A second basket of globally distributed teams, broader than the headline cohort. Includes teams with looser distribution thresholds.",
      "Filter is wider; market-cap weighting still concentrates in the largest distributed protocols. The basket is more representative than selective.",
      "The thesis does not change with size. The conviction does.",
    ],
    objective:
      "A broader second cohort of globally distributed teams, with looser distribution thresholds than the headline basket. Captures the thesis at higher breadth and lower concentration.",
  },
  BROAD2: {
    label: "Strategy Index",
    whyPoints: [
      "A second broad-market cohort with deeper basket size. Captures more of the long tail at the cost of more dispersion.",
      "Market-cap weighted across a wider name set. The smaller positions add idiosyncratic exposure rather than systemic.",
      "Owning more names does not mean owning more market. The marginal token contributes very little to the average.",
    ],
    objective:
      "A broader cohort of cap-weighted market exposure, reaching deeper into the long tail. Captures average market return with explicit small-cap exposure.",
  },
  DFLED: {
    label: "Sector Index",
    whyPoints: [
      "DeFi leaders by some combination of TVL, fees, and time on chain. The basket buys the protocols that have already proven they survive.",
      "Filter to DeFi blue chips that have outlived at least one prior cycle, market-cap weighted within. Survivor bias is intentional.",
      "Most DeFi protocols die. The ones that don't are an unusually durable cohort. The basket buys the durability.",
    ],
    objective:
      "Holds DeFi leadership protocols filtered by survival across cycles, weighted by market cap. Captures the cohort of DeFi infrastructure that has demonstrated multi-cycle durability.",
  },
  VET2: {
    label: "Founder Index",
    whyPoints: [
      "A second veteran-founder cohort, broader than the headline cut. Includes operators with shorter but still substantial track records.",
      "Filter relaxed to founders with five-plus years operating experience, market-cap weighted. Wider basket, lower average bar.",
      "The first basket is the most experienced. This one is the most representative.",
    ],
    objective:
      "A second cohort of experienced founder protocols with a relaxed experience filter. Captures the broader cohort of operators with substantial — if not maximal — track records.",
  },
  CSCH2: {
    label: "Education Index",
    whyPoints: [
      "A second computer-science school cohort, reaching past the headline programs into adjacent strong technical schools.",
      "Filter widened beyond the top tier. Market-cap weighted within. The basket overlaps with hard-engineering protocols building outside the headline brand schools.",
      "The headline schools concentrate capital. The next tier concentrates underpriced talent.",
    ],
    objective:
      "A broader cohort of protocols led by founders from strong computer-science programs beyond the headline tier. Captures the technical-school selection effect at lower price.",
  },
  SELF3: {
    label: "Founder Index",
    whyPoints: [
      "A third cohort of self-taught founders — the smallest of three, reaching into the deepest part of the long tail.",
      "Filter is the loosest; basket size is the smallest. The construction surfaces names the headline cohorts miss entirely.",
      "Compounding lives in the names nobody is watching. The third basket is the bet on that.",
    ],
    objective:
      "A third self-taught founder cohort, the smallest and deepest of the three. Captures the names the headline baskets pass over.",
  },
  YIELD: {
    label: "Yield Index",
    whyPoints: [
      "Yield protocols compete to deliver the highest sustainable real return. The basket holds the ones that are still standing after the unsustainable ones imploded.",
      "Market-cap weighted across yield-bearing protocols — staking, lending, vaults, real-yield mechanisms. The selection is method-agnostic; the survival is the filter.",
      "Most yield is fictional. The yield that compounds is the yield that pays out of revenue. The basket selects for the latter.",
    ],
    objective:
      "Tracks the leading yield-generating protocols by market cap, rebalanced monthly. Captures the cohort of yield mechanisms that produce returns from cash flow rather than emissions.",
  },
  USA: {
    label: "Geographic Index",
    whyPoints: [
      "American founders raise the most capital, ship to the most regulated market, and operate under the most legal scrutiny. The friction is real; the survivors are durable.",
      "Filter to United States-headquartered crypto protocols, market-cap weighted within. The basket skews toward institutional infrastructure and compliant DeFi.",
      "Building from the US in crypto is harder than building from anywhere else. The protocols that do it carry the cost of doing it.",
    ],
    objective:
      "Holds protocols led by United States-based founders, weighted by market cap. Captures the cohort that built under the heaviest regulatory friction and survived it.",
  },
  YIELD2: {
    label: "Yield Index",
    whyPoints: [
      "A second yield cohort with a longer holding period and deeper basket. Slower turnover, broader exposure.",
      "Filter relaxed to include emerging yield mechanisms with shorter histories. Market-cap weighted, monthly rebalance.",
      "The first yield basket is conservative. The second includes the experiments. Some of them will not survive; the survivors will be the next first basket.",
    ],
    objective:
      "A second yield cohort that includes emerging yield mechanisms alongside established ones. Captures both the proven cohort and the experiments competing to join it.",
  },
  GLOBE3: {
    label: "Founder Index",
    whyPoints: [
      "A third globally distributed cohort, reaching the smallest and most decentralized teams. The basket is intentionally weak in the headline names.",
      "Filter selects only teams with no geographic concentration above a strict threshold. Smaller basket, sharper construction.",
      "The third basket is the purest expression of the thesis. Whether that purity rewards or punishes is the question the basket exists to answer.",
    ],
    objective:
      "A third globally distributed cohort with the strictest geographic dispersion threshold. Captures the most decentralized expression of the thesis at the cost of basket size.",
  },
  MBA: {
    label: "Founder Index",
    whyPoints: [
      "MBA-credentialed founders bring institutional fundraising and operational discipline. The protocols they ship tend to scale where engineering-only teams stall.",
      "Filter to founders with MBAs from accredited programs, market-cap weighted within. The basket skews toward go-to-market-heavy projects.",
      "MBAs are mocked in crypto and overrepresented in the survivors. The mockery is the alpha.",
    ],
    objective:
      "Holds protocols whose founders hold MBAs, weighted by market cap. Captures the operational-discipline selection effect of teams led by formally trained operators.",
  },
  STLTH2: {
    label: "Founder Index",
    whyPoints: [
      "A second stealth cohort with a wider definition of pre-public. Captures projects further along but still pre-marketing.",
      "Filter relaxed to include early-public projects with limited liquidity. Market-cap weighted within. Information risk is lower than the first basket but still elevated.",
      "Stealth ends the moment the marketing begins. The basket sits in the seam between the two phases.",
    ],
    objective:
      "A second cohort of pre-public and early-public protocols, broader than the strict stealth basket. Captures the asymmetric returns of the pre-marketing phase at slightly reduced information risk.",
  },
  CRNL: {
    label: "Education Index",
    whyPoints: [
      "Cornell's blockchain program produced an unusually concentrated alumni network in crypto. The protocols they ship reflect a shared technical vocabulary.",
      "Filter to Cornell-affiliated founders, market-cap weighted within. The basket includes both undergraduate and graduate alumni.",
      "Concentrated alumni networks compound fundraising and recruiting advantages. Cornell's crypto presence is small enough to be coherent and large enough to matter.",
    ],
    objective:
      "Holds protocols whose founders are Cornell University alumni, weighted by market cap. Captures the cohesion of one of the most concentrated single-school crypto alumni networks.",
  },
  IMMIG2: {
    label: "Founder Index",
    whyPoints: [
      "A second immigrant-founder cohort with broader filter. Includes founders who moved decades ago alongside recent immigrants.",
      "Wider definition of immigration, deeper basket, lower average concentration. Market-cap weighted within.",
      "The first cohort is the urgent immigrants. The second is the settled ones. Both retain the founder selection effect of the original move.",
    ],
    objective:
      "A second immigrant-founder cohort with a broader temporal filter. Captures the longer arc of founders whose original migration shaped their selection into entrepreneurship.",
  },
  DEFEC: {
    label: "Founder Index",
    whyPoints: [
      "Founders who left FAANG carry the engineering rigor and the risk tolerance to leave. The combination is rarer than either trait alone.",
      "Filter to founders with senior FAANG experience, market-cap weighted within. The basket skews toward infrastructure and developer tooling.",
      "Leaving Google to work on crypto is irrational by every conventional metric. The irrationality is itself the selection signal.",
    ],
    objective:
      "Holds protocols led by founders who left FAANG-tier technology companies, weighted by market cap. Captures the career-risk premium of operators who walked away from optimal compensation.",
  },
  META: {
    label: "Founder Index",
    whyPoints: [
      "Ex-Meta founders bring scaled-product experience and the operational scars of one of crypto's most public failed bets — Diem.",
      "Filter to founders with prior Meta tenure, market-cap weighted within. The basket includes both Diem alumni and broader Meta engineering exits.",
      "Meta tried to enter crypto from above and failed publicly. The engineers who lived through the failure are now building from below.",
    ],
    objective:
      "Holds protocols led by founders with prior Meta tenure, weighted by market cap. Captures the cohort that built crypto adjacent at Meta and is now building it independently.",
  },
  EURO: {
    label: "Geographic Index",
    whyPoints: [
      "European founders operate under MiCA — the most explicit crypto regulatory regime on the planet. Compliance is built into the protocol design.",
      "Filter to European-headquartered crypto teams, market-cap weighted within. The basket overlaps strongly with Switzerland, Germany, and the United Kingdom.",
      "Europe lost the consumer internet decisively. It is competing in crypto on better terms — clearer rules, cheaper engineering, deeper academic networks.",
    ],
    objective:
      "Holds protocols led by European-based founders, weighted by market cap. Captures the cohort building under the most explicit regulatory regime in crypto.",
  },
  CHINA: {
    label: "Geographic Index",
    whyPoints: [
      "Chinese founders ship from a domestic regulatory environment that bans most of what they build. The diaspora that results is unusually motivated.",
      "Filter to founders of Chinese origin, market-cap weighted within. Many founding teams operate from Singapore, Dubai, or the United States.",
      "The Chinese crypto diaspora overlaps with most of the largest exchanges, the largest mining operations, and a disproportionate share of the protocol layer.",
    ],
    objective:
      "Holds protocols led by founders of Chinese origin, weighted by market cap. Captures the diaspora cohort that built crypto from outside the regulatory perimeter of their home market.",
  },
  DEX: {
    label: "Sector Index",
    whyPoints: [
      "Spot decentralized exchanges are the most basic primitive in DeFi. The basket holds the venues where price discovery actually happens on-chain.",
      "Market-cap weighted across the leading spot DEXes. Volume concentrates in a few names; the weighting reflects the concentration.",
      "Centralized exchanges still hold most spot volume. The DEX share grows every cycle. The trend is older than crypto's memory of it.",
    ],
    objective:
      "Tracks the leading spot decentralized exchanges by market cap. Captures the slow migration of spot volume from order books to AMMs.",
  },
  MOVE3: {
    label: "Strategy Index",
    whyPoints: [
      "A third momentum cohort with a different ranking metric — risk-adjusted rather than absolute return.",
      "Selection by Sharpe-like ratio rather than raw performance, smaller basket, slower rebalance. The construction punishes volatile winners.",
      "Two of the four momentum baskets pick the loudest movers. This one picks the quiet ones. Both kinds of momentum exist; both kinds work, in different regimes.",
    ],
    objective:
      "A risk-adjusted momentum cohort selecting tokens by trailing Sharpe-like measures. Captures persistent quality momentum rather than amplitude momentum.",
  },
  MOD: {
    label: "Sector Index",
    whyPoints: [
      "Modular blockchains separate consensus, execution, and data availability into distinct markets. Each market has its own protocol economics.",
      "Market-cap weighted across modular-stack tokens — DA layers, sequencers, settlement, execution environments. The basket spans the entire modular thesis.",
      "Monolithic chains made one bet. Modular chains make several. The basket holds all of the modular bets.",
    ],
    objective:
      "Tracks the leading modular blockchain protocols by market cap. Captures the unbundling of the chain stack into independent markets for consensus, execution, and data availability.",
  },
  MOVE4: {
    label: "Strategy Index",
    whyPoints: [
      "A fourth momentum variant — relative strength against a benchmark rather than absolute return. Selection rewards outperformance over participation.",
      "Top movers by trailing relative strength versus a market benchmark, rebalanced monthly. The basket exits names rising only because the market is rising.",
      "Three of the four momentum baskets pick winners. This one picks outperformers. The distinction matters most in trending markets where everything rises.",
    ],
    objective:
      "Selects tokens by trailing relative strength against a benchmark, rebalanced monthly. Captures the momentum that survives even when the market average is moving with it.",
  },
  EXP: {
    label: "Founder Index",
    whyPoints: [
      "Experience-weighted founder cohort — not filtered by years, weighted by them. The protocols led by the most experienced operators receive the largest weights.",
      "Construction is monotonic in operating tenure. The largest weights go to founders with the deepest track records, regardless of underlying market cap.",
      "Most baskets weight by what the market has decided. This one weights by what experience has decided. The two should agree more often than they do.",
    ],
    objective:
      "Holds founder protocols weighted by founder operating experience rather than market capitalization. Captures the structural premium of cumulative tenure as a portfolio construction signal.",
  },
  VOL: {
    label: "Strategy Index",
    whyPoints: [
      "Volume is the most honest signal in crypto. Tokens with the most volume have the most adversarial price discovery.",
      "Market-cap weighted within a filter on trailing trading volume. The basket selects against illiquid tokens regardless of nominal market cap.",
      "Liquidity is its own asset class. The tokens that have it are tradeable; the ones that do not are theoretical.",
    ],
    objective:
      "Holds the leading tokens by trailing trading volume, weighted by market cap. Captures the cohort with the deepest liquidity and the most adversarial price formation.",
  },
  STABL: {
    label: "Sector Index",
    whyPoints: [
      "Stablecoin issuers earn yield on their float. The float grows with adoption, and adoption grows with each new chain that needs dollars.",
      "Market-cap weighted across stablecoin issuer governance tokens. The basket excludes the stablecoins themselves and holds the protocols behind them.",
      "Stablecoin economics are bank economics with better margins. The basket buys the banks.",
    ],
    objective:
      "Tracks the leading stablecoin issuer governance tokens by market cap. Captures the float economics of the protocols that issue dollar exposure rather than the dollar exposure itself.",
  },
  ORCL: {
    label: "Sector Index",
    whyPoints: [
      "Oracles are the bridge between off-chain truth and on-chain logic. Every smart contract that depends on a price depends on an oracle.",
      "Market-cap weighted across the leading oracle protocols. The basket overlaps with cross-chain messaging where the two roles converge.",
      "Oracle protocols are infrastructure that becomes invisible when it works. The basket pays for the parts of the stack nobody talks about until they fail.",
    ],
    objective:
      "Tracks the leading oracle protocols by market cap. Captures the infrastructure layer that connects on-chain logic to off-chain reality.",
  },
  ROT: {
    label: "Strategy Index",
    whyPoints: [
      "Sector rotation moves capital between crypto sectors based on relative momentum. The strategy buys the sector that just outperformed and sells the one that just lagged.",
      "Construction picks the top-performing sector by trailing return and concentrates exposure there. Monthly rebalance, single-sector concentration.",
      "Most portfolios diversify against the rotation. This one rides it. The trade-off is concentration risk in exchange for timing-the-cycle exposure.",
    ],
    objective:
      "Rotates monthly into the top-performing crypto sector by trailing return. Captures sector momentum at the cost of explicit concentration in whichever theme just led.",
  },
  MIX: {
    label: "Founder Index",
    whyPoints: [
      "Mixed-generation founding teams pair veteran operators with younger engineers. The pairing produces both shipping speed and judgment.",
      "Filter to teams with explicit cross-generational composition, market-cap weighted within. The basket selects against monoculture in either direction.",
      "Veteran-only teams ship slowly. Young-only teams ship recklessly. Mixed teams ship at a pace that survives the next cycle.",
    ],
    objective:
      "Holds protocols built by mixed-generation founding teams, weighted by market cap. Captures the structural advantage of cross-generational composition over either age extreme.",
  },
  ASIA: {
    label: "Geographic Index",
    whyPoints: [
      "Asian crypto markets trade earlier than the Western world wakes up. The protocols built for them carry the rhythm of a different attention cycle.",
      "Filter to founders of Asian origin or Asia-headquartered teams, market-cap weighted within. The basket overlaps with Korean, Japanese, and Southeast Asian ecosystems.",
      "Most crypto narratives are Western by default. The Asian markets price the same assets differently — and frequently first.",
    ],
    objective:
      "Holds protocols led by founders of Asian origin or based in Asia, weighted by market cap. Captures the time-zone and narrative arbitrage of markets that trade ahead of the Western news cycle.",
  },
  IVY2: {
    label: "Education Index",
    whyPoints: [
      "A second Ivy-League cohort with a wider filter — includes Ivy-adjacent elite schools alongside the strict Ivy eight.",
      "Filter widened to schools commonly grouped with Ivies in selectivity and capital access. Market-cap weighted within.",
      "The first basket is strict. The second admits the schools that operate like Ivies without the brand. Capital allocators do not always distinguish.",
    ],
    objective:
      "A broader Ivy-tier alumni cohort that includes Ivy-adjacent elite institutions. Captures the capital-access selection effect at a broader credentialing radius.",
  },
  YOUNG: {
    label: "Founder Index",
    whyPoints: [
      "Young founders — late-twenties and earlier — operate without the mortgage, the family, or the cumulative loss aversion of their older peers.",
      "Filter to founders below a strict age threshold, market-cap weighted within. The basket skews toward consumer-facing crypto and fast-moving infrastructure.",
      "The young cohort is the highest-variance. The right tail is where the asymmetric returns live; the left tail is where most of the cohort lives.",
    ],
    objective:
      "Holds protocols led by founders below a strict age threshold, weighted by market cap. Captures the highest-variance founder cohort and its asymmetric distribution of outcomes.",
  },
  RWA2: {
    label: "Sector Index",
    whyPoints: [
      "A second RWA cohort with broader filter — includes RWA-adjacent infrastructure like compliant settlement and tokenized credit.",
      "Wider definition, deeper basket, longer rebalance window. Market-cap weighted within. The basket reaches further into early-stage RWA infrastructure.",
      "The first basket holds the RWA leaders. The second holds the cohort competing to join them.",
    ],
    objective:
      "A broader RWA cohort that includes adjacent compliant infrastructure and emerging tokenization protocols. Captures the wider perimeter of the tokenization thesis.",
  },
  ALL: {
    label: "Strategy Index",
    whyPoints: [
      "All markets, equal-weighted. The construction makes no claim about which sector or theme deserves more capital.",
      "Equal-weighted across the entire investable universe, monthly rebalance. The smallest names contribute proportionally to the largest.",
      "Cap weighting concentrates in winners. Equal weighting concentrates in everything. The two construction methods produce different conclusions about the same market.",
    ],
    objective:
      "Holds the entire investable token universe equal-weighted, rebalanced monthly. Captures the average return of the asset class on egalitarian construction.",
  },
  BRDG2: {
    label: "Sector Index",
    whyPoints: [
      "A second cross-chain cohort with a wider filter — includes messaging-only protocols alongside asset bridges.",
      "Broader definition of cross-chain communication, deeper basket. Market-cap weighted within. The basket spans both bridge tokens and messaging-layer governance.",
      "The first basket holds the asset-movement layer. The second adds the message-passing layer underneath it.",
    ],
    objective:
      "A second cross-chain communication cohort that includes both asset bridges and pure messaging protocols. Captures the entire interoperability stack rather than only its asset-movement layer.",
  },
  LEND: {
    label: "Sector Index",
    whyPoints: [
      "Lending protocols are the commercial banks of crypto. They earn the spread between deposit yield and borrow rate, scaled by leverage demand.",
      "Market-cap weighted across the leading lending protocols. The basket includes both pooled lending markets and isolated CDP issuers.",
      "Lending demand is procyclical. The protocols compound during expansion and survive during contraction. The basket captures both halves of the cycle.",
    ],
    objective:
      "Tracks the leading lending protocols by market cap. Captures the spread economics of on-chain credit across both pooled and isolated lending models.",
  },
  CAN: {
    label: "Geographic Index",
    whyPoints: [
      "Canadian-based crypto founders operate from a regulatory regime that took longer to clarify than Europe and longer than crypto patience can usually sustain. The teams that survived the wait are durable.",
      "Filter to Canadian-based founders, market-cap weighted within. The basket overlaps with the Toronto and Vancouver tech ecosystems.",
      "Canada is small enough that founders know each other. The tight network compounds fundraising and recruiting in ways larger ecosystems cannot replicate.",
    ],
    objective:
      "Holds protocols led by Canadian-based founders, weighted by market cap. Captures the cohort that built through prolonged regulatory ambiguity in a small but tightly networked ecosystem.",
  },
  RWADF: {
    label: "Risk Index",
    whyPoints: [
      "Defensive RWA construction applies minimum-variance optimization to the tokenized real-world assets cohort. The optimizer tilts toward whichever RWAs are least correlated with each other.",
      "The min-variance approach concentrates in tokenized commodities, treasuries, and the most stable credit products. The construction is defensive by definition.",
      "Most crypto exposure carries crypto-grade volatility. This is the part of crypto that does not.",
    ],
    objective:
      "Applies minimum-variance optimization to the RWA cohort, rebalanced monthly. Captures the lowest-volatility expression of tokenized real-world asset exposure.",
  },
  YIELD3: {
    label: "Yield Index",
    whyPoints: [
      "A third yield cohort focused on the most aggressive yield mechanisms — leveraged staking, looped lending, and structured strategies.",
      "Filter widened to include synthetic and leveraged yield protocols. Market-cap weighted within. Higher yields, higher risk of mechanism failure.",
      "The first two yield baskets aim for sustainability. The third aims for yield. The two goals frequently disagree.",
    ],
    objective:
      "A third yield cohort that includes leveraged and structured yield mechanisms. Captures the highest-yield, highest-risk segment of on-chain return generation.",
  },
  ZKNW: {
    label: "Sector Index",
    whyPoints: [
      "Zero-knowledge proofs collapse computation costs by orders of magnitude. The protocols that ship them are pricing infrastructure that has not yet been needed at scale.",
      "Market-cap weighted across zero-knowledge proof, ZK-rollup, and ZK-application tokens. The basket spans both proving-system tokens and the rollups that consume them.",
      "ZK is the rare technology where the math is older than the market. The protocols catch up to the math one cycle at a time.",
    ],
    objective:
      "Tracks the leading zero-knowledge proof and rollup protocols by market cap. Captures the maturation of cryptographic infrastructure that has been theoretically possible for decades.",
  },
  DEPIN: {
    label: "Sector Index",
    whyPoints: [
      "Decentralized physical infrastructure tokens incentivize hardware deployment — wireless coverage, storage, compute, mapping. The token funds the build that capital markets refuse to fund.",
      "Market-cap weighted across DePIN protocols. The basket spans wireless, storage, compute, and energy projects.",
      "Most DePIN deployments will not produce sustainable demand. The ones that do will be the only physical infrastructure in their category that nobody had to convince a board to build.",
    ],
    objective:
      "Tracks the leading decentralized physical infrastructure protocols by market cap. Captures the cohort funding hardware deployment through token-incentivized supply.",
  },
  LST: {
    label: "Sector Index",
    whyPoints: [
      "Liquid staking turns staked capital into a tradeable asset. Every ETH and SOL staked through these protocols compounds for the holder while remaining liquid.",
      "Market-cap weighted across liquid staking governance tokens. The protocols compete for depositor share; the basket holds whoever is winning.",
      "Liquid staking is the base layer of DeFi yield. The base layer compounds; the basket compounds with it.",
    ],
    objective:
      "Tracks the leading liquid staking governance tokens by market cap. Captures the base layer of on-chain yield as it competes for depositor share across staking primitives.",
  },
  GOV: {
    label: "Sector Index",
    whyPoints: [
      "Governance tokens accrue value through whatever the protocol decides to direct toward them — fees, buybacks, emissions cuts. The decision-making power is the asset.",
      "Market-cap weighted across DeFi governance tokens. The basket holds the cohort with active treasury or fee-direction power.",
      "Most governance is theatre. The minority that is not produces real cash flows. The basket holds the minority weighted by market cap.",
    ],
    objective:
      "Tracks the leading DeFi governance tokens by market cap. Captures the cohort whose token holders direct real economic value through protocol decision-making.",
  },
  VET3: {
    label: "Founder Index",
    whyPoints: [
      "A third veteran-founder cohort with the most demanding experience filter — twenty-plus years operating tenure across multiple companies.",
      "Strictest filter, smallest basket. The selection skews heavily toward repeat founders with prior public company exits.",
      "Twenty years of operating experience produces one of two outcomes: deep judgment or deep cynicism. The basket bets on the former.",
    ],
    objective:
      "A third veteran-founder cohort with the strictest experience threshold. Captures the smallest, most experienced subset of the founder universe.",
  },
  HVRD: {
    label: "Education Index",
    whyPoints: [
      "Harvard alumni in crypto carry the most concentrated capital network of any single institution. The first call is always answered.",
      "Filter to Harvard-affiliated founders, market-cap weighted within. Includes both undergraduate and graduate alumni.",
      "Harvard's crypto presence is small relative to its alumni base. Concentration is what makes the network valuable.",
    ],
    objective:
      "Holds protocols whose founders are Harvard alumni, weighted by market cap. Captures the most concentrated single-school capital network in the founder cohort.",
  },
  BRG: {
    label: "Sector Index",
    whyPoints: [
      "Pure bridge tokens — protocols whose only function is moving assets between chains. The category is narrower than cross-chain communication broadly.",
      "Market-cap weighted across the leading asset-movement bridges. The basket excludes messaging protocols and pure interoperability layers.",
      "Bridges have been hacked for more capital than any other category in crypto. The protocols still standing are the ones whose security models survived the audit by adversary.",
    ],
    objective:
      "Tracks the leading pure bridge protocols by market cap. Captures the asset-movement layer of the cross-chain stack at its narrowest definition.",
  },
  LEND2: {
    label: "Sector Index",
    whyPoints: [
      "A second lending cohort with a wider filter — includes isolated lending markets, undercollateralized lending, and emerging credit primitives.",
      "Broader basket, longer rebalance window, market-cap weighted within. The basket reaches into experimental credit mechanisms.",
      "The first basket holds the proven lending protocols. The second holds the experiments. Some will become the next first basket.",
    ],
    objective:
      "A second lending cohort that includes isolated and experimental credit protocols. Captures the wider perimeter of on-chain credit beyond the proven pooled markets.",
  },
  META2: {
    label: "Sector Index",
    whyPoints: [
      "Metaverse tokens fund virtual worlds, in-world economies, and the infrastructure between them. The category survived its own hype cycle and emerged smaller and more focused.",
      "Market-cap weighted across virtual world and metaverse infrastructure tokens. The basket holds the survivors of a category that consumed billions in capital.",
      "Most metaverses will remain empty. The ones with persistent users will become the only category-survivors anyone remembers.",
    ],
    objective:
      "Tracks the leading metaverse and virtual world tokens by market cap. Captures the survivors of a category whose hype cycle ended and whose infrastructure remains.",
  },
  PRIV: {
    label: "Sector Index",
    whyPoints: [
      "Financial privacy is permanent demand. The protocols building privacy infrastructure operate in regulatory uncertainty, which is itself a moat.",
      "Market-cap weighted across privacy protocols — ZK proofs, MPC, mixing, confidential computing. The basket diversifies across cryptographic approaches.",
      "Privacy infrastructure is fragmented because no single approach has won. Holding the basket avoids the bet on which paradigm becomes dominant.",
    ],
    objective:
      "Tracks the leading privacy-preserving blockchain protocols by market cap. Captures structural demand for financial privacy diversified across competing cryptographic approaches.",
  },
  FANS: {
    label: "Sector Index",
    whyPoints: [
      "Fan tokens monetize sports loyalty. Each club issues a token; each token's volume tracks matchdays, transfers, and tournaments.",
      "Market-cap weighted across the leading sports fan tokens. The basket spans European football, Formula 1, and other top-tier sports.",
      "Sports engagement is seasonal and largely uncorrelated with crypto cycles. The basket is a genuine diversifier from the rest of the asset class.",
    ],
    objective:
      "Tracks the leading sports fan tokens by market cap. Captures a sector whose engagement cycle runs on sports calendars rather than crypto cycles.",
  },
  BERK: {
    label: "Education Index",
    whyPoints: [
      "Berkeley produced the largest concentration of cryptography researchers in academia. The crypto founders from Berkeley carry both the technical depth and the bay-area network.",
      "Filter to Berkeley alumni, market-cap weighted within. The basket includes both undergraduate and graduate program alumni.",
      "Berkeley's research culture rewards public collaboration. The crypto founders that emerge from it tend to ship in public from day one.",
    ],
    objective:
      "Holds protocols whose founders are Berkeley alumni, weighted by market cap. Captures the cohort emerging from one of the densest cryptography research environments in academia.",
  },
  TRFI: {
    label: "Founder Index",
    whyPoints: [
      "Ex-Wall Street founders bring institutional sales discipline and a familiarity with the regulatory environment that pure-crypto teams lack.",
      "Filter to founders with prior tenure at investment banks, hedge funds, or quantitative trading firms. Market-cap weighted within.",
      "Wall Street defectors built crypto's institutional infrastructure. The basket holds the cohort that brought TradFi rigor across the bridge.",
    ],
    objective:
      "Holds protocols led by founders with prior Wall Street tenure, weighted by market cap. Captures the institutional-discipline selection effect of operators trained inside traditional finance.",
  },
  M2E: {
    label: "Sector Index",
    whyPoints: [
      "Move-to-earn tokens incentivize physical activity through token rewards. The category survived its initial hype collapse with a small but persistent user base.",
      "Market-cap weighted across move-to-earn protocols. The basket holds the survivors of a category that consumed billions and produced one breakout product.",
      "The category teaches a lesson about token incentives applied to physical behavior. The lesson is mostly cautionary; the survivors learned it first.",
    ],
    objective:
      "Tracks the leading move-to-earn protocols by market cap. Captures the cohort that survived a hype-and-collapse cycle and continues to operate with persistent users.",
  },
  GAME: {
    label: "Sector Index",
    whyPoints: [
      "Gaming tokens fund in-game economies, item ownership, and player-to-player markets. The category requires both an economy and a game — most projects ship only one.",
      "Market-cap weighted across crypto gaming infrastructure and major titles. The basket spans both engines and games built on them.",
      "Crypto gaming has predicted its own breakthrough every cycle. The breakthrough has not yet arrived. The basket holds the cohort still building toward it.",
    ],
    objective:
      "Tracks the leading crypto gaming protocols and infrastructure tokens by market cap. Captures the cohort building toward a breakthrough the category has predicted for itself five times.",
  },
  PHD: {
    label: "Founder Index",
    whyPoints: [
      "PhD founders bring depth in cryptography, distributed systems, or financial economics. The protocols they ship tend to have research papers underneath them.",
      "Filter to founders with completed PhDs in relevant technical fields. Market-cap weighted within. The basket skews toward zero-knowledge and consensus research.",
      "Most PhDs do not become founders. The ones that do carry both the academic credentialing and the willingness to leave the academy. Both are selection signals.",
    ],
    objective:
      "Holds protocols led by founders with PhDs in technical fields, weighted by market cap. Captures the cohort that brings academic depth into commercial protocol design.",
  },
  MIL: {
    label: "Founder Index",
    whyPoints: [
      "Ex-military founders carry operational discipline and a tolerance for hierarchy that pure-tech teams often lack. The protocols they build tend to ship under duress.",
      "Filter to founders with prior military service, market-cap weighted within. The basket overlaps with security-focused and infrastructure protocols.",
      "Military service teaches how to operate when the plan fails. The skill is unfashionable in tech and indispensable in crypto.",
    ],
    objective:
      "Holds protocols led by founders with prior military service, weighted by market cap. Captures the operational-discipline selection effect of teams trained to function under failure.",
  },
  GOOG: {
    label: "Founder Index",
    whyPoints: [
      "Ex-Google founders bring distributed systems experience at scale that almost no other employer can match. The infrastructure protocols they ship reflect the scaling experience.",
      "Filter to founders with senior Google tenure, market-cap weighted within. The basket skews heavily toward L1, infrastructure, and developer tooling protocols.",
      "Google trained more distributed-systems engineers than any other company. Crypto absorbed a disproportionate share of the best ones.",
    ],
    objective:
      "Holds protocols led by founders with prior Google tenure, weighted by market cap. Captures the distributed-systems training pipeline that produced a disproportionate share of crypto's infrastructure.",
  },
  NFT: {
    label: "Sector Index",
    whyPoints: [
      "NFT infrastructure tokens fund the marketplaces, royalty enforcement, and metadata standards that underlie the category. The infrastructure outlasts any individual collection.",
      "Market-cap weighted across NFT marketplace and infrastructure protocols. The basket excludes individual NFT collections and holds the protocols beneath them.",
      "Most NFT collections lose value. The infrastructure that hosted them keeps earning fees regardless. The basket buys the venue, not the merchandise.",
    ],
    objective:
      "Tracks the leading NFT infrastructure protocols by market cap. Captures the venue economics of NFT trading independent of whether any specific collection retains value.",
  },
  GER: {
    label: "Geographic Index",
    whyPoints: [
      "German founders operate from one of the most explicit crypto regulatory regimes in the world — BaFin oversight, MiCA compliance, and a deep institutional banking sector willing to engage.",
      "Filter to German-headquartered crypto teams, market-cap weighted within. The basket overlaps with Berlin, Munich, and Frankfurt ecosystems.",
      "Germany's crypto stance is severe and predictable. Both qualities favor protocols built for institutional use rather than retail volume.",
    ],
    objective:
      "Holds protocols led by German-based founders, weighted by market cap. Captures the cohort building under one of the strictest and most institutionally-aligned regulatory regimes in crypto.",
  },
  STABL2: {
    label: "Sector Index",
    whyPoints: [
      "A second stablecoin issuer cohort that includes algorithmic, partially-collateralized, and emerging stablecoin issuers alongside the proven cohort.",
      "Wider filter, deeper basket. Market-cap weighted within. The construction includes mechanisms that the first basket excludes on the basis of model risk.",
      "Algorithmic stablecoins die spectacularly when they fail. The ones that have not yet failed are either correct or about to be wrong.",
    ],
    objective:
      "A second stablecoin issuer cohort that includes algorithmic and emerging mechanisms alongside fully-collateralized issuers. Captures the broader perimeter of the issuance category at higher mechanism risk.",
  },
  BRG2: {
    label: "Sector Index",
    whyPoints: [
      "A second pure-bridge cohort with a wider filter — includes intent-based bridges and newer security models alongside the established cohort.",
      "Broader definition, deeper basket, market-cap weighted within. The construction reaches into bridges with novel security architectures.",
      "Bridge security models are still being invented. The next basket of survivors will look different from this one.",
    ],
    objective:
      "A second cohort of pure bridge protocols with broader inclusion of intent-based and novel security architectures. Captures the next-generation bridge cohort competing with the established names.",
  },
  MIT: {
    label: "Education Index",
    whyPoints: [
      "MIT alumni in crypto cluster around the Digital Currency Initiative and the Computer Science department. The network is small, technical, and unusually well-capitalized.",
      "Filter to MIT-affiliated founders, market-cap weighted within. The basket skews heavily toward infrastructure and cryptography-heavy protocols.",
      "MIT's crypto presence is older than most of crypto. The continuity is itself an advantage that newer institutional networks cannot replicate.",
    ],
    objective:
      "Holds protocols whose founders are MIT alumni, weighted by market cap. Captures one of the longest-running and most technically-concentrated single-institution alumni networks in crypto.",
  },
  GAME2: {
    label: "Sector Index",
    whyPoints: [
      "A second crypto gaming cohort with a broader filter — includes mobile-first games, casual gaming, and gambling-adjacent protocols alongside the headline AAA cohort.",
      "Wider definition, deeper basket. Market-cap weighted within. The basket selects against the bias toward AAA gaming that dominates the headline cohort.",
      "Crypto gaming's eventual breakthrough may come from mobile or casual rather than AAA. The second basket holds the cohort that bet differently.",
    ],
    objective:
      "A second crypto gaming cohort that includes mobile, casual, and gambling-adjacent protocols. Captures the segments of gaming that diverge from the AAA-focused headline cohort.",
  },
  GAME3: {
    label: "Sector Index",
    whyPoints: [
      "Top gaming — the smallest gaming basket, concentrated on the protocols with proven user bases and recurring engagement metrics.",
      "Filter to gaming protocols with verifiable persistent player counts, market-cap weighted within. The basket excludes pre-launch and dormant projects.",
      "Most crypto games have no players. The ones that do are an unusually durable cohort. The basket holds the cohort.",
    ],
    objective:
      "Holds the crypto gaming protocols with proven persistent player bases, weighted by market cap. Captures the durable subset of a category whose breakthrough has been predicted longer than it has been delivered.",
  },
  STAN: {
    label: "Education Index",
    whyPoints: [
      "Stanford alumni in crypto sit at the intersection of computer science depth and the densest venture capital network in the world. The combination compounds in fundraising.",
      "Filter to Stanford-affiliated founders, market-cap weighted within. The basket spans both undergraduate and graduate alumni across CS, MBA, and engineering.",
      "Stanford's network compresses the time between idea and first round to its theoretical minimum. The compression is alpha when capital is scarce and time is not.",
    ],
    objective:
      "Holds protocols whose founders are Stanford alumni, weighted by market cap. Captures the alumni cohort with the deepest combined access to both technical depth and venture capital.",
  },
  GBR: {
    label: "Geographic Index",
    whyPoints: [
      "British founders operate from a regulatory regime that has been deliberately permissive toward crypto since 2022 — the Financial Services and Markets Act framed the UK as an explicit competitor to MiCA.",
      "Filter to UK-based crypto teams, market-cap weighted within. The basket overlaps with London-based DeFi and institutional protocols.",
      "Post-Brexit Britain chose crypto-friendliness as a deliberate competitive strategy. The protocols built under that policy reflect the choice.",
    ],
    objective:
      "Holds protocols led by British-based founders, weighted by market cap. Captures the cohort built under the UK's deliberately competitive post-Brexit crypto regulatory framework.",
  },
  AUS: {
    label: "Geographic Index",
    whyPoints: [
      "Australian founders operate from a small but technically deep ecosystem with regulatory clarity earlier than most of the developed world. The protocols ship from a base that lacks both density and dilution.",
      "Filter to Australian-based crypto teams, market-cap weighted within. The basket overlaps with Sydney and Melbourne ecosystems.",
      "Australia's crypto founders are isolated from both US and European regulatory cycles. The isolation produces protocols that are quieter and more deliberate than louder ecosystems.",
    ],
    objective:
      "Holds protocols led by Australian-based founders, weighted by market cap. Captures the cohort built from a small, technically dense, and regulatorily-clear ecosystem.",
  },
}
