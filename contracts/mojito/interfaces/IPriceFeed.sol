// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.0;

/**
 * @title Interface for PriceFeed
 */
interface IPriceFeed {
    function getLatestPrice(address latestPriceAddress)
        external
        returns (int256,uint8);

    function updatePriceFeedAddress(
        address[] memory priceFeedAddress,
        address[] memory currencyAddress
    ) external;
}
