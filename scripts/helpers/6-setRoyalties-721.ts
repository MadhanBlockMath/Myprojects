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
const Address_1 = "0x1f3A0AE6cb97e1fe0D3eF25c8CdA46cFF1074D8f"
const Address_2 = "0x068d76Ac71C0557c37AfCD54Da9D006BD05a596b"
const Address_3 = "0xB2a983D3fe4905ab1196Ca1Aef2b346e1ea39547"

const Bps_1 = "500"
const Bps_2 = "200"
const Bps_3 = "300"

  const tx = await Erc721Contract.setRoyalties([Address_1,Address_2,Address_3],[Bps_1]);

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
