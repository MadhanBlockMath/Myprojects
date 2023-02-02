// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.0;
import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";
interface IPriceFeed {

    function getLatestPrice(uint amount, address fiat)
        external 
        view
        returns(uint80 roundId,uint256 USDinCRYPTO,uint256 startat, uint256 updatedat);


}
contract sampleFeed is IPriceFeed {

    mapping(address => AggregatorV3Interface) internal priceFeed;

    address public immutable owner;

    // Address of the Admin
    address public adminAddress;

    /// @param priceFeedAddress List of Chainlink Aggregator Address
    /// @param currencyAddress List of ERC20 Currency Address
    constructor(
        address[] memory priceFeedAddress,
        address[] memory currencyAddress,
        address _admin
    ) {
        require(
            priceFeedAddress.length == currencyAddress.length,
            "Arrays must have the same length"
        );
        for (uint256 i = 0; i < priceFeedAddress.length; i++) {
            priceFeed[currencyAddress[i]] = AggregatorV3Interface(
                priceFeedAddress[i]
            );
        }
        owner = msg.sender;
        adminAddress = _admin;
    }
    /// @notice Getting the latestprice for the given currencyAddress
    /// @param fiat ERC20 Currency Address
    /// @param amount conversion amount in usd
    function getLatestPrice(uint256 amount, address fiat)
        external
        view
        override
        returns (uint80 roundId,uint256 USDinCRYPTO,uint256 startat, uint256 updatedat)
    {
        int256 value;
        require(priceFeed[fiat] != AggregatorV3Interface(address(0)), "provide only supported currencies");
        (roundId,value, startat,updatedat , ) = priceFeed[fiat].latestRoundData();
        // uint8 roundId = priceFeed[currencyName].decimals();
        USDinCRYPTO= ((amount * 10** 26)/(uint256(value)));

        
    }
    
    /// @notice Update the currencyAddress with respective priceFeedAddress
    /// @param priceFeedAddress List of Chainlink Aggregator Address
    /// @param currencyAddress List of ERC20 Currency Address
    function addPriceFeedAddress(
        address[] memory priceFeedAddress,
        address[] memory currencyAddress
    ) external {
        require(
            priceFeedAddress.length == currencyAddress.length,
            "Arrays must have the same length"
        );
        for (uint256 i = 0; i < priceFeedAddress.length; i++) {
            priceFeed[currencyAddress[i]] = AggregatorV3Interface(
                priceFeedAddress[i]
            );
        }
    }
}
