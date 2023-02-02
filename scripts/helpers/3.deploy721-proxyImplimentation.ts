import { ethers, network } from "hardhat";
import { Contract } from "ethers";


async function main() {
    const [owner] = await ethers.getSigners();

    let PROXY_ERC_721_ADDRESS: Contract;
    
    const CREATOR_IMPLEMENTATION_ADDR = "0xa63a3A478CA4882Ba5FBFefFaeBc34Ea8Ac09432";

    console.log("Using network:", network.name);
    console.log("Creator Implementation contract at:", CREATOR_IMPLEMENTATION_ADDR);
    console.log("Owner account:", owner.address);

    const Creator721Proxy = await ethers.getContractFactory("Creator721Proxy");
    PROXY_ERC_721_ADDRESS = await Creator721Proxy.deploy(
        "Name",
        "symbol",
        CREATOR_IMPLEMENTATION_ADDR
    )
    await PROXY_ERC_721_ADDRESS.deployed();

    console.log("Proxy Implementation contract deployed to:", PROXY_ERC_721_ADDRESS.address);

}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });