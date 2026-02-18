# Security Audit: Curator Module - Private Key Handling

**Date:** February 5, 2026
**Scope:** Curator oracle BLS collector
**Files Analyzed:**
- `/Users/maxguillabert/Desktop/index/curator/src/config.rs`
- `/Users/maxguillabert/Desktop/index/curator/src/main.rs`
- `/Users/maxguillabert/Desktop/index/curator/src/collector.rs`
- `/Users/maxguillabert/Desktop/index/curator/src/lib.rs`

---

## Summary

The Curator module has **multiple critical security vulnerabilities** related to private key handling. The private key is stored and transmitted as a plain-text string throughout the application, creating multiple risk vectors for exposure.

---

## Critical Issues Found

### 1. CRITICAL: Private Key Stored in Plain Text in CuratorConfig

**Location:** `/Users/maxguillabert/Desktop/index/curator/src/config.rs` (Line 51)

**Issue:**
```rust
#[derive(Debug, Clone)]
pub struct CuratorConfig {
    pub issuer_urls: Vec<String>,
    pub oracle_address: Address,
    pub itp_address: Address,
    pub rpc_url: String,
    pub private_key: String,  // <-- STORED AS PLAIN STRING
    pub update_interval: Duration,
    pub log_level: String,
}
```

**Risk:**
- `CuratorConfig` has `#[derive(Debug, Clone)]`, which means the entire struct including the private key can be printed via `Debug` formatting
- If this config is ever passed to any function that logs or formats for debugging, the private key will be exposed
- The private key is stored in a plain `String` with no protective mechanisms
- Example risk: If an unhandled panic occurs or error handler calls `{:?}`, the private key will be in logs

**Severity:** CRITICAL

---

### 2. CRITICAL: Private Key Passed as Plain String to OraclePusher

**Location:** `/Users/maxguillabert/Desktop/index/curator/src/main.rs` (Line 28-31)

**Issue:**
```rust
let pusher = OraclePusher::new(
    &config.rpc_url,
    &config.private_key,  // <-- PLAIN STRING PASSED
    config.oracle_address,
)?;
```

**Risk:**
- The private key is extracted from the config as a plain string reference
- This string reference is then passed to `OraclePusher::new()` where it's parsed into a `LocalWallet`
- No validation that the string is zeroized after use
- The error path could expose the key

**Severity:** CRITICAL

---

### 3. CRITICAL: Private Key CLI Argument Exposed Via Clap Debug

**Location:** `/Users/maxguillabert/Desktop/index/curator/src/config.rs` (Line 8, 32-33)

**Issue:**
```rust
#[derive(Parser, Debug, Clone)]  // <-- DEBUG DERIVE ON PARSED CLI ARGS
pub struct CuratorArgs {
    // ... other fields ...

    /// Curator wallet private key (hex, without 0x prefix)
    #[arg(long)]
    pub private_key: String,  // <-- PARSED FROM CLI
}
```

**Risk:**
- `CuratorArgs` has `#[derive(Debug, Clone)]`
- When the CLI args are parsed by clap, this struct holds the raw private key
- If clap prints help with debug info, or if an error occurs during parsing, the key could be exposed
- The private key is held in memory as a standard `String` without any security wrappers
- No use of `#[arg(hide = true)]` or similar clap security features

**Severity:** CRITICAL

---

### 4. HIGH: LocalWallet Not Protected from Debug Output

**Location:** `/Users/maxguillabert/Desktop/index/curator/src/collector.rs` (Lines 338-342)

**Issue:**
```rust
pub struct OraclePusher {
    provider: Arc<Provider<Http>>,
    wallet: LocalWallet,  // <-- Contains parsed private key
    oracle_address: Address,
}
```

**Risk:**
- `OraclePusher` does NOT have a Debug implementation (no `#[derive(Debug)]`)
- However, `LocalWallet` from ethers v2 **DOES implement Debug** and will print the private key
- If OraclePusher is ever accidentally included in Debug output (e.g., in a generic error handler), the wallet would need to be excluded explicitly
- The LocalWallet holds the parsed private key material in memory

