//! 1inch Swap Calldata Builder
//!
//! Builds swap calldata for BLSCustody execution using 1inch Aggregation Router V6.
//! Supports Arbitrum, Ethereum, Base, and Optimism.

use ethers::abi::{encode, Token};
use ethers::types::{Address, U256};
use ethers::utils::keccak256;
use reqwest::Client;

use super::error::OneInchError;
use super::types::{
    ApiErrorResponse, CustodyExecuteParams, OneInchConfig, SupportedChain, SwapParams, SwapResponse,
};

/// 1inch Aggregation Router V6 address (same on all EVM chains)
pub const ONEINCH_ROUTER_V6: &str = "0x111111125421ca6dc452d289314280a0f8842a65";

/// ERC20 approve function selector (first 4 bytes of keccak256("approve(address,uint256)"))
const APPROVE_SELECTOR: [u8; 4] = [0x09, 0x5e, 0xa7, 0xb3];

/// Swap calldata builder for 1inch Aggregation Router V6
#[derive(Debug, Clone)]
pub struct SwapCalldataBuilder {
    config: OneInchConfig,
    client: Client,
    chain: SupportedChain,
}

impl SwapCalldataBuilder {
    /// Create a new swap calldata builder
    pub fn new(config: OneInchConfig) -> Result<Self, OneInchError> {
        let chain = SupportedChain::from_chain_id(config.chain_id)
            .ok_or_else(|| OneInchError::UnsupportedChain {
                chain_id: config.chain_id,
            })?;

        let client = Client::builder()
            .timeout(config.timeout)
            .build()?;

        Ok(Self {
            config,
            client,
            chain,
        })
    }

    /// Get the 1inch router address as an Address type
    pub fn router_address() -> Address {
        ONEINCH_ROUTER_V6
            .parse()
            .expect("ONEINCH_ROUTER_V6 is a valid address")
    }

    /// Build swap calldata by calling 1inch swap API
    ///
    /// # Arguments
    /// * `params` - Swap parameters including tokens, amounts, and recipient
    ///
    /// # Returns
    /// The raw calldata bytes to be executed on the 1inch router
    ///
    /// # Errors
    /// - `RateLimited`: API rate limit hit, retry after delay
    /// - `InvalidApiKey`: API key is invalid or missing
    /// - `InsufficientLiquidity`: Not enough liquidity for the swap
    /// - `InvalidToken`: Token address is invalid
    /// - `InvalidCalldata`: Response calldata is malformed
    /// - `ApiError`: Other API errors
    ///
    /// # Note
    /// This function does not implement automatic retries. Callers should handle
    /// `RateLimited` and `NetworkError` by implementing retry logic with exponential backoff.
    pub async fn build_swap(&self, params: &SwapParams) -> Result<Vec<u8>, OneInchError> {
        let url = self.swap_url();

        let response = self
            .client
            .get(&url)
            .header("Authorization", format!("Bearer {}", self.config.api_key))
            .query(&[
                ("src", &params.from_token),
                ("dst", &params.to_token),
                ("amount", &params.amount),
                ("from", &params.recipient),
                ("slippage", &params.slippage),
                (
                    "disableEstimate",
                    &params.disable_estimate.to_string(),
                ),
                (
                    "allowPartialFill",
                    &params.allow_partial_fill.to_string(),
                ),
            ])
            .send()
            .await?;

        let status = response.status();

        if status.as_u16() == 429 {
            let retry_after = response
                .headers()
                .get("retry-after")
                .and_then(|v| v.to_str().ok())
                .and_then(|s| s.parse::<u64>().ok())
                .map(|s| s * 1000)
                .unwrap_or(1000); // Default 1 second

            return Err(OneInchError::RateLimited {
                retry_after_ms: Some(retry_after),
            });
        }

        if status.as_u16() == 401 {
            return Err(OneInchError::InvalidApiKey);
        }

        if !status.is_success() {
            let error_text = response.text().await.unwrap_or_default();
            return Err(Self::map_api_error(
                status.as_u16(),
                &error_text,
                params,
            ));
        }

        let swap_response: SwapResponse = response.json().await?;

        // Validate the response target is the 1inch router
        let expected_router = ONEINCH_ROUTER_V6.to_lowercase();
        let actual_router = swap_response.tx.to.to_lowercase();
        if actual_router != expected_router {
            return Err(OneInchError::InvalidCalldata {
                message: format!(
                    "Unexpected router address: expected {}, got {}",
                    expected_router, actual_router
                ),
            });
        }

        // Validate min_return if specified (on-chain slippage protection)
        if !params.min_return.is_empty() {
            if let (Ok(min_return), Ok(to_amount)) = (
                params.min_return.parse::<u128>(),
                swap_response.to_amount.parse::<u128>(),
            ) {
                if to_amount < min_return {
                    return Err(OneInchError::InsufficientLiquidity {
                        from: params.from_token.clone(),
                        to: params.to_token.clone(),
                        amount: format!(
                            "Expected min {} but quote returned {}",
                            min_return, to_amount
                        ),
                    });
                }
            }
        }

        // Decode hex calldata (remove 0x prefix if present)
        let calldata_hex = swap_response
            .tx
            .data
            .strip_prefix("0x")
            .unwrap_or(&swap_response.tx.data);
        let calldata = hex::decode(calldata_hex).map_err(|e| OneInchError::InvalidCalldata {
            message: format!("Failed to decode calldata hex: {}", e),
        })?;

        // Validate calldata is not empty
        if calldata.is_empty() {
            return Err(OneInchError::InvalidCalldata {
                message: "API returned empty calldata".to_string(),
            });
        }

        Ok(calldata)
    }

