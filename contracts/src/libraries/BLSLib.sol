// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title BLSLib - BLS signature verification using BN254 precompiles
/// @notice Provides BLS signature verification for 11/20 oracle consensus on-chain
/// @dev Uses EIP-196/197 precompiles for efficient BN254 operations
/// @custom:security-contact security@indexprotocol.com
library BLSLib {
    // ============ BN254 CURVE CONSTANTS ============

    /// @notice BN254 (alt_bn128) field modulus
    uint256 internal constant P = 0x30644e72e131a029b85045b68181585d97816a916871ca8d3c208c16d87cfd47;

    /// @notice BN254 curve order (number of points on the curve)
    uint256 internal constant N = 0x30644e72e131a029b85045b68181585d2833e84879b9709143e1f593f0000001;

    /// @notice Generator point G1.x
    uint256 internal constant G1_X = 1;

    /// @notice Generator point G1.y
    uint256 internal constant G1_Y = 2;

    /// @notice Generator point G2.x imaginary component
    uint256 internal constant G2_X_IM = 0x198e9393920d483a7260bfb731fb5d25f1aa493335a9e71297e485b7aef312c2;

    /// @notice Generator point G2.x real component
    uint256 internal constant G2_X_RE = 0x1800deef121f1e76426a00665e5c4479674322d4f75edadd46debd5cd992f6ed;

    /// @notice Generator point G2.y imaginary component
    uint256 internal constant G2_Y_IM = 0x090689d0585ff075ec9e99ad690c3395bc4b313370b38ef355acdadcd122975b;

    /// @notice Generator point G2.y real component
    uint256 internal constant G2_Y_RE = 0x12c85ea5db8c6deb4aab71808dcb408fe3d1e7690c43d37b4ce6cc0166fa7daa;

    // ============ PRECOMPILE ADDRESSES ============

    /// @notice ecAdd precompile address (EIP-196)
    address internal constant PRECOMPILE_ADD = address(0x06);

    /// @notice ecMul precompile address (EIP-196)
    address internal constant PRECOMPILE_MUL = address(0x07);

    /// @notice ecPairing precompile address (EIP-197)
    address internal constant PRECOMPILE_PAIRING = address(0x08);

    // ============ EC OPERATIONS ============

    /// @notice Add two G1 points using precompile 0x06
    /// @param p1 First G1 point [x, y]
    /// @param p2 Second G1 point [x, y]
    /// @return r Result G1 point [x, y]
    /// @dev Reverts on invalid point or precompile failure
    function ecAdd(uint256[2] memory p1, uint256[2] memory p2) internal view returns (uint256[2] memory r) {
        uint256[4] memory input;
        input[0] = p1[0];
        input[1] = p1[1];
        input[2] = p2[0];
        input[3] = p2[1];

        bool success;
        assembly {
            success := staticcall(gas(), 0x06, input, 0x80, r, 0x40)
        }
        require(success, "ecAdd failed");
    }

    /// @notice Negate a G1 point: -P = (P.x, -P.y mod p)
    /// @param p G1 point [x, y]
    /// @return r Negated G1 point [x, p - y]
    /// @dev Pure function - no external calls
    function ecNegate(uint256[2] memory p) internal pure returns (uint256[2] memory r) {
        // Handle point at infinity (0, 0)
        if (p[0] == 0 && p[1] == 0) {
            return r; // Returns (0, 0)
        }
        r[0] = p[0];
        uint256 yMod = p[1] % P;
        r[1] = yMod == 0 ? 0 : P - yMod;
    }

    /// @notice Multiply a G1 point by a scalar using precompile 0x07
    /// @param p G1 point [x, y]
    /// @param s Scalar value
    /// @return r Result G1 point [x, y]
    /// @dev Reverts on invalid point or precompile failure
    function ecMul(uint256[2] memory p, uint256 s) internal view returns (uint256[2] memory r) {
        uint256[3] memory input;
        input[0] = p[0];
        input[1] = p[1];
        input[2] = s;

        bool success;
        assembly {
            success := staticcall(gas(), 0x07, input, 0x60, r, 0x40)
        }
        require(success, "ecMul failed");
    }

    // ============ HELPER FUNCTIONS ============

    /// @notice Check if a G1 point is on the BN254 curve
    /// @param p G1 point [x, y] - coordinates must be reduced mod P (i.e., < P)
    /// @return True if point is on curve (y² = x³ + 3 mod P)
    /// @dev Also returns true for point at infinity (0, 0)
    /// @dev Returns false for unreduced coordinates (>= P) - callers must reduce before calling
    function isOnCurve(uint256[2] memory p) internal pure returns (bool) {
        // Point at infinity is valid
        if (p[0] == 0 && p[1] == 0) {
            return true;
        }

        // Check coordinates are in field
        if (p[0] >= P || p[1] >= P) {
            return false;
        }

        // Check y² = x³ + 3 (mod P)
        uint256 lhs = mulmod(p[1], p[1], P);
        uint256 rhs = addmod(mulmod(mulmod(p[0], p[0], P), p[0], P), 3, P);

        return lhs == rhs;
    }

    /// @notice Hash a message to a G1 curve point using try-and-increment
    /// @param message Message hash to map to curve
    /// @return Point on G1 curve
    /// @dev NOT constant time - uses try-and-increment method
    function hashToG1(bytes32 message) internal view returns (uint256[2] memory) {
        uint256 x = uint256(keccak256(abi.encode(message))) % P;
        uint256[2] memory result;

        // Try-and-increment: find x where x³ + 3 has a square root
        for (uint256 i = 0; i < 256; i++) {
            uint256 y2 = addmod(mulmod(mulmod(x, x, P), x, P), 3, P);
            uint256 y = _modSqrt(y2);

            if (y != 0 && mulmod(y, y, P) == y2) {
                result[0] = x;
                result[1] = y;
                return result;
            }

            x = addmod(x, 1, P);
        }

        // Should never happen with reasonable probability
        // Return zero point instead of reverting - callers (verifyBLS) will fail gracefully
        return result;
    }

    /// @notice Compute modular square root using Tonelli-Shanks for BN254
    /// @param a Value to find square root of
    /// @return Square root if exists, 0 otherwise
    /// @dev For BN254, P ≡ 3 (mod 4), so we can use simpler formula: sqrt(a) = a^((P+1)/4)
    function _modSqrt(uint256 a) private view returns (uint256) {
        if (a == 0) return 0;

        // For P ≡ 3 (mod 4): sqrt(a) = a^((P+1)/4) mod P
        // (P+1)/4 = 0x0c19139cb84c680a6e14116da060561765e05aa45a1c72a34f082305b61f3f52
        uint256 exp = 0x0c19139cb84c680a6e14116da060561765e05aa45a1c72a34f082305b61f3f52;

        return _modExp(a, exp, P);
    }

    /// @notice Modular exponentiation using precompile 0x05
    /// @param base Base value
    /// @param exponent Exponent value
    /// @param modulus Modulus value
    /// @return result Result of (base ^ exponent) mod modulus
    function _modExp(uint256 base, uint256 exponent, uint256 modulus) private view returns (uint256 result) {
        assembly {
            // Free memory pointer
            let ptr := mload(0x40)

            // Store length of base, exponent, modulus (32 bytes each)
            mstore(ptr, 0x20)
            mstore(add(ptr, 0x20), 0x20)
            mstore(add(ptr, 0x40), 0x20)

            // Store base, exponent, modulus
            mstore(add(ptr, 0x60), base)
            mstore(add(ptr, 0x80), exponent)
            mstore(add(ptr, 0xa0), modulus)

            // Call modexp precompile (0x05)
            if iszero(staticcall(gas(), 0x05, ptr, 0xc0, ptr, 0x20)) { revert(0, 0) }

            result := mload(ptr)

            // Update free memory pointer past our allocation
            mstore(0x40, add(ptr, 0xc0))
        }
    }

    // ============ BLS VERIFICATION ============

    /// @notice Verify a BLS signature using pairing check
    /// @param pubkey G2 public key (128 bytes: [x_im, x_re, y_im, y_re])
    /// @param message Message hash that was signed
    /// @param signature G1 signature (64 bytes: [x, y])
    /// @return True if signature is valid, false otherwise
    /// @dev Does NOT revert on invalid signature - returns false
    function verifyBLS(bytes memory pubkey, bytes32 message, bytes memory signature) internal view returns (bool) {
        // Input validation - return false, don't revert
        if (signature.length != 64) return false;
        if (pubkey.length != 128) return false;

        // Parse signature (G1 point)
        uint256[2] memory sig;
        sig[0] = _bytesToUint(signature, 0);
        sig[1] = _bytesToUint(signature, 32);

        // Validate signature is on curve
        if (!isOnCurve(sig)) return false;

        // Parse pubkey (G2 point)
        // Note: G2 curve membership is NOT validated here - the pairing precompile (0x08)
        // will reject invalid G2 points by returning 0. This is intentional: G2 validation
        // requires expensive field extension arithmetic not available via precompiles.
        uint256[4] memory pk;
        pk[0] = _bytesToUint(pubkey, 0); // x_im
        pk[1] = _bytesToUint(pubkey, 32); // x_re
        pk[2] = _bytesToUint(pubkey, 64); // y_im
        pk[3] = _bytesToUint(pubkey, 96); // y_re

        // Hash message to G1 point
        uint256[2] memory msgPoint = hashToG1(message);

        // Guard against hashToG1 returning zero point (theoretically possible if 256 iterations exhausted)
        if (msgPoint[0] == 0 && msgPoint[1] == 0) return false;

        // Negate signature for pairing check: e(-sig, G2) * e(H(msg), pk) == 1
        uint256[2] memory sigNeg = ecNegate(sig);

        // Prepare pairing input: 2 pairs of (G1, G2) points
        // Pair 1: (-sig, G2_generator)
        // Pair 2: (H(msg), pubkey)
        uint256[12] memory input;

        // Pair 1: -sig, G2
        input[0] = sigNeg[0];
        input[1] = sigNeg[1];
        input[2] = G2_X_IM;
        input[3] = G2_X_RE;
        input[4] = G2_Y_IM;
        input[5] = G2_Y_RE;

        // Pair 2: H(msg), pk
        input[6] = msgPoint[0];
        input[7] = msgPoint[1];
        input[8] = pk[0];
        input[9] = pk[1];
        input[10] = pk[2];
        input[11] = pk[3];

        // Call pairing precompile
        uint256[1] memory result;
        bool success;
        assembly {
            success := staticcall(gas(), 0x08, input, 0x180, result, 0x20)
        }

        if (!success) return false;

        return result[0] == 1;
    }

    /// @notice Convert bytes to uint256 at offset (unchecked - caller must validate bounds)
    /// @param data Bytes data
    /// @param offset Byte offset to start reading
    /// @return result Uint256 value
    function _bytesToUint(bytes memory data, uint256 offset) private pure returns (uint256 result) {
        assembly {
            result := mload(add(add(data, 0x20), offset))
        }
    }

    // ============ CONVERSION HELPERS ============

    /// @notice Convert G1 point to bytes
    /// @param p G1 point [x, y]
    /// @return 64 bytes representation
    function pointToBytes(uint256[2] memory p) internal pure returns (bytes memory) {
        return abi.encodePacked(p[0], p[1]);
    }

    /// @notice Convert bytes to G1 point
    /// @param data 64 bytes G1 point
    /// @return result G1 point [x, y], or (0, 0) if data length != 64
    function bytesToPoint(bytes memory data) internal pure returns (uint256[2] memory result) {
        if (data.length != 64) return result; // Returns (0, 0) for invalid input
        result[0] = _bytesToUint(data, 0);
        result[1] = _bytesToUint(data, 32);
    }

    // ============ MULTI-PAIRING BLS VERIFICATION ============

    /// @notice Verify a BLS signature against multiple individual signer pubkeys
    /// @dev Uses multi-pairing: e(-sig, G2_gen) * e(H(msg), pk[0]) * ... * e(H(msg), pk[N-1]) == 1
    ///      This correctly handles subset signing where only some oracles sign.
    /// @param pubkeys Array of G2 public keys (each 128 bytes: [x_im, x_re, y_im, y_re])
    /// @param message Message hash that was signed
    /// @param signature G1 signature (64 bytes: [x, y])
    /// @return True if signature is valid, false otherwise
    function verifyBLSMulti(
        bytes[] memory pubkeys,
        bytes32 message,
        bytes memory signature
    ) internal view returns (bool) {
        uint256 numSigners = pubkeys.length;
        if (numSigners == 0) return false;
        if (signature.length != 64) return false;

        // Parse signature (G1 point)
        uint256[2] memory sig;
        sig[0] = _bytesToUint(signature, 0);
        sig[1] = _bytesToUint(signature, 32);

        // Validate signature is on curve
        if (!isOnCurve(sig)) return false;

        // Hash message to G1 point
        uint256[2] memory msgPoint = hashToG1(message);
        if (msgPoint[0] == 0 && msgPoint[1] == 0) return false;

        // Negate signature for pairing check
        uint256[2] memory sigNeg = ecNegate(sig);

        // Build pairing input using Solidity-level array indexing (via_ir safe)
        // Each pair = 6 uint256s: (G1.x, G1.y, G2.x_im, G2.x_re, G2.y_im, G2.y_re)
        uint256 numPairs = numSigners + 1;
        uint256[] memory input = new uint256[](numPairs * 6);

        // Pair 0: (-sig, G2_generator)
        input[0] = sigNeg[0];
        input[1] = sigNeg[1];
        input[2] = G2_X_IM;
        input[3] = G2_X_RE;
        input[4] = G2_Y_IM;
        input[5] = G2_Y_RE;

        // Pairs 1..N: (H(msg), pk[i])
        for (uint256 i = 0; i < numSigners; i++) {
            bytes memory pk = pubkeys[i];
            if (pk.length != 128) return false;
            uint256 base = (i + 1) * 6;
            input[base]     = msgPoint[0];
            input[base + 1] = msgPoint[1];
            input[base + 2] = _bytesToUint(pk, 0);
            input[base + 3] = _bytesToUint(pk, 32);
            input[base + 4] = _bytesToUint(pk, 64);
            input[base + 5] = _bytesToUint(pk, 96);
        }

        // Call pairing precompile — only assembly needed is for the staticcall
        uint256[1] memory result;
        bool success;
        uint256 dataLen = numPairs * 192;
        assembly {
            success := staticcall(gas(), 0x08, add(input, 0x20), dataLen, result, 0x20)
        }

        if (!success) return false;
        return result[0] == 1;
    }
}
