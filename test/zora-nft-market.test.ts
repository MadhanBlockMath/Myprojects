import chai from "chai";
import chaiAsPromised from "chai-as-promised";
chai.use(chaiAsPromised);
const expect = chai.expect;

import { ethers } from "hardhat";
import { Signer, Contract } from "ethers";
import { Decimal } from '@zoralabs/zdk';

// hardhat ethers uses this but doesn't seem to export it
interface SignerWithAddress extends Signer {
  address: string;
}

const BASE_URI = "https://arweave.net/oUbZMh4SJ-98Xot0kEhsKmyyf-wMOEbDNFgUpc_dJfI/";
const BASE_URI_SUFFIX = ".json";
const CONTRACT_METADATA_URI = "http://ipfs.io/ipfs/QmT5vJ53pbrZ3NhUk7o1fYLUfB6Qfui4nDhD1FBZFsy4sH";
const PROXY_REGISTRY_ADDRESS = "0x0000000000000000000000000000000000000000";

const BID_SHARES = {
  prevOwner: Decimal.new(10),
  owner: Decimal.new(80),
  creator: Decimal.new(10),
};

describe("Zora NFT Market", () => {
  let nftMedia: Contract;
  let seller: SignerWithAddress;
  let bidder: SignerWithAddress;
  let other: SignerWithAddress;
  let nftMarket: Contract;
  let currencyContract: Contract;

  async function setBid(_bidder: SignerWithAddress, tokenId: number, amount: number): Promise<void> {
    await nftMedia.connect(_bidder).setBid(tokenId, {
      amount,
      currency: currencyContract.address,
      bidder: _bidder.address,
      recipient: _bidder.address,
      sellOnShare: Decimal.new(10),
    });
  }

  async function bidAmountForTokenBidder(tokenId: number, _bidder: SignerWithAddress): Promise<number> {
    return (await nftMarket.bidForTokenBidder(tokenId, _bidder.address)).amount.toNumber();
  }

  async function getBalance(wallet: SignerWithAddress): Promise<number> {
    return (await currencyContract.balanceOf(wallet.address)).toNumber();
  }

  beforeEach(async () => {
    [seller, bidder, other] = await ethers.getSigners();

    const NFTMarket = await ethers.getContractFactory("ZoraNFTMarket");
    nftMarket = await NFTMarket.deploy();
    await nftMarket.deployed();

    const NFTMedia = await ethers.getContractFactory("StandardizedZoraNFT");
    nftMedia = await NFTMedia.deploy("Sero NFT", "SFT", BASE_URI, BASE_URI_SUFFIX, CONTRACT_METADATA_URI, nftMarket.address, PROXY_REGISTRY_ADDRESS);
    await nftMarket.configure(nftMedia.address);

    const CurrencyContract = await ethers.getContractFactory("TestERC20");
    currencyContract = await CurrencyContract.deploy("test", "TEST", 18);
    await currencyContract.mint(bidder.address, 10000);
    await currencyContract!.connect(bidder).approve(nftMarket.address, 10000)
    await currencyContract.mint(other.address, 10000);
    await currencyContract!.connect(other).approve(nftMarket.address, 10000)
  });

  it("should complete sale immediately if ask price is set", async () => {
    await nftMedia.mintTo(seller.address, BID_SHARES);
    expect(await nftMedia.ownerOf(0)).to.equal(seller.address);

    await nftMedia.setAsk(0, {
      currency: currencyContract.address,
      amount: 100,
      sellOnShare: Decimal.new(0),
    });
    await setBid(bidder, 0, 100);

    expect(await nftMedia.ownerOf(0)).to.equal(bidder.address);
    expect(await getBalance(seller)).to.equal(100);
    expect(await getBalance(bidder)).to.equal(10000-100);
    expect(await bidAmountForTokenBidder(0, bidder)).to.equal(0);
  });

  it("should complete sale and remove bid when seller accepts an existing bid", async () => {
    await nftMedia.mintTo(seller.address, BID_SHARES);
    expect(await nftMedia.ownerOf(0)).to.equal(seller.address);

    await setBid(bidder, 0, 100);
    expect(await bidAmountForTokenBidder(0, bidder)).to.equal(100);

    await nftMedia.acceptBid(0, {
      amount: 100,
      currency: currencyContract.address,
      bidder: bidder.address,
      recipient: bidder.address,
      sellOnShare: Decimal.new(10),
    });

    expect(await nftMedia.ownerOf(0)).to.equal(bidder.address);
    expect(await getBalance(seller)).to.equal(100);
    expect(await getBalance(bidder)).to.equal(10000-100);
    expect(await bidAmountForTokenBidder(0, bidder)).to.equal(0);
  });

  it("should return token if bidder cancels bid", async () => {
    await nftMedia.mintTo(seller.address, BID_SHARES);
    await setBid(bidder, 0, 100);

    expect(await getBalance(bidder)).to.equal(10000-100);
    await nftMedia.connect(bidder).removeBid(0)
    expect(await getBalance(bidder)).to.equal(10000);
  });

  it("should let owner remove someone else's bid and release their token", async () => {
    await nftMedia.mintTo(seller.address, BID_SHARES);
    await setBid(bidder, 0, 100);
    expect(await bidAmountForTokenBidder(0, bidder)).to.equal(100);
    expect(await getBalance(bidder)).to.equal(10000-100);

    await nftMedia.ownerRemoveBid(0, bidder.address);
    expect(await bidAmountForTokenBidder(0, bidder)).to.equal(0);
    expect(await getBalance(bidder)).to.equal(10000);
  });

  it("should not let non-owner remove someone else's bid", async () => {
    await nftMedia.mintTo(seller.address, BID_SHARES);
    await setBid(bidder, 0, 100);
    await expect(nftMedia.connect(other).ownerRemoveBid(0, bidder.address)).to.be.rejectedWith(Error);
    expect(await bidAmountForTokenBidder(0, bidder)).to.equal(100);
  });

  it("should support owner batch-removing bids", async () => {
    await nftMedia.mintTo(seller.address, BID_SHARES);
    await nftMedia.mintTo(seller.address, BID_SHARES);
    await setBid(bidder, 0, 100);
    await setBid(bidder, 1, 100);
    await setBid(other, 1, 100);
    expect(await bidAmountForTokenBidder(0, bidder)).to.equal(100);
    expect(await bidAmountForTokenBidder(1, bidder)).to.equal(100);
    expect(await bidAmountForTokenBidder(1, other)).to.equal(100);
    expect(await getBalance(bidder)).to.equal(10000-200);
    expect(await getBalance(other)).to.equal(10000-100);

    await nftMedia.ownerBatchRemoveBids([0, 1, 1], [bidder.address, bidder.address, other.address]);
    expect(await bidAmountForTokenBidder(0, bidder)).to.equal(0);
    expect(await bidAmountForTokenBidder(1, bidder)).to.equal(0);
    expect(await bidAmountForTokenBidder(1, other)).to.equal(0);
    expect(await getBalance(bidder)).to.equal(10000);
    expect(await getBalance(other)).to.equal(10000);
  });

  it("should not let non-owner batch-remove bids", async () => {
    await nftMedia.mintTo(seller.address, BID_SHARES);
    await nftMedia.mintTo(seller.address, BID_SHARES);
    await setBid(bidder, 0, 100);
    await setBid(bidder, 1, 100);
    await setBid(other, 1, 100);
    expect(await bidAmountForTokenBidder(0, bidder)).to.equal(100);
    expect(await bidAmountForTokenBidder(1, bidder)).to.equal(100);
    expect(await bidAmountForTokenBidder(1, other)).to.equal(100);

    await expect(nftMedia.connect(other).ownerBatchRemoveBids([0, 1, 1], [bidder.address, bidder.address, other.address])).to.be.rejectedWith(Error);
    expect(await bidAmountForTokenBidder(0, bidder)).to.equal(100);
    expect(await bidAmountForTokenBidder(1, bidder)).to.equal(100);
    expect(await bidAmountForTokenBidder(1, other)).to.equal(100);
    expect(await getBalance(bidder)).to.equal(10000-200);
    expect(await getBalance(other)).to.equal(10000-100);
  });

  it("should fail when removing bid for non-existent tokens", async () => {
    await expect(nftMedia.ownerRemoveBid(0, bidder.address)).to.be.rejectedWith(Error);
  });
  it("should fail when batch-removing bids for non-existent tokens", async () => {
    await expect(nftMedia.ownerBatchRemoveBids([0, 1], [bidder.address, bidder.address])).to.be.rejectedWith(Error);
  });
  it("should fail when batch-removing with mismatched tokenIDs and bidders lengths", async () => {
    await expect(nftMedia.ownerBatchRemoveBids([0, 1], [bidder.address])).to.be.rejectedWith(Error);
  });
});
