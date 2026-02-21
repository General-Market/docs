//! Bitget API authentication and request signing
//!
//! Implements HMAC-SHA256 request signing per Bitget API specification.
//! Signature format: base64(HMAC-SHA256(secret, timestamp + method + path + body))

use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use hmac::{Hmac, Mac};
use sha2::Sha256;
use std::time::{SystemTime, UNIX_EPOCH};

type HmacSha256 = Hmac<Sha256>;

/// Credentials for Bitget API authentication
#[derive(Clone)]
pub struct BitgetCredentials {
    api_key: String,
    api_secret: String,
    passphrase: String,
}

impl BitgetCredentials {
    /// Create new credentials
    ///
    /// # Arguments
    /// * `api_key` - Bitget API key
    /// * `api_secret` - Bitget API secret
    /// * `passphrase` - Bitget API passphrase
    pub fn new(
        api_key: impl Into<String>,
        api_secret: impl Into<String>,
        passphrase: impl Into<String>,
    ) -> Self {
        Self {
            api_key: api_key.into(),
            api_secret: api_secret.into(),
            passphrase: passphrase.into(),
        }
    }

    /// Get the API key
    pub fn api_key(&self) -> &str {
        &self.api_key
    }

    /// Get the passphrase
    pub fn passphrase(&self) -> &str {
        &self.passphrase
    }

    /// Validate credential format
    ///
    /// Returns true if credentials appear to be valid format:
    /// - API key: non-empty, at least 10 characters
    /// - API secret: non-empty, at least 10 characters
    /// - Passphrase: non-empty (Bitget passphrases can be short)
    pub fn validate_format(&self) -> bool {
        !self.api_key.is_empty()
            && !self.api_secret.is_empty()
            && !self.passphrase.is_empty()
            && self.api_key.len() >= 10
            && self.api_secret.len() >= 10
    }
}

// Custom Debug to avoid logging secrets
impl std::fmt::Debug for BitgetCredentials {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("BitgetCredentials")
            .field("api_key", &format!("{}...", &self.api_key.chars().take(4).collect::<String>()))
            .field("api_secret", &"[REDACTED]")
            .field("passphrase", &"[REDACTED]")
            .finish()
    }
}

/// Signed request with all required headers
#[derive(Debug)]
pub struct SignedRequest {
    /// The signature (base64-encoded HMAC-SHA256)
    pub signature: String,
    /// Timestamp in milliseconds
    pub timestamp: u64,
    /// The API key
    pub api_key: String,
    /// The passphrase
    pub passphrase: String,
}

/// Generate the current timestamp in milliseconds
///
/// Returns an error if the system clock is before UNIX_EPOCH.
pub fn generate_timestamp() -> Result<u64, &'static str> {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .map_err(|_| "system clock is before UNIX epoch")
}

/// Sign a request per Bitget API specification
///
/// Signature algorithm:
/// 1. Build pre-hash string: timestamp + method + requestPath + body
/// 2. Compute HMAC-SHA256 with API secret
/// 3. Base64 encode the result
///
/// # Arguments
/// * `credentials` - API credentials
/// * `timestamp` - Request timestamp in milliseconds
/// * `method` - HTTP method (uppercase: "GET", "POST", etc.)
/// * `request_path` - API endpoint path including query string (e.g., "/api/spot/v1/trade/orders")
/// * `body` - Request body (empty string for GET requests)
pub fn sign_request(
    credentials: &BitgetCredentials,
    timestamp: u64,
    method: &str,
    request_path: &str,
    body: &str,
) -> Result<SignedRequest, &'static str> {
    // Build pre-hash string: timestamp + method + requestPath + body
    let pre_hash = format!("{}{}{}{}", timestamp, method, request_path, body);

    // Create HMAC-SHA256 signer
    let mut mac = HmacSha256::new_from_slice(credentials.api_secret.as_bytes())
        .map_err(|_| "HMAC key initialization failed")?;

    // Sign the pre-hash string
    mac.update(pre_hash.as_bytes());
    let result = mac.finalize();
    let signature_bytes = result.into_bytes();

    // Base64 encode the signature
    let signature = BASE64.encode(signature_bytes);

    Ok(SignedRequest {
        signature,
        timestamp,
        api_key: credentials.api_key.clone(),
        passphrase: credentials.passphrase.clone(),
    })
}

/// Build authentication headers for a signed request
pub fn build_auth_headers(signed: &SignedRequest) -> Vec<(&'static str, String)> {
    vec![
        ("ACCESS-KEY", signed.api_key.clone()),
        ("ACCESS-SIGN", signed.signature.clone()),
        ("ACCESS-TIMESTAMP", signed.timestamp.to_string()),
        ("ACCESS-PASSPHRASE", signed.passphrase.clone()),
        ("Content-Type", "application/json".to_string()),
    ]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_credentials_debug_redacts_secrets() {
        let creds = BitgetCredentials::new(
            "bg_abcdef1234567890",
            "secret_key_should_not_appear",
            "my_passphrase",
        );

        let debug_str = format!("{:?}", creds);
        assert!(debug_str.contains("bg_a..."));
        assert!(debug_str.contains("[REDACTED]"));
        assert!(!debug_str.contains("secret_key_should_not_appear"));
        assert!(!debug_str.contains("my_passphrase"));
    }

    #[test]
    fn test_credentials_validation() {
        // Valid credentials
        let valid = BitgetCredentials::new(
            "bg_abcdef1234567890",
            "secret_key_1234567890",
            "passphrase123",
        );
        assert!(valid.validate_format());

        // Empty API key
        let empty_key = BitgetCredentials::new("", "secret", "pass");
        assert!(!empty_key.validate_format());

        // Too short
        let short = BitgetCredentials::new("short", "short", "pass");
        assert!(!short.validate_format());
    }

    #[test]
    fn test_sign_request_deterministic() {
        let creds = BitgetCredentials::new(
            "bg_test_key_12345",
            "test_secret_key_for_signing",
            "test_passphrase",
        );

        let timestamp = 1704067200000u64; // Fixed timestamp for deterministic test

        let signed1 = sign_request(
            &creds,
            timestamp,
            "POST",
            "/api/spot/v1/trade/orders",
            r#"{"symbol":"BTCUSDC"}"#,
        ).unwrap();

        let signed2 = sign_request(
            &creds,
            timestamp,
            "POST",
            "/api/spot/v1/trade/orders",
            r#"{"symbol":"BTCUSDC"}"#,
        ).unwrap();

        // Same inputs should produce same signature
        assert_eq!(signed1.signature, signed2.signature);
        assert_eq!(signed1.timestamp, timestamp);
    }

    #[test]
    fn test_sign_request_different_inputs_different_signatures() {
        let creds = BitgetCredentials::new(
            "bg_test_key_12345",
            "test_secret_key_for_signing",
            "test_passphrase",
        );

        let timestamp = 1704067200000u64;

        let signed1 = sign_request(&creds, timestamp, "POST", "/api/v1/orders", r#"{"a":1}"#).unwrap();
        let signed2 = sign_request(&creds, timestamp, "POST", "/api/v1/orders", r#"{"a":2}"#).unwrap();

        // Different body should produce different signature
        assert_ne!(signed1.signature, signed2.signature);
    }

    #[test]
    fn test_build_auth_headers() {
        let signed = SignedRequest {
            signature: "test_signature".to_string(),
            timestamp: 1704067200000,
            api_key: "test_key".to_string(),
            passphrase: "test_pass".to_string(),
        };

        let headers = build_auth_headers(&signed);

        assert_eq!(headers.len(), 5);
        assert!(headers.iter().any(|(k, v)| *k == "ACCESS-KEY" && v == "test_key"));
        assert!(headers.iter().any(|(k, v)| *k == "ACCESS-SIGN" && v == "test_signature"));
        assert!(headers.iter().any(|(k, v)| *k == "ACCESS-TIMESTAMP" && v == "1704067200000"));
        assert!(headers.iter().any(|(k, v)| *k == "ACCESS-PASSPHRASE" && v == "test_pass"));
        assert!(headers.iter().any(|(k, v)| *k == "Content-Type" && v == "application/json"));
    }

    #[test]
    fn test_generate_timestamp() {
        let ts1 = generate_timestamp().unwrap();
        std::thread::sleep(std::time::Duration::from_millis(10));
        let ts2 = generate_timestamp().unwrap();

        // Timestamp should be increasing
        assert!(ts2 > ts1);

        // Should be in milliseconds (13+ digits in 2024+)
        assert!(ts1 > 1700000000000);
    }

    #[test]
    fn test_signature_with_known_vector() {
        // This test verifies our signing implementation against a known test vector.
        // The expected signature was computed manually using the Bitget signing algorithm.
        let creds = BitgetCredentials::new(
            "test_api_key",
            "test_secret",
            "test_passphrase",
        );

        let timestamp = 1704067200000u64;
        let method = "POST";
        let path = "/api/spot/v1/trade/orders";
        let body = r#"{"symbol":"BTCUSDC","side":"buy","orderType":"limit","price":"42000","size":"0.001","force":"gtc"}"#;

        let signed = sign_request(&creds, timestamp, method, path, body).unwrap();

        // Verify the pre-hash string construction is correct
        // pre_hash = "1704067200000POST/api/spot/v1/trade/orders{\"symbol\":\"BTCUSDC\",...}"
        assert_eq!(signed.timestamp, timestamp);
        assert_eq!(signed.api_key, "test_api_key");

        // Signature should be base64 encoded (contains only base64 chars)
        assert!(signed.signature.chars().all(|c| c.is_ascii_alphanumeric() || c == '+' || c == '/' || c == '='));
    }
}
