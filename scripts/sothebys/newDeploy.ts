//Deploying the PriceFeed Contract inorder to fetch the latest price Equivalent for USD in 1WETH/1WMATIC
import { ethers } from "hardhat";

async function main() {

  const accounts = await ethers.getSigners();
  const platformAddress = accounts[0];
  //ERC20 Address like WETH / WMATIC etc.,
  const wmatic_Mumbai = "0x9c3C9283D3e44854697Cd22D3Faa240Cfb032889";
  const wmatic_Mainnet = "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270";
  const weth_Goerli = "0xB4FBF271143F4FBf7B91A5ded31805e42b2208d6";
  const weth_Mainnet = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";

  const currencyAddress = [
    wmatic_Mumbai,
  ];
  //  pricefeed address for MATIC/USD
  const Matic_mainnet = "0xAB594600376Ec9fD91F8e885dADF0CE036862dE0";
  const Matic_mumbai = "0xd0D5e3DB44DE05E9F294BB0a3bEEaF030DE24Ada";
  //  pricefeed address for ETH/USD
  const Eth_mainnet = "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419";
  const Eth_goerli = "0xD4a33860578De61DBAbDc8BFdb98FD742fA7028e";
  //Aggregator Price Feed Address provided by Chainlink in Mumbai
  const feedAddress = [
    Matic_mumbai,
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



  const platformFee = 5;
  //Marketplace Contract Deployment
  const Buy = await ethers.getContractFactory("secondryMarket");
  const buy = await Buy.deploy(
    wmatic_Mumbai,
    platformAddress.address,
    platformFee,
    priceFeed.address
  );

  await buy.deployed();
  console.log(`Marketplace Contract deployed to: ${buy.address}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
