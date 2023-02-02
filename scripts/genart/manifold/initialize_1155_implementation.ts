import { ethers, network } from "hardhat";

const CREATOR_IMPLEMENTATION_ADDR =
  "0xE299dD06874A0BDb77324589072ad21B654498F2"; // rinkeby

async function main() {
  const [owner] = await ethers.getSigners();

  console.log("Using network:", network.name);
  console.log(
    "Creator 1155 Implementation contract at:",
    CREATOR_IMPLEMENTATION_ADDR
  );
  console.log("Owner account:", owner.address);

  const contract = await ethers.getContractAt(
    "ERC1155CreatorImplementation",
    CREATOR_IMPLEMENTATION_ADDR
  );

  // register extension
  const receipt = await contract.initialize();
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
