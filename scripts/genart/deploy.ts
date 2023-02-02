import { run, ethers, network } from "hardhat";
import { Contract } from "ethers";

const BASE_URI = "https://gateway.arweave.net/TCrOsfGKrPEpIIIl4gm1ETjhjg-fCXdxk6Vwmd45NJg";

async function logReceipt(receipt: any) {
  console.log(`tx hash: ${receipt.hash}, waiting for confirmations...`);
  const tx = await receipt.wait(1);
  console.log(`Gas used: ${tx.gasUsed.toString()}`);
}

async function main() {
  const [owner] = await ethers.getSigners();
  const addr1 = "0xFcd914e807cB395A706D4Fe16CC1635c735F829C";
  console.log("Deploying to network:", network.name);
  console.log("Deploying from account:", owner.address);

  let geneContract: Contract;
  
  const GeneNFT = await ethers.getContractFactory("GeneNFT");
  geneContract = await GeneNFT.deploy("Cantina", "CTNA", BASE_URI,{gasLimit: 25000000000});
  await geneContract.deployed();
  await geneContract.connect(owner).saleStart()
  await geneContract.connect(owner).mintToken(addr1,{gasLimit: 25000000000})
 

  console.log("Mojito NFT Gene contract deployed to:", geneContract.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
