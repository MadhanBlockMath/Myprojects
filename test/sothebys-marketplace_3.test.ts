import chai from "chai";
import chaiAsPromised from "chai-as-promised";
chai.use(chaiAsPromised);
const expect = chai.expect;
import { Decimal } from "@zoralabs/zdk";
import { ethers } from "hardhat";
import { BigNumber, Contract, Signer } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { soliditySha3 } from "web3-utils";

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
  let nftMedia: Contract;
  let marketPlace: Contract;
  let weth: Contract;
  let nftMarket: Contract;
  let priceFeed: Contract;
  let platform: SignerWithAddress;
  let seller: SignerWithAddress;
  let buyer: SignerWithAddress;
  let anonymousUser: SignerWithAddress;
  let royaltyRecipient1: SignerWithAddress;
  let royaltyRecipient2: SignerWithAddress;
  const tokenId = BigNumber.from("1");
  const platformFeePercentage = 5;
  const tax = ONE_ETH.div(4);
  const uuid = "6102b690-d2bc-435e-9d8b-3c660cccd8b0";
  beforeEach(async () => {
    [
      platform,
      seller,
      buyer,
      anonymousUser,
      royaltyRecipient1,
      royaltyRecipient2,
    ] = await ethers.getSigners();

    const ERC721CreatorImplementation = await ethers.getContractFactory(
      "ERC721CreatorImplementation"
    );
    const erc721CreatorImplementation =
      await ERC721CreatorImplementation.deploy();
    await erc721CreatorImplementation.deployed();

    const Creator721Proxy = await ethers.getContractFactory("Creator721Proxy");
    nftMedia = await Creator721Proxy.deploy(
      "Sero NFT",
      "SFT",
      erc721CreatorImplementation.address
    );
    await nftMedia.deployed();

    const WETH = await ethers.getContractFactory("WETH");
    weth = await WETH.deploy();
    await weth.deployed();

    const currencyAddress = [weth.address];
    const feedAddress = ["0x8A753747A1Fa494EC906cE90E9f37563A8AF630e"];
    const priceFeedContract = await ethers.getContractFactory(
      "MockPriceAggregator"
    );
    priceFeed = await priceFeedContract.deploy(feedAddress, currencyAddress);
    await priceFeed.deployed();

    nftMedia = await ethers.getContractAt(
      "ERC721CreatorImplementation",
      nftMedia.address
    );

    const marketplaceContract = await ethers.getContractFactory("MarketPlaceNoSig");
    marketPlace = await marketplaceContract.deploy(
      nftMedia.address,
      weth.address,
      platform.address,
      platformFeePercentage,
      priceFeed.address
    );
    await marketPlace.deployed();

    // Approving marketplace
    await nftMedia.connect(seller).setApprovalForAll(marketPlace.address, true);

    // Minting a Token
    await nftMedia["mintBaseBatch(address,string[])"](seller.address, [
      "https://gateway.arweave.net/1N3m4VHH1lMaNXSVsOXSMwPAnVbMW0UVINzK2JDtjOk",
      "https://gateway.arweave.net/Fq7MY8shRiISa2jqB1CclMWkjws_lmcPiq0G7G551C8",
      "https://gateway.arweave.net/78a_GsKujD2V6FLT200PpCvXQ7FwjjGwGuTEjw1LYQ8",
      "https://gateway.arweave.net/kUhs8m0oCAElb2uEIopjNFpCx8UxK2Elz4L-zhuKoi4",
      "https://gateway.arweave.net/ReBiHLZqg957DccwUH3xd-DQltM8hferwOr1ux1hukM",
    ]);

    await nftMedia.setRoyaltiesExtension(
      nftMedia.address,
      [royaltyRecipient1.address, royaltyRecipient2.address],
      [500, 200]
    );
  });

  describe("Marketplace Constructor", () => {
    it("should be able to deploy", async () => {
      const marketplaceContract = await ethers.getContractFactory(
        "Marketplace"
      );
      const marketPlace = await marketplaceContract.deploy(
        nftMedia.address,
        weth.address,
        platform.address,
        platformFeePercentage,
        priceFeed.address
      );
      await marketPlace.deployed();

      expect(await marketPlace.nftAddress()).to.eq(
        nftMedia.address,
        "incorrect nftAddress address"
      );
    });
  });

  describe("Buy Now - Flow", () => {

    beforeEach ( () => {



    })
    it("should revert if the token contract does not support the ERC721 interface", async () => {
      const quantity = 1;

      const bad = await (await ethers.getContractFactory("BadERC721")).deploy();
      const order = [
        uuid,
        tokenId,
        bad.address,
        quantity,
        seller.address,
        ONE_ETH,
        ethers.constants.AddressZero,
        ONE_ETH.div(4),
        ethers.constants.AddressZero,
        0,
        0,
        ethers.constants.AddressZero,
      ]
      const signParam = order.slice(0, 7);
      const hash = ethers.utils.solidityKeccak256(
        ["bytes"],
        [
          ethers.utils.solidityPack(
            [
              "string",
              "uint256",
              "address",
              "uint256",
              "address",
              "uint256",
              "address",
            ],
            signParam
          ),
        ]
      );
      marketPlace.connect(seller).generateOrder(order);
      await expect(
        marketPlace
          .connect(buyer)
          .buy(
            order, hash
          )
      ).to.be.rejectedWith(
        Error,
        "tokenContract does not support ERC721 or ERC1155 interface"
      );
    });

    it("should revert if the uuid is not verified", async () => {
      
      const order = [
        123456,
        tokenId,
        nftMedia.address,
        BigNumber.from("1"),
        seller.address,
        ONE_ETH,
        ethers.constants.AddressZero,
        ONE_ETH.div(4),
        buyer.address,
        0,
        0,
        buyer.address,
      ];

      const signParam = order.slice(0, 7);
      const hash = ethers.utils.solidityKeccak256(
        ["bytes"],
        [
          ethers.utils.solidityPack(
            [
              "string",
              "uint256",
              "address",
              "uint256",
              "address",
              "uint256",
              "address",
            ],
            signParam
          ),
        ]
      );

      await expect(
        marketPlace.connect(buyer).buy(order,hash)
      ).to.be.rejectedWith(Error, "UnAuthorised or UnApproved");
    });

    it("should be equal to the same tokenOwner even after the sale started", async () => {
      const order = [
        uuid,
        tokenId,
        nftMedia.address,
        BigNumber.from("1"),
        seller.address,
        ONE_ETH,
        ethers.constants.AddressZero,
        ONE_ETH.div(4),
        buyer.address,
        0,
        0,
        buyer.address,
      ];

      const currentOwner = await nftMedia.ownerOf(tokenId);
      expect(currentOwner).to.eq(seller.address);
    });

    it("Should revert if the price conversion value is above the slippage", async () => {
      const order = [
        uuid,
        tokenId,
        nftMedia.address,
        BigNumber.from("1"),
        seller.address,
        ONE_ETH,
        ethers.constants.AddressZero,
        ONE_ETH.div(4),
        buyer.address,
        1147,
        1,
        buyer.address,
      ];
      marketPlace.connect(seller).generateOrder(order);
      const signParam = order.slice(0, 7);
      const hash = soliditySha3(
        uuid,
        1,
        nftMedia.address,
        1,
        seller.address,
        1*10**18,
        ethers.constants.AddressZero,
        seller.address
        )
       await marketPlace.connect(seller).generateOrder(order);
      await expect(
        marketPlace
          .connect(buyer)
          .buy(order,hash,{ value: ONE_ETH.add(tax) })
      ).to.be.rejectedWith(
        Error,
        "Amount should be equal with the price with slippage"
      );
    });

    it("Should be able to buy the token using valid information", async () => {
      const order = [
        uuid,
        tokenId,
        nftMedia.address,
        BigNumber.from("1"),
        seller.address,
        ONE_ETH,
        ethers.constants.AddressZero,
        tax,
        buyer.address,
        1147,
        2,
        buyer.address,
      ];
      const signParam = order.slice(0, 7);
      const hash = soliditySha3(
        uuid,
        1,
        nftMedia.address,
        1,
        seller.address,
        1*10**18,
        ethers.constants.AddressZero,
        seller.address
        )
       await marketPlace.connect(seller).generateOrder(order);

      const buyTx = await marketPlace
        .connect(buyer)
        .buy(order,hash, { value: ONE_ETH.add(tax) });
      await buyTx.wait();
      expect(await nftMedia.ownerOf(tokenId)).to.eq(buyer.address);
    });

    it("should revert if the sent eth value doesn't match with the fixedPrice ", async () => {
      const order = [
        uuid,
        tokenId,
        nftMedia.address,
        BigNumber.from("1"),
        seller.address,
        ONE_ETH,
        ethers.constants.AddressZero,
        tax,
        buyer.address,
        1147,
        2,
        buyer.address,
      ];
      const signParam = order.slice(0, 7);
      const hash = soliditySha3(
        uuid,
        1,
        nftMedia.address,
        1,
        seller.address,
        1*10**18,
        ethers.constants.AddressZero,
        seller.address
        )
       await marketPlace.connect(seller).generateOrder(order);
      await expect(
        marketPlace.connect(buyer).buy(order,hash )
      ).to.be.rejectedWith(
        Error,
        "Sent ETH Value does not match specified buy amount"
      );
    });

    it("Should settle the tax fee", async () => {
      const platformBalanceBefore = await ethers.provider.getBalance(
        platform.address
      );
      const order = [
        uuid,
        tokenId,
        nftMedia.address,
        BigNumber.from("1"),
        seller.address,
        ONE_ETH,
        ethers.constants.AddressZero,
        tax,
        buyer.address,
        1147,
        2,
        buyer.address,
      ];
      const hash = soliditySha3(
        uuid,
        1,
        nftMedia.address,
        1,
        seller.address,
        1*10**18,
        ethers.constants.AddressZero,
        seller.address
        )
       await marketPlace.connect(seller).generateOrder(order);
      const buyTx = await marketPlace
        .connect(buyer)
        .buy(order,hash, { value: ONE_ETH.add(tax) });
      await buyTx.wait();
      expect(await nftMedia.ownerOf(tokenId)).to.eq(buyer.address);

      const after = platformBalanceBefore.add(
        ONE_ETH.mul(platformFeePercentage).div(100)
      );
      const afterTax = after.add(tax);
      const current = (
        await ethers.provider.getBalance(platform.address)
      ).toString();
      expect(current).to.eql(afterTax.toString());
    });
    it("Should settle the platform fee", async () => {
      const platformBalanceBefore = await ethers.provider.getBalance(
        platform.address
      );
      const order = [
        uuid,
        tokenId,
        nftMedia.address,
        BigNumber.from("1"),
        seller.address,
        ONE_ETH,
        ethers.constants.AddressZero,
        0,
        buyer.address,
        1147,
        2,
        buyer.address,
      ];
      const hash = soliditySha3(
        uuid,
        1,
        nftMedia.address,
        1,
        seller.address,
        1*10**18,
        ethers.constants.AddressZero,
        seller.address
        )
       await marketPlace.connect(seller).generateOrder(order);
      const buyTx = await marketPlace
        .connect(buyer)
        .buy(order,hash, { value: ONE_ETH });
      await buyTx.wait();
      expect(await nftMedia.ownerOf(tokenId)).to.eq(buyer.address);
      const after = platformBalanceBefore.add(
        ONE_ETH.mul(platformFeePercentage).div(100)
      );
      const current = (
        await ethers.provider.getBalance(platform.address)
      ).toString();
      expect(current).to.eql(after.toString());
    });

    it("Should settle the royalty fee", async () => {
      const royaltyrecipient1BalanceBefore = await ethers.provider.getBalance(
        royaltyRecipient1.address
      );
      console.log(royaltyrecipient1BalanceBefore.toString());
      
      const royaltyrecipient2BalanceBefore = await ethers.provider.getBalance(
        royaltyRecipient2.address
      );
      console.log(royaltyrecipient2BalanceBefore.toString());
      const order = [
        uuid,
        tokenId,
        nftMedia.address,
        BigNumber.from("1"),
        seller.address,
        ONE_ETH,
        ethers.constants.AddressZero,
        0,
        buyer.address,
        1147,
        2,
        buyer.address,
      ];
      const signParam = order.slice(0, 7);
      const hash = soliditySha3(
        uuid,
        1,
        nftMedia.address,
        1,
        seller.address,
        1*10**18,
        ethers.constants.AddressZero,
        seller.address
        )
       await marketPlace.connect(seller).generateOrder(order);
      const buyTx = await marketPlace
        .connect(buyer)
        .buy(order,hash, { value: ONE_ETH });
      await buyTx.wait();
      expect(await nftMedia.ownerOf(tokenId)).to.eq(buyer.address);
      let platformFee = ONE_ETH.mul(platformFeePercentage).div(100);
      platformFee = ONE_ETH.sub(platformFee);
      let after = royaltyrecipient1BalanceBefore.add(
        platformFee.mul(5).div(100)
      );
      
      let current = (
        await ethers.provider.getBalance(royaltyRecipient1.address)
      ).toString();

      expect(current).to.eql(after.toString());

      after = royaltyrecipient2BalanceBefore.add(platformFee.mul(2).div(100));

      current = (
        await ethers.provider.getBalance(royaltyRecipient2.address)
      ).toString();
      
      expect(current).to.eql(after.toString());
    });

    it("should transfer the ownerProfit to the seller", async () => {
      const platformBalanceBefore = await weth.balanceOf(
        platform.address
      );
      const amount = BigNumber.from(10).pow(18);
      await weth
      .connect(buyer)
      .approve(marketPlace.address, amount);
      await weth
      .connect(buyer).deposit({ value: ONE_ETH });
      
      const order = [
        uuid,
        tokenId,
        nftMedia.address,
        BigNumber.from("1"),
        seller.address,
        ONE_ETH,
        weth.address,
        0,
        buyer.address,
        1147,
        2,
        buyer.address,
      ];
      const hash = soliditySha3(
        uuid,
        1,
        nftMedia.address,
        1,
        seller.address,
        1*10**18,
        weth.address,
        seller.address
        )
       await marketPlace.connect(seller).generateOrder(order);
      const buyTx = await marketPlace
        .connect(buyer)
        .buy(order,hash);
        await buyTx.wait();
        expect(await nftMedia.ownerOf(tokenId)).to.eq(buyer.address);
        let platformFee = ONE_ETH.mul(platformFeePercentage).div(100);
  
        platformFee = ONE_ETH.sub(platformFee);
  
        let after = await weth.balanceOf(royaltyRecipient1.address);
  
        let recipient_1_fee = platformFee.mul(5).div(100);
  
        expect(recipient_1_fee.toString()).to.eql(after.toString());
  
        after = await weth.balanceOf(royaltyRecipient2.address);
  
        let recipient_2_fee = platformFee.mul(2).div(100);
  
        expect(recipient_2_fee.toString()).to.eql(after.toString());
  
        let sellerProfit = platformFee.sub(recipient_1_fee).sub(recipient_2_fee);
  
        const sellerBalance = await weth.balanceOf(seller.address);
        
        expect(sellerProfit.toString()).to.eql(sellerBalance.toString());
    });
  });
  describe("Offer Flow", () => {

    it("should revert if the token contract does not support the ERC721 interface", async () => {
      const quantity = 1;
      const signature = "0x00";
      const bad = await (await ethers.getContractFactory("BadERC721")).deploy();
      const order = [
        uuid,
        tokenId,
        bad.address,
        BigNumber.from("1"),
        buyer.address,
        ONE_ETH,
        ethers.constants.AddressZero,
        tax,
        buyer.address,
        1147,
        2,
        buyer.address,
      ]
      const signParam = order.slice(0, 7);
      const hash = ethers.utils.solidityKeccak256(
        ["bytes"],
        [
          ethers.utils.solidityPack(
            [
              "string",
              "uint256",
              "address",
              "uint256",
              "address",
              "uint256",
              "address",
            ],
            signParam
          ),
        ]
      );
      await expect(
        marketPlace
          .connect(buyer)
          .sell(
            order,
            hash
          )
      ).to.be.rejectedWith(
        Error,
        "tokenContract does not support ERC721 or ERC1155 interface"
      );
    });

    it("should revert if the uuid is not verified", async () => {
      
      const order = [
        123456,
        tokenId,
        nftMedia.address,
        BigNumber.from("1"),
        seller.address,
        ONE_ETH,
        ethers.constants.AddressZero,
        ONE_ETH.div(4),
        buyer.address,
        0,
        0,
        buyer.address,
      ];

      const signParam = order.slice(0, 7);
      const hash = soliditySha3(
        uuid,
        1,
        nftMedia.address,
        1,
        seller.address,
        1*10**18,
        ethers.constants.AddressZero,
        buyer.address
        )
       await marketPlace.connect(buyer).generateOrder(order);

      await expect(
        marketPlace.connect(seller).sell(order,hash)
      ).to.be.rejectedWith(Error, "UnAuthorised or UnApproved");
    });

    it("Should be able to fullfill the offer token using valid info", async () => {
      const amount = BigNumber.from(10).pow(18);
      await weth
      .connect(buyer)
      .approve(marketPlace.address, amount);
      await weth
      .connect(buyer).deposit({ value: ONE_ETH });

      const order = [
        uuid,
        tokenId,
        nftMedia.address,
        BigNumber.from("1"),
        seller.address,
        ONE_ETH,
        weth.address,
        0,
        ethers.constants.AddressZero,
        1147,
        2,
        buyer.address,
      ];
      await marketPlace.connect(buyer).generateOrder(order)
      const hash = soliditySha3(
        uuid,
        1,
        nftMedia.address,
        1,
        seller.address,
        1*10**18,
        weth.address,
        buyer.address
        )
       await marketPlace.connect(buyer).generateOrder(order);

      const buyTx = await marketPlace
        .connect(seller)
        .sell(order, hash);
      await buyTx.wait();
      expect(await nftMedia.ownerOf(tokenId)).to.eq(buyer.address);
    });

    it("Should settle the platform fee", async () => {
      const platformBalanceBefore = await weth.balanceOf(
        platform.address
      );
      const amount = BigNumber.from(10).pow(18);
      await weth
      .connect(buyer)
      .approve(marketPlace.address, amount);
      await weth
      .connect(buyer).deposit({ value: ONE_ETH });

      const order = [
        uuid,
        tokenId,
        nftMedia.address,
        BigNumber.from("1"),
        seller.address,
        ONE_ETH,
        weth.address,
        0,
        buyer.address,
        1147,
        2,
        buyer.address,
      ];
      await marketPlace.connect(buyer).generateOrder(order)
      const hash = soliditySha3(
        uuid,
        1,
        nftMedia.address,
        1,
        seller.address,
        1*10**18,
        weth.address,
        buyer.address
        )
       await marketPlace.connect(buyer).generateOrder(order);
      const buyTx = await marketPlace
        .connect(seller)
        .sell(order, hash);
      await buyTx.wait();
      expect(await nftMedia.ownerOf(tokenId)).to.eq(buyer.address);
      const after = await weth.balanceOf(platform.address);

      const platformFee = ONE_ETH.mul(platformFeePercentage).div(100).toString()        
      
      expect(platformFee).to.eql(after.sub(platformBalanceBefore).toString());
    });

    it("Should settle the royalty fee", async () => {
      const amount = BigNumber.from(10).pow(18);
      await weth
      .connect(buyer)
      .approve(marketPlace.address, amount);
      await weth
      .connect(buyer).deposit({ value: ONE_ETH });

      const order = [
        uuid,
        tokenId,
        nftMedia.address,
        BigNumber.from("1"),
        seller.address,
        ONE_ETH,
        weth.address,
        0,
        buyer.address,
        1147,
        2,
        buyer.address,
      ];
      await marketPlace.connect(buyer).generateOrder(order)
      const signParam = order.slice(0, 7);
      const hash = soliditySha3(
        uuid,
        1,
        nftMedia.address,
        1,
        seller.address,
        1*10**18,
        weth.address,
        buyer.address
        )
       await marketPlace.connect(buyer).generateOrder(order);
      const buyTx = await marketPlace
        .connect(seller)
        .sell(order, hash);
      await buyTx.wait();
      expect(await nftMedia.ownerOf(tokenId)).to.eq(buyer.address);
      let platformFee = ONE_ETH.mul(platformFeePercentage).div(100);
      platformFee = ONE_ETH.sub(platformFee);
      let after = await weth.balanceOf(royaltyRecipient1.address);

      let recipient_1_fee = platformFee.mul(5).div(100);

      expect(recipient_1_fee.toString()).to.eql(after.toString());

      after = await weth.balanceOf(royaltyRecipient2.address);

      let recipient_2_fee = platformFee.mul(2).div(100);

      expect(recipient_2_fee.toString()).to.eql(after.toString());
    });

    it("should transfer the ownerProfit to the seller", async () => {
      const platformBalanceBefore = await weth.balanceOf(
        platform.address
      );
      const amount = BigNumber.from(10).pow(18);
      await weth
      .connect(buyer)
      .approve(marketPlace.address, amount);
      await weth
      .connect(buyer).deposit({ value: ONE_ETH });
      
      const order = [
        uuid,
        tokenId,
        nftMedia.address,
        BigNumber.from("1"),
        seller.address,
        ONE_ETH,
        weth.address,
        0,
        buyer.address,
        1147,
        2,
        buyer.address,
      ];
      await marketPlace.connect(buyer).generateOrder(order)
      const hash = soliditySha3(
        uuid,
        1,
        nftMedia.address,
        1,
        seller.address,
        1*10**18,
        weth.address,
        buyer.address
        )
       await marketPlace.connect(buyer).generateOrder(order);
      const buyTx = await marketPlace
        .connect(seller)
        .sell(order, hash);
      await buyTx.wait();
      expect(await nftMedia.ownerOf(tokenId)).to.eq(buyer.address);
      let platformFee = ONE_ETH.mul(platformFeePercentage).div(100);

      platformFee = ONE_ETH.sub(platformFee);

      let after = await weth.balanceOf(royaltyRecipient1.address);

      let recipient_1_fee = platformFee.mul(5).div(100);

      expect(recipient_1_fee.toString()).to.eql(after.toString());

      after = await weth.balanceOf(royaltyRecipient2.address);

      let recipient_2_fee = platformFee.mul(2).div(100);

      expect(recipient_2_fee.toString()).to.eql(after.toString());

      let sellerProfit = platformFee.sub(recipient_1_fee).sub(recipient_2_fee);

      const sellerBalance = await weth.balanceOf(seller.address);
      
      expect(sellerProfit.toString()).to.eql(sellerBalance.toString());
    });
  });
  describe("Auction Flow", () => {
    it("should revert if the token contract does not support the ERC721 interface", async () => {
      const quantity = 1;
      const signature = "0x00";
      const bad = await (await ethers.getContractFactory("BadERC721")).deploy();
      const order = [
        uuid,
        tokenId,
        bad.address,
        quantity,
        seller.address,
        ONE_ETH,
        ethers.constants.AddressZero,
        tax,
        ethers.constants.AddressZero,
        0,
        0,
        ethers.constants.AddressZero,
      ]     
      const hash1 = soliditySha3(
        uuid,
        1,
        nftMedia.address,
        1,
        seller.address,
        1*10**18,
        ethers.constants.AddressZero,
        seller.address
        )
      const hash2 = soliditySha3(
        uuid,
        1,
        nftMedia.address,
        1,
        seller.address,
        1*10**18,
        ethers.constants.AddressZero,
        buyer.address
        )  
       await marketPlace.connect(seller).generateOrder(order);
       await marketPlace.connect(buyer).generateOrder(order);
      
      await expect(
        marketPlace
          .connect(buyer)
          .executeAuction(
            order,
            hash1,
            hash2,
            [
              [buyer.address, ONE_ETH, ethers.constants.AddressZero],
              [anonymousUser.address, ONE_ETH, ethers.constants.AddressZero],
            ]
          )
      ).to.be.rejectedWith(
        Error,
        "tokenContract does not support ERC721 or ERC1155 interface"
      );
    });

    it("should revert if the uuid is not verified", async () => {
      const order = [
        12345,
        tokenId,
        nftMedia.address,
        BigNumber.from("1"),
        seller.address,
        ONE_ETH,
        ethers.constants.AddressZero,
        tax,
        buyer.address,
        0,
        0,
        buyer.address,
      ];
      const hash1 = soliditySha3(
        uuid,
        1,
        nftMedia.address,
        1,
        seller.address,
        1*10**18,
        ethers.constants.AddressZero,
        seller.address
        )
      const hash2 = soliditySha3(
        uuid,
        1,
        nftMedia.address,
        1,
        seller.address,
        1*10**18,
        ethers.constants.AddressZero,
        buyer.address
        )  
       await marketPlace.connect(seller).generateOrder(order);
       await marketPlace.connect(buyer).generateOrder(order);
      const bidhistory = [
        [buyer.address, ONE_ETH, ethers.constants.AddressZero],
        [anonymousUser.address, ONE_ETH, ethers.constants.AddressZero],
      ];
      await expect(
        marketPlace
          .connect(buyer)
          .executeAuction(order, hash1,hash2, bidhistory)
      ).to.be.rejectedWith(Error, "UnAuthorised or UnApproved");
    });

    it("should be equal to the same tokenOwner even after the sale started", async () => {
      const order = [
        uuid,
        tokenId,
        nftMedia.address,
        BigNumber.from("1"),
        seller.address,
        ONE_ETH,
        ethers.constants.AddressZero,
        tax,
        buyer.address,
        0,
        0,
        ethers.constants.AddressZero,
      ];
      const signParam = order.slice(0, 7);
      const hash = ethers.utils.solidityKeccak256(
        ["bytes"],
        [
          ethers.utils.solidityPack(
            [
              "string",
              "uint256",
              "address",
              "uint256",
              "address",
              "uint256",
              "address",
            ],
            signParam
          ),
        ]
      );
      const currentOwner = await nftMedia.ownerOf(tokenId);
      expect(currentOwner).to.eq(seller.address);
    });

    it("Should revert if the price conversion value is above the slippage", async () => {
      const order = [
        uuid,
        tokenId,
        nftMedia.address,
        BigNumber.from("1"),
        seller.address,
        ONE_ETH,
        ethers.constants.AddressZero,
        tax,
        buyer.address,
        1147,
        1,
        buyer.address,
      ];

      const hash1 = soliditySha3(
        uuid,
        1,
        nftMedia.address,
        1,
        seller.address,
        1*10**18,
        ethers.constants.AddressZero,
        seller.address
        )
      const hash2 = soliditySha3(
        uuid,
        1,
        nftMedia.address,
        1,
        seller.address,
        1*10**18,
        ethers.constants.AddressZero,
        buyer.address
        )  
       await marketPlace.connect(seller).generateOrder(order);
       await marketPlace.connect(buyer).generateOrder(order);

      const bidhistory = [
        [buyer.address, ONE_ETH, ethers.constants.AddressZero],
        [anonymousUser.address, ONE_ETH, ethers.constants.AddressZero],
      ];

      await expect(
        marketPlace
          .connect(buyer)
          .executeAuction(order,hash1,hash2, bidhistory, {
            value: ONE_ETH.add(tax),
          })
      ).to.be.rejectedWith(
        Error,
        "Amount should be equal with the price with slippage"
      );
    });

    it("Should be able to buy the token using valid information", async () => {
      const order = [
        uuid,
        tokenId,
        nftMedia.address,
        BigNumber.from("1"),
        seller.address,
        ONE_ETH,
        ethers.constants.AddressZero,
        tax,
        buyer.address,
        1147,
        2,
        buyer.address,
      ];
      const hash1 = soliditySha3(
        uuid,
        1,
        nftMedia.address,
        1,
        seller.address,
        1*10**18,
        ethers.constants.AddressZero,
        seller.address
        )
      const hash2 = soliditySha3(
        uuid,
        1,
        nftMedia.address,
        1,
        seller.address,
        1*10**18,
        ethers.constants.AddressZero,
        buyer.address
        )  
       await marketPlace.connect(seller).generateOrder(order);
       await marketPlace.connect(buyer).generateOrder(order);
      const bidhistory = [
        [anonymousUser.address, ONE_ETH, ethers.constants.AddressZero],
        [buyer.address, ONE_ETH, ethers.constants.AddressZero],
        [anonymousUser.address, ONE_ETH, ethers.constants.AddressZero],
        [anonymousUser.address, ONE_ETH, ethers.constants.AddressZero],
        [anonymousUser.address, ONE_ETH, ethers.constants.AddressZero],
        [anonymousUser.address, ONE_ETH, ethers.constants.AddressZero],
        [anonymousUser.address, ONE_ETH, ethers.constants.AddressZero],
        [anonymousUser.address, ONE_ETH, ethers.constants.AddressZero],
        [anonymousUser.address, ONE_ETH, ethers.constants.AddressZero],
        [anonymousUser.address, ONE_ETH, ethers.constants.AddressZero],
      ];
      const buyTx = await marketPlace
        .connect(buyer)
        .executeAuction(order,hash1,hash2 , bidhistory, {
          value: ONE_ETH.add(tax),
        });
      await buyTx.wait();
      expect(await nftMedia.ownerOf(tokenId)).to.eq(buyer.address);
    });

    it("Should settle the tax fee", async () => {
      const platformBalanceBefore = await ethers.provider.getBalance(
        platform.address
      );
      const order = [
        uuid,
        tokenId,
        nftMedia.address,
        BigNumber.from("1"),
        seller.address,
        ONE_ETH,
        ethers.constants.AddressZero,
        tax,
        buyer.address,
        1147,
        2,
        buyer.address,
      ];
      const hash1 = soliditySha3(
        uuid,
        1,
        nftMedia.address,
        1,
        seller.address,
        1*10**18,
        ethers.constants.AddressZero,
        seller.address
        )
      const hash2 = soliditySha3(
        uuid,
        1,
        nftMedia.address,
        1,
        seller.address,
        1*10**18,
        ethers.constants.AddressZero,
        buyer.address
        )  
       await marketPlace.connect(seller).generateOrder(order);
       await marketPlace.connect(buyer).generateOrder(order);

      const bidhistory = [
        [anonymousUser.address, ONE_ETH, ethers.constants.AddressZero],
        [buyer.address, ONE_ETH, ethers.constants.AddressZero],
        [anonymousUser.address, ONE_ETH, ethers.constants.AddressZero],
        [anonymousUser.address, ONE_ETH, ethers.constants.AddressZero],
        [anonymousUser.address, ONE_ETH, ethers.constants.AddressZero],
        [anonymousUser.address, ONE_ETH, ethers.constants.AddressZero],
        [anonymousUser.address, ONE_ETH, ethers.constants.AddressZero],
        [anonymousUser.address, ONE_ETH, ethers.constants.AddressZero],
        [anonymousUser.address, ONE_ETH, ethers.constants.AddressZero],
        [anonymousUser.address, ONE_ETH, ethers.constants.AddressZero],
      ];
      const buyTx = await marketPlace
        .connect(buyer)
        .executeAuction(order, hash1,hash2, bidhistory, {
          value: ONE_ETH.add(tax),
        });
      await buyTx.wait();
      expect(await nftMedia.ownerOf(tokenId)).to.eq(buyer.address);
      const after = platformBalanceBefore.add(
        ONE_ETH.mul(platformFeePercentage).div(100)
      );
      const current = (
        await ethers.provider.getBalance(platform.address)
      ).toString();
      expect(current).to.eql(after.add(tax).toString());
    });

    it("Should settle the platform fee", async () => {
      const platformBalanceBefore = await ethers.provider.getBalance(
        platform.address
      );
      const order = [
        uuid,
        tokenId,
        nftMedia.address,
        BigNumber.from("1"),
        seller.address,
        ONE_ETH,
        ethers.constants.AddressZero,
        tax,
        buyer.address,
        1147,
        2,
        buyer.address,
      ];
      const hash1 = soliditySha3(
        uuid,
        1,
        nftMedia.address,
        1,
        seller.address,
        1*10**18,
        ethers.constants.AddressZero,
        seller.address
        )
      const hash2 = soliditySha3(
        uuid,
        1,
        nftMedia.address,
        1,
        seller.address,
        1*10**18,
        ethers.constants.AddressZero,
        buyer.address
        )  
       await marketPlace.connect(seller).generateOrder(order);
       await marketPlace.connect(buyer).generateOrder(order);
      const bidhistory = [
        [anonymousUser.address, ONE_ETH, ethers.constants.AddressZero],
        [buyer.address, ONE_ETH, ethers.constants.AddressZero],
        [anonymousUser.address, ONE_ETH, ethers.constants.AddressZero],
        [anonymousUser.address, ONE_ETH, ethers.constants.AddressZero],
        [anonymousUser.address, ONE_ETH, ethers.constants.AddressZero],
        [anonymousUser.address, ONE_ETH, ethers.constants.AddressZero],
        [anonymousUser.address, ONE_ETH, ethers.constants.AddressZero],
        [anonymousUser.address, ONE_ETH, ethers.constants.AddressZero],
        [anonymousUser.address, ONE_ETH, ethers.constants.AddressZero],
        [anonymousUser.address, ONE_ETH, ethers.constants.AddressZero],
      ];
      const buyTx = await marketPlace
        .connect(buyer)
        .executeAuction(order, hash1,hash2, bidhistory, {
          value: ONE_ETH.add(tax),
        });
      await buyTx.wait();
      expect(await nftMedia.ownerOf(tokenId)).to.eq(buyer.address);
      const after = platformBalanceBefore.add(
        ONE_ETH.mul(platformFeePercentage).div(100)
      );
      const afterTax = after.add(tax);
      const current = (
        await ethers.provider.getBalance(platform.address)
      ).toString();
      expect(current).to.eql(afterTax.toString());
    });

    it("Should settle the royalty fee", async () => {
      const royaltyrecipient1BalanceBefore = await ethers.provider.getBalance(
        royaltyRecipient1.address
      );
      const royaltyrecipient2BalanceBefore = await ethers.provider.getBalance(
        royaltyRecipient2.address
      );
      const order = [
        uuid,
        tokenId,
        nftMedia.address,
        BigNumber.from("1"),
        seller.address,
        ONE_ETH,
        ethers.constants.AddressZero,
        tax,
        buyer.address,
        1147,
        2,
        buyer.address,
      ];
      const hash1 = soliditySha3(
        uuid,
        1,
        nftMedia.address,
        1,
        seller.address,
        1*10**18,
        ethers.constants.AddressZero,
        seller.address
        )
      const hash2 = soliditySha3(
        uuid,
        1,
        nftMedia.address,
        1,
        seller.address,
        1*10**18,
        ethers.constants.AddressZero,
        buyer.address
        )  
       await marketPlace.connect(seller).generateOrder(order);
       await marketPlace.connect(buyer).generateOrder(order);
      const bidhistory = [
        [anonymousUser.address, ONE_ETH, ethers.constants.AddressZero],
        [buyer.address, ONE_ETH, ethers.constants.AddressZero],
        [anonymousUser.address, ONE_ETH, ethers.constants.AddressZero],
        [anonymousUser.address, ONE_ETH, ethers.constants.AddressZero],
        [anonymousUser.address, ONE_ETH, ethers.constants.AddressZero],
        [anonymousUser.address, ONE_ETH, ethers.constants.AddressZero],
        [anonymousUser.address, ONE_ETH, ethers.constants.AddressZero],
        [anonymousUser.address, ONE_ETH, ethers.constants.AddressZero],
        [anonymousUser.address, ONE_ETH, ethers.constants.AddressZero],
        [anonymousUser.address, ONE_ETH, ethers.constants.AddressZero],
      ];
      const buyTx = await marketPlace
        .connect(buyer)
        .executeAuction(order, hash1,hash2, bidhistory, {
          value: ONE_ETH.add(tax),
        });
      await buyTx.wait();
      expect(await nftMedia.ownerOf(tokenId)).to.eq(buyer.address);
      let platformFee = ONE_ETH.mul(platformFeePercentage).div(100);
      platformFee = ONE_ETH.sub(platformFee);
      let after = royaltyrecipient1BalanceBefore.add(
        platformFee.mul(5).div(100)
      );
      let current = (
        await ethers.provider.getBalance(royaltyRecipient1.address)
      ).toString();
      expect(current).to.eql(after.toString());
      after = royaltyrecipient2BalanceBefore.add(platformFee.mul(2).div(100));
      current = (
        await ethers.provider.getBalance(royaltyRecipient2.address)
      ).toString();
      expect(current).to.eql(after.toString());
    });

    it("should transfer the ownerProfit to the seller", async () => {
      const amount = BigNumber.from(10).pow(18);
      await weth
      .connect(buyer)
      .approve(marketPlace.address, amount);
      await weth
      .connect(buyer).deposit({ value: ONE_ETH });
      
      const order = [
        uuid,
        tokenId,
        nftMedia.address,
        BigNumber.from("1"),
        seller.address,
        ONE_ETH,
        weth.address,
        0,
        buyer.address,
        1147,
        2,
        buyer.address,
      ];
      const hash1 = soliditySha3(
        uuid,
        1,
        nftMedia.address,
        1,
        seller.address,
        1*10**18,
        weth.address,
        seller.address
        )
      const hash2 = soliditySha3(
        uuid,
        1,
        nftMedia.address,
        1,
        seller.address,
        1*10**18,
        weth.address,
        buyer.address
        )  
       await marketPlace.connect(seller).generateOrder(order);
       await marketPlace.connect(buyer).generateOrder(order);
      const bidhistory = [
        [anonymousUser.address, ONE_ETH, ethers.constants.AddressZero],
        [buyer.address, ONE_ETH, ethers.constants.AddressZero],
        [anonymousUser.address, ONE_ETH, ethers.constants.AddressZero],
        [anonymousUser.address, ONE_ETH, ethers.constants.AddressZero],
        [anonymousUser.address, ONE_ETH, ethers.constants.AddressZero],
        [anonymousUser.address, ONE_ETH, ethers.constants.AddressZero],
        [anonymousUser.address, ONE_ETH, ethers.constants.AddressZero],
        [anonymousUser.address, ONE_ETH, ethers.constants.AddressZero],
        [anonymousUser.address, ONE_ETH, ethers.constants.AddressZero],
        [anonymousUser.address, ONE_ETH, ethers.constants.AddressZero],
      ];

      const buyTx = await marketPlace
        .connect(buyer)
        .executeAuction(order, hash1, hash2, bidhistory);
      await buyTx.wait();
      expect(await nftMedia.ownerOf(tokenId)).to.eq(buyer.address);
      let platformFee = ONE_ETH.mul(platformFeePercentage).div(100);

      platformFee = ONE_ETH.sub(platformFee);

      let after = await weth.balanceOf(royaltyRecipient1.address);

      let recipient_1_fee = platformFee.mul(5).div(100);

      expect(recipient_1_fee.toString()).to.eql(after.toString());

      after = await weth.balanceOf(royaltyRecipient2.address);

      let recipient_2_fee = platformFee.mul(2).div(100);

      expect(recipient_2_fee.toString()).to.eql(after.toString());

      let sellerProfit = platformFee.sub(recipient_1_fee).sub(recipient_2_fee);

      const sellerBalance = await weth.balanceOf(seller.address);
      
      expect(sellerProfit.toString()).to.eql(sellerBalance.toString());
    });
    it("Should be able to get the bidhistory details from the events emitted", async () => {
      const order = [
        uuid,
        tokenId,
        nftMedia.address,
        BigNumber.from("1"),
        seller.address,
        ONE_ETH,
        ethers.constants.AddressZero,
        tax,
        buyer.address,
        1147,
        2,
        buyer.address,
      ];
      const hash1 = soliditySha3(
        uuid,
        1,
        nftMedia.address,
        1,
        seller.address,
        1*10**18,
        ethers.constants.AddressZero,
        seller.address
        )
      const hash2 = soliditySha3(
        uuid,
        1,
        nftMedia.address,
        1,
        seller.address,
        1*10**18,
        ethers.constants.AddressZero,
        buyer.address
        )  
       await marketPlace.connect(seller).generateOrder(order);
       await marketPlace.connect(buyer).generateOrder(order);
      const bidhistory = [
        [anonymousUser.address, ONE_ETH, ethers.constants.AddressZero],
        [buyer.address, ONE_ETH, ethers.constants.AddressZero],
        [anonymousUser.address, ONE_ETH, ethers.constants.AddressZero],
        [anonymousUser.address, ONE_ETH, ethers.constants.AddressZero],
        [anonymousUser.address, ONE_ETH, ethers.constants.AddressZero],
        [anonymousUser.address, ONE_ETH, ethers.constants.AddressZero],
        [anonymousUser.address, ONE_ETH, ethers.constants.AddressZero],
        [anonymousUser.address, ONE_ETH, ethers.constants.AddressZero],
        [anonymousUser.address, ONE_ETH, ethers.constants.AddressZero],
        [anonymousUser.address, ONE_ETH, ethers.constants.AddressZero],
      ];
      const block = await ethers.provider.getBlockNumber();
      const buyTx = await marketPlace
        .connect(buyer)
        .executeAuction(order, hash1,hash2, bidhistory, {
          value: ONE_ETH.add(tax),
        });
      await buyTx.wait();
      expect(await nftMedia.ownerOf(tokenId)).to.eq(buyer.address);
      const events = await marketPlace.queryFilter(
        marketPlace.filters.AuctionClosed(
          null,
          null,
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
      const logDescription = marketPlace.interface.parseLog(events[0]);
      expect(logDescription.args.bidderlist[0].bidder).to.eq(bidhistory[0][0]);
      expect(logDescription.args.bidderlist[0].quotePrice.toString()).to.eq(
        bidhistory[0][1].toString()
      );
      expect(logDescription.args.bidderlist[0].paymentAddress).to.eq(
        bidhistory[0][2]
      );
      expect(logDescription.name).to.eq("AuctionClosed");
    });
  });
});
