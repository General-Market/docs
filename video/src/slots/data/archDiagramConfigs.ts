/**
 * Architecture diagram configs for crypto project tech stacks.
 */

import type { ArchitectureDiagramConfig } from "../types";

// ── Zama FHE Stack (Shot 3 — 197 frames) ─────────────────────────────

export const ZAMA_FHE_DIAGRAM: ArchitectureDiagramConfig = {
  light: true,
  nodes: [
    { id: "tfhe", label: "TFHE-rs", subtitle: "Crypto Engine (Rust)", color: "#0088AA" },
    { id: "concrete", label: "Concrete", subtitle: "FHE Compiler (MLIR)", color: "#4F46E5" },
    { id: "fhevm", label: "fhEVM", subtitle: "Confidential EVM", color: "#0891B2" },
    { id: "coprocessor", label: "Coprocessor", subtitle: "Offchain FHE Nodes", color: "#0284C7" },
    { id: "kms", label: "KMS", subtitle: "Threshold Decryption", color: "#7C3AED" },
    { id: "ethereum", label: "Ethereum", subtitle: "Settlement", color: "#627EEA" },
  ],
  edges: [
    { from: "tfhe", to: "concrete" },
    { from: "concrete", to: "fhevm" },
    { from: "fhevm", to: "coprocessor" },
    { from: "coprocessor", to: "kms" },
    { from: "kms", to: "fhevm", curved: true },
    { from: "fhevm", to: "ethereum" },
  ],
  timing: {
    nodeStagger: 8,
    nodeEntranceDuration: 12,
    edgeDelay: 4,
    edgeDrawDuration: 15,
    particleDelay: 4,
  },
};

// ── Aztec ZK Stack (Shot 9 — 106 frames, tighter timing) ─────────────

export const AZTEC_ZK_DIAGRAM: ArchitectureDiagramConfig = {
  light: true,
  transparentBg: true,
  topPad: 650,
  nodeScale: 1.15,
  nodes: [
    { id: "noir", label: "Noir", subtitle: "Privacy Language", color: "#555555" },
    { id: "pxe", label: "PXE", subtitle: "Client-Side Proofs", color: "#7C3AED" },
    { id: "sequencer", label: "Sequencer", subtitle: "Block Ordering", color: "#1D4E89" },
    { id: "barretenberg", label: "Barretenberg", subtitle: "ZK Prover", color: "#059669" },
    { id: "state-trees", label: "State Trees", subtitle: "5 Merkle Trees", color: "#D97706" },
    { id: "ethereum", label: "Ethereum", subtitle: "L1 Settlement", color: "#627EEA" },
  ],
  edges: [
    { from: "noir", to: "pxe" },
    { from: "pxe", to: "sequencer" },
    { from: "sequencer", to: "barretenberg" },
    { from: "sequencer", to: "state-trees" },
    { from: "barretenberg", to: "ethereum" },
  ],
  timing: {
    nodeStagger: 6,
    nodeEntranceDuration: 10,
    edgeDelay: 3,
    edgeDrawDuration: 12,
    particleDelay: 3,
  },
};
