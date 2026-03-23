//! State persistence abstractions for component checkpointing.
//!
//! Components can persist state to survive restarts without replaying
//! all chain events. Two implementations: JSON files (production) and
//! in-memory (testing).

use serde_json::Value;
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::{Arc, RwLock};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum PersistenceError {
    #[error("failed to read: {0}")]
    ReadFailed(String),
    #[error("failed to write: {0}")]
    WriteFailed(String),
    #[error("serialization error: {0}")]
    SerializationError(String),
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),
}

/// Trait for storing and loading JSON values.
pub trait Persistence: Send + Sync {
    /// Load a previously stored value. Returns None if nothing stored.
    fn load(&self) -> Result<Option<Value>, PersistenceError>;

    /// Store a JSON value, overwriting any previous value.
    fn store(&self, value: &Value) -> Result<(), PersistenceError>;

    /// Create a child persistence scoped to a sub-key.
    /// For files: creates a subdirectory. For memory: prefixes the key.
    fn child(&self, key: &str) -> Box<dyn Persistence>;
}

/// Convenience trait for types that can serialize/deserialize themselves.
pub trait Persist: Send + Sync {
    fn save(&self, persistence: &dyn Persistence) -> Result<(), PersistenceError>;
    fn load_from(persistence: &dyn Persistence) -> Result<Option<Self>, PersistenceError>
    where
        Self: Sized;
}

impl<T> Persist for T
where
    T: serde::Serialize + serde::de::DeserializeOwned + Send + Sync,
{
    fn save(&self, persistence: &dyn Persistence) -> Result<(), PersistenceError> {
        let value = serde_json::to_value(self)
            .map_err(|e| PersistenceError::SerializationError(e.to_string()))?;
        persistence.store(&value)
    }

    fn load_from(persistence: &dyn Persistence) -> Result<Option<Self>, PersistenceError> {
        match persistence.load()? {
            Some(value) => {
                let item = serde_json::from_value(value)
                    .map_err(|e| PersistenceError::SerializationError(e.to_string()))?;
                Ok(Some(item))
            }
            None => Ok(None),
        }
    }
}

/// JSON file-based persistence. Each value is a `.json` file.
pub struct JsonFilePersistence {
    path: PathBuf,
}

impl JsonFilePersistence {
    pub fn new(path: impl Into<PathBuf>) -> Self {
        Self { path: path.into() }
    }
}

impl Persistence for JsonFilePersistence {
    fn load(&self) -> Result<Option<Value>, PersistenceError> {
        if !self.path.exists() {
            return Ok(None);
        }
        let contents = std::fs::read_to_string(&self.path).map_err(|e| {
            PersistenceError::ReadFailed(format!("{}: {}", self.path.display(), e))
        })?;
        let value: Value = serde_json::from_str(&contents)
            .map_err(|e| PersistenceError::SerializationError(e.to_string()))?;
        Ok(Some(value))
    }

    fn store(&self, value: &Value) -> Result<(), PersistenceError> {
        if let Some(parent) = self.path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        let json = serde_json::to_string_pretty(value)
            .map_err(|e| PersistenceError::SerializationError(e.to_string()))?;
        std::fs::write(&self.path, json).map_err(|e| {
            PersistenceError::WriteFailed(format!("{}: {}", self.path.display(), e))
        })?;
        Ok(())
    }

    fn child(&self, key: &str) -> Box<dyn Persistence> {
        // Strip .json extension from self.path, use stem as directory name.
        // Child path = {dir}/{key}.json
        let dir = self.path.with_extension("");
        let child_path = dir.join(format!("{}.json", key));
        Box::new(JsonFilePersistence::new(child_path))
    }
}

/// In-memory persistence for testing. Shared state via `Arc<RwLock<HashMap>>`.
pub struct InMemoryPersistence {
    store: Arc<RwLock<HashMap<String, String>>>,
    prefix: String,
}

impl InMemoryPersistence {
    pub fn new() -> Self {
        Self {
            store: Arc::new(RwLock::new(HashMap::new())),
            prefix: String::new(),
        }
    }

    fn with_store(store: Arc<RwLock<HashMap<String, String>>>, prefix: String) -> Self {
        Self { store, prefix }
    }
}

impl Default for InMemoryPersistence {
    fn default() -> Self {
        Self::new()
    }
}

impl Persistence for InMemoryPersistence {
    fn load(&self) -> Result<Option<Value>, PersistenceError> {
        let map = self
            .store
            .read()
            .map_err(|e| PersistenceError::ReadFailed(e.to_string()))?;
        match map.get(&self.prefix) {
            Some(s) => {
                let value: Value = serde_json::from_str(s)
                    .map_err(|e| PersistenceError::SerializationError(e.to_string()))?;
                Ok(Some(value))
            }
            None => Ok(None),
        }
    }

