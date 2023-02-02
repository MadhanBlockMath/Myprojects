// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;
import {SafeMath} from "../../openzeppelin/utils/math/SafeMath.sol";
import {IERC721, IERC165} from "../../openzeppelin/token/ERC721/IERC721.sol";
import {ERC1155TokenReceiver} from "../../gnosis/interfaces/ERC1155TokenReceiver.sol";
import {IERC1155} from "../../openzeppelin/token/ERC1155/IERC1155.sol";
import {ReentrancyGuard} from "../../openzeppelin/security/ReentrancyGuard.sol";
import {IERC20} from "../../openzeppelin/token/ERC20/IERC20.sol";
import {SafeERC20} from "../../openzeppelin/token/ERC20/utils/SafeERC20.sol";
import {Counters} from "../../openzeppelin/utils/Counters.sol";
import {IOffers} from "./../interfaces/IOffers.sol";

interface IWETH {
    function deposit() external payable;

    function withdraw(uint256 wad) external;

    function transfer(address to, uint256 value) external returns (bool);
}

contract Offers is IOffers, ReentrancyGuard, ERC1155TokenReceiver {

    using SafeMath for uint256;
    using SafeERC20 for IERC20;
    using Counters for Counters.Counter;

    // / The address of the WETH contract, so that any ETH transferred can be handled as an ERC-20
    address public wethAddress;

    // A mapping of all of the offers .
    mapping(uint256 => IOffers.Offer) public offers;

    bytes4 constant erc721_interfaceId = 0x80ac58cd; // 721 interface id
    bytes4 constant erc1155_interfaceId = 0xd9b67a26; // 1155 interface id

    Counters.Counter private _offerIdTracker;
    /**
     * @notice Require that the specified offer exists
     */
    modifier offerExists(uint256 offerId) {
        require(_exists(offerId), "Offer doesn't exist");
        _;
    }

    function onERC1155Received(
        address,
        address,
        uint256,
        uint256,
        bytes memory
    ) public virtual override returns (bytes4) {
        return this.onERC1155Received.selector;
    }

    function onERC1155BatchReceived(
        address,
        address,
        uint256[] memory,
        uint256[] memory,
        bytes memory
    ) public virtual override returns (bytes4) {
        return this.onERC1155BatchReceived.selector;
    }

    /*
     * Constructor
     */
    constructor(address _weth)  {
        wethAddress = _weth;
    }

    /**
     * @notice Create an Offer.
     * @dev Store the offer details in the offers mapping and emit an OfferCreated event.
     */
    function createOffer(
        uint256 tokenId,
        address tokenContract,
        address tokenOwner,
        uint256 offer_price,
        address currency
    ) external override payable nonReentrant returns (uint256) {
        require(
            (IERC165(tokenContract).supportsInterface(erc721_interfaceId) ||
                IERC165(tokenContract).supportsInterface(erc1155_interfaceId)),
            "tokenContract does not support ERC721 or ERC1155 interface"
        );
        _handleIncomingTransfer(offer_price, currency);
        uint256 offerId = _offerIdTracker.current();
        uint256 quantity = 1;

        if (IERC165(tokenContract).supportsInterface(erc1155_interfaceId)) {
            quantity = IERC1155(tokenContract).balanceOf(tokenOwner, tokenId);
        }

        offers[offerId] = Offer({
            tokenId: tokenId,
            tokenContract: tokenContract,
            offerPrice: offer_price,
            tokenOwner: tokenOwner,
            maker: msg.sender,
            currency: currency
        });
        _offerIdTracker.increment();

        emit OfferCreated(
            offerId,
            tokenId,
            tokenContract,
            offer_price,
            tokenOwner,
            currency,
            quantity
        );

        return offerId;
    }

    /**
     * @notice Change Fixed Price for the sale
     * @dev Only callable by the curator or owner. Cannot be called if the sale doesn't exist.
     */
    function setOfferAmount(
        uint256 offerId,
        address currency,
        uint256 offerPrice
    ) external override offerExists(offerId) {
        require(
            offers[offerId].maker == msg.sender,
            "setOfferAmount must be maker"
        );

        // If same currency --
        if (currency == offers[offerId].currency) {
            // Get initial amount
            uint256 prevAmount = offers[offerId].offerPrice;
            // Ensure valid update
            require(
                offerPrice > 0 && offerPrice != prevAmount,
                "setOfferAmount invalid _amount"
            );

            // If offer increase --
            if (offerPrice > prevAmount) {
                unchecked {
                    // Get delta
                    uint256 increaseAmount = offerPrice - prevAmount;
                    // Custody increase
                    _handleIncomingTransfer(
                        increaseAmount,
                        offers[offerId].currency
                    );
                    // Update storage
                    offers[offerId].offerPrice += increaseAmount;
                }
                // Else offer decrease --
            } else {
                unchecked {
                    // Get delta
                    uint256 decreaseAmount = prevAmount - offerPrice;
                    // Refund difference
                    _handleOutgoingTransfer(
                        offers[offerId].maker,
                        decreaseAmount,
                        offers[offerId].currency
                    );
                    // Update storage
                    offers[offerId].offerPrice -= decreaseAmount;
                }
            }
            // Else other currency --
        } else {
            // Refund previous offer
            _handleOutgoingTransfer(
                offers[offerId].maker,
                offers[offerId].offerPrice,
                offers[offerId].currency
            );
            // Custody new offer
            _handleIncomingTransfer(offerPrice, currency);

            // Update storage
            offers[offerId].currency = currency;
            offers[offerId].offerPrice = offerPrice;
        }

        emit OfferAmountUpdated(
            offerId,
            offers[offerId].tokenId,
            offers[offerId].tokenContract,
            offerPrice
        );
    }

    /**
     * @notice End an sale, finalizing and paying out the respective parties.
     * @dev  transfers the provided amount to this contract.
     * If the sale is run in native ETH, the ETH is wrapped so it can be identically to other
     * sale currencies in this contract.
     */
    function fillOffer(
        uint256 offerId,
        address currency,
        uint256 offerPrice
    ) external override offerExists(offerId) nonReentrant {
        require(
            offers[offerId].maker != address(0),
            "fillOffer must be active offer"
        );
        require(
            offers[offerId].tokenOwner == msg.sender,
            "fillOffer must be token owner"
        );
        require(
            offers[offerId].currency == currency &&
                offers[offerId].offerPrice == offerPrice,
            "fillOffer currency & offerPrice must match offer"
        );
        _handleOutgoingTransfer(
            msg.sender,
            offers[offerId].offerPrice,
            offers[offerId].currency
        );
        uint256 quantity = 1;
        if (
            IERC165(offers[offerId].tokenContract).supportsInterface(
                erc721_interfaceId
            )
        ) {
            IERC721(offers[offerId].tokenContract).safeTransferFrom(
                msg.sender,
                offers[offerId].maker,
                offers[offerId].tokenId
            );
        } else {
            bytes memory data = "0x";
            quantity = IERC1155(offers[offerId].tokenContract).balanceOf(
                msg.sender,
                offers[offerId].tokenId
            );
            IERC1155(offers[offerId].tokenContract).safeTransferFrom(
                msg.sender,
                offers[offerId].maker,
                offers[offerId].tokenId,
                quantity,
                data
            );
        }
        emit OfferClosed(
            offerId,
            offers[offerId].tokenId,
            offers[offerId].tokenContract,
            offers[offerId].tokenOwner,
            offers[offerId].maker,
            offers[offerId].offerPrice,
            offers[offerId].currency,
            quantity
        );
        delete offers[offerId];
    }

    /**
     * @notice Cancel an offer.
     * @dev Transfers the deposited eth back to the offer creator and emits an OfferCancelled event
     */
    function cancelOffer(uint256 offerId)
        external
        override
        nonReentrant
        offerExists(offerId)
    {
        require(
            ((offers[offerId].maker == msg.sender)||(offers[offerId].tokenOwner == msg.sender)),
            "cancelOffer must be maker or token Owner"
        );
        _handleOutgoingTransfer(
            offers[offerId].maker,
            offers[offerId].offerPrice,
            offers[offerId].currency
        );
        emit OfferCanceled(
            offerId,
            offers[offerId].tokenId,
            offers[offerId].tokenContract,
            offers[offerId].tokenOwner,
            offers[offerId].offerPrice
        );
        delete offers[offerId];
    }

    /**
     * @dev Given an offerPrice and a currency, transfer the currency to this contract.
     * If the currency is ETH (0x0), attempt to wrap the fixedPrice as WETH
     */
    function _handleIncomingTransfer(uint256 offerPrice, address currency)
        internal
    {
        // If this is an ETH trasfer, ensure they sent enough and convert it to WETH under the hood
        if (currency == address(0)) {
            require(
                msg.value == offerPrice,
                "Sent ETH Value does not match specified offer amount"
            );
            IWETH(wethAddress).deposit{value: offerPrice}();
        } else {
            // We must check the balance that was actually transferred to the sales,
            // as some tokens impose a transfer fee and would not actually transfer the
            // full amount to the market, resulting in potentally locked funds
            IERC20 token = IERC20(currency);
            uint256 beforeBalance = token.balanceOf(address(this));
            token.safeTransferFrom(msg.sender, address(this), offerPrice);
            uint256 afterBalance = token.balanceOf(address(this));
            require(
                beforeBalance.add(offerPrice) == afterBalance,
                "Token transfer call did not transfer expected amount"
            );
        }
    }

    function _handleOutgoingTransfer(
        address to,
        uint256 offerPrice,
        address currency
    ) internal {
        if (currency == address(0)) {
            IWETH(wethAddress).withdraw(offerPrice);

            // If the ETH transfer fails (sigh), rewrap the ETH and try send it as WETH.
            if (!_safeTransferETH(to, offerPrice)) {
                IWETH(wethAddress).deposit{value: offerPrice}();
                IERC20(wethAddress).safeTransfer(to, offerPrice);
            }
        } else {
            IERC20(currency).safeTransfer(to, offerPrice);
        }
    }

    function _exists(uint256 offerId) internal view returns (bool) {
        return offers[offerId].tokenOwner != address(0);
    }
    function _safeTransferETH(address to, uint256 value)
        internal
        returns (bool)
    {
        (bool success, ) = to.call{value: value}(new bytes(0));
        return success;
    }

    // TODO: consider reverting if the message sender is not WETH
    receive() external payable {}

    fallback() external payable {}
}
