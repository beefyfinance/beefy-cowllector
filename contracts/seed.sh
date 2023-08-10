#!/bin/bash

set -e

export DEPLOYER=0xcc536552A6214d6667fBC3EC38965F7f556A6391

RNG_LOWER=0  # inclusive
RNG_UPPER=1000000000000   # exclusive
RNG_NUM=$(( RANDOM * ( $RNG_UPPER - $RNG_LOWER) / 32767 + $RNG_LOWER ))
RNG_SALT=$(cast call $DEPLOYER "function createSalt(uint _num, string calldata _string) external pure returns (bytes32)" $RNG_NUM $RNG_NUM)

echo "Salt: $RNG_SALT"
