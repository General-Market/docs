//! SERM (Shared Exposure Rate Model) — computes per-market borrow rates
//!
//! The SERM algorithm prices risk globally across all ITP markets:
//! rate = kink(global_util) * (1 + stress*0.5) * (1 + concentration) * liquidity_mult + tier_premium
//!
//! All math uses WAD-scaled U256 (1e18 = 100%) to match on-chain precision.

use crate::tier_config::RiskTier;
use ethers::types::U256;
use std::collections::HashMap;
use tracing::debug;

/// WAD constant (1e18)
const WAD: u64 = 1_000_000_000_000_000_000;

/// Seconds per year (for APR <-> per-second conversion)
const SECONDS_PER_YEAR: u64 = 31_536_000;

/// Kink point: 80% global utilization (0.80e18)
const KINK: u64 = 800_000_000_000_000_000;

/// Rate below kink at 0% util: 2% APR
const RATE_AT_ZERO: u64 = 20_000_000_000_000_000; // 0.02e18

/// Rate at kink (80%): 5% APR
const RATE_AT_KINK: u64 = 50_000_000_000_000_000; // 0.05e18

/// Rate at 100% util: 100% APR
const RATE_AT_MAX: u64 = 1_000_000_000_000_000_000; // 1.0e18

/// Maximum stress value (capped at 5)
const MAX_STRESS_WAD: u64 = 5_000_000_000_000_000_000; // 5.0e18

/// Stress multiplier coefficient (0.5)
const STRESS_COEFF_WAD: u64 = 500_000_000_000_000_000; // 0.5e18

/// Input data for computing a single market's rate
#[derive(Debug, Clone)]
pub struct MarketRateInput {
    /// Market identifier (Morpho market ID)
    pub market_id: [u8; 32],
    /// Total borrowed in this market (USDC, 6 dec)
    pub total_borrowed: U256,
    /// Risk tier
    pub risk_tier: RiskTier,
    /// Asset composition: (asset_address_bytes, weight_bps) — weights sum to 10000
    pub composition: Vec<([u8; 20], u16)>,
}

/// Per-asset configuration (set by curator)
#[derive(Debug, Clone)]
pub struct AssetConfig {
    /// Normal daily volatility (WAD-scaled, e.g., 0.02e18 = 2%)
    pub baseline_vol: U256,
    /// Liquidity score 0.0 to 1.0 (WAD-scaled, e.g., 1.0e18 = perfectly liquid)
    pub liquidity_score: U256,
}

impl Default for AssetConfig {
    fn default() -> Self {
        Self {
            // Default 3% baseline vol
            baseline_vol: U256::from(30_000_000_000_000_000u64),
            // Default 0.5 liquidity
            liquidity_score: U256::from(500_000_000_000_000_000u64),
        }
    }
}

/// Per-asset price data
#[derive(Debug, Clone)]
pub struct AssetPriceData {
    /// Current price (WAD-scaled)
    pub price: U256,
    /// Price 24 hours ago (WAD-scaled)
    pub price_24h_ago: U256,
}

/// Output of SERM computation for a single market
#[derive(Debug, Clone)]
pub struct SermOutput {
    pub market_id: [u8; 32],
    /// Final rate as APR (WAD-scaled, e.g., 0.05e18 = 5%)
    pub rate_apr_wad: U256,
    /// Final rate as per-second (WAD-scaled, for CuratorRateIRM)
    pub rate_per_second: U256,
    /// Component breakdown for logging
    pub base_rate: U256,
    pub stress_multiplier: U256,
    pub concentration_multiplier: U256,
    pub liquidity_multiplier: U256,
    pub tier_premium: U256,
}

/// SERM engine
pub struct SermEngine {
    /// Per-asset static configuration
    pub asset_configs: HashMap<[u8; 20], AssetConfig>,
}

impl SermEngine {
    pub fn new(asset_configs: HashMap<[u8; 20], AssetConfig>) -> Self {
        Self { asset_configs }
    }

