// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

/**
 * @title Interface for Offer
 */
interface IOffers {
    struct Offer {
        // ID for the ERC721 token
        uint256 tokenId;
        // Address for the ERC721 contract
        address tokenContract;
        // The  price of the NFT
        uint256 offerPrice;
        // The address that should receive the funds once the NFT is sold.
        address tokenOwner;
        // The address of the buyer
        address maker;
        // The address of the ERC-20 currency to run the sale with.
        // If set to 0x0, the sale will be run in ETH
        address currency;
    }

    event OfferCreated(
        uint256 indexed offerId,
        uint256 indexed tokenId,
        address indexed tokenContract,
        uint256 offerPrice,
        address tokenOwner,
        address currency,
        uint256 quantity
    );

    event OfferAmountUpdated(
        uint256 indexed offerId,
        uint256 indexed tokenId,
        address indexed tokenContract,
        uint256 offerPrice
    );

    event OfferClosed(
        uint256 indexed offerId,
        uint256 indexed tokenId,
        address indexed tokenContract,
        address tokenOwner,
        address maker,
        uint256 offerPrice,
        address currency,
        uint256 quantity
    );

    event OfferCanceled(
        uint256 indexed offerId,
        uint256 indexed tokenId,
        address indexed tokenContract,
        address tokenOwner,
        uint256 offerPrice
    );

    function createOffer(
        uint256 tokenId,
        address tokenContract,
        address tokenOwner,
        uint256 offerPrice,
        address currency
    ) external payable returns (uint256);

    function setOfferAmount(
        uint256 offerId,
        address currency,
        uint256 offerPrice
    ) external;

    function fillOffer(
        uint256 offerId,
        address currency,
        uint256 offerPrice
    ) external;

    function cancelOffer(uint256 offerId) external;
}
