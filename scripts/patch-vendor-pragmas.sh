#!/bin/bash
# Patch vendor library pragmas for solc 0.8.24 compatibility
# Run this after: git submodule update --init --recursive
#
# Morpho Blue uses strict pragma 0.8.19, MetaMorpho uses strict 0.8.21.
# With auto_detect_solc=false and solc=0.8.24, these must be relaxed to >= ranges.
# Foundry's auto_detect_solc=true cannot resolve the incompatible version graph
# (Morpho 0.8.19 + MetaMorpho 0.8.21 + project ^0.8.20 in same compilation units).

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CONTRACTS_DIR="$SCRIPT_DIR/../contracts"

# Cross-platform sed in-place (macOS BSD sed vs GNU sed)
sedi() {
  if sed --version 2>/dev/null | grep -q GNU; then
    sed -i "$@"
  else
    sed -i '' "$@"
  fi
}

echo "Patching vendor pragmas for solc 0.8.24 compatibility..."

# Morpho Blue: 0.8.19 -> >=0.8.19
sedi 's/pragma solidity 0.8.19;/pragma solidity >=0.8.19;/' \
  "$CONTRACTS_DIR/lib/morpho-blue/src/Morpho.sol"
echo "  Patched: morpho-blue/src/Morpho.sol"

# Morpho Blue IRM: 0.8.19 -> >=0.8.19
sedi 's/pragma solidity 0.8.19;/pragma solidity >=0.8.19;/' \
  "$CONTRACTS_DIR/lib/morpho-blue-irm/src/adaptive-curve-irm/AdaptiveCurveIrm.sol"
echo "  Patched: morpho-blue-irm/src/adaptive-curve-irm/AdaptiveCurveIrm.sol"

# MetaMorpho: 0.8.21 -> >=0.8.21
sedi 's/pragma solidity 0.8.21;/pragma solidity >=0.8.21;/g' \
  "$CONTRACTS_DIR/lib/metamorpho/src/MetaMorpho.sol" \
  "$CONTRACTS_DIR/lib/metamorpho/src/MetaMorphoFactory.sol"
echo "  Patched: metamorpho/src/MetaMorpho.sol"
echo "  Patched: metamorpho/src/MetaMorphoFactory.sol"

# MetaMorpho mock: 0.8.19 -> >=0.8.19
sedi 's/pragma solidity 0.8.19;/pragma solidity >=0.8.19;/' \
  "$CONTRACTS_DIR/lib/metamorpho/src/mocks/MorphoImport.sol"
echo "  Patched: metamorpho/src/mocks/MorphoImport.sol"

echo "Done. All vendor pragmas patched."
