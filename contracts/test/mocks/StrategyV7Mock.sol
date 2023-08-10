// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

// import SafeERC20
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';

// implements IStrategyV7 and allow mocking of all functions on the constructor
// also adds a parameter to revert on harvest
contract StrategyV7Mock {
    using SafeERC20 for IERC20;

    IERC20 public WETH;
    uint256 public lastHarvestMock;
    bool public pausedMock;
    uint256 public harvestLoops;
    bool public revertOnHarvest;
    uint256 public harvestRewards;

    constructor(
        address _WETH,
        uint256 _lastHarvestMock,
        bool _pausedMock,
        uint256 _harvestLoops,
        bool _revertOnHarvest,
        uint256 _harvestRewards
    ) {
        WETH = _WETH;
        lastHarvestMock = _lastHarvestMock;
        pausedMock = _pausedMock;
        harvestLoops = _harvestLoops;
        revertOnHarvest = _revertOnHarvest;
        harvestRewards = _harvestRewards;
    }

    function lastHarvest() external view returns (uint256) {
        return lastHarvestMock;
    }

    function harvest() external {
        if (revertOnHarvest) {
            revert('revertOnHarvest');
        }
        // consume some gas
        for (uint256 i = 0; i < harvestLoops; i++) {
            keccak256(abi.encode(i));
        }

        bool res = payable(msg.sender).send(harvestRewards);
        require(res, 'send failed');
    }

    function paused() external view returns (bool) {
        return pausedMock;
    }
}
