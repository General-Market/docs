//! Integration tests for the Oracle BLS Collector (Story 8.10)
//!
//! Tests the full pipeline: collect from mock issuer endpoints → validate consensus →
//! aggregate BLS signatures → verify aggregated signature

use common::bls::{aggregate_pubkeys, BLSKeyPair, Bn254BLSSigner};
use common::types::BLSSignature;
use curator::collector::NavCollector;
use ethers::types::{Address, U256};
use issuer::api::{
    build_nav_message_hash, handle_nav_sign_request, ItpInfo, ItpRegistryReader,
    MockNavCalculator, NavSignHandler,
};
use std::sync::Arc;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;

/// Mock ITP registry for test issuers
struct MockItpRegistry {
    itps: std::collections::HashMap<Address, ItpInfo>,
}

impl MockItpRegistry {
    fn new_with_itp(address: Address, info: ItpInfo) -> Self {
        let mut itps = std::collections::HashMap::new();
        itps.insert(address, info);
        Self { itps }
    }
}

#[async_trait::async_trait]
impl ItpRegistryReader for MockItpRegistry {
    async fn get_itp_info(
        &self,
        itp_address: Address,
    ) -> Result<Option<ItpInfo>, Box<dyn std::error::Error + Send + Sync>> {
        Ok(self.itps.get(&itp_address).cloned())
    }
}

fn test_itp_info() -> ItpInfo {
    let asset1: Address = "0x1111111111111111111111111111111111111111"
        .parse()
        .unwrap();
    let asset2: Address = "0x2222222222222222222222222222222222222222"
        .parse()
        .unwrap();
    ItpInfo {
        id: U256::from(1),
        inventory: vec![(asset1, U256::from(50)), (asset2, U256::from(50))],
        shares_outstanding: U256::exp10(18) * 1000,
    }
}

/// Spin up a mock issuer TCP server that handles GET /api/nav-sign requests
async fn start_mock_issuer(
    port: u16,
    keypair: BLSKeyPair,
    issuer_id: u8,
    cycle_number: u64,
    itp_address: Address,
) -> tokio::task::JoinHandle<()> {
    tokio::spawn(async move {
        let listener = TcpListener::bind(format!("127.0.0.1:{}", port))
            .await
            .expect("Failed to bind mock issuer");

        let handler = Arc::new(NavSignHandler::new(
            MockNavCalculator::one(),
            MockItpRegistry::new_with_itp(itp_address, test_itp_info()),
            Some(keypair),
            issuer_id,
            cycle_number,
        ));

        // Serve up to 5 requests then stop (enough for tests)
        for _ in 0..5 {
            if let Ok((mut socket, _)) = listener.accept().await {
                let handler = handler.clone();
                tokio::spawn(async move {
                    let mut buf = [0u8; 4096];
                    if let Ok(n) = socket.read(&mut buf).await {
                        if n > 0 {
                            let request = String::from_utf8_lossy(&buf[..n]);

                            if request.contains("GET /api/nav-sign") {
                                let query_string = request
                                    .lines()
                                    .next()
                                    .and_then(|line| line.split('?').nth(1))
                                    .and_then(|rest| rest.split_whitespace().next())
                                    .unwrap_or("");

                                let (status, content_type, body) =
                                    handle_nav_sign_request(handler.as_ref(), query_string).await;

                                let response = format!(
                                    "HTTP/1.1 {} OK\r\nContent-Type: {}\r\nConnection: close\r\nContent-Length: {}\r\n\r\n{}",
                                    status, content_type, body.len(), body
                                );
                                let _ = socket.write_all(response.as_bytes()).await;
                            }
                        }
                    }
                });
            }
        }
    })
}

