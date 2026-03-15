//! Cycle phase definitions for the oracle node.
//!
//! Each 1-second cycle progresses through 5 phases:
//! 1. ProcessFills - Process fills from cycle N-1
//! 2. Netting - Net orders to minimize transactions
//! 3. InventoryCheck - Verify custody inventory per chain
//! 4. GenerateBatch - Merge orders into execution batch
//! 5. SignSubmit - BLS consensus and chain submission

use serde::{Deserialize, Serialize};
use std::fmt;

/// Phases within a single oracle cycle.
///
/// The cycle progresses through these phases in order, then wraps
/// back to ProcessFills for the next cycle.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum CyclePhase {
    /// Process fills from the previous cycle (N-1).
    /// Integrates with ChainReader (stories 3.2, 3.4).
    ProcessFills,

    /// Net orders to minimize on-chain transactions.
    /// Integrates with NettingEngine (story 3.7).
    Netting,

    /// Check custody inventory across chains.
    /// Ensures sufficient funds for execution.
    InventoryCheck,

    /// Generate the execution batch from merged orders.
    /// Integrates with OrderBatcher (story 3.6).
    GenerateBatch,

    /// BLS consensus signing and chain submission.
    /// Integrates with BLS library and ChainWriter (stories 3.9, 3.12).
    SignSubmit,
}

impl CyclePhase {
    /// Returns the next phase in the cycle sequence.
    /// After SignSubmit, wraps back to ProcessFills.
    #[inline]
    pub fn next(self) -> Self {
        match self {
            Self::ProcessFills => Self::Netting,
            Self::Netting => Self::InventoryCheck,
            Self::InventoryCheck => Self::GenerateBatch,
            Self::GenerateBatch => Self::SignSubmit,
            Self::SignSubmit => Self::ProcessFills,
        }
    }

    /// Returns whether this phase is the first phase of a cycle.
    #[inline]
    pub fn is_cycle_start(self) -> bool {
        matches!(self, Self::ProcessFills)
    }

    /// Returns whether this phase is the last phase of a cycle.
    #[inline]
    pub fn is_cycle_end(self) -> bool {
        matches!(self, Self::SignSubmit)
    }

    /// Returns the phase index (0-4) for duration calculations.
    #[inline]
    pub fn index(self) -> usize {
        match self {
            Self::ProcessFills => 0,
            Self::Netting => 1,
            Self::InventoryCheck => 2,
            Self::GenerateBatch => 3,
            Self::SignSubmit => 4,
        }
    }

    /// Creates a phase from its index (0-4).
    /// Returns None for invalid indices.
    pub fn from_index(index: usize) -> Option<Self> {
        match index {
            0 => Some(Self::ProcessFills),
            1 => Some(Self::Netting),
            2 => Some(Self::InventoryCheck),
            3 => Some(Self::GenerateBatch),
            4 => Some(Self::SignSubmit),
            _ => None,
        }
    }

    /// Returns all phases in order.
    pub const fn all() -> [Self; 5] {
        [
            Self::ProcessFills,
            Self::Netting,
            Self::InventoryCheck,
            Self::GenerateBatch,
            Self::SignSubmit,
        ]
    }

    /// Returns the total number of phases per cycle.
    pub const fn count() -> usize {
        5
    }
}

impl fmt::Display for CyclePhase {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::ProcessFills => write!(f, "PROCESS_FILLS"),
            Self::Netting => write!(f, "NETTING"),
            Self::InventoryCheck => write!(f, "INVENTORY_CHECK"),
            Self::GenerateBatch => write!(f, "GENERATE_BATCH"),
            Self::SignSubmit => write!(f, "SIGN_SUBMIT"),
        }
    }
}

impl Default for CyclePhase {
    fn default() -> Self {
        Self::ProcessFills
    }
}
