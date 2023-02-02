import { network,ethers } from "hardhat";
import { BigNumber, utils } from "ethers";
import helpers from "@nomicfoundation/hardhat-network-helpers"
const ONE_ETH = ethers.utils.parseUnits("1", "ether") as BigNumber;

async function main() {
  const accounts = await ethers.getSigners();
  let platform = accounts[0];
  let seller = accounts[1];
  let buyer = accounts[0];
  let royaltyRecipient1 = "0xe3d32951C8BA72198207c2F36913aFA5ccA39476";
  let royaltyRecipient2 = accounts[0];
  let paymentSettlementAddress = accounts[1];
  let taxSettlementAddress = accounts[0];
  const platformAddress1 = accounts[2];
  const commessionAddress1 = accounts[3];
  const erc721 = "0x525F052B35e64eD27f9B9e8afC76Ea54D89DBd3A";
  const platformFeePercentage = 250;
  const saleId = "dcaf40b6-dfd8-4e72-995b-2ddc8382b108";
  const saleid = "8328eca9-b6e7-437c-87ef-9cf22d4c4"
  const BASE_URI =
    "https://arweave.net/oUbZMh4SJ-98Xot0kEhsKmyyf-wMOEbDNFgUpc_dJfI/";
  const tokenIdStart = BigNumber.from("1");
  const tokenIdEnd = BigNumber.from("10");
  const maxCap = BigNumber.from("100");
  const mint = BigNumber.from("0");
  const tax = BigNumber.from("1000");
  const transfer = BigNumber.from("1");
  const fiat = BigNumber.from("0")
  const crypto = BigNumber.from("1")
  let amount : BigNumber;
  console.log("buyer address:", buyer.address);
  console.log("seller address:", seller.address);
  const Pricefeedatest = "0x525F052B35e64eD27f9B9e8afC76Ea54D89DBd3A"

  // var acctAddress = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
  // await helpers.impersonateAccount(acctAddress);
  // const impersonatedSigner = await ethers.getSigner(acctAddress);

  await network.provider.request({
    method: "hardhat_impersonateAccount",
    params: ["0xAaD9B42d8704b50575d11482289e3F39F6De84eA"],
  });
  const signer = await ethers.provider.getSigner(
    "0xAaD9B42d8704b50575d11482289e3F39F6De84eA"
  );
  console.log("seller address:", signer._address);
  // const ERC721CreatorImplementation = await ethers.getContractFactory(
  //   "ERC721CreatorImplementation"
  // );
  // const erc721CreatorImplementation =
  //   await ERC721CreatorImplementation.deploy();
  // await erc721CreatorImplementation.deployed();
  // console.log(
  //   `ERC721CreatorImplementation address: ${erc721CreatorImplementation.address}`
  // );

  // const Creator721Proxy = await ethers.getContractFactory("Creator721Proxy");
  // const nftMedia721 = await Creator721Proxy.deploy(
  //   "Ionixx NFT",
  //   "INX",
  //   erc721CreatorImplementation.address
  // );
  // await nftMedia721.deployed();
  // console.log(
  //   `ERC721CreatorImplementation proxy address: ${nftMedia721.address}`
  // );
  // const Erc721Contract = await ethers.getContractAt(
  //   "ERC721CreatorImplementation",
  //   nftMedia721.address
  // );
  // const currencyAddress = [ethers.constants.AddressZero];
  // const feedAddress = ["0xD4a33860578De61DBAbDc8BFdb98FD742fA7028e"];
  // const heartBeat = [3600]
  // const priceFeedContract = await ethers.getContractFactory("FeedData");
  // let priceFeed = await priceFeedContract.deploy(
  //   feedAddress,
  //   currencyAddress,
  //   heartBeat,
  //   platform.address,
  // );
  // await priceFeed.deployed();
  // console.log("pricefeed address :",priceFeed.address);
  
  // amount = await priceFeed.getLatestPrice(1000, ethers.constants.AddressZero);
  // console.log(amount);

  // // setting base uri for erc721
  // await Erc721Contract.setBaseTokenURI(BASE_URI);

  // // Minting a Token
  // await Erc721Contract["mintBaseBatch(address,uint16)"](seller.address, 10);

  // await Erc721Contract["setRoyalties(address[],uint256[])"](
  //   [royaltyRecipient1],
  //   [8500]
  // );

  // const Sol = await ethers.getContractFactory("TestERC20");
  // const sol = await Sol.deploy("Solana", "SOL", 18);
  // await sol.deployed();
  // console.log(`Sol address: ${sol.address}`);
  // await sol.mint(buyer.address, ONE_ETH);

  const buy = await ethers.getContractAt("OnchainBuy","0xabFf99770B3a539C9FaD773A5520519970209622");
  // const Buy = await ethers.getContractFactory("buyListing");

  // const buy = await Buy.connect(platform).deploy(
  //   platform.address,
  //   platformFeePercentage,
  //   1000,
  //   priceFeed.address
  // );
  // await buy.deployed();
  console.log(`onchain buy contract address: ${buy.address}`);

  // await Erc721Contract.connect(seller).setApprovalForAll(buy.address, true);
  // await sol.connect(buyer).approve(buy.address, ONE_ETH);

  const order1 = [
    erc721,
    tokenIdStart,
    tokenIdEnd,
    1,
    [],
    [],
    [
      paymentSettlementAddress.address,
      taxSettlementAddress.address,
      platformAddress1.address,
      250,
      commessionAddress1.address,
      100,
    ],
    0,
    transfer,
    fiat,
  ];
  // await Erc721Contract["registerExtension(address,string)"](
  //   buy.address,
  //   BASE_URI
  // );

  // await Erc721Contract.setRoyaltiesExtension(
  //   buy.address,
  //   [royaltyRecipient1],
  //   [8500]
  // );

  const tx = await buy.connect(signer).createSale(order1, saleId);

  console.log(`\n Creating Sale, tx hash: ${tx.hash}`);

  console.log("Waiting for confirmations...");

  const txhash = await tx.wait();

  console.log(
    `Confirmed! Gas used for creating sale: ${txhash.gasUsed.toString()}`
  );
  // const ONE_ETH = ethers.utils.parseUnits("1", "ether") as BigNumber;
  // const price = BigNumber.from("1200000000000000000")
  // const buyList = [
  //   saleId,
  //   seller.address,
  //   1,
  //   1,
  //   buyer.address,
  //   1,
  //   ethers.constants.AddressZero,
  //   price,
  // ];

  // const buyTx = await buy.connect(buyer).buy(buyList,tax, { value: price.add(tax)});

  // console.log(`\n buying the Nft, buyTx hash: ${buyTx.hash}`);

  // console.log("Waiting for confirmations...");

  // const buytxhash = await buyTx.wait(1);

  // console.log(
  //   `Confirmed! Gas used for buying the token: ${buytxhash.gasUsed.toString()}`
  // );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
