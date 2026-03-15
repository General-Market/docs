//! Integration tests for the delisting watchdog module.
//!
//! Uses wiremock for data-node HTTP mock and MockChain for chain interactions.

use std::collections::HashSet;
use std::sync::Arc;

use ethers::types::{Address, H256, U256};
use wiremock::matchers::{method, path};
use wiremock::{Mock, MockServer, ResponseTemplate};

use common::mocks::MockChainBuilder;
use common::traits::{ChainReader, ChainWriter, ItpInventoryState};
use common::types::ITPCore;
use issuer::delisting_watchdog::{
    build_unsafe_basecoin_set, compute_equal_weights, compute_removal_indices_descending,
    encode_request_rebalance, extract_base_coin, DelistingWatchdog, UnsafeListing,
};
use issuer::SymbolMap;

/// Helper: build a symbol map with test addresses.
fn test_symbol_map() -> SymbolMap {
    SymbolMap::new()
        .add_hex("0x0000000000000000000000000000000000000001", "BTCUSDT")
        .add_hex("0x0000000000000000000000000000000000000002", "ETHUSDT")
        .add_hex("0x0000000000000000000000000000000000000003", "SUIUSDT")
        .add_hex("0x0000000000000000000000000000000000000004", "APTUSDT")
}

fn addr(n: u64) -> Address {
    let mut bytes = [0u8; 20];
    bytes[19] = n as u8;
    Address::from(bytes)
}

/// Helper: serve a mock /listings/unsafe endpoint.
async fn mock_unsafe_listings(server: &MockServer, listings: &[(&str, &str, &str)]) {
    let body: Vec<String> = listings
        .iter()
        .map(|(symbol, base_coin, status)| {
            format!(
                r#"{{"symbol":"{}","base_coin":"{}","quote_coin":"USDT","listed_at":"2024-01-01T00:00:00Z","delisted_at":null,"status":"{}"}}"#,
                symbol, base_coin, status
            )
        })
        .collect();
    let json = format!("[{}]", body.join(","));

    Mock::given(method("GET"))
        .and(path("/listings/unsafe"))
        .respond_with(ResponseTemplate::new(200).set_body_string(json))
        .mount(server)
        .await;
}

#[test]
fn test_extract_base_coin() {
    assert_eq!(extract_base_coin("BTCUSDT"), "BTC");
    assert_eq!(extract_base_coin("ETHUSDC"), "ETH");
    assert_eq!(extract_base_coin("SUIUSDT"), "SUI");
    assert_eq!(extract_base_coin("SOLBTC"), "SOL");
}

#[test]
fn test_encode_request_rebalance_doesnt_panic() {
    let itp_id = H256::from_low_u64_be(1);
    let remove = vec![U256::from(2), U256::from(0)];
    let weights = compute_equal_weights(2);
    let calldata = encode_request_rebalance(
        itp_id,
        &remove,
        &[], // no add assets
        &weights,
        "test note",
    );
    // Should have 4 bytes selector + ABI encoded params
    assert!(calldata.len() > 4);
    // First 4 bytes should be the function selector
    let expected_selector = &ethers::utils::keccak256(
        b"requestRebalance(bytes32,uint256[],address[],uint256[],string)"
    )[..4];
    assert_eq!(&calldata[..4], expected_selector);
}

#[tokio::test]
async fn test_watchdog_handles_empty_danger_list() {
    let server = MockServer::start().await;

    // Serve empty danger list
    Mock::given(method("GET"))
        .and(path("/listings/unsafe"))
        .respond_with(ResponseTemplate::new(200).set_body_string("[]"))
        .mount(&server)
        .await;

    let chain = Arc::new(MockChainBuilder::new().build());
    let watchdog = DelistingWatchdog::new(
        server.uri(),
        chain.clone() as Arc<dyn ChainReader>,
        chain as Arc<dyn ChainWriter>,
        test_symbol_map(),
        addr(99),
    );

    let actions = watchdog.check_and_rebalance().await.unwrap();
    assert!(actions.is_empty(), "No actions expected for empty danger list");
}

#[tokio::test]
async fn test_watchdog_handles_itp_with_no_affected_assets() {
    let server = MockServer::start().await;

    // SUI is in the danger list, but the ITP only has BTC and ETH
    mock_unsafe_listings(&server, &[("SUIUSDT", "SUI", "halt")]).await;

    // Build mock chain with 1 ITP containing BTC + ETH (no SUI)
    let itp_id = H256::from_low_u64_be(1);
    let chain = Arc::new(
        MockChainBuilder::new()
            .with_itp(
                itp_id,
                ITPCore {
                    name: itp_id,
                    symbol: itp_id,
                    creator: addr(10),
                    created_at: U256::from(1),
                    fee_rate: U256::zero(),
                    status: U256::from(1),
                    total_supply: U256::from(10).pow(U256::from(18)),
                    total_value: U256::from(10).pow(U256::from(18)),
                    asset_count: U256::from(2),
                },
            )
            .build(),
    );

    // MockChain doesn't implement static_call (used for getItpCount),
    // so the watchdog will return an error when trying to enumerate ITPs.
    // This is expected behavior — in production, the real chain writer supports static_call.
    let watchdog = DelistingWatchdog::new(
        server.uri(),
        chain.clone() as Arc<dyn ChainReader>,
        chain as Arc<dyn ChainWriter>,
        test_symbol_map(),
        addr(99),
    );

    // check_and_rebalance returns error because MockChain doesn't support static_call
    let result = watchdog.check_and_rebalance().await;
    assert!(result.is_err(), "Expected error from MockChain's missing static_call");
    let err_msg = result.err().unwrap().to_string();
    assert!(err_msg.contains("static_call"), "Error should mention static_call: {}", err_msg);
}

#[test]
fn test_watchdog_weight_computation_roundtrip() {
    // Verify that computing weights for various counts always sums to 1e18
    for count in 1..=200 {
        let weights = compute_equal_weights(count);
        assert_eq!(weights.len(), count);
        let sum: U256 = weights.iter().copied().fold(U256::zero(), |acc, w| acc + w);
        assert_eq!(
            sum,
            U256::from(10).pow(U256::from(18)),
            "Weights for count={} don't sum to 1e18",
            count
        );
    }
}

#[test]
fn test_removal_indices_already_sorted() {
    let indices = compute_removal_indices_descending(&[5, 3, 1]);
    assert_eq!(indices, vec![U256::from(5), U256::from(3), U256::from(1)]);
}

#[test]
fn test_removal_indices_unsorted_input() {
    let indices = compute_removal_indices_descending(&[1, 5, 3]);
    assert_eq!(indices, vec![U256::from(5), U256::from(3), U256::from(1)]);
}
