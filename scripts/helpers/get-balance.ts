import { run, ethers, network, web3 } from "hardhat";
import { Contract } from "ethers";

async function main() {
  const [account] = await ethers.getSigners();
  const balance = await web3.eth.getBalance(account.address);
  console.log(`Balance for ${account.address} is ${balance}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