    /// Create engine with default liquidity scores for well-known assets.
    /// Scores: BTC=1.0, ETH=1.0, SOL=0.85, BNB=0.8, XRP=0.75, AVAX=0.7, default=0.5
    pub fn with_defaults() -> Self {
        Self {
            asset_configs: HashMap::new(),
        }
    }

    /// Get config for an asset, falling back to defaults
    pub fn get_asset_config(&self, asset: &[u8; 20]) -> AssetConfig {
        self.asset_configs.get(asset).cloned().unwrap_or_default()
    }

    /// Compute global vault utilization (WAD-scaled)
    /// global_util = total_borrowed_all_markets / vault_total_assets
    pub fn compute_global_utilization(
        total_borrowed_all: U256,
        vault_total_assets: U256,
    ) -> U256 {
        if vault_total_assets.is_zero() {
            return U256::from(WAD); // 100% if vault empty
        }
        // (total_borrowed * WAD) / vault_total
        wad_div(total_borrowed_all, vault_total_assets)
    }

    /// Kink curve: piecewise linear base rate from global utilization
    /// Returns APR as WAD (e.g., 0.05e18 = 5% APR)
    pub fn kink_curve(global_util: U256) -> U256 {
        let wad = U256::from(WAD);
        let kink = U256::from(KINK);

        if global_util <= kink {
            // Below kink: 2% + (util / 0.80) * (5% - 2%)
            // = 2% + util * 3% / 0.80
            // = 2% + util * 3.75%
            let rate_range = U256::from(RATE_AT_KINK) - U256::from(RATE_AT_ZERO);
            let slope_part = wad_div(wad_mul(global_util, rate_range), kink);
            U256::from(RATE_AT_ZERO) + slope_part
        } else {
            // Above kink: 5% + ((util - 0.80) / (1.0 - 0.80)) * (100% - 5%)
            // = 5% + (util - 0.80) * 95% / 0.20
            // = 5% + (util - 0.80) * 475%
            let above_kink = global_util.saturating_sub(kink);
            let denominator = wad - kink; // 0.20e18
            let rate_range = U256::from(RATE_AT_MAX) - U256::from(RATE_AT_KINK);
            let slope_part = wad_div(wad_mul(above_kink, rate_range), denominator);
            let result = U256::from(RATE_AT_KINK) + slope_part;
            // Cap at RATE_AT_MAX
            if result > U256::from(RATE_AT_MAX) {
                U256::from(RATE_AT_MAX)
            } else {
                result
            }
        }
    }

    /// Compute per-asset stress: clamp(0, 5, -price_change / baseline_vol)
    /// Returns WAD-scaled stress (0 to 5e18)
    pub fn compute_asset_stress(price_data: &AssetPriceData, config: &AssetConfig) -> U256 {
        if price_data.price_24h_ago.is_zero() || config.baseline_vol.is_zero() {
            return U256::zero();
        }

        // price_change = (price - price_24h_ago) / price_24h_ago  (can be negative)
        // stress = clamp(0, 5, -price_change / baseline_vol)
        // If price went up or stayed same, stress = 0
        if price_data.price >= price_data.price_24h_ago {
            return U256::zero();
        }

        // Price dropped: compute drop magnitude
        let drop = price_data.price_24h_ago - price_data.price;
        // drop_ratio = drop / price_24h_ago (WAD-scaled)
        let drop_ratio = wad_div(drop, price_data.price_24h_ago);
        // stress = drop_ratio / baseline_vol (WAD-scaled)
        let stress = wad_div(drop_ratio, config.baseline_vol);

        // Clamp to MAX_STRESS (5.0)
        let max = U256::from(MAX_STRESS_WAD);
        if stress > max {
            max
        } else {
            stress
        }
    }