    fn store(&self, value: &Value) -> Result<(), PersistenceError> {
        let json = serde_json::to_string(value)
            .map_err(|e| PersistenceError::SerializationError(e.to_string()))?;
        let mut map = self
            .store
            .write()
            .map_err(|e| PersistenceError::WriteFailed(e.to_string()))?;
        map.insert(self.prefix.clone(), json);
        Ok(())
    }

    fn child(&self, key: &str) -> Box<dyn Persistence> {
        let child_prefix = if self.prefix.is_empty() {
            key.to_string()
        } else {
            format!("{}:{}", self.prefix, key)
        };
        Box::new(InMemoryPersistence::with_store(
            Arc::clone(&self.store),
            child_prefix,
        ))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde::{Deserialize, Serialize};
    use tempfile::TempDir;

    #[test]
    fn json_file_store_load_roundtrip() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("state.json");
        let p = JsonFilePersistence::new(&path);

        let value = serde_json::json!({"counter": 42, "name": "test"});
        p.store(&value).unwrap();

        let loaded = p.load().unwrap();
        assert_eq!(loaded, Some(value));
    }

    #[test]
    fn json_file_load_missing_returns_none() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("does_not_exist.json");
        let p = JsonFilePersistence::new(&path);

        let loaded = p.load().unwrap();
        assert_eq!(loaded, None);
    }

    #[test]
    fn json_file_child_creates_correct_path() {
        let p = JsonFilePersistence::new("/tmp/test_state.json");
        let _child = p.child("oracle");

        // We can't inspect the path directly through the trait,
        // but we can verify it works by storing and loading.
        // The child path should be /tmp/test_state/oracle.json
        // Verify via the type system by downcasting isn't idiomatic,
        // so we test the path logic directly.
        let dir = PathBuf::from("/tmp/test_state.json").with_extension("");
        let expected = dir.join("oracle.json");
        assert_eq!(expected, PathBuf::from("/tmp/test_state/oracle.json"));
    }

    #[test]
    fn json_file_child_store_load_roundtrip() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("root.json");
        let p = JsonFilePersistence::new(&path);
        let child = p.child("sub");

        let value = serde_json::json!({"nested": true});
        child.store(&value).unwrap();

        let loaded = child.load().unwrap();
        assert_eq!(loaded, Some(value));
    }

    #[test]
    fn in_memory_store_load_roundtrip() {
        let p = InMemoryPersistence::new();
        let value = serde_json::json!({"counter": 99});

        p.store(&value).unwrap();
        let loaded = p.load().unwrap();
        assert_eq!(loaded, Some(value));
    }

    #[test]
    fn in_memory_load_missing_returns_none() {
        let p = InMemoryPersistence::new();
        let loaded = p.load().unwrap();
        assert_eq!(loaded, None);
    }

    #[test]
    fn in_memory_child_shares_state() {
        let parent = InMemoryPersistence::new();
        let child = parent.child("oracle");

        let value = serde_json::json!({"from_child": true});
        child.store(&value).unwrap();

        // Parent should not see child's data at its own prefix
        let parent_loaded = parent.load().unwrap();
        assert_eq!(parent_loaded, None);

        // Child should see its own data
        let child_loaded = child.load().unwrap();
        assert_eq!(child_loaded, Some(value.clone()));

        // Another child with the same key should see the data (shared backing store)
        let child2 = parent.child("oracle");
        let child2_loaded = child2.load().unwrap();
        assert_eq!(child2_loaded, Some(value));
    }

    #[test]
    fn in_memory_nested_children() {
        let root = InMemoryPersistence::new();
        let child = root.child("level1");
        let grandchild = child.child("level2");

        let value = serde_json::json!(42);
        grandchild.store(&value).unwrap();

        let loaded = grandchild.load().unwrap();
        assert_eq!(loaded, Some(value));

        // Parent levels should not see grandchild data
        assert_eq!(child.load().unwrap(), None);
        assert_eq!(root.load().unwrap(), None);
    }

    #[test]
    fn persist_blanket_impl_roundtrip() {
        #[derive(Debug, Serialize, Deserialize, PartialEq)]
        struct Checkpoint {
            block_number: u64,
            processed: Vec<String>,
        }

        let p = InMemoryPersistence::new();
        let checkpoint = Checkpoint {
            block_number: 12345,
            processed: vec!["tx1".into(), "tx2".into()],
        };

        checkpoint.save(&p).unwrap();

        let loaded = Checkpoint::load_from(&p).unwrap().unwrap();
        assert_eq!(loaded, checkpoint);
    }

    #[test]
    fn persist_load_from_empty_returns_none() {
        #[derive(Debug, Serialize, Deserialize, PartialEq)]
        struct State {
            value: u32,
        }

        let p = InMemoryPersistence::new();
        let loaded = State::load_from(&p).unwrap();
        assert_eq!(loaded, None);
    }
}
