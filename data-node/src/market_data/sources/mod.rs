//! Market data source implementations (44 providers)
//!
//! Contains implementations for all supported data sources.

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

// Bet on Everything sources (14)
pub mod gtfs_rt;
pub mod volcano;
pub mod earthquake;
pub mod spaceweather;
pub mod wildfire;
pub mod flights;
pub mod maritime;
pub mod epidemic;
pub mod sports;
pub mod iss;
pub mod weather_alerts;
pub mod animals;
pub mod movebank;
pub mod ebird;
pub mod aisstream;
pub mod mil_aircraft;
pub mod usa_spending;
pub mod pumpfun;

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

// Re-exports — Bet on Everything sources
pub use volcano::VolcanoMarketSource;
pub use earthquake::EarthquakeMarketSource;
pub use spaceweather::SpaceweatherMarketSource;
pub use wildfire::WildfireMarketSource;
pub use flights::FlightsMarketSource;
pub use maritime::MaritimeMarketSource;
pub use epidemic::EpidemicMarketSource;
pub use sports::SportsMarketSource;
pub use iss::IssMarketSource;
pub use weather_alerts::WeatherAlertsMarketSource;
pub use animals::AnimalsMarketSource;
pub use movebank::MovebankMarketSource;
pub use ebird::EbirdMarketSource;
pub use gtfs_rt::GtfsRtMarketSource;
pub use aisstream::AisStreamMarketSource;
pub use mil_aircraft::MilAircraftMarketSource;
pub use usa_spending::UsaSpendingMarketSource;
pub use pumpfun::PumpfunMarketSource;

// Re-exports — Index-only sources
pub use finra_short_vol::FinraShortVolMarketSource;
pub use sec_efts::SecEftsMarketSource;
pub use sec_insider::SecInsiderMarketSource;
