// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

/**
 * @title Interface for RoyaltyEngine
 */
interface IRoyaltyEngine {

    function getRoyalty(address collectionAddress, uint256 tokenId)
        external
        view
        returns (address payable[] memory recipients, uint256[] memory bps);

}
