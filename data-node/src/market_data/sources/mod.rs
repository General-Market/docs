//! Market data source implementations (52 providers)
//!
//! Contains implementations for all supported data sources.

// Shared utilities
pub mod error;
pub mod http_client;
pub mod oauth;

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
pub mod lastfm;
pub mod treasury;
pub mod twitch;
pub mod twse;

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
pub mod reddit;
pub mod chaturbate;
pub mod pandascore;
pub mod usgs_water;
pub mod noaa_tides;
pub mod nrc_nuclear;
pub mod citybikes;
pub mod courtlistener;
pub mod openalex;
pub mod crossref;
pub mod pubmed;
pub mod stackexchange;
pub mod ndbc;
pub mod noaa_met;
pub mod nwps;
pub mod airnow;
pub mod cbp_border;
pub mod faa_delays;
pub mod shelter;
pub mod queue_times;
pub mod parking;
pub mod tomtom_traffic;
pub mod tomtom_evcharge;
pub mod bgg;
pub mod bestbuy;
pub mod adzuna;
pub mod yahoo_drinks;
pub mod db_trains;

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
pub use lastfm::LastfmMarketSource;
pub use treasury::TreasuryMarketSource;
pub use twitch::TwitchMarketSource;
pub use twse::TwseMarketSource;

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
pub use reddit::RedditMarketSource;
pub use chaturbate::ChaturbateMarketSource;
pub use pandascore::PandascoreMarketSource;
pub use usgs_water::UsgsWaterMarketSource;
pub use noaa_tides::NoaaTidesMarketSource;
pub use nrc_nuclear::NrcNuclearMarketSource;
pub use citybikes::CityBikesMarketSource;
pub use courtlistener::CourtListenerMarketSource;
pub use openalex::OpenAlexMarketSource;
pub use crossref::CrossrefMarketSource;
pub use pubmed::PubMedMarketSource;
pub use stackexchange::StackExchangeMarketSource;
pub use ndbc::NdbcMarketSource;
pub use noaa_met::NoaaMetMarketSource;
pub use nwps::NwpsMarketSource;
pub use airnow::AirnowMarketSource;
pub use cbp_border::CbpBorderMarketSource;
pub use faa_delays::FaaDelaysMarketSource;
pub use shelter::ShelterMarketSource;
pub use queue_times::QueueTimesMarketSource;
pub use parking::ParkingMarketSource;
pub use tomtom_traffic::TomtomTrafficMarketSource;
pub use tomtom_evcharge::TomtomEvchargeMarketSource;
pub use bgg::BggMarketSource;
pub use bestbuy::BestBuyMarketSource;
pub use adzuna::AdzunaMarketSource;
pub use yahoo_drinks::YahooDrinksMarketSource;
pub use db_trains::DbTrainsMarketSource;

// Re-exports — Index-only sources
pub use finra_short_vol::FinraShortVolMarketSource;
pub use sec_efts::SecEftsMarketSource;
pub use sec_insider::SecInsiderMarketSource;
