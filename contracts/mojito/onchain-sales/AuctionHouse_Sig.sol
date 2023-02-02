// SPDX-License-Identifier: GPL-3.0

// pragma solidity ^0.8.0;
// pragma experimental ABIEncoderV2;
// import {SafeMath} from "../../openzeppelin/utils/math/SafeMath.sol";
// import {IERC721, IERC165} from "../../openzeppelin/token/ERC721/IERC721.sol";
// import {ERC1155TokenReceiver} from "../../gnosis/interfaces/ERC1155TokenReceiver.sol";
// import {IERC1155} from "../../openzeppelin/token/ERC1155/IERC1155.sol";
// import {ReentrancyGuard} from "../../openzeppelin/security/ReentrancyGuard.sol";
// import {IERC20} from "../../openzeppelin/token/ERC20/IERC20.sol";
// import {SafeERC20} from "../../openzeppelin/token/ERC20/utils/SafeERC20.sol";
// import {Counters} from "../../openzeppelin/utils/Counters.sol";
// import {IAuctionHouse} from "./../interfaces/IAuctionHouse.sol";
// import {ECDSA} from "../../openzeppelin/utils/cryptography/ECDSA.sol";


// interface IWETH {
//     function deposit() external payable;

//     function withdraw(uint256 wad) external;

//     function transfer(address to, uint256 value) external returns (bool);
// }

// /**
//  * @title An open auction house, enabling collectors and curators to run their own auctions
//  */
// contract AuctionHouse is ReentrancyGuard, ERC1155TokenReceiver {
//     using SafeMath for uint256;
//     using SafeERC20 for IERC20;
//     using ECDSA for bytes32;    
 

//     // The minimum amount of time left in an auction after a new bid is created
//     uint256 public timeBuffer;

//     // The minimum percentage difference between the last bid amount and the current bid.
//     uint8 public minBidIncrementPercentage;

//     // The address of the NFT protocol to use via this contract
//     address public nftAddress;

//     // / The address of the WETH contract, so that any ETH transferred can be handled as an ERC-20
//     address public wethAddress;

//     // UUID validation on orders
//     mapping(string => bool) public usedUUID;

//     enum SaleKind {
//         Auction,
//         DirectSale
//     }

//     struct Order {
//         // it refers to the type of sale
//         SaleKind saleKind;
//         //  unique id for verification
//         string uuid;
//         // ID for the ERC721 token
//         uint256 tokenId;
//         // Address for the ERC721 or ERC1155 contract
//         address tokenContract;
//         // // Quantity of token if tokenContract support 1155
//         uint256 quantity;
//         // The current highest bid amount
//         uint256 amount;
//         // Maximum selling price for the token
//         uint256 maxPrice;
//         // The time when the auction was created
//         uint256 startTime;
//         // The length of time to run the auction for, after the first bid was made
//         uint256 duration;
//         // The time of the first bid
//         uint256 firstBidTime;
//         // The minimum price of the first bid
//         uint256 reservePrice;
//         // The address that should receive the funds once the NFT is sold.
//         address tokenOwner;
//         //The seller can specify a whitelisted address for a sale
//         address whitelistedBuyer;
//         // The address of the current highest bid
//         address payable buyer;
//         // The address of the ERC-20 currency to run the auction with.
//         // If set to 0x0, the auction will be run in ETH
//         address auctionCurrency;
//     }


//     mapping (uint256 => Order) public orders;

//     bytes4 constant erc721_interfaceId = 0x80ac58cd; // 721 interface id
//     bytes4 constant erc1155_interfaceId = 0xd9b67a26; // 1155 interface id



//     /**
//      * @notice Require that the specified auction exists
//      */
//     // modifier auctionExists(uint256 auctionId) {
//     //     require(_exists(auctionId), "Auction doesn't exist");
//     //     _;
//     // }

//     function onERC1155Received(
//         address,
//         address,
//         uint256,
//         uint256,
//         bytes memory
//     ) public virtual override returns (bytes4) {
//         return this.onERC1155Received.selector;
//     }

//     function onERC1155BatchReceived(
//         address,
//         address,
//         uint256[] memory,
//         uint256[] memory,
//         bytes memory
//     ) public virtual override returns (bytes4) {
//         return this.onERC1155BatchReceived.selector;
//     }

//     struct Platform{
//         address payable marketPlaceAddress; // marketPlaceAddress
//         uint8 feePercentage; //  feePercentage
//     }
    
//     Platform private platform; 

//     /*
//      * Constructor
//      */
//     constructor(address _nftAddress, address _weth, Platform memory _platform) {
//         require(
//             (IERC165(_nftAddress).supportsInterface(erc721_interfaceId) ||
//                 IERC165(_nftAddress).supportsInterface(erc1155_interfaceId)),
//             "Doesn't support NFT interface"
//         );
//         require(
//             _platform.feePercentage < 100,
//             "curatorFeePercentage must be less than 100"
//         );
//         nftAddress = _nftAddress;
//         wethAddress = _weth;
//         timeBuffer = 15 * 60; // extend 15 minutes after every bid made in last 15 minutes
//         minBidIncrementPercentage = 5; // 5%
//         platform = _platform;
//     }
    



