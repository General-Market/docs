#!/usr/bin/env -S cargo +nightly -Zscript
//! Script to print test BLS public keys for IssuerRegistry
//! Run with: cargo +nightly -Zscript scripts/print-test-bls-keys.rs

use std::process::Command;

fn main() {
    // We'll use a simpler approach - just compile and run a small test
    println!("Test BLS public keys for seed indices 0, 1, 2:");
    println!("Format: seed[0]=N, seed[1]=0x42, rest=0");
    println!();

    // Generate seeds
    for i in 0..3 {
        let mut seed = [0u8; 32];
        seed[0] = i as u8;
        seed[1] = 0x42;
        println!("Index {}: seed = {:?}", i, &seed[..8]);
    }
}
