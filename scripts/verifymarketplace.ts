import { ethers } from "hardhat";
import hre from "hardhat";
import console from "console";

async function main() {

  await hre.run("verify:verify", {
    address: "0x6695F8079609B314c50471D4d2693332e9dDe6C7",
    constructorArguments: [
        "0x9c3C9283D3e44854697Cd22D3Faa240Cfb032889",
        "0xB2a983D3fe4905ab1196Ca1Aef2b346e1ea39547",
        250,
        "0xedA3b6B5009d1656D17d185903AF314c3fCB746B",
        "0x068d76Ac71C0557c37AfCD54Da9D006BD05a596b",
    ],
  });
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error.error);
    process.exit(1);
  });
