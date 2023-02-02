import { ethers } from "hardhat";

async function main() {

        const provider = new ethers.providers.JsonRpcProvider("https://mainnet.infura.io/v3/88f5708376394ee399775a6671cece30");
        const txInfo = await provider.send("eth_getTransactionByHash", [
          "0x04b713fdbbf14d4712df5ccc7bb3dfb102ac28b99872506a363c0dcc0ce4343c",
        ]);
        const blockData = await provider.getBlock("0xc5043f");
        console.log(txInfo);
        console.log(blockData);


}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });