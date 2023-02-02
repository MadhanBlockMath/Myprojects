import { run, ethers, network } from "hardhat";

const CONTRACT_ADDRESS = "0xb149fe2cf77736476a7b0e8c26d030944b877967"; // rinkeby

async function main() {
  console.log("Using network:", network.name);
  console.log("Using contract at:", CONTRACT_ADDRESS);
  const nftMedia = await ethers.getContractAt("StandardizedZoraNFT", CONTRACT_ADDRESS);

  for (var i = 0; i < 10; ++i) {
    console.log("\nToken ID:", i);
    try {
      console.log("URI:", await nftMedia.tokenURI(i));
      console.log("Owner:", await nftMedia.ownerOf(i));
    } catch (err) {
      console.error("Failed to get URI or owner for token", i);
      console.error(err);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
