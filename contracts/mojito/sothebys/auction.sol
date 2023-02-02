// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

import {IERC721, IERC165} from "../../openzeppelin/token/ERC721/IERC721.sol";
import {IERC1155} from "../../openzeppelin/token/ERC1155/IERC1155.sol";
import {ReentrancyGuard} from "../../openzeppelin/security/ReentrancyGuard.sol";
import {IERC20} from "../../openzeppelin/token/ERC20/IERC20.sol";
import {SafeERC20} from "../../openzeppelin/token/ERC20/utils/SafeERC20.sol";
import {ICreatorCore} from "../../manifold/creator-core/core/ICreatorCore.sol";
import {AdminControl} from "../../manifold/libraries-solidity/access/AdminControl.sol";
import {MerkleProof} from "../../openzeppelin/utils/cryptography/MerkleProof.sol";
import {Address} from "../../openzeppelin/utils/Address.sol";

interface IPriceFeed {
    function getLatestPrice(uint256 amount, address fiat)
        external
        view
        returns (uint256);
}

interface IRoyaltyEngine {
    function getRoyalty(address collectionAddress, uint256 tokenId)
        external
        view
        returns (address payable[] memory, uint256[] memory);
}

contract onchainAuction is ReentrancyGuard, AdminControl {
    using SafeERC20 for IERC20;

    /// @notice The metadata for a given Order
    /// @param nftContractAddress the nft contract address
    /// @param tokenId the Nft token Id
    /// @param quantityOf1155 the quantity of 1155 for auction
    /// @param tokenOwnerAddress the address of the nft owner of the auction
    /// @param mimimumCryptoPrice the mimimum price of the crypto in
    /// @param paymentCurrency the payment currency for seller requirement
    /// @param whitelistedBuyers the root hash of the list of whitelisted address
    /// @param blacklistedBuyers the root hash of the list of blackisted address
    /// @param paymentSettlement the settlement address and payment percentage provided in basis points
    struct createAuctionList {
        address nftContractAddress;
        uint256 tokenId;
        uint256 quantityOf1155;
        address tokenOwnerAddress;
        uint256 minimumBidCryptoPrice;
        address paymentCurrency; // cant support multiple currency here
        bytes32 whitelistedBuyers;
        bytes32 blacklistedBuyers;
        settlementList paymentSettlement;
    }

    /// @notice The metadata for a given Order
    /// @param paymentSettlementAddress the settlement address for the listed tokens
    /// @param taxSettlementAddress the taxsettlement address for settlement of tax fee
    /// @param platformSettlementAddress the platform address for settlement of platform fee
    /// @param platformFeePercentage the platform fee given in basis points
    /// @param commissionAddress the commission address for settlement of commission fee
    /// @param commissionFeePercentage the commission fee given in basis points
    struct settlementList {
        address paymentSettlementAddress;
        address taxSettlementAddress;
        address platformSettlementAddress;
        uint16 platformFeePercentage; // in basis points
        address commissionAddress;
        uint16 commissionFeePercentage; // in basis points
    }

    // Interface ID constants
    bytes4 private constant ERC721_INTERFACE_ID = 0x80ac58cd;
    bytes4 private constant ERC1155_INTERFACE_ID = 0xd9b67a26;

    // Platform Address
    address payable platformAddress;

    // Fee percentage to the Platform
    uint16 platformFeePercentage;

    // The address of the royaltySupport to use via this contract
    IRoyaltyEngine public royaltySupport;

    // @notice the bid history of tokenId
    // @param startTime the time when the bid starts
    // @param endTime the time when the bid ends
    // @param bidder the address of the last three bidder
    // @param amount the bid amount of the last three bidder
    struct bidHistory {
        uint32 startTime;
        uint32 endTime;
        address[2] bidder;
        uint256[2] amount;
    }

    /// @notice The Bidding List for a Token
    /// @param highestBidder Address of the Bidder
    /// @param highestBid Price quote by them
    struct BidList {
        address highestBidder;
        uint256 highestBid;
    }

    // listing the auction details in the string named auction Id
    mapping(string => createAuctionList) public listings;

    // listing auctionId to tokenId to get the bidHistory for each tokens seperately.
    mapping(string => bidHistory) bidderDetails;

    // validating saleId
    mapping(string => bool) usedAuctionId;

    // @notice Emitted when an auction cration is completed
    //  @param createdDetails the details of the created auction
    event AuctionCreated(createAuctionList indexed createdDetails);
    // @notice Emitted when an auction bid is completed
    // @param auctionId the id of the created auction
    // @param tokenId the tokenId for which bid is made
    // @param bidder the address of the bidder
    // @param bidAmount the amount of the bid
    event AuctionBid(
        string indexed auctionId,
        address indexed bidder,
        uint256 indexed bidAmount
    );
    // @notice Emitted when an auction is ended
    // @param auctionId the id of the created auction
    // @param tokenId the tokenId of the nft
    // @param createdDetails the details of the auction
    // @param AuctionHistory the history of the auction
    event AuctionEnded(
        string indexed auctionId,
        uint256 indexed tokenId,
        address indexed tokenOwner,
        createAuctionList createdDetails,
        bidHistory AuctionHistory
    );
    // @notice Emitted when an auction is closed
    // @param auctionId the id of the created auction
    event CancellAuction(string indexed auctionId);

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

    /// @param _platformAddress The Platform Address
    /// @param _platformFeePercentage The Platform fee percentage
    constructor(address _platformAddress, uint16 _platformFeePercentage) {
        require(_platformAddress != address(0), "Invalid Platform Address");
        require(
            _platformFeePercentage < 10000,
            "platformFee should not be more than 100 %"
        );

        platformAddress = payable(_platformAddress);
        platformFeePercentage = _platformFeePercentage;
    }

    /*
     * @notice creating a batch auction using batch details .
     * @param list gives the listing details to create a auction
     * @param auctionId consist of the id of the listed auction
     */
    function createAuction(
        string calldata auctionId,
        createAuctionList calldata list,
        uint32 startTime,
        uint32 endTime
    ) external nonReentrant {
        // checks for should not use the same auctionId
        require(!usedAuctionId[auctionId], "auctionId is already used");

        require(
            isAdmin(msg.sender) || list.tokenOwnerAddress == msg.sender,
            "Only the buyer or admin or owner of this contract can call this function"
        );

        uint16 totalFeeBasisPoints;
        // checks for platform and commission fee to be less than 100 %
        if (list.paymentSettlement.platformFeePercentage != 0) {
            totalFeeBasisPoints += (list
                .paymentSettlement
                .platformFeePercentage +
                list.paymentSettlement.commissionFeePercentage);
        } else {
            totalFeeBasisPoints += (platformFeePercentage +
                list.paymentSettlement.commissionFeePercentage);
        }
        require(
            totalFeeBasisPoints < 10000,
            "The total fee basis point should be less than 10000"
        );
        // checks for amount to buy the token should not be provided as zero
        require(
            list.minimumBidCryptoPrice > 0,
            "minimum price should be greater than zero"
        );

        // checks to provide only supported interface for nftContractAddress
        require(
            IERC165(list.nftContractAddress).supportsInterface(
                ERC721_INTERFACE_ID
            ) ||
                IERC165(list.nftContractAddress).supportsInterface(
                    ERC1155_INTERFACE_ID
                ),
            "should provide only supported Nft Address"
        );
        if (
            IERC165(list.nftContractAddress).supportsInterface(
                ERC721_INTERFACE_ID
            )
        ) {
            require(
                IERC721(list.nftContractAddress).ownerOf(list.tokenId) ==
                    list.tokenOwnerAddress,
                "maker is not the owner"
            );
        } else if (
            IERC165(list.nftContractAddress).supportsInterface(
                ERC1155_INTERFACE_ID
            )
        ) {
            uint256 tokenQty = IERC1155(list.nftContractAddress).balanceOf(
                list.tokenOwnerAddress,
                list.tokenId
            );
            require(
                list.quantityOf1155 <= tokenQty && list.quantityOf1155 > 0,
                "Insufficient token balance"
            );
        }

        // checks for paymentSettlementAddress should not be zero
        require(
            list.paymentSettlement.paymentSettlementAddress != address(0),
            "should provide Settlement address"
        );

        // checks to support only erc-20 and native currency
        require(
            Address.isContract(list.paymentCurrency) ||
                list.paymentCurrency == address(0),
            "Auction  support only native and erc20 currency"
        );

        // checks for taxSettlementAddress should not be zero
        require(
            list.paymentSettlement.taxSettlementAddress != address(0),
            "should provide tax Settlement address"
        );

        // checks for timestamp for starttime and endtime to be greater than zero
        require(
            startTime > 0 && endTime > 0,
            "auction time should not be provided as zero"
        );
        listings[auctionId] = list;

        bidderDetails[auctionId].startTime = startTime;

        bidderDetails[auctionId].endTime = endTime;

        usedAuctionId[auctionId] = true;

        emit AuctionCreated(list);
    }

    /**
     * @notice bid, making a bid of a token in created auction
     * @param auctionId the id if the created auction
     * @param bidAmount the amount of to the bid
     */
    function bid(
        string calldata auctionId,
        uint256 bidAmount,
        bytes32[] memory proof
    ) external payable nonReentrant {
        createAuctionList memory listingDetails = listings[auctionId];
        bytes32 leaf = keccak256(abi.encodePacked(msg.sender));
        if (listingDetails.whitelistedBuyers != bytes32(0)) {
            require(
                MerkleProof.verify(
                    proof,
                    listingDetails.whitelistedBuyers,
                    leaf
                ),
                "bidder should be a whitelisted Buyer"
            );
        }
        if (listingDetails.blacklistedBuyers != bytes32(0)) {
            require(
                !MerkleProof.verify(
                    proof,
                    listingDetails.blacklistedBuyers,
                    leaf
                ),
                "you are been blacklisted from bidding"
            );
        }

        // checks for auctionId is created for auction
        require(usedAuctionId[auctionId], "unsupported sale");

        bidHistory memory bidderdetails = bidderDetails[auctionId];
        require(
            bidderdetails.startTime <= block.timestamp,
            "the auction has not started"
        );

        if (
            bidAmount >= listingDetails.minimumBidCryptoPrice &&
            bidAmount > bidderdetails.amount[1]
        ) {
            if (listingDetails.paymentCurrency != address(0)) {
                // checks the buyer has sufficient amount to buy the nft
                require(
                    IERC20(listingDetails.paymentCurrency).balanceOf(
                        msg.sender
                    ) >= bidAmount,
                    "insufficient Erc20 amount"
                );
            } else if (listingDetails.paymentCurrency == address(0)) {
                require(msg.value >= bidAmount, "insufficent Eth amount");
            }
        } else {
            revert("provide bid amount higher than previous bid");
        }
        // stores the last 2 bidder details
        if (bidderdetails.bidder.length != 0) {
            if (bidderdetails.amount[0] != 0) {
                _handlePayment(
                    address(this),
                    payable(bidderdetails.bidder[0]),
                    listingDetails.paymentCurrency,
                    bidderdetails.amount[0]
                );
            }
            bidderdetails.bidder[0] = bidderdetails.bidder[1];
            bidderdetails.amount[0] = bidderdetails.amount[1];
        }
        if (bidderdetails.endTime > block.timestamp) {
            bidderdetails.bidder[1] = msg.sender;
            bidderdetails.amount[1] = bidAmount;
            _handlePayment(
                bidderdetails.bidder[1],
                payable(address(this)),
                listingDetails.paymentCurrency,
                bidderdetails.amount[1]
            );
        }

        emit AuctionBid(auctionId, msg.sender, bidAmount);
    }

    function endAuction(string memory auctionId, uint256 tax)
        external
        adminRequired
        nonReentrant
    {
        // checks for auctionId is created for auction
        require(usedAuctionId[auctionId], "unsupported sale");

        bidHistory memory bidderdetails = bidderDetails[auctionId];
        createAuctionList memory listingDetails = listings[auctionId];
        // checks the auction time is ended
        require(
            block.timestamp >= bidderdetails.endTime,
            "auction has not started or not yet ended"
        );
        if (bidderdetails.amount[0] != 0) {
            _handlePayment(
                address(this),
                payable(bidderdetails.bidder[0]),
                listingDetails.paymentCurrency,
                bidderdetails.amount[0]
            );
        }

        uint256 bidAmount = bidderdetails.amount[1];
        address buyer = bidderdetails.bidder[1];
        address paymentToken = listingDetails.paymentCurrency;
        address tokenContract = listingDetails.nftContractAddress;
        uint256 tokenId = listingDetails.tokenId;

        // Transferring  the NFT tokens to the highest Bidder
        _tokenTransaction(
            listingDetails.tokenOwnerAddress,
            tokenContract,
            buyer,
            tokenId,
            listingDetails.quantityOf1155
        );

        // transferring the excess amount given by by buyer as tax to taxSettlementAddress
        if (tax != 0) {
            _handlePayment(
                buyer,
                payable(listingDetails.paymentSettlement.taxSettlementAddress),
                paymentToken,
                tax
            );
        }

        uint256 remainingProfit = bidAmount;

        // PlatformFee Settlement
        uint256 paymentAmount;
        // transferring the platformFee amount  to the platformSettlementAddress
        if (
            listingDetails.paymentSettlement.platformSettlementAddress !=
            address(0) &&
            listingDetails.paymentSettlement.platformFeePercentage > 0
        ) {
            _handlePayment(
                msg.sender,
                payable(
                    listingDetails.paymentSettlement.platformSettlementAddress
                ),
                paymentToken,
                paymentAmount += ((remainingProfit *
                    listingDetails.paymentSettlement.platformFeePercentage) /
                    10000)
            );
        } else if (platformAddress != address(0) && platformFeePercentage > 0) {
            _handlePayment(
                msg.sender,
                platformAddress,
                paymentToken,
                paymentAmount += ((remainingProfit * platformFeePercentage) /
                    10000)
            );
        }
        // transferring the commissionfee amount  to the commissionAddress
        if (
            listingDetails.paymentSettlement.commissionAddress != address(0) &&
            listingDetails.paymentSettlement.commissionFeePercentage > 0
        ) {
            paymentAmount += ((remainingProfit *
                listingDetails.paymentSettlement.commissionFeePercentage) /
                10000);
            _handlePayment(
                msg.sender,
                payable(listingDetails.paymentSettlement.commissionAddress),
                paymentToken,
                ((remainingProfit *
                    listingDetails.paymentSettlement.commissionFeePercentage) /
                    10000)
            );
        }
        remainingProfit = remainingProfit - paymentAmount;
        // Royalty Fee Payout Settlement
        remainingProfit = _handleRoyaltyEnginePayout(
            buyer,
            tokenContract,
            tokenId,
            remainingProfit,
            paymentToken
        );

        // Transfer the balance to the tokenOwner
        _handlePayment(
            msg.sender,
            payable(listingDetails.paymentSettlement.paymentSettlementAddress),
            paymentToken,
            remainingProfit
        );

        emit AuctionEnded(
            auctionId,
            tokenId,
            listingDetails.tokenOwnerAddress,
            listingDetails,
            bidderdetails
        );
    }

    /// @notice Ending an Auction based on the signature verification with highest bidder
    /// @param list list struct consists of the listedtoken details
    /// @param bidHistory Bidhistory which contains the list of bidders with the details
    function executeAuction(
        createAuctionList calldata list,
        string memory auctionId,
        BidList[] memory bidHistory,
        uint256 tax
    ) external payable nonReentrant {

            require(!usedAuctionId[auctionId], "auctionId is already used");
    }



    /// @notice The details to be provided to buy the token
    /// @param _tokenOwner the owner of the nft token
    /// @param _tokenContract the address of the nft contract
    /// @param _buyer the address of the buyer
    /// @param _tokenId the token Id of the owner owns
    /// @param _quantity the quantity of tokens for 1155 only
    function _tokenTransaction(
        address _tokenOwner,
        address _tokenContract,
        address _buyer,
        uint256 _tokenId,
        uint256 _quantity
    ) private {
        if (IERC165(_tokenContract).supportsInterface(ERC721_INTERFACE_ID)) {
            require(
                IERC721(_tokenContract).ownerOf(_tokenId) == _tokenOwner,
                "maker is not the owner"
            );
            // Transferring the ERC721
            IERC721(_tokenContract).safeTransferFrom(
                _tokenOwner,
                _buyer,
                _tokenId
            );
        } else if (
            IERC165(_tokenContract).supportsInterface(ERC1155_INTERFACE_ID)
        ) {
            uint256 ownerBalance = IERC1155(_tokenContract).balanceOf(
                _tokenOwner,
                _tokenId
            );
            require(
                _quantity <= ownerBalance && _quantity > 0,
                "Insufficeint token balance"
            );

            // Transferring the ERC1155
            IERC1155(_tokenContract).safeTransferFrom(
                _tokenOwner,
                _buyer,
                _tokenId,
                _quantity,
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

    /// @notice Settle the Royalty Payment based on the given parameters
    /// @param _buyer the address of the buyer
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
        ) = royaltySupport.getRoyalty(_tokenContract, _tokenId);

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

    /// @notice Withdraw the funds to owner
    function withdraw() external adminRequired {
        bool success;
        address payable to = payable(msg.sender);
        (success, ) = to.call{value: address(this).balance}(new bytes(0));
        require(success, "withdraw failed");
    }

    /// @notice cancel the sale of a listed token
    /// @param auctionId to cansel the sale
    function cancelAuction(string memory auctionId) external adminRequired {
        require(usedAuctionId[auctionId], "unsupported sale");

        delete (listings[auctionId]);
        emit CancellAuction(auctionId);
    }

    /// @notice Update the platform Address
    /// @param _platformAddress The Platform Address
    function updatePlatformAddress(address _platformAddress)
        external
        adminRequired
    {
        require(_platformAddress != address(0), "Invalid Platform Address");
        platformAddress = payable(_platformAddress);
    }

    function updateMinimumPrice(
        string calldata auctionId,
        uint256 minimumBidFiatPrice
    ) external adminRequired {
        // checks for auctionId is created for auction
        require(usedAuctionId[auctionId], "unsupported sale");

        require(
            bidderDetails[auctionId].startTime >= block.timestamp ||
                bidderDetails[auctionId].amount[1] == 0,
            "the auction bid has already started"
        );

        listings[auctionId].minimumBidCryptoPrice = minimumBidFiatPrice;
    }

    function updateStartTime(string calldata auctionId, uint32 startTime)
        external
        adminRequired
    {
        // checks for auctionId is created for auction
        require(usedAuctionId[auctionId], "unsupported sale");

        require(
            bidderDetails[auctionId].startTime >= block.timestamp ||
                bidderDetails[auctionId].amount[1] == 0,
            "the auction bid has already started"
        );

        bidderDetails[auctionId].startTime = startTime;
    }

    function updateEndTime(string calldata auctionId, uint32 endTime)
        external
        adminRequired
    {
        // checks for auctionId is created for auction
        require(usedAuctionId[auctionId], "unsupported sale");

        require(
            bidderDetails[auctionId].startTime >= block.timestamp ||
                bidderDetails[auctionId].amount[1] == 0,
            "the auction bid has already started"
        );

        bidderDetails[auctionId].endTime = endTime;
    }

    function updatePaymentSettlementAddress(
        string calldata auctionId,
        address paymentSettlementAddress
    ) external adminRequired {
        // checks for auctionId is created for auction
        require(usedAuctionId[auctionId], "unsupported sale");

        require(
            bidderDetails[auctionId].startTime >= block.timestamp ||
                bidderDetails[auctionId].amount[1] == 0,
            "the auction bid has already started"
        );

        require(paymentSettlementAddress != address(0));

        listings[auctionId]
            .paymentSettlement
            .paymentSettlementAddress = paymentSettlementAddress;
    }

    function updateTaxSettlementAddress(
        string calldata auctionId,
        address taxSettlementAddress
    ) external adminRequired {
        // checks for auctionId is created for auction
        require(usedAuctionId[auctionId], "unsupported sale");

        require(
            bidderDetails[auctionId].startTime >= block.timestamp ||
                bidderDetails[auctionId].amount[1] == 0,
            "the auction bid has already started"
        );

        require(taxSettlementAddress != address(0));

        listings[auctionId]
            .paymentSettlement
            .taxSettlementAddress = taxSettlementAddress;
    }

    /// @notice Update the Platform Fee Percentage
    /// @param _platformFeePercentage The Platform fee percentage
    function updatePlatformFeePercentage(uint16 _platformFeePercentage)
        external
        adminRequired
    {
        require(
            _platformFeePercentage < 10000,
            "platformFee should not be more than 100 %"
        );
        platformFeePercentage = _platformFeePercentage;
    }

    receive() external payable {}

    fallback() external payable {}
}
