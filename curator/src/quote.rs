//! Quote API — intent-based lending via off-chain computation
//!
//! POST /api/lending/quote
//!
//! Flow:
//! 1. Look up market for ITP → 404 if not found
//! 2. Get fresh BLS data (on-demand if stale)
//! 3. Read on-chain state (oracle price, market state)
//! 4. Run SERM for this market → push rate to CuratorRateIRM if changed
//! 5. Compute quote terms (HF, max borrow, liquidation price)
//! 6. Check crisis level → enforce min HF or reject
//! 7. Build Morpho Bundler multicall ABI-encoded calldata

use ethers::types::{Address, U256};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use thiserror::Error;

use crate::market_config::ParsedMarketConfig;

/// WAD constant (1e18)
const WAD: u64 = 1_000_000_000_000_000_000;

/// Quote request from the frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QuoteRequest {
    /// ITP token address
    #[serde(rename = "itpAddress")]
    pub itp_address: String,
    /// Collateral amount (ITP, 18 decimals)
    #[serde(rename = "collateralAmount")]
    pub collateral_amount: String,
    /// Borrow amount (USDC, 6 decimals)
    #[serde(rename = "borrowAmount")]
    pub borrow_amount: String,
}

/// Quote response to the frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QuoteResponse {
    /// Unique quote ID
    #[serde(rename = "quoteId")]
    pub quote_id: String,
    /// Quote expiration (unix timestamp)
    #[serde(rename = "expiresAt")]
    pub expires_at: u64,
    /// Loan terms
    pub terms: QuoteTerms,
    /// Market information
    pub market: QuoteMarket,
    /// Oracle update data for the bundler
    #[serde(rename = "oracleUpdate")]
    pub oracle_update: OracleUpdateData,
    /// Bundler transaction data
    pub bundler: BundlerData,
}

/// Loan terms in the quote
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QuoteTerms {
    /// Current APR percentage (e.g., "4.8")
    #[serde(rename = "borrowRate")]
    pub borrow_rate: String,
    /// Health factor after borrow (e.g., "1.54")
    #[serde(rename = "healthFactor")]
    pub health_factor: String,
    /// Liquidation price in USDC (e.g., "64.94")
    #[serde(rename = "liquidationPrice")]
    pub liquidation_price: String,
    /// Maximum borrowable USDC at current NAV + LLTV
    #[serde(rename = "maxBorrow")]
    pub max_borrow: String,
}

/// Market information in the quote
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QuoteMarket {
    /// Morpho market ID (hex)
    #[serde(rename = "marketId")]
    pub market_id: String,
    /// LLTV (WAD string)
    pub lltv: String,
    /// Oracle contract address
    #[serde(rename = "oracleAddress")]
    pub oracle_address: String,
    /// Current oracle price (WAD string)
    #[serde(rename = "currentOraclePrice")]
    pub current_oracle_price: String,
}

/// Oracle update data for the bundler multicall
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OracleUpdateData {
    /// NAV price (Morpho 36-decimal format)
    pub price: String,
    /// Issuer timestamp
    pub timestamp: u64,
    /// Cycle number
    #[serde(rename = "cycleNumber")]
    pub cycle_number: u64,
    /// Aggregated BLS signature (hex)
    #[serde(rename = "blsSignature")]
    pub bls_signature: String,
    /// Signers bitmask
    #[serde(rename = "signersBitmask")]
    pub signers_bitmask: String,
    /// Whether oracle is already fresh (hint to skip oracle push)
    #[serde(rename = "alreadyFresh")]
    pub already_fresh: bool,
}

/// Bundler transaction data
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BundlerData {
    /// Bundler contract address (or Morpho address for direct calls)
    pub to: String,
    /// ABI-encoded multicall calldata
    pub data: String,
    /// Human-readable description
    pub description: String,
    /// Steps in the bundle
    pub steps: Vec<String>,
}

/// Crisis level affecting quote API behavior
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum CrisisLevel {
    Normal,
    Elevated,
    Stress,
    Emergency,
}

impl CrisisLevel {
    /// Minimum health factor for new borrows at this crisis level
    pub fn min_health_factor(&self) -> U256 {
        let wad = U256::from(WAD);
        match self {
            CrisisLevel::Normal => wad * U256::from(12u64) / U256::from(10u64),     // 1.2
            CrisisLevel::Elevated => wad * U256::from(13u64) / U256::from(10u64),   // 1.3
            CrisisLevel::Stress => wad * U256::from(15u64) / U256::from(10u64),     // 1.5
            CrisisLevel::Emergency => U256::MAX, // reject all borrows
        }
    }
}

impl Default for CrisisLevel {
    fn default() -> Self {
        CrisisLevel::Normal
    }
}

/// Errors from the quote API
#[derive(Debug, Error)]
pub enum QuoteError {
    #[error("Market not found for ITP {0}")]
    MarketNotFound(String),

    #[error("Insufficient collateral: required HF {required_hf}, actual HF {actual_hf}")]
    InsufficientCollateral {
        required_hf: String,
        actual_hf: String,
    },

    #[error("Market frozen during emergency")]
    MarketFrozen,

    #[error("Oracle data unavailable: {0}")]
    OracleUnavailable(String),

    #[error("Rate limited, retry after {retry_after}s")]
    RateLimited { retry_after: u64 },

    #[error("Invalid request: {0}")]
    InvalidRequest(String),

    #[error("Internal error: {0}")]
    Internal(String),
}

impl QuoteError {
    /// HTTP status code for this error
    pub fn status_code(&self) -> u16 {
        match self {
            QuoteError::MarketNotFound(_) => 404,
            QuoteError::InsufficientCollateral { .. } => 400,
            QuoteError::MarketFrozen => 503,
            QuoteError::OracleUnavailable(_) => 503,
            QuoteError::RateLimited { .. } => 429,
            QuoteError::InvalidRequest(_) => 400,
            QuoteError::Internal(_) => 500,
        }
    }

    /// Error code string for JSON response
    pub fn error_code(&self) -> &str {
        match self {
            QuoteError::MarketNotFound(_) => "MARKET_NOT_FOUND",
            QuoteError::InsufficientCollateral { .. } => "INSUFFICIENT_COLLATERAL",
            QuoteError::MarketFrozen => "MARKET_FROZEN",
            QuoteError::OracleUnavailable(_) => "ORACLE_UNAVAILABLE",
            QuoteError::RateLimited { .. } => "RATE_LIMITED",
            QuoteError::InvalidRequest(_) => "INVALID_REQUEST",
            QuoteError::Internal(_) => "INTERNAL_ERROR",
        }
    }
}

/// In-memory rate limiter per API key
pub struct RateLimiter {
    /// Requests per window
    max_requests: u32,
    /// Window duration
    window: Duration,
    /// Key → (count, window_start)
    state: HashMap<String, (u32, Instant)>,
}

impl RateLimiter {
    pub fn new(max_requests: u32, window: Duration) -> Self {
        Self {
            max_requests,
            window,
            state: HashMap::new(),
        }
    }

    /// Check if a request is allowed for the given key
    pub fn check(&mut self, key: &str) -> Result<(), QuoteError> {
        let now = Instant::now();

        let entry = self.state.entry(key.to_string()).or_insert((0, now));

        // Reset window if expired
        if now.duration_since(entry.1) > self.window {
            *entry = (0, now);
        }

        if entry.0 >= self.max_requests {
            return Err(QuoteError::RateLimited {
                retry_after: self.window.as_secs().saturating_sub(now.duration_since(entry.1).as_secs()),
            });
        }

        entry.0 += 1;
        Ok(())
    }
}

/// Quote computation engine (stateless computation, no network calls)
pub struct QuoteEngine;

impl QuoteEngine {
    /// Compute health factor for a position
    /// HF = (collateral_amount * oracle_price / 1e36) * (lltv / 1e18) / debt_amount
    pub fn compute_health_factor(
        collateral_amount: U256, // 18 decimals
        oracle_price: U256,      // 36 decimals (Morpho format)
        lltv: U256,              // 18 decimals
        debt_amount: U256,       // 6 decimals
    ) -> U256 {
        if debt_amount.is_zero() {
            return U256::MAX; // Infinite HF with no debt
        }

        let wad = U256::from(WAD);
        // collateral_value = collateral_amount * oracle_price / 1e36
        // This gives value in loan token decimals (6 for USDC)
        let collateral_value = collateral_amount * oracle_price / U256::exp10(36);
        // max_borrow_value = collateral_value * lltv / 1e18
        let max_borrow_value = collateral_value * lltv / wad;
        // HF = max_borrow_value * 1e18 / debt_amount (WAD-scaled result)
        max_borrow_value * wad / debt_amount
    }

