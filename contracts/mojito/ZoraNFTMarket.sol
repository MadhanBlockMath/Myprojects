// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

import "../backup/zora/Market.sol";

contract ZoraNFTMarket is Market {
    constructor() public Market() {}
}
