
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
  const ownerAddress = "0xB2a983D3fe4905ab1196Ca1Aef2b346e1ea39547"
  const tokenId = 1 ;
  const quantity = 1;
    const Quantity =await nftMedia.balanceOf(ownerAddress,tokenId);
    console.log(`Quantity acquired by owner :` , Quantity.toString());


  const tx = await nftMedia.burn(ownerAddress, [tokenId],[quantity]);

  console.log(`\n burning, tx hash: ${tx.hash}`);

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