    /// Compute maximum borrowable amount
    /// max_borrow = collateral_amount * oracle_price / 1e36 * lltv / 1e18
    pub fn compute_max_borrow(
        collateral_amount: U256,
        oracle_price: U256,
        lltv: U256,
    ) -> U256 {
        let wad = U256::from(WAD);
        let collateral_value = collateral_amount * oracle_price / U256::exp10(36);
        collateral_value * lltv / wad
    }

    /// Compute liquidation price (price at which HF = 1.0)
    /// At liquidation: collateral * price / 1e36 * lltv / 1e18 = debt
    /// => price = debt * 1e36 * 1e18 / (collateral * lltv)
    pub fn compute_liquidation_price(
        collateral_amount: U256,
        lltv: U256,
        debt_amount: U256,
    ) -> U256 {
        if collateral_amount.is_zero() || lltv.is_zero() {
            return U256::zero();
        }
        // price_36dec = debt * 1e36 * 1e18 / (collateral * lltv)
        // Simplify: debt * 1e54 / (collateral * lltv)
        debt_amount * U256::exp10(54) / (collateral_amount * lltv)
    }

    /// Convert per-second rate to APR percentage string (e.g., "4.8")
    pub fn rate_to_apr_string(rate_per_second: U256) -> String {
        // apr_wad = rate_per_second * 31536000
        let apr_wad = rate_per_second * U256::from(31_536_000u64);
        // Convert to percentage with 1 decimal: apr_pct_x10 = apr_wad * 1000 / 1e18
        let apr_pct_x10 = apr_wad * U256::from(1000u64) / U256::from(WAD);
        let whole = apr_pct_x10.as_u64() / 10;
        let frac = apr_pct_x10.as_u64() % 10;
        format!("{}.{}", whole, frac)
    }

    /// Convert oracle price (36 dec) to human-readable USDC price string
    /// Oracle price format: price * 10^(36 + loanDec - collateralDec)
    /// For USDC(6)/ITP(18): price * 10^(36+6-18) = price * 10^24
    /// So 1e24 = $1.00
    pub fn oracle_price_to_string(oracle_price: U256) -> String {
        // price_cents = oracle_price * 100 / 1e24
        let price_cents = oracle_price * U256::from(100u64) / U256::exp10(24);
        let whole = price_cents.as_u64() / 100;
        let frac = price_cents.as_u64() % 100;
        format!("{}.{:02}", whole, frac)
    }

    /// Format WAD-scaled health factor as string (e.g., "1.54")
    pub fn hf_to_string(hf: U256) -> String {
        let hf_x100 = hf * U256::from(100u64) / U256::from(WAD);
        let whole = hf_x100.as_u64() / 100;
        let frac = hf_x100.as_u64() % 100;
        format!("{}.{:02}", whole, frac)
    }

