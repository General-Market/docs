import { SOURCES } from "./sources";

// Curated 48 logos shared by the OG card and the X banner so both
// render the same set of brands.
const PICKED_NAMES = [
  "Zillow Real Estate",
  "CoinGecko Crypto",
  "Polymarket Predictions",
  "USGS Earthquakes",
  "AniList Anime",
  "NYC 311 Complaints",
  "PubMed Medical",
  "DefiLlama DeFi",
  "Best Buy Products",
  "EIA Energy Data",
  "NYC Subway",
  "ISS Tracker",
  "FINRA Short Interest",
  "NOAA Weather",
  "TomTom Traffic",
  "eBird Observations",
  "SEC Filings",
  "Twitch Streaming",
  "GitHub Repositories",
  "Steam Gaming",
  "Hacker News",
  "Last.fm Music",
  "Reddit Communities",
  "Congress Votes",
  "Finnhub Stocks",
  "Nasdaq Listings",
  "Movies & TV",
  "Board Games",
  "Deutsche Bahn",
  "London Underground",
  "Paris Metro",
  "Airport Delays",
  "Ship Tracking",
  "Wildlife Tracking",
  "Military Aircraft",
  "Weather Alerts",
  "Air Quality",
  "Wildfire Tracking",
  "US Power Outages",
  "Global Flights",
  "CityBikes",
  "Federal Courts",
  "npm Packages",
  "Cloudflare DNS",
  "Theme Park Waits",
  "US Treasury Yields",
  "Bureau of Labor Stats",
  "Sports Stats",
];

export const OG_LOGOS = PICKED_NAMES.map((name) => {
  const found = SOURCES.find((s) => s.name === name);
  if (!found) {
    throw new Error(`Logo not found in SOURCES: ${name}`);
  }
  return found;
});