#[tokio::test]
async fn test_collect_aggregate_and_verify() {
    let itp_address: Address = "0xaaaa111111111111111111111111111111111111"
        .parse()
        .unwrap();
    let cycle_number = 100u64;

    let kp1 = BLSKeyPair::from_seed(&[1u8; 32]).unwrap();
    let kp2 = BLSKeyPair::from_seed(&[2u8; 32]).unwrap();
    let kp3 = BLSKeyPair::from_seed(&[3u8; 32]).unwrap();

    // Start 3 mock issuers on different ports
    let _h1 = start_mock_issuer(19001, kp1.clone(), 0, cycle_number, itp_address).await;
    let _h2 = start_mock_issuer(19002, kp2.clone(), 1, cycle_number, itp_address).await;
    let _h3 = start_mock_issuer(19003, kp3.clone(), 2, cycle_number, itp_address).await;

    // Give servers time to bind
    tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;

    // Create collector
    let collector = NavCollector::new(vec![
        "http://127.0.0.1:19001".to_string(),
        "http://127.0.0.1:19002".to_string(),
        "http://127.0.0.1:19003".to_string(),
    ]);

    // Collect from all issuers
    let collection = collector.collect_all(itp_address).await.unwrap();
    assert_eq!(
        collection.responses.len(),
        3,
        "Should receive 3 responses, got {} (errors: {:?})",
        collection.responses.len(),
        collection.errors.iter().map(|(u, e)| format!("{}: {}", u, e)).collect::<Vec<_>>()
    );
    assert!(collection.errors.is_empty(), "Should have no errors");

    // Validate consensus
    let consensus = NavCollector::validate_consensus(&collection.responses, 3).unwrap();
    assert_eq!(consensus.cycle_number, cycle_number);
    assert_eq!(consensus.signer_ids.len(), 3);

    // Aggregate signatures
    let (agg_sig_bytes, bitmask) =
        NavCollector::aggregate_nav_signatures(&collection.responses).unwrap();
    assert_eq!(agg_sig_bytes.len(), 64);
    assert_eq!(bitmask, U256::from(0x07)); // bits 0,1,2

    // Verify aggregated signature against aggregated pubkey
    let agg_pk =
        aggregate_pubkeys(&[kp1.public_key(), kp2.public_key(), kp3.public_key()]).unwrap();

    let message_hash = build_nav_message_hash(
        itp_address,
        consensus.price,
        consensus.timestamp,
        consensus.cycle_number,
    );

    let signer = Bn254BLSSigner::new();
    let valid = signer
        .verify_message_hash(&agg_pk, &message_hash, &BLSSignature(agg_sig_bytes))
        .unwrap();
    assert!(
        valid,
        "Aggregated BLS signature should verify with aggregated pubkey"
    );
}

#[tokio::test]
async fn test_collect_with_partial_failure() {
    let itp_address: Address = "0xbbbb111111111111111111111111111111111111"
        .parse()
        .unwrap();
    let cycle_number = 200u64;

    let kp1 = BLSKeyPair::from_seed(&[11u8; 32]).unwrap();
    let kp2 = BLSKeyPair::from_seed(&[12u8; 32]).unwrap();

    // Start only 2 of 3 mock issuers
    let _h1 = start_mock_issuer(19011, kp1.clone(), 0, cycle_number, itp_address).await;
    let _h2 = start_mock_issuer(19012, kp2.clone(), 1, cycle_number, itp_address).await;
    // Port 19013 is NOT running → connection refused

    tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;

    let mut collector = NavCollector::new(vec![
        "http://127.0.0.1:19011".to_string(),
        "http://127.0.0.1:19012".to_string(),
        "http://127.0.0.1:19013".to_string(), // This will fail
    ]);
    collector.http_timeout = std::time::Duration::from_secs(2);

    let collection = collector.collect_all(itp_address).await.unwrap();
    assert_eq!(collection.responses.len(), 2, "Should receive 2 responses");
    assert_eq!(collection.errors.len(), 1, "Should have 1 error");

    // 2/3 threshold is met
    let consensus = NavCollector::validate_consensus(&collection.responses, 3).unwrap();
    assert_eq!(consensus.cycle_number, cycle_number);

    // Can still aggregate with 2 signatures
    let (agg_sig_bytes, bitmask) =
        NavCollector::aggregate_nav_signatures(&collection.responses).unwrap();
    assert_eq!(agg_sig_bytes.len(), 64);
    assert_eq!(bitmask, U256::from(0x03)); // bits 0,1

    // Verify aggregated signature of 2 issuers
    let agg_pk = aggregate_pubkeys(&[kp1.public_key(), kp2.public_key()]).unwrap();
    let message_hash = build_nav_message_hash(
        itp_address,
        consensus.price,
        consensus.timestamp,
        consensus.cycle_number,
    );
    let signer = Bn254BLSSigner::new();
    let valid = signer
        .verify_message_hash(&agg_pk, &message_hash, &BLSSignature(agg_sig_bytes))
        .unwrap();
    assert!(valid, "2-of-3 aggregated signature should verify");
}

#[tokio::test]
async fn test_collect_with_timeout() {
    let itp_address: Address = "0xcccc111111111111111111111111111111111111"
        .parse()
        .unwrap();

    let kp1 = BLSKeyPair::from_seed(&[21u8; 32]).unwrap();

    // Start only 1 of 3 mock issuers
    let _h1 = start_mock_issuer(19021, kp1.clone(), 0, 300, itp_address).await;

    tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;

    let mut collector = NavCollector::new(vec![
        "http://127.0.0.1:19021".to_string(),
        "http://127.0.0.1:19022".to_string(), // Not running
        "http://127.0.0.1:19023".to_string(), // Not running
    ]);
    collector.http_timeout = std::time::Duration::from_secs(2);

    let collection = collector.collect_all(itp_address).await.unwrap();
    assert_eq!(collection.responses.len(), 1, "Should receive only 1 response");
    assert_eq!(collection.errors.len(), 2, "Should have 2 errors");

    // Threshold not met: only 1 of 3
    let result = NavCollector::validate_consensus(&collection.responses, 3);
    assert!(
        matches!(
            result,
            Err(curator::collector::CollectorError::ThresholdNotMet { .. })
        ),
        "Should fail with ThresholdNotMet"
    );
}
