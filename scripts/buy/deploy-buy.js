// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
const hre = require("hardhat");

async function main() {
  // Mumbai Addresses
  const PROXY_ERC_721_ADDRESS = "0xA61b3D7d9DE0733e83D5961Aa473635C28F8a4c5";
  const WETH_ADDRESS = "0xA6FA4fB5f76172d178d61B04b0ecd319C5d1C0aa";

    // User Object
    // const accounts = await ethers.getSigners();
    // const user = accounts[0];  

  // Deployment: BuyNow Contract
  const buyContract = await hre.ethers.getContractFactory("Buy");
  const buyStatus = await buyContract.deploy(
    PROXY_ERC_721_ADDRESS,
    WETH_ADDRESS
  );

  await buyStatus.deployed();
  console.log(`Buy Contract deployed to: ${buyStatus.address}`);

}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
