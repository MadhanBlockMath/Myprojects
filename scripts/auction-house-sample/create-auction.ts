import { ethers } from "hardhat";
import { utils } from "ethers";

async function main() {
    const accounts = await ethers.getSigners();
    const user = accounts[0];
    const bidder = accounts[1];

    //Mumbai Polygon Address
    const NFT_ADDRESS = "0xFADb48bAC50A1c3Be24787b163810151c88Bd132";
    const nftMedia = await ethers.getContractAt("ERC721CreatorImplementation", NFT_ADDRESS);

    const AUCTION_HOUSE_ADDRESS = "0xf801ed082D74B2c3dC22b4e29E6DeD47efeeF9bF";
    const auctionHouse = await ethers.getContractAt("AuctionHouse", AUCTION_HOUSE_ADDRESS);

    const WETH_ADDRESS = "0xA6FA4fB5f76172d178d61B04b0ecd319C5d1C0aa";
    // const CURATOR_ADDRESS = "0xCdC9188485316BF6FA416d02B4F680227c50b89e";

    //Approving Auction House for the Bid
    const approveForAllTx = await nftMedia.connect(user).setApprovalForAll(auctionHouse.address, true);
    console.log(`Approve transaction submitted to: ${approveForAllTx.hash}`);
    await approveForAllTx.wait(1);

    // Creating Auction
    const TOKEN_ID = 3;
    const DURATION = 15 * 60; // 15 minutes
    const RESERVE_PRICE = utils.parseEther('0.0001');
    const auctionTx = await auctionHouse.connect(user).createAuction(
        TOKEN_ID,
        nftMedia.address,
        DURATION,
        RESERVE_PRICE,
        ethers.constants.AddressZero, //curator address
        2,
        WETH_ADDRESS //currency address
    );
    console.log(`Auction Creation submitted at: ${auctionTx.hash}`)
    await auctionTx.wait();

    // Approving Curator for Auction
    // await auctionHouse.connect(curator).setAuctionApproval(0, true);

    // Approving the WETH to auction house
    const weth = await ethers.getContractAt("WETH", WETH_ADDRESS);
    const approveTx = await weth.connect(bidder).approve(auctionHouse.address, RESERVE_PRICE);
    console.log(`Approve transaction submitted to: ${approveTx.hash}`);
    await approveTx.wait();

    // Creating Bid
    const bidTx = await auctionHouse.connect(bidder).createBid(0, RESERVE_PRICE);
    console.log(`CreateBid transaction submitted to: ${bidTx.hash}`);
    await bidTx.wait();
    const data = await auctionHouse.auctions(0);
    console.log(data);
    // End Auction
    // const endAuctionTx = await auctionHouse.endAuction(0);
    // console.log(`CreateBid transaction submitted to: ${endAuctionTx.hash}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error.error);
    process.exit(1);
  });