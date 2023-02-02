import { ethers, network } from "hardhat";
import { Contract } from "ethers";


async function main() {
    const [owner] = await ethers.getSigners();

    const CREATOR_IMPLEMENTATION_ADDR = "0xa63a3A478CA4882Ba5FBFefFaeBc34Ea8Ac09432";

    console.log("Using network:", network.name);
    console.log("Creator Implementation contract at:", CREATOR_IMPLEMENTATION_ADDR);
    console.log("Owner account:", owner.address);

    const contract = await ethers.getContractAt("ERC721CreatorImplementation", CREATOR_IMPLEMENTATION_ADDR);

    const receipt = await contract.initialize("NAME", "SYMBOL");
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