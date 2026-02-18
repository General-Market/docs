//! Alerting module — dispatches crisis alerts to external channels
//!
//! Provides an `Alerter` trait with a `TelegramAlerter` implementation.
//! Crisis transitions, low HF warnings, and bad debt events trigger notifications.

use crate::health_monitor::{HealthReport, Severity};
use crate::quote::CrisisLevel;
use async_trait::async_trait;
use std::collections::HashMap;
use thiserror::Error;
use tracing::{error, info};

/// Errors from the alerting system
#[derive(Debug, Error)]
pub enum AlertError {
    #[error("Failed to send alert: {0}")]
    SendFailed(String),

    #[error("Configuration error: {0}")]
    ConfigError(String),
}

/// Alerter trait — implement for different notification channels
#[async_trait]
pub trait Alerter: Send + Sync {
    /// Send an alert message
    async fn send_alert(&self, message: &str) -> Result<(), AlertError>;

    /// Send a crisis transition alert
    async fn send_crisis_transition(
        &self,
        market_id: &str,
        from: CrisisLevel,
        to: CrisisLevel,
    ) -> Result<(), AlertError> {
        let emoji = match to {
            CrisisLevel::Emergency => "🚨",
            CrisisLevel::Stress => "⚠️",
            CrisisLevel::Elevated => "🔶",
            CrisisLevel::Normal => "✅",
        };
        let msg = format!(
            "{} Crisis transition: market {} {:?} → {:?}",
            emoji, market_id, from, to
        );
        self.send_alert(&msg).await
    }
}

/// Telegram alerter — sends messages via Telegram Bot API
pub struct TelegramAlerter {
    /// Bot token
    bot_token: String,
    /// Chat ID to send messages to
    chat_id: String,
    /// HTTP client
    client: reqwest::Client,
}

impl TelegramAlerter {
    /// Create a new Telegram alerter
    pub fn new(bot_token: String, chat_id: String) -> Self {
        Self {
            bot_token,
            chat_id,
            client: reqwest::Client::new(),
        }
    }

    /// Build the Telegram API URL
    fn api_url(&self) -> String {
        format!(
            "https://api.telegram.org/bot{}/sendMessage",
            self.bot_token
        )
    }
}

#[async_trait]
impl Alerter for TelegramAlerter {
    async fn send_alert(&self, message: &str) -> Result<(), AlertError> {
        let params = serde_json::json!({
            "chat_id": self.chat_id,
            "text": message,
            "parse_mode": "Markdown",
        });

        let response = self
            .client
            .post(&self.api_url())
            .json(&params)
            .send()
            .await
            .map_err(|e| AlertError::SendFailed(format!("HTTP request failed: {}", e)))?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            return Err(AlertError::SendFailed(format!(
                "Telegram API returned {}: {}",
                status, body
            )));
        }

        Ok(())
    }
}

/// Log alerter — writes alerts to tracing logs (for testing / fallback)
pub struct LogAlerter;

#[async_trait]
impl Alerter for LogAlerter {
    async fn send_alert(&self, message: &str) -> Result<(), AlertError> {
        info!(alert = %message, "Alert dispatched (log)");
        Ok(())
    }
}

/// Alert dispatcher — tracks crisis state and dispatches on transitions
pub struct AlertDispatcher {
    /// The underlying alerter
    alerter: Box<dyn Alerter>,
    /// Previous crisis levels per market
    previous_levels: HashMap<String, CrisisLevel>,
}

impl AlertDispatcher {
    /// Create a new dispatcher with a given alerter
    pub fn new(alerter: Box<dyn Alerter>) -> Self {
        Self {
            alerter,
            previous_levels: HashMap::new(),
        }
    }

    /// Process a health report and dispatch alerts for crisis transitions
    pub async fn process_report(&mut self, report: &HealthReport) {
        // Check for crisis level transitions
        for (market_id, &new_level) in &report.crisis_levels {
            let prev = self
                .previous_levels
                .get(market_id)
                .copied()
                .unwrap_or(CrisisLevel::Normal);

            if prev != new_level {
                if let Err(e) = self
                    .alerter
                    .send_crisis_transition(market_id, prev, new_level)
                    .await
                {
                    error!(
                        market = %market_id,
                        error = %e,
                        "Failed to send crisis transition alert"
                    );
                }
                self.previous_levels.insert(market_id.clone(), new_level);
            }
        }

        // Dispatch critical alerts
        for alert in &report.alerts {
            if matches!(alert.severity, Severity::Critical) {
                if let Err(e) = self.alerter.send_alert(&alert.message).await {
                    error!(error = %e, "Failed to send critical alert");
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::health_monitor::Alert;
    use std::sync::{Arc, Mutex};

    /// Mock alerter that records messages
    struct MockAlerter {
        messages: Arc<Mutex<Vec<String>>>,
    }

    impl MockAlerter {
        fn new() -> (Self, Arc<Mutex<Vec<String>>>) {
            let messages = Arc::new(Mutex::new(Vec::new()));
            (
                Self {
                    messages: messages.clone(),
                },
                messages,
            )
        }
    }

    #[async_trait]
    impl Alerter for MockAlerter {
        async fn send_alert(&self, message: &str) -> Result<(), AlertError> {
            self.messages.lock().unwrap().push(message.to_string());
            Ok(())
        }
    }

    #[tokio::test]
    async fn test_dispatcher_crisis_transition() {
        let (mock, messages) = MockAlerter::new();
        let mut dispatcher = AlertDispatcher::new(Box::new(mock));

        let mut crisis_levels = HashMap::new();
        crisis_levels.insert("0xaa".to_string(), CrisisLevel::Elevated);

        let report = HealthReport {
            timestamp: chrono::Utc::now(),
            positions: vec![],
            oracles: vec![],
            mirror_sync: crate::health_monitor::MirrorSyncStatus {
                l3_nonce: 0,
                mirror_nonce: 0,
                nonce_gap: 0,
                is_synced: true,
                l3_active_count: 0,
                mirror_active_count: 0,
            },
            vault_metrics: crate::health_monitor::VaultMetrics {
                total_assets: ethers::types::U256::zero(),
                total_supply: ethers::types::U256::zero(),
                idle_assets: ethers::types::U256::zero(),
                utilization_pct: 0,
                markets_count: 0,
                high_utilization: false,
            },
            alerts: vec![],
            crisis_levels,
        };

        dispatcher.process_report(&report).await;
        let msgs = messages.lock().unwrap();
        assert_eq!(msgs.len(), 1);
        assert!(msgs[0].contains("Normal → Elevated"));
    }

    #[tokio::test]
    async fn test_dispatcher_no_transition_on_same_level() {
        let (mock, messages) = MockAlerter::new();
        let mut dispatcher = AlertDispatcher::new(Box::new(mock));

        // Set previous level
        dispatcher
            .previous_levels
            .insert("0xaa".to_string(), CrisisLevel::Elevated);

        let mut crisis_levels = HashMap::new();
        crisis_levels.insert("0xaa".to_string(), CrisisLevel::Elevated);

        let report = HealthReport {
            timestamp: chrono::Utc::now(),
            positions: vec![],
            oracles: vec![],
            mirror_sync: crate::health_monitor::MirrorSyncStatus {
                l3_nonce: 0,
                mirror_nonce: 0,
                nonce_gap: 0,
                is_synced: true,
                l3_active_count: 0,
                mirror_active_count: 0,
            },
            vault_metrics: crate::health_monitor::VaultMetrics {
                total_assets: ethers::types::U256::zero(),
                total_supply: ethers::types::U256::zero(),
                idle_assets: ethers::types::U256::zero(),
                utilization_pct: 0,
                markets_count: 0,
                high_utilization: false,
            },
            alerts: vec![],
            crisis_levels,
        };

        dispatcher.process_report(&report).await;
        let msgs = messages.lock().unwrap();
        assert!(msgs.is_empty(), "Should not alert when level unchanged");
    }

    #[tokio::test]
    async fn test_dispatcher_critical_alerts() {
        let (mock, messages) = MockAlerter::new();
        let mut dispatcher = AlertDispatcher::new(Box::new(mock));

        let report = HealthReport {
            timestamp: chrono::Utc::now(),
            positions: vec![],
            oracles: vec![],
            mirror_sync: crate::health_monitor::MirrorSyncStatus {
                l3_nonce: 0,
                mirror_nonce: 0,
                nonce_gap: 0,
                is_synced: true,
                l3_active_count: 0,
                mirror_active_count: 0,
            },
            vault_metrics: crate::health_monitor::VaultMetrics {
                total_assets: ethers::types::U256::zero(),
                total_supply: ethers::types::U256::zero(),
                idle_assets: ethers::types::U256::zero(),
                utilization_pct: 0,
                markets_count: 0,
                high_utilization: false,
            },
            alerts: vec![
                Alert {
                    severity: Severity::Critical,
                    category: crate::health_monitor::AlertCategory::Position,
                    message: "Bad debt detected".to_string(),
                    details: serde_json::json!({}),
                },
                Alert {
                    severity: Severity::Warning,
                    category: crate::health_monitor::AlertCategory::Oracle,
                    message: "Oracle stale".to_string(),
                    details: serde_json::json!({}),
                },
            ],
            crisis_levels: HashMap::new(),
        };

        dispatcher.process_report(&report).await;
        let msgs = messages.lock().unwrap();
        // Only 1 message: the critical alert (warning is skipped)
        assert_eq!(msgs.len(), 1);
        assert!(msgs[0].contains("Bad debt"));
    }

    #[test]
    fn test_log_alerter_does_not_panic() {
        // Just verify LogAlerter can be constructed
        let _alerter = LogAlerter;
    }

    #[test]
    fn test_telegram_alerter_api_url() {
        let alerter = TelegramAlerter::new("123:abc".to_string(), "-100123".to_string());
        assert_eq!(
            alerter.api_url(),
            "https://api.telegram.org/bot123:abc/sendMessage"
        );
    }
}
