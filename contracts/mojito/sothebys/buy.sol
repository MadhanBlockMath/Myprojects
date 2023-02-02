// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

import {IERC721, IERC165} from "../../openzeppelin/token/ERC721/IERC721.sol";
import {IERC1155} from "../../openzeppelin/token/ERC1155/IERC1155.sol";
import {ReentrancyGuard} from "../../openzeppelin/security/ReentrancyGuard.sol";
import {IERC20} from "../../openzeppelin/token/ERC20/IERC20.sol";
import {SafeERC20} from "../../openzeppelin/token/ERC20/utils/SafeERC20.sol";
import {AdminControl} from "../../manifold/libraries-solidity/access/AdminControl.sol";
import {IERC721CreatorCore} from "../../manifold/creator-core/core/IERC721CreatorCore.sol";
import {IERC1155CreatorCore} from "../../manifold/creator-core/core/IERC1155CreatorCore.sol";

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

/**
 * @title An onchain payment for buy now flow where owners can list the tokens for sale 
 and the buyers can buy the token using the buy function
 */
contract OnchainBuy is ReentrancyGuard, AdminControl {
    using SafeERC20 for IERC20;

    /// @notice The metadata for a given Order
    /// @param nftContractAddress the nft contract address
    /// @param nftStartTokenId the Nft token Id listed From
    /// @param nftEndTokenId the NFT token Id listed To
    /// @param minimumFiatPrice the minimum price of the listed tokens
    /// @param minimumCryptoPrice the cryptoprice of provided crypto
    /// @param paymentCurrency the payment currency for seller requirement
    /// @param paymentSettlement the settlement address and payment percentage provided in basis points
    /// @param maxCap the total supply for minting
    /// @param TransactionStatus the status to be minted or transfered
    /// @param PaymentStatus the status to get the price from fiat conversion or crypto price provided
    struct PriceList {
        address nftContractAddress;
        uint64 nftStartTokenId;
        uint64 nftEndTokenId;
        uint256 minimumFiatPrice; // in USD
        uint256[] minimumCryptoPrice; // in Crypto
        address[] paymentCurrency; // in ETH/ERC20
        settlementList paymentSettlement;
        uint64 maxCap;
        TransactionStatus transactionStatus;
        PaymentStatus paymentStatus;
    }
    /// @notice The metadata for a given Order
    /// @param paymentSettlementAddress the settlement address for the listed tokens
    /// @param taxSettlementAddress the taxsettlement address for settlement of tax fee
    /// @param platformSettlementAddress the platform address for settlement of platform fee
    /// @param platformFeePercentage the platform fee given in basis points
    /// @param commissionAddress the commission address for settlement of commission fee
    /// @param commissionFeePercentage the commission fee given in basis points
    struct settlementList {
        address payable paymentSettlementAddress;
        address payable taxSettlementAddress;
        address payable platformSettlementAddress;
        uint16 platformFeePercentage; // in basis points
        address payable commissionAddress;
        uint16 commissionFeePercentage; // in basis points
    }

    /// @notice The details to be provided to buy the token
    /// @param saleId the Id of the created sale
    /// @param tokenOwner the owner of the nft token
    /// @param tokenId the token Id of the owner owns
    /// @param tokenQuantity the token Quantity only required if minting
    /// @param buyer the person who buys the nft
    /// @param quantity the quantity of tokens for 1155 only
    /// @param paymentToken the type of payment currency that the buyers pay out
    /// @param paymentAmount the amount to be paid in the payment currency
    struct BuyList {
        string saleId;
        address tokenOwner;
        uint256 tokenId;
        uint64 tokenQuantity;
        address buyer;
        uint64 quantity;
        address paymentToken;
        uint256 paymentAmount;
    }

    // TransactionStatus shows the preference for mint or transfer
    enum TransactionStatus {
        mint,
        transfer
    }
    // PaymentStatus shows the preference for fiat conversion or direct crypto
    enum PaymentStatus {
        fiat,
        crypto
    }
    // listing the sale details in sale Id
    mapping(string => PriceList) public listings;

    // tokens used to be compared with maxCap
    mapping(string => uint256) private tokensUsed;

    // validating saleId
    mapping(string => bool) usedSaleId;

    // Interface ID constants
    bytes4 private constant ERC721_INTERFACE_ID = 0x80ac58cd;
    bytes4 private constant ERC1155_INTERFACE_ID = 0xd9b67a26;

    // Platform Address
    address payable private platformAddress;

    // Fee percentage to the Platform
    uint16 private platformFeePercentage;

    // The address of the Price Feed Aggregator to use via this contract
    IPriceFeed private priceFeedAddress;

    // The address of the royaltySupport to use via this contract
    IRoyaltyEngine private royaltySupport;

    // maxQuantity for 1155 NFT-tokens
    uint64 private max1155Quantity;

    /// @notice Emitted when sale is created
    /// @param saleList contains the details of sale created
    event saleCreated(PriceList saleList);

    /// @notice Emitted when sale is closed
    /// @param saleId contains the details of cancelled sale
    event saleClosed(string saleId);

    /// @notice Emitted when an Buy Event is completed
    /// @param tokenContract The NFT Contract address
    /// @param buyingDetails consist of buyer details
    /// @param MintedtokenId consist of minted tokenId details
    /// @param paymentSettlement consist of settlement addresses and payment Percetage
    /// @param tax paid to the taxsettlement Address
    /// @param paymentAmount total amount paid by buyer
    /// @param excessAmount the excess amount payed by the buyer to buy the NFT
    event BuyExecuted(
        address indexed tokenContract,
        BuyList buyingDetails,
        uint256[] MintedtokenId,
        settlementList paymentSettlement,
        uint256 tax,
        uint256 paymentAmount,
        uint256 excessAmount
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

    /// @param _platformAddress The Platform Address
    /// @param _platformFeePercentage The Platform fee percentage
    /// @param _max1155Quantity The max quantity we support for 1155 Nfts
    /// @param _priceFeedAddress the address of the pricefeed
    /// @param _royaltycontract the address to get the royalty data
    constructor(
        address _platformAddress,
        uint16 _platformFeePercentage,
        uint64 _max1155Quantity,
        IPriceFeed _priceFeedAddress,
        IRoyaltyEngine _royaltycontract
    ) {
        require(_platformAddress != address(0), "Invalid Platform Address");
        require(
            _platformFeePercentage < 10000,
            "platformFee should be less than 10000"
        );
        platformAddress = payable(_platformAddress);
        platformFeePercentage = _platformFeePercentage;
        max1155Quantity = _max1155Quantity;
        priceFeedAddress = _priceFeedAddress;
        royaltySupport = _royaltycontract;
    }

    /**
     * @notice creating a batch sales using batch details .
     * @param list gives the listing details to create a sale
     * @param saleId consist of the id of the listed sale
     */
    function createSale(PriceList calldata list, string calldata saleId)
        external
        adminRequired
    {
        // checks for should not use the same saleId
        require(
            !usedSaleId[saleId],
            "the saleId you have entered is invalid. Please validate"
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
        // checks for valuable token start and end id for listing
        if (list.nftStartTokenId > 0 && list.nftEndTokenId > 0) {
            require(
                list.nftEndTokenId >= list.nftStartTokenId,
                "This is not a valid NFT start or end token ID. Please verify that the range provided is correct"
            );
        }
        // array for paymentCurrency and minimumPrice to be of same length
        require(
            list.paymentCurrency.length == list.minimumCryptoPrice.length,
            "should provide equal length in price and payment address"
        );

        // checks to provide maxcap while listing only for minting
        if (list.transactionStatus == TransactionStatus.mint) {
            require(list.maxCap != 0, "should provide maxCap for minting");

            require(
                list.nftStartTokenId == 0 && list.nftEndTokenId == 0,
                "The NFTstarttokenid and NFTendtokenid should be 0 for minting"
            );
        } else {
            require(
                list.maxCap == 0,
                "maxCap should be 0 for preminted tokens"
            );
        }
        // checks to provide only supported interface for nftContractAddress
        require(
            IERC165(list.nftContractAddress).supportsInterface(
                ERC721_INTERFACE_ID
            ) ||
                IERC165(list.nftContractAddress).supportsInterface(
                    ERC1155_INTERFACE_ID
                ),
            "should provide only supported contract interfaces ERC 721/1155"
        );
        // checks for paymentSettlementAddress should not be zero
        require(
            list.paymentSettlement.paymentSettlementAddress != address(0),
            "should provide valid wallet address for settlement"
        );
        // checks for taxSettlelentAddress should not be zero
        require(
            list.paymentSettlement.taxSettlementAddress != address(0),
            "should provide valid wallet address for tax settlement"
        );

        listings[saleId] = list;

        usedSaleId[saleId] = true;

        emit saleCreated(list);
    }

    /**
     * @notice End an sale, finalizing and paying out the respective parties.
     * @param list gives the listing details to buy the nfts
     * @param tax the amount of tax to be paid by the buyer
     */
    function buy(BuyList memory list, uint256 tax)
        external
        payable
        nonReentrant
        returns (uint256[] memory nftTokenId)
    {
        settlementList memory settlement = listings[list.saleId]
            .paymentSettlement;
        PriceList memory saleList = listings[list.saleId];
        // checks for saleId is created for sale
        require(usedSaleId[list.saleId], "unsupported sale");

        // should be called by the contract admins or by the buyer
        require(
            isAdmin(msg.sender) || list.buyer == msg.sender,
            "Only the buyer or admin or owner of this contract can call this function"
        );

        // handling the errors before buying the NFT
        (uint256 minimumPrice, address tokenContract) = errorHandling(
            list.saleId,
            list.tokenId,
            list.tokenQuantity,
            list.quantity,
            list.paymentToken,
            (list.paymentAmount + tax),
            list.buyer
        );

        // Transferring  the NFT tokens to the buyer
        nftTokenId = _tokenTransaction(
            list.saleId,
            list.tokenOwner,
            tokenContract,
            list.buyer,
            list.tokenId,
            list.tokenQuantity,
            list.quantity,
            saleList.transactionStatus
        );
        // transferring the tax amount given by buyer as tax to taxSettlementAddress

        if (tax > 0) {
            _handlePayment(
                msg.sender,
                settlement.taxSettlementAddress,
                list.paymentToken,
                tax
            );
        }

        paymentTransaction(
            list.saleId,
            list.paymentAmount - minimumPrice,
            minimumPrice,
            list.paymentToken,
            list.tokenId,
            nftTokenId,
            tokenContract,
            saleList.transactionStatus
        );
        emit BuyExecuted(
            tokenContract,
            list,
            nftTokenId,
            settlement,
            tax,
            minimumPrice,
            list.paymentAmount - minimumPrice
        );
        return nftTokenId;
    }

    /**
     * @notice payment settlement happens to all settlement address.
     * @param _saleId consist of the id of the listed sale
     * @param _excessAmount the excess amount paid by the buyer
     * @param _totalAmount the totalAmount to be paid by the seller
     * @param _paymentToken the selected currency the payment is made
     * @param _transferredTokenId the tokenId of the transferred token
     * @param _mintedTokenId the tokenId of the minted tokens
     * @param _tokenContract the nftcontract address of the supported sale
     * @param _status the transaction status for mint or transfer
     */
    function paymentTransaction(
        string memory _saleId,
        uint256 _excessAmount,
        uint256 _totalAmount,
        address _paymentToken,
        uint256 _transferredTokenId,
        uint256[] memory _mintedTokenId,
        address _tokenContract,
        TransactionStatus _status
    ) private {
        settlementList memory settlement = listings[_saleId].paymentSettlement;
        uint256 paymentAmount;
        // transferring the platformFee amount  to the platformSettlementAddress
        if (
            settlement.platformSettlementAddress != address(0) &&
            settlement.platformFeePercentage > 0
        ) {
            _handlePayment(
                msg.sender,
                settlement.platformSettlementAddress,
                _paymentToken,
                paymentAmount += ((_totalAmount *
                    settlement.platformFeePercentage) / 10000)
            );
        } else if (platformAddress != address(0) && platformFeePercentage > 0) {
            _handlePayment(
                msg.sender,
                platformAddress,
                _paymentToken,
                paymentAmount += ((_totalAmount * platformFeePercentage) /
                    10000)
            );
        }
        // transferring the commissionfee amount  to the commissionAddress
        if (
            settlement.commissionAddress != address(0) &&
            settlement.commissionFeePercentage > 0
        ) {
            paymentAmount += ((_totalAmount *
                settlement.commissionFeePercentage) / 10000);
            _handlePayment(
                msg.sender,
                settlement.commissionAddress,
                _paymentToken,
                ((_totalAmount * settlement.commissionFeePercentage) / 10000) +
                    _excessAmount
            );
        }
        _totalAmount = _totalAmount - paymentAmount;
        // Royalty Fee Payout Settlement
        _totalAmount = royaltyPayout(
            msg.sender,
            _transferredTokenId,
            _mintedTokenId,
            _tokenContract,
            _totalAmount,
            _paymentToken,
            _status
        );

        // Transfer the balance to the paymentSettlementAddress
        _handlePayment(
            msg.sender,
            settlement.paymentSettlementAddress,
            _paymentToken,
            _totalAmount
        );
    }

    /**
     * @notice handling the errors while buying the nfts.
     * @param _saleId the Id of the created sale
     * @param _tokenId the token Id of the owner owns
     * @param _tokenQuantity the token Quantity only required if minting
     * @param _quantity the quantity of tokens for 1155 only
     * @param _paymentToken the type of payment currency that the buyers pays
     * @param _paymentAmount the amount to be paid in the payment currency
     * @param _payee address of the buyer who buys the token
     */
    function errorHandling(
        string memory _saleId,
        uint256 _tokenId,
        uint256 _tokenQuantity,
        uint256 _quantity,
        address _paymentToken,
        uint256 _paymentAmount,
        address _payee
    ) private view returns (uint256 _minimumPrice, address _tokenContract) {
        PriceList memory saleList = listings[_saleId];
        // checks the nft to be buyed is supported in the saleId
        if (saleList.nftStartTokenId == 0 && saleList.nftEndTokenId > 0) {
            require(
                _tokenId <= saleList.nftEndTokenId,
                "This is not a valid tokenId. Please verify that the tokenId provided is correct"
            );
        } else if (
            saleList.nftStartTokenId > 0 && saleList.nftEndTokenId == 0
        ) {
            require(
                _tokenId >= saleList.nftStartTokenId,
                "This is not a valid tokenId. Please verify that the tokenId provided is correct"
            );
        } else if (saleList.nftStartTokenId > 0 && saleList.nftEndTokenId > 0) {
            require(
                _tokenId >= saleList.nftStartTokenId &&
                    _tokenId <= saleList.nftEndTokenId,
                "This is not a valid tokenId. Please verify that the tokenId provided is correct"
            );
        }
        // getting the payment currency and the price using saleId
        _tokenContract = saleList.nftContractAddress;

        // getting the price using saleId
        if (saleList.paymentStatus == PaymentStatus.fiat) {
            _minimumPrice = priceFeedAddress.getLatestPrice(
                saleList.minimumFiatPrice,
                _paymentToken
            );
        } else if (saleList.paymentStatus == PaymentStatus.crypto) {
            for (uint256 i; i < saleList.paymentCurrency.length; i++) {
                if (saleList.paymentCurrency[i] == _paymentToken) {
                    _minimumPrice = saleList.minimumCryptoPrice[i];
                    break;
                }
            }
        }
        // check for the minimumPrice we get should not be zero
        require(
            _minimumPrice != 0,
            "Please provide valid supported ERC20/ETH address"
        );

        if (saleList.transactionStatus == TransactionStatus.mint) {
            // checks for tokenQuantity for 1155 NFTs
            require(
                _quantity <= max1155Quantity,
                "The maximum quantity allowed to purchase at one time should not be more than defined in max1155Quantity"
            );
            if (
                IERC165(_tokenContract).supportsInterface(ERC721_INTERFACE_ID)
            ) {
                _minimumPrice = (_minimumPrice * _tokenQuantity);
            } else if (
                IERC165(_tokenContract).supportsInterface(ERC1155_INTERFACE_ID)
            ) {
                if (
                    IERC1155CreatorCore(_tokenContract).totalSupply(_tokenId) ==
                    0
                ) {
                    /* multiplying the total number of tokens and quantity with amount to get the 
                     total price for 1155 nfts ofr minting*/
                    _minimumPrice = (_minimumPrice *
                        _tokenQuantity *
                        _quantity);
                } else {
                    /* multiplying the total number of tokens with amount to get the 
                     total price for 721 nfts for minting*/
                    _minimumPrice = (_minimumPrice * _quantity);
                }
            }
        } else if (saleList.transactionStatus == TransactionStatus.transfer) {
            _minimumPrice = (_minimumPrice * _quantity);
        }
        if (_paymentToken == address(0)) {
            require(
                msg.value == _paymentAmount && _paymentAmount >= _minimumPrice,
                "Insufficient funds or invalid amount. You need to pass a valid amount to complete this transaction"
            );
        } else {
            // checks the buyer has sufficient amount to buy the nft
            require(
                IERC20(_paymentToken).balanceOf(_payee) >= _paymentAmount &&
                    _paymentAmount >= _minimumPrice,
                "Insufficient funds. You should have sufficient balance to complete this transaction"
            );
            // checks the buyer has provided approval for the contract to transfer the amount
            require(
                IERC20(_paymentToken).allowance(_payee, address(this)) >=
                    _paymentAmount,
                "Insufficient approval from an ERC20 Token. Please provide approval to this contract and try again"
            );
        }
    }

    /**
     * @notice handling royaltyPayout while buying the nfts.
     * @param _buyer the address of the buyer
     * @param _tokenId the token Id of the nft
     * @param _tokenIds the Ids of the nft which are minted
     * @param _tokenContract the address of the nft contract
     * @param _amount the amount to be paid in the payment currency
     * @param _paymentToken the type of payment currency that the buyers pays
     * @param _status the status of minting or transferring of nfts
     */
    function royaltyPayout(
        address _buyer,
        uint256 _tokenId,
        uint256[] memory _tokenIds,
        address _tokenContract,
        uint256 _amount,
        address _paymentToken,
        TransactionStatus _status
    ) private returns (uint256 remainingProfit) {
        if (_status == TransactionStatus.transfer) {
            //  royalty payout for already minted tokens
            remainingProfit = _handleRoyaltyEnginePayout(
                _buyer,
                _tokenContract,
                _tokenId,
                _amount,
                _paymentToken
            );
        } else if (_status == TransactionStatus.mint) {
            if (
                IERC165(_tokenContract).supportsInterface(
                    ERC1155_INTERFACE_ID
                ) &&
                IERC1155CreatorCore(_tokenContract).totalSupply(_tokenId) > 0
            ) {
                // royalty payout for newly minted existeng ERC1155 tokens
                remainingProfit = _handleRoyaltyEnginePayout(
                    _buyer,
                    _tokenContract,
                    _tokenId,
                    _amount,
                    _paymentToken
                );
            } else {
                _amount = (_amount / _tokenIds.length);
                uint256 remainingTokenBalance;
                // royalty payout for all the newly minted tokens for 721 and 1155
                for (uint256 i; i < _tokenIds.length; i++) {
                    remainingTokenBalance = _handleRoyaltyEnginePayout(
                        _buyer,
                        _tokenContract,
                        _tokenIds[i],
                        _amount,
                        _paymentToken
                    );
                    remainingProfit = remainingProfit + remainingTokenBalance;
                }
            }
            return remainingProfit;
        }
    }

    /// @notice The details to be provided to buy the token
    /// @param _saleId the Id of the created sale
    /// @param _tokenOwner the owner of the nft token
    /// @param _tokenContract the address of the nft contract
    /// @param _buyer the address of the buyer
    /// @param _tokenId the token Id to be buyed by the buyer
    /// @param _tokenQuantity the token Quantity only required if minting
    /// @param _quantity the quantity of tokens for 1155 only
    /// @param _status the status of minting or transferring of nfts
    function _tokenTransaction(
        string memory _saleId,
        address _tokenOwner,
        address _tokenContract,
        address _buyer,
        uint256 _tokenId,
        uint256 _tokenQuantity,
        uint256 _quantity,
        TransactionStatus _status
    ) private returns (uint256[] memory nftTokenId) {
        if (IERC165(_tokenContract).supportsInterface(ERC721_INTERFACE_ID)) {
            if (_status == TransactionStatus.transfer) {
                require(
                    IERC721(_tokenContract).ownerOf(_tokenId) == _tokenOwner,
                    "Invalid NFT Owner Address. Please check and try again"
                );
                // Transferring the ERC721
                IERC721(_tokenContract).safeTransferFrom(
                    _tokenOwner,
                    _buyer,
                    _tokenId
                );
            } else if (_status == TransactionStatus.mint) {
                require(
                    tokensUsed[_saleId] + _tokenQuantity <=
                        listings[_saleId].maxCap,
                    "The maximum quantity allowed to purchase ERC721 token has been sold out. Please contact the sale owner for more details"
                );
                // Minting the ERC721 in a batch
                nftTokenId = IERC721CreatorCore(_tokenContract)
                    .mintExtensionBatch(_buyer, uint16(_tokenQuantity));
                tokensUsed[_saleId] = tokensUsed[_saleId] + _tokenQuantity;
            }
        } else if (
            IERC165(_tokenContract).supportsInterface(ERC1155_INTERFACE_ID)
        ) {
            if (_status == TransactionStatus.transfer) {
                uint256 ownerBalance = IERC1155(_tokenContract).balanceOf(
                    _tokenOwner,
                    _tokenId
                );
                require(
                    _quantity <= ownerBalance && _quantity > 0,
                    "Insufficient token balance from the owner"
                );

                // Transferring the ERC1155
                IERC1155(_tokenContract).safeTransferFrom(
                    _tokenOwner,
                    _buyer,
                    _tokenId,
                    _quantity,
                    "0x"
                );
            } else if (_status == TransactionStatus.mint) {
                address[] memory to = new address[](1);
                uint256[] memory amounts = new uint256[](_tokenQuantity);
                string[] memory uris;
                to[0] = _buyer;
                amounts[0] = _quantity;

                if (
                    IERC1155CreatorCore(_tokenContract).totalSupply(_tokenId) ==
                    0
                ) {
                    require(
                        tokensUsed[_saleId] < listings[_saleId].maxCap,
                        "The maximum quantity allowed to purchase ERC1155 token has been sold out. Please contact the sale owner for more details"
                    );
                    for (uint256 i; i < _tokenQuantity; i++) {
                        amounts[i] = _quantity;
                    }
                    // Minting ERC1155  of already existing tokens
                    nftTokenId = IERC1155CreatorCore(_tokenContract)
                        .mintExtensionNew(to, amounts, uris);

                    tokensUsed[_saleId] = tokensUsed[_saleId] + _tokenQuantity;
                } else if (
                    IERC1155CreatorCore(_tokenContract).totalSupply(_tokenId) >
                    0
                ) {
                    uint256[] memory tokenId = new uint256[](1);
                    tokenId[0] = _tokenId;
                    // Minting new ERC1155 tokens
                    IERC1155CreatorCore(_tokenContract).mintExtensionExisting(
                        to,
                        tokenId,
                        amounts
                    );
                }
            }
        }
        return nftTokenId;
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
            require(success, "unable to debit native balance please try again");
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
            require(
                amountRemaining >= feeAmount,
                "insolvent: unable to complete royalty"
            );

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

    /// @notice get the listings currency and price
    /// @param saleId to get the details of sale
    function getListingPrice(string calldata saleId)
        external
        view
        returns (
            uint256[] memory minimumCryptoPrice,
            address[] memory paymentCurrency
        )
    {
        minimumCryptoPrice = listings[saleId].minimumCryptoPrice;
        paymentCurrency = listings[saleId].paymentCurrency;
    }

    function getContractData()
        external
        view
        returns (
            address _platformAddress,
            uint16 _platformFeePercentage,
            IPriceFeed _priceFeedAddress,
            IRoyaltyEngine _royaltySupport,
            uint64 _max1155Quantity
        )
    {
        _platformAddress = platformAddress;
        _platformFeePercentage = platformFeePercentage;
        _priceFeedAddress = priceFeedAddress;
        _royaltySupport = royaltySupport;
        _max1155Quantity = max1155Quantity;
    }

    /// @notice Withdraw the funds to owner
    function withdraw() external adminRequired {
        bool success;
        address payable to = payable(msg.sender);
        (success, ) = to.call{value: address(this).balance}(new bytes(0));
        require(success, "withdraw to withdraw funds. Please try again");
    }

    /// @notice cancel the sale of a listed token
    /// @param saleId to cancel the sale
    function cancelSale(string memory saleId) external adminRequired {
        require(
            usedSaleId[saleId],
            "the saleId you have entered is invalid. Please validate"
        );

        delete (listings[saleId]);
        emit saleClosed(saleId);
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

    /// @notice Update the Platform Fee Percentage
    /// @param _platformFeePercentage The Platform fee percentage
    function updatePlatformFeePercentage(uint16 _platformFeePercentage)
        external
        adminRequired
    {
        require(
            _platformFeePercentage < 10000,
            "platformFee should not be more than 10000"
        );
        platformFeePercentage = _platformFeePercentage;
    }

    /// @notice Update the royalty contract address
    /// @param royaltyContract The contract intracts to get the royalty fee
    function updateRoyaltyContract(address royaltyContract)
        external
        adminRequired
    {
        require(
            royaltyContract != address(0),
            "royalty contract should not be address zero"
        );
        royaltySupport = IRoyaltyEngine(royaltyContract);
    }

    /// @notice Update the pricefeed contract address
    /// @param pricefeed The contract intracts to get the chainlink feeded price
    function updatePricefeedContract(address pricefeed) external adminRequired {
        require(
            pricefeed != address(0),
            "pricefeed contract should not be address zero"
        );
        priceFeedAddress = IPriceFeed(pricefeed);
    }

    /// @notice Update the paymentSettlementAddress
    /// @param saleId supported saleId
    /// @param _paymentSettlementAddress The address of paymentSettlement
    function updatepaymentSettlementAddress(
        string calldata saleId,
        address payable _paymentSettlementAddress
    ) external adminRequired {
        // checks for saleId is created for sale
        require(usedSaleId[saleId], "unsupported sale");
        require(
            _paymentSettlementAddress != address(0),
            "should not be zero address or previous settlement adress"
        );
        listings[saleId]
            .paymentSettlement
            .paymentSettlementAddress = _paymentSettlementAddress;
    }

    /// @notice Update the taxSettlementAddress
    /// @param saleId supported saleId
    /// @param _taxSettlementAddress The address of taxSettlement
    function updatetaxSettlementAddress(
        string calldata saleId,
        address payable _taxSettlementAddress
    ) external adminRequired {
        // checks for saleId is created for sale
        require(usedSaleId[saleId], "unsupported sale");
        require(
            _taxSettlementAddress != address(0),
            "should not be zero address or previous settlement adress"
        );
        listings[saleId]
            .paymentSettlement
            .taxSettlementAddress = _taxSettlementAddress;
    }

    /// @notice Update the payment
    /// @param saleId The sale id of the supported sale
    /// @param paymentStatus the status of the payment
    /// @param minimumFiatPrice the amount in USD to be updated
    /// @param minimumCryptoPrice the prices of the crypto currencies
    /// @param paymentCurrency the supported currencies we support in ERC20/ETH
    function updatePayment(
        string calldata saleId,
        PaymentStatus paymentStatus,
        uint256 minimumFiatPrice,
        uint256[] calldata minimumCryptoPrice,
        address[] calldata paymentCurrency
    ) external adminRequired {
        // checks for saleId is created for sale
        require(usedSaleId[saleId], "unsupported sale");


        // array for paymentCurrency and minimumPrice to be of same length
        require(
            paymentCurrency.length == minimumCryptoPrice.length,
            "should provide equal length in price and payment address"
        );
        listings[saleId].paymentStatus = paymentStatus;
        listings[saleId].minimumCryptoPrice = minimumCryptoPrice;
        listings[saleId].paymentCurrency = paymentCurrency;
        listings[saleId].minimumFiatPrice = minimumFiatPrice;
    }

    /// @notice Update the max quantity for 1155 NFTs
    /// @param _max1155Quantity maxQuantity we support for 1155 NFTs
    function updatemax1155Quantity(uint64 _max1155Quantity)
        external
        adminRequired
    {
        require(_max1155Quantity != 0 && _max1155Quantity != max1155Quantity);
        max1155Quantity = _max1155Quantity;
    }

    /// @notice get royalty payout details
    /// @param collectionAddress the nft contract address
    /// @param tokenId the nft token Id
    function getRoyaltyInfo(address collectionAddress, uint256 tokenId)
        external
        view
        returns (address payable[] memory recipients, uint256[] memory bps)
    {
        (
            recipients,
            bps // Royalty amount denominated in basis points
        ) = royaltySupport.getRoyalty(collectionAddress, tokenId);
    }

    receive() external payable {}

    fallback() external payable {}
}
