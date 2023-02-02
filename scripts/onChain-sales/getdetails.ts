import { network, ethers } from "hardhat";
import { BigNumber, utils } from "ethers";
import helpers from "@nomicfoundation/hardhat-network-helpers";

async function main() {
  const accounts = await ethers.getSigners();

//   await network.provider.request({
//     method: "hardhat_impersonateAccount",
//     params: ["0xAaD9B42d8704b50575d11482289e3F39F6De84eA"],
//   });
//   const signer = await ethers.provider.getSigner(
//     "0xAaD9B42d8704b50575d11482289e3F39F6De84eA"
//   );
//   console.log("seller address:", signer._address);

  const buy = await ethers.getContractAt(
    "OnchainBuy",
    "0x5f471948745f815b88576466edd09e8694057bef"
  );
  const createdSale = await buy.listings(
    "e172e064-a0a3-413e-ad82-e4f1c415428f"
  );
  const settlementAddress = await buy.getSettlementAddressBps(
    "e172e064-a0a3-413e-ad82-e4f1c415428f"
  );
  const prices = await buy.getListingPrice("e172e064-a0a3-413e-ad82-e4f1c415428f");

  console.log("nftContractAddress: ", createdSale.nftContractAddress);
  console.log("nftStartTokenId: ", createdSale.nftStartTokenId);
  console.log("nftEndTokenId: ", createdSale.nftEndTokenId);
  console.log("minimumFiatPrice: ", createdSale.minimumFiatPrice);
//   console.log("created sale details: ", createdSale.paymentSettlement);
  console.log("paymentSettlementAddress: ", createdSale.paymentSettlement.paymentSettlementAddress);
  console.log("taxSettlementAddress: ", createdSale.paymentSettlement.taxSettlementAddress);
  console.log("platformFeePercentage: ", createdSale.paymentSettlement.platformFeePercentage);
  console.log("maxCap: ", createdSale.maxCap);
  console.log("transactionStatus: ", createdSale.transactionStatus);
  console.log(settlementAddress);
  console.log(prices);
  
  


}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
