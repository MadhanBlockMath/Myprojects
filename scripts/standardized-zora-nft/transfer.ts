import { run, ethers, network } from "hardhat";

// const CONTRACT_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3"; // hardhat
const CONTRACT_ADDRESS = "0x0d1f554006bb8099aB9ABaE7627a1Db5521CA28E"; // rinkeby
const TO_ADDR = "";
const TOKEN_IDS_TO_TRANSFER = [2, 3];

if (!TO_ADDR) {
  throw Error("Must supply an address to transfer to");
}

async function main() {
  const [owner] = await ethers.getSigners();

  console.log("Using network:", network.name);
  console.log("Using contract at:", CONTRACT_ADDRESS);
  console.log("Transferring from account:", owner.address);
  console.log("Transferring to account:", TO_ADDR);
  console.log("Transferring tokens:", TOKEN_IDS_TO_TRANSFER);

  const nftMedia = await ethers.getContractAt("StandardizedZoraNFT", CONTRACT_ADDRESS);

  const receipt = await nftMedia.safeBatchTransferFrom(owner.address, TO_ADDR, TOKEN_IDS_TO_TRANSFER);

  console.log(`\n${TOKEN_IDS_TO_TRANSFER.length} tokens transferred, tx hash: ${receipt.hash}`);
  console.log("Waiting for confirmations...");
  const tx = await receipt.wait(1);
  console.log(`Gas used: ${tx.gasUsed.toString()}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
