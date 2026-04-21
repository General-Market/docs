pub mod admin;
pub mod batch_bets;
pub mod exit_bet;
pub mod initialize;
pub mod place_bet;

// Glob re-exports propagate the Anchor-generated helper modules
// (`__cpi_client_accounts_*`, `__client_accounts_*`) up to the crate root so
// the `#[program]` macro can find them. The `handler` function exists in
// every submodule — that ambiguity is harmless because handlers are called
// via the fully-qualified module path in lib.rs.
#[allow(ambiguous_glob_reexports)]
pub use admin::*;
#[allow(ambiguous_glob_reexports)]
pub use batch_bets::*;
#[allow(ambiguous_glob_reexports)]
pub use exit_bet::*;
#[allow(ambiguous_glob_reexports)]
pub use initialize::*;
#[allow(ambiguous_glob_reexports)]
pub use place_bet::*;
