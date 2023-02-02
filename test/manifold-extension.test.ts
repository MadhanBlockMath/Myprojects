import chai from "chai";
import chaiAsPromised from "chai-as-promised";
chai.use(chaiAsPromised);
const expect = chai.expect;

import { ethers } from "hardhat";
import { Contract } from "ethers";

const BASE_URI = "ar://placeholder/";

describe("Manifold with Extension", () => {
  let implementationContract: Contract;
  let creatorContract: Contract;
  let extensionContract: Contract;
  let proxyContract: Contract;

  beforeEach(async () => {
    const Implementation = await ethers.getContractFactory("ERC721CreatorImplementation");
    implementationContract = await Implementation.deploy();
    await implementationContract.deployed();

    const contractName = "MOJITO";
    await implementationContract.initialize(contractName, "MJT");

    // Main.sol creates an instance of Creator.sol
    const Creator = await ethers.getContractFactory("Main");
    creatorContract = await Creator.deploy("CANTINA", "CTN", implementationContract.address);
    await creatorContract.deployed();


    const Extension = await ethers.getContractFactory("GenartExtension");
    // Extension contract sets the creator contract address in the constructor
    extensionContract = await Extension.deploy(creatorContract.address);
    await extensionContract.deployed();

    // get proxy contract (implementation abi + creator address)
    proxyContract = await ethers.getContractAt("ERC721CreatorImplementation", creatorContract.address);
    //proxyContract = await Implementation.attach(creatorContract.address)
  });

  it("should return correct proxy name", async () => {
    expect(await proxyContract.name()).to.equal("CANTINA");
  });

  it("should return correct implementation name", async () => {
    const name = await implementationContract.name();
    expect(name).to.equal("MOJITO");
  });

  it("should add an admin to Creator contract", async () => {
    const [owner, account2] = await ethers.getSigners();
    await proxyContract.approveAdmin(account2.address);
    const creatorAdmins = await proxyContract.getAdmins();
    expect(creatorAdmins[0]).to.equal(account2.address);
  });

  it("should register Extension contract to Creator contract", async () => {
    await proxyContract["registerExtension(address,string)"](extensionContract.address, BASE_URI);
  });
});
