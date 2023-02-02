//Deploying the PriceFeed Contract inorder to fetch the latest price Equivalent for USD in 1WETH/1WMATIC
import { ethers } from "hardhat";

async function main() {
  //ERC20 Address like WETH / WMATIC etc.,
  const currencyAddress = [
    "0xA6FA4fB5f76172d178d61B04b0ecd319C5d1C0aa",
    "0x0000000000000000000000000000000000001010",
  ];

  //Aggregator Price Feed Address provided by Chainlink in Mumbai
  const feedAddress = [
    "0x0715A7794a1dc8e42615F059dD6e406A6594651A",
    "0xd0D5e3DB44DE05E9F294BB0a3bEEaF030DE24Ada",
  ];

  // Deployment: PriceFeed Contract
  const priceFeedContract = await ethers.getContractFactory("PriceFeed");
  const priceFeed = await priceFeedContract.deploy(
    feedAddress,
    currencyAddress
  );
  await priceFeed.deployed();
  console.log(`PriceFeed Contract deployed to: ${priceFeed.address}`);

  //Fetching the Latest price using getlatestPrice with currency address
  const priceData = await priceFeed.getLatestPrice(currencyAddress[0]);
  console.log(priceData[0].toString(), priceData[1].toString());
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error.error);
    process.exit(1);
  });
