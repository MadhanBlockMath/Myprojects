import { ethers } from "hardhat";

async function main() {
  const accounts = await ethers.getSigners();
  const user = accounts[1];
  console.log(user.address);

  const creator = await ethers.getContractFactory("Creator1155Proxy");
  const creatorContractStatus = await creator.connect(user).deploy(
    "0xe9a6095ab5556c5186eeac3234b9ba738cb76721"
  );
  await creatorContractStatus.deployed();

  console.log("Creator contract deployed to:", creatorContractStatus.address);

  const contract = await ethers.getContractAt(
    "ERC1155CreatorImplementation",
    creatorContractStatus.address
  );

  const receipt2 = await contract
    .connect(user)
    ["mintBaseNew(address[],uint256[],string[])"](
      [user.address],
      [1],
      [
        "https://gateway.arweave.net/TCrOsfGKrPEpIIIl4gm1ETjhjg-fCXdxk6Vwmd45NJg",
      ]
    );
  console.log("Waiting for confirmations...");
  const tx2 = await receipt2.wait(1);
  console.log(`Confirmed! Gas used: ${tx2.gasUsed.toString()}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error.error);
    process.exit(1);
  });
