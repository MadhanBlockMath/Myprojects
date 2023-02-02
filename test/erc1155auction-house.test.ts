import chai from "chai";
import chaiAsPromised from "chai-as-promised";
chai.use(chaiAsPromised);
const expect = chai.expect;
import { Decimal } from "@zoralabs/zdk";
import { ethers } from "hardhat";
import { BigNumber, Contract, Signer } from "ethers";
import { formatUnits } from "ethers/lib/utils";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { max } from "bn.js";
import { experimentalAddHardhatNetworkMessageTraceHook } from "hardhat/config";

const BASE_URI =
  "https://arweave.net/oUbZMh4SJ-98Xot0kEhsKmyyf-wMOEbDNFgUpc_dJfI/";
const BASE_URI_SUFFIX = ".json";
const CONTRACT_METADATA_URI =
  "http://ipfs.io/ipfs/QmT5vJ53pbrZ3NhUk7o1fYLUfB6Qfui4nDhD1FBZFsy4sH";
const ONE_ETH = ethers.utils.parseUnits("1", "ether") as BigNumber;
const TWO_ETH = ethers.utils.parseUnits("2", "ether") as BigNumber;

const BID_SHARES = {
  prevOwner: Decimal.new(10),
  owner: Decimal.new(80),
  creator: Decimal.new(10),
};

