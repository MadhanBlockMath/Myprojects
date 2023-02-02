import { ethers } from "hardhat";
import { utils } from "ethers";

async function main() {
  // Mumbai Addresses
  const PROXY_ERC_721_ADDRESS = "0xA61b3D7d9DE0733e83D5961Aa473635C28F8a4c5";
  const WETH_ADDRESS = "0xA6FA4fB5f76172d178d61B04b0ecd319C5d1C0aa";
  const BUYNOW_ADDRESS = "0xBD3b02041AAB0bd37AA205fd858Fd47b10889734";

  // User Object
  const accounts = await ethers.getSigners();
  const user = accounts[0];
  const buyer = accounts[1];

  const verifyFlag: string = "CANCEL_SALE";

  console.log("USER::" + user.address);

  // Verification 1: Create Sale
  // Verification 1.1: Create Sale: Approve user address to utilize Buynow contract
  const nftMedia1 = await ethers.getContractAt(
    "ERC721CreatorImplementation",
    PROXY_ERC_721_ADDRESS
  );
  const approveForAllTx1 = await nftMedia1
    .connect(user)
    .setApprovalForAll(BUYNOW_ADDRESS, true);
  console.log(`Approve transaction submitted to: ${approveForAllTx1.hash}`);
  await approveForAllTx1.wait(1);

  // Verification 1.2: Create Sale: Create Sale for providing buy option
  const buyNowContractObj1 = await ethers.getContractAt(
    "BuyNow",
    BUYNOW_ADDRESS
  );
  const createSale1 = await buyNowContractObj1
    .connect(user)
    .createSale(
      5,
      PROXY_ERC_721_ADDRESS,
      utils.parseEther("0.00001"),
      "0x0000000000000000000000000000000000000000",
      0,
      WETH_ADDRESS
    );
  console.log(`Sale Created : ${createSale1.hash}`);
  await createSale1.wait();

  // Verification 2: Buynow
  // Verification 1.1: Buynow: Approve WETH to utilize Buynow contract
  const weth = await ethers.getContractAt("WETH", WETH_ADDRESS);
  const approveTx = await weth
    .connect(user)
    .approve(BUYNOW_ADDRESS, utils.parseEther("0.00001"));
  console.log(`WETH Approval completed: ${approveTx.hash}`);
  await approveTx.wait();

  // Verification 1.2: BuyNow: Execute buynow and end sale.
  const buyNowContractObj3 = await ethers.getContractAt(
    "BuyNow",
    BUYNOW_ADDRESS
  );
  const BuyNow = await buyNowContractObj3
    .connect(user)
    .buy(4, utils.parseEther("0.00001"));
  console.log(`Buy Completed : ${BuyNow.hash}`);
  await BuyNow.wait();

  // Verification 3.1: Cancel Sale: Execute Cancel Sale and close the sale.
  const buyNowContractObj = await ethers.getContractAt(
    "BuyNow",
    BUYNOW_ADDRESS
  );
  const createSale = await buyNowContractObj.connect(user).cancelSale(3);
  console.log(`Sale Cancelled : ${createSale.hash}`);
  await createSale.wait();
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error.error);
    process.exit(1);
  });
