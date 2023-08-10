// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import 'forge-std/Test.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';

import '../src/BeefyHarvestLens.sol';
import '../src/interfaces/beefy/IStrategyV7.sol';
import './mocks/StrategyV7Mock.sol';

contract BeefyHarvestLensTest is Test {
    using SafeERC20 for IERC20;

    address constant WNATIVE = 0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174;

    function testNormalHarvest() public {
        IStrategyV7 strat = new StrategyV7Mock(123456, false, 10, false, 987654);
        BeefyHarvestLens lens = new BeefyHarvestLens();
        (uint256 lastHarvest, uint256 rewards) = lens.getHarvestInfo(address(strat));
        assertEq(lastHarvest, 123456);
    }
}
