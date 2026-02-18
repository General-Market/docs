//! Block tracker for AP restart recovery
//!
//! Persists the last processed block to disk for resuming after restart.

use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use tracing::{debug, info, warn};

use crate::error::APError;

/// Default path for block tracker state file
pub const DEFAULT_STATE_FILE: &str = "data/ap_block_tracker.json";

/// Block tracker state persisted to disk
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BlockTrackerState {
    /// Last block that was fully processed
    pub last_processed_block: u64,
    /// Timestamp when state was last updated (Unix epoch seconds)
    pub last_updated: u64,
    /// Chain ID to detect if chain changed
    pub chain_id: u64,
}

impl Default for BlockTrackerState {
    fn default() -> Self {
        Self {
            last_processed_block: 0,
            last_updated: 0,
            chain_id: 0,
        }
    }
}

/// Tracks the last processed block for restart recovery
pub struct BlockTracker {
    state: BlockTrackerState,
    state_file: PathBuf,
    chain_id: u64,
}

impl BlockTracker {
    /// Create a new block tracker with the given chain ID
    ///
    /// Uses the default state file path.
    pub fn new(chain_id: u64) -> Self {
        Self::with_state_file(chain_id, PathBuf::from(DEFAULT_STATE_FILE))
    }

    /// Create a new block tracker with a custom state file path
    pub fn with_state_file(chain_id: u64, state_file: PathBuf) -> Self {
        Self {
            state: BlockTrackerState {
                chain_id,
                ..Default::default()
            },
            state_file,
            chain_id,
        }
    }

    /// Load state from disk
    ///
    /// If the file doesn't exist or is corrupted, returns default state.
    /// If the chain ID doesn't match, logs warning and resets to default.
    pub fn load(&mut self) -> Result<(), APError> {
        if !self.state_file.exists() {
            info!(path = %self.state_file.display(), "No block tracker state file found, starting fresh");
            self.state = BlockTrackerState {
                chain_id: self.chain_id,
                ..Default::default()
            };
            return Ok(());
        }

        let contents = std::fs::read_to_string(&self.state_file)?;
        let loaded_state: BlockTrackerState = serde_json::from_str(&contents)?;

        // Check chain ID matches
        if loaded_state.chain_id != self.chain_id && loaded_state.chain_id != 0 {
            warn!(
                loaded_chain_id = loaded_state.chain_id,
                expected_chain_id = self.chain_id,
                "Chain ID mismatch in block tracker state, resetting to default"
            );
            self.state = BlockTrackerState {
                chain_id: self.chain_id,
                ..Default::default()
            };
            return Ok(());
        }

        info!(
            last_block = loaded_state.last_processed_block,
            "Loaded block tracker state"
        );
        self.state = loaded_state;
        self.state.chain_id = self.chain_id;

        Ok(())
    }

    /// Save current state to disk
    pub fn save(&self) -> Result<(), APError> {
        // Ensure parent directory exists
        if let Some(parent) = self.state_file.parent() {
            std::fs::create_dir_all(parent)?;
        }

        let contents = serde_json::to_string_pretty(&self.state)?;
        std::fs::write(&self.state_file, contents)?;

        debug!(
            last_block = self.state.last_processed_block,
            path = %self.state_file.display(),
            "Saved block tracker state"
        );

        Ok(())
    }

    /// Update the last processed block
    ///
    /// Automatically saves to disk.
    pub fn update(&mut self, block_number: u64) -> Result<(), APError> {
        // Only update if this is a newer block
        if block_number <= self.state.last_processed_block {
            return Ok(());
        }

        self.state.last_processed_block = block_number;
        self.state.last_updated = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();

        self.save()
    }

    /// Get the block number to start scanning from
    ///
    /// Returns 0 if no state exists (start from genesis or configured start block).
    pub fn get_start_block(&self) -> u64 {
        self.state.last_processed_block
    }

    /// Get the last processed block number
    pub fn last_processed_block(&self) -> u64 {
        self.state.last_processed_block
    }