//     function execute( Order memory order, bytes memory signature) public nonReentrant {
        
//         require(
//             (IERC165(order.tokenContract).supportsInterface(erc721_interfaceId) ||
//                 IERC165(order.tokenContract).supportsInterface(erc1155_interfaceId)),
//             "tokenContract does not support ERC721 or ERC1155 interface"
//         );
//         if (order.saleKind == SaleKind.DirectSale) { 

//             require(
//                 order.whitelistedBuyer == address(0) ||
//                     order.whitelistedBuyer == msg.sender,
//                 "msg.sender should be the whitelisted buyer"
//             );

//         }

//         require (_verifySignature(order, signature, order.tokenOwner), 
//             "incorrect sale details"
//         );

//         // Validating UUID
//         require(!usedUUID[order.uuid], "UUID already used");

//         // Updaiting the Used UUID
//         usedUUID[order.uuid] = true;

//         transaction(order);
  

       

//     }

//     function transaction(
//         Order memory order
//     ) internal {
//         uint256 curatorFee ;
//         uint256 tokenOwnerProfit ;

//         if (order.saleKind == SaleKind.DirectSale){
//             tokenOwnerProfit= order.maxPrice;
//         }else{
//             tokenOwnerProfit = order.amount;
//         }


//         if (
//             IERC165(order.tokenContract).supportsInterface(
//                 erc721_interfaceId
//             )
//         ) {

//         require(
//             IERC721(order.tokenContract).ownerOf(order.tokenId) == order.tokenOwner,
//             "maker is not the owner"
//             );
//                 IERC721(order.tokenContract).safeTransferFrom(
//                     order.tokenOwner,
//                     msg.sender,
//                     order.tokenId
//                 );
//         } else {
//             bytes memory data = "0x";

//         //     try
//             uint256 ownerBalance = IERC1155(order.tokenContract).balanceOf(
//                 order.tokenOwner,
//                 order.tokenId
//             );
//             require(
//                 order.quantity<= ownerBalance && order.quantity != 0,
//                 "quantity should be more than zero && should be less than or equal to ownerBalance"
//             );
//                 IERC1155(order.tokenContract).safeTransferFrom(
//                     order.tokenOwner,
//                     msg.sender,
//                     order.tokenId,
//                     order.quantity,
//                     data
//                 );

//         }
//         require(
//             msg.value == tokenOwnerProfit,
//             "Sent ETH Value does not match specified buy amount"
//         );

//         if (platform.marketPlaceAddress != address(0)) {
//             curatorFee = tokenOwnerProfit
//                 .mul(platform.feePercentage)
//                 .div(100);
//             tokenOwnerProfit = tokenOwnerProfit.sub(curatorFee);

//             if (order.auctionCurrency == address(0)) {



//             (bool success, ) = platform.marketPlaceAddress.call{value: curatorFee}(new bytes(0));
//             (success, ) = order.tokenOwner.call{value: tokenOwnerProfit}(new bytes(0));

//                 if(!success) {
//                     // IWETH(wethAddress).deposit{value: order.maxPrice}();

//                     IERC20(wethAddress).safeTransferFrom(order.buyer,platform.marketPlaceAddress, curatorFee);
//                     IERC20(wethAddress).safeTransferFrom(order.buyer,order.tokenOwner, tokenOwnerProfit);
//                 }


//             } else {
//                 // We must check the balance that was actually transferred to the sales,
//                 // as some tokens impose a transfer fee and would not actually transfer the
//                 // full amount to the market, resulting in potentally locked funds
//                 IERC20 token = IERC20(order.auctionCurrency);
//                 token.safeTransferFrom(msg.sender, platform.marketPlaceAddress, curatorFee);
//                 token.safeTransferFrom(msg.sender, order.tokenOwner, tokenOwnerProfit);

//             }
//         } else {
//             if (order.auctionCurrency == address(0)) {

//             require(
//                 msg.value == tokenOwnerProfit,
//                 "Sent ETH Value does not match specified buy amount"
//             );

//             IERC20(wethAddress).safeTransferFrom(order.buyer,order.tokenOwner, tokenOwnerProfit);
//             } else {

//                 IERC20 token = IERC20(order.auctionCurrency); 
//                 token.safeTransferFrom(msg.sender, order.tokenOwner, tokenOwnerProfit);
//             }
           
//         }

//     }

//     function _verifySignature(
//         Order memory _order,
//         bytes memory _signature,
//         address _signer
//     ) internal view returns (bool) {
//         return keccak256(
//             abi.encodePacked(
//                 _order.uuid,
//                 _order.tokenId,
//                 _order.tokenContract,
//                 _order.quantity,
//                 _order.tokenOwner,
//                 _order.maxPrice,
//                 _order.reservePrice,
//                 _order.amount,
//                 _order.auctionCurrency,
//                 msg.sender
//             )
//         ).toEthSignedMessageHash().recover(_signature) == _signer;
//     }

// }    











