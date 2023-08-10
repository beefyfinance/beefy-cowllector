// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;
import './interfaces/beefy/IStrategyV7.sol';
import '@openzeppelin/contracts/token/ERC20/ERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';

// Simulate a harvest while recieving a call reward. Return callReward amount and whether or not it was a success.
contract BeefyHarvestLens {
    using SafeERC20 for IERC20;

    // What is the call reward token?
    IERC20 public native;
    bool private _init;

    function init(IERC20 _native) external {
        require(!_init);
        native = _native;
        _init = true;
    }

    // Simulate harvest calling callStatic for return results. Can also just call harvest and get reward.
    function harvest(
        IStrategyV7 _strategy
    ) external returns (uint256 callReward, bool success, uint256 lastHarvest, bool paused) {
        paused = _strategy.paused();
        lastHarvest = _strategy.lastHarvest();
        uint256 before = IERC20(native).balanceOf(address(this));

        if (!paused) {
            try _strategy.harvest(address(this)) {
                callReward = IERC20(native).balanceOf(address(this)) - before;
                success = true;
                if (callReward > 0) native.safeTransfer(msg.sender, callReward);
            } catch {
                // explicitly call it out for readability;
                callReward = 0;
                success = false;
            }
        } else {
            // explicitly call it out for readability;
            callReward = 0;
            success = false;
        }
    }
}