    /// Map API error responses to specific error types
    fn map_api_error(status_code: u16, error_text: &str, params: &SwapParams) -> OneInchError {
        // Try to parse as JSON error response
        if let Ok(api_error) = serde_json::from_str::<ApiErrorResponse>(error_text) {
            let error_lower = api_error.error.to_lowercase();
            let desc_lower = api_error
                .description
                .as_deref()
                .unwrap_or("")
                .to_lowercase();

            // Map known error patterns to specific error types
            if error_lower.contains("insufficient liquidity")
                || desc_lower.contains("insufficient liquidity")
                || error_lower.contains("not enough liquidity")
            {
                return OneInchError::InsufficientLiquidity {
                    from: params.from_token.clone(),
                    to: params.to_token.clone(),
                    amount: params.amount.clone(),
                };
            }

            if error_lower.contains("invalid token")
                || error_lower.contains("token not found")
                || desc_lower.contains("cannot find token")
            {
                // Try to identify which token is invalid
                let address = if desc_lower.contains(&params.from_token.to_lowercase()) {
                    params.from_token.clone()
                } else if desc_lower.contains(&params.to_token.to_lowercase()) {
                    params.to_token.clone()
                } else {
                    "unknown".to_string()
                };
                return OneInchError::InvalidToken { address };
            }
        }

        // Fallback to generic API error
        OneInchError::ApiError {
            status_code,
            message: error_text.to_string(),
        }
    }

    /// Encode swap calldata for BLSCustody.execute()
    ///
    /// This wraps the swap calldata with the custody contract's execution format,
    /// preparing the message for BLS signing.
    ///
    /// # Arguments
    /// * `calldata` - Raw swap calldata from build_swap()
    /// * `nonce` - Unique nonce for replay protection (bitmap pattern)
    ///
    /// # Returns
    /// CustodyExecuteParams ready for BLS signing
    pub fn encode_for_custody(&self, calldata: &[u8], nonce: U256) -> CustodyExecuteParams {
        let target = Self::router_address();
        let message_hash = self.compute_execute_message_hash(target, calldata, nonce);

        CustodyExecuteParams {
            target,
            data: calldata.to_vec(),
            nonce,
            message_to_sign: message_hash,
        }
    }

    /// Build ERC20 approve calldata for token spending
    ///
    /// This generates the calldata to call `approve(spender, amount)` on an ERC20 token.
    /// The spender is set to the 1inch router address.
    ///
    /// # Arguments
    /// * `amount` - The amount to approve (use U256::MAX for infinite approval)
    ///
    /// # Returns
    /// The encoded `approve(address,uint256)` calldata to be sent TO the token contract.
    ///
    /// # Example
    /// ```ignore
    /// let calldata = SwapCalldataBuilder::build_approve_calldata(U256::MAX);
    /// // Send calldata to token_contract_address, not the router
    /// chain_writer.send_tx(token_address, calldata).await?;
    /// ```
    pub fn build_approve_calldata(amount: U256) -> Vec<u8> {
        let spender = Self::router_address();

        // ABI encode: approve(address spender, uint256 amount)
        let encoded_params = encode(&[Token::Address(spender), Token::Uint(amount)]);

        // Prepend function selector
        let mut calldata = Vec::with_capacity(4 + encoded_params.len());
        calldata.extend_from_slice(&APPROVE_SELECTOR);
        calldata.extend_from_slice(&encoded_params);

        calldata
    }

