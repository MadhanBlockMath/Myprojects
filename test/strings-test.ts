import chai from "chai";
import chaiAsPromised from "chai-as-promised";
chai.use(chaiAsPromised);
const expect = chai.expect;

import { ethers } from "hardhat";
import { Contract } from "ethers";

describe("StringsTest test", () => {
  let contract: Contract;

  beforeEach(async () => {
    const ContractFactory = await ethers.getContractFactory("StringsTest");
    contract = await ContractFactory.deploy();
  });

  it("should uint2str", async () => {
    expect(await contract.uint2str(0)).to.equal("0");
    expect(await contract.uint2str(1)).to.equal("1");
  });

  it("should concatStrAndNum", async () => {
    expect(await contract.concatStrAndNum("foo", 0)).to.equal("foo0");
    expect(await contract.concatStrAndNum("foo", 1)).to.equal("foo1");
  });
});
