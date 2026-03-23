//! Component lifecycle abstractions for Index L3 services.
//!
//! Every subsystem (collector, consensus engine, P2P transport, etc.) implements
//! the `Component` trait to provide uniform startup, shutdown, and health reporting.

use async_trait::async_trait;
use std::fmt;
use thiserror::Error;

/// Health status of a component.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ComponentHealth {
    /// Component is running normally.
    Healthy,
    /// Component is running but degraded (e.g., high error rate, slow responses).
    Degraded(String),
    /// Component has stopped or is in a fatal state.
    Unhealthy(String),
}

impl fmt::Display for ComponentHealth {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            ComponentHealth::Healthy => write!(f, "healthy"),
            ComponentHealth::Degraded(reason) => write!(f, "degraded: {reason}"),
            ComponentHealth::Unhealthy(reason) => write!(f, "unhealthy: {reason}"),
        }
    }
}

/// Errors that can occur during component lifecycle operations.
#[derive(Debug, Error)]
pub enum ComponentError {
    #[error("component failed to start: {0}")]
    StartFailed(String),
    #[error("component failed to stop: {0}")]
    StopFailed(String),
    #[error("component is not in the expected state: expected {expected}, got {actual}")]
    InvalidState { expected: String, actual: String },
    #[error("{0}")]
    Other(#[from] Box<dyn std::error::Error + Send + Sync>),
}

/// Lifecycle trait for all major subsystems.
///
/// Components are created in a stopped state, started explicitly,
/// and stopped gracefully on shutdown.
#[async_trait]
pub trait Component: Send + Sync {
    /// Human-readable name for logging and health reporting.
    fn name(&self) -> &str;

    /// Start the component. Called once during service startup.
    async fn start(&mut self) -> Result<(), ComponentError>;

    /// Stop the component gracefully. Should drain in-flight work.
    async fn stop(&mut self) -> Result<(), ComponentError>;

    /// Report current health status. Must be cheap to call (no I/O).
    fn health(&self) -> ComponentHealth;
}

/// A collection of components with aggregate lifecycle management.
pub struct ComponentRegistry {
    components: Vec<Box<dyn Component>>,
}

impl ComponentRegistry {
    pub fn new() -> Self {
        Self {
            components: Vec::new(),
        }
    }

    pub fn register(&mut self, component: Box<dyn Component>) {
        self.components.push(component);
    }

    /// Start all components in registration order.
    pub async fn start_all(&mut self) -> Result<(), ComponentError> {
        for component in self.components.iter_mut() {
            component.start().await.map_err(|e| {
                ComponentError::StartFailed(format!("{}: {e}", component.name()))
            })?;
        }
        Ok(())
    }

    /// Stop all components in reverse registration order.
    ///
    /// Attempts to stop every component even if some fail. Returns the first
    /// error encountered, if any.
    pub async fn stop_all(&mut self) -> Result<(), ComponentError> {
        let mut first_error: Option<ComponentError> = None;

        for component in self.components.iter_mut().rev() {
            if let Err(e) = component.stop().await {
                let err =
                    ComponentError::StopFailed(format!("{}: {e}", component.name()));
                if first_error.is_none() {
                    first_error = Some(err);
                }
            }
        }

        match first_error {
            Some(e) => Err(e),
            None => Ok(()),
        }
    }

    /// Aggregate health: Healthy if all healthy, Degraded if any degraded,
    /// Unhealthy if any unhealthy.
    pub fn health(&self) -> ComponentHealth {
        let mut worst = ComponentHealth::Healthy;

        for component in &self.components {
            match component.health() {
                ComponentHealth::Healthy => {}
                ComponentHealth::Degraded(reason) => {
                    if worst == ComponentHealth::Healthy {
                        worst =
                            ComponentHealth::Degraded(format!("{}: {reason}", component.name()));
                    }
                }
                ComponentHealth::Unhealthy(reason) => {
                    return ComponentHealth::Unhealthy(format!(
                        "{}: {reason}",
                        component.name()
                    ));
                }
            }
        }

        worst
    }
}

impl Default for ComponentRegistry {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// A mock component for testing lifecycle operations.
    struct MockComponent {
        name: String,
        started: bool,
        health: ComponentHealth,
        fail_start: bool,
        fail_stop: bool,
    }

    impl MockComponent {
        fn new(name: &str) -> Self {
            Self {
                name: name.to_string(),
                started: false,
                health: ComponentHealth::Healthy,
                fail_start: false,
                fail_stop: false,
            }
        }

        fn with_health(mut self, health: ComponentHealth) -> Self {
            self.health = health;
            self
        }

