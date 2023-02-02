import chai from "chai";
import chaiAsPromised from "chai-as-promised";
chai.use(chaiAsPromised);
const expect = chai.expect;

import { ethers } from "hardhat";
import { Contract } from "ethers";

const BASE_URI = "https://arweave.net/placeholder/";

describe("Gene NFT", () => {
  let geneContract: Contract;

  beforeEach(async () => {
    const GeneNFT = await ethers.getContractFactory("GeneNFT");
    geneContract = await GeneNFT.deploy("Cantina", "CTNA", BASE_URI);
    await geneContract.deployed();
  });

  it("should fail to mint token when contract sale is not active", async () => {
    const [owner, addr1] = await ethers.getSigners();
    await expect(geneContract.connect(owner).mintToken(addr1.address)).to.be.rejectedWith("Sale must be active to mint token");
  });

  it("should activate contract sale status", async () => {
    const [owner, addr1] = await ethers.getSigners();
    await geneContract.connect(owner).saleStart()
    expect(await geneContract.saleIsActive()).to.equal(true);
  });

  it("should mint a token", async () => {
    const [owner, addr1] = await ethers.getSigners();
    await geneContract.connect(owner).saleStart()
    await geneContract.connect(owner).mintToken(addr1.address)
    const balanceOf = await geneContract.balanceOf(addr1.address)
    expect(balanceOf.toString()).to.equal("1");
  });

  it("should fail when non-admin tries to mint token", async () => {
    const [owner, addr1] = await ethers.getSigners();
    await geneContract.connect(owner).saleStart()
    await expect(geneContract.connect(addr1).mintToken(addr1.address)).to.be.rejectedWith(Error);
  });

  it("should add account as admin", async () => {
    const [owner, addr1] = await ethers.getSigners();

    await geneContract.connect(owner).addAdmin(addr1.address)
    await geneContract.connect(addr1).saleStart()

    //checks if addr1 is able to call saleStart() - an onlyAdmin function
    expect(await geneContract.saleIsActive()).to.equal(true);
  });

  it("should remove account as admin", async () => {
    const [owner, addr1] = await ethers.getSigners();
    await geneContract.connect(owner).addAdmin(addr1.address)
    await geneContract.connect(owner).removeAdmin(addr1.address)

    //checks if addr1 is able to call saleStart() - an onlyAdmin function
    await expect(geneContract.connect(addr1).saleStart()).to.be.rejectedWith(Error)
  });

  it("should return correct tokenURI", async () => {
    const [owner, addr1] = await ethers.getSigners();
    await geneContract.connect(owner).saleStart()
    await geneContract.connect(owner).mintToken(addr1.address)
    expect(await geneContract.tokenURI(1)).to.equal(BASE_URI + "1");
  });

  it("should update baseURI", async () => {
    const [owner, addr1] = await ethers.getSigners();
    await geneContract.connect(owner).saleStart()
    await geneContract.connect(owner).mintToken(addr1.address)
    await geneContract.connect(owner).mintToken(addr1.address)
    await geneContract.connect(owner).setBaseURI("ar://mojito/")
    
    expect(await geneContract.tokenURI(2)).to.equal("ar://mojito/2");
  });
});
