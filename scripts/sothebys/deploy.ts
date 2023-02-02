
import { ethers } from "hardhat";
import hre from 'hardhat'

async function main() {
// goreli - 0x4d9b226dad74abfc4b1512fe61d397435205b505 w-0xB4FBF271143F4FBf7B91A5ded31805e42b2208d6
            // pricefeed - 0xb0Bfa67699c9B3bBe969667f64D19d36780Ad523
// mumbai - 0x10554262956614c3d49b19e22e00684cb62126cc w- 0x9c3C9283D3e44854697Cd22D3Faa240Cfb032889
// price feed - 0xedA3b6B5009d1656D17d185903AF314c3fCB746B
  const PROXY_ERC_721_ADDRESS = "0x10554262956614c3d49b19e22e00684cb62126cc";
  const WETH_ADDRESS = "0x9c3C9283D3e44854697Cd22D3Faa240Cfb032889";
  const PRICE_FEED_ADDRESS = "0xedA3b6B5009d1656D17d185903AF314c3fCB746B";
  const adminAddress = "0x1f3A0AE6cb97e1fe0D3eF25c8CdA46cFF1074D8f";

  const curator = "0xB2a983D3fe4905ab1196Ca1Aef2b346e1ea39547";
  const curatorFeePercentage = 250;

const networkName = hre.network.name
const chainId = hre.network.config.chainId

console.log("networkName =",networkName );
console.log("networkChainId =",chainId );

  const MarketPlace = await ethers.getContractFactory("market");
  const marketplace = await MarketPlace.deploy(
    WETH_ADDRESS,
    curator,
    curatorFeePercentage,
    PRICE_FEED_ADDRESS,
    adminAddress
  );
  await marketplace.deployed();
  console.log(`Marketplace Contract deployed to: ${marketplace.address}`);

}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error.error);
    process.exit(1);
  });