        fn failing_start(mut self) -> Self {
            self.fail_start = true;
            self
        }

        fn failing_stop(mut self) -> Self {
            self.fail_stop = true;
            self
        }
    }

    #[async_trait]
    impl Component for MockComponent {
        fn name(&self) -> &str {
            &self.name
        }

        async fn start(&mut self) -> Result<(), ComponentError> {
            if self.fail_start {
                return Err(ComponentError::StartFailed("mock failure".into()));
            }
            self.started = true;
            Ok(())
        }

        async fn stop(&mut self) -> Result<(), ComponentError> {
            if self.fail_stop {
                return Err(ComponentError::StopFailed("mock failure".into()));
            }
            self.started = false;
            Ok(())
        }

        fn health(&self) -> ComponentHealth {
            self.health.clone()
        }
    }

    #[tokio::test]
    async fn start_all_starts_every_component() {
        let mut registry = ComponentRegistry::new();
        registry.register(Box::new(MockComponent::new("alpha")));
        registry.register(Box::new(MockComponent::new("beta")));

        registry.start_all().await.unwrap();

        // All components should be healthy after start
        assert_eq!(registry.health(), ComponentHealth::Healthy);
    }

    #[tokio::test]
    async fn start_all_aborts_on_failure() {
        let mut registry = ComponentRegistry::new();
        registry.register(Box::new(MockComponent::new("alpha")));
        registry.register(Box::new(MockComponent::new("beta").failing_start()));
        registry.register(Box::new(MockComponent::new("gamma")));

        let err = registry.start_all().await.unwrap_err();
        assert!(err.to_string().contains("beta"));
    }

    #[tokio::test]
    async fn stop_all_stops_in_reverse_order() {
        let mut registry = ComponentRegistry::new();
        registry.register(Box::new(MockComponent::new("first")));
        registry.register(Box::new(MockComponent::new("second")));

        registry.start_all().await.unwrap();
        registry.stop_all().await.unwrap();

        assert_eq!(registry.health(), ComponentHealth::Healthy);
    }

    #[tokio::test]
    async fn stop_all_continues_after_failure() {
        let mut registry = ComponentRegistry::new();
        registry.register(Box::new(MockComponent::new("alpha")));
        registry.register(Box::new(MockComponent::new("beta").failing_stop()));
        registry.register(Box::new(MockComponent::new("gamma").failing_stop()));

        let err = registry.stop_all().await.unwrap_err();
        // The first error encountered (in reverse order) is gamma
        assert!(err.to_string().contains("gamma"));
    }

    #[tokio::test]
    async fn health_aggregation_all_healthy() {
        let mut registry = ComponentRegistry::new();
        registry.register(Box::new(MockComponent::new("a")));
        registry.register(Box::new(MockComponent::new("b")));

        assert_eq!(registry.health(), ComponentHealth::Healthy);
    }

    #[tokio::test]
    async fn health_aggregation_degraded() {
        let mut registry = ComponentRegistry::new();
        registry.register(Box::new(MockComponent::new("a")));
        registry.register(Box::new(
            MockComponent::new("b").with_health(ComponentHealth::Degraded("slow".into())),
        ));

        match registry.health() {
            ComponentHealth::Degraded(reason) => assert!(reason.contains("slow")),
            other => panic!("expected Degraded, got {other}"),
        }
    }

    #[tokio::test]
    async fn health_aggregation_unhealthy_wins() {
        let mut registry = ComponentRegistry::new();
        registry.register(Box::new(
            MockComponent::new("a").with_health(ComponentHealth::Degraded("slow".into())),
        ));
        registry.register(Box::new(
            MockComponent::new("b").with_health(ComponentHealth::Unhealthy("dead".into())),
        ));

        match registry.health() {
            ComponentHealth::Unhealthy(reason) => assert!(reason.contains("dead")),
            other => panic!("expected Unhealthy, got {other}"),
        }
    }

    #[test]
    fn component_health_display() {
        assert_eq!(ComponentHealth::Healthy.to_string(), "healthy");
        assert_eq!(
            ComponentHealth::Degraded("lag".into()).to_string(),
            "degraded: lag"
        );
        assert_eq!(
            ComponentHealth::Unhealthy("crashed".into()).to_string(),
            "unhealthy: crashed"
        );
    }

    #[test]
    fn component_error_display() {
        let err = ComponentError::StartFailed("timeout".into());
        assert_eq!(err.to_string(), "component failed to start: timeout");

        let err = ComponentError::InvalidState {
            expected: "running".into(),
            actual: "stopped".into(),
        };
        assert!(err.to_string().contains("running"));
        assert!(err.to_string().contains("stopped"));
    }
}
