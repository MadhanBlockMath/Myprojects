import { ethers, network } from "hardhat";
import { Contract } from "ethers";

const CREATOR_IMPLEMENTATION_ADDR = "0x0E282034580A7d93CC9c09434933445Cb9b932A8";

async function logReceipt(receipt: any) {
  console.log(`tx hash: ${receipt.hash}, waiting for confirmations...`);
  const tx = await receipt.wait(1);
  console.log(`Gas used: ${tx.gasUsed.toString()}`);
}

async function main() {
  const [owner, recipient, bidder] = await ethers.getSigners();
  console.log("Deploying to network:", network.name);
  console.log("Deploying from account:", owner.address);

  let mainContract: Contract;
  
  const MainContract = await ethers.getContractFactory("Main");
  mainContract = await MainContract.deploy("Cantina", "CTN", CREATOR_IMPLEMENTATION_ADDR);
  await mainContract.deployed();

  console.log("Main contract deployed to:", mainContract.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
