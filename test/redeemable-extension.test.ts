import chai from "chai";
import chaiAsPromised from "chai-as-promised";
chai.use(chaiAsPromised);
const expect = chai.expect;

import { ethers } from "hardhat";
import { Contract } from "ethers";

const BASE_URI = "ar://placeholder/";

describe("Extension Contract", () => {
  let implementationContract: Contract;
  let creatorContract: Contract;
  let extensionContract: Contract;
  let proxyContract: Contract;

  beforeEach(async () => {
    const wallets = await ethers.getSigners();
    const Implementation = await ethers.getContractFactory("ERC721CreatorImplementation");
    
    // test to deploy implementation from an isolated wallet and that no perm issues emerge
    implementationContract = await Implementation.connect(wallets[3]).deploy();
    await implementationContract.deployed();

    const contractName = "MOJITO";
    await implementationContract.initialize(contractName, "MJT");

    const Creator = await ethers.getContractFactory("Creator721Proxy");
    creatorContract = await Creator.deploy("CANTINA", "CTN", implementationContract.address);
    await creatorContract.deployed();


    const Extension = await ethers.getContractFactory("RedeemableExtension");
    // Extension contract sets the creator contract address in the constructor
    extensionContract = await Extension.deploy(creatorContract.address, 5);
    await extensionContract.deployed();

    // get proxy contract (implementation abi + creator address)
    proxyContract = await ethers.getContractAt("ERC721CreatorImplementation", creatorContract.address);
    await proxyContract["registerExtension(address,string)"](extensionContract.address, BASE_URI);
  });

  it("should unpause extension contract", async () => {
    const status = await extensionContract.paused();
    await extensionContract.unpauseContract();
    const statusAfter = await extensionContract.paused();
    expect(statusAfter).to.equal(false);
  });

  it("extension should have correct max cap", async () => {
    const maxCap = await extensionContract.MAX_CAP()
    expect(await maxCap.toString()).to.equal("5");
  });

  it("should mint correct amount of tokens", async () => {
    const [owner, account2] = await ethers.getSigners();
    await extensionContract.unpauseContract();
    await extensionContract.mintBatch(account2.address, 2);

    const totalTokens = await extensionContract.TOTAL_TOKENS()
    expect(await totalTokens.toString()).to.equal("2");
  });

  it("should fail to mint tokens when exceeding max cap", async () => {
    const [_, account2] = await ethers.getSigners();
    await extensionContract.unpauseContract();
    await extensionContract.mintBatch(account2.address, 2);
    await expect(extensionContract.mintBatch(account2.address, 4)).to.be.rejectedWith(Error);
  });

  it("should return correct tokenURI for extension token", async () => {
    const [_, account2] = await ethers.getSigners();
    
    await extensionContract.setBaseURI(BASE_URI);
    
    await extensionContract.unpauseContract();
    await extensionContract.mintBatch(account2.address, 2);

    const tokenURI = await proxyContract.tokenURI(1);
    expect(tokenURI).to.equal(BASE_URI + "1");
  });

  it('should be able to mint single extension token', async () => {
    const [_, account2] = await ethers.getSigners();
    await extensionContract.unpauseContract();
    await extensionContract.mint(account2.address);

    expect(await extensionContract.TOTAL_TOKENS()).to.equal(1);
  });

  it('REDEEM: Should be able to redeem a token', async () => {
    const [_, account2] = await ethers.getSigners();
    await extensionContract.unpauseContract();
    await extensionContract.mint(account2.address);

    const tokenId = 0;
    expect(await extensionContract.tokenIsRedeemed(tokenId)).to.be.false;
    await extensionContract.redeemToken(tokenId);
    expect(await extensionContract.tokenIsRedeemed(tokenId)).to.be.true;
  });

  it('REDEEM: Should revert if redeem already done', async () => {
    const [_, account2] = await ethers.getSigners();
    await extensionContract.unpauseContract();
    await extensionContract.mint(account2.address);

    const tokenId = 0;
    await extensionContract.redeemToken(tokenId);
    await expect(extensionContract.redeemToken(tokenId)).to.rejectedWith('Token already redeemed');
  });

  it('Only admin can redeem the token', async () => {
    const [_, account2] = await ethers.getSigners();
    await extensionContract.unpauseContract();
    await extensionContract.mint(account2.address);

    const tokenId = 0;
    await expect(extensionContract.connect(account2).redeemToken(tokenId))
        .to.rejectedWith('AdminControl: Must be owner or admin')
  });

  describe("Creator Contract", () => {

    it("should return correct creator contract name", async () => {
      expect(await proxyContract.name()).to.equal("CANTINA");
    });
  
    it("should return correct implementation name", async () => {
      const name = await implementationContract.name();
      expect(name).to.equal("MOJITO");
    });
  
    it("should add an admin to Creator contract", async () => {
      const [_, account2] = await ethers.getSigners();
      await proxyContract.approveAdmin(account2.address);
      const creatorAdmins = await proxyContract.getAdmins();
      expect(creatorAdmins[0]).to.equal(account2.address);
    });

    it("should mint on creator contract", async () => {
      const [_, account2] = await ethers.getSigners();
      
      await proxyContract["mintBase(address)"](account2.address);
  
      const tokenURI = await proxyContract.tokenURI(1);
      expect(tokenURI).to.equal("1");
    });
  
    it("should return correct tokenURI for base(creator) token", async () => {
      const [_, account2] = await ethers.getSigners();
      
      // set extension contract's BaseURI
      await extensionContract.setBaseURI(BASE_URI);
      
      // mint from extension
      await extensionContract.unpauseContract();
      await extensionContract.mintBatch(account2.address, 2); // minting token #1 and #2 from extension
  
      // mint from baseContract
      await proxyContract["mintBase(address)"](account2.address); // minting token #3 from creator
      await proxyContract["setBaseTokenURI(string)"]("yooo/"); // set base uri for creator - excluding all extensions
  
      const tokenURI3 = await proxyContract.tokenURI(3);
      expect(tokenURI3).to.equal("yooo/3");
    });
  })
});
