#!/bin/bash
set -e

cd /Users/maxguillabert/Desktop/index/contracts

export DEPLOYER_PRIVATE_KEY="0x4b3b08e6572b6fc14645a57933b20102e280f25a7372850b2c2ddb63adcb0fee"
export ISSUER_REGISTRY_ADDRESS="0xae3DcC43AC2E735C43b2a2bCd9C25FcA00441785"
export ASSET_PAIR_REGISTRY_ADDRESS="0x9705f5D06C229FAb0A284aBB12aA521eF7E8E070"
export INDEX_ADDRESS="0xeD31026718e15Ffcff000831dD568a351354ADC2"

echo "=== Deploying Bridge + MockBitget + 627 Assets ==="

forge script script/DeployBridgeE2E.s.sol:DeployBridgeE2E \
    --rpc-url https://index.rpc.zeeve.net \
    --broadcast \
    --legacy \
    -vvv
