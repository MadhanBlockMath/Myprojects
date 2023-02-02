// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

import {SafeMath} from "../../openzeppelin/utils/math/SafeMath.sol";
import {IERC721, IERC165} from "../../openzeppelin/token/ERC721/IERC721.sol";
import {IERC1155} from "../../openzeppelin/token/ERC1155/IERC1155.sol";
import {ReentrancyGuard} from "../../openzeppelin/security/ReentrancyGuard.sol";
import {IERC20} from "../../openzeppelin/token/ERC20/IERC20.sol";
import {SafeERC20} from "../../openzeppelin/token/ERC20/utils/SafeERC20.sol";
import {ICreatorCore} from "../../manifold/creator-core/core/ICreatorCore.sol";
import {AdminControl} from "../../manifold/libraries-solidity/access/AdminControl.sol";
import {IERC721CreatorCore} from "../../manifold/creator-core/core/IERC721CreatorCore.sol";
import {IERC1155CreatorCore} from "../../manifold/creator-core/core/IERC1155CreatorCore.sol";
import {Counters} from "../../openzeppelin/utils/Counters.sol";
import {IAuctionHouse} from "./../interfaces/IAuctionHouse.sol";

/**
 * @title IWrapperNativeToken
 * @dev Interface for Wrapped native tokens such as WETH, WMATIC, WBNB, etc
 */
interface IWrappedNativeToken {
    function deposit() external payable;

    function withdraw(uint256 wad) external;

    function transfer(address to, uint256 value) external returns (bool);
}

