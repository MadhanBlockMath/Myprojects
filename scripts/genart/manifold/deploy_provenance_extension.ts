import { ethers, network } from "hardhat";
import { Contract } from "ethers";

const CREATOR_ADDR = "0x676CB6AE77a474f8570489151e1b9C08230310ed"; // old: 0x58fe7856C28Eba9A0025781A3Db23Cc82f22368D
const MAX_CAP = 139968;

async function logReceipt(receipt: any) {
  console.log(`tx hash: ${receipt.hash}, waiting for confirmations...`);
  const tx = await receipt.wait(1);
  console.log(`Gas used: ${tx.gasUsed.toString()}`);
}

async function main() {
  const [owner, recipient, bidder] = await ethers.getSigners();
  console.log("Deploying to network:", network.name);
  console.log("Deploying from account:", owner.address);

  let extensionContract: Contract;
  
  const Extension = await ethers.getContractFactory("ProvenanceExtension");
  extensionContract = await Extension.deploy(CREATOR_ADDR, MAX_CAP);
  await extensionContract.deployed();

  console.log("Extension contract deployed to:", extensionContract.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
