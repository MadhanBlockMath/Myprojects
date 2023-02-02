import { ethers, network } from "hardhat";

const CREATOR_IMPLEMENTATION_ADDR = "0x2FAFa7C97e02D53D9b8e345A75dDAd7932cA1a68"; // rinkeby

async function main() {
  const [owner] = await ethers.getSigners();

  console.log("Using network:", network.name);
  console.log("Creator Implementation contract at:", CREATOR_IMPLEMENTATION_ADDR);
  console.log("Owner account:", owner.address);

  const contract = await ethers.getContractAt("ERC721CreatorImplementation", CREATOR_IMPLEMENTATION_ADDR);

  // register extension
  const receipt = await contract.initialize("Mojito", "MOJITO");
  console.log(`\n initializing new name and symbol, tx hash: ${receipt.hash}`);
  console.log("Waiting for confirmations...");
  const tx = await receipt.wait(1);
  console.log(`Confirmed! Gas used: ${tx.gasUsed.toString()}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });