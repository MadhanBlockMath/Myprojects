import { ethers, network } from "hardhat";

const EXTENSION_ADDR = "0xDF9AC85489bb4858D75699653fb391937474a9Df"; // Genart or Provenance Extensions
const MAIN_ADDR = "0x58fe7856C28Eba9A0025781A3Db23Cc82f22368D"; // main.sol
const CREATOR_IMPLEMENTATION_ADDR = "0x4bE72E9eE725aE1951793aE4C43142d5201cD4ce"

const BASE_URI = "ar://placeholder/";

async function main() {
  const [owner] = await ethers.getSigners();

  console.log("Using network:", network.name);
  console.log("Main contract at:", MAIN_ADDR);
  console.log("Owner account:", owner.address);

  // register extension
  // use implementation ABI with creator/proxy address
  const contract = await ethers.getContractAt("ERC721CreatorImplementation", MAIN_ADDR);

  const name = await contract.name();
  console.log("name: ", name)

  const receipt = await contract["registerExtension(address,string)"](EXTENSION_ADDR, BASE_URI);
  console.log(`\n registering ${EXTENSION_ADDR} as extension contract, tx hash: ${receipt.hash}`);
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