contract ReservedAuction is ReentrancyGuard, AdminControl {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;
    using Counters for Counters.Counter;

    // Interface ID constants
    bytes4 constant ERC721_INTERFACE_ID = 0x80ac58cd;
    bytes4 constant ERC1155_INTERFACE_ID = 0xd9b67a26;
    bytes4 constant ROYALTIES_CREATORCORE_INTERFACE_ID = 0xbb3bafd6;
    bytes4 private constant _INTERFACE_ID_ROYALTIES_EIP2981 = 0x2a55205a;
    bytes4 private constant _INTERFACE_ID_ROYALTIES_RARIBLE = 0xb7799584;
    bytes4 private constant _INTERFACE_ID_ROYALTIES_FOUNDATION = 0xd5a06d4c;

    // 1 Ether in Wei, 10^18
    int64 constant ONE_ETH_WEI = 1e18;

    // ERC20 address of the Native token (can be WETH, WBNB, WMATIC, etc)
    address public wrappedNativeToken;

    // Address of the Admin
    address public adminAddress;

    // Platform Address
    address payable public platformAddress;

    // Fee percentage to the Platform
    uint256 public platformFeePercentage;

    /// @notice The details to be provided to Auction the token
    /// @param auctionId the Id of the created auction
    /// @param tokenContract the token contract address
    /// @param tokenOwner the owner of the nft token
    /// @param tokenId the token Id of the owner owns
    /// @param quantity the quantity of tokens for 1155 only
    /// @param buyer is going to buy the token
    /// @param paymentToken the type of payment currency that the buyers pays
    /// @param paymentAmount the amount to be paid in the payment currency
    /// @param paymentSettlementAddress is going to send payment to the token owner
    /// @param taxSettlementAddress the tax receiving address
    /// @param taxAmount the amount to be paid in the payment currency
    struct AuctionList {
        string auctionId;
        address tokenContract;
        address tokenOwner;
        uint256 tokenId;
        uint256 quantity;
        address buyer;
        address paymentToken;
        uint256 paymentAmount;
        address paymentSettlementAddress;
        address taxSettlementAddress;
        uint256 taxAmount;
    }

    /// @notice The Bidding List for a Token
    /// @param highestBidder Address of the Bidder
    /// @param highestBid Price quote by them
    struct BidList {
        address highestBidder;
        uint256 highestBid;
    }

    // A mapping of all of the bids currently running.
    mapping(uint256 => BidList[]) public bids;

    // Emits an event when a new BidList is added, you can use this to update remote item lists.
    event BidAdded(address bidder, uint256 amount);

    /// @notice Emitted when an End Auction Event is completed
    /// @param auctionId for id
    /// @param tokenId The NFT tokenId
    /// @param tokenContract The NFT Contract address
    /// @param quantity The total quantity of the ERC1155 token if ERC721 it is 1
    /// @param tokenOwner The address of the Token Owner
    /// @param highestBidder Address of the highest bidder
    /// @param amount is highest bid Price
    /// @param paymentToken ERC20 address chosen by TokenOwner for Payments
    /// @param marketplaceAddress Address of the Platform
    /// @param platformFee Fee sent to the Platform Address
    /// @param bidderlist is bidding history

    event AuctionClosed(
        string auctionId,
        uint256 indexed tokenId,
        address indexed tokenContract,
        uint256 quantity,
        address indexed tokenOwner,
        address highestBidder,
        uint256 amount,
        uint256 tax,
        address paymentToken,
        address marketplaceAddress,
        uint256 platformFee,
        BidList[] bidderlist
    );

    /// @notice Emitted when an Royalty Payout is executed
    /// @param tokenId The NFT tokenId
    /// @param tokenContract The NFT Contract address
    /// @param recipient Address of the Royalty Recipient
    /// @param amount Amount sent to the royalty recipient address
    event RoyaltyPayout(
        address tokenContract,
        uint256 tokenId,
        address recipient,
        uint256 amount
    );

    /// @param _wrappedNativeToken Native ERC20 Address
    /// @param _platformAddress The Platform Address
    /// @param _platformFeePercentage The Platform fee percentage
    /// @param _adminAddress Admin Address
    constructor(
        address _wrappedNativeToken,
        address _platformAddress,
        uint256 _platformFeePercentage,
        address _adminAddress
    ) {
        require(_platformAddress != address(0), "Invalid Platform Address");
        require(_adminAddress != address(0), "Invalid Admin Address");
        require(
            _wrappedNativeToken != address(0),
            "Invalid WrappedNativeToken Address"
        );

        wrappedNativeToken = _wrappedNativeToken;
        platformAddress = payable(_platformAddress);
        platformFeePercentage = _platformFeePercentage;
        adminAddress = _adminAddress;
    }

    // Gets the items for the used who called the function
    function getbids(uint256 _auctionId)
        public
        view
        returns (BidList[] memory)
    {
        return bids[_auctionId];
    }

    // Adds an Bid to the user's Bid list who called the function.
    function addBid(uint256 _auctionId, uint256 _amount) public {
        BidList memory newItem = BidList(msg.sender, _amount);
        bids[_auctionId].push(newItem);

        // emits Bid added event.
        emit BidAdded(msg.sender, _amount);
    }

    /// @notice Ending an Auction  with highest bidder
    /// @param order Order struct consists of the listed token details
    /// @param bidHistory BidList which contains the list of bidders with the details
    function EndAuction(AuctionList memory order, BidList[] memory bidHistory)
        external
        payable
        nonReentrant
    {
        // Validating the InterfaceID
        require(
            (IERC165(order.tokenContract).supportsInterface(
                ERC721_INTERFACE_ID
            ) ||
                IERC165(order.tokenContract).supportsInterface(
                    ERC1155_INTERFACE_ID
                )),
            "tokenContract does not support ERC721 or ERC1155 interface"
        );

        // Validating the msg.sender with admin or buyer
        require(
            order.buyer == msg.sender || adminAddress == msg.sender,
            "Only Buyer or the Admin can call this function"
        );

        uint256 remainingProfit = order.paymentAmount;

        // Tax Settlement
        _handlePayment(
            order.buyer,
            payable(order.taxSettlementAddress),
            order.paymentToken,
            order.taxAmount
        );

        // PlatformFee Settlement
        uint256 platformFee = 0;
        if (platformAddress != address(0) && platformFeePercentage > 0) {
            platformFee = (remainingProfit * platformFeePercentage) / 10000;
            remainingProfit = remainingProfit - platformFee;

            _handlePayment(
                order.buyer,
                platformAddress,
                order.paymentToken,
                platformFee
            );
        }

        // Royalty Fee Payout Settlement
        _handleRoyaltyEnginePayout(
            order.buyer,
            order.tokenContract,
            order.tokenId,
            remainingProfit,
            order.paymentToken
        );

        // Transfer the balance to the tokenOwner
        _handlePayment(
            order.buyer,
            payable(order.paymentSettlementAddress),
            order.paymentToken,
            remainingProfit
        );

        // Transferring the Tokens
        _tokenTransaction(order);

        emit AuctionClosed(
            order.auctionId,
            order.tokenId,
            order.tokenContract,
            order.quantity,
            order.tokenOwner,
            order.buyer,
            order.paymentAmount,
            order.taxAmount,
            order.paymentToken,
            platformAddress,
            platformFee,
            bidHistory
        );
    }

    /// @notice Transferring the tokens based on the from and to Address
    /// @param _order Order struct consists of the listedtoken details
    function _tokenTransaction(AuctionList memory _order) internal {
        if (
            IERC165(_order.tokenContract).supportsInterface(ERC721_INTERFACE_ID)
        ) {
            require(
                IERC721(_order.tokenContract).ownerOf(_order.tokenId) ==
                    _order.tokenOwner,
                "maker is not the owner"
            );

            // Transferring the ERC721
            IERC721(_order.tokenContract).safeTransferFrom(
                _order.tokenOwner,
                _order.buyer,
                _order.tokenId
            );
        }
        if (
            IERC165(_order.tokenContract).supportsInterface(
                ERC1155_INTERFACE_ID
            )
        ) {
            uint256 ownerBalance = IERC1155(_order.tokenContract).balanceOf(
                _order.tokenOwner,
                _order.tokenId
            );
            require(
                _order.quantity <= ownerBalance && _order.quantity > 0,
                "Insufficeint token balance"
            );

            // Transferring the ERC1155
            IERC1155(_order.tokenContract).safeTransferFrom(
                _order.tokenOwner,
                _order.buyer,
                _order.tokenId,
                _order.quantity,
                "0x"
            );
        }
    }

    /// @notice Settle the Payment based on the given parameters
    /// @param _from Address from whom the amount to be transferred
    /// @param _to Address to whom need to settle the payment
    /// @param _paymentToken Address of the ERC20 Payment Token
    /// @param _amount Amount to be transferred
    function _handlePayment(
        address _from,
        address payable _to,
        address _paymentToken,
        uint256 _amount
    ) private {
        bool success;
        if (_paymentToken == address(0)) {
            // transferreng the native currency
            (success, ) = _to.call{value: _amount}(new bytes(0));
            require(success, "transaction failed");
        } else {
            // transferring ERC20 currency
            IERC20(_paymentToken).safeTransferFrom(_from, _to, _amount);
        }
    }

    /// @notice Get the Royalty Fee details for the tokenID
    /// @param tokenContract The NFT Contract address
    /// @param tokenId The NFT tokenId
    /// @param amount the NFT price
    function getRoyaltyInfo(
        address tokenContract,
        uint256 tokenId,
        uint256 amount
    )
        private
        view
        returns (
            address payable[] memory recipients,
            uint256[] memory bps // Royalty amount denominated in basis points
        )
    {
        if (
            IERC165(tokenContract).supportsInterface(
                ROYALTIES_CREATORCORE_INTERFACE_ID
            )
        ) {
            (recipients, bps) = ICreatorCore(tokenContract).getRoyalties(
                tokenId
            );
        } else if (
            IERC165(tokenContract).supportsInterface(
                _INTERFACE_ID_ROYALTIES_RARIBLE
            )
        ) {
            recipients = ICreatorCore(tokenContract).getFeeRecipients(tokenId);
            bps = ICreatorCore(tokenContract).getFeeBps(tokenId);
        } else if (
            IERC165(tokenContract).supportsInterface(
                _INTERFACE_ID_ROYALTIES_FOUNDATION
            )
        ) {
            (recipients, bps) = ICreatorCore(tokenContract).getFees(tokenId);
        } else if (
            IERC165(tokenContract).supportsInterface(
                _INTERFACE_ID_ROYALTIES_EIP2981
            )
        ) {
            (address recipient, uint256 amountbps) = ICreatorCore(tokenContract)
                .royaltyInfo(tokenId, amount);
            recipients[0] = payable(recipient);
            bps[0] = (amountbps * 10000) / amount;
        }
    }

    /// @notice Settle the Royalty Payment based on the given parameters
    /// @param _tokenContract The NFT Contract address
    /// @param _tokenId The NFT tokenId
    /// @param _amount Amount to be transferred
    /// @param _payoutCurrency Address of the ERC20 Payout
    function _handleRoyaltyEnginePayout(
        address _buyer,
        address _tokenContract,
        uint256 _tokenId,
        uint256 _amount,
        address _payoutCurrency
    ) private returns (uint256) {
        // Store the initial amount
        uint256 amountRemaining = _amount;
        uint256 feeAmount;

        // Verifying whether the token contract supports Royalties of supported interfaces
        (
            address payable[] memory recipients,
            uint256[] memory bps // Royalty amount denominated in basis points
        ) = getRoyaltyInfo(_tokenContract, _tokenId, _amount);

        // Store the number of recipients
        uint256 totalRecipients = recipients.length;

        // If there are no royalties, return the initial amount
        if (totalRecipients == 0) return _amount;

        // Payout each royalty
        for (uint256 i = 0; i < totalRecipients; ) {
            // Cache the recipient and amount
            address payable recipient = recipients[i];

            feeAmount = (bps[i] * _amount) / 10000;

            // Ensure that we aren't somehow paying out more than we have
            require(amountRemaining >= feeAmount, "insolvent");

            _handlePayment(_buyer, recipient, _payoutCurrency, feeAmount);
            emit RoyaltyPayout(_tokenContract, _tokenId, recipient, feeAmount);

            // Cannot underflow as remaining amount is ensured to be greater than or equal to royalty amount
            unchecked {
                amountRemaining -= feeAmount;
                ++i;
            }
        }

        return amountRemaining;
    }

    /// @notice Withdraw the funds to contract owner
    function withdraw() external onlyOwner {
        require(address(this).balance > 0, "zero balance in the contract");
        bool success;
        address payable to = payable(msg.sender);
        (success, ) = to.call{value: address(this).balance}(new bytes(0));
        require(success, "withdrawal failed");
    }

    /// @notice Update the admin Address
    /// @param _adminAddress Admin Address
    function updateAdminAddress(address _adminAddress) external onlyOwner {
        require(
            _adminAddress != address(0) && _adminAddress != adminAddress,
            "Invalid Admin Address"
        );
        adminAddress = _adminAddress;
    }

    /// @notice Update the platform Address
    /// @param _platformAddress The Platform Address
    function updatePlatformAddress(address _platformAddress)
        external
        onlyOwner
    {
        require(
            _platformAddress != address(0) &&
                _platformAddress != platformAddress,
            "Invalid Platform Address"
        );
        platformAddress = payable(_platformAddress);
    }

    /// @notice Update the Platform Fee Percentage
    /// @param _platformFeePercentage The Platform fee percentage
    function updatePlatformFeePercentage(uint256 _platformFeePercentage)
        external
        onlyOwner
    {
        require(
            _platformFeePercentage < 10000,
            "platformFee should not be more than 100 %"
        );
        platformFeePercentage = _platformFeePercentage;
    }

    // TODO: consider reverting if the message sender is not WETH
    receive() external payable {}

    fallback() external payable {}
}
