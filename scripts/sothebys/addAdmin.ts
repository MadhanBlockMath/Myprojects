
import { ethers } from "hardhat";
import { BigNumber, utils } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

async function main() {

const accounts = await ethers.getSigners();

const nftAddress = "0xA34295d3C44C0F419631D79bE46f4B855300A126";

const nftMedia = await ethers.getContractAt(
    "ERC1155CreatorImplementation",
    nftAddress

  );
const admin = "0x931a91180082E4863dF501874c4C1C860820E224"
  const tx = await nftMedia.approveAdmin(admin);

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