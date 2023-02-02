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

describe("buy Contract", () => {
  let nftMedia: Contract;
  let buy: Contract;
  let weth: Contract;
  let nftMarket: Contract;
  let curator: SignerWithAddress;
  let seller: SignerWithAddress;
  let buyer: SignerWithAddress;

    beforeEach(async () => {

        [curator, seller, buyer] = await ethers.getSigners();
        const curatorFeePercentage = 5;     

        const NFTMarket = await ethers.getContractFactory("ZoraNFTMarket");
        nftMarket = await NFTMarket.deploy();
        await nftMarket.deployed();

        const ProxyRegistry = await ethers.getContractFactory("ProxyRegistry");
        const proxyRegistry = await ProxyRegistry.deploy();
        await proxyRegistry.deployed();

        const NFTMedia = await ethers.getContractFactory("StandardizedZoraNFT");
        nftMedia = await NFTMedia.deploy("Sero NFT", "SFT", BASE_URI, BASE_URI_SUFFIX, CONTRACT_METADATA_URI, nftMarket.address, proxyRegistry.address);
        await nftMarket.configure(nftMedia.address);
        const WETH = await ethers.getContractFactory("WETH");
        weth = await WETH.deploy();
        const Buy = await ethers.getContractFactory("Buy");
        buy = await Buy.deploy(nftMedia.address, weth.address,[curator.address, curatorFeePercentage]);
    });

    describe("Sale Constructor", () => {
        it("should be able to deploy", async () => {
            let curatorFeePercentage = 5;
            const Buy = await ethers.getContractFactory("Buy");
            const buy = await Buy.deploy(
                nftMedia.address,
                weth.address,
                [curator.address, curatorFeePercentage]
            );

            expect(await buy.nftAddress()).to.eq(
                nftMedia.address,
                "incorrect nftAddress address"
            );

        });
    });
    describe("buy token", () => {

        it("should revert if the token contract does not support the ERC721 interface", async () => {
            const [seller,buyer] = await ethers.getSigners();
            await nftMedia.connect(seller).setApprovalForAll(buy.address, true);
            const fixedPrice = ONE_ETH;
            const quantity = 1;
            const signature = "0x00"
            const bad = (await (
                await ethers.getContractFactory("BadERC721")
            ).deploy());
            await expect(
                buy.connect(buyer).buy(
                    0,
                    bad.address,
                    signature ,
                    [
                        seller.address,
                        fixedPrice,
                        quantity,
                        "0x0000000000000000000000000000000000000000",
                        "0x0000000000000000000000000000000000000000" // for whitelisting
                    ]
                )
            ).to.be.rejectedWith(
                Error, "tokenContract does not support ERC721 or ERC1155 interface"
            );
        });

        it("should revert if the curator fee percentage is >= 100", async () => {
            let curatorFeePercentage = 100;
            const Buy = await ethers.getContractFactory("Buy");
            const buy = await Buy.deploy(
                nftMedia.address,
                weth.address,
                [curator.address, curatorFeePercentage]
            );


            const [seller,buyer] = await ethers.getSigners();
            await nftMedia.connect(seller).setApprovalForAll(buy.address, true);
            const fixedPrice = ONE_ETH;
            const quantity = 1;
            const signature = "0x00"

            await expect(
                buy.connect(buyer).buy(
                    0,
                    nftMedia.address,
                    signature ,
                    [
                        seller.address,
                        fixedPrice,
                        quantity,
                        "0x0000000000000000000000000000000000000000",
                        "0x0000000000000000000000000000000000000000"
                    ]  
                )
            ).to.be.rejectedWith(
                Error, "platform fee percentage must be less than 100"
            );
        })  
        
        it("should revert if the signature is not verified", async () => {
            const [seller,buyer] = await ethers.getSigners();
            await nftMedia.connect(seller).setApprovalForAll(buy.address, true);

            const fixedPrice = ONE_ETH;
            const quantity = 1;
            const [_, curator] = await ethers.getSigners();
            const signature = "0x0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"
            const hash = await buy.getMessageHash(
                seller.address,
                0,
                fixedPrice,
                quantity,
                nftMedia.address,
                "0x0000000000000000000000000000000000000000",
                curator.address,
                5,
                "0x0000000000000000000000000000000000000000",                    
                0)
                // console.log(hash);
                // const sig = await seller.signMessage(ethers.utils.arrayify(hash))
                // console.log(sig)
            await expect(
                buy.connect(buyer).buy(
                    0,
                    nftMedia.address,
                    signature ,
                    [
                        seller.address,
                        fixedPrice,
                        quantity,
                        "0x0000000000000000000000000000000000000000",
                        "0x0000000000000000000000000000000000000000"
                    ]   
                )
            ).to.be.rejectedWith(
                Error, "incorrect sale details"
            );
        }) 
        it("should verify the sale Details", async () => {
            const [seller,buyer] = await ethers.getSigners();
            await nftMedia.connect(seller).setApprovalForAll(buy.address, true);
            await nftMedia.mintTo(seller.address, BID_SHARES);
            const fixedPrice = ONE_ETH;
            const quantity = 1;
            const hash = await buy.getMessageHash(
                seller.address,
                0,
                fixedPrice,
                quantity,
                nftMedia.address,
                "0x0000000000000000000000000000000000000000",
                curator.address,
                5,
                "0x0000000000000000000000000000000000000000",                    
                0)
                // console.log(hash);
                const sig = await seller.signMessage(ethers.utils.arrayify(hash))
                // console.log(sig)
            await buy.connect(buyer).buy(
                0,
                nftMedia.address,
                sig ,
                [
                    seller.address,
                    fixedPrice,
                    quantity,
                    "0x0000000000000000000000000000000000000000",
                    "0x0000000000000000000000000000000000000000"
                ] ,
                {value: ONE_ETH}
                )

        }) 


        it("should provide the required msg.value for transaction ", async () => {
            await nftMedia.connect(seller).setApprovalForAll(buy.address, true);
            await nftMedia.mintTo(seller.address, BID_SHARES);
            const fixedPrice = ONE_ETH;
            const quantity = 1;
            const hash = await buy.getMessageHash(
                seller.address,
                0,
                fixedPrice,
                quantity,
                nftMedia.address,
                "0x0000000000000000000000000000000000000000",
                curator.address,
                5,
                "0x0000000000000000000000000000000000000000",
                0)

                
                // console.log(hash);
                const sig = await seller.signMessage(ethers.utils.arrayify(hash))
                // console.log(sig)
            await expect( buy.connect(buyer).buy(
                0,
                nftMedia.address,
                sig ,
                [
                    seller.address,
                    fixedPrice,
                    quantity,
                    "0x0000000000000000000000000000000000000000",
                    "0x0000000000000000000000000000000000000000"
                ]
                    // { value: ONE_ETH } 
                )).to.be.rejectedWith(Error, "Sent ETH Value does not match specified buy amount")
               // expect(await nftMedia.ownerOf(0)).to.eq(await buyer.getAddress());
        }) 


        it("should revert if the msg.sender is not the whitlisted buyer ", async () => {
            await nftMedia.connect(seller).setApprovalForAll(buy.address, true);
            await nftMedia.mintTo(seller.address, BID_SHARES);
            const fixedPrice = ONE_ETH;
            const quantity = 1;
            const hash = await buy.getMessageHash(
                seller.address,
                0,
                fixedPrice,
                quantity,
                nftMedia.address,
                "0x0000000000000000000000000000000000000000",
                curator.address,
                5,
                buyer.address,
                0)

                
                // console.log(hash);
                const sig = await seller.signMessage(ethers.utils.arrayify(hash))
                // console.log(sig)
            await expect( buy.connect(curator).buy(
                0,
                nftMedia.address,
                sig ,
                [
                    seller.address,
                    fixedPrice,
                    quantity,
                    "0x0000000000000000000000000000000000000000",
                    buyer.address
                ],
                { value: ONE_ETH } 
                )).to.be.rejectedWith(Error, "msg.sender shoul be equal to be the whitelisted_buyer")
        })       
        it("should transfer the nft to the whitelistedBuyer ", async () => {
            await nftMedia.connect(seller).setApprovalForAll(buy.address, true);
            await nftMedia.mintTo(seller.address, BID_SHARES);
            const fixedPrice = ONE_ETH;
            const quantity = 1;
            const hash = await buy.getMessageHash(
                seller.address,
                0,
                fixedPrice,
                quantity,
                nftMedia.address,
                "0x0000000000000000000000000000000000000000",
                curator.address,
                5,
                buyer.address,
                0)

                
                // console.log(hash);
                const sig = await seller.signMessage(ethers.utils.arrayify(hash))
                // console.log(sig)
            await buy.connect(buyer).buy(
                0,
                nftMedia.address,
                sig ,
                [
                    seller.address,
                    fixedPrice,
                    quantity,
                    "0x0000000000000000000000000000000000000000",
                    buyer.address
                ] ,
                {value: ONE_ETH}
                )
            expect(await nftMedia.ownerOf(0)).to.eq(await buyer.getAddress());
        })
        
        it("should pay the curator their curatorFee percentage", async () => {

            await nftMedia.connect(seller).setApprovalForAll(buy.address, true);
            await nftMedia.mintTo(seller.address, BID_SHARES);
            const fixedPrice = ONE_ETH;
            const quantity = 1;
            const hash = await buy.getMessageHash(
                seller.address,
                0,
                fixedPrice,
                quantity,
                nftMedia.address,
                "0x0000000000000000000000000000000000000000",
                curator.address,
                5,
                "0x0000000000000000000000000000000000000000",
                0)

                const beforeBalance = await ethers.provider.getBalance(
                    await curator.getAddress()
                );
                // console.log(hash);
            const sig = await seller.signMessage(ethers.utils.arrayify(hash))
                // console.log(sig)
            await buy.connect(buyer).buy(
                0,
                nftMedia.address,
                sig ,
                [
                    seller.address,
                    fixedPrice,
                    quantity,
                    "0x0000000000000000000000000000000000000000",
                    "0x0000000000000000000000000000000000000000"
                ] ,
                {value: ONE_ETH}
                )
            const expectedCuratorFee = "50000000000000000";  
            const curatorBalance = await ethers.provider.getBalance(
                await curator.getAddress()
            );  
            await expect(curatorBalance.sub(beforeBalance).toString()).to.eq(
                expectedCuratorFee
            );    
        })    
        it("should transfer the ownerProfit to the seller ", async () => {

            await nftMedia.connect(seller).setApprovalForAll(buy.address, true);
            await nftMedia.mintTo(seller.address, BID_SHARES);
            const fixedPrice = ONE_ETH;
            const quantity = 1;
            const hash = await buy.getMessageHash(
                seller.address,
                0,
                fixedPrice,
                quantity,
                nftMedia.address,
                "0x0000000000000000000000000000000000000000",
                curator.address,
                5,
                "0x0000000000000000000000000000000000000000",
                0)

                const beforeBalance = await ethers.provider.getBalance(
                    await seller.getAddress()
                );
                // console.log(hash);
            const sig = await seller.signMessage(ethers.utils.arrayify(hash))
                // console.log(sig)
            await buy.connect(buyer).buy(
                0,
                nftMedia.address,
                sig ,
                [
                    seller.address,
                    fixedPrice,
                    quantity,
                    "0x0000000000000000000000000000000000000000",
                    "0x0000000000000000000000000000000000000000"
                ] ,
                {value: ONE_ETH}
                )
            const ownersProfit = "950000000000000000";  
            const curatorBalance = await ethers.provider.getBalance(
                await seller.getAddress()
            );  
            await expect(curatorBalance.sub(beforeBalance).toString()).to.eq(
                ownersProfit
            );    
        })     
    })

})
