import { ethers } from "hardhat";
import { Signer } from "ethers";

describe("Sample", function () {
  let accounts: Signer[];

  beforeEach(async function () {
    accounts = await ethers.getSigners();
  });

  it("should pass the empty sample test", async function () {
    // Do something with the accounts
  });
});
