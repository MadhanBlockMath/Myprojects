import chai from "chai";
import chaiAsPromised from "chai-as-promised";
chai.use(chaiAsPromised);
const expect = chai.expect;
import { Decimal } from "@zoralabs/zdk";
import { ethers } from "hardhat";
import { BigNumber, Contract, Signer } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { contractOptions } from "web3/eth/contract";

const BASE_URI =
  "https://arweave.net/oUbZMh4SJ-98Xot0kEhsKmyyf-wMOEbDNFgUpc_dJfI/";
const BASE_URI_SUFFIX = ".json";
const CONTRACT_METADATA_URI =
  "http://ipfs.io/ipfs/QmT5vJ53pbrZ3NhUk7o1fYLUfB6Qfui4nDhD1FBZFsy4sH";
const ONE_ETH = ethers.utils.parseUnits("1", "ether") as BigNumber;

const BID_SHARES = {
  prevOwner: Decimal.new(10),
  owner: Decimal.new(80),
  creator: Decimal.new(10),
};

describe("Sotheby's Marketplace Contract (Test Suite)", () => {
  let nftMedia721: Contract;
  let nftMedia1155: Contract;
  let auction: Contract;
  let weth: Contract;
  let sol: Contract;
  let dai: Contract;
  let avax: Contract;
  let matic: Contract;
  let badErc20: Contract;
  let platform: SignerWithAddress;
  let seller: SignerWithAddress;
  let buyer: SignerWithAddress;
  let anonymousUser: SignerWithAddress;
  let royaltyRecipient1: SignerWithAddress;
  let royaltyRecipient2: SignerWithAddress;
  let paymentSettlementAddress: SignerWithAddress;
  let taxSettlementAddress: SignerWithAddress;
  const tokenIdStart = BigNumber.from("1");
  const tokenIdEnd = BigNumber.from("5");
  const maxCap = BigNumber.from("100");
  const mint = 0;
  const transfer = BigNumber.from("1");
  const platformFeePercentage = 250;
  const tax = ONE_ETH.div(4);
  const saleId = "6102b690-d2bc-435e-9d8b-3c660cccd8b0";
  beforeEach(async () => {
    [
      platform,
      seller,
      buyer,
      anonymousUser,
      royaltyRecipient1,
      royaltyRecipient2,
      paymentSettlementAddress,
      taxSettlementAddress,
    ] = await ethers.getSigners();

    const ERC721CreatorImplementation = await ethers.getContractFactory(
      "ERC721CreatorImplementation"
    );
    const erc721CreatorImplementation =
      await ERC721CreatorImplementation.deploy();
    await erc721CreatorImplementation.deployed();

    const Creator721Proxy = await ethers.getContractFactory("Creator721Proxy");
    nftMedia721 = await Creator721Proxy.deploy(
      "Sero NFT",
      "SFT",
      erc721CreatorImplementation.address
    );
    await nftMedia721.deployed();
    const ERC1155CreatorImplementation = await ethers.getContractFactory(
      "ERC1155CreatorImplementation"
    );
    const erc1155CreatorImplementation =
      await ERC1155CreatorImplementation.deploy();
    await erc1155CreatorImplementation.deployed();

    const Creator1155Proxy = await ethers.getContractFactory(
      "Creator1155Proxy"
    );
    nftMedia1155 = await Creator1155Proxy.deploy(
      erc1155CreatorImplementation.address
    );

    const WETH = await ethers.getContractFactory("WETH");
    weth = await WETH.deploy();
    await weth.deployed();

    const erc20 = await ethers.getContractFactory("BadERC20");
    badErc20 = await erc20.deploy();
    await badErc20.deployed();

    const Sol = await ethers.getContractFactory("TestERC20");
    sol = await Sol.deploy("Solana", "SOL", 18);
    await sol.deployed();

    const Dai = await ethers.getContractFactory("TestERC20");
    dai = await Dai.deploy("Solana", "SOL", 18);
    await dai.deployed();

    const Avax = await ethers.getContractFactory("TestERC20");
    avax = await Avax.deploy("Solana", "SOL", 18);
    await avax.deployed();

    const Matic = await ethers.getContractFactory("TestERC20");
    matic = await Matic.deploy("Solana", "SOL", 18);
    await matic.deployed();

    nftMedia721 = await ethers.getContractAt(
      "ERC721CreatorImplementation",
      nftMedia721.address
    );
    nftMedia1155 = await ethers.getContractAt(
      "ERC1155CreatorImplementation",
      nftMedia1155.address
    );

    const Auction = await ethers.getContractFactory("onchainAuction");
    auction = await Auction.deploy(platform.address, platformFeePercentage);
    await auction.deployed();
    // setting base uri for erc721
    await nftMedia721.setBaseTokenURI(BASE_URI);
    // setting base uri for erc1155
    await nftMedia1155.setBaseTokenURI(BASE_URI);

    // await nftMedia721["setBaseTokenURIExtension(string)"](BASE_URI);

    // Minting a Token
    await nftMedia721["mintBaseBatch(address,uint16)"](seller.address, 10);
    await nftMedia1155.mintBaseNew([seller.address], [1, 1, 1, 1, 1], []);
    // Approving marketplace
    await nftMedia721.connect(seller).setApprovalForAll(auction.address, true);
    await nftMedia1155.connect(seller).setApprovalForAll(auction.address, true);

    await nftMedia721["setRoyalties(address[],uint256[])"](
      [royaltyRecipient1.address, royaltyRecipient2.address],
      [500, 200]
    );
    await nftMedia1155["setRoyalties(address[],uint256[])"](
      [royaltyRecipient1.address, royaltyRecipient2.address],
      [500, 200]
    );
    await nftMedia721.setRoyaltiesExtension(
      auction.address,
      [royaltyRecipient1.address, royaltyRecipient2.address],
      [500, 200]
    );
    await nftMedia721["registerExtension(address,string)"](
      auction.address,
      BASE_URI
    );
    await nftMedia1155["registerExtension(address,string)"](
      auction.address,
      BASE_URI
    );
  });

  describe("Marketplace Constructor", () => {
    it("should be able to deploy", async () => {
      const AuctionContract = await ethers.getContractFactory("onchainAuction");
      const auction = await AuctionContract.deploy(
        platform.address,
        platformFeePercentage
      );
      await auction.deployed();

      expect(await auction.platformAddress()).to.eq(
        platform.address,
        "incorrect platform address"
      );
    });
  });
  describe("Create  Sale- Flow", () => {
    // it("array length for payment address and amount should be equal", async () => {
    //   const order1 = [
    //     nftMedia721.address,
    //     tokenIdStart,
    //     tokenIdEnd,
    //     [1000, 2000, 3000],
    //     [ethers.constants.AddressZero, avax.address, dai.address, sol.address],
    //     paymentSettlementAddress.address,
    //     taxSettlementAddress.address,
    //     maxCap,
    //     transfer,
    //   ];

    //   await expect(
    //     auction.connect(platform).createSale(order1, saleId)
    //   ).to.be.rejectedWith(
    //     Error,
    //     "should provide equal length in price and payment address"
    //   );
    // });
    it("minimum price should be greater than zero for all tokens provided", async () => {
      const order1 = [
        nftMedia721.address,
        tokenIdStart,
        tokenIdEnd,
        1,
        0,
        ethers.constants.AddressZero,
        paymentSettlementAddress.address,
        taxSettlementAddress.address,
        maxCap,
        604800,
        transfer,
      ];

      await expect(
        auction.connect(platform).createAuction(saleId, order1)
      ).to.be.rejectedWith(Error, "minimum price should be greater than zero");
    });

    it("should revert if the token contract does not support the ERC721 interface", async () => {
        const bad = await (await ethers.getContractFactory("BadERC721")).deploy();
        const order1 = [
        bad.address,
        tokenIdStart,
        tokenIdEnd,
        1,
        ethers.utils.parseUnits("0.11","ether"),
        ethers.constants.AddressZero,
        paymentSettlementAddress.address,
        taxSettlementAddress.address,
        maxCap,
        604800,
        transfer,
      ];

      await expect(
        auction.connect(platform).createAuction(saleId, order1)
      ).to.be.rejectedWith(Error, "should provide only supported Nft Address");
    });
    it("nft token id should support the listings", async () => {
        const bad = await (await ethers.getContractFactory("BadERC721")).deploy();
        const order1 = [
        nftMedia721.address,
        tokenIdEnd,
        tokenIdStart,
        1,
        ethers.utils.parseUnits("0.11","ether"),
        ethers.constants.AddressZero,
        paymentSettlementAddress.address,
        taxSettlementAddress.address,
        maxCap,
        604800,
        transfer,
      ];

      await expect(
        auction.connect(platform).createAuction(saleId, order1)
      ).to.be.rejectedWith(Error, "listed tokens noes not support");
    });
    it("duration of the auction to be provided", async () => {
        const bad = await (await ethers.getContractFactory("BadERC721")).deploy();
        const order1 = [
        nftMedia721.address,
        tokenIdStart,
        tokenIdEnd,
        1,
        ethers.utils.parseUnits("0.11","ether"),
        ethers.constants.AddressZero,
        paymentSettlementAddress.address,
        taxSettlementAddress.address,
        maxCap,
        0,
        transfer,
      ];

      await expect(
        auction.connect(platform).createAuction(saleId, order1)
      ).to.be.rejectedWith(Error, "provide the duration of the auction");
    });
    it("should provide a settlement address", async () => {
        const bad = await (await ethers.getContractFactory("BadERC721")).deploy();
        const order1 = [
        nftMedia721.address,
        tokenIdStart,
        tokenIdEnd,
        1,
        ethers.utils.parseUnits("0.11","ether"),
        ethers.constants.AddressZero,
        ethers.constants.AddressZero,
        taxSettlementAddress.address,
        maxCap,
        604800,
        transfer,
      ];

      await expect(
        auction.connect(platform).createAuction(saleId, order1)
      ).to.be.rejectedWith(Error, "should provide Settlement address");
    });
  });
});