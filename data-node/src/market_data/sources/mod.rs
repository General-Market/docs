//! Market data source implementations (32 providers)
//!
//! Contains implementations for all supported data sources.
//!
//! Available sources:
//! - **BLS** - Bureau of Labor Statistics (NFP, CPI, PPI, etc.)
//! - **CoinGecko** - Cryptocurrency prices
//! - **DefiLlama** - DeFi TVL and protocol data
//! - **ECB** - European Central Bank rates
//! - **Finnhub** - Stock prices
//! - **FRED** - Federal Reserve economic data
//! - **OpenMeteo** - Weather data
//! - **Treasury** - US Treasury yields (via Nasdaq)
//! - **Nasdaq** - Multiple sources (CFTC, CHRIS, BCHAIN, OPEC, IMF)
//! - **EIA** - Energy Information Administration
//! - **SEC EDGAR** - 13F fund holdings
//! - **FINRA** - Short interest data
//! - **FINRA Short Vol** - Daily short volume (Index-only)
//! - **SEC EFTS** - Full-text search filings (Index-only)
//! - **SEC Insider** - Insider trading (Index-only)
//! - **Congress** - Legislative activity tracking
//! - **World Bank** - Global economic indicators
//! - **Zillow** - Real estate (stub - requires Bridge API)
//! - **Polymarket** - Prediction markets
//! - **backpack.tf** - TF2 item community pricing
//! - **GitHub** - Repository star counts
//! - **npm** - Package download counts
//! - **PyPI** - Python package download counts
//! - **crates.io** - Rust crate download counts
//! - **Cloudflare Radar** - Internet traffic, domains, quality metrics
//! - **4chan** - Board activity metrics (thread creation, reply velocity, greentext)
//! - **TWSE** - Taiwan Stock Exchange prices
//! - **AniList** - Anime & manga popularity scores
//! - **Steam** - Game player counts
//! - **TMDB** - Movie/TV popularity scores
//! - **Twitch** - Stream viewer counts
//! - **Hacker News** - Story scores and engagement

// Shared utilities
pub mod error;
pub mod http_client;

// Prod sources (29)
pub mod anilist;
pub mod backpacktf;
pub mod bls;
pub mod cloudflare;
pub mod coingecko;
pub mod congress;
pub mod crates_io;
pub mod defillama;
pub mod ecb;
pub mod eia;
pub mod finnhub;
pub mod finra;
pub mod fourchan;
pub mod fred;
pub mod github;
pub mod hackernews;
pub mod nasdaq;
pub mod npm;
pub mod openmeteo;
pub mod polymarket;
pub mod pypi;
pub mod sec_edgar;
pub mod steam;
pub mod tmdb;
pub mod treasury;
pub mod twitch;
pub mod twse;
pub mod worldbank;
pub mod zillow;

// Index-only sources (3) + shared ticker list
pub mod tracked_tickers;
pub mod finra_short_vol;
pub mod sec_efts;
pub mod sec_insider;

// Re-exports — prod sources
pub use anilist::AniListMarketSource;
pub use backpacktf::BackpackTfMarketSource;
pub use bls::BlsMarketSource;
pub use cloudflare::CloudflareRadarMarketSource;
pub use coingecko::CoinGeckoMarketSource;
pub use congress::CongressMarketSource;
pub use crates_io::CratesIoMarketSource;
pub use defillama::DefiLlamaMarketSource;
pub use ecb::EcbMarketSource;
pub use eia::EiaMarketSource;
pub use finnhub::FinnhubClient as FinnhubMarketSource;
pub use finra::FinraMarketSource;
pub use fourchan::FourchanMarketSource;
pub use fred::FredMarketSource;
pub use github::GithubMarketSource;
pub use hackernews::HackerNewsMarketSource;
pub use nasdaq::{
    BchainMarketSource, CftcMarketSource, ChrisMarketSource, ImfMarketSource, OpecMarketSource,
};
pub use npm::NpmMarketSource;
pub use openmeteo::OpenMeteoMarketSource;
pub use polymarket::PolymarketMarketSource;
pub use pypi::PypiMarketSource;
pub use sec_edgar::SecEdgarMarketSource;
pub use steam::SteamMarketSource;
pub use tmdb::TmdbMarketSource;
pub use treasury::TreasuryMarketSource;
pub use twitch::TwitchMarketSource;
pub use twse::TwseMarketSource;
pub use worldbank::WorldBankMarketSource;
pub use zillow::ZillowMarketSource;

// Re-exports — Index-only sources
pub use finra_short_vol::FinraShortVolMarketSource;
pub use sec_efts::SecEftsMarketSource;
pub use sec_insider::SecInsiderMarketSource;
