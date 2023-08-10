// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import 'forge-std/Test.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';

import '../src/BeefyHarvestLens.sol';
import '../src/interfaces/beefy/IStrategyV7.sol';
import './mocks/StrategyV7Mock.sol';
import './mocks/ERC20Mock.sol';

contract BeefyHarvestLensTest is Test {
    using SafeERC20 for IERC20;

    IERC20 native;
    uint256 lastHarvestMock;
    bool pausedMock;
    uint256 harvestLoops;
    bool revertOnHarvest;
    uint256 harvestRewards;

    function setUp() public {
        native = IERC20(new ERC20Mock(1000 ether));
        lastHarvestMock = 123456;
        pausedMock = false;
        harvestLoops = 10;
        revertOnHarvest = false;
        harvestRewards = 987654;
    }

    function _helperCreateContracts() private returns (IStrategyV7 strat, BeefyHarvestLens lens) {
        strat = IStrategyV7(
            address(
                new StrategyV7Mock(native, lastHarvestMock, pausedMock, harvestLoops, revertOnHarvest, harvestRewards)
            )
        );
        native.safeTransfer(address(strat), 1000 ether);
        lens = new BeefyHarvestLens();
        lens.init(native);
    }

    function testLensDoNotThrowWhenHarvestReverts() public {
        revertOnHarvest = true;

        (IStrategyV7 strat, BeefyHarvestLens lens) = _helperCreateContracts();
        (uint256 callReward, bool success, uint256 lastHarvest, bool paused) = lens.harvest(strat);

        assertEq(callReward, 0);
        assertEq(success, false);
        assertEq(lastHarvest, 123456);
        assertEq(paused, false);
        assertEq(native.balanceOf(address(this)), 0);
    }

    function testNormalHarvest() public {
        (IStrategyV7 strat, BeefyHarvestLens lens) = _helperCreateContracts();
        (uint256 callReward, bool success, uint256 lastHarvest, bool paused) = lens.harvest(strat);

        assertEq(callReward, 987654);
        assertEq(success, true);
        assertEq(lastHarvest, 123456);
        assertEq(paused, false);
        assertEq(native.balanceOf(address(this)), 987654);
    }

    function testLensReturnsCallRewards() public {
        harvestRewards = 1 ether;

        (IStrategyV7 strat, BeefyHarvestLens lens) = _helperCreateContracts();
        (uint256 callReward, bool success, uint256 lastHarvest, bool paused) = lens.harvest(strat);

        assertEq(callReward, 1 ether);
        assertEq(success, true);
        assertEq(lastHarvest, 123456);
        assertEq(paused, false);
        assertEq(native.balanceOf(address(this)), 1 ether);
    }

    function testLensReturnsPaused() public {
        pausedMock = true;

        (IStrategyV7 strat, BeefyHarvestLens lens) = _helperCreateContracts();
        (uint256 callReward, bool success, uint256 lastHarvest, bool paused) = lens.harvest(strat);

        assertEq(callReward, 0);
        assertEq(success, false);
        assertEq(lastHarvest, 123456);
        assertEq(paused, true);
        assertEq(native.balanceOf(address(this)), 0);
    }

    function testLensReturnsLastHarvest() public {
        lastHarvestMock = 98765;

        (IStrategyV7 strat, BeefyHarvestLens lens) = _helperCreateContracts();
        (uint256 callReward, bool success, uint256 lastHarvest, bool paused) = lens.harvest(strat);

        assertEq(callReward, 987654);
        assertEq(success, true);
        assertEq(lastHarvest, 98765);
        assertEq(paused, false);
        assertEq(native.balanceOf(address(this)), 987654);
    }

    function testLensSuccessWhenCallRewardIsZero() public {
        harvestRewards = 0;

        (IStrategyV7 strat, BeefyHarvestLens lens) = _helperCreateContracts();
        (uint256 callReward, bool success, uint256 lastHarvest, bool paused) = lens.harvest(strat);

        assertEq(callReward, 0);
        assertEq(success, true);
        assertEq(lastHarvest, 123456);
        assertEq(paused, false);
        assertEq(native.balanceOf(address(this)), 0);
    }
}
