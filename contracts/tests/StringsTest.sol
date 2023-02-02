// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

import "../mojito/Strings.sol";

contract StringsTest {
    using Strings for string;

    constructor() public {}

    function uint2str(uint256 num) public view returns (string memory) {
        return Strings.uint2str(num);
    }

    function concatStrAndNum(string calldata str, uint256 num) public view returns (string memory) {
        return Strings.strConcat(str, Strings.uint2str(num));
    }
}
