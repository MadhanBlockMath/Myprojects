// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;
/**
 * NOTE: This contract only exists to serve as a testing utility.
 */

import "../backup/zora/BaseErc20.sol";

contract TestERC20 is BaseERC20 {
    constructor(
        string memory name,
        string memory symbol,
        uint8 decimals
    ) public BaseERC20(name, symbol, decimals) {}
}