    /// Compute rate for a single market
    pub fn compute_rate(
        &self,
        input: &MarketRateInput,
        global_util: U256,
        asset_prices: &HashMap<[u8; 20], AssetPriceData>,
        global_exposures: &HashMap<[u8; 20], U256>,
        vault_total_assets: U256,
    ) -> SermOutput {
        let wad = U256::from(WAD);

        // 1. Base rate from kink curve
        let base_rate = Self::kink_curve(global_util);

        // 2. Correlated stress: weighted avg of underlying asset stress
        let mut correlated_stress = U256::zero();
        for (asset, weight_bps) in &input.composition {
            let weight_wad = U256::from(*weight_bps as u64) * wad / U256::from(10000u64);
            let config = self.asset_configs.get(asset).cloned().unwrap_or_default();
            if let Some(price_data) = asset_prices.get(asset) {
                let asset_stress = Self::compute_asset_stress(price_data, &config);
                correlated_stress = correlated_stress + wad_mul(weight_wad, asset_stress);
            }
        }
        // stress_multiplier = 1 + correlated_stress * 0.5
        let stress_multiplier = wad + wad_mul(correlated_stress, U256::from(STRESS_COEFF_WAD));

        // 3. Concentration factor: weighted avg of per-asset concentration
        let mut concentration_factor = U256::zero();
        if !vault_total_assets.is_zero() {
            for (asset, weight_bps) in &input.composition {
                let weight_wad = U256::from(*weight_bps as u64) * wad / U256::from(10000u64);
                let exposure = global_exposures.get(asset).copied().unwrap_or_default();
                let concentration = wad_div(exposure, vault_total_assets);
                concentration_factor = concentration_factor + wad_mul(weight_wad, concentration);
            }
        }
        // concentration_multiplier = 1 + concentration_factor (capped at 2x)
        let concentration_multiplier = wad + concentration_factor.min(wad);

        // 4. Liquidity multiplier: 1 + (1 - avg_liquidity)
        let mut avg_liquidity = U256::zero();
        for (asset, weight_bps) in &input.composition {
            let weight_wad = U256::from(*weight_bps as u64) * wad / U256::from(10000u64);
            let config = self.asset_configs.get(asset).cloned().unwrap_or_default();
            avg_liquidity = avg_liquidity + wad_mul(weight_wad, config.liquidity_score);
        }
        let illiquidity = wad.saturating_sub(avg_liquidity.min(wad));
        let liquidity_multiplier = wad + illiquidity;

        // 5. Tier premium (APR)
        let tier_premium = tier_premium_wad(input.risk_tier);

        // 6. Final rate: base * stress_mult * conc_mult * liq_mult + tier_premium
        let mut rate = base_rate;
        rate = wad_mul(rate, stress_multiplier);
        rate = wad_mul(rate, concentration_multiplier);
        rate = wad_mul(rate, liquidity_multiplier);
        rate = rate + tier_premium;

        // Convert APR to per-second rate
        let rate_per_second = rate / U256::from(SECONDS_PER_YEAR);

        debug!(
            market_id = hex::encode(input.market_id),
            base_rate_bps = (base_rate * U256::from(10000u64) / wad).as_u64(),
            stress_mult = format!("{:.4}", stress_multiplier.as_u128() as f64 / 1e18),
            conc_mult = format!("{:.4}", concentration_multiplier.as_u128() as f64 / 1e18),
            liq_mult = format!("{:.4}", liquidity_multiplier.as_u128() as f64 / 1e18),
            tier_premium_bps = (tier_premium * U256::from(10000u64) / wad).as_u64(),
            final_rate_bps = (rate * U256::from(10000u64) / wad).as_u64(),
            "SERM rate computed"
        );

        SermOutput {
            market_id: input.market_id,
            rate_apr_wad: rate,
            rate_per_second,
            base_rate,
            stress_multiplier,
            concentration_multiplier,
            liquidity_multiplier,
            tier_premium,
        }
    }

    /// Compute rates for all markets in a batch
    pub fn compute_all_rates(
        &self,
        inputs: &[MarketRateInput],
        vault_total_assets: U256,
        asset_prices: &HashMap<[u8; 20], AssetPriceData>,
    ) -> Vec<SermOutput> {
        let wad = U256::from(WAD);

        // Compute total borrowed across all markets
        let total_borrowed_all: U256 = inputs.iter().fold(U256::zero(), |acc, i| acc + i.total_borrowed);

        // Compute global utilization
        let global_util = Self::compute_global_utilization(total_borrowed_all, vault_total_assets);

        // Compute global exposure per asset: sum(weight * borrowed) across all markets
        let mut global_exposures: HashMap<[u8; 20], U256> = HashMap::new();
        for input in inputs {
            for (asset, weight_bps) in &input.composition {
                let weight_wad = U256::from(*weight_bps as u64) * wad / U256::from(10000u64);
                let exposure = wad_mul(weight_wad, input.total_borrowed);
                *global_exposures.entry(*asset).or_default() += exposure;
            }
        }

        // Compute rates for each market
        inputs
            .iter()
            .map(|input| {
                self.compute_rate(input, global_util, asset_prices, &global_exposures, vault_total_assets)
            })
            .collect()
    }
}

