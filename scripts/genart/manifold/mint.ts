import { ethers, network } from "hardhat";

const EXTENSION_ADDR = "0xDF9AC85489bb4858D75699653fb391937474a9Df"; // provenance, rinkeby

async function main() {
  const [owner] = await ethers.getSigners();

  console.log("Using network:", network.name);
  console.log("Extension contract at:", EXTENSION_ADDR);
  console.log("Owner account:", owner.address);

  const contract = await ethers.getContractAt("ProvenanceExtension", EXTENSION_ADDR);

  // unpause contract
  const receipt1 = await contract.unpauseContract();
  console.log(`\n unpausing extension contract, tx hash: ${receipt1.hash}`);
  console.log("Waiting for confirmations...");
  const tx1 = await receipt1.wait(1);
  console.log(`Confirmed! Gas used: ${tx1.gasUsed.toString()}`);
  
  Genart
  const boostToBytes32 = ethers.utils.hexZeroPad(ethers.utils.hexlify(2), 32);
  const receipt2 = await contract.mint("0x2A187C270D746F40889a13Feeade39F459206652", boostToBytes32);

  mint to address
  NOTE: must first register extension in creator contract
  const receipt2 = await contract.mintBatch("0x2A187C270D746F40889a13Feeade39F459206652", 2);
  console.log(`\n minting, tx hash: ${receipt2.hash}`);
  console.log("Waiting for confirmations...");
  const tx2 = await receipt2.wait(1);
  console.log(`Confirmed! Gas used: ${tx2.gasUsed.toString()}`);

  query token
  const tokenInfo = await contract.tokens("1");
  console.log(`\n token: ${tokenInfo.toString()}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });