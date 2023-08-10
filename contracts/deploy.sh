#!/bin/bash

set -e

export CONTRACT_NAME=$1
export RNG_SALT=$2

if [ -z "$CONTRACT_NAME" ]; then
    echo "Error: CONTRACT_NAME not set"
    echo "Usage: ./deploy.sh <contract_name> <rng_salt>"
    exit 1
fi

if [ -z "$RNG_SALT" ]; then
    echo "Error: RNG_SALT not set"
    echo "Usage: ./deploy.sh <contract_name> <rng_salt>"
    exit 1
fi

export DEPLOYER=0xcc536552A6214d6667fBC3EC38965F7f556A6391

# build bytecode and put it in <out>/<contract>.sol/<contract>.bin as a hex string
echo "Building bytecode"
FOUNDRY_PROFILE=gas-optimize forge build --extra-output evm.bytecode.object --extra-output-files evm.bytecode.object
BYTECODE_LOCATION=$(dirname "$0")"/out/$CONTRACT_NAME.sol/$CONTRACT_NAME.bin"
if [ ! -f "$BYTECODE_LOCATION" ]; then
    echo "Error: $BYTECODE_LOCATION not found"
    exit 1
fi
export CONTRACT_BYTECODE=$(cat $BYTECODE_LOCATION)

# deploy using deployer
echo "Deploying"
DEPLOYED_CONTRACT=$(cast call $DEPLOYER "function deploy(bytes32 _salt, bytes memory _bytecode) external returns (address deploymentAddress)" "$RNG_SALT" "0x$CONTRACT_BYTECODE")
echo "Deployed contract: $DEPLOYED_CONTRACT"