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
import {IBuyNow} from "./../interfaces/IBuyNow.sol";
import {ICreatorCore} from "../../manifold/creator-core/core/ICreatorCore.sol";

interface IWETH {
    function deposit() external payable;

    function withdraw(uint256 wad) external;

    function transfer(address to, uint256 value) external returns (bool);
}

contract BuyNow is IBuyNow, ReentrancyGuard, ERC1155TokenReceiver {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;
    using Counters for Counters.Counter;

    // The address of the NFT protocol to use via this contract
    address public nftAddress;

    // The address of the WETH contract, so that any ETH transferred can be handled as an ERC-20
    address public wethAddress;

    // The address of the sale's curator.
    // The curator can reject or approve an sale
    // address payable public curator;

    // // The sale percentage to send to the curator
    // uint8 public curatorFeePercentage;

    // A mapping of all of the sales currently running.
    mapping(uint256 => IBuyNow.Sale) public sales;

    bytes4 constant erc721_interfaceId = 0x80ac58cd; // 721 interface id
    bytes4 constant erc1155_interfaceId = 0xd9b67a26; // 1155 interface id

    Counters.Counter private _saleIdTracker;
    /**
     * @notice Require that the specified sale exists
     */
    modifier saleExists(uint256 saleId) {
        require(_exists(saleId), "Sale doesn't exist");
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
    
    struct Platform{
        address payable marketPlaceAddress; // marketPlaceAddress
        uint8 feePercentage; //  feePercentage
    }
    
    Platform private platform; 
    /*
     * Constructor
     */
    constructor(
        address _nftAddress,
        address _weth,
        Platform memory _platform
        )  {
        require(
            (IERC165(_nftAddress).supportsInterface(erc721_interfaceId) ||
                IERC165(_nftAddress).supportsInterface(erc1155_interfaceId)),
            "Doesn't support NFT interface"
        );
        require(
            _platform.feePercentage < 100,
            "curatorFeePercentage must be less than 100"
        );
        nftAddress = _nftAddress;
        wethAddress = _weth;
        platform = _platform;
    }

    /**
     * @notice Create an sale.
     * @dev Store the sale details in the sales mapping and emit an SaleCreated event.
     * If there is no curator, or if the curator is the sale creator, automatically approve the sale.
     */
    function createSale(
        uint256 tokenId,
        address tokenContract,
        uint256 fixedPrice,
        uint256 quantity,
        address saleCurrency,
        address whitelistedBuyer
    ) public override nonReentrant returns (uint256) {
        require(
            (IERC165(tokenContract).supportsInterface(erc721_interfaceId) ||
                IERC165(tokenContract).supportsInterface(erc1155_interfaceId)),
            "tokenContract does not support ERC721 or ERC1155 interface"
        );


        uint256 saleId = _saleIdTracker.current();
        address tokenOwner;
        if (IERC165(tokenContract).supportsInterface(erc721_interfaceId)) {
            tokenOwner = IERC721(tokenContract).ownerOf(tokenId);
            require(
                msg.sender == IERC721(tokenContract).getApproved(tokenId) ||
                    msg.sender == tokenOwner,
                "Caller must be approved or owner for token id"
            );
            require(
                quantity == 1,
                "quantity should be equal to one for NFT-ERC721"
                );
            require(	
                IERC721(tokenContract).isApprovedForAll(
                    tokenOwner,
                    address(this)
                ),
                "Contract Address should be approved"
            );
        } else {

            uint256 ownerBalance = IERC1155(tokenContract).balanceOf(
                msg.sender,
                tokenId
            );
            require(
                quantity <= ownerBalance && quantity != 0,
                "quantity should be more than zero && should be less than or equal to ownerBalance"
            );
            tokenOwner = msg.sender;
	        require(
                IERC1155(tokenContract).isApprovedForAll(
                    tokenOwner,
                    address(this)
                ),
                "Contract Address should be approved"
            );

	}	    
	    
            sales[saleId] = Sale({
                tokenId: tokenId,
                tokenContract: tokenContract,
                approved: false,
                fixedPrice: fixedPrice,
                quantity: quantity,
                tokenOwner: tokenOwner,
                buyer: payable(address(0)),
                saleCurrency: saleCurrency,
                whitelistedBuyer: whitelistedBuyer
            });
	    
        _saleIdTracker.increment();

        emit SaleCreated(
            saleId,
            tokenId,
            tokenContract,
            fixedPrice,
            msg.sender,
            platform.marketPlaceAddress,
            platform.feePercentage,
            saleCurrency,
            quantity,
            whitelistedBuyer
        );

        if (platform.marketPlaceAddress == address(0) || platform.marketPlaceAddress == msg.sender) {
            _approveSale(saleId, true);
        }

        return saleId;
    }

    /**
     * @notice Approve an sale, opening up the sale for buyers.
     * @dev Only callable by the curator. Cannot be called if the sale has already started.
     */
    function setSaleApproval(uint256 saleId, bool approved)
        external
        override
        saleExists(saleId)
    {
        require(msg.sender == platform.marketPlaceAddress, "Must be sale curator");
        _approveSale(saleId, approved);
    }

    /**
     * @notice Change Fixed Price for the sale
     * @dev Only callable by the curator or owner. Cannot be called if the sale doesn't exist.
     */
    function setSaleFixedPrice(uint256 saleId, uint256 fixedPrice)
        external
        override
        saleExists(saleId)
    {
        require(
            msg.sender == platform.marketPlaceAddress ||
                msg.sender == sales[saleId].tokenOwner,
            "Must be sale curator or token owner"
        );
        sales[saleId].fixedPrice = fixedPrice;
        emit SaleFixedPriceUpdated(
            saleId,
            sales[saleId].tokenId,
            sales[saleId].tokenContract,
            fixedPrice
        );
    }

    /**
     * @notice End an sale, finalizing and paying out the respective parties.
     * @dev  transfers the provided amount to this contract.
     * If the sale is run in native ETH, the ETH is wrapped so it can be identically to other
     * sale currencies in this contract.
     */
    function buy(uint256 saleId, uint256 fixedPrice)
        external
        payable
        override
        saleExists(saleId)
        nonReentrant
    {
        require(
            sales[saleId].approved,
            "Sale must be approved by curator"
         );

        require(
            fixedPrice == sales[saleId].fixedPrice,
            "Must be equal to fixedPrice"
        );

        _handleIncomingBuy(
            fixedPrice,
            sales[saleId].saleCurrency
        );
        uint256 quantity = sales[saleId].quantity;
        address saleCurrency = sales[saleId].saleCurrency == address(0)
            ? wethAddress
            : sales[saleId].saleCurrency;
        uint256 curatorFee = 0;
        
        if(sales[saleId].whitelistedBuyer != address(0)) {
            require(sales[saleId].whitelistedBuyer == msg.sender,
            "msg.sender shoul be equal to be the whitelisted_buyer"
            );
        }
        sales[saleId].buyer = payable(msg.sender);
        uint256 tokenOwnerProfit;

        if (
            IERC165(sales[saleId].tokenContract).supportsInterface(
                erc721_interfaceId
            )
        ) {
            try
                IERC721(sales[saleId].tokenContract).safeTransferFrom(
                    sales[saleId].tokenOwner,
                    sales[saleId].buyer,
                    sales[saleId].tokenId
                )
            {} catch {
                _handleOutgoingBuy(
                    sales[saleId].buyer,
                    sales[saleId].fixedPrice,
                    sales[saleId].saleCurrency
                );
                _cancelSale(saleId);
                return;
            }
        } else {
            bytes memory data = "0x";

            try
                IERC1155(sales[saleId].tokenContract).safeTransferFrom(
                    sales[saleId].tokenOwner,
                    sales[saleId].buyer,
                    sales[saleId].tokenId,
                    quantity,
                    data
                )
            {} catch {
                _handleOutgoingBuy(
                    sales[saleId].buyer,
                    fixedPrice,
                    sales[saleId].saleCurrency
                );
                _cancelSale(saleId);
                return;
            }
        }
        tokenOwnerProfit = _handleRoyaltyEnginePayout(
            sales[saleId].tokenContract,
            sales[saleId].tokenId,
            sales[saleId].fixedPrice,
            sales[saleId].saleCurrency
	    );
	    
        if (platform.marketPlaceAddress != address(0)) {
            curatorFee = tokenOwnerProfit
                .mul(platform.feePercentage)
                .div(100);
            tokenOwnerProfit = tokenOwnerProfit.sub(curatorFee);
            _handleOutgoingBuy(
                platform.marketPlaceAddress,
                curatorFee,
                sales[saleId].saleCurrency
            );
        }
        _handleOutgoingBuy(
            sales[saleId].tokenOwner,
            tokenOwnerProfit,
            sales[saleId].saleCurrency
        );

        emit SaleEnded(
            saleId,
            sales[saleId].tokenId,
            sales[saleId].tokenContract,
            sales[saleId].tokenOwner,
            platform.marketPlaceAddress,
            msg.sender,
            tokenOwnerProfit,
            curatorFee,
            saleCurrency,
            quantity
        );
        delete sales[saleId];
    }

    /**
     * @notice Cancel an sales.
     * @dev Transfers the NFT back to the sales creator and emits an SaleCanceled event
     */
    function cancelSale(uint256 saleId)
        external
        override
        nonReentrant
        saleExists(saleId)
    {
        require(
            sales[saleId].tokenOwner == msg.sender ||
            platform.marketPlaceAddress == msg.sender,
            "Can only be called by sales creator or curator"
        );
        _cancelSale(saleId);
    }

    /**
     * @dev Given an fixedPrice and a currency, transfer the currency to this contract.
     * If the currency is ETH (0x0), attempt to wrap the fixedPrice as WETH
     */
    function _handleIncomingBuy(uint256 fixedPrice, address saleCurrency)
        internal
    {
        // If this is an ETH trasfer, ensure they sent enough and convert it to WETH under the hood

        if (saleCurrency == address(0)) {
            require(
                msg.value == fixedPrice,
                "Sent ETH Value does not match specified buy amount"
            );
            IWETH(wethAddress).deposit{value: fixedPrice}();
        } else {
            // We must check the balance that was actually transferred to the sales,
            // as some tokens impose a transfer fee and would not actually transfer the
            // full amount to the market, resulting in potentally locked funds
            IERC20 token = IERC20(saleCurrency);
            uint256 beforeBalance = token.balanceOf(address(this));
            token.safeTransferFrom(msg.sender, address(this), fixedPrice);
            uint256 afterBalance = token.balanceOf(address(this));
            require(
                beforeBalance.add(fixedPrice) == afterBalance,
                "Token transfer call did not transfer expected amount"
            );
        }
    }

    function _handleOutgoingBuy(
        address to,
        uint256 fixedPrice,
        address saleCurrency
    ) internal {
        // If the sales is in ETH, unwrap it from its underlying WETH and try to send it to the recipient.
        if (saleCurrency == address(0)) {
            IWETH(wethAddress).withdraw(fixedPrice);

            // If the ETH transfer fails (sigh), rewrap the ETH and try send it as WETH.
            if (!_safeTransferETH(to, fixedPrice)) {
                IWETH(wethAddress).deposit{value: fixedPrice}();
                IERC20(wethAddress).safeTransfer(to, fixedPrice);
            }
        } else {
            IERC20(saleCurrency).safeTransfer(to, fixedPrice);
        }
    }

    function _safeTransferETH(address to, uint256 value)
        internal
        returns (bool)
    {
        (bool success, ) = to.call{value: value}(new bytes(0));
        return success;
    }

    function _cancelSale(uint256 saleId) internal {
        address tokenOwner = sales[saleId].tokenOwner;
        uint quantity = sales[saleId].quantity;
        if (
            IERC165(sales[saleId].tokenContract).supportsInterface(
                erc1155_interfaceId
            )
        ) {
            IERC1155(sales[saleId].tokenContract).setApprovalForAll(
                address(this),
                false
            );
            require(
                IERC1155(sales[saleId].tokenContract).isApprovedForAll(
                    sales[saleId].tokenOwner,
                    address(this)
                ) == false,
                "Contract Address approval should be removed"
            );
        }

        emit SaleCanceled(
            saleId,
            sales[saleId].tokenId,
            sales[saleId].tokenContract,
            tokenOwner,
            quantity
        );
        delete sales[saleId];
    }

    function _approveSale(uint256 saleId, bool approved) internal {
        sales[saleId].approved = approved;
        emit SaleApprovalUpdated(
            saleId,
            sales[saleId].tokenId,
            sales[saleId].tokenContract,
            approved
        );
    }

    function _exists(uint256 saleId) internal view returns (bool) {
        return sales[saleId].tokenOwner != address(0);
    }

    function _handleRoyaltyEnginePayout(
        address _tokenContract,
        uint256 _tokenId,
        uint256 _amount,
        address _payoutCurrency
    ) internal returns (uint256) {
        // Get the royalty recipients and their associated amounts
        (
            address payable[] memory recipients,
            uint256[] memory amounts
        ) = ICreatorCore(_tokenContract).getRoyalties(_tokenId);

        // Store the number of recipients
        uint256 numRecipients = recipients.length;
        require(numRecipients != 0, "Royalty Recipients Zer");
        // If there are no royalties, return the initial amount
        if (numRecipients == 0) return _amount;

        // Store the initial amount
        uint256 amountRemaining = _amount;

        // Store the variables that cache each recipient and amount
        address recipient;
        uint256 amount;

        // Payout each royalty
        for (uint256 i = 0; i < numRecipients; ) {
            // Cache the recipient and amount
            recipient = recipients[i];
            amount = amounts[i];

            // Ensure that we aren't somehow paying out more than we have
            require(amountRemaining >= (amount*_amount)/10000, "insolvent");

            // Transfer to the recipient
            _handleOutgoingBuy(recipient, amount, _payoutCurrency);

            emit RoyaltyPayout(_tokenContract, _tokenId, recipient, amount);

            // Cannot underflow as remaining amount is ensured to be greater than or equal to royalty amount
            unchecked {
                amountRemaining -= amount;
                ++i;
            }
        }

        return amountRemaining;
    }


    // TODO: consider reverting if the message sender is not WETH
    receive() external payable {}

    fallback() external payable {}
}