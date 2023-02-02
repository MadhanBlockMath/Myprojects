import { ethers } from "hardhat";

async function main() {
  // Mumbai Addresses
  const PROXY_ERC_721_ADDRESS = "0xA61b3D7d9DE0733e83D5961Aa473635C28F8a4c5";
  const WETH_ADDRESS = "0xA6FA4fB5f76172d178d61B04b0ecd319C5d1C0aa";

  // User Object
  const accounts = await ethers.getSigners();
  const user = accounts[0];
  const curator = accounts[1];
  const curatorFeePercentage = 5
  // Deployment: BuyNow Contract
  const buynowContractDObj = await ethers.getContractFactory("BuyNow");
  const buynowStatus = await buynowContractDObj.deploy(
    PROXY_ERC_721_ADDRESS,
    WETH_ADDRESS,
    curator,
    curatorFeePercentage
  );
  await buynowStatus.deployed();
  console.log(`BuyNow Contract deployed to: ${buynowStatus.address}`);

}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error.error);
    process.exit(1);
  });