    /// Get the swap API URL for the configured chain
    fn swap_url(&self) -> String {
        format!(
            "{}/swap/v6.0/{}/swap",
            self.config.base_url,
            self.chain.chain_id()
        )
    }

    /// Compute the message hash for BLS signing
    ///
    /// The message format matches BLSCustody.execute() verification:
    /// keccak256(abi.encode(chainId, custodyAddress, target, data, nonce))
    fn compute_execute_message_hash(&self, target: Address, data: &[u8], nonce: U256) -> [u8; 32] {
        let chain_id = U256::from(self.config.chain_id);

        let encoded = encode(&[
            Token::Uint(chain_id),
            Token::Address(self.config.custody_address),
            Token::Address(target),
            Token::Bytes(data.to_vec()),
            Token::Uint(nonce),
        ]);

        keccak256(encoded)
    }
}

/// Calculate minimum return amount with slippage protection
///
/// # Arguments
/// * `expected_output` - Expected output amount from quote
/// * `slippage_bps` - Slippage tolerance in basis points (100 = 1%)
///
/// # Returns
/// The minimum acceptable return amount
pub fn calculate_min_return(expected_output: U256, slippage_bps: u32) -> U256 {
    // minReturn = expected * (10000 - slippage_bps) / 10000
    let multiplier = U256::from(10000 - slippage_bps);
    let divisor = U256::from(10000);

    expected_output * multiplier / divisor
}