    /// Build a quote response from computed values
    pub fn build_quote(
        market_config: &ParsedMarketConfig,
        collateral_amount: U256,
        borrow_amount: U256,
        oracle_price: U256,
        rate_per_second: U256,
        bls_price: U256,
        bls_timestamp: u64,
        bls_cycle_number: u64,
        bls_signature: &[u8],
        bls_bitmask: U256,
        oracle_already_fresh: bool,
        crisis_level: CrisisLevel,
    ) -> Result<QuoteResponse, QuoteError> {
        // Check crisis level — reject if emergency
        if crisis_level == CrisisLevel::Emergency {
            return Err(QuoteError::MarketFrozen);
        }

        // Compute terms
        let hf = Self::compute_health_factor(
            collateral_amount,
            oracle_price,
            market_config.lltv,
            borrow_amount,
        );

        // Enforce minimum HF
        let min_hf = crisis_level.min_health_factor();
        if hf < min_hf {
            return Err(QuoteError::InsufficientCollateral {
                required_hf: Self::hf_to_string(min_hf),
                actual_hf: Self::hf_to_string(hf),
            });
        }

        let max_borrow = Self::compute_max_borrow(
            collateral_amount,
            oracle_price,
            market_config.lltv,
        );

        let liquidation_price = Self::compute_liquidation_price(
            collateral_amount,
            market_config.lltv,
            borrow_amount,
        );

        // Generate quote ID
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default();
        let quote_id = format!("q-{:x}{:x}", now.as_secs(), now.subsec_nanos());

        // Quote expires in 5 minutes
        let expires_at = now.as_secs() + 300;

        let market_id_hex = format!("0x{}", hex::encode(market_config.market_id));
        let sig_hex = format!("0x{}", hex::encode(bls_signature));

        // Build bundler steps
        let steps = if oracle_already_fresh {
            vec![
                "Approve ITP as collateral".to_string(),
                "Deposit ITP collateral".to_string(),
                "Borrow USDC".to_string(),
            ]
        } else {
            vec![
                "Push BLS-signed NAV price".to_string(),
                "Approve ITP as collateral".to_string(),
                "Deposit ITP collateral".to_string(),
                "Borrow USDC".to_string(),
            ]
        };

        // Build calldata (ABI-encoded multicall)
        let calldata = Self::build_bundler_calldata(
            market_config,
            collateral_amount,
            borrow_amount,
            bls_price,
            bls_timestamp,
            bls_cycle_number,
            bls_signature,
            bls_bitmask,
            oracle_already_fresh,
        );

        Ok(QuoteResponse {
            quote_id,
            expires_at,
            terms: QuoteTerms {
                borrow_rate: Self::rate_to_apr_string(rate_per_second),
                health_factor: Self::hf_to_string(hf),
                liquidation_price: Self::oracle_price_to_string(liquidation_price),
                max_borrow: max_borrow.to_string(),
            },
            market: QuoteMarket {
                market_id: market_id_hex,
                lltv: market_config.lltv.to_string(),
                oracle_address: format!("{:?}", market_config.oracle_address),
                current_oracle_price: oracle_price.to_string(),
            },
            oracle_update: OracleUpdateData {
                price: bls_price.to_string(),
                timestamp: bls_timestamp,
                cycle_number: bls_cycle_number,
                bls_signature: sig_hex,
                signers_bitmask: bls_bitmask.to_string(),
                already_fresh: oracle_already_fresh,
            },
            bundler: BundlerData {
                to: format!("{:?}", market_config.bundler_address),
                data: format!("0x{}", hex::encode(&calldata)),
                description: "Atomic bundle: push oracle → approve → supply collateral → borrow".to_string(),
                steps,
            },
        })
    }