    /// Reset to a specific block (for reorg handling)
    ///
    /// Sets the last processed block to `block_number - 1` so that
    /// `block_number` will be re-processed.
    pub fn reset_to(&mut self, block_number: u64) -> Result<(), APError> {
        self.state.last_processed_block = block_number.saturating_sub(1);
        self.state.last_updated = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();

        info!(
            reset_to = self.state.last_processed_block,
            "Reset block tracker for reorg"
        );

        self.save()
    }

    /// Get the state file path
    pub fn state_file(&self) -> &Path {
        &self.state_file
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::{tempdir, TempDir};

    /// Test helper that returns TempDir to keep it alive for the test duration
    fn create_temp_tracker() -> (BlockTracker, PathBuf, TempDir) {
        let dir = tempdir().unwrap();
        let state_file = dir.path().join("block_tracker.json");
        let tracker = BlockTracker::with_state_file(111222333, state_file.clone());
        (tracker, state_file, dir)
    }

    #[test]
    fn test_new_tracker_starts_at_zero() {
        let (tracker, _, _dir) = create_temp_tracker();
        assert_eq!(tracker.get_start_block(), 0);
    }

    #[test]
    fn test_update_and_save() {
        let (mut tracker, state_file, _dir) = create_temp_tracker();

        tracker.update(100).unwrap();
        assert_eq!(tracker.get_start_block(), 100);

        // Verify file was created
        assert!(state_file.exists());

        // Verify contents
        let contents = fs::read_to_string(&state_file).unwrap();
        let state: BlockTrackerState = serde_json::from_str(&contents).unwrap();
        assert_eq!(state.last_processed_block, 100);
    }

    #[test]
    fn test_load_existing_state() {
        let (mut tracker, state_file, _dir) = create_temp_tracker();

        // Update and save
        tracker.update(500).unwrap();

        // Create new tracker and load
        let mut tracker2 = BlockTracker::with_state_file(111222333, state_file);
        tracker2.load().unwrap();

        assert_eq!(tracker2.get_start_block(), 500);
    }

    #[test]
    fn test_load_missing_file() {
        let (mut tracker, state_file, _dir) = create_temp_tracker();

        // Remove file if it exists
        let _ = fs::remove_file(&state_file);

        // Load should succeed with default state
        tracker.load().unwrap();
        assert_eq!(tracker.get_start_block(), 0);
    }

    #[test]
    fn test_chain_id_mismatch_resets() {
        let (mut tracker, state_file, _dir) = create_temp_tracker();

        // Save state with chain ID 111222333
        tracker.update(1000).unwrap();

        // Create new tracker with different chain ID
        let mut tracker2 = BlockTracker::with_state_file(999, state_file);
        tracker2.load().unwrap();

        // Should reset to 0 due to chain ID mismatch
        assert_eq!(tracker2.get_start_block(), 0);
    }

    #[test]
    fn test_update_only_increases() {
        let (mut tracker, _, _dir) = create_temp_tracker();

        tracker.update(100).unwrap();
        assert_eq!(tracker.get_start_block(), 100);

        // Trying to update to lower block should be no-op
        tracker.update(50).unwrap();
        assert_eq!(tracker.get_start_block(), 100);

        // Equal block should also be no-op
        tracker.update(100).unwrap();
        assert_eq!(tracker.get_start_block(), 100);

        // Higher block should update
        tracker.update(200).unwrap();
        assert_eq!(tracker.get_start_block(), 200);
    }

    #[test]
    fn test_reset_to_for_reorg() {
        let (mut tracker, _, _dir) = create_temp_tracker();

        tracker.update(100).unwrap();
        assert_eq!(tracker.get_start_block(), 100);

        // Reset to block 90 (to reprocess from 90)
        tracker.reset_to(90).unwrap();
        assert_eq!(tracker.get_start_block(), 89);
    }

    #[test]
    fn test_reset_to_zero() {
        let (mut tracker, _, _dir) = create_temp_tracker();

        tracker.update(100).unwrap();

        // Reset to block 0 should set to 0 (saturating_sub)
        tracker.reset_to(0).unwrap();
        assert_eq!(tracker.get_start_block(), 0);
    }
}