describe("Auction Contract", () => {
  let nftMedia: Contract;
  let auctionHouse: Contract;
  let weth: Contract;
  let nftMarket: Contract;

  beforeEach(async () => {
    const CREATOR_IMPLEMENTATION_ADDR = await ethers.getContractFactory(
      "ERC1155CreatorImplementation"
    );
    nftMarket = await CREATOR_IMPLEMENTATION_ADDR.deploy();
    await nftMarket.deployed();

    const NFTMedia = await ethers.getContractFactory("Creator1155Proxy");
    const nftMedia1 = await NFTMedia.deploy(nftMarket.address);
    const WETH = await ethers.getContractFactory("WETH");
    weth = await WETH.deploy();
    nftMedia = await ethers.getContractAt(
      "ERC1155CreatorImplementation",
      nftMedia1.address
    );
    const AuctionHouse = await ethers.getContractFactory("AuctionHouse");
    auctionHouse = await AuctionHouse.deploy(nftMedia.address, weth.address);
  });

  describe("Auction House Constructor", () => {
    it("should be able to deploy", async () => {
      const AuctionHouse = await ethers.getContractFactory("AuctionHouse");
      const auctionHouse = await AuctionHouse.deploy(
        nftMedia.address,
        weth.address
      );

      expect(await auctionHouse.nftAddress()).to.eq(
        nftMedia.address,
        "incorrect zora address"
      );
      expect(formatUnits(await auctionHouse.timeBuffer(), 0)).to.eq(
        "900.0",
        "time buffer should equal 900"
      );
      expect(await auctionHouse.minBidIncrementPercentage()).to.eq(
        5,
        "minBidIncrementPercentage should equal 5%"
      );
    });
  });

  describe("Create Auction House", () => {
    it("should revert if the token contract does not support the ERC1155 interface", async () => {
      const [addr1] = await ethers.getSigners();
      const duration = 60 * 60 * 24;
      const reservePrice = BigNumber.from(10).pow(18).div(2);
      const maxPrice = BigNumber.from(10).pow(18);
      const startTime = 1655904918;
      const quantity = 2;
      const [_, curator] = await ethers.getSigners();
      const bad = await (
        await ethers.getContractFactory("BadERC1155")
      ).deploy();
      await expect(
        auctionHouse
          .connect(addr1)
          .createAuction(
            0,
            bad.address,
            duration,
            reservePrice,
            curator.address,
            5,
            "0x0000000000000000000000000000000000000000",
            maxPrice,
            startTime,
            quantity
          )
      ).to.be.rejectedWith(
        Error,
        "tokenContract does not support ERC721 or ERC1155 interface"
      );
    });

    it("should revert if the quantity zero and more than owners balance", async () => {
      const [addr1] = await ethers.getSigners();
      const receipt2 = await nftMedia[
        "mintBaseNew(address[],uint256[],string[])"
      ](
        [addr1.address],
        [2],
        [
          "https://gateway.arweave.net/TCrOsfGKrPEpIIIl4gm1ETjhjg-fCXdxk6Vwmd45NJg",
        ]
      );
      receipt2.wait();
      const duration = 60 * 60 * 24;
      const reservePrice = BigNumber.from(10).pow(18).div(2);
      const maxPrice = BigNumber.from(10).pow(18);
      const startTime = 1655904918;
      const quantity = 2;
      const [_, curator, __, ___, unapproved] = await ethers.getSigners();
      await expect(
        auctionHouse
          .connect(unapproved)
          .createAuction(
            0,
            nftMedia.address,
            duration,
            reservePrice,
            curator.address,
            5,
            "0x0000000000000000000000000000000000000000",
            maxPrice,
            startTime,
            quantity
          )
      ).to.be.rejectedWith(
        Error,
        "quantity should be more than zero && should be less than or equal to ownerBalance"
      );
    });

    it("should revert if the curator fee percentage is >= 100", async () => {
      const [addr1] = await ethers.getSigners();
      const receipt2 = await nftMedia[
        "mintBaseNew(address[],uint256[],string[])"
      ](
        [addr1.address],
        [2],
        [
          "https://gateway.arweave.net/TCrOsfGKrPEpIIIl4gm1ETjhjg-fCXdxk6Vwmd45NJg",
        ]
      );
      receipt2.wait();

      const duration = 60 * 60 * 24;
      const reservePrice = BigNumber.from(10).pow(18).div(2);
      const maxPrice = BigNumber.from(10).pow(18);
      const startTime = 1655904918;
      const quantity = 2;
      const [_, curator] = await ethers.getSigners();

      await expect(
        auctionHouse
          .connect(addr1)
          .createAuction(
            0,
            nftMedia.address,
            duration,
            reservePrice,
            curator.address,
            100,
            "0x0000000000000000000000000000000000000000",
            maxPrice,
            startTime,
            quantity
          )
      ).to.be.rejectedWith(Error, "curatorFeePercentage must be less than 100");
    });
    it("should revert if the reservePrice is greater than maxPrice", async () => {
      const [addr1] = await ethers.getSigners();
      const receipt2 = await nftMedia[
        "mintBaseNew(address[],uint256[],string[])"
      ](
        [addr1.address],
        [2],
        [
          "https://gateway.arweave.net/TCrOsfGKrPEpIIIl4gm1ETjhjg-fCXdxk6Vwmd45NJg",
        ]
      );
      receipt2.wait();

      const duration = 60 * 60 * 24;
      const reservePrice = BigNumber.from(10).pow(18).div(2);
      const maxPrice = BigNumber.from(10).pow(18).div(4);
      const startTime = 1655904918;
      const quantity = 2;
      const [_, curator] = await ethers.getSigners();

      await expect(
        auctionHouse
          .connect(addr1)
          .createAuction(
            0,
            nftMedia.address,
            duration,
            reservePrice,
            curator.address,
            5,
            "0x0000000000000000000000000000000000000000",
            maxPrice,
            startTime,
            quantity
          )
      ).to.be.rejectedWith(Error, "maxPrice should be greater than reservePrice");
    });

    it("should create an auction house ", async () => {
      const [_, expectedCurator] = await ethers.getSigners();
      const currency = "0x0000000000000000000000000000000000000000";
      const curator = await expectedCurator.getAddress();
      const tokenId = 1;
      let duration = 60 * 60 * 24;
      const reservePrice = BigNumber.from(10).pow(18).div(2);
      const maxPrice = BigNumber.from(10).pow(18);
      const startTime = 1655904918;
      const quantity = 2;

      const [addr1] = await ethers.getSigners();

      // Approving Auction house to transfer addr1's tokens
      await nftMedia
        .connect(addr1)
        .setApprovalForAll(auctionHouse.address, true);

      const receipt2 = await nftMedia[
        "mintBaseNew(address[],uint256[],string[])"
      ](
        [addr1.address],
        [2],
        [
          "https://gateway.arweave.net/TCrOsfGKrPEpIIIl4gm1ETjhjg-fCXdxk6Vwmd45NJg",
        ]
      );
      receipt2.wait();
      await auctionHouse
        .connect(addr1)
        .createAuction(
          tokenId,
          nftMedia.address,
          duration,
          reservePrice,
          curator,
          5,
          currency,
          maxPrice,
          startTime,
          quantity
        );
      const createdAuction = await auctionHouse.auctions(0);
      expect(createdAuction.duration.toNumber()).to.eq(duration);
      expect(createdAuction.reservePrice.toString()).to.eq(
        reservePrice.toString()
      );
      expect(createdAuction.curatorFeePercentage).to.eq(5);
      expect(createdAuction.tokenOwner).to.eq(addr1.address);
      expect(createdAuction.curator).to.eq(expectedCurator.address);
      expect(createdAuction.approved).to.eq(false);
    });

    it("should be automatically approved if the creator is the curator", async () => {
      const [addr1] = await ethers.getSigners();
      await nftMedia
        .connect(addr1)
        .setApprovalForAll(auctionHouse.address, true);
      const receipt2 = await nftMedia[
        "mintBaseNew(address[],uint256[],string[])"
      ](
        [addr1.address],
        [5],
        [
          "https://gateway.arweave.net/TCrOsfGKrPEpIIIl4gm1ETjhjg-fCXdxk6Vwmd45NJg",
        ]
      );
      receipt2.wait();
      const currency = "0x0000000000000000000000000000000000000000";
      const tokenId = 1;
      let duration = 60 * 60 * 24;
      const reservePrice = BigNumber.from(10).pow(18).div(2);
      const maxPrice = BigNumber.from(10).pow(18);
      const startTime = 1655904918;
      const quantity = 5;

      await auctionHouse
        .connect(addr1)
        .createAuction(
          tokenId,
          nftMedia.address,
          duration,
          reservePrice,
          addr1.address,
          5,
          currency,
          maxPrice,
          startTime,
          quantity
        );
      const createdAuction = await auctionHouse.auctions(0);
      expect(createdAuction.approved).to.eq(true);
    });

    it("should be automatically approved if the creator is the Zero Address", async () => {
      const [addr1] = await ethers.getSigners();
      await nftMedia
        .connect(addr1)
        .setApprovalForAll(auctionHouse.address, true);
      const receipt2 = await nftMedia[
        "mintBaseNew(address[],uint256[],string[])"
      ](
        [addr1.address],
        [2],
        [
          "https://gateway.arweave.net/TCrOsfGKrPEpIIIl4gm1ETjhjg-fCXdxk6Vwmd45NJg",
        ]
      );
      receipt2.wait();
      const currency = "0x0000000000000000000000000000000000000000";
      const tokenId = 1;
      let duration = 60 * 60 * 24;
      const reservePrice = BigNumber.from(10).pow(18).div(2);
      const maxPrice = BigNumber.from(10).pow(18);
      const startTime = 1655904918;
      const quantity = 2;

      await auctionHouse
        .connect(addr1)
        .createAuction(
          tokenId,
          nftMedia.address,
          duration,
          reservePrice,
          ethers.constants.AddressZero,
          5,
          currency,
          maxPrice,
          startTime,
          quantity
        );
      const createdAuction = await auctionHouse.auctions(0);
      expect(createdAuction.approved).to.eq(true);
    });

    it("should emit an AuctionCreated event", async () => {
      const [addr1] = await ethers.getSigners();
      await nftMedia
        .connect(addr1)
        .setApprovalForAll(auctionHouse.address, true);
      const receipt2 = await nftMedia[
        "mintBaseNew(address[],uint256[],string[])"
      ](
        [addr1.address],
        [2],
        [
          "https://gateway.arweave.net/TCrOsfGKrPEpIIIl4gm1ETjhjg-fCXdxk6Vwmd45NJg",
        ]
      );
      receipt2.wait();
      const [_, expectedCurator] = await ethers.getSigners();

      const currency = "0x0000000000000000000000000000000000000000";
      const tokenId = 1;
      let duration = 60 * 60 * 24;
      const reservePrice = BigNumber.from(10).pow(18).div(2);
      const maxPrice = BigNumber.from(10).pow(18);
      const startTime = 1655904918;
      const quantity = 2;

      const block = await ethers.provider.getBlockNumber();
      await auctionHouse
        .connect(addr1)
        .createAuction(
          tokenId,
          nftMedia.address,
          duration,
          reservePrice,
          expectedCurator.address,
          5,
          currency,
          maxPrice,
          startTime,
          quantity
        );
      const currAuction = await auctionHouse.auctions(0);
      const events = await auctionHouse.queryFilter(
        auctionHouse.filters.AuctionCreated(
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null
        ),
        block
      );
      expect(events.length).eq(1);
      const logDescription = auctionHouse.interface.parseLog(events[0]);
      expect(logDescription.name).to.eq("AuctionCreated");
      expect(logDescription.args.duration.toNumber).to.eq(
        currAuction.duration.toNumber
      );
      expect(logDescription.args.reservePrice.toString()).to.eq(
        currAuction.reservePrice.toString()
      );
      expect(logDescription.args.tokenOwner).to.eq(currAuction.tokenOwner);
      expect(logDescription.args.curator).to.eq(currAuction.curator);
      expect(logDescription.args.curatorFeePercentage).to.eq(
        currAuction.curatorFeePercentage
      );
      expect(logDescription.args.auctionCurrency).to.eq(
        ethers.constants.AddressZero
      );
    });
  });
  describe("Set Auction Approval", () => {
    let admin: SignerWithAddress;
    let curator: SignerWithAddress;
    let bidder: SignerWithAddress;

    beforeEach(async () => {
      [admin, curator, bidder] = await ethers.getSigners();
      const currency = "0x0000000000000000000000000000000000000000";
      const tokenId = 1;
      let duration = 60 * 60 * 24;
      const reservePrice = BigNumber.from(10).pow(18).div(2);
      const maxPrice = BigNumber.from(10).pow(18).mul(2);
      const startTime = 1655904918;
      const quantity = 2;

      // Approving Auction house to transfer addr1's tokens
      await nftMedia
        .connect(admin)
        .setApprovalForAll(auctionHouse.address, true);
      const receipt2 = await nftMedia[
        "mintBaseNew(address[],uint256[],string[])"
      ](
        [admin.address],
        [2],
        [
          "https://gateway.arweave.net/TCrOsfGKrPEpIIIl4gm1ETjhjg-fCXdxk6Vwmd45NJg",
        ]
      );
      receipt2.wait();
      await auctionHouse
        .connect(admin)
        .createAuction(
          tokenId,
          nftMedia.address,
          duration,
          reservePrice,
          curator.address,
          5,
          currency,
          maxPrice,
          startTime,
          quantity
        );
    });

    it("should revert if the auctionHouse does not exist", async () => {
      await expect(auctionHouse.setAuctionApproval(1, true)).to.be.rejectedWith(
        Error,
        "Auction doesn't exist"
      );
    });

    it("should revert if not called by the curator", async () => {
      await expect(
        auctionHouse.connect(admin).setAuctionApproval(0, true)
      ).to.be.rejectedWith("Must be auction curator");
    });

    it("should revert if the auction has already started", async () => {
      await auctionHouse.connect(curator).setAuctionApproval(0, true);
      await auctionHouse
        .connect(bidder)
        .createBid(0, ONE_ETH, { value: ONE_ETH });
      await expect(
        auctionHouse.connect(curator).setAuctionApproval(0, false)
      ).to.be.rejectedWith("Auction has already started");
    });

    it("should set the auction as approved", async () => {
      await auctionHouse.connect(curator).setAuctionApproval(0, true);
      expect((await auctionHouse.auctions(0)).approved).to.eq(true);
    });

    it("should emit an AuctionApproved event", async () => {
      const block = await ethers.provider.getBlockNumber();
      await auctionHouse.connect(curator).setAuctionApproval(0, true);
      const events = await auctionHouse.queryFilter(
        auctionHouse.filters.AuctionApprovalUpdated(null, null, null, null),
        block
      );
      expect(events.length).eq(1);
      const logDescription = auctionHouse.interface.parseLog(events[0]);
      expect(logDescription.args.approved).to.eq(true);
    });
  });

  describe("Create Bid", () => {
    let admin: SignerWithAddress;
    let curator: SignerWithAddress;
    let bidderA: SignerWithAddress;
    let bidderB: SignerWithAddress;

    beforeEach(async () => {
      [admin, curator, bidderA, bidderB] = await ethers.getSigners();
      const currency = "0x0000000000000000000000000000000000000000";
      const tokenId = 1;
      let duration = 60 * 60 * 24;
      const reservePrice = BigNumber.from(10).pow(18).div(2);
      const maxPrice = BigNumber.from(10).pow(18).mul(4);
      const startTime = 1655904918;
      const quantity = 2;
      // Approving Auction house to transfer addr1's tokens
      await nftMedia
        .connect(admin)
        .setApprovalForAll(auctionHouse.address, true);

      const receipt2 = await nftMedia[
        "mintBaseNew(address[],uint256[],string[])"
      ](
        [admin.address],
        [2],
        [
          "https://gateway.arweave.net/TCrOsfGKrPEpIIIl4gm1ETjhjg-fCXdxk6Vwmd45NJg",
        ]
      );
      receipt2.wait();
      await auctionHouse
        .connect(admin)
        .createAuction(
          tokenId,
          nftMedia.address,
          duration,
          reservePrice,
          curator.address,
          5,
          currency,
          maxPrice,
          startTime,
          quantity
        );
      await auctionHouse.connect(curator).setAuctionApproval(0, true);
    });

    it("should revert if the specified auction does not exist", async () => {
      await expect(auctionHouse.createBid(11111, ONE_ETH)).to.be.rejectedWith(
        Error,
        "Auction doesn't exist"
      );
    });

    it("should revert if the specified auction is not approved", async () => {
      await auctionHouse.connect(curator).setAuctionApproval(0, false);
      await expect(
        auctionHouse.createBid(0, ONE_ETH, { value: ONE_ETH })
      ).to.be.rejectedWith(Error, "Auction must be approved by curator");
    });

    it("should revert if the bid is less than the reserve price", async () => {
      await expect(
        auctionHouse.createBid(0, 0, { value: 0 })
      ).to.be.rejectedWith(Error, "Must send at least reservePrice");
    });

    it("should revert if msg.value does not equal specified amount", async () => {
      await expect(
        auctionHouse.createBid(0, ONE_ETH, {
          value: ONE_ETH.mul(2),
        })
      ).eventually.rejectedWith(
        Error,
        "Sent ETH Value does not match specified bid amount"
      );
    });
    describe("First bid", () => {
      it("should set the first bid time", async () => {
        await ethers.provider.send("evm_setNextBlockTimestamp", [1656100000]);
        await auctionHouse.createBid(0, ONE_ETH, {
          value: ONE_ETH,
        });
        expect((await auctionHouse.auctions(0)).firstBidTime.toNumber()).to.eq(
          1656100000
        );
      });

      it("should store the transferred ETH as WETH", async () => {
        await auctionHouse.createBid(0, ONE_ETH, {
          value: ONE_ETH,
        });
        const wethvalue = await weth.balanceOf(auctionHouse.address);
        expect(wethvalue.toString()).to.eq(ONE_ETH.toString());
      });

      it("should not update the auction's duration", async () => {
        const beforeDuration = (await auctionHouse.auctions(0)).duration;
        await auctionHouse.createBid(0, ONE_ETH, {
          value: ONE_ETH,
        });
        const afterDuration = (await auctionHouse.auctions(0)).duration;

        expect(beforeDuration.toNumber()).to.eq(afterDuration.toNumber());
      });

      it("should store the bidder's information", async () => {
        await auctionHouse.connect(bidderA).createBid(0, ONE_ETH, {
          value: ONE_ETH,
        });
        const currAuction = await auctionHouse.auctions(0);

        expect(currAuction.bidder).to.eq(await bidderA.getAddress());
        expect(currAuction.amount.toString()).to.eq(ONE_ETH.toString());
      });

      it("should emit an AuctionBid event", async () => {
        const block = await ethers.provider.getBlockNumber();
        await auctionHouse.connect(bidderA).createBid(0, ONE_ETH, {
          value: ONE_ETH,
        });
        const events = await auctionHouse.queryFilter(
          auctionHouse.filters.AuctionBid(
            null,
            null,
            null,
            null,
            null,
            null,
            null
          ),
          block
        );
        expect(events.length).eq(1);
        const logDescription = auctionHouse.interface.parseLog(events[0]);

        expect(logDescription.name).to.eq("AuctionBid");
        expect(logDescription.args.auctionId.toNumber()).to.eq(0);
        expect(logDescription.args.sender).to.eq(await bidderA.getAddress());
        expect(logDescription.args.value.toString()).to.eq(ONE_ETH.toString());
        expect(logDescription.args.firstBid).to.eq(true);
        expect(logDescription.args.extended).to.eq(false);
      });
    });

    describe("Bid MaxPrice", () =>{
      beforeEach(async () => {
        await auctionHouse
          .connect(bidderA)
          .createBid(0, ONE_ETH, { value: ONE_ETH });
      });
      it("should refunf the previous bid", async() =>{
        const beforeBalance = await ethers.provider.getBalance(
          await bidderA.getAddress()
        );
        const beforeBidAmount = (await auctionHouse.auctions(0)).amount;
        await auctionHouse.connect(bidderB).createBid(0, TWO_ETH.mul(2), {
          value: TWO_ETH.mul(2),
        });
        const afterBalance = await ethers.provider.getBalance(
          await bidderA.getAddress()
        );

        expect(afterBalance.toString()).to.eq(
          beforeBalance.add(beforeBidAmount).toString()
        );
      })
      it("should transfer the NFT to bidder who places maxPrice", async () => {
        await auctionHouse.connect(bidderB).createBid(0, TWO_ETH.mul(2), {
          value: TWO_ETH.mul(2),
        });

        expect(
          (await nftMedia.balanceOf(bidderB.getAddress(), 1)).toString()
        ).to.eq('2');
      });
      it("should pay the curator their curatorFee percentage", async () => {
        const beforeBalance = await ethers.provider.getBalance(
          await curator.getAddress()
        );
        await auctionHouse.connect(bidderB).createBid(0, TWO_ETH.mul(2), {
          value: TWO_ETH.mul(2),
        });
        const expectedCuratorFee = "200000000000000000";
        const curatorBalance = await ethers.provider.getBalance(
          await curator.getAddress()
        );
        await expect(curatorBalance.sub(beforeBalance).toString()).to.eq(
          expectedCuratorFee
        );
      });
      it("should pay the creator the remainder of the winning bid", async () => {
        const beforeBalance = await ethers.provider.getBalance(
          await admin.getAddress()
        );
        await auctionHouse.connect(bidderB).createBid(0, TWO_ETH.mul(2), {
          value: TWO_ETH.mul(2),
        });
        const expectedProfit = "3800000000000000000";
        const creatorBalance = await ethers.provider.getBalance(
          await admin.getAddress()
        );
        const wethBalance = await weth.balanceOf(await admin.getAddress());
        await expect(
          creatorBalance.sub(beforeBalance).add(wethBalance).toString()
        ).to.eq(expectedProfit);
      });
      it("should delete the auction", async () => {
        await auctionHouse.connect(bidderB).createBid(0, TWO_ETH.mul(2), {
          value: TWO_ETH.mul(2),
        });

        const auctionResult = await auctionHouse.auctions(0);

        expect(auctionResult.amount.toNumber()).to.eq(0);
        expect(auctionResult.duration.toNumber()).to.eq(0);
        expect(auctionResult.firstBidTime.toNumber()).to.eq(0);
        expect(auctionResult.reservePrice.toNumber()).to.eq(0);
        expect(auctionResult.curatorFeePercentage).to.eq(0);
        expect(auctionResult.tokenOwner).to.eq(ethers.constants.AddressZero);
        expect(auctionResult.bidder).to.eq(ethers.constants.AddressZero);
        expect(auctionResult.curator).to.eq(ethers.constants.AddressZero);
        expect(auctionResult.auctionCurrency).to.eq(
          ethers.constants.AddressZero
        );
      });

    })
    describe("Second bid", () => {
      beforeEach(async () => {
        await auctionHouse
          .connect(bidderA)
          .createBid(0, ONE_ETH, { value: ONE_ETH });
      });

      it("should revert if the bid is smaller than the last bid + minBid", async () => {
        await expect(
          auctionHouse.connect(bidderB).createBid(0, ONE_ETH.add(1), {
            value: ONE_ETH.add(1),
          })
        ).to.be.rejectedWith(
          Error,
          "Must send more than last bid by minBidIncrementPercentage amount"
        );
      });

      it("should refund the previous bid", async () => {
        const beforeBalance = await ethers.provider.getBalance(
          await bidderA.getAddress()
        );
        const beforeBidAmount = (await auctionHouse.auctions(0)).amount;
        await auctionHouse.connect(bidderB).createBid(0, TWO_ETH, {
          value: TWO_ETH,
        });
        const afterBalance = await ethers.provider.getBalance(
          await bidderA.getAddress()
        );

        expect(afterBalance.toString()).to.eq(
          beforeBalance.add(beforeBidAmount).toString()
        );
      });

      it("should not update the firstBidTime", async () => {
        const firstBidTime = (await auctionHouse.auctions(0)).firstBidTime;
        await auctionHouse.connect(bidderB).createBid(0, TWO_ETH, {
          value: TWO_ETH,
        });
        expect((await auctionHouse.auctions(0)).firstBidTime.toString()).to.eq(
          firstBidTime.toString()
        );
      });

      it("should transfer the bid to the contract and store it as WETH", async () => {
        await auctionHouse.connect(bidderB).createBid(0, TWO_ETH, {
          value: TWO_ETH,
        });

        expect((await weth.balanceOf(auctionHouse.address)).toString()).to.eq(
          TWO_ETH.toString()
        );
      });

      it("should update the stored bid information", async () => {
        await auctionHouse.connect(bidderB).createBid(0, TWO_ETH, {
          value: TWO_ETH,
        });

        const currAuction = await auctionHouse.auctions(0);
        expect(currAuction.amount.toString()).to.eq(TWO_ETH.toString());
        expect(currAuction.bidder).to.eq(await bidderB.getAddress());
      });

      it("should not extend the duration of the bid if outside of the time buffer", async () => {
        const beforeDuration = (await auctionHouse.auctions(0)).duration;
        await auctionHouse.connect(bidderB).createBid(0, TWO_ETH, {
          value: TWO_ETH,
        });
        const afterDuration = (await auctionHouse.auctions(0)).duration;
        expect(beforeDuration.toString()).to.eq(afterDuration.toString());
      });

      it("should emit an AuctionBid event", async () => {
        const block = await ethers.provider.getBlockNumber();
        await auctionHouse.connect(bidderB).createBid(0, TWO_ETH, {
          value: TWO_ETH,
        });
        const events = await auctionHouse.queryFilter(
          auctionHouse.filters.AuctionBid(
            null,
            null,
            null,
            null,
            null,
            null,
            null
          ),
          block
        );
        expect(events.length).eq(2);
        const logDescription = auctionHouse.interface.parseLog(events[1]);

        expect(logDescription.name).to.eq("AuctionBid");
        expect(logDescription.args.sender).to.eq(await bidderB.getAddress());
        expect(logDescription.args.value.toString()).to.eq(TWO_ETH.toString());
        expect(logDescription.args.firstBid).to.eq(false);
        expect(logDescription.args.extended).to.eq(false);
      });
    });
  });
  describe("Cancel the Auction", () => {
    let admin: SignerWithAddress;
    let creator: SignerWithAddress;
    let curator: SignerWithAddress;
    let bidder: SignerWithAddress;

    beforeEach(async () => {
      [admin, creator, curator, bidder] = await ethers.getSigners();

      const [_, expectedCurator] = await ethers.getSigners();
      const currency = "0x0000000000000000000000000000000000000000";
      const tokenId = 1;
      let duration = 60 * 60 * 24;
      const reservePrice = BigNumber.from(10).pow(18).div(2);
      const maxPrice = BigNumber.from(10).pow(18).mul(4);
      const startTime = 1655904918;
      const quantity = 2;

      // Approving Auction house to transfer addr1's tokens
      await nftMedia
        .connect(creator)
        .setApprovalForAll(auctionHouse.address, true);

      const receipt2 = await nftMedia[
        "mintBaseNew(address[],uint256[],string[])"
      ](
        [creator.address],
        [2],
        [
          "https://gateway.arweave.net/TCrOsfGKrPEpIIIl4gm1ETjhjg-fCXdxk6Vwmd45NJg",
        ]
      );
      receipt2.wait();
      await auctionHouse
        .connect(creator)
        .createAuction(
          tokenId,
          nftMedia.address,
          duration,
          reservePrice,
          curator.address,
          5,
          currency,
          maxPrice,
          startTime,
          quantity
        );
      await auctionHouse.connect(curator).setAuctionApproval(0, true);
    });

    it("should revert if the auction does not exist", async () => {
      await expect(auctionHouse.cancelAuction(12213)).to.be.rejectedWith(
        Error,
        "Auction doesn't exist"
      );
    });

    it("should revert if not called by a creator or curator", async () => {
      await expect(
        auctionHouse.connect(bidder).cancelAuction(0)
      ).to.be.rejectedWith(
        Error,
        "Can only be called by auction creator or curator"
      );
    });

    it("should revert if the auction has already begun", async () => {
      await auctionHouse
        .connect(bidder)
        .createBid(0, ONE_ETH, { value: ONE_ETH });
      await expect(
        auctionHouse.connect(curator).cancelAuction(0)
      ).to.be.rejectedWith(Error, "Can't cancel an auction once it's begun");
    });

    it("should be callable by the creator", async () => {
      await auctionHouse.connect(creator).cancelAuction(0);

      const auctionResult = await auctionHouse.auctions(0);

      expect(auctionResult.amount.toNumber()).to.eq(0);
      expect(auctionResult.duration.toNumber()).to.eq(0);
      expect(auctionResult.firstBidTime.toNumber()).to.eq(0);
      expect(auctionResult.reservePrice.toNumber()).to.eq(0);
      expect(auctionResult.curatorFeePercentage).to.eq(0);
      expect(auctionResult.startTime.toNumber()).to.eq(0);
      expect(auctionResult.tokenOwner).to.eq(ethers.constants.AddressZero);
      expect(auctionResult.bidder).to.eq(ethers.constants.AddressZero);
      expect(auctionResult.curator).to.eq(ethers.constants.AddressZero);
      expect(auctionResult.auctionCurrency).to.eq(ethers.constants.AddressZero);
    });

    it("should be callable by the curator", async () => {
      await auctionHouse.connect(curator).cancelAuction(0);

      const auctionResult = await auctionHouse.auctions(0);

      expect(auctionResult.amount.toNumber()).to.eq(0);
      expect(auctionResult.duration.toNumber()).to.eq(0);
      expect(auctionResult.firstBidTime.toNumber()).to.eq(0);
      expect(auctionResult.reservePrice.toNumber()).to.eq(0);
      expect(auctionResult.startTime.toNumber()).to.eq(0);
      expect(auctionResult.curatorFeePercentage).to.eq(0);
      expect(auctionResult.tokenOwner).to.eq(ethers.constants.AddressZero);
      expect(auctionResult.bidder).to.eq(ethers.constants.AddressZero);
      expect(auctionResult.curator).to.eq(ethers.constants.AddressZero);
      expect(auctionResult.auctionCurrency).to.eq(ethers.constants.AddressZero);
    });

    it("should emit an AuctionCanceled event", async () => {
      const block = await ethers.provider.getBlockNumber();
      await auctionHouse.connect(curator).cancelAuction(0);
      const events = await auctionHouse.queryFilter(
        auctionHouse.filters.AuctionCanceled(null, null, null, null),
        block
      );
      expect(events.length).eq(1);
      const logDescription = auctionHouse.interface.parseLog(events[0]);

      expect(logDescription.args.tokenId.toNumber()).to.eq(1);
      expect(logDescription.args.tokenOwner).to.eq(await creator.getAddress());
      expect(logDescription.args.tokenContract).to.eq(nftMedia.address);
    });
  });
  describe("End the Auction", () => {
    let admin: SignerWithAddress;
    let creator: SignerWithAddress;
    let curator: SignerWithAddress;
    let bidder: SignerWithAddress;
    let other: SignerWithAddress;

    beforeEach(async () => {
      [admin, creator, curator, bidder, other] = await ethers.getSigners();
      const [_, expectedCurator] = await ethers.getSigners();
      const currency = "0x0000000000000000000000000000000000000000";
      const tokenId = 1;
      let duration = 60 * 60 * 24;
      const reservePrice = BigNumber.from(10).pow(18).div(2);
      const maxPrice = BigNumber.from(10).pow(18).mul(4);
      const startTime = 1655904918;
      const quantity = 2;

      // Approving Auction house to transfer addr1's tokens
      await nftMedia
        .connect(creator)
        .setApprovalForAll(auctionHouse.address, true);

      const receipt2 = await nftMedia[
        "mintBaseNew(address[],uint256[],string[])"
      ](
        [creator.address],
        [2],
        [
          "https://gateway.arweave.net/TCrOsfGKrPEpIIIl4gm1ETjhjg-fCXdxk6Vwmd45NJg",
        ]
      );
      receipt2.wait();
      await auctionHouse
        .connect(creator)
        .createAuction(
          tokenId,
          nftMedia.address,
          duration,
          reservePrice,
          curator.address,
          5,
          currency,
          maxPrice,
          startTime,
          quantity
        );
      await auctionHouse.connect(curator).setAuctionApproval(0, true);
    });

    it("should revert if the auction does not exist", async () => {
      await expect(auctionHouse.endAuction(1110)).to.be.rejectedWith(
        Error,
        "Auction doesn't exist"
      );
    });

    it("should revert if the auction has not begun", async () => {
      await expect(auctionHouse.endAuction(0)).to.be.rejectedWith(
        Error,
        "Auction hasn't begun"
      );
    });

    it("should revert if the auction has not completed", async () => {
      await auctionHouse.createBid(0, ONE_ETH, {
        value: ONE_ETH,
      });

      await expect(auctionHouse.endAuction(0)).to.be.rejectedWith(
        Error,
        "Auction hasn't completed"
      );
    });

    it("should cancel the auction if the winning bidder is unable to receive NFTs", async () => {
      const badBidder = await (
        await ethers.getContractFactory("BadBidder")
      ).deploy(auctionHouse.address, nftMedia.address);
      await badBidder.placeBid(0, TWO_ETH, { value: TWO_ETH });
      const endTime =
        (await auctionHouse.auctions(0)).duration.toNumber() +
        (await auctionHouse.auctions(0)).firstBidTime.toNumber();
      await ethers.provider.send("evm_setNextBlockTimestamp", [endTime + 1]);

      await auctionHouse.endAuction(0);

      expect(
        (await nftMedia.balanceOf(creator.getAddress(), 1)).toString()
      ).to.eq('2');
      expect(
        (await ethers.provider.getBalance(badBidder.address)).toString()
      ).to.eq(TWO_ETH.toString());
    });
    describe("Final NFT Transfer to Winning Bidder", () => {
      beforeEach(async () => {
        await auctionHouse
          .connect(bidder)
          .createBid(0, ONE_ETH, { value: ONE_ETH });
        const endTime =
          (await auctionHouse.auctions(0)).duration.toNumber() +
          (await auctionHouse.auctions(0)).firstBidTime.toNumber();
        await ethers.provider.send("evm_setNextBlockTimestamp", [endTime + 1]);
      });

      it("should transfer the NFT to the winning bidder", async () => {
        await auctionHouse.endAuction(0);

        expect(
          (await nftMedia.balanceOf(bidder.getAddress(), 1)).toString()
        ).to.eq('2');
      });

      it("should pay the curator their curatorFee percentage", async () => {
        const beforeBalance = await ethers.provider.getBalance(
          await curator.getAddress()
        );
        await auctionHouse.endAuction(0);
        const expectedCuratorFee = "50000000000000000";
        const curatorBalance = await ethers.provider.getBalance(
          await curator.getAddress()
        );
        await expect(curatorBalance.sub(beforeBalance).toString()).to.eq(
          expectedCuratorFee
        );
      });

      it("should pay the creator the remainder of the winning bid", async () => {
        const beforeBalance = await ethers.provider.getBalance(
          await creator.getAddress()
        );
        await auctionHouse.endAuction(0);
        const expectedProfit = "950000000000000000";
        const creatorBalance = await ethers.provider.getBalance(
          await creator.getAddress()
        );
        const wethBalance = await weth.balanceOf(await creator.getAddress());
        await expect(
          creatorBalance.sub(beforeBalance).add(wethBalance).toString()
        ).to.eq(expectedProfit);
      });

      it("should emit an AuctionEnded event", async () => {
        const block = await ethers.provider.getBlockNumber();
        const auctionData = await auctionHouse.auctions(0);
        await auctionHouse.endAuction(0);
        const events = await auctionHouse.queryFilter(
          auctionHouse.filters.AuctionEnded(
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null
          ),
          block
        );
        expect(events.length).eq(1);
        const logDescription = auctionHouse.interface.parseLog(events[0]);

        expect(logDescription.args.tokenId.toNumber()).to.eq(1);
        expect(logDescription.args.tokenOwner).to.eq(auctionData.tokenOwner);
        expect(logDescription.args.curator).to.eq(auctionData.curator);
        expect(logDescription.args.winner).to.eq(auctionData.bidder);
        expect(logDescription.args.amount.toString()).to.eq(
          "950000000000000000"
        );
        expect(logDescription.args.curatorFee.toString()).to.eq(
          "50000000000000000"
        );
        expect(logDescription.args.auctionCurrency).to.eq(weth.address);
      });

      it("should delete the auction", async () => {
        await auctionHouse.endAuction(0);

        const auctionResult = await auctionHouse.auctions(0);

        expect(auctionResult.amount.toNumber()).to.eq(0);
        expect(auctionResult.duration.toNumber()).to.eq(0);
        expect(auctionResult.firstBidTime.toNumber()).to.eq(0);
        expect(auctionResult.reservePrice.toNumber()).to.eq(0);
        expect(auctionResult.curatorFeePercentage).to.eq(0);
        expect(auctionResult.tokenOwner).to.eq(ethers.constants.AddressZero);
        expect(auctionResult.bidder).to.eq(ethers.constants.AddressZero);
        expect(auctionResult.curator).to.eq(ethers.constants.AddressZero);
        expect(auctionResult.auctionCurrency).to.eq(
          ethers.constants.AddressZero
        );
      });
    });
  });
});
