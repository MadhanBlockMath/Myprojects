// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;
import { SafeMath } from "../openzeppelin/utils/math/SafeMath.sol";
import { IERC721, IERC165 } from "../openzeppelin/token/ERC721/IERC721.sol";
import { ReentrancyGuard } from "../openzeppelin/security/ReentrancyGuard.sol";
import {IERC20} from "../openzeppelin/token/ERC20/IERC20.sol";
import { SafeERC20 } from "../openzeppelin/token/ERC20/utils/SafeERC20.sol";
import {Counters} from "../openzeppelin/utils/Counters.sol";
import {IMarket} from "../backup/zora/interfaces/IMarket.sol";
import {Decimal} from "../backup/zora/Decimal.sol";
import {IMedia} from "./interfaces/IMedia.sol";
import { ITradeHouse } from "./interfaces/ITradeHouse.sol";

interface IWETH {
    function deposit() external payable;
    function withdraw(uint wad) external;

    function transfer(address to, uint256 value) external returns (bool);
}

interface IMediaExtended is IMedia {
    function marketContract() external returns(address);
}

/**
 * @title An open trade house, enabling collectors and curators to run their own auctions and Direct sales
 */
contract TradeHouse is ITradeHouse, ReentrancyGuard {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;
    using Counters for Counters.Counter;

    // The minimum amount of time left in an auction after a new bid is created
    uint256 public timeBuffer;

    // The minimum percentage difference between the last bid amount and the current bid.
    uint8 public minBidIncrementPercentage;

    // The address of the zora protocol to use via this contract
    address public zora;

    // / The address of the WETH contract, so that any ETH transferred can be handled as an ERC-20
    address public wethAddress;

    // A mapping of all of the auctions currently running.
    mapping(uint256 => ITradeHouse.Auction) public auctions;

    // A mapping to check the Id for sale
    mapping(uint256 => bool) public forSale;

    bytes4 constant interfaceId = 0x80ac58cd; // 721 interface id

    Counters.Counter private _auctionIdTracker;

    /**
     * @notice Require that the specified auction exists
     */
    modifier auctionExists(uint256 auctionId) {
        require(_exists(auctionId), "Auction doesn't exist");
        _;
    }
    /*
    * Require that the specific auction is apprived
    */
    modifier IsAuctionApproved(uint auctionId) {
        require(auctions[auctionId].approved, "Auction must be approved by curator");
        _;
    }

    modifier _auctionCheck(uint256 auctionId){
        require(auctions[auctionId].firstBidTime == 0, "Auction has already started");
        _;
    }
    
    /*
     * Constructor
     */
    constructor(address _zora, address _weth) {
        require(
            IERC165(_zora).supportsInterface(interfaceId),
            "Doesn't support NFT interface"
        );
        zora = _zora;
        wethAddress = _weth;
        timeBuffer = 15 * 60; // extend 15 minutes after every bid made in last 15 minutes
        minBidIncrementPercentage = 5; // 5%
    }

    /**
     * @notice Create an auction.
     * @dev Store the auction details in the auctions mapping and emit an AuctionCreated event.
     * If there is no curator, or if the curator is the auction creator, automatically approve the auction.
     */
    function createAuction(
        uint256 tokenId,
        address tokenContract,
        uint256 duration,
        uint256 reservePrice,
        address payable curator,
        uint8 curatorFeePercentage,
        address auctionCurrency
    ) external override nonReentrant returns (uint256) {
        require(
            IERC165(tokenContract).supportsInterface(interfaceId),
            "tokenContract does not support ERC721 interface"
        );
        require(curatorFeePercentage < 100, "curatorFeePercentage must be less than 100");
        address tokenOwner = IERC721(tokenContract).ownerOf(tokenId);
        require(msg.sender == IERC721(tokenContract).getApproved(tokenId) || msg.sender == tokenOwner, "Caller must be approved or owner for token id");
        uint256 auctionId = _auctionIdTracker.current();

        auctions[auctionId] = Auction({
            tokenId: tokenId,
            tokenContract: tokenContract,
            approved: false,
            amount: 0,
            duration: duration,
            firstBidTime: 0,
            reservePrice: reservePrice,
            curatorFeePercentage: curatorFeePercentage,
            tokenOwner: tokenOwner,
            bidder: payable(address(0)),
            curator: curator,
            auctionCurrency: auctionCurrency
        });

        IERC721(tokenContract).transferFrom(tokenOwner, address(this), tokenId);

        _auctionIdTracker.increment();

        emit AuctionCreated(auctionId, tokenId, tokenContract, duration, reservePrice, tokenOwner, curator, curatorFeePercentage, auctionCurrency);


        if(auctions[auctionId].curator == address(0) || curator == tokenOwner) {
            _approveAuction(auctionId, true);
        }

        return auctionId;
    }

    /**
     * @notice Approve an auction, opening up the auction for bids or for sale.
     * @dev Only callable by the curator. Cannot be called if the auction has already started.
     */
    function setAuctionApproval(uint256 auctionId, bool approved) external override auctionExists(auctionId) _auctionCheck(auctionId){
        require(msg.sender == auctions[auctionId].curator, "Must be auction curator");
        _approveAuction(auctionId, approved);
    }

    /**
    * @notice set reserve price for auction or for sale.
    * @dev only callable by the curator or by token owner. cannot be called if first bid is made. 
    */
    function setAuctionReservePrice(uint256 auctionId, uint256 reservePrice) external override
     auctionExists(auctionId) _auctionCheck(auctionId){
        require(msg.sender == auctions[auctionId].curator || msg.sender == auctions[auctionId].tokenOwner, "Must be auction curator or token owner");

        auctions[auctionId].reservePrice = reservePrice;

        emit AuctionReservePriceUpdated(auctionId, auctions[auctionId].tokenId, auctions[auctionId].tokenContract, reservePrice);
    }

    /**
     * @notice Create an sale.
     * @dev Store the Sale details in the auctions mapping and emit an SaleCreated event.
     * If there is no curator, or if the curator is the auction creator, automatically approve the auction.
     */
    function createSale(
        uint256 tokenId,
        address tokenContract,
        uint256 reserveprice,
        address payable curator,
        uint8 curatorFeePercentage,
        address auctionCurrency
    ) external override nonReentrant returns (uint256){

        require (
            IERC165(tokenContract).supportsInterface(interfaceId),
            "tokenContract does not support ERC721 interface"
        );
        require(curatorFeePercentage < 100, "curatorFeePercentage must be less than 100");
        address tokenOwner = IERC721(tokenContract).ownerOf(tokenId);
        require(
            msg.sender == IERC721(tokenContract).getApproved(tokenId) || msg.sender == tokenOwner,
            "Caller must be approved or owner for token id"
        );
         uint256 auctionId = _auctionIdTracker.current();

         auctions[auctionId] = Auction({
            tokenId: tokenId,
            tokenContract: tokenContract,
            approved: false,
            amount: 0,
            duration: 0,
            firstBidTime: 0,
            reservePrice: reserveprice,
            curatorFeePercentage: curatorFeePercentage,
            tokenOwner: tokenOwner,
            bidder: payable(address(0)),
            curator: curator,
            auctionCurrency: auctionCurrency
        });

        IERC721(tokenContract).transferFrom(tokenOwner, address(this), tokenId);
        // it maps the auction id to sale.
        forSale[auctionId]= true;
        _auctionIdTracker.increment();

        emit SaleCreated(
            auctionId,
            tokenId,
            tokenContract,
            reserveprice,
            tokenOwner,
            curator,
            curatorFeePercentage,
            auctionCurrency
        );

        if(auctions[auctionId].curator == address(0) || curator == tokenOwner) {
            _approveAuction(auctionId, true);
        }
        return auctionId;
    }



    /**
     * @notice Create a bid on a token, with a given amount.
     * @dev If provided a valid bid, transfers the provided amount to this contract.
     * If the auction is run in native ETH, the ETH is wrapped so it can be identically to other
     * auction currencies in this contract.
     */
    function createBid(uint256 auctionId, uint256 amount)
    external
    override
    payable
    auctionExists(auctionId)
    IsAuctionApproved(auctionId)
    nonReentrant
    {
        require (!forSale[auctionId], "token only for sale");
        address payable lastBidder = auctions[auctionId].bidder;
        require(
            auctions[auctionId].firstBidTime == 0 ||
            block.timestamp <
            auctions[auctionId].firstBidTime.add(auctions[auctionId].duration),
            "Auction expired"
        );
        require(
            amount >= auctions[auctionId].reservePrice,
                "Must send at least reservePrice"
        );
        require(
            amount >= auctions[auctionId].amount.add(
                auctions[auctionId].amount.mul(minBidIncrementPercentage).div(100)
            ),
            "Must send more than last bid by minBidIncrementPercentage amount"
        );

        // For Zora Protocol, ensure that the bid is valid for the current bidShare configuration
        if(auctions[auctionId].tokenContract == zora) {
            require(
                IMarket(IMediaExtended(zora).marketContract()).isValidBid(
                    auctions[auctionId].tokenId,
                    amount
                ),
                "Bid invalid for share splitting"
            );
        }

        // If this is the first valid bid, we should set the starting time now.
        // If it's not, then we should refund the last bidder
        if(auctions[auctionId].firstBidTime == 0) {
            auctions[auctionId].firstBidTime = block.timestamp;
        } else if(lastBidder != address(0)) {
            _handleOutgoingBid(lastBidder, auctions[auctionId].amount, auctions[auctionId].auctionCurrency);
        }

        _handleIncomingBid(amount, auctions[auctionId].auctionCurrency);

        auctions[auctionId].amount = amount;
        auctions[auctionId].bidder = payable(msg.sender);


        bool extended = false;
        // at this point we know that the timestamp is less than start + duration (since the auction would be over, otherwise)
        // we want to know by how much the timestamp is less than start + duration
        // if the difference is less than the timeBuffer, increase the duration by the timeBuffer
        if (
            auctions[auctionId].firstBidTime.add(auctions[auctionId].duration).sub(
                block.timestamp
            ) < timeBuffer
        ) {
            // Playing code golf for gas optimization:
            // uint256 expectedEnd = auctions[auctionId].firstBidTime.add(auctions[auctionId].duration);
            // uint256 timeRemaining = expectedEnd.sub(block.timestamp);
            // uint256 timeToAdd = timeBuffer.sub(timeRemaining);
            // uint256 newDuration = auctions[auctionId].duration.add(timeToAdd);
            uint256 oldDuration = auctions[auctionId].duration;
            auctions[auctionId].duration =
                oldDuration.add(timeBuffer.sub(auctions[auctionId].firstBidTime.add(oldDuration).sub(block.timestamp)));
            extended = true;
        }

        emit AuctionBid(
            auctionId,
            auctions[auctionId].tokenId,
            auctions[auctionId].tokenContract,
            msg.sender,
            amount,
            lastBidder == address(0), // firstBid boolean
            extended
        );

        if (extended) {
            emit AuctionDurationExtended(
                auctionId,
                auctions[auctionId].tokenId,
                auctions[auctionId].tokenContract,
                auctions[auctionId].duration
            );
        }
    }

    /**
     * @notice End an auction, finalizing the bid on Zora if applicable and paying out the respective parties.
     * @dev If for some reason the auction cannot be finalized (invalid token recipient, for example),
     * The auction is reset and the NFT is transferred back to the auction creator.
     */
    function endAuction(uint256 auctionId) external override auctionExists(auctionId) nonReentrant {
        require(
            auctions[auctionId].firstBidTime != 0,
            "Auction hasn't begun or Token for sale"
        );
        require(
            block.timestamp >=
            auctions[auctionId].firstBidTime.add(auctions[auctionId].duration),
            "Auction hasn't completed"
        );
        _TransferProcess(auctionId,auctions[auctionId].amount);

        delete auctions[auctionId];
    }
    /**
     * @notice End an sale, finalizing the sale on Zora if applicable and paying out the respective parties.
     * @dev If for some reason the sale cannot be finalized (invalid token recipient, for example),
     * The sale is reset and the NFT is transferred back to the sale creator.
     */
    function buyNow (uint256 auctionId) external override payable 
    auctionExists(auctionId) 
    IsAuctionApproved(auctionId) 
    nonReentrant 
    {
        require (forSale[auctionId], "token not for sale");

        auctions[auctionId].bidder = payable(msg.sender);
        
        if(auctions[auctionId].tokenContract == zora) {
            require(
                IMarket(IMediaExtended(zora).marketContract()).isValidBid(
                    auctions[auctionId].tokenId,
                    auctions[auctionId].reservePrice
                ),
                "Bid invalid for share splitting"
            );

        }
         
        _handleIncomingBid(auctions[auctionId].reservePrice, auctions[auctionId].auctionCurrency);

       _TransferProcess(auctionId,auctions[auctionId].reservePrice );

       delete auctions[auctionId];
    }


    /**
     * @notice Cancel an auction.
     * @dev Transfers the NFT back to the auction creator and emits an AuctionCanceled event
     */
    function cancelAuction(uint256 auctionId) external override  auctionExists(auctionId) _auctionCheck(auctionId) nonReentrant{
        require(
            auctions[auctionId].tokenOwner == msg.sender || auctions[auctionId].curator == msg.sender,
            "Can only be called by auction creator or curator"
        );
        _cancelAuction(auctionId);
    }

    /**
     * @dev Given an amount and a currency, transfer the currency to this contract.
     * If the currency is ETH (0x0), attempt to wrap the amount as WETH
     */
    function _handleIncomingBid(uint256 amount, address currency) internal {
        // If this is an ETH bid, ensure they sent enough and convert it to WETH under the hood
        if(currency == address(0)) {
            require(msg.value == amount, "Sent ETH Value does not match specified bid amount");
            IWETH(wethAddress).deposit{value: amount}();
        } else {
            // We must check the balance that was actually transferred to the auction,
            // as some tokens impose a transfer fee and would not actually transfer the
            // full amount to the market, resulting in potentally locked funds
            IERC20 token = IERC20(currency);
            uint256 beforeBalance = token.balanceOf(address(this));
            token.safeTransferFrom(msg.sender, address(this), amount);
            uint256 afterBalance = token.balanceOf(address(this));
            require(beforeBalance.add(amount) == afterBalance, "Token transfer call did not transfer expected amount");
        }
    }

    function _handleOutgoingBid(address to, uint256 amount, address currency) internal {
        // If the auction is in ETH, unwrap it from its underlying WETH and try to send it to the recipient.
        if(currency == address(0)) {
            IWETH(wethAddress).withdraw(amount);

            // If the ETH transfer fails (sigh), rewrap the ETH and try send it as WETH.
            if(!_safeTransferETH(to, amount)) {
                IWETH(wethAddress).deposit{value: amount}();
                IERC20(wethAddress).safeTransfer(to, amount);
            }
        } else {
            IERC20(currency).safeTransfer(to, amount);
        }
    }

    function _safeTransferETH(address to, uint256 value) internal returns (bool) {
        (bool success, ) = to.call{value: value}(new bytes(0));
        return success;
    }

    function _cancelAuction(uint256 auctionId) internal {
        address tokenOwner = auctions[auctionId].tokenOwner;
        IERC721(auctions[auctionId].tokenContract).safeTransferFrom(address(this), tokenOwner, auctions[auctionId].tokenId);

        emit AuctionCanceled(auctionId, auctions[auctionId].tokenId, auctions[auctionId].tokenContract, tokenOwner);
        delete auctions[auctionId];
    }

    function _approveAuction(uint256 auctionId, bool approved) internal {
        if (auctions[auctionId].duration != 0) {
            auctions[auctionId].approved = approved;
            emit AuctionApprovalUpdated(auctionId, auctions[auctionId].tokenId, auctions[auctionId].tokenContract, approved);
        }else {
            auctions[auctionId].approved = approved;
            emit SaleApprovalUpdated(auctionId, auctions[auctionId].tokenId, auctions[auctionId].tokenContract,approved);
        }
    }

    function _exists(uint256 auctionId) internal view returns(bool) {
        return auctions[auctionId].tokenOwner != address(0);
    }

    function _handleZoraAuctionSettlement(uint256 auctionId, uint256 amount) internal returns (bool, uint256) {
        address currency = auctions[auctionId].auctionCurrency == address(0) ? wethAddress : auctions[auctionId].auctionCurrency;

        IMarket.Bid memory bid = IMarket.Bid({
            amount: amount,
            currency: currency,
            bidder: address(this),
            recipient: auctions[auctionId].bidder,
            sellOnShare: Decimal.D256(0)
        });

        IERC20(currency).approve(IMediaExtended(zora).marketContract(), bid.amount);
        IMedia(zora).setBid(auctions[auctionId].tokenId, bid);
        uint256 beforeBalance = IERC20(currency).balanceOf(address(this));
        try IMedia(zora).acceptBid(auctions[auctionId].tokenId, bid) {} catch {
            // If the underlying NFT transfer here fails, we should cancel the auction and refund the winner
            IMediaExtended(zora).removeBid(auctions[auctionId].tokenId);
            return (false, 0);
        }
        uint256 afterBalance = IERC20(currency).balanceOf(address(this));

        // We have to calculate the amount to send to the token owner here in case there was a
        // sell-on share on the token
        return (true, afterBalance.sub(beforeBalance));
    }
    function _TransferProcess(uint256 auctionId, uint256 amount) internal {
         address currency = auctions[auctionId].auctionCurrency == address(0) ? wethAddress : auctions[auctionId].auctionCurrency;
        uint256 curatorFee = 0;

        uint256 tokenOwnerProfit = amount;

        if(auctions[auctionId].tokenContract == zora) {
            // If the auction is running on zora, settle it on the protocol
            (bool success, uint256 remainingProfit) = _handleZoraAuctionSettlement(auctionId,tokenOwnerProfit);
            tokenOwnerProfit = remainingProfit;
            if(success != true) {
                _handleOutgoingBid(auctions[auctionId].bidder, tokenOwnerProfit, auctions[auctionId].auctionCurrency);
                _cancelAuction(auctionId);
                return;
            }
        } else {
            // Otherwise, transfer the token to the winner and pay out the participants below
            try IERC721(auctions[auctionId].tokenContract).safeTransferFrom(address(this), auctions[auctionId].bidder, auctions[auctionId].tokenId) {} catch {
                _handleOutgoingBid(auctions[auctionId].bidder, tokenOwnerProfit, auctions[auctionId].auctionCurrency);
                _cancelAuction(auctionId);
                return;
            }
        }


        if(auctions[auctionId].curator != address(0)) {
            curatorFee = tokenOwnerProfit.mul(auctions[auctionId].curatorFeePercentage).div(100);
            tokenOwnerProfit = tokenOwnerProfit.sub(curatorFee);
            _handleOutgoingBid(auctions[auctionId].curator, curatorFee, auctions[auctionId].auctionCurrency);
        }
        _handleOutgoingBid(auctions[auctionId].tokenOwner, tokenOwnerProfit, auctions[auctionId].auctionCurrency);
        if (auctions[auctionId].duration == 0){
            emit SaleEnded(
            auctionId,
            auctions[auctionId].tokenId,
            auctions[auctionId].tokenContract,
            auctions[auctionId].tokenOwner,
            auctions[auctionId].curator,
            auctions[auctionId].bidder,
            tokenOwnerProfit,
            curatorFee,
            currency);
        }else {
            emit AuctionEnded(
            auctionId,
            auctions[auctionId].tokenId,
            auctions[auctionId].tokenContract,
            auctions[auctionId].tokenOwner,
            auctions[auctionId].curator,
            auctions[auctionId].bidder,
            tokenOwnerProfit,
            curatorFee,
            currency);
        }
    }

    // TODO: consider reverting if the message sender is not WETH
    receive() external payable {}
    fallback() external payable {}
}