**Note:** While LocalWallet v2 properly implements `Debug` to hide sensitive material, there's no guarantee this will remain true in future versions, and the dependency on external library behavior is a risk.

**Severity:** HIGH (mitigated by ethers library)

---

### 5. HIGH: Private Key String Not Zeroized After Use

**Location:** `/Users/maxguillabert/Desktop/index/curator/src/main.rs` (Line 30)

**Issue:**
```rust
let pusher = OraclePusher::new(
    &config.rpc_url,
    &config.private_key,  // <-- Reference to config string
    config.oracle_address,
)?;
```

**Risk:**
- The private key remains in the `CuratorConfig` struct indefinitely
- It's never explicitly zeroized from memory
- If the process is dumped, core dumps, or memory is inspected, the key is readable
- The private key string is cloned multiple times (config is `Clone`) with no zeroization

**Severity:** HIGH

---

### 6. MEDIUM: Error Messages May Expose Parse Errors with Key Context

**Location:** `/Users/maxguillabert/Desktop/index/curator/src/collector.rs` (Lines 353-355)

**Issue:**
```rust
let wallet: LocalWallet = private_key
    .parse()
    .map_err(|e| PushError::Provider(format!("Failed to parse private key: {}", e)))?;
```

**Risk:**
- If the private key string is malformed, the error message is wrapped but the original context might still contain references to the parsing attempt
- The error string doesn't expose the key directly, but parsing failures could reveal the format
- Unknown what error context ethers provides

**Severity:** MEDIUM

---

## Security Best Practices Not Implemented

### Missing Controls:

1. **No `Secret<T>` Wrapper**
   - The private key should be wrapped in a type like `Secret<String>` that implements `Zeroize` on drop
   - This would ensure the memory is cleared when the value is dropped

2. **No `Zeroize` Trait**
   - The `zeroize` crate should be used to explicitly clear sensitive memory
   - Example: After parsing into LocalWallet, the original string should be explicitly zeroized

3. **No Separate Sensitive Config Type**
   - Create a separate `CuratorSensitiveConfig` without Debug derive
   - Keep the private key separate from general config

4. **No CLI Argument Validation**
   - No validation that `--private-key` argument length is correct (should be 64 hex chars for 32-byte key)
   - No check for common mistakes (e.g., leading "0x" when it shouldn't be)

5. **Debug Derive Everywhere**
   - Both `CuratorArgs` and `CuratorConfig` have `#[derive(Debug)]`
   - This is unsafe for any struct containing secrets

6. **No Secrets Crate**
   - The `secrets` crate or similar should be used for sensitive string handling
   - This provides `CStr` wrappers that prevent accidental debug output

---

## Recommended Fixes

### Fix 1: Remove Debug from Secret Structs

```rust
// DON'T USE: #[derive(Debug)]
pub struct CuratorArgs {
    pub issuer_urls: String,
    pub oracle_address: String,
    pub itp_address: String,
    pub rpc_url: String,
    pub private_key: String,  // Sensitive
    pub update_interval_secs: u64,
    pub log_level: String,
}

impl std::fmt::Debug for CuratorArgs {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("CuratorArgs")
            .field("issuer_urls", &self.issuer_urls)
            .field("oracle_address", &self.oracle_address)
            .field("itp_address", &self.itp_address)
            .field("rpc_url", &self.rpc_url)
            .field("private_key", &"***REDACTED***")
            .field("update_interval_secs", &self.update_interval_secs)
            .field("log_level", &self.log_level)
            .finish()
    }
}
```

### Fix 2: Use Zeroize on Drop

```rust
use zeroize::Zeroize;

pub fn new(
    rpc_url: &str,
    private_key: &str,
    oracle_address: Address,
) -> Result<Self, PushError> {
    let provider = Provider::<Http>::try_from(rpc_url)
        .map_err(|e| PushError::Provider(format!("Failed to create provider: {}", e)))?;

    let mut key_copy = private_key.to_string();
    let wallet: LocalWallet = key_copy
        .parse()
        .map_err(|e| PushError::Provider(format!("Failed to parse private key: {}", e)))?;
    key_copy.zeroize();  // Clear memory

    Ok(Self {
        provider: Arc::new(provider),
        wallet,
        oracle_address,
    })
}
```

### Fix 3: Separate Sensitive and Non-Sensitive Config

```rust
pub struct CuratorConfig {
    pub issuer_urls: Vec<String>,
    pub oracle_address: Address,
    pub itp_address: Address,
    pub rpc_url: String,
    pub update_interval: Duration,
    pub log_level: String,
}

pub struct CuratorSecrets {
    private_key: String,  // No Debug derive
}

impl CuratorSecrets {
    pub fn as_str(&self) -> &str {
        &self.private_key
    }
}

impl Drop for CuratorSecrets {
    fn drop(&mut self) {
        self.private_key.zeroize();
    }
}
```

### Fix 4: Add Validation to CLI Arguments

```rust
#[arg(long, value_parser = validate_hex_key)]
pub private_key: String,

fn validate_hex_key(s: &str) -> Result<String, String> {
    // Check length (32 bytes = 64 hex chars)
    if s.len() != 64 {
        return Err("Private key must be 64 hex characters (32 bytes)".to_string());
    }

    // Check all characters are valid hex
    if !s.chars().all(|c| c.is_ascii_hexdigit()) {
        return Err("Private key must contain only hex characters (0-9, a-f, A-F)".to_string());
    }

    Ok(s.to_string())
}
```

### Fix 5: Enable Clap's Built-in Secrets Handling

```rust
use clap::ValueEnum;

#[derive(Parser)]
pub struct CuratorArgs {
    #[arg(long, hide = true)]  // Hide from help output
    pub private_key: String,
}
```

---

## Impact Assessment

| Issue | Severity | Impact | Likelihood |
|-------|----------|--------|------------|
| Plain text string storage | CRITICAL | Full key compromise | HIGH |
| Debug derive on args | CRITICAL | Key in logs/panic messages | HIGH |
| Debug derive on config | CRITICAL | Key in logs/panic messages | HIGH |
| No zeroization | HIGH | Key remains in memory indefinitely | HIGH |
| LocalWallet exposure | HIGH | Depends on ethers implementation | MEDIUM |

---

## Verification Steps

To verify these issues, you could:

1. **Enable Debug Logging:**
   ```bash
   RUST_LOG=debug cargo run --bin curator -- \
     --issuer-urls http://localhost:9001 \
     --oracle-address 0x1234... \
     --itp-address 0x5678... \
     --private-key aabbccdd...
   ```
   Check logs for private key exposure.

2. **Test Panic Behavior:**
   Intentionally trigger a panic and check the output for private key.

3. **Core Dump Analysis:**
   If the process crashes, analyze core dump for plaintext key.

4. **Memory Inspection:**
   Use tools like `valgrind` or `lldb` to inspect memory for unzeroized key material.

---

## Timeline

This audit should inform immediate remediation:

1. **Phase 1 (Immediate):** Remove `#[derive(Debug)]` and implement custom Debug that redacts secrets
2. **Phase 2 (Immediate):** Add Zeroize on drop for sensitive strings
3. **Phase 3 (Short-term):** Separate sensitive and non-sensitive config
4. **Phase 4 (Short-term):** Add comprehensive validation and error handling

---

## Conclusion

The Curator module has critical vulnerabilities in private key handling. The private key is exposed as a plain-text string in multiple locations, stored in structs with Debug derives, and never explicitly zeroized. These issues must be remediated immediately before production deployment.

The recommended fixes prioritize memory safety, preventing accidental exposure in logs/errors, and ensuring proper cleanup of sensitive material from memory.
