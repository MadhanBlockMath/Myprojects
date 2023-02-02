
import { ethers, network } from "hardhat";

async function main() {

const [owner] = await ethers.getSigners();

const Erc721ContractAddress = "0x343BfCD1F1B0C98353ad5Ef146815664b9302176";

console.log("Using network:", network.name);
console.log("Creator Implementation contract at:", Erc721ContractAddress);
console.log("Owner account:", owner.address);

const Erc721Contract = await ethers.getContractAt(
    "ERC721CreatorImplementation",
    Erc721ContractAddress
  );
const adminAddress = "0x931a91180082E4863dF501874c4C1C860820E224"
  const tx = await Erc721Contract.approveAdmin(adminAddress);

  console.log(`\n adding admin, tx hash: ${tx.hash}`);

  console.log("Waiting for confirmations...");
  const txhash = await tx.wait(1);

  console.log(`Confirmed! Gas used: ${txhash.gasUsed.toString()}`);

}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });