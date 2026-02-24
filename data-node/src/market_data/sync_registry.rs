//! Global sync registry for force-triggering source syncs
//!
//! Each sync engine registers its source_id on startup. The admin API
//! can then trigger a sync for any source by notifying its entry.
//! Uses the same OnceLock singleton pattern as error_tracker.rs.

use std::collections::HashMap;
use std::sync::{OnceLock, RwLock};
use tokio::sync::Notify;
use std::sync::Arc;

/// Global singleton sync registry
static GLOBAL_REGISTRY: OnceLock<SyncRegistry> = OnceLock::new();

/// Initialize the global sync registry (call once from main)
pub fn init_global() {
    let _ = GLOBAL_REGISTRY.set(SyncRegistry::new());
}

/// Get the global sync registry
pub fn global() -> &'static SyncRegistry {
    GLOBAL_REGISTRY.get_or_init(SyncRegistry::new)
}

/// Registry that maps source_id -> Notify handle for force-sync triggers
#[derive(Debug, Default)]
pub struct SyncRegistry {
    triggers: RwLock<HashMap<String, Arc<Notify>>>,
}

impl SyncRegistry {
    pub fn new() -> Self {
        Self {
            triggers: RwLock::new(HashMap::new()),
        }
    }

    /// Register a source and return its Notify handle.
    /// Called by each sync engine on startup.
    pub fn register(&self, source_id: &str) -> Arc<Notify> {
        let notify = Arc::new(Notify::new());
        let mut map = self.triggers.write().unwrap();
        map.insert(source_id.to_string(), notify.clone());
        notify
    }

    /// Trigger a force-sync for a source. Returns true if the source was found.
    pub fn trigger(&self, source_id: &str) -> bool {
        let map = self.triggers.read().unwrap();
        if let Some(notify) = map.get(source_id) {
            notify.notify_one();
            true
        } else {
            false
        }
    }

    /// List all registered source IDs
    pub fn registered_sources(&self) -> Vec<String> {
        let map = self.triggers.read().unwrap();
        map.keys().cloned().collect()
    }
}