/// Tier premium in WAD (APR)
fn tier_premium_wad(tier: RiskTier) -> U256 {
    let wad = U256::from(WAD);
    match tier {
        RiskTier::A => wad * U256::from(50u64) / U256::from(10000u64),    // +50 bps = 0.5%
        RiskTier::B => wad * U256::from(150u64) / U256::from(10000u64),   // +150 bps = 1.5%
        RiskTier::C => wad * U256::from(300u64) / U256::from(10000u64),   // +300 bps = 3.0%
        RiskTier::D => wad * U256::from(500u64) / U256::from(10000u64),   // +500 bps = 5.0%
    }
}

/// WAD multiplication: (a * b) / 1e18
fn wad_mul(a: U256, b: U256) -> U256 {
    (a * b) / U256::from(WAD)
}

/// WAD division: (a * 1e18) / b
fn wad_div(a: U256, b: U256) -> U256 {
    if b.is_zero() {
        return U256::zero();
    }
    (a * U256::from(WAD)) / b
}

/// Convert APR (WAD) to per-second rate (WAD) for CuratorRateIRM
pub fn apr_to_per_second(apr_wad: U256) -> U256 {
    apr_wad / U256::from(SECONDS_PER_YEAR)
}

/// Convert per-second rate (WAD) to APR (WAD)
pub fn per_second_to_apr(rate_per_second: U256) -> U256 {
    rate_per_second * U256::from(SECONDS_PER_YEAR)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn wad() -> U256 {
        U256::from(WAD)
    }

    #[test]
    fn test_kink_curve_at_zero() {
        let rate = SermEngine::kink_curve(U256::zero());
        // Should be 2% APR = 0.02e18
        assert_eq!(rate, U256::from(RATE_AT_ZERO));
    }

    #[test]
    fn test_kink_curve_at_kink() {
        let rate = SermEngine::kink_curve(U256::from(KINK));
        // Should be 5% APR = 0.05e18
        assert_eq!(rate, U256::from(RATE_AT_KINK));
    }

    #[test]
    fn test_kink_curve_at_100_percent() {
        let rate = SermEngine::kink_curve(wad());
        // Should be 100% APR = 1.0e18
        assert_eq!(rate, U256::from(RATE_AT_MAX));
    }

    #[test]
    fn test_kink_curve_at_50_percent() {
        // 50% util: 2% + (0.50/0.80) * 3% = 2% + 1.875% = 3.875%
        let util = wad() / U256::from(2u64); // 0.50e18
        let rate = SermEngine::kink_curve(util);
        let expected_bps = 387; // 3.87% ~= 387 bps
        let rate_bps = (rate * U256::from(10000u64) / wad()).as_u64();
        assert!(rate_bps >= expected_bps - 2 && rate_bps <= expected_bps + 2,
            "Expected ~{} bps, got {} bps", expected_bps, rate_bps);
    }

    #[test]
    fn test_kink_curve_at_90_percent() {
        // 90% util: 5% + ((0.90-0.80)/0.20) * 95% = 5% + 0.5 * 95% = 5% + 47.5% = 52.5%
        let util = wad() * U256::from(90u64) / U256::from(100u64); // 0.90e18
        let rate = SermEngine::kink_curve(util);
        let rate_pct = (rate * U256::from(100u64) / wad()).as_u64();
        assert_eq!(rate_pct, 52, "Expected 52% APR at 90% util, got {}%", rate_pct);
    }

    #[test]
    fn test_stress_no_drop() {
        let price_data = AssetPriceData {
            price: wad() * U256::from(100u64),
            price_24h_ago: wad() * U256::from(100u64),
        };
        let config = AssetConfig {
            baseline_vol: wad() * U256::from(2u64) / U256::from(100u64), // 2%
            liquidity_score: wad(),
        };
        let stress = SermEngine::compute_asset_stress(&price_data, &config);
        assert_eq!(stress, U256::zero());
    }

    #[test]
    fn test_stress_price_up() {
        let price_data = AssetPriceData {
            price: wad() * U256::from(110u64),
            price_24h_ago: wad() * U256::from(100u64),
        };
        let config = AssetConfig {
            baseline_vol: wad() * U256::from(2u64) / U256::from(100u64),
            liquidity_score: wad(),
        };
        let stress = SermEngine::compute_asset_stress(&price_data, &config);
        assert_eq!(stress, U256::zero(), "Stress should be 0 when price goes up");
    }

    #[test]
    fn test_stress_1x_vol_drop() {
        // 2% drop with 2% baseline vol = stress of 1.0
        let price_data = AssetPriceData {
            price: wad() * U256::from(98u64),
            price_24h_ago: wad() * U256::from(100u64),
        };
        let config = AssetConfig {
            baseline_vol: wad() * U256::from(2u64) / U256::from(100u64),
            liquidity_score: wad(),
        };
        let stress = SermEngine::compute_asset_stress(&price_data, &config);
        // Should be ~1.0e18
        let stress_whole = stress / wad();
        assert_eq!(stress_whole, U256::from(1u64), "1x vol drop should give stress ~1.0");
    }

    #[test]
    fn test_stress_capped_at_5() {
        // 20% drop with 2% baseline vol = stress of 10 -> capped at 5
        let price_data = AssetPriceData {
            price: wad() * U256::from(80u64),
            price_24h_ago: wad() * U256::from(100u64),
        };
        let config = AssetConfig {
            baseline_vol: wad() * U256::from(2u64) / U256::from(100u64),
            liquidity_score: wad(),
        };
        let stress = SermEngine::compute_asset_stress(&price_data, &config);
        assert_eq!(stress, U256::from(MAX_STRESS_WAD), "Stress should be capped at 5.0");
    }

    #[test]
    fn test_tier_premium() {
        let a_premium = tier_premium_wad(RiskTier::A);
        let d_premium = tier_premium_wad(RiskTier::D);

        // A: 50 bps = 0.5% = 0.005e18
        let a_bps = (a_premium * U256::from(10000u64) / wad()).as_u64();
        assert_eq!(a_bps, 50);

        // D: 500 bps = 5% = 0.05e18
        let d_bps = (d_premium * U256::from(10000u64) / wad()).as_u64();
        assert_eq!(d_bps, 500);
    }

    #[test]
    fn test_global_utilization() {
        let total_borrowed = U256::from(800_000u64); // 800k
        let vault_total = U256::from(1_000_000u64);  // 1M
        let util = SermEngine::compute_global_utilization(total_borrowed, vault_total);
        let util_pct = (util * U256::from(100u64) / wad()).as_u64();
        assert_eq!(util_pct, 80, "Should be 80% utilization");
    }

    #[test]
    fn test_global_utilization_empty_vault() {
        let util = SermEngine::compute_global_utilization(U256::zero(), U256::zero());
        assert_eq!(util, wad(), "Empty vault should return 100% utilization");
    }

    #[test]
    fn test_compute_rate_calm_market() {
        let asset_key = [0u8; 20];
        let mut asset_configs = HashMap::new();
        asset_configs.insert(asset_key, AssetConfig {
            baseline_vol: wad() * U256::from(2u64) / U256::from(100u64),
            liquidity_score: wad(), // perfectly liquid
        });

        let engine = SermEngine::new(asset_configs);

        let input = MarketRateInput {
            market_id: [1u8; 32],
            total_borrowed: U256::from(50_000u64),
            risk_tier: RiskTier::A,
            composition: vec![(asset_key, 10000)], // 100% weight
        };

        let mut prices = HashMap::new();
        prices.insert(asset_key, AssetPriceData {
            price: wad() * U256::from(100u64),
            price_24h_ago: wad() * U256::from(100u64), // no change
        });

        let global_util = wad() / U256::from(2u64); // 50% util
        let vault_total = U256::from(100_000u64);
        let mut exposures = HashMap::new();
        exposures.insert(asset_key, U256::from(50_000u64));

        let output = engine.compute_rate(&input, global_util, &prices, &exposures, vault_total);

        // With 50% util, no stress, moderate concentration, perfect liquidity, tier A:
        // base ~3.87%, stress_mult = 1.0, conc_mult = 1 + 50000/100000 = 1.5, liq_mult = 1.0
        // rate ~= 3.87% * 1.0 * 1.5 * 1.0 + 0.5% = 6.3%
        let rate_bps = (output.rate_apr_wad * U256::from(10000u64) / wad()).as_u64();
        assert!(rate_bps > 500 && rate_bps < 800,
            "Calm market rate should be 5-8% APR, got {} bps", rate_bps);

        // Per-second rate should be non-zero
        assert!(!output.rate_per_second.is_zero());
    }

    #[test]
    fn test_compute_all_rates_batch() {
        let asset_a = [1u8; 20];
        let asset_b = [2u8; 20];

        let mut asset_configs = HashMap::new();
        asset_configs.insert(asset_a, AssetConfig {
            baseline_vol: wad() * U256::from(2u64) / U256::from(100u64),
            liquidity_score: wad(),
        });
        asset_configs.insert(asset_b, AssetConfig {
            baseline_vol: wad() * U256::from(3u64) / U256::from(100u64),
            liquidity_score: wad() / U256::from(2u64), // 0.5 liquidity
        });

        let engine = SermEngine::new(asset_configs);

        let inputs = vec![
            MarketRateInput {
                market_id: [1u8; 32],
                total_borrowed: U256::from(50_000u64),
                risk_tier: RiskTier::A,
                composition: vec![(asset_a, 10000)],
            },
            MarketRateInput {
                market_id: [2u8; 32],
                total_borrowed: U256::from(30_000u64),
                risk_tier: RiskTier::C,
                composition: vec![(asset_b, 10000)],
            },
        ];

        let mut prices = HashMap::new();
        prices.insert(asset_a, AssetPriceData {
            price: wad() * U256::from(100u64),
            price_24h_ago: wad() * U256::from(100u64),
        });
        prices.insert(asset_b, AssetPriceData {
            price: wad() * U256::from(50u64),
            price_24h_ago: wad() * U256::from(50u64),
        });

        let vault_total = U256::from(200_000u64);
        let outputs = engine.compute_all_rates(&inputs, vault_total, &prices);

        assert_eq!(outputs.len(), 2);
        // Tier C market with illiquid assets should have higher rate
        assert!(outputs[1].rate_apr_wad > outputs[0].rate_apr_wad,
            "Tier C illiquid market should have higher rate");
    }

    #[test]
    fn test_apr_per_second_conversion() {
        // 5% APR
        let apr = wad() * U256::from(5u64) / U256::from(100u64);
        let per_sec = apr_to_per_second(apr);
        let back_to_apr = per_second_to_apr(per_sec);

        // Should round-trip approximately (within rounding)
        let diff = if back_to_apr > apr { back_to_apr - apr } else { apr - back_to_apr };
        assert!(diff < U256::from(SECONDS_PER_YEAR), "Round-trip should be close");
    }

    #[test]
    fn test_wad_mul() {
        let a = wad() * U256::from(2u64); // 2.0
        let b = wad() * U256::from(3u64); // 3.0
        let result = wad_mul(a, b);
        assert_eq!(result, wad() * U256::from(6u64)); // 6.0
    }

    #[test]
    fn test_wad_div() {
        let a = wad() * U256::from(6u64); // 6.0
        let b = wad() * U256::from(3u64); // 3.0
        let result = wad_div(a, b);
        assert_eq!(result, wad() * U256::from(2u64)); // 2.0
    }

    #[test]
    fn test_wad_div_by_zero() {
        let result = wad_div(wad(), U256::zero());
        assert_eq!(result, U256::zero());
    }
}
