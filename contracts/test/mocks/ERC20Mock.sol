// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import '@openzeppelin/contracts/token/ERC20/ERC20.sol';

contract ERC20Mock is ERC20 {
    constructor(uint256 supply) ERC20('Mock', 'MOCK') {
        _mint(msg.sender, supply);
    }
}
