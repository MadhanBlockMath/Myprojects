import { run, ethers, network } from "hardhat";
import { Contract } from "ethers";
import { Zora, constructBid, Decimal, approveERC20 } from '@zoralabs/zdk';

const MINT_NUM = 5;
const TEST_BIDDING = true;
const BID_WITH_ZDK = false;
const TRANSFER_TOKENS = false;

// OpenSea proxy registry addresses:
let proxyRegistryAddress = "0x0000000000000000000000000000000000000000";
if (network.name === "rinkeby") {
  proxyRegistryAddress = "0xf57b2c51ded3a29e6891aba85459d600256cf317";
} else if (network.name === "mainnet") {
  proxyRegistryAddress = "0xa5409ec958c83c3f309868babaca7c86dcb077c1";
}

let currencyAddress = "";
const CONTRACT_ADDRESS = "";
const MARKET_CONTRACT_ADDRESS = "";
// rinkeby contracts:
// let currencyAddress = "0xc778417e063141139fce010982780140aa0cd5ab"; // WETH
// const CONTRACT_ADDRESS = "0xB8139e8276Bc109a799CcDB9A9Be96ee7BD80b79";
// const MARKET_CONTRACT_ADDRESS = "0x25fE26604bCA79C357495334bce261F1cA3206D9";

const CONTRACT_METADATA_URI = "http://ipfs.io/ipfs/QmT5vJ53pbrZ3NhUk7o1fYLUfB6Qfui4nDhD1FBZFsy4sH";
const BASE_URI = "https://arweave.net/oUbZMh4SJ-98Xot0kEhsKmyyf-wMOEbDNFgUpc_dJfI/";
const BASE_URI_SUFFIX = ".json";

const BID_SHARES = {
  prevOwner: Decimal.new(10),
  owner: Decimal.new(80),
  creator: Decimal.new(10),
};

async function logReceipt(receipt: any) {
  console.log(`tx hash: ${receipt.hash}, waiting for confirmations...`);
  const tx = await receipt.wait(1);
  console.log(`Gas used: ${tx.gasUsed.toString()}`);
}

async function main() {
  const [owner, recipient, bidder] = await ethers.getSigners();
  console.log("Deploying to network:", network.name);
  console.log("Deploying from account:", owner.address);

  let nftMarket: Contract;
  if (MARKET_CONTRACT_ADDRESS) {
    console.log("Using NFT market contract at:", MARKET_CONTRACT_ADDRESS);
    nftMarket = await ethers.getContractAt("ZoraNFTMarket", MARKET_CONTRACT_ADDRESS);
  } else {
    const NFTMarket = await ethers.getContractFactory("ZoraNFTMarket");
    nftMarket = await NFTMarket.deploy();
    await nftMarket.deployed();
    console.log("Sero NFT market contract deployed to:", nftMarket.address);
  }

  let nftMedia: Contract;
  if (CONTRACT_ADDRESS) {
    console.log("Using NFT media contract at:", CONTRACT_ADDRESS);
    nftMedia = await ethers.getContractAt("StandardizedZoraNFT", CONTRACT_ADDRESS);
  } else {
    const NFTMedia = await ethers.getContractFactory("StandardizedZoraNFT");
    nftMedia = await NFTMedia.deploy("Sero NFT", "SFT", BASE_URI, BASE_URI_SUFFIX, CONTRACT_METADATA_URI, nftMarket.address, proxyRegistryAddress);
    await nftMedia.deployed();
    console.log("Sero NFT media contract deployed to:", nftMedia.address);

    await nftMarket.configure(nftMedia.address);
    console.log("Sero NFT market configured with NFT media contract address");
  }

  let currencyContract: Contract;
  if (TEST_BIDDING) {
    if (currencyAddress) {
      console.log("Using ERC20 contract at:", currencyAddress, "- this might not work if our ERC20 ABI doesn't match the contract!");
      currencyContract = await ethers.getContractAt("TestERC20", CONTRACT_ADDRESS);
    } else {
      const CurrencyContract = await ethers.getContractFactory("TestERC20");
      currencyContract = await CurrencyContract.deploy("test", "TEST", 18);
      currencyAddress = currencyContract.address;
      console.log("\nERC20 token TEST deployed to:", currencyAddress);
      await currencyContract.mint(bidder.address, 10000);
      console.log("Minted 10000 TEST to bidder", bidder.address);
    }
  }

  console.log(`\nMinting ${MINT_NUM} tokens...`);
  await logReceipt(await nftMedia.mintBatchTo(owner.address, MINT_NUM, BID_SHARES, { gasLimit: 8000000 }));
  for (let i = 0; i < MINT_NUM; ++i) {
    console.log(`Token ${i} URI:`, await nftMedia.tokenURI(i));
  }

  if (TEST_BIDDING) {
    console.log("\nOwner of token 0 is:", await nftMedia.ownerOf(0));
    console.log("\nSetting ask of 100 TEST...");
    await logReceipt(await nftMedia.setAsk(0, {
      currency: currencyAddress,
      amount: 100,
      sellOnShare: Decimal.new(0),
    }));

    if (BID_WITH_ZDK) {
      const zora = new Zora(
        bidder as any,
        network.name === "rinkeby" ? 4 : 50,
        nftMedia.address,
        nftMarket.address
      );
      console.log("\nToken 0 URI via ZDK:", await zora.fetchContentURI(0));

      console.log("\nBidder approving market contract to spend 100 TEST via ZDK approveERC20 helper...");
      await logReceipt(await approveERC20(bidder as any, currencyAddress, zora.marketAddress, 100));

      const bid = constructBid(
        currencyAddress,
        Decimal.new(100).value,
        bidder.address,
        bidder.address,
        10,
      )
      console.log("\nBidder setting bid of 100 TEST via ZDK...");
      console.log("This will break and I'm not yet sure why!");
      await logReceipt(await zora.setBid(0, bid));
    } else {
      console.log("\nBidder approving market contract to spend 100 TEST...");
      await logReceipt(await currencyContract!.connect(bidder).approve(nftMarket.address, 100));

      console.log("\nBidder setting bid of 100 TEST...");
      await logReceipt(await nftMedia.connect(bidder).setBid(0, {
        amount: 100,
        currency: currencyAddress,
        bidder: bidder.address,
        recipient: bidder.address,
        sellOnShare: Decimal.new(10),
      }));
    }

    console.log("\nOwner of token 0 is now:", await nftMedia.ownerOf(0));

  } else if (TRANSFER_TOKENS) {
    const range = (n: number) => [...Array(n).keys()];
    console.log(`\nTransferring ${MINT_NUM} tokens...`);
    await logReceipt(await nftMedia.batchTransferFrom(owner.address, recipient.address, range(MINT_NUM), { gasLimit: 8000000 }));
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
