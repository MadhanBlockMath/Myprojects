import { ethers } from "hardhat";

async function main() {
 const BASE_URI= "http://gateway.arweave.net/SdGIzr81HLOYp79Zpsg1_UWeCFSvhsLs39qr6GXilDE/"
  const CREATOR_IMPLEMENTATION_ADDR = "0x145B93C98a4A9036b9D92125f8543DC4650382e9";  //Mumbai Polygon
  const CREATOR_IMPLEMENTATION_ADDR_GORELI = "0x4060AB96C4d2ADC8bf147427EbFDd9D3E9Ff1864"
  const Creator = await ethers.getContractFactory("Creator721Proxy");
  const creatorContract = await Creator.deploy("Manifold Tokens", "MANTOK1", CREATOR_IMPLEMENTATION_ADDR_GORELI);
  await creatorContract.deployed();

  console.log("Creator contract deployed to:", creatorContract.address);
  const contract = await ethers.getContractAt("ERC721CreatorImplementation", creatorContract.address);
  const receipt1 = await contract["setBaseTokenURI(string)"](BASE_URI);
  console.log("Waiting for confirmations...");
  const tx1 = await receipt1.wait(1);
  console.log(`Confirmed! Gas used: ${tx1.gasUsed.toString()}`);

  const receipt2 = await contract["mintBase(address)"]("0x068d76Ac71C0557c37AfCD54Da9D006BD05a596b");
  console.log("Waiting for confirmations...");
  const tx2 = await receipt2.wait(1);
  console.log(`Confirmed! Gas used: ${tx2.gasUsed.toString()}`);

  const receipt3 = await contract["setRoyaltiesExtension(address,address[],uint256[])"](contract.address,["0x068d76Ac71C0557c37AfCD54Da9D006BD05a596b","0xC7e893488A039A341d935959E52f86085976F865"],[500,200]);
  console.log("Waiting for confirmations...");
  const tx3 = await receipt3.wait(1);
  console.log(`Confirmed! Gas used: ${tx3.gasUsed.toString()}`);

}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });