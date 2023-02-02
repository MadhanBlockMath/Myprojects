import chai from "chai";
import chaiAsPromised from "chai-as-promised";
chai.use(chaiAsPromised);
const expect = chai.expect;
import { ethers } from "hardhat";
import { BigNumber, Contract, Signer } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

const ONE_ETH = ethers.utils.parseUnits("1", "ether") as BigNumber;

describe("Sotheby's Marketplace Contract (Test Suite)", () => {
  let nftMedia: Contract;
  let marketPlace: Contract;
  let weth: Contract;
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

    const marketplaceContract = await ethers.getContractFactory("sothebys");
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
        "MarketPlace"
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
    it("should revert if the token contract does not support the ERC721 interface", async () => {
      const quantity = 1;
      const signature = "0x00";
      const bad = await (await ethers.getContractFactory("BadERC721")).deploy();
      await expect(
        marketPlace
          .connect(buyer)
          .buy(
            [
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
            ],
            signature,ethers.constants.AddressZero,
          )
      ).to.be.rejectedWith(
        Error,
        "tokenContract does not support ERC721 or ERC1155 interface"
      );
    });

    it("should revert if the signature is not verified", async () => {
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
      const signParam = order.slice(0, 7);
      const hashedMessage = ethers.utils.solidityKeccak256(
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
      const sellerSignature = await anonymousUser.signMessage(hashedMessage);

      await expect(
        marketPlace.connect(buyer).buy(order, sellerSignature,ethers.constants.AddressZero,{ value: ONE_ETH.add(tax) })
      ).to.be.rejectedWith(Error, "Invalid seller signature");
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
      const signParam = order.slice(0, 7);
      const hashedMessage = ethers.utils.solidityKeccak256(
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
      const sellerSignature = await anonymousUser.signMessage(hashedMessage);
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
        ethers.utils.parseUnits("1147", "ether") as BigNumber,
        1,
        buyer.address,
      ];

      const signParam = order.slice(0, 7);
      const hashedMessage = ethers.utils.solidityKeccak256(
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
      const sellerSignature = await seller.signMessage(
        ethers.utils.arrayify(hashedMessage)
      );
      await expect(
        marketPlace
          .connect(buyer)
          .buy(order, sellerSignature,ethers.constants.AddressZero,{ value: ONE_ETH.add(tax) })
      ).to.be.rejectedWith(Error, "quotePrice with slippage is less than the fixedPrice");
    });
    it("should revert if the msg.sender is not the buyer ", async () => {
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
        ethers.utils.parseUnits("1147", "ether") as BigNumber,
        2,
        buyer.address,
      ];
      const signParam = order.slice(0, 7);
      const hashedMessage = ethers.utils.solidityKeccak256(
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
      const sellerSignature = await seller.signMessage(
        ethers.utils.arrayify(hashedMessage)
      );
      await expect(
        marketPlace
          .connect(anonymousUser)
          .buy(order, sellerSignature,ethers.constants.AddressZero, { value: ONE_ETH.add(tax) })
      ).to.be.rejectedWith(Error, "msg.sender should be the buyer");
    });
    it("should revert if the msg.sender is not the whitelisted buyer if whitelist address is added", async () => {
      const order = [
        uuid,
        tokenId,
        nftMedia.address,
        BigNumber.from("1"),
        seller.address,
        ONE_ETH,
        ethers.constants.AddressZero,
        ONE_ETH.div(4),
        anonymousUser.address,
        ethers.utils.parseUnits("1147", "ether") as BigNumber,
        2,
        buyer.address,
      ];
      const signParam = order.slice(0, 7);
      const hashedMessage = ethers.utils.solidityKeccak256(
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
      const sellerSignature = await seller.signMessage(
        ethers.utils.arrayify(hashedMessage)
      );
      await expect(
        marketPlace
          .connect(buyer)
          .buy(order, sellerSignature,ethers.constants.AddressZero, { value: ONE_ETH.add(tax) })
      ).to.be.rejectedWith(Error, "msg.sender should be the whitelisted buyer");
    });
    it("should revert if the uuid is already used", async () => {
      let order = [
        uuid,
        tokenId,
        nftMedia.address,
        BigNumber.from("1"),
        seller.address,
        ONE_ETH,
        ethers.constants.AddressZero,
        ONE_ETH.div(4),
        buyer.address,
        ethers.utils.parseUnits("1147", "ether") as BigNumber,
        2,
        buyer.address,
      ];
      let signParam = order.slice(0, 7);
      let hashedMessage = ethers.utils.solidityKeccak256(
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
      let sellerSignature = await seller.signMessage(
        ethers.utils.arrayify(hashedMessage)
      );
      const buyTx = await marketPlace
        .connect(buyer)
        .buy(order, sellerSignature,ethers.constants.AddressZero, { value: ONE_ETH.add(tax) });
      await buyTx.wait();
      expect(await nftMedia.ownerOf(tokenId)).to.eq(buyer.address);
      order = [
        uuid,
        tokenId,
        nftMedia.address,
        BigNumber.from("1"),
        buyer.address,
        ONE_ETH,
        ethers.constants.AddressZero,
        ONE_ETH.div(4),
        seller.address,
        ethers.utils.parseUnits("1147", "ether") as BigNumber,
        2,
        seller.address,
      ];
      signParam = order.slice(0, 7);
      hashedMessage = ethers.utils.solidityKeccak256(
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
      sellerSignature = await buyer.signMessage(
        ethers.utils.arrayify(hashedMessage)
      );
      await expect(
        marketPlace
          .connect(seller)
          .buy(order, sellerSignature,ethers.constants.AddressZero, { value: ONE_ETH.add(tax) })
      ).to.be.rejectedWith(Error, "UUID already used");
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
        ONE_ETH.div(4),
        buyer.address,
        ethers.utils.parseUnits("1147", "ether") as BigNumber,
        2,
        buyer.address,
      ];
      const signParam = order.slice(0, 7);
      const hashedMessage = ethers.utils.solidityKeccak256(
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
      const sellerSignature = await seller.signMessage(
        ethers.utils.arrayify(hashedMessage)
      );
      const buyTx = await marketPlace
        .connect(buyer)
        .buy(order, sellerSignature,ethers.constants.AddressZero, { value: ONE_ETH.add(tax) });
      await buyTx.wait();
      expect(await nftMedia.ownerOf(tokenId)).to.eq(buyer.address);
    });
    it("Should be able to buy the token using valid information ==> in WETH ==> from ETH", async () => {
      const order = [
        uuid,
        tokenId,
        nftMedia.address,
        BigNumber.from("1"),
        seller.address,
        ONE_ETH,
        weth.address,
        ONE_ETH.div(4),
        buyer.address,
        ethers.utils.parseUnits("1147", "ether") as BigNumber,
        2,
        buyer.address,
      ];
      const signParam = order.slice(0, 7);
      const hashedMessage = ethers.utils.solidityKeccak256(
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
      const sellerSignature = await seller.signMessage(
        ethers.utils.arrayify(hashedMessage)
      );
      const buyTx = await marketPlace
        .connect(buyer)
        .buy(order, sellerSignature,ethers.constants.AddressZero, { value: ONE_ETH.add(tax) });
      await buyTx.wait();
      expect(await nftMedia.ownerOf(tokenId)).to.eq(buyer.address);
    });
    it("Should be able to buy the token using valid information ==> in ETH ==>from WETH", async () => {
      await weth.connect(buyer).approve(marketPlace.address, ONE_ETH.add(tax));
      await weth.connect(buyer).deposit({ value: ONE_ETH.add(tax) });
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
        ethers.utils.parseUnits("1147", "ether") as BigNumber,
        2,
        buyer.address,
      ];
      const signParam = order.slice(0, 7);
      const hashedMessage = ethers.utils.solidityKeccak256(
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
      const sellerSignature = await seller.signMessage(
        ethers.utils.arrayify(hashedMessage)
      );
      const buyTx = await marketPlace
        .connect(buyer)
        .buy(order, sellerSignature,weth.address, /*{ value: ONE_ETH.add(tax) }*/);
      await buyTx.wait();
      expect(await nftMedia.ownerOf(tokenId)).to.eq(buyer.address);
    });
    it("Should be able to buy the token using valid information ==> in WETH ==>from WETH", async () => {
      await weth.connect(buyer).approve(marketPlace.address, ONE_ETH.add(tax));
      await weth.connect(buyer).deposit({ value: ONE_ETH.add(tax) });
      const order = [
        uuid,
        tokenId,
        nftMedia.address,
        BigNumber.from("1"),
        seller.address,
        ONE_ETH,
        weth.address,
        ONE_ETH.div(4),
        buyer.address,
        ethers.utils.parseUnits("1147", "ether") as BigNumber,
        2,
        buyer.address,
      ];
      const signParam = order.slice(0, 7);
      const hashedMessage = ethers.utils.solidityKeccak256(
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
      const sellerSignature = await seller.signMessage(
        ethers.utils.arrayify(hashedMessage)
      );
      let buyTx = await marketPlace
        .connect(buyer)
        .buy(order, sellerSignature,weth.address, /*{ value: ONE_ETH.add(tax) }*/);
      await buyTx.wait();
      
      expect(await nftMedia.ownerOf(tokenId)).to.eq(buyer.address);
    });
    it("Should settle the tax fee", async () => {
      // await weth.connect(buyer).approve(marketPlace.address, ONE_ETH.add(tax));
      // await weth.connect(buyer).deposit({ value: ONE_ETH.add(tax) });
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
        ONE_ETH.div(4),
        buyer.address,
        ethers.utils.parseUnits("1147", "ether") as BigNumber,
        2,
        buyer.address,
      ];
      const signParam = order.slice(0, 7);
      const hashedMessage = ethers.utils.solidityKeccak256(
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
      const sellerSignature = await seller.signMessage(
        ethers.utils.arrayify(hashedMessage)
      );

      const buyTx = await marketPlace
        .connect(buyer)
        .buy(order, sellerSignature,ethers.constants.AddressZero, { value: ONE_ETH.add(tax) });
      await buyTx.wait();
      expect(await nftMedia.ownerOf(tokenId)).to.eq(buyer.address);

      // let platformFee = ONE_ETH.mul(platformFeePercentage).div(100);
      // let after = await weth.balanceOf(platform.address);
      // expect(platformFee.add(tax).toString()).to.eql(after.toString());
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
      // const amount = BigNumber.from(10).pow(18);
      // await weth.connect(buyer).approve(marketPlace.address, amount);
      // await weth.connect(buyer).deposit({ value: ONE_ETH });
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
        ethers.utils.parseUnits("1147", "ether") as BigNumber,
        2,
        buyer.address,
      ];
      const signParam = order.slice(0, 7);
      const hashedMessage = ethers.utils.solidityKeccak256(
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
      const sellerSignature = await seller.signMessage(
        ethers.utils.arrayify(hashedMessage)
      );

      const buyTx = await marketPlace
        .connect(buyer)
        .buy(order, sellerSignature,ethers.constants.AddressZero, { value: ONE_ETH.add(tax) });
      await buyTx.wait();
      expect(await nftMedia.ownerOf(tokenId)).to.eq(buyer.address);

    //   let platformFee = ONE_ETH.mul(platformFeePercentage).div(100);
    //   let after = await weth.balanceOf(platform.address);
    //   expect(platformFee.toString()).to.eql(after.toString());
    const after = platformBalanceBefore.add(
      ONE_ETH.mul(platformFeePercentage).div(100)
    );
    const current = (
      await ethers.provider.getBalance(platform.address)
    ).toString();
    expect(current).to.eql(after.toString());
  
    });

    it("Should settle the royalty fee", async () => {
      // const amount = BigNumber.from(10).pow(18);
      // await weth.connect(buyer).approve(marketPlace.address, amount);
      // await weth.connect(buyer).deposit({ value: ONE_ETH });
      const royaltyrecipient1BalanceBefore = await ethers.provider.getBalance(
        royaltyRecipient1.address
      );
      console.log(royaltyrecipient1BalanceBefore.toString());
      
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
        0,
        buyer.address,
        ethers.utils.parseUnits("1147", "ether") as BigNumber,
        2,
        buyer.address,
      ];
      const signParam = order.slice(0, 7);
      const hashedMessage = ethers.utils.solidityKeccak256(
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
      const sellerSignature = await seller.signMessage(
        ethers.utils.arrayify(hashedMessage)
      );

      const buyTx = await marketPlace
        .connect(buyer)
        .buy(order, sellerSignature,ethers.constants.AddressZero, { value: ONE_ETH.add(tax) });
      await buyTx.wait();
      expect(await nftMedia.ownerOf(tokenId)).to.eq(buyer.address);

      // let platformFee = ONE_ETH.mul(platformFeePercentage).div(100);
      // platformFee = ONE_ETH.sub(platformFee);

      // let after = await weth.balanceOf(royaltyRecipient1.address);
      // let recipient_1_fee = platformFee.mul(5).div(100);
      // expect(recipient_1_fee.toString()).to.eql(after.toString());

      // after = await weth.balanceOf(royaltyRecipient2.address);
      // let recipient_2_fee = platformFee.mul(2).div(100);
      // expect(recipient_2_fee.toString()).to.eql(after.toString());
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
      // const amount = BigNumber.from(10).pow(18);
      // await weth.connect(buyer).approve(marketPlace.address, amount);
      // await weth.connect(buyer).deposit({ value: ONE_ETH });
      
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
        ethers.utils.parseUnits("1147", "ether") as BigNumber,
        2,
        buyer.address,
      ];
      const signParam = order.slice(0, 7);
      const hashedMessage = ethers.utils.solidityKeccak256(
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
      const sellerSignature = await seller.signMessage(
        ethers.utils.arrayify(hashedMessage)
      );

      const buyTx = await marketPlace
        .connect(buyer)
        .buy(order, sellerSignature,ethers.constants.AddressZero, { value: ONE_ETH.add(tax) });
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
      await expect(
        marketPlace
          .connect(buyer)
          .sell(
            [
              uuid,
              tokenId,
              bad.address,
              BigNumber.from("1"),
              buyer.address,
              ONE_ETH,
              weth.address,
              tax,
              buyer.address,
              ethers.utils.parseUnits("1147", "ether") as BigNumber,
              2,
              buyer.address,
            ],
            signature,
            1660337510,
            ethers.constants.AddressZero
          )
      ).to.be.rejectedWith(
        Error,
        "tokenContract does not support ERC721 or ERC1155 interface"
      );
    });
    it("should revert if the msg.sender is not the owner of the token ", async () => {
      const order = [
        uuid,
        tokenId,
        nftMedia.address,
        BigNumber.from("1"),
        seller.address,
        ONE_ETH,
        weth.address,
        ONE_ETH.div(4),
        buyer.address,
        ethers.utils.parseUnits("1147", "ether") as BigNumber,
        2,
        buyer.address,
      ];
      const signParam = order.slice(0, 7);
      const hashedMessage = ethers.utils.solidityKeccak256(
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
      const buyerSignature = await buyer.signMessage(
        ethers.utils.arrayify(hashedMessage)
      );
      await expect(
        marketPlace
          .connect(anonymousUser)
          .sell(order, buyerSignature, 1666742631,ethers.constants.AddressZero,)
      ).to.be.rejectedWith(Error, "msg.sender should be token owner");
    });
    it("should revert if the msg.sender contains insufficient token quantity balance", async () => {
      const CREATOR_IMPLEMENTATION_ADDR = await ethers.getContractFactory(
        "ERC1155CreatorImplementation"
      );
      let creator_address = await CREATOR_IMPLEMENTATION_ADDR.deploy();
      await creator_address.deployed();

      const NFTMedia = await ethers.getContractFactory("Creator1155Proxy");
      let nftMedia1 = await NFTMedia.deploy(creator_address.address);
      nftMedia1 = await ethers.getContractAt(
        "ERC1155CreatorImplementation",
        nftMedia1.address
      );
      const receipt2 = await nftMedia1[
        "mintBaseNew(address[],uint256[],string[])"
      ](
        [seller.address],
        [5],
        [
          "https://gateway.arweave.net/TCrOsfGKrPEpIIIl4gm1ETjhjg-fCXdxk6Vwmd45NJg",
        ]
      );
      receipt2.wait();
      const order = [
        uuid,
        tokenId,
        nftMedia1.address,
        BigNumber.from("6"),
        seller.address,
        ONE_ETH,
        weth.address,
        ONE_ETH.div(4),
        buyer.address,
        ethers.utils.parseUnits("1147", "ether") as BigNumber,
        2,
        buyer.address,
      ];
      const signParam = order.slice(0, 7);
      const hashedMessage = ethers.utils.solidityKeccak256(
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
      const buyerSignature = await buyer.signMessage(
        ethers.utils.arrayify(hashedMessage)
      );
      await expect(
        marketPlace
          .connect(seller)
          .sell(order, buyerSignature, 1666742631, weth.address, )
      ).to.be.rejectedWith(Error, "Insufficient token balance");
    });
    it("should revert if the ERC1155 offer fullfiller by the token owner", async () => {
      await weth.connect(buyer).approve(marketPlace.address, ONE_ETH.add(tax));
      await weth.connect(buyer).deposit({ value: ONE_ETH.add(tax) });
      const CREATOR_IMPLEMENTATION_ADDR = await ethers.getContractFactory(
        "ERC1155CreatorImplementation"
      );
      let creator_address = await CREATOR_IMPLEMENTATION_ADDR.deploy();
      await creator_address.deployed();

      const NFTMedia = await ethers.getContractFactory("Creator1155Proxy");
      let nftMedia1 = await NFTMedia.deploy(creator_address.address);
      nftMedia1 = await ethers.getContractAt(
        "ERC1155CreatorImplementation",
        nftMedia1.address
      );
      const receipt2 = await nftMedia1[
        "mintBaseNew(address[],uint256[],string[])"
      ](
        [seller.address],
        [5],
        [
          "https://gateway.arweave.net/TCrOsfGKrPEpIIIl4gm1ETjhjg-fCXdxk6Vwmd45NJg",
        ]
      );
      receipt2.wait();
      await nftMedia1
        .connect(seller)
        .setApprovalForAll(marketPlace.address, true);
      const order = [
        uuid,
        tokenId,
        nftMedia1.address,
        BigNumber.from("5"),
        seller.address,
        ONE_ETH,
        weth.address,
        ONE_ETH.div(4),
        buyer.address,
        ethers.utils.parseUnits("1147", "ether") as BigNumber,
        2,
        buyer.address,
      ];
      const signParam = order.slice(0, 7);
      const hashedMessage = ethers.utils.solidityKeccak256(
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
      const buyerSignature = await buyer.signMessage(
        ethers.utils.arrayify(hashedMessage)
      );
      const buyTx = await marketPlace
        .connect(seller)
        .sell(order, buyerSignature, 1666742631, weth.address);
      await buyTx.wait();
      expect(
        (await nftMedia1.balanceOf(buyer.getAddress(), 1)).toString()
      ).to.eq("5");
    });
    it("should revert if the uuid is already used", async () => {
      await weth.connect(buyer).approve(marketPlace.address, ONE_ETH.add(tax));
      await weth.connect(buyer).deposit({ value: ONE_ETH.add(tax) });
      let order = [
        uuid,
        tokenId,
        nftMedia.address,
        BigNumber.from("1"),
        seller.address,
        ONE_ETH,
        weth.address,
        ONE_ETH.div(4),
        buyer.address,
        ethers.utils.parseUnits("1147", "ether") as BigNumber,
        2,
        buyer.address,
      ];
      let signParam = order.slice(0, 7);
      let hashedMessage = ethers.utils.solidityKeccak256(
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
      let buyerSignature = await buyer.signMessage(
        ethers.utils.arrayify(hashedMessage)
      );
      const buyTx = await marketPlace
        .connect(seller)
        .sell(order, buyerSignature, 1666742631, weth.address);
      await buyTx.wait();
      expect(await nftMedia.ownerOf(tokenId)).to.eq(buyer.address);
      await weth.connect(seller).approve(marketPlace.address, ONE_ETH.add(tax));
      await weth.connect(seller).deposit({ value: ONE_ETH.add(tax) });
      order = [
        uuid,
        tokenId,
        nftMedia.address,
        BigNumber.from("1"),
        buyer.address,
        ONE_ETH,
        weth.address,
        ONE_ETH.div(4),
        seller.address,
        ethers.utils.parseUnits("1147", "ether") as BigNumber,
        2,
        seller.address,
      ];
      signParam = order.slice(0, 7);
      hashedMessage = ethers.utils.solidityKeccak256(
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
      buyerSignature = await seller.signMessage(
        ethers.utils.arrayify(hashedMessage)
      );
      await expect(
        marketPlace
          .connect(buyer)
          .sell(order, buyerSignature, 1666742631, weth.address)
      ).to.be.rejectedWith(Error, "UUID already used");
    });
    it("should revert if the signature is not verified", async () => {
      await weth.connect(buyer).approve(marketPlace.address, ONE_ETH.add(tax));
      await weth.connect(buyer).deposit({ value: ONE_ETH.add(tax) });
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
        ethers.utils.parseUnits("1147", "ether") as BigNumber,
        2,
        buyer.address,
      ];
      const signParam = order.slice(0, 7);
      const hashedMessage = ethers.utils.solidityKeccak256(
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
      const buyerSignature = await anonymousUser.signMessage(hashedMessage);
      await expect(
        marketPlace.connect(seller).sell(order, buyerSignature, 1666742631,weth.address)
      ).to.be.rejectedWith(Error, "Invalid buyer signature");
    });
    it("should revert if the Offer gets expired", async () => {
      await weth.connect(buyer).approve(marketPlace.address, ONE_ETH.add(tax));
      await weth.connect(buyer).deposit({ value: ONE_ETH.add(tax) });
      const order = [
        uuid,
        tokenId,
        nftMedia.address,
        BigNumber.from("1"),
        seller.address,
        ONE_ETH,
        weth.address,
        tax,
        buyer.address,
        ethers.utils.parseUnits("1147", "ether") as BigNumber,
        2,
        buyer.address,
      ];

      const signParam = order.slice(0, 7);
      const hashedMessage = ethers.utils.solidityKeccak256(
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
      const buyerSignature = await buyer.signMessage(
        ethers.utils.arrayify(hashedMessage)
      );
      await expect(
        marketPlace.connect(seller).sell(order, buyerSignature, 1656070115,weth.address)
      ).to.be.rejectedWith(Error, "offer has expired");
    });
    it("Should revert if the price conversion value is above the slippage", async () => {
      await weth.connect(buyer).approve(marketPlace.address, ONE_ETH.add(tax));
      await weth.connect(buyer).deposit({ value: ONE_ETH.add(tax) });
      const order = [
        uuid,
        tokenId,
        nftMedia.address,
        BigNumber.from("1"),
        seller.address,
        ONE_ETH,
        weth.address,
        ONE_ETH.div(4),
        buyer.address,
        ethers.utils.parseUnits("1147", "ether") as BigNumber,
        1,
        buyer.address,
      ];

      const signParam = order.slice(0, 7);
      const hashedMessage = ethers.utils.solidityKeccak256(
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
      const buyerSignature = await buyer.signMessage(
        ethers.utils.arrayify(hashedMessage)
      );
      await expect(
        marketPlace
          .connect(seller)
          .sell(order, buyerSignature, 1666742631, weth.address)
      ).to.be.rejectedWith(Error, "quotePrice with slippage is less than the fixedPrice");
    });
    it("Should be able to fullfill the offer token using valid info", async () => {
      await weth.connect(buyer).approve(marketPlace.address, ONE_ETH.add(tax));
      await weth.connect(buyer).deposit({ value: ONE_ETH.add(tax) });
      const order = [
        uuid,
        tokenId,
        nftMedia.address,
        BigNumber.from("1"),
        seller.address,
        ONE_ETH,
        weth.address,
        tax,
        buyer.address,
        ethers.utils.parseUnits("1147", "ether") as BigNumber,
        2,
        buyer.address,
      ];

      const signParam = order.slice(0, 7);
      const hashedMessage = ethers.utils.solidityKeccak256(
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
      const buyerSignature = await buyer.signMessage(
        ethers.utils.arrayify(hashedMessage)
      );
      const buyTx = await marketPlace
        .connect(seller)
        .sell(order, buyerSignature, 1666742631, weth.address);
      await buyTx.wait();
      expect(await nftMedia.ownerOf(tokenId)).to.eq(buyer.address);
    });

    it("Should return the royalty fee for the token", async () => {
      let platformFee = ONE_ETH.mul(platformFeePercentage).div(100);
      let amount = ONE_ETH.sub(platformFee);
      const royaltyData = await marketPlace.getRoyaltyInfo(nftMedia.address,tokenId,amount);
      expect(await royaltyData[0][0]).to.eq(royaltyRecipient1.address);
      expect(await royaltyData[0][1]).to.eq(royaltyRecipient2.address);
      expect(await royaltyData[1][0].toNumber()).to.eq(500);
      expect(await royaltyData[1][1].toNumber()).to.eq(200);
    });

    it("Should settle the tax fee", async () => {
      await weth.connect(buyer).approve(marketPlace.address, ONE_ETH.add(tax));
      await weth.connect(buyer).deposit({ value: ONE_ETH.add(tax) });
      const order = [
        uuid,
        tokenId,
        nftMedia.address,
        BigNumber.from("1"),
        seller.address,
        ONE_ETH,
        weth.address,
        tax,
        buyer.address,
        ethers.utils.parseUnits("1147", "ether") as BigNumber,
        2,
        buyer.address,
      ];
      const signParam = order.slice(0, 7);
      const hashedMessage = ethers.utils.solidityKeccak256(
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
      const buyerSignature = await buyer.signMessage(
        ethers.utils.arrayify(hashedMessage)
      );
      const buyTx = await marketPlace
        .connect(seller)
        .sell(order, buyerSignature, 1666742631, weth.address);
      await buyTx.wait();
      expect(await nftMedia.ownerOf(tokenId)).to.eq(buyer.address);

      let platformFee = ONE_ETH.mul(platformFeePercentage).div(100);
      let after = await weth.balanceOf(platform.address);
      expect(platformFee.add(tax).toString()).to.eql(after.toString());
    });

    it("Should settle the platform fee", async () => {
      const amount = BigNumber.from(10).pow(18);
      await weth.connect(buyer).approve(marketPlace.address, amount);
      await weth.connect(buyer).deposit({ value: ONE_ETH });
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
        ethers.utils.parseUnits("1147", "ether") as BigNumber,
        2,
        buyer.address,
      ];
      const signParam = order.slice(0, 7);
      const hashedMessage = ethers.utils.solidityKeccak256(
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
      const buyerSignature = await buyer.signMessage(
        ethers.utils.arrayify(hashedMessage)
      );
      const buyTx = await marketPlace
        .connect(seller)
        .sell(order, buyerSignature, 1666742631, weth.address);
      await buyTx.wait();
      expect(await nftMedia.ownerOf(tokenId)).to.eq(buyer.address);

      let platformFee = ONE_ETH.mul(platformFeePercentage).div(100);
      let after = await weth.balanceOf(platform.address);
      expect(platformFee.toString()).to.eql(after.toString());
    });

    it("Should settle the royalty fee", async () => {
      const amount = BigNumber.from(10).pow(18);
      await weth.connect(buyer).approve(marketPlace.address, amount);
      await weth.connect(buyer).deposit({ value: ONE_ETH });
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
        ethers.utils.parseUnits("1147", "ether") as BigNumber,
        2,
        buyer.address,
      ];
      const signParam = order.slice(0, 7);
      const hashedMessage = ethers.utils.solidityKeccak256(
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
      const buyerSignature = await buyer.signMessage(
        ethers.utils.arrayify(hashedMessage)
      );
      const buyTx = await marketPlace
        .connect(seller)
        .sell(order, buyerSignature, 1666742631, weth.address);
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
      const amount = BigNumber.from(10).pow(18);
      await weth.connect(buyer).approve(marketPlace.address, amount);
      await weth.connect(buyer).deposit({ value: ONE_ETH });

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
        ethers.utils.parseUnits("1147", "ether") as BigNumber,
        2,
        buyer.address,
      ];
      const signParam = order.slice(0, 7);
      const hashedMessage = ethers.utils.solidityKeccak256(
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

      const buyerSignature = await buyer.signMessage(
        ethers.utils.arrayify(hashedMessage)
      );
      const buyTx = await marketPlace
        .connect(seller)
        .sell(order, buyerSignature, 1666742631,weth.address);
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
      await expect(
        marketPlace
          .connect(buyer)
          .executeAuction(
            [
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
            ],
            signature,
            signature,
            weth.address,
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

    it("should revert if the seller signature is not verified", async () => {
      await weth.connect(buyer).approve(marketPlace.address, ONE_ETH.add(tax));
      await weth.connect(buyer).deposit({ value: ONE_ETH.add(tax) });
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
        buyer.address,
      ];
      const signParam = order.slice(0, 7);
      const hashedMessage = ethers.utils.solidityKeccak256(
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
      const sellerSignature = await anonymousUser.signMessage(
        ethers.utils.arrayify(hashedMessage)
      );
      const buyerSignature = await buyer.signMessage(
        ethers.utils.arrayify(hashedMessage)
      );
      const bidhistory = [
        [buyer.address, ONE_ETH, ethers.constants.AddressZero],
        [anonymousUser.address, ONE_ETH, ethers.constants.AddressZero],
      ];
      await expect(
        marketPlace
          .connect(buyer)
          .executeAuction(order, sellerSignature, buyerSignature,weth.address, bidhistory)
      ).to.be.rejectedWith(Error, "Invalid seller signature");
    });

    it("should revert if the buyer signature is not verified", async () => {
      await weth.connect(buyer).approve(marketPlace.address, ONE_ETH.add(tax));
      await weth.connect(buyer).deposit({ value: ONE_ETH.add(tax) });
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
        buyer.address,
      ];
      const signParam = order.slice(0, 7);
      const hashedMessage = ethers.utils.solidityKeccak256(
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
      const sellerSignature = await seller.signMessage(
        ethers.utils.arrayify(hashedMessage)
      );
      const buyerSignature = await anonymousUser.signMessage(
        ethers.utils.arrayify(hashedMessage)
      );
      const bidhistory = [
        [buyer.address, ONE_ETH, ethers.constants.AddressZero],
        [anonymousUser.address, ONE_ETH, ethers.constants.AddressZero],
      ];
      await expect(
        marketPlace
          .connect(buyer)
          .executeAuction(order, sellerSignature, buyerSignature,weth.address, bidhistory)
      ).to.be.rejectedWith(Error, "Invalid buyer signature");
    });
    it("should revert if the msg.sender is not the admin or the buyer", async () => {
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
        buyer.address,
      ];
      const signParam = order.slice(0, 7);
      const hashedMessage = ethers.utils.solidityKeccak256(
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
      const sellerSignature = await seller.signMessage(
        ethers.utils.arrayify(hashedMessage)
      );
      const buyerSignature = await buyer.signMessage(
        ethers.utils.arrayify(hashedMessage)
      );
      const bidhistory = [
        [buyer.address, ONE_ETH, ethers.constants.AddressZero],
        [anonymousUser.address, ONE_ETH, ethers.constants.AddressZero],
      ];
      await expect(
        marketPlace
          .connect(anonymousUser)
          .executeAuction(order, sellerSignature, buyerSignature,weth.address, bidhistory)
      ).to.be.rejectedWith(
        Error,
        "Only Buyer or the Admin can call this function"
      );
    });
    it("should revert if the msg.sender is not the whitelisted buyer if whitelist address is added", async () => {
      const order = [
        uuid,
        tokenId,
        nftMedia.address,
        BigNumber.from("1"),
        seller.address,
        ONE_ETH,
        ethers.constants.AddressZero,
        tax,
        anonymousUser.address,
        0,
        0,
        buyer.address,
      ];
      const signParam = order.slice(0, 7);
      const hashedMessage = ethers.utils.solidityKeccak256(
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
      const sellerSignature = await seller.signMessage(
        ethers.utils.arrayify(hashedMessage)
      );
      const buyerSignature = await buyer.signMessage(
        ethers.utils.arrayify(hashedMessage)
      );
      const bidhistory = [
        [buyer.address, ONE_ETH, ethers.constants.AddressZero],
        [anonymousUser.address, ONE_ETH, ethers.constants.AddressZero],
      ];
      await expect(
        marketPlace
          .connect(buyer)
          .executeAuction(order, sellerSignature, buyerSignature,weth.address, bidhistory)
      ).to.be.rejectedWith(Error, "msg.sender should be the whitelisted buyer");
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
      const hashedMessage = ethers.utils.solidityKeccak256(
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
      const sellerSignature = await seller.signMessage(
        ethers.utils.arrayify(hashedMessage)
      );
      const currentOwner = await nftMedia.ownerOf(tokenId);
      expect(currentOwner).to.eq(seller.address);
    });

    it("Should revert if the price conversion value is above the slippage", async () => {
      await weth.connect(buyer).approve(marketPlace.address, ONE_ETH.add(tax));
      await weth.connect(buyer).deposit({ value: ONE_ETH.add(tax) });
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
        ethers.utils.parseUnits("1147", "ether") as BigNumber,
        1,
        buyer.address,
      ];

      const signParam = order.slice(0, 7);
      const hashedMessage = ethers.utils.solidityKeccak256(
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
      const sellerSignature = await seller.signMessage(
        ethers.utils.arrayify(hashedMessage)
      );
      const bidhistory = [
        [buyer.address, ONE_ETH, ethers.constants.AddressZero],
        [anonymousUser.address, ONE_ETH, ethers.constants.AddressZero],
      ];
      const buyerSignature = await buyer.signMessage(
        ethers.utils.arrayify(hashedMessage)
      );
      await expect(
        marketPlace
          .connect(buyer)
          .executeAuction(order, sellerSignature, buyerSignature,weth.address, bidhistory, {
            value: ONE_ETH.add(tax),
          })
      ).to.be.rejectedWith(Error, "quotePrice with slippage is less than the fixedPrice");
    });

    it("should revert if the uuid is already used", async () => {
      await weth.connect(buyer).approve(marketPlace.address, ONE_ETH.add(tax));
      await weth.connect(buyer).deposit({ value: ONE_ETH.add(tax) });
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
        ethers.utils.parseEther("1147"),
        2,
        buyer.address,
      ];
      const signParam = order.slice(0, 7);
      const hashedMessage = ethers.utils.solidityKeccak256(
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
      const sellerSignature = await seller.signMessage(
        ethers.utils.arrayify(hashedMessage)
      );
      const buyerSignature = await buyer.signMessage(
        ethers.utils.arrayify(hashedMessage)
      );
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
        .executeAuction(order, sellerSignature, buyerSignature,weth.address, bidhistory, );
      await buyTx.wait();
      expect(await nftMedia.ownerOf(tokenId)).to.eq(buyer.address);
      await weth.connect(buyer).approve(marketPlace.address, ONE_ETH.add(tax));
      await weth.connect(buyer).deposit({ value: ONE_ETH.add(tax) });
      await expect(
        marketPlace
          .connect(buyer)
          .executeAuction(order, sellerSignature, buyerSignature,weth.address, bidhistory, )
      ).to.be.rejectedWith(Error, "UUID already used");
    });
    it("Should be able to complete the auction using valid information", async () => {
      await weth.connect(buyer).approve(marketPlace.address, ONE_ETH.add(tax));
      await weth.connect(buyer).deposit({ value: ONE_ETH.add(tax) });
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
        ethers.utils.parseUnits("1147", "ether") as BigNumber,
        2,
        buyer.address,
      ];
      const signParam = order.slice(0, 7);
      const hashedMessage = ethers.utils.solidityKeccak256(
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
      const sellerSignature = await seller.signMessage(
        ethers.utils.arrayify(hashedMessage)
      );
      const buyerSignature = await buyer.signMessage(
        ethers.utils.arrayify(hashedMessage)
      );
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
        .executeAuction(order, sellerSignature, buyerSignature,weth.address, bidhistory,);
      await buyTx.wait();
      expect(await nftMedia.ownerOf(tokenId)).to.eq(buyer.address);
    });

    it("Should settle the tax fee", async () => {
      await weth.connect(buyer).approve(marketPlace.address, ONE_ETH.add(tax));
      await weth.connect(buyer).deposit({ value: ONE_ETH.add(tax) });
      const order = [
        uuid,
        tokenId,
        nftMedia.address,
        BigNumber.from("1"),
        seller.address,
        ONE_ETH,
        weth.address,
        tax,
        buyer.address,
        ethers.utils.parseUnits("1147", "ether") as BigNumber,
        2,
        buyer.address,
      ];
      const signParam = order.slice(0, 7);
      const hashedMessage = ethers.utils.solidityKeccak256(
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
      const sellerSignature = await seller.signMessage(
        ethers.utils.arrayify(hashedMessage)
      );
      const buyerSignature = await buyer.signMessage(
        ethers.utils.arrayify(hashedMessage)
      );
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
        .executeAuction(order, sellerSignature, buyerSignature,weth.address, bidhistory,);
      await buyTx.wait();
      expect(await nftMedia.ownerOf(tokenId)).to.eq(buyer.address);

      let platformFee = ONE_ETH.mul(platformFeePercentage).div(100);
      let after = await weth.balanceOf(platform.address);
      expect(platformFee.add(tax).toString()).to.eql(after.toString());
    });

    it("Should settle the platform fee", async () => {
      const amount = BigNumber.from(10).pow(18);
      await weth.connect(buyer).approve(marketPlace.address, amount);
      await weth.connect(buyer).deposit({ value: ONE_ETH });
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
        ethers.utils.parseUnits("1147", "ether") as BigNumber,
        2,
        buyer.address,
      ];
      const signParam = order.slice(0, 7);
      const hashedMessage = ethers.utils.solidityKeccak256(
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
      const sellerSignature = await seller.signMessage(
        ethers.utils.arrayify(hashedMessage)
      );
      const buyerSignature = await buyer.signMessage(
        ethers.utils.arrayify(hashedMessage)
      );
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
        .executeAuction(order, sellerSignature, buyerSignature,weth.address, bidhistory,);
      await buyTx.wait();
      expect(await nftMedia.ownerOf(tokenId)).to.eq(buyer.address);

      let platformFee = ONE_ETH.mul(platformFeePercentage).div(100);
      let after = await weth.balanceOf(platform.address);
      expect(platformFee.toString()).to.eql(after.toString());
    });

    it("Should settle the royalty fee", async () => {
      const amount = BigNumber.from(10).pow(18);
      await weth.connect(buyer).approve(marketPlace.address, amount);
      await weth.connect(buyer).deposit({ value: ONE_ETH });
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
        ethers.utils.parseUnits("1147", "ether") as BigNumber,
        2,
        buyer.address,
      ];
      const signParam = order.slice(0, 7);
      const hashedMessage = ethers.utils.solidityKeccak256(
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
      const sellerSignature = await seller.signMessage(
        ethers.utils.arrayify(hashedMessage)
      );
      const buyerSignature = await buyer.signMessage(
        ethers.utils.arrayify(hashedMessage)
      );
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
        .executeAuction(order, sellerSignature, buyerSignature,weth.address, bidhistory,);
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
      const amount = BigNumber.from(10).pow(18);
      await weth.connect(buyer).approve(marketPlace.address, amount);
      await weth.connect(buyer).deposit({ value: ONE_ETH });
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
        ethers.utils.parseUnits("1147", "ether") as BigNumber,
        2,
        buyer.address,
      ];
      const signParam = order.slice(0, 7);
      const hashedMessage = ethers.utils.solidityKeccak256(
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
      const sellerSignature = await seller.signMessage(
        ethers.utils.arrayify(hashedMessage)
      );
      const buyerSignature = await buyer.signMessage(
        ethers.utils.arrayify(hashedMessage)
      );
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
        .executeAuction(order, sellerSignature, buyerSignature,weth.address, bidhistory, );
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
      await weth.connect(buyer).approve(marketPlace.address, ONE_ETH.add(tax));
      await weth.connect(buyer).deposit({ value: ONE_ETH.add(tax) });
      const order = [
        uuid,
        tokenId,
        nftMedia.address,
        BigNumber.from("1"),
        seller.address,
        ONE_ETH,
        weth.address,
        tax,
        buyer.address,
        ethers.utils.parseUnits("1147", "ether") as BigNumber,
        2,
        buyer.address,
      ];
      const signParam = order.slice(0, 7);
      const hashedMessage = ethers.utils.solidityKeccak256(
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
      const sellerSignature = await seller.signMessage(
        ethers.utils.arrayify(hashedMessage)
      );
      const buyerSignature = await buyer.signMessage(
        ethers.utils.arrayify(hashedMessage)
      );
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
        .executeAuction(order, sellerSignature, buyerSignature,weth.address, bidhistory,);
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