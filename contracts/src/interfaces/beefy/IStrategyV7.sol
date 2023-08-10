// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

interface IStrategyV7 {
    function lastHarvest() external view returns (uint256);

    function harvest(address callReceipient) external;

    function paused() external view returns (bool);
}
