
import { ethers } from "hardhat";
import { BigNumber, utils } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

async function main() {
  // Mumbai Addresses

  const accounts = await ethers.getSigners();
  const buyer= "0x068d76Ac71C0557c37AfCD54Da9D006BD05a596b";
  const seller = "0x29F00d7868Adac2AFCc29b3E63Ebd8F269bfCCb6";


  const address = '0x489B2d24C86b579076Fa266f17D881140cB8F83E'
  const marketplace = await ethers.getContractAt(
    "secondryMarket",
    address
  );
  const fixedPrice = utils.parseEther("0.0000000000000001");
  const uuid = "024a81a0-62ff-444b-8772-a0b32aee2dfc";
  const order = [
    uuid,
    6,
    "0x81ca9bCB4D860444dAe8b88045159354443AfAC2",
    BigNumber.from("1"),
    "0x068d76Ac71C0557c37AfCD54Da9D006BD05a596b",
    fixedPrice,
    "0xA6FA4fB5f76172d178d61B04b0ecd319C5d1C0aa",
    0,
    ethers.constants.AddressZero,
    0,
    0,
    buyer,
  ];
  const signParam = order.slice(0, 7);
  const hashedMessage = ethers.utils.solidityKeccak256(
    ["bytes"],
    [
      ethers.utils.solidityPack(
        [
          "string",
          "uint256",
          "address",
          "uint256",
          "address",
          "uint256",
          "address",
        ],
        signParam
      ),
    ]
  );
console.log(hashedMessage);

  const signature = "0x6acd66fc7a32941998b0cb43702ba51ba0f522e6d423071e44d32a3b2f9951d35aefd5606fc1d985eefdc4026208b86eab2ff4aeaffcdf19385f05c23b5125b41c"
  const buy= await marketplace
  .buy(order,signature);
console.log(`Sale Created : ${buy.hash}`);
await buy.wait();

}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error.error);
    process.exit(1);
  });