/// Convert slippage tier to basis points
///
/// # Arguments
/// * `tier` - Slippage tier (0=0.3%, 1=1%, 2=3%)
///
/// # Returns
/// Basis points value
pub fn slippage_tier_to_bps(tier: u8) -> u32 {
    match tier {
        0 => 30,   // 0.3%
        1 => 100,  // 1%
        2 => 300,  // 3%
        _ => 300,  // Default to 3%
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_router_address_constant() {
        let addr = SwapCalldataBuilder::router_address();
        assert_eq!(
            format!("{:?}", addr).to_lowercase(),
            "0x111111125421ca6dc452d289314280a0f8842a65"
        );
    }

    #[test]
    fn test_build_approve_calldata() {
        let amount = U256::MAX;

        let calldata = SwapCalldataBuilder::build_approve_calldata(amount);

        // First 4 bytes should be approve selector
        assert_eq!(&calldata[..4], &APPROVE_SELECTOR);

        // Total length: 4 (selector) + 32 (address padded) + 32 (uint256)
        assert_eq!(calldata.len(), 4 + 32 + 32);
    }

    #[test]
    fn test_build_approve_calldata_specific_amount() {
        let amount = U256::from(1_000_000_000_000_000_000u64); // 1 ETH in wei

        let calldata = SwapCalldataBuilder::build_approve_calldata(amount);

        // Verify selector
        assert_eq!(&calldata[..4], &[0x09, 0x5e, 0xa7, 0xb3]);
    }

    #[test]
    fn test_calculate_min_return() {
        let expected = U256::from(1_000_000_000_000_000_000u64); // 1 token

        // 1% slippage (100 bps)
        let min_return = calculate_min_return(expected, 100);
        assert_eq!(min_return, U256::from(990_000_000_000_000_000u64));

        // 0.3% slippage (30 bps)
        let min_return_low = calculate_min_return(expected, 30);
        assert_eq!(min_return_low, U256::from(997_000_000_000_000_000u64));

        // 3% slippage (300 bps)
        let min_return_high = calculate_min_return(expected, 300);
        assert_eq!(min_return_high, U256::from(970_000_000_000_000_000u64));
    }

    #[test]
    fn test_slippage_tier_to_bps() {
        assert_eq!(slippage_tier_to_bps(0), 30);
        assert_eq!(slippage_tier_to_bps(1), 100);
        assert_eq!(slippage_tier_to_bps(2), 300);
        assert_eq!(slippage_tier_to_bps(255), 300); // Unknown defaults to 3%
    }

    #[test]
    fn test_swap_params_builder() {
        let params = SwapParams::new(
            "0xUSDC".to_string(),
            "0xWETH".to_string(),
            "1000000".to_string(),
            "990000".to_string(),
            "0xCustody".to_string(),
        )
        .with_slippage("0.5")
        .with_partial_fill(false);

        assert_eq!(params.from_token, "0xUSDC");
        assert_eq!(params.to_token, "0xWETH");
        assert_eq!(params.slippage, "0.5");
        assert!(!params.allow_partial_fill);
    }

    #[test]
    fn test_encode_for_custody() {
        let config = OneInchConfig::new(
            "test-api-key".to_string(),
            42161, // Arbitrum
            "0x1234567890123456789012345678901234567890"
                .parse()
                .unwrap(),
        );

        let builder = SwapCalldataBuilder::new(config).unwrap();

        let calldata = vec![0x12, 0xaa, 0x3c, 0xaf]; // Example calldata
        let nonce = U256::from(1);

        let custody_params = builder.encode_for_custody(&calldata, nonce);

        // Verify target is 1inch router
        assert_eq!(custody_params.target, SwapCalldataBuilder::router_address());

        // Verify calldata is preserved
        assert_eq!(custody_params.data, calldata);

        // Verify nonce is set
        assert_eq!(custody_params.nonce, nonce);

        // Verify message hash is 32 bytes
        assert_eq!(custody_params.message_to_sign.len(), 32);
    }

    #[test]
    fn test_message_hash_deterministic() {
        let config = OneInchConfig::new(
            "test-api-key".to_string(),
            42161,
            "0x1234567890123456789012345678901234567890"
                .parse()
                .unwrap(),
        );

        let builder = SwapCalldataBuilder::new(config).unwrap();

        let calldata = vec![0x12, 0xaa, 0x3c, 0xaf];
        let nonce = U256::from(42);

        let params1 = builder.encode_for_custody(&calldata, nonce);
        let params2 = builder.encode_for_custody(&calldata, nonce);

        // Same inputs should produce same hash
        assert_eq!(params1.message_to_sign, params2.message_to_sign);
    }

    #[test]
    fn test_message_hash_varies_with_nonce() {
        let config = OneInchConfig::new(
            "test-api-key".to_string(),
            42161,
            "0x1234567890123456789012345678901234567890"
                .parse()
                .unwrap(),
        );

        let builder = SwapCalldataBuilder::new(config).unwrap();

        let calldata = vec![0x12, 0xaa, 0x3c, 0xaf];

        let params1 = builder.encode_for_custody(&calldata, U256::from(1));
        let params2 = builder.encode_for_custody(&calldata, U256::from(2));

        // Different nonces should produce different hashes
        assert_ne!(params1.message_to_sign, params2.message_to_sign);
    }

    #[test]
    fn test_unsupported_chain() {
        let config = OneInchConfig::new(
            "test-api-key".to_string(),
            999999, // Invalid chain
            "0x1234567890123456789012345678901234567890"
                .parse()
                .unwrap(),
        );

        let result = SwapCalldataBuilder::new(config);
        assert!(matches!(
            result,
            Err(OneInchError::UnsupportedChain { chain_id: 999999 })
        ));
    }

    #[test]
    fn test_supported_chains() {
        let chains = [
            (1, SupportedChain::Ethereum),
            (42161, SupportedChain::Arbitrum),
            (8453, SupportedChain::Base),
            (10, SupportedChain::Optimism),
        ];

        for (chain_id, _expected_chain) in chains {
            let config = OneInchConfig::new(
                "test-api-key".to_string(),
                chain_id,
                "0x1234567890123456789012345678901234567890"
                    .parse()
                    .unwrap(),
            );

            let result = SwapCalldataBuilder::new(config);
            assert!(result.is_ok(), "Chain {} should be supported", chain_id);
        }
    }

    #[test]
    fn test_oneinch_config_debug_redacts_api_key() {
        let config = OneInchConfig::new(
            "super-secret-swap-key".to_string(),
            42161,
            "0x1234567890123456789012345678901234567890"
                .parse()
                .unwrap(),
        );
        let debug_str = format!("{:?}", config);
        assert!(!debug_str.contains("super-secret-swap-key"));
        assert!(debug_str.contains("[REDACTED]"));
    }
}
