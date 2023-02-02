import chai from "chai";
import chaiAsPromised from "chai-as-promised";
chai.use(chaiAsPromised);
const expect = chai.expect;
import { Decimal } from '@zoralabs/zdk';
import { ethers } from "hardhat";
import { BigNumber, Contract, Signer } from "ethers";
import { formatUnits } from "ethers/lib/utils";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

const BASE_URI = "https://arweave.net/oUbZMh4SJ-98Xot0kEhsKmyyf-wMOEbDNFgUpc_dJfI/";
const BASE_URI_SUFFIX = ".json";
const CONTRACT_METADATA_URI = "http://ipfs.io/ipfs/QmT5vJ53pbrZ3NhUk7o1fYLUfB6Qfui4nDhD1FBZFsy4sH";
const ONE_ETH = ethers.utils.parseUnits("1", "ether") as BigNumber;
const TWO_ETH = ethers.utils.parseUnits("2", "ether") as BigNumber;

const BID_SHARES = {
    prevOwner: Decimal.new(10),
    owner: Decimal.new(80),
    creator: Decimal.new(10),
};


describe("Sale Contract", () => {
    let nftMedia: Contract;
    let buyNow: Contract;
    let weth: Contract;
    let nftMarket: Contract;

    beforeEach(async () => {
        const  CREATOR_IMPLEMENTATION_ADDR= await ethers.getContractFactory("ERC1155CreatorImplementation");
        nftMarket = await CREATOR_IMPLEMENTATION_ADDR.deploy();
        await nftMarket.deployed();

        const NFTMedia = await ethers.getContractFactory("Creator1155Proxy");
        const nftMedia1 = await NFTMedia.deploy(nftMarket.address);

        // const ProxyRegistry = await ethers.getContractFactory("ProxyRegistry");
        // const proxyRegistry = await ProxyRegistry.deploy();
        // await proxyRegistry.deployed();

        // const NFTMedia = await ethers.getContractFactory("StandardizedZoraNFT");
        // nftMedia = await NFTMedia.deploy("Sero NFT", "SFT", BASE_URI, BASE_URI_SUFFIX, CONTRACT_METADATA_URI, nftMarket.address, proxyRegistry.address);
        // await nftMarket.configure(nftMedia.address);
        const WETH = await ethers.getContractFactory("WETH");
        weth = await WETH.deploy();
        nftMedia = await ethers.getContractAt("ERC1155CreatorImplementation",nftMedia1.address)
        const BuyNow = await ethers.getContractFactory("BuyNow");
        buyNow = await BuyNow.deploy(nftMedia.address, weth.address);
    });

    describe("Sale Constructor", () => {
        it("should be able to deploy", async () => {
            const BuyNow = await ethers.getContractFactory("BuyNow");
            const buyNow = await BuyNow.deploy(
                nftMedia.address,
                weth.address
            );

            expect(await buyNow.nftAddress()).to.eq(
                nftMedia.address,
                "incorrect nftAddress address"
            );

        });
    });

    describe("Create Sale", () => {

        it("should revert if the token contract does not support the ERC1155 interface", async () => {
            const [addr1] = await ethers.getSigners();
            await nftMedia.connect(addr1).setApprovalForAll(buyNow.address, true);
            const fixedPrice = ONE_ETH;
            const [_, curator] = await ethers.getSigners();
            const bad = (await (
                await ethers.getContractFactory("BadERC1155")
            ).deploy());
            await expect(
                buyNow.connect(addr1).createSale(
                    0,
                    bad.address,
                    fixedPrice,
                    curator.address,
                    5,
                    "0x0000000000000000000000000000000000000000"
                )
            ).to.be.rejectedWith(
                Error, "tokenContract does not support ERC721 or ERC1155 interface"
            );
        });

        it("should revert if the caller is not approved", async () => {
            const [addr1] = await ethers.getSigners();
            const receipt2 = await nftMedia["mintBaseNew(address[],uint256[],string[])"]([addr1.address],[1],["https://gateway.arweave.net/TCrOsfGKrPEpIIIl4gm1ETjhjg-fCXdxk6Vwmd45NJg"]);
            receipt2.wait();
            const fixedPrice = ONE_ETH;
            const [_, curator, __, ___, unapproved] = await ethers.getSigners();
            await expect(
                buyNow
                    .connect(unapproved)
                    .createSale(
                        0,
                        nftMedia.address,
                        fixedPrice,
                        curator.address,
                        5,
                        "0x0000000000000000000000000000000000000000"
                    )
            ).to.be.rejectedWith(
                Error, "There should be atleast one qty in the owner address and the tokenID"
            );
        });

        it("should revert if the curator fee percentage is >= 100", async () => {
            const [addr1] = await ethers.getSigners();
            const receipt2 = await nftMedia["mintBaseNew(address[],uint256[],string[])"]([addr1.address],[1],["https://gateway.arweave.net/TCrOsfGKrPEpIIIl4gm1ETjhjg-fCXdxk6Vwmd45NJg"]);
            receipt2.wait();
            const fixedPrice = ONE_ETH;
            //const owner = await nftMedia.ownerOf(0);
            const [_, curator] = await ethers.getSigners();

            await expect(
                buyNow.connect(addr1).createSale(
                    0,
                    nftMedia.address,
                    fixedPrice,
                    curator.address,
                    100,
                    "0x0000000000000000000000000000000000000000"
                )
            ).to.be.rejectedWith(Error, "curatorFeePercentage must be less than 100"
            );
        });


        it("should create an sale", async () => {

            const [_, expectedCurator] = await ethers.getSigners();
            const saleCurrency = "0x0000000000000000000000000000000000000000";
            const curator = await expectedCurator.getAddress();
            const tokenId = 1;
            const fixedPrice = ONE_ETH;
            const [addr1] = await ethers.getSigners();

            // Approving Sale to transfer addr1's tokens
            await nftMedia.connect(addr1).setApprovalForAll(buyNow.address, true);

            const receipt2 = await nftMedia["mintBaseNew(address[],uint256[],string[])"]([addr1.address],[1],["https://gateway.arweave.net/TCrOsfGKrPEpIIIl4gm1ETjhjg-fCXdxk6Vwmd45NJg"]);
            receipt2.wait();
            await buyNow.connect(addr1).createSale(
                tokenId,
                nftMedia.address,
                fixedPrice,
                curator,
                5,
                saleCurrency
            );
            const createdSale = await buyNow.sales(0);
            expect(createdSale.fixedPrice.toString()).to.eq(fixedPrice.toString());
            expect(createdSale.curatorFeePercentage).to.eq(5);
            expect(createdSale.tokenOwner).to.eq(addr1.address);
            expect(createdSale.curator).to.eq(expectedCurator.address);
            expect(createdSale.approved).to.eq(false);
        });

        it("should be automatically approved if the creator is the curator", async () => {
            const [addr1] = await ethers.getSigners();
            await nftMedia.connect(addr1).setApprovalForAll(buyNow.address, true);
            const receipt2 = await nftMedia["mintBaseNew(address[],uint256[],string[])"]([addr1.address],[1],["https://gateway.arweave.net/TCrOsfGKrPEpIIIl4gm1ETjhjg-fCXdxk6Vwmd45NJg"]);
            receipt2.wait();
            const saleCurrency = "0x0000000000000000000000000000000000000000";
            const tokenId = 1;
            const fixedPrice = ONE_ETH;

            await buyNow.connect(addr1).createSale(
                tokenId,
                nftMedia.address,
                fixedPrice,
                addr1.address,
                5,
                saleCurrency
            );
            const createdSale = await buyNow.sales(0);
            expect(createdSale.approved).to.eq(true);
        });

        it("should be automatically approved if the creator is the Zero Address", async () => {
            const [addr1] = await ethers.getSigners();
            await nftMedia.connect(addr1).setApprovalForAll(buyNow.address, true);
            const receipt2 = await nftMedia["mintBaseNew(address[],uint256[],string[])"]([addr1.address],[1],["https://gateway.arweave.net/TCrOsfGKrPEpIIIl4gm1ETjhjg-fCXdxk6Vwmd45NJg"]);
            receipt2.wait();

            const saleCurrency = "0x0000000000000000000000000000000000000000";
            const tokenId = 1;
            const fixedPrice = ONE_ETH;

            await buyNow.connect(addr1).createSale(
                tokenId,
                nftMedia.address,

                fixedPrice,
                ethers.constants.AddressZero,
                5,
                saleCurrency
            );
            const createdSale = await buyNow.sales(0);
            expect(createdSale.approved).to.eq(true);
        });

        it("should emit an SaleCreated event", async () => {
            const [addr1] = await ethers.getSigners();
            await nftMedia.connect(addr1).setApprovalForAll(buyNow.address, true);
            const receipt2 = await nftMedia["mintBaseNew(address[],uint256[],string[])"]([addr1.address],[1],["https://gateway.arweave.net/TCrOsfGKrPEpIIIl4gm1ETjhjg-fCXdxk6Vwmd45NJg"]);
            receipt2.wait();
            const [_, expectedCurator] = await ethers.getSigners();

            const saleCurrency = "0x0000000000000000000000000000000000000000";
            const tokenId = 1;
            const fixedPrice = ONE_ETH;

            await buyNow.connect(addr1).createSale(
                tokenId,
                nftMedia.address,
                fixedPrice,
                expectedCurator.address,
                5,
                saleCurrency
            );
            const currSale = await buyNow.sales(0);
            const events = await buyNow.queryFilter(
                buyNow.filters.SaleCreated(
                    null,
                    null,
                    null,
                    null,
                    null,
                    null,
                    null,
                    null
                ),
            );
            expect(events.length).eq(1);
            const logDescription = buyNow.interface.parseLog(events[0]);
            expect(logDescription.name).to.eq("SaleCreated");
            expect(logDescription.args.fixedPrice.toString()).to.eq(currSale.fixedPrice.toString());
            expect(logDescription.args.tokenOwner).to.eq(currSale.tokenOwner);
            expect(logDescription.args.curator).to.eq(currSale.curator);
            expect(logDescription.args.curatorFeePercentage).to.eq(
                currSale.curatorFeePercentage
            );
            expect(logDescription.args.saleCurrency).to.eq(
                ethers.constants.AddressZero
            );
        });
    });
    describe("Set Sale Approval", () => {
        let admin: SignerWithAddress;
        let curator: SignerWithAddress;
        let buyer: SignerWithAddress;

        beforeEach(async () => {
            [admin, curator, buyer] = await ethers.getSigners();
            const saleCurrency = "0x0000000000000000000000000000000000000000";
            const tokenId = 1;
            const fixedPrice = ONE_ETH;

            // Approving Sale  to transfer addr1's tokens
            await nftMedia.connect(admin).setApprovalForAll(buyNow.address, true);
            const receipt2 = await nftMedia["mintBaseNew(address[],uint256[],string[])"]([admin.address],[1],["https://gateway.arweave.net/TCrOsfGKrPEpIIIl4gm1ETjhjg-fCXdxk6Vwmd45NJg"]);
            receipt2.wait();
            await buyNow.connect(admin).createSale(
                tokenId,
                nftMedia.address,
                fixedPrice,
                curator.address,
                5,
                saleCurrency
            );
        });

        it("should revert if the buy does not exist", async () => {
            await expect(
                buyNow.setSaleApproval(1, true)
            ).to.be.rejectedWith(Error, "Sale doesn't exist");
        });

        it("should revert if not called by the curator", async () => {
            await expect(
                buyNow.connect(admin).setSaleApproval(0, true)
            ).to.be.rejectedWith("Must be sale curator");
        });

        it("should set the sale as approved", async () => {
            await buyNow.connect(curator).setSaleApproval(0, true);
            expect((await buyNow.sales(0)).approved).to.eq(true);
        });

        it("should emit an SaleApproved event", async () => {
            const block = await ethers.provider.getBlockNumber();
            await buyNow.connect(curator).setSaleApproval(0, true);
            const events = await buyNow.queryFilter(
                buyNow.filters.SaleApprovalUpdated(null, null, null, null),
                block
            );
            expect(events.length).eq(1);
            const logDescription = buyNow.interface.parseLog(events[0]);
            expect(logDescription.args.approved).to.eq(true);
        });
    });

    describe("Buy function", () => {
        let admin: SignerWithAddress;
        let curator: SignerWithAddress;
        let buyer: SignerWithAddress;
        let other: SignerWithAddress;

        beforeEach(async () => {
            [admin, curator, buyer, other] = await ethers.getSigners();
            const saleCurrency = "0x0000000000000000000000000000000000000000";
            const tokenId = 1;
            const fixedPrice = ONE_ETH;

            // Approving Sale to transfer addr1's tokens
            await nftMedia.connect(admin).setApprovalForAll(buyNow.address, true);
            const receipt2 = await nftMedia["mintBaseNew(address[],uint256[],string[])"]([admin.address],[1],["https://gateway.arweave.net/TCrOsfGKrPEpIIIl4gm1ETjhjg-fCXdxk6Vwmd45NJg"]);
            receipt2.wait();
            await buyNow.connect(admin).createSale(
                tokenId,
                nftMedia.address,
                fixedPrice,
                curator.address,
                5,
                saleCurrency
            );
            await buyNow.connect(curator).setSaleApproval(0, true);
        });

        it("should revert if the specified sale does not exist", async () => {
            await expect(
                buyNow.buy(11111, ONE_ETH)
            ).to.be.rejectedWith(Error, "Sale doesn't exist");
        });

        it("should revert if the specified sale is not approved", async () => {
            await buyNow.connect(curator).setSaleApproval(0, false);
            await expect(
                buyNow.buy(0, ONE_ETH, { value: ONE_ETH })
            ).to.be.rejectedWith(Error, "Sale must be approved by curator");
        });

    });
    describe("Cancel the Sale", () => {
        let admin: SignerWithAddress;
        let creator: SignerWithAddress;
        let curator: SignerWithAddress;
        let buyer: SignerWithAddress;
        let other: SignerWithAddress;

        beforeEach(async () => {
            [admin, creator, curator, buyer, other] = await ethers.getSigners();
            const [_, expectedCurator] = await ethers.getSigners();
            const saleCurrency = "0x0000000000000000000000000000000000000000";
            const tokenId = 1;
            const fixedPrice = ONE_ETH;

            // Approving Sale to transfer addr1's tokens
            await nftMedia.connect(creator).setApprovalForAll(buyNow.address, true);
            const receipt2 = await nftMedia["mintBaseNew(address[],uint256[],string[])"]([creator.address],[1],["https://gateway.arweave.net/TCrOsfGKrPEpIIIl4gm1ETjhjg-fCXdxk6Vwmd45NJg"]);
            receipt2.wait();
            await buyNow.connect(creator).createSale(
                tokenId,
                nftMedia.address,
                fixedPrice,
                curator.address,
                5,
                saleCurrency
            );
            await buyNow.connect(curator).setSaleApproval(0, true);
        });

        it("should revert if the sale does not exist", async () => {
            await expect(buyNow.cancelSale(12213)).to.be.rejectedWith(
                Error, "Sale doesn't exist"
            );
        });

        it("should be callable by the creator", async () => {
            await buyNow.connect(creator).cancelSale(0);
            const saleResult = await buyNow.sales(0);
            expect(saleResult.fixedPrice.toNumber()).to.eq(0);
            expect(saleResult.curatorFeePercentage).to.eq(0);
            expect(saleResult.tokenOwner).to.eq(ethers.constants.AddressZero);
            expect(saleResult.buyer).to.eq(ethers.constants.AddressZero);
            expect(saleResult.curator).to.eq(ethers.constants.AddressZero);
            expect(saleResult.saleCurrency).to.eq(ethers.constants.AddressZero);
            //expect(await nftMedia.ownerOf(0)).to.eq(await creator.getAddress());
        });

        it("should be callable by the curator", async () => {
            await buyNow.connect(curator).cancelSale(0);
            const saleResult = await buyNow.sales(0);
            expect(saleResult.fixedPrice.toNumber()).to.eq(0);
            expect(saleResult.curatorFeePercentage).to.eq(0);
            expect(saleResult.tokenOwner).to.eq(ethers.constants.AddressZero);
            expect(saleResult.buyer).to.eq(ethers.constants.AddressZero);
            expect(saleResult.curator).to.eq(ethers.constants.AddressZero);
            expect(saleResult.saleCurrency).to.eq(ethers.constants.AddressZero);
            //expect(await nftMedia.ownerOf(0)).to.eq(await creator.getAddress());
        });

        it("should emit an SaleCanceled event", async () => {
            const block = await ethers.provider.getBlockNumber();
            await buyNow.connect(curator).cancelSale(0);
            const events = await buyNow.queryFilter(
                buyNow.filters.SaleCanceled(null, null, null, null),
                block
            );
            expect(events.length).eq(1);
            const logDescription = buyNow.interface.parseLog(events[0]);
            expect(logDescription.args.tokenId.toNumber()).to.eq(1);
            expect(logDescription.args.tokenOwner).to.eq(await creator.getAddress());
            expect(logDescription.args.tokenContract).to.eq(nftMedia.address);
        });
    });
    describe("Buy NFT", () => {
        let admin: SignerWithAddress;
        let creator: SignerWithAddress;
        let curator: SignerWithAddress;
        let buyer: SignerWithAddress;
        let other: SignerWithAddress;

        beforeEach(async () => {
            [admin, creator, curator, buyer, other] = await ethers.getSigners();
            const [_, expectedCurator] = await ethers.getSigners();
            const saleCurrency = "0x0000000000000000000000000000000000000000";
            const tokenId = 1;
            const fixedPrice = ONE_ETH;

            // Approving Sale to transfer addr1's tokens
            await nftMedia.connect(creator).setApprovalForAll(buyNow.address, true);
            const receipt2 = await nftMedia["mintBaseNew(address[],uint256[],string[])"]([creator.address],[1],["https://gateway.arweave.net/TCrOsfGKrPEpIIIl4gm1ETjhjg-fCXdxk6Vwmd45NJg"]);
            receipt2.wait();
            await buyNow.connect(creator).createSale(
                tokenId,
                nftMedia.address,
                fixedPrice,
                curator.address,
                4,
                saleCurrency
            );
            await buyNow.connect(curator).setSaleApproval(0, true);
        });

        describe("Final NFT Transfer to the buyer", () => {

            it("should transfer the NFT to the  buyer", async () => {
                await buyNow
                    .connect(buyer)
                    .buy(0, ONE_ETH, { value: ONE_ETH });
                // expect((await nftMedia.balanceOf(buyer.getAddress(),1)).toString()).to.eq(1);
                expect((await nftMedia.balanceOf(buyer.getAddress(),1)).toString()).to.eq('1');
                //expect(await nftMedia.ownerOf(0)).to.eq(await buyer.getAddress());
            });

            it("should pay the curator their curatorFee percentage", async () => {
                const beforeBalance = await ethers.provider.getBalance(
                    await curator.getAddress()
                );
                await buyNow
                    .connect(buyer)
                    .buy(0, ONE_ETH, { value: ONE_ETH });
                const expectedCuratorFee = "40000000000000000";
                const curatorBalance = await ethers.provider.getBalance(
                    await curator.getAddress()
                );
                await expect(curatorBalance.sub(beforeBalance).toString()).to.eq(
                    expectedCuratorFee
                );
            });

            it("should pay the creator the remainder of the amount deducting curators fee", async () => {
                const beforeBalance = await ethers.provider.getBalance(
                    await creator.getAddress()
                );
                await buyNow
                    .connect(buyer)
                    .buy(0, ONE_ETH, { value: ONE_ETH });
                const expectedProfit = "960000000000000000";
                const creatorBalance = await ethers.provider.getBalance(
                    await creator.getAddress()
                );
                const wethBalance = await weth.balanceOf(await creator.getAddress());
                await expect(
                    creatorBalance.sub(beforeBalance).add(wethBalance).toString()
                ).to.eq(expectedProfit);
            });

            it("should emit an SaleEnded event", async () => {
                const saleData = await buyNow.sales(0);
                await buyNow
                    .connect(buyer)
                    .buy(0, ONE_ETH, { value: ONE_ETH });
                const events = await buyNow.queryFilter(
                    buyNow.filters.SaleEnded(
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
                );
                expect(events.length).eq(1);
                const logDescription = buyNow.interface.parseLog(events[0]);
                expect(logDescription.args.tokenId.toNumber()).to.eq(1);
                expect(logDescription.args.tokenOwner).to.eq(saleData.tokenOwner);
                expect(logDescription.args.curator).to.eq(saleData.curator);
                expect(logDescription.args.buyer).to.eq(await buyer.getAddress());
                expect(logDescription.args.amount.toString()).to.eq(
                    "960000000000000000"
                );
                expect(logDescription.args.curatorFee.toString()).to.eq(
                    "40000000000000000"
                );
                expect(logDescription.args.saleCurrency).to.eq(weth.address);
            });

            it("should delete the sale", async () => {
                await buyNow
                    .connect(buyer)
                    .buy(0, ONE_ETH, { value: ONE_ETH });
                const saleResult = await buyNow.sales(0);
                expect(saleResult.fixedPrice.toNumber()).to.eq(0);
                expect(saleResult.curatorFeePercentage).to.eq(0);
                expect(saleResult.tokenOwner).to.eq(ethers.constants.AddressZero);
                expect(saleResult.buyer).to.eq(ethers.constants.AddressZero);
                expect(saleResult.curator).to.eq(ethers.constants.AddressZero);
                expect(saleResult.saleCurrency).to.eq(
                    ethers.constants.AddressZero
                );
            });
        });
    });
});
