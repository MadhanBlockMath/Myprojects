import chai from "chai";
import chaiAsPromised from "chai-as-promised";
chai.use(chaiAsPromised);
const expect = chai.expect;
import { Decimal } from "@zoralabs/zdk";
import { ethers } from "hardhat";
import { BigNumber, Contract, Signer } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { contractOptions } from "web3/eth/contract";
import { log } from "console";

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
  let buy: Contract;
  let weth: Contract;
  let sol: Contract;
  let dai: Contract;
  let avax: Contract;
  let matic: Contract;
  let priceFeed: Contract;
  let badErc20: Contract;
  let mockRoyalty: Contract;
  let platform: SignerWithAddress;
  let seller: SignerWithAddress;
  let buyer: SignerWithAddress;
  let anonymousUser: SignerWithAddress;
  let royaltyRecipient1: SignerWithAddress;
  let royaltyRecipient2: SignerWithAddress;
  let paymentSettlementAddress: SignerWithAddress;
  let taxSettlementAddress: SignerWithAddress;
  let platformAddress1: SignerWithAddress;
  let platformAddress2: SignerWithAddress;
  let commessionAddress1: SignerWithAddress;
  let commessionAddress2: SignerWithAddress;
  let amount: BigNumber;
  const tokenIdStart = BigNumber.from("1");
  const tokenIdEnd = BigNumber.from("5");
  const maxCap = BigNumber.from("100");
  const mint = 0;
  const fiat = BigNumber.from("0");
  const crypto = BigNumber.from("1");
  const transfer = BigNumber.from("1");
  const platformFeePercentage = 250;
  const tax = ONE_ETH.div(4);
  const saleId = "6102b690-d2bc-435e-9d8b-3c660cccd8b0";
  const slippage = 200;
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
      platformAddress1,
      platformAddress2,
      commessionAddress1,
      commessionAddress2,
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

    const royalty = await ethers.getContractFactory("RoyaltyEngine")
    mockRoyalty = await royalty.deploy();
    await mockRoyalty.deployed();

    const WETH = await ethers.getContractFactory("WETH");
    weth = await WETH.deploy();
    await weth.deployed();

    const currencyAddress = [ethers.constants.AddressZero];
    const feedAddress = ["0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419"];
    const heartBeat = [3600];
    const priceFeedContract = await ethers.getContractFactory("FeedData");
    priceFeed = await priceFeedContract.deploy(
      feedAddress,
      currencyAddress,
      heartBeat,
      platform.address
    );
    await priceFeed.deployed();
    amount = await priceFeed.getLatestPrice(1000, ethers.constants.AddressZero);
    console.log(amount);

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

    const Buy = await ethers.getContractFactory("OnchainBuy");
    buy = await Buy.deploy(
      platform.address,
      platformFeePercentage,
      1000,
      priceFeed.address,
      mockRoyalty.address
    );
    await buy.deployed();
    // setting base uri for erc721
    await nftMedia721.setBaseTokenURI(BASE_URI);
    // setting base uri for erc1155
    await nftMedia1155.setBaseTokenURI(BASE_URI);

    // await nftMedia721["setBaseTokenURIExtension(string)"](BASE_URI);

    // Minting a Token
    await nftMedia721["mintBaseBatch(address,uint16)"](seller.address, 10);
    await nftMedia1155.mintBaseNew([seller.address], [1, 1, 1, 1, 1], []);
    // Approving marketplace
    await nftMedia721.connect(seller).setApprovalForAll(buy.address, true);
    await nftMedia1155.connect(seller).setApprovalForAll(buy.address, true);

    await nftMedia721["setRoyalties(address[],uint256[])"](
      [royaltyRecipient1.address, royaltyRecipient2.address],
      [500, 200]
    );
    await nftMedia1155["setRoyalties(address[],uint256[])"](
      [royaltyRecipient1.address, royaltyRecipient2.address],
      [500, 200]
    );
    await nftMedia721.setRoyaltiesExtension(
      buy.address,
      [royaltyRecipient1.address, royaltyRecipient2.address],
      [500, 200]
    );
    await nftMedia721["registerExtension(address,string)"](
      buy.address,
      BASE_URI
    );
    await nftMedia1155["registerExtension(address,string)"](
      buy.address,
      BASE_URI
    );
  });

  describe("Marketplace Constructor", () => {
    it("should be able to deploy", async () => {
      const BuyContract = await ethers.getContractFactory("OnchainBuy");
      const buy = await BuyContract.deploy(
        platform.address,
        platformFeePercentage,
        1000,
        priceFeed.address,
        mockRoyalty.address
      );
      await buy.deployed();

      // expect(await buy.platformAddress()).to.eq(
      //   platform.address,
      //   "incorrect platform address"
      // );
    });
  });
  describe("Create  Sale- Flow", () => {
    it("total fee basis points for platform and commession should be less than 10000 bps", async () => {
      const order1 = [
        nftMedia721.address,
        tokenIdStart,
        tokenIdEnd,
        1000,
        [],
        [],
        [
          paymentSettlementAddress.address,
          taxSettlementAddress.address,
          platformAddress1.address,
          8000,
          commessionAddress1.address,
          2000,
        ],
        maxCap,
        transfer,
        fiat,
      ];

      await expect(
        buy.connect(platform).createSale(order1, saleId)
      ).to.be.rejectedWith(
        Error,
        "The total fee basis point should be less than 10000"
      );
    });
    it("array length for payment address and amount should be equal", async () => {
      const order1 = [
        nftMedia721.address,
        tokenIdStart,
        tokenIdEnd,
        0,
        [1000, 2000, 3000],
        [
          ethers.constants.AddressZero,
          avax.address,
          dai.address,
          matic.address,
        ],
        [
          paymentSettlementAddress.address,
          taxSettlementAddress.address,
          platformAddress1.address,
          800,
          commessionAddress1.address,
          200,
        ],
        maxCap,
        transfer,
        crypto,
      ];

      await expect(
        buy.connect(platform).createSale(order1, saleId)
      ).to.be.rejectedWith(
        Error,
        "should provide equal length in price and payment address"
      );
    });
    it("should provede MAXCAP for minting", async () => {
      const order1 = [
        nftMedia721.address,
        tokenIdStart,
        tokenIdEnd,
        1000,
        [],
        [],
        [
          paymentSettlementAddress.address,
          taxSettlementAddress.address,
          platformAddress1.address,
          500,
          commessionAddress1.address,
          100,
        ],
        0,
        mint,
        fiat,
      ];

      await expect(
        buy.connect(platform).createSale(order1, saleId)
      ).to.be.rejectedWith(Error, "should provide maxCap for minting");
    });
    it("nft token id should support the listings", async () => {
      const order1 = [
        nftMedia721.address,
        5,
        2,
        1000,
        [],
        [],
        [
          paymentSettlementAddress.address,
          taxSettlementAddress.address,
          platformAddress1.address,
          500,
          commessionAddress1.address,
          100,
        ],
        maxCap,
        transfer,
        fiat,
      ];
      await expect(
        buy.connect(platform).createSale(order1, saleId)
      ).to.be.rejectedWith(
        Error,
        "This is not a valid NFT start or end token ID. Please verify that the range provided is correct"
      );
    });
    it("should revert if the token contract does not support the ERC721 interface", async () => {
      const bad = await (await ethers.getContractFactory("BadERC721")).deploy();
      const order1 = [
        bad.address,
        tokenIdStart,
        tokenIdEnd,
        1000,
        [],
        [],
        [
          paymentSettlementAddress.address,
          taxSettlementAddress.address,
          platformAddress1.address,
          500,
          commessionAddress1.address,
          100,
        ],
        0,
        transfer,
        fiat,
      ];
      await expect(
        buy.connect(platform).createSale(order1, saleId)
      ).to.be.rejectedWith(
        Error,
        "should provide only supported contract interfaces ERC 721/1155"
      );
    });
    it("should not provide zero address for settlement account", async () => {
      const order1 = [
        nftMedia721.address,
        tokenIdStart,
        tokenIdEnd,
        1000,
        [],
        [],
        [
          ethers.constants.AddressZero,
          taxSettlementAddress.address,
          platformAddress1.address,
          500,
          commessionAddress1.address,
          100,
        ],
        0,
        transfer,
        fiat,
      ];
      await expect(
        buy.connect(platform).createSale(order1, saleId)
      ).to.be.rejectedWith(
        Error,
        "should provide valid wallet address for settlement"
      );
    });
    it("should not provide max cap for transferring tokens", async () => {
      const order1 = [
        nftMedia721.address,
        tokenIdStart,
        tokenIdEnd,
        1000,
        [],
        [],
        [
          paymentSettlementAddress.address,
          taxSettlementAddress.address,
          platformAddress1.address,
          500,
          commessionAddress1.address,
          100,
        ],
        maxCap,
        transfer,
        fiat,
      ];
      await expect(
        buy.connect(platform).createSale(order1, saleId)
      ).to.be.rejectedWith(Error, "maxCap should be 0 for preminted tokens");
    });
    it("Should be able to create the sale using valid information", async () => {
      const order1 = [
        nftMedia721.address,
        tokenIdStart,
        tokenIdEnd,
        1000,
        [],
        [],
        [
          paymentSettlementAddress.address,
          taxSettlementAddress.address,
          platformAddress1.address,
          500,
          commessionAddress1.address,
          100,
        ],
        0,
        transfer,
        fiat,
      ];

      await buy.connect(platform).createSale(order1, saleId);
      const createdSale = await buy.listings(saleId);
      // const settlementAddress = await buy.getSettlementAddressBps(saleId);
      expect(createdSale.nftContractAddress).to.eq(nftMedia721.address);
      expect(createdSale.nftStartTokenId.toString()).to.eq(
        tokenIdStart.toString()
      );
      expect(createdSale.nftEndTokenId.toString()).to.eq(tokenIdEnd.toString());
      expect(createdSale.minimumFiatPrice.toString()).to.eq("1000");
      expect(createdSale.transactionStatus.toString()).to.eq("1");
      expect(createdSale.paymentSettlement.paymentSettlementAddress).to.eq(
        paymentSettlementAddress.address
      );
      expect(createdSale.paymentSettlement.platformFeePercentage.toString()).to.eq("500");
      expect(createdSale.paymentSettlement.platformSettlementAddress).to.eq(
        platformAddress1.address
      );
      expect(createdSale.paymentSettlement.commissionAddress).to.eq(
        commessionAddress1.address
      );
      expect(createdSale.paymentSettlement.commissionFeePercentage.toString()).to.eq(
        "100"
      );
      expect(createdSale.paymentSettlement.taxSettlementAddress).to.eq(
        taxSettlementAddress.address
      );
    });
  });
  describe("Buy Now - Flow", () => {
    beforeEach(async () => {
      const order1 = [
        nftMedia721.address,
        tokenIdStart,
        tokenIdEnd,
        1000,
        [],
        [],
        [
          paymentSettlementAddress.address,
          taxSettlementAddress.address,
          platformAddress1.address,
          500,
          commessionAddress1.address,
          100,
        ],
        0,
        transfer,
        fiat,
      ];

      await buy.connect(platform).createSale(order1, saleId);
    });
    it("should provide only listed sale Id", async () => {
      const buyList = [
        "23029jfjir3j-9j30rejibjcr3ouo2eke923j",
        seller.address,
        5,
        0,
        buyer.address,
        1,
        ethers.constants.AddressZero,
        amount,
      ];
      await expect(
        buy.connect(buyer).buy(buyList, tax, { value: tax.add(amount) })
      ).to.be.rejectedWith(Error, "unsupported sale");
    });
    it("should support the listing token from token Id", async () => {
      const buyList = [
        saleId,
        seller.address,
        6,
        0,
        buyer.address,
        1,
        ethers.constants.AddressZero,
        amount,
      ];
      await expect(
        buy.connect(buyer).buy(buyList, tax, { value: tax.add(amount) })
      ).to.be.rejectedWith(
        Error,
        "This is not a valid tokenId. Please verify that the tokenId provided is correct"
      );
    });
    it("should provide only supported currencies", async () => {
      const buyList = [
        saleId,
        seller.address,
        5,
        0,
        buyer.address,
        1,
        badErc20.address,
        1000,
      ];
      await expect(
        buy.connect(buyer).buy(buyList, tax, { value: tax.add(amount) })
      ).to.be.rejectedWith(
        Error,
        "ChainlinkFeed is not available. Please provide valid chainlink supported ERC20 address"
      );
    });
    it("should provide sufficent amount to buy the token", async () => {
      const buyList = [
        saleId,
        seller.address,
        5,
        0,
        buyer.address,
        1,
        ethers.constants.AddressZero,
        3000,
      ];
      await expect(
        buy.connect(buyer).buy(buyList, tax, { value: tax.add(amount) })
      ).to.be.rejectedWith(
        Error,
        "Insufficient funds or invalid amount. You need to pass a valid amount to complete this transaction"
      );
    });
    it("should provide correct token owner while buying the nft", async () => {
      const buyList = [
        saleId,
        anonymousUser.address,
        5,
        0,
        buyer.address,
        1,
        ethers.constants.AddressZero,
        amount,
      ];
      await expect(
        buy.connect(buyer).buy(buyList, tax, { value: tax.add(amount) })
      ).to.be.rejectedWith(
        Error,
        "Invalid NFT Owner Address. Please check and try again"
      );
    });

    it("buy the token using valid imformation", async () => {
      const buyList = [
        saleId,
        seller.address,
        5,
        1,
        buyer.address,
        1,
        ethers.constants.AddressZero,
        amount,
      ];
      const tokenId = await buy
        .connect(buyer)
        .buy(buyList, tax, { value: tax.add(amount) });
      expect(await nftMedia721.ownerOf(5)).to.eq(buyer.address);
    });
    it("checking information in emitted events", async () => {
      const buyList = [
        saleId,
        seller.address,
        5,
        1,
        buyer.address,
        1,
        ethers.constants.AddressZero,
        amount,
      ];
      const block = await ethers.provider.getBlockNumber();
      await buy.connect(buyer).buy(buyList, tax, { value: tax.add(amount) });
      expect(await nftMedia721.ownerOf(5)).to.eq(buyer.address);
      const events = await buy.queryFilter(
        buy.filters.BuyExecuted(null, null, null, null, null, null),
        block
      );
      expect(events.length).eq(1);
      const logDescription = buy.interface.parseLog(events[0]);
      expect(logDescription.args.buyingDetails.saleId.toString()).to.eq(saleId);
      expect(logDescription.args.buyingDetails.tokenOwner).to.eq(
        seller.address
      );
      expect(logDescription.args.buyingDetails.tokenId.toNumber()).to.eq(5);
      expect(logDescription.args.buyingDetails.paymentToken).to.eq(
        ethers.constants.AddressZero
      );
      expect(logDescription.args.excessAmount.toNumber()).to.eq(0);
      //   expect(logDescription.args.tokenId).to.eq(4500);
      expect(logDescription.args.buyingDetails.buyer).to.eq(buyer.address);
      expect(Number(logDescription.args.paymentAmount)).to.eq(Number(amount));
    });
  });
  describe("Buy Now - Flow with crypto payment support", () => {
    beforeEach(async () => {
      const order1 = [
        nftMedia721.address,
        tokenIdStart,
        tokenIdEnd,
        0,
        [ONE_ETH.div(4), 2000, 3000],
        [ethers.constants.AddressZero, avax.address, dai.address],
        [
          paymentSettlementAddress.address,
          taxSettlementAddress.address,
          platformAddress1.address,
          500,
          commessionAddress1.address,
          100,
        ],
        0,
        transfer,
        crypto,
      ];
      const order2 = [
        nftMedia721.address,
        0,
        0,
        0,
        [ONE_ETH.div(4), 2000, 3000],
        [ethers.constants.AddressZero, avax.address, dai.address],
        [
          paymentSettlementAddress.address,
          taxSettlementAddress.address,
          platformAddress1.address,
          500,
          commessionAddress1.address,
          100,
        ],
        10,
        mint,
        crypto,
      ];

      await buy.connect(platform).createSale(order1, saleId);
      await buy
      .connect(platform)
      .createSale(order2, "e3neoutbinedobvtmoroun290uu409nurnubin");
    });
    it("buy the token using valid crypto imformation", async () => {
      const buyList = [
        saleId,
        seller.address,
        5,
        1,
        buyer.address,
        1,
        ethers.constants.AddressZero,
        ONE_ETH.div(4),
      ];
      const tokenId = await buy
        .connect(buyer)
        .buy(buyList, tax, { value: tax.add(ONE_ETH.div(4)) });
      expect(await nftMedia721.ownerOf(5)).to.eq(buyer.address);
    });
    it("checking information in emitted events", async () => {
      const buyList = [
        saleId,
        seller.address,
        5,
        1,
        buyer.address,
        1,
        ethers.constants.AddressZero,
        ONE_ETH.div(4),
      ];
      const block = await ethers.provider.getBlockNumber();
      await buy.connect(buyer).buy(buyList, tax, { value: tax.add(ONE_ETH.div(4))});
      expect(await nftMedia721.ownerOf(5)).to.eq(buyer.address);
      const events = await buy.queryFilter(
        buy.filters.BuyExecuted(null, null, null, null, null, null),
        block
      );
      expect(events.length).eq(1);
      const logDescription = buy.interface.parseLog(events[0]);
      expect(logDescription.args.buyingDetails.saleId.toString()).to.eq(saleId);
      expect(logDescription.args.buyingDetails.tokenOwner).to.eq(
        seller.address
      );
      expect(logDescription.args.buyingDetails.tokenId.toNumber()).to.eq(5);
      expect(logDescription.args.buyingDetails.paymentToken).to.eq(
        ethers.constants.AddressZero
      );
      expect(logDescription.args.excessAmount.toNumber()).to.eq(0);
      //   expect(logDescription.args.tokenId).to.eq(4500);
      expect(logDescription.args.buyingDetails.buyer).to.eq(buyer.address);
      expect(Number(logDescription.args.paymentAmount)).to.eq(Number(ONE_ETH.div(4)));
    });
    it("should mint 5 nft tokens for erc-721", async () => {
      const buyList = [
        "e3neoutbinedobvtmoroun290uu409nurnubin",
        seller.address,
        0,
        5,
        buyer.address,
        1,
        ethers.constants.AddressZero,
        tax.mul(5),
      ];
      const block = await ethers.provider.getBlockNumber();
      await buy
        .connect(buyer)
        .buy(buyList, tax, { value: tax.add(tax.mul(5)) });
      expect(await nftMedia721.ownerOf(11)).to.eq(buyer.address);
      expect(await nftMedia721.ownerOf(12)).to.eq(buyer.address);
      expect(await nftMedia721.ownerOf(13)).to.eq(buyer.address);
      expect(await nftMedia721.ownerOf(14)).to.eq(buyer.address);
      expect(await nftMedia721.ownerOf(15)).to.eq(buyer.address);
    });
    it("should transfer the platform fee to the platform provided address", async () => {
      const platform = await ethers.provider.getBalance(
        platformAddress1.address
      );
      const buyList = [
        saleId,
        seller.address,
        5,
        1,
        buyer.address,
        1,
        ethers.constants.AddressZero,
        tax,
      ];
      const tokenId = await buy
        .connect(buyer)
        .buy(buyList, tax, { value: tax.add(tax) });
      expect(await nftMedia721.ownerOf(5)).to.eq(buyer.address);

      let platformfee = tax.mul(500).div(10000);
      expect(
        Number(await ethers.provider.getBalance(platformAddress1.address))
      ).to.eq(Number(platform.add(platformfee)));
    });
  });
  describe("minting for erc721 and 1155", () => {
    beforeEach(async () => {
      const order1 = [
        nftMedia721.address,
        0,
        0,
        1000,
        [],
        [],
        [
          paymentSettlementAddress.address,
          taxSettlementAddress.address,
          platformAddress1.address,
          500,
          commessionAddress1.address,
          100,
        ],
        10,
        mint,
        fiat,
      ];
      const order2 = [
        nftMedia1155.address,
        0,
        0,
        100,
        [],
        [],
        [
          paymentSettlementAddress.address,
          taxSettlementAddress.address,
          platformAddress1.address,
          500,
          commessionAddress1.address,
          100,
        ],
        10,
        mint,
        fiat,
      ];

      await buy
        .connect(platform)
        .createSale(order1, "e3neoutbinedobvtmoroun290uu409nurnubin");
      await buy
        .connect(platform)
        .createSale(order2, "e3neoutbinedobvtmoroun290uu");
    });
    it("should provide correct amount to buy the token", async () => {
      const buyList = [
        "e3neoutbinedobvtmoroun290uu409nurnubin",
        seller.address,
        0,
        5,
        buyer.address,
        1,
        ethers.constants.AddressZero,
        amount,
      ];
      const block = await ethers.provider.getBlockNumber();
      await expect(
        buy.connect(buyer).buy(buyList, tax, { value: tax.add(amount) })
      ).to.be.rejectedWith(
        Error,
        "Insufficient funds or invalid amount. You need to pass a valid amount to complete this transaction"
      );
    });

    it("should revert if the total token minted to be greater than MaxTokens", async () => {
      const buyList = [
        "e3neoutbinedobvtmoroun290uu409nurnubin",
        seller.address,
        0,
        12,
        buyer.address,
        1,
        ethers.constants.AddressZero,
        amount.mul(12),
      ];
      const block = await ethers.provider.getBlockNumber();
      await expect(
        buy.connect(buyer).buy(buyList, tax, { value: tax.add(amount.mul(12)) })
      ).to.be.rejectedWith(
        Error,
        "The maximum quantity allowed to purchase ERC721 token has been sold out. Please contact the sale owner for more details"
      );
    });
    it("should mint 5 nft tokens for erc-721", async () => {
      const buyList = [
        "e3neoutbinedobvtmoroun290uu409nurnubin",
        seller.address,
        0,
        5,
        buyer.address,
        1,
        ethers.constants.AddressZero,
        amount.mul(5),
      ];
      const block = await ethers.provider.getBlockNumber();
      await buy
        .connect(buyer)
        .buy(buyList, tax, { value: tax.add(amount.mul(5)) });
      expect(await nftMedia721.ownerOf(11)).to.eq(buyer.address);
      expect(await nftMedia721.ownerOf(12)).to.eq(buyer.address);
      expect(await nftMedia721.ownerOf(13)).to.eq(buyer.address);
      expect(await nftMedia721.ownerOf(14)).to.eq(buyer.address);
      expect(await nftMedia721.ownerOf(15)).to.eq(buyer.address);
    });
    it("should mint 5 nft tokens for erc-721and get the minted tokens in events", async () => {
      const buyList = [
        "e3neoutbinedobvtmoroun290uu409nurnubin",
        seller.address,
        0,
        5,
        buyer.address,
        1,
        ethers.constants.AddressZero,
        amount.mul(5),
      ];
      const block = await ethers.provider.getBlockNumber();
      const buytx = await buy
        .connect(buyer)
        .buy(buyList, tax, { value: tax.add(amount.mul(5)) });
      const events = await buy.queryFilter(
        buy.filters.BuyExecuted(null, null, null, null, null, null),
        block
      );
      expect(events.length).eq(1);
      const logDescription = buy.interface.parseLog(events[0]);
      expect(logDescription.args.buyingDetails.saleId.toString()).to.eq(
        "e3neoutbinedobvtmoroun290uu409nurnubin"
      );
      expect(logDescription.args.buyingDetails.tokenOwner).to.eq(
        seller.address
      );
      expect(logDescription.args.buyingDetails.tokenId.toNumber()).to.eq(0);
      expect(logDescription.args.buyingDetails.paymentToken).to.eq(
        ethers.constants.AddressZero
      );
      expect(Number(logDescription.args.buyingDetails.paymentAmount)).to.eq(
        Number(amount.mul(5))
      );
      let finalAmount = Number(logDescription.args.buyingDetails.paymentAmount);
      console.log(finalAmount, Number(amount.mul(5)));

      expect(logDescription.args.MintedtokenId[0].toNumber()).to.eq(11);
      expect(logDescription.args.MintedtokenId[1].toNumber()).to.eq(12);
      expect(logDescription.args.MintedtokenId[2].toNumber()).to.eq(13);
      expect(logDescription.args.MintedtokenId[3].toNumber()).to.eq(14);
      expect(logDescription.args.MintedtokenId[4].toNumber()).to.eq(15);
      expect(logDescription.args.buyingDetails.buyer).to.eq(buyer.address);
    });
    it("should mint 5 nft tokens for erc-1155 mint base new", async () => {
      const buyList = [
        "e3neoutbinedobvtmoroun290uu",
        seller.address,
        0,
        5,
        buyer.address,
        2,
        ethers.constants.AddressZero,
        amount.mul(5).mul(2),
      ];
      const block = await ethers.provider.getBlockNumber();
      await buy
        .connect(buyer)
        .buy(buyList, tax, { value: tax.add(amount.mul(10)) });
      const events = await buy.queryFilter(
        buy.filters.BuyExecuted(null, null, null, null, null, null),
        block
      );
      expect(events.length).eq(1);
      const logDescription = buy.interface.parseLog(events[0]);
      expect(logDescription.args.buyingDetails.saleId.toString()).to.eq(
        "e3neoutbinedobvtmoroun290uu"
      );
      expect(logDescription.args.buyingDetails.tokenOwner).to.eq(
        seller.address
      );
      expect(logDescription.args.buyingDetails.paymentToken).to.eq(
        ethers.constants.AddressZero
      );
      expect(logDescription.args.MintedtokenId[0].toNumber()).to.eq(6);
      expect(logDescription.args.MintedtokenId[1].toNumber()).to.eq(7);
      expect(logDescription.args.MintedtokenId[2].toNumber()).to.eq(8);
      expect(logDescription.args.MintedtokenId[3].toNumber()).to.eq(9);
      expect(logDescription.args.MintedtokenId[4].toNumber()).to.eq(10);
      expect(logDescription.args.buyingDetails.buyer).to.eq(buyer.address);
      expect((await nftMedia1155.balanceOf(buyer.address, 6)).toString()).to.eq(
        "2"
      );
      expect((await nftMedia1155.balanceOf(buyer.address, 7)).toString()).to.eq(
        "2"
      );
      expect((await nftMedia1155.balanceOf(buyer.address, 8)).toString()).to.eq(
        "2"
      );
      expect((await nftMedia1155.balanceOf(buyer.address, 9)).toString()).to.eq(
        "2"
      );
      expect(
        (await nftMedia1155.balanceOf(buyer.address, 10)).toString()
      ).to.eq("2");
    });
    it("should mint 5 nft tokens for erc-1155 mint base existing", async () => {
      const buyList = [
        "e3neoutbinedobvtmoroun290uu",
        seller.address,
        0,
        5,
        buyer.address,
        2,
        ethers.constants.AddressZero,
        amount.mul(10),
      ];
      const block = await ethers.provider.getBlockNumber();
      await buy
        .connect(buyer)
        .buy(buyList, tax, { value: tax.add(amount.mul(10)) });
      expect((await nftMedia1155.balanceOf(buyer.address, 6)).toString()).to.eq(
        "2"
      );
      expect((await nftMedia1155.balanceOf(buyer.address, 7)).toString()).to.eq(
        "2"
      );
      expect((await nftMedia1155.balanceOf(buyer.address, 8)).toString()).to.eq(
        "2"
      );
      expect((await nftMedia1155.balanceOf(buyer.address, 9)).toString()).to.eq(
        "2"
      );
      expect(
        (await nftMedia1155.balanceOf(buyer.address, 10)).toString()
      ).to.eq("2");
      const buyList1 = [
        "e3neoutbinedobvtmoroun290uu",
        seller.address,
        6,
        1,
        buyer.address,
        4,
        ethers.constants.AddressZero,
        amount.mul(4),
      ];
      await buy
        .connect(buyer)
        .buy(buyList1, tax, { value: tax.add(amount.mul(4)) });
      expect((await nftMedia1155.balanceOf(buyer.address, 6)).toString()).to.eq(
        "6"
      );
    });
    it("should be less than the max1155 quantity", async () => {
      const buyList = [
        "e3neoutbinedobvtmoroun290uu",
        seller.address,
        0,
        5,
        buyer.address,
        1001,
        ethers.constants.AddressZero,
        amount.mul(10),
      ];
      await expect(
        buy.connect(buyer).buy(buyList, tax, { value: tax.add(amount.mul(10)) })
      ).to.be.rejectedWith(
        Error,
        "The maximum quantity allowed to purchase at one time should not be more than defined in max1155Quantity"
      );
    });
  });
  describe("checking of amount which are been transferred", () => {
    beforeEach(async () => {
      const order1 = [
        nftMedia721.address,
        tokenIdStart,
        tokenIdEnd,
        1000,
        [],
        [],
        [
          paymentSettlementAddress.address,
          taxSettlementAddress.address,
          platformAddress1.address,
          500,
          commessionAddress1.address,
          100,
        ],
        0,
        transfer,
        fiat,
      ];

      await buy.connect(platform).createSale(order1, saleId);
    });
    it("should transfer the tax to the tax provided address", async () => {
      const taxBalanceBefore = await ethers.provider.getBalance(
        taxSettlementAddress.address
      );
      const buyList = [
        saleId,
        seller.address,
        5,
        1,
        buyer.address,
        1,
        ethers.constants.AddressZero,
        amount,
      ];
      const tokenId = await buy
        .connect(buyer)
        .buy(buyList, tax, { value: tax.add(amount) });
      expect(await nftMedia721.ownerOf(5)).to.eq(buyer.address);
      const taxBalanceafter = taxBalanceBefore.add(tax);
      expect(
        Number(await ethers.provider.getBalance(taxSettlementAddress.address))
      ).to.eq(Number(taxBalanceafter));
    });
    it("should transfer the platform fee to the platform provided address", async () => {
      const platform = await ethers.provider.getBalance(
        platformAddress1.address
      );
      const buyList = [
        saleId,
        seller.address,
        5,
        1,
        buyer.address,
        1,
        ethers.constants.AddressZero,
        amount,
      ];
      const tokenId = await buy
        .connect(buyer)
        .buy(buyList, tax, { value: tax.add(amount) });
      expect(await nftMedia721.ownerOf(5)).to.eq(buyer.address);

      let platformfee = amount.mul(500).div(10000);
      expect(
        Number(await ethers.provider.getBalance(platformAddress1.address))
      ).to.eq(Number(platform.add(platformfee)));
    });
    it("should transfer the commession fee to the commession provided address", async () => {
      const platform = await ethers.provider.getBalance(
        commessionAddress1.address
      );
      const buyList = [
        saleId,
        seller.address,
        5,
        1,
        buyer.address,
        1,
        ethers.constants.AddressZero,
        amount,
      ];
      const tokenId = await buy
        .connect(buyer)
        .buy(buyList, tax, { value: tax.add(amount) });
      expect(await nftMedia721.ownerOf(5)).to.eq(buyer.address);

      let platformfee = amount.mul(100).div(10000);
      expect(
        Number(await ethers.provider.getBalance(commessionAddress1.address))
      ).to.eq(Number(platform.add(platformfee)));
    });
    it("should transfer the royalty fee to the fee recipients", async () => {
      const royalty1 = await ethers.provider.getBalance(
        royaltyRecipient1.address
      );
      const royalty2 = await ethers.provider.getBalance(
        royaltyRecipient2.address
      );
      const buyList = [
        saleId,
        seller.address,
        5,
        1,
        buyer.address,
        1,
        ethers.constants.AddressZero,
        amount,
      ];
      const tokenId = await buy
        .connect(buyer)
        .buy(buyList, tax, { value: tax.add(amount) });
      expect(await nftMedia721.ownerOf(5)).to.eq(buyer.address);

      let final = amount.sub(amount.mul(600).div(10000));
      expect(
        Number(await ethers.provider.getBalance(royaltyRecipient1.address))
      ).to.eq(Number(royalty1.add(final.mul(500).div(10000))));
      expect(
        Number(await ethers.provider.getBalance(royaltyRecipient2.address))
      ).to.eq(Number(royalty2.add(final.mul(200).div(10000))));
    });
    it("should transfer the royalty fee to the fee recipients", async () => {
      const paymentAddress = await ethers.provider.getBalance(
        paymentSettlementAddress.address
      );
      const buyList = [
        saleId,
        seller.address,
        5,
        1,
        buyer.address,
        1,
        ethers.constants.AddressZero,
        amount,
      ];
      const tokenId = await buy
        .connect(buyer)
        .buy(buyList, tax, { value: tax.add(amount) });
      expect(await nftMedia721.ownerOf(5)).to.eq(buyer.address);

      let beforeRoyalty = amount.sub(amount.mul(600).div(10000));
      let royaltyA = beforeRoyalty.mul(500).div(10000);
      let royaltyB = beforeRoyalty.mul(200).div(10000);
      let final = beforeRoyalty.sub(royaltyA).sub(royaltyB);
      expect(
        Number(
          await ethers.provider.getBalance(paymentSettlementAddress.address)
        )
      ).to.eq(Number(paymentAddress.add(final)));
    });
  });
});
