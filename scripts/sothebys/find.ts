
import { ethers } from "hardhat";
import { BigNumber, utils } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

async function main() {
  // Mumbai Addresses

  const accounts = await ethers.getSigners();
  const CREATOR_IMPLEMENTATION_ADDR = "0xC0506043cF38A14c22De6AD51352a73692CA681b";

//   console.log("Using network:", network.name);
//   console.log("Creator Implementation contract at:", CREATOR_IMPLEMENTATION_ADDR);
//   console.log("Owner account:", owner.address);

  const contract = await ethers.getContractAt("Creator1155Proxy", CREATOR_IMPLEMENTATION_ADDR);
    const addr = await contract.implementation()
    console.log(addr);
    

}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error.error);
    process.exit(1);
  });