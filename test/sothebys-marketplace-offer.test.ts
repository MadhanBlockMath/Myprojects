import chai from "chai";
import chaiAsPromised from "chai-as-promised";
chai.use(chaiAsPromised);
const expect = chai.expect;
import { Decimal } from "@zoralabs/zdk";
import { ethers } from "hardhat";
import { BigNumber, Contract, Signer } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

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
  let marketplace: Contract;
  let weth: Contract;
  let nftMarket: Contract;
  let platform: SignerWithAddress;
  let seller: SignerWithAddress;
  let buyer: SignerWithAddress;
  let anonymousUser: SignerWithAddress;
  let royaltyrecipient1: SignerWithAddress;
  let royaltyrecipient2: SignerWithAddress;
  const tokenId = BigNumber.from("1");
  const platformFeePercentage = 5;
  const uuid = "6102b690-d2bc-435e-9d8b-3c660cccd8b0";
  beforeEach(async () => {
    [
      platform,
      seller,
      buyer,
      anonymousUser,
      royaltyrecipient1,
      royaltyrecipient2,
    ] = await ethers.getSigners();

    const ERC721CreatorImplementation = await ethers.getContractFactory(
      "ERC721CreatorImplementation"
    );
    const erc721CreatorImplementation = await ERC721CreatorImplementation.deploy();
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

    nftMedia = await ethers.getContractAt(
      "ERC721CreatorImplementation",
      nftMedia.address
    );

    const Marketplace = await ethers.getContractFactory("Marketplace");
    marketplace = await Marketplace.deploy(
      nftMedia.address,
      weth.address,
      platform.address,
      platformFeePercentage
    );
    await marketplace.deployed();

    // Approving marketplace
    await nftMedia.connect(seller).setApprovalForAll(marketplace.address, true);

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
      [royaltyrecipient1.address, royaltyrecipient2.address],
      [500, 200]
    );
  });

    describe("Marketplace Constructor", () => {
        it("should be able to deploy", async () => {
        const Marketplace = await ethers.getContractFactory("Marketplace");
        const marketplace = await Marketplace.deploy(
            nftMedia.address,
            weth.address,
            platform.address,
            platformFeePercentage
        );
        await marketplace.deployed();

        expect(await marketplace.nftAddress()).to.eq(
            nftMedia.address,
            "incorrect nftAddress address"
        );
        });
    });  
    describe("buy token", () => {
        it("should revert if the token contract does not support the ERC721 interface", async () => {
          const quantity = 1;
          const signature = "0x00";
          const bad = await (await ethers.getContractFactory("BadERC721")).deploy();
          await expect(
            marketplace
              .connect(buyer)
              .sell(
                [
                  uuid,
                  tokenId,
                  bad.address,
                  quantity,
                  seller.address,
                  ONE_ETH,
                  ethers.constants.AddressZero,
                  ethers.constants.AddressZero,
                ],
                signature
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
              buyer.address,
              ONE_ETH,
              ethers.constants.AddressZero,
              ethers.constants.AddressZero
            ];
      
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
                    "address",
                    
                  ],
                  order
                ),
              ]
            );
            const buyerSignature = await anonymousUser.signMessage(hashedMessage);
      
            await expect(
              marketplace.connect(seller).sell(order, buyerSignature)
            ).to.be.rejectedWith(Error, "Invalid Buyer signature");
        });

        it("should be same token owner after the sale started", async () => {
            const order = [
              uuid,
              tokenId,
              nftMedia.address,
              BigNumber.from("1"),
              buyer.address,
              ONE_ETH,
              ethers.constants.AddressZero,
              ethers.constants.AddressZero,
            ];
      
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
                    "address",
                  ],
                  order
                ),
              ]
            );
            const sellerSignature = await anonymousUser.signMessage(hashedMessage);
            const currentOwner = await nftMedia.ownerOf(tokenId);
            expect(currentOwner).to.eq(seller.address);
        });

        it("Should be able to buy the token using valid info", async () => {
            const amount = BigNumber.from(10).pow(18);
            await weth
            .connect(buyer)
            .approve(marketplace.address, amount);
            await weth
            .connect(buyer).deposit({ value: ONE_ETH });
            const order = [
              uuid,
              tokenId,
              nftMedia.address,
              BigNumber.from("1"),
              buyer.address,
              ONE_ETH,
              ethers.constants.AddressZero,
              ethers.constants.AddressZero,
            ];
            const message =  [
              uuid,
              tokenId,
              nftMedia.address,
              BigNumber.from("1"),
              buyer.address,
              ONE_ETH,
              ethers.constants.AddressZero,
            ];
      
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
                  message
                ),
              ]
            );
            const buyerSignature = await buyer.signMessage(
              ethers.utils.arrayify(hashedMessage)
            );
      
            const buyTx = await marketplace
              .connect(seller)
              .sell(order, buyerSignature);
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
            .approve(marketplace.address, amount);
            await weth
            .connect(buyer).deposit({ value: ONE_ETH });

            const order = [
              uuid,
              tokenId,
              nftMedia.address,
              BigNumber.from("1"),
              buyer.address,
              ONE_ETH,
              ethers.constants.AddressZero,
              ethers.constants.AddressZero,
            ];
            const message =  [
              uuid,
              tokenId,
              nftMedia.address,
              BigNumber.from("1"),
              buyer.address,
              ONE_ETH,
              ethers.constants.AddressZero,
            ];
      
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
                  message
                ),
              ]
            );
            const buyerSignature = await buyer.signMessage(
              ethers.utils.arrayify(hashedMessage)
            );
      
            const buyTx = await marketplace
              .connect(seller)
              .sell(order, buyerSignature);
            await buyTx.wait();
            expect(await nftMedia.ownerOf(tokenId)).to.eq(buyer.address);

          const after = await weth.balanceOf(platform.address);

            const platformFee = ONE_ETH.mul(platformFeePercentage).div(100).toString()        
            
            expect(platformFee).to.eql(after.sub(platformBalanceBefore).toString());  

        });

        it("Should settle the royalty fee", async () => {
            const royaltyrecipient1BalanceBefore = await weth.balanceOf(
              royaltyrecipient1.address
            );
            const royaltyrecipient2BalanceBefore = await weth.balanceOf(
              royaltyrecipient2.address
            );
            const amount = BigNumber.from(10).pow(18);
            await weth
            .connect(buyer)
            .approve(marketplace.address, amount);
            await weth
            .connect(buyer).deposit({ value: ONE_ETH });
            const order = [
              uuid,
              tokenId,
              nftMedia.address,
              BigNumber.from("1"),
              buyer.address,
              ONE_ETH,
              ethers.constants.AddressZero,
              ethers.constants.AddressZero,
            ];
            const message =  [
              uuid,
              tokenId,
              nftMedia.address,
              BigNumber.from("1"),
              buyer.address,
              ONE_ETH,
              ethers.constants.AddressZero,
            ];
      
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
                  message
                ),
              ]
            );
            const buyerSignature = await buyer.signMessage(
              ethers.utils.arrayify(hashedMessage)
            );
      
            const buyTx = await marketplace
              .connect(seller)
              .sell(order, buyerSignature);
            await buyTx.wait();
            expect(await nftMedia.ownerOf(tokenId)).to.eq(buyer.address);
            let platformFee = ONE_ETH.mul(platformFeePercentage).div(100);

            platformFee = ONE_ETH.sub(platformFee);

            let after = await weth.balanceOf(royaltyrecipient1.address);

            let recipient_1_fee = platformFee.mul(5).div(100).toString();

            expect(recipient_1_fee).to.eql(after.toString());

            after = await weth.balanceOf(royaltyrecipient2.address);

            let recipient_2_fee = platformFee.mul(2).div(100);

            expect(recipient_2_fee.toString()).to.eql(after.toString());

          });
      
          it("should transfer the ownerProfit to the seller", async () => {

            const amount = BigNumber.from(10).pow(18);
            await weth
            .connect(buyer)
            .approve(marketplace.address, amount);
            await weth
            .connect(buyer).deposit({ value: ONE_ETH });
            const order = [
              uuid,
              tokenId,
              nftMedia.address,
              BigNumber.from("1"),
              buyer.address,
              ONE_ETH,
              ethers.constants.AddressZero,
              ethers.constants.AddressZero,
            ];
            const message =  [
              uuid,
              tokenId,
              nftMedia.address,
              BigNumber.from("1"),
              buyer.address,
              ONE_ETH,
              ethers.constants.AddressZero,
            ];
      
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
                  message
                ),
              ]
            );
            const buyerSignature = await buyer.signMessage(
              ethers.utils.arrayify(hashedMessage)
            );
      
            const buyTx = await marketplace
              .connect(seller)
              .sell(order, buyerSignature);
            await buyTx.wait();
            expect(await nftMedia.ownerOf(tokenId)).to.eq(buyer.address);
            let platformFee = ONE_ETH.mul(platformFeePercentage).div(100);

            platformFee = ONE_ETH.sub(platformFee);

            let after = await weth.balanceOf(royaltyrecipient1.address);

            let recipient_1_fee = platformFee.mul(5).div(100);

            expect(recipient_1_fee.toString()).to.eql(after.toString());

            after = await weth.balanceOf(royaltyrecipient2.address);

            let recipient_2_fee = platformFee.mul(2).div(100);

            expect(recipient_2_fee.toString()).to.eql(after.toString());

            let sellerProfit = platformFee.sub(recipient_1_fee).sub(recipient_2_fee);

            const sellerBalance = await weth.balanceOf(seller.address);
            
            expect(sellerProfit.toString()).to.eql(sellerBalance.toString());
        });
    });

})  