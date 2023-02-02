import { ethers, network } from "hardhat";

async function main() {
  const [owner] = await ethers.getSigners();

  const Erc721ContractAddress = "0x1344808570E41670f1b82470F209746Cf21A22De";

  console.log("Using network:", network.name);
  console.log("Creator Implementation contract at:", Erc721ContractAddress);
  console.log("Owner account:", owner.address);

  const Erc721Contract = await ethers.getContractAt(
    "ERC721CreatorImplementation",
    Erc721ContractAddress
  );
  const tokenUri =
    "https://live---tim-ferriss-metadata-fc7dztaqfa-uw.a.run.app/metadata/";
  const tx = await Erc721Contract.setBaseTokenURI(tokenUri);

  console.log(`\n adding Base token URI, tx hash: ${tx.hash}`);

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