    /// Build Morpho Bundler multicall ABI-encoded calldata
    /// Steps: [updatePrice, approve, supplyCollateral, borrow]
    fn build_bundler_calldata(
        market_config: &ParsedMarketConfig,
        collateral_amount: U256,
        borrow_amount: U256,
        bls_price: U256,
        bls_timestamp: u64,
        bls_cycle_number: u64,
        bls_signature: &[u8],
        bls_bitmask: U256,
        oracle_already_fresh: bool,
    ) -> Vec<u8> {
        let mut calls: Vec<Vec<u8>> = Vec::new();

        // Step 1: updatePrice on oracle (skip if already fresh)
        if !oracle_already_fresh {
            let update_selector =
                &ethers::utils::keccak256(b"updatePrice(uint256,uint256,uint256,bytes,uint256)")[..4];
            let update_params = ethers::abi::encode(&[
                ethers::abi::Token::Uint(bls_price),
                ethers::abi::Token::Uint(U256::from(bls_timestamp)),
                ethers::abi::Token::Uint(U256::from(bls_cycle_number)),
                ethers::abi::Token::Bytes(bls_signature.to_vec()),
                ethers::abi::Token::Uint(bls_bitmask),
            ]);
            let mut call = update_selector.to_vec();
            call.extend_from_slice(&update_params);
            calls.push(call);
        }

        // Step 2: supplyCollateral
        // morpho.supplyCollateral(MarketParams, amount, onBehalf, data)
        // For bundler: this is encoded as a multicall step
        let supply_selector =
            &ethers::utils::keccak256(b"supplyCollateral(bytes32,uint256,address,bytes)")[..4];
        let supply_params = ethers::abi::encode(&[
            ethers::abi::Token::FixedBytes(market_config.market_id.to_vec()),
            ethers::abi::Token::Uint(collateral_amount),
            ethers::abi::Token::Address(Address::zero()), // onBehalf placeholder (user fills)
            ethers::abi::Token::Bytes(vec![]),
        ]);
        let mut supply_call = supply_selector.to_vec();
        supply_call.extend_from_slice(&supply_params);
        calls.push(supply_call);

        // Step 3: borrow
        // morpho.borrow(MarketParams, amount, shares, onBehalf, receiver)
        let borrow_selector =
            &ethers::utils::keccak256(b"borrow(bytes32,uint256,uint256,address,address)")[..4];
        let borrow_params = ethers::abi::encode(&[
            ethers::abi::Token::FixedBytes(market_config.market_id.to_vec()),
            ethers::abi::Token::Uint(borrow_amount),
            ethers::abi::Token::Uint(U256::zero()), // shares = 0 (use amount)
            ethers::abi::Token::Address(Address::zero()), // onBehalf placeholder
            ethers::abi::Token::Address(Address::zero()), // receiver placeholder
        ]);
        let mut borrow_call = borrow_selector.to_vec();
        borrow_call.extend_from_slice(&borrow_params);
        calls.push(borrow_call);

        // Encode as multicall: multicall(bytes[])
        let multicall_selector = &ethers::utils::keccak256(b"multicall(bytes[])")[..4];
        let calls_tokens: Vec<ethers::abi::Token> =
            calls.into_iter().map(ethers::abi::Token::Bytes).collect();
        let multicall_params =
            ethers::abi::encode(&[ethers::abi::Token::Array(calls_tokens)]);

        let mut result = multicall_selector.to_vec();
        result.extend_from_slice(&multicall_params);
        result
    }
}

/// Validate a quote request and parse addresses/amounts
pub fn parse_quote_request(
    request: &QuoteRequest,
) -> Result<(Address, U256, U256), QuoteError> {
    let itp_address: Address = request
        .itp_address
        .parse()
        .map_err(|_| QuoteError::InvalidRequest("Invalid ITP address".to_string()))?;

    let collateral_amount = U256::from_dec_str(&request.collateral_amount)
        .map_err(|_| QuoteError::InvalidRequest("Invalid collateral amount".to_string()))?;

    let borrow_amount = U256::from_dec_str(&request.borrow_amount)
        .map_err(|_| QuoteError::InvalidRequest("Invalid borrow amount".to_string()))?;

    if collateral_amount.is_zero() {
        return Err(QuoteError::InvalidRequest("Collateral amount must be > 0".to_string()));
    }

    if borrow_amount.is_zero() {
        return Err(QuoteError::InvalidRequest("Borrow amount must be > 0".to_string()));
    }

    Ok((itp_address, collateral_amount, borrow_amount))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_compute_health_factor() {
        // 100 ITP collateral, oracle $1.00 (1e24), 77% LLTV, 50 USDC debt
        let collateral = U256::from(100u64) * U256::exp10(18);
        let price = U256::exp10(24); // $1.00
        let lltv = U256::from(770_000_000_000_000_000u64); // 77%
        let debt = U256::from(50u64) * U256::exp10(6); // 50 USDC

        let hf = QuoteEngine::compute_health_factor(collateral, price, lltv, debt);
        // Expected: (100 * 1e24 / 1e36) * (0.77e18 / 1e18) / 50e6
        // = (100e-12) * 0.77 / 50e6
        // = 77e-12 / 50e6
        // This doesn't work with integer precision...
        // Let me recalculate:
        // collateral_value = 100e18 * 1e24 / 1e36 = 100e6 (100 USDC)
        // max_borrow_value = 100e6 * 0.77e18 / 1e18 = 77e6 (77 USDC)
        // HF = 77e6 * 1e18 / 50e6 = 1.54e18
        let expected_hf = U256::from(154u64) * U256::from(WAD) / U256::from(100u64);
        assert_eq!(hf, expected_hf, "HF should be 1.54");
    }

    #[test]
    fn test_compute_health_factor_zero_debt() {
        let collateral = U256::from(100u64) * U256::exp10(18);
        let price = U256::exp10(24);
        let lltv = U256::from(770_000_000_000_000_000u64);

        let hf = QuoteEngine::compute_health_factor(collateral, price, lltv, U256::zero());
        assert_eq!(hf, U256::MAX, "HF should be MAX with zero debt");
    }

    #[test]
    fn test_compute_max_borrow() {
        let collateral = U256::from(100u64) * U256::exp10(18);
        let price = U256::exp10(24); // $1.00
        let lltv = U256::from(770_000_000_000_000_000u64);

        let max_borrow = QuoteEngine::compute_max_borrow(collateral, price, lltv);
        // 100 ITP * $1.00 * 77% = 77 USDC = 77e6
        assert_eq!(max_borrow, U256::from(77_000_000u64));
    }

    #[test]
    fn test_compute_liquidation_price() {
        let collateral = U256::from(100u64) * U256::exp10(18);
        let lltv = U256::from(770_000_000_000_000_000u64);
        let debt = U256::from(50u64) * U256::exp10(6); // 50 USDC

        let liq_price = QuoteEngine::compute_liquidation_price(collateral, lltv, debt);
        // At liquidation: collateral * price / 1e36 * lltv / 1e18 = debt
        // price = debt * 1e54 / (collateral * lltv)
        // = 50e6 * 1e54 / (100e18 * 0.77e18)
        // = 50e60 / 77e36
        // = 0.649e24 ≈ $0.65
        let liq_price_cents = liq_price * U256::from(100u64) / U256::exp10(24);
        assert!(
            liq_price_cents.as_u64() >= 64 && liq_price_cents.as_u64() <= 65,
            "Liquidation price should be ~$0.65, got {} cents",
            liq_price_cents
        );
    }

    #[test]
    fn test_rate_to_apr_string() {
        // 5% APR per second: 5e16 / 31536000 ≈ 1585489599
        // Due to integer rounding, 1585489599 * 31536000 = 49.999...e15 → displays as 4.9
        // Use a slightly higher rate to get exact 5.0: ceil(5e16/31536000) = 1585489600
        let rate = U256::from(1_585_489_600u64);
        let apr = QuoteEngine::rate_to_apr_string(rate);
        assert_eq!(apr, "5.0", "5% APR should display as 5.0, got {}", apr);

        // Test with the truncated value
        let rate_trunc = U256::from(1_585_489_599u64);
        let apr_trunc = QuoteEngine::rate_to_apr_string(rate_trunc);
        assert_eq!(apr_trunc, "4.9", "Truncated 5% APR displays as 4.9");
    }

    #[test]
    fn test_oracle_price_to_string() {
        let price = U256::exp10(24); // $1.00
        let s = QuoteEngine::oracle_price_to_string(price);
        assert_eq!(s, "1.00");

        let price_half = U256::exp10(24) / U256::from(2u64); // $0.50
        let s2 = QuoteEngine::oracle_price_to_string(price_half);
        assert_eq!(s2, "0.50");
    }

    #[test]
    fn test_hf_to_string() {
        let wad = U256::from(WAD);
        let hf = wad * U256::from(154u64) / U256::from(100u64); // 1.54
        let s = QuoteEngine::hf_to_string(hf);
        assert_eq!(s, "1.54");
    }

    #[test]
    fn test_crisis_level_min_hf() {
        let wad = U256::from(WAD);
        assert_eq!(
            CrisisLevel::Normal.min_health_factor(),
            wad * U256::from(12u64) / U256::from(10u64)
        );
        assert_eq!(
            CrisisLevel::Elevated.min_health_factor(),
            wad * U256::from(13u64) / U256::from(10u64)
        );
        assert_eq!(
            CrisisLevel::Stress.min_health_factor(),
            wad * U256::from(15u64) / U256::from(10u64)
        );
        assert_eq!(CrisisLevel::Emergency.min_health_factor(), U256::MAX);
    }

    #[test]
    fn test_parse_quote_request_valid() {
        let req = QuoteRequest {
            itp_address: "0x1111111111111111111111111111111111111111".to_string(),
            collateral_amount: "100000000000000000000".to_string(),
            borrow_amount: "50000000".to_string(),
        };
        let (addr, collateral, borrow) = parse_quote_request(&req).unwrap();
        assert_eq!(collateral, U256::from(100u64) * U256::exp10(18));
        assert_eq!(borrow, U256::from(50_000_000u64));
    }

    #[test]
    fn test_parse_quote_request_invalid_address() {
        let req = QuoteRequest {
            itp_address: "not-an-address".to_string(),
            collateral_amount: "100".to_string(),
            borrow_amount: "50".to_string(),
        };
        assert!(parse_quote_request(&req).is_err());
    }

    #[test]
    fn test_parse_quote_request_zero_collateral() {
        let req = QuoteRequest {
            itp_address: "0x1111111111111111111111111111111111111111".to_string(),
            collateral_amount: "0".to_string(),
            borrow_amount: "50".to_string(),
        };
        assert!(parse_quote_request(&req).is_err());
    }

    #[test]
    fn test_rate_limiter() {
        let mut limiter = RateLimiter::new(2, Duration::from_secs(60));
        assert!(limiter.check("key1").is_ok());
        assert!(limiter.check("key1").is_ok());
        assert!(limiter.check("key1").is_err()); // 3rd request blocked
        assert!(limiter.check("key2").is_ok()); // different key OK
    }

    #[test]
    fn test_build_quote_emergency_rejects() {
        let config = ParsedMarketConfig {
            market_id: [1u8; 32],
            itp_address: Address::zero(),
            oracle_address: Address::zero(),
            lltv: U256::from(770_000_000_000_000_000u64),
            risk_tier: crate::tier_config::RiskTier::A,
            composition: vec![],
            bundler_address: Address::zero(),
        };

        let result = QuoteEngine::build_quote(
            &config,
            U256::from(100u64) * U256::exp10(18),
            U256::from(50u64) * U256::exp10(6),
            U256::exp10(24),
            U256::from(1_585_489_599u64),
            U256::exp10(24),
            1_700_000_000,
            1,
            &[0u8; 64],
            U256::from(7u64),
            false,
            CrisisLevel::Emergency,
        );

        assert!(matches!(result, Err(QuoteError::MarketFrozen)));
    }

    #[test]
    fn test_build_quote_insufficient_collateral() {
        let config = ParsedMarketConfig {
            market_id: [1u8; 32],
            itp_address: Address::zero(),
            oracle_address: Address::zero(),
            lltv: U256::from(770_000_000_000_000_000u64),
            risk_tier: crate::tier_config::RiskTier::A,
            composition: vec![],
            bundler_address: Address::zero(),
        };

        // Try to borrow 90 USDC with 100 ITP at $1 and 77% LLTV
        // Max borrow = 77 USDC, HF = 77/90 = 0.855 < 1.2 min
        let result = QuoteEngine::build_quote(
            &config,
            U256::from(100u64) * U256::exp10(18),
            U256::from(90u64) * U256::exp10(6), // 90 USDC
            U256::exp10(24),
            U256::from(1_585_489_599u64),
            U256::exp10(24),
            1_700_000_000,
            1,
            &[0u8; 64],
            U256::from(7u64),
            false,
            CrisisLevel::Normal,
        );

        assert!(matches!(result, Err(QuoteError::InsufficientCollateral { .. })));
    }

    #[test]
    fn test_build_quote_success() {
        let config = ParsedMarketConfig {
            market_id: [1u8; 32],
            itp_address: Address::zero(),
            oracle_address: Address::zero(),
            lltv: U256::from(770_000_000_000_000_000u64),
            risk_tier: crate::tier_config::RiskTier::A,
            composition: vec![],
            bundler_address: Address::zero(),
        };

        let result = QuoteEngine::build_quote(
            &config,
            U256::from(100u64) * U256::exp10(18), // 100 ITP
            U256::from(50u64) * U256::exp10(6),   // 50 USDC
            U256::exp10(24),                        // $1.00
            U256::from(1_585_489_600u64),           // ~5% APR (rounded up for display)
            U256::exp10(24),                        // BLS price $1.00
            1_700_000_000,
            1,
            &[0u8; 64],
            U256::from(7u64),
            false,
            CrisisLevel::Normal,
        );

        let quote = result.unwrap();
        assert_eq!(quote.terms.health_factor, "1.54");
        assert_eq!(quote.terms.borrow_rate, "5.0");
        assert_eq!(quote.terms.max_borrow, "77000000"); // 77 USDC
        assert!(!quote.oracle_update.already_fresh);
        assert_eq!(quote.bundler.steps.len(), 4); // includes oracle push
    }

    #[test]
    fn test_build_quote_oracle_already_fresh() {
        let config = ParsedMarketConfig {
            market_id: [1u8; 32],
            itp_address: Address::zero(),
            oracle_address: Address::zero(),
            lltv: U256::from(770_000_000_000_000_000u64),
            risk_tier: crate::tier_config::RiskTier::A,
            composition: vec![],
            bundler_address: Address::zero(),
        };

        let result = QuoteEngine::build_quote(
            &config,
            U256::from(100u64) * U256::exp10(18),
            U256::from(50u64) * U256::exp10(6),
            U256::exp10(24),
            U256::from(1_585_489_599u64),
            U256::exp10(24),
            1_700_000_000,
            1,
            &[0u8; 64],
            U256::from(7u64),
            true, // oracle already fresh
            CrisisLevel::Normal,
        );

        let quote = result.unwrap();
        assert!(quote.oracle_update.already_fresh);
        assert_eq!(quote.bundler.steps.len(), 3); // no oracle push step
    }

    #[test]
    fn test_build_quote_stress_level_higher_min_hf() {
        let config = ParsedMarketConfig {
            market_id: [1u8; 32],
            itp_address: Address::zero(),
            oracle_address: Address::zero(),
            lltv: U256::from(770_000_000_000_000_000u64),
            risk_tier: crate::tier_config::RiskTier::A,
            composition: vec![],
            bundler_address: Address::zero(),
        };

        // 100 ITP, 50 USDC, HF = 1.54
        // Under Stress, min HF = 1.5, so 1.54 is barely above
        let result_stress = QuoteEngine::build_quote(
            &config,
            U256::from(100u64) * U256::exp10(18),
            U256::from(50u64) * U256::exp10(6),
            U256::exp10(24),
            U256::from(1_585_489_599u64),
            U256::exp10(24),
            1_700_000_000,
            1,
            &[0u8; 64],
            U256::from(7u64),
            false,
            CrisisLevel::Stress,
        );
        assert!(result_stress.is_ok(), "HF 1.54 should pass Stress min HF 1.5");

        // Now try with more debt: 52 USDC, HF = 77/52 ≈ 1.48 < 1.5
        let result_rejected = QuoteEngine::build_quote(
            &config,
            U256::from(100u64) * U256::exp10(18),
            U256::from(52u64) * U256::exp10(6),
            U256::exp10(24),
            U256::from(1_585_489_599u64),
            U256::exp10(24),
            1_700_000_000,
            1,
            &[0u8; 64],
            U256::from(7u64),
            false,
            CrisisLevel::Stress,
        );
        assert!(
            matches!(result_rejected, Err(QuoteError::InsufficientCollateral { .. })),
            "HF ~1.48 should fail Stress min HF 1.5"
        );
    }

    #[test]
    fn test_quote_error_codes() {
        assert_eq!(QuoteError::MarketNotFound("test".to_string()).status_code(), 404);
        assert_eq!(QuoteError::MarketFrozen.status_code(), 503);
        assert_eq!(QuoteError::RateLimited { retry_after: 30 }.status_code(), 429);
        assert_eq!(
            QuoteError::InsufficientCollateral {
                required_hf: "1.5".to_string(),
                actual_hf: "1.2".to_string(),
            }
            .status_code(),
            400
        );
    }
}
