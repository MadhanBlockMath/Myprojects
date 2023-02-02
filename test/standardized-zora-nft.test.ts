import chai from "chai";
import chaiAsPromised from "chai-as-promised";
chai.use(chaiAsPromised);
const expect = chai.expect;

import { ethers } from "hardhat";
import { Signer, Contract } from "ethers";
import { Decimal } from '@zoralabs/zdk';

const BASE_URI = "https://arweave.net/oUbZMh4SJ-98Xot0kEhsKmyyf-wMOEbDNFgUpc_dJfI/";
const BASE_URI_SUFFIX = ".json";
const CONTRACT_METADATA_URI = "http://ipfs.io/ipfs/QmT5vJ53pbrZ3NhUk7o1fYLUfB6Qfui4nDhD1FBZFsy4sH";
const PROXY_REGISTRY_ADDRESS = "0x0000000000000000000000000000000000000000";

const BID_SHARES = {
  prevOwner: Decimal.new(10),
  owner: Decimal.new(80),
  creator: Decimal.new(10),
};

describe("Standardized Zora NFT", () => {
  let nftMedia: Contract;

  beforeEach(async () => {
    const NFTMarket = await ethers.getContractFactory("ZoraNFTMarket");
    const nftMarket = await NFTMarket.deploy();
    await nftMarket.deployed();

    const NFTMedia = await ethers.getContractFactory("StandardizedZoraNFT");
    nftMedia = await NFTMedia.deploy("Sero NFT", "SFT", BASE_URI, BASE_URI_SUFFIX, CONTRACT_METADATA_URI, nftMarket.address, PROXY_REGISTRY_ADDRESS);
    await nftMarket.configure(nftMedia.address);
  });

  it("should mint to a given address and confirm ownership", async () => {
    const [owner, addr1] = await ethers.getSigners();
    await nftMedia.mintTo(addr1.address, BID_SHARES);
    expect(await nftMedia.ownerOf(0)).to.equal(addr1.address);
    expect(await nftMedia.tokenURI(0)).to.equal(`${BASE_URI}0${BASE_URI_SUFFIX}`);
  });

  it("should batch mint tokens", async () => {
    const [owner] = await ethers.getSigners();
    await nftMedia.mintBatchTo(owner.address, 5, BID_SHARES);
    for (let i = 0; i < 5; i++) {
      expect(await nftMedia.ownerOf(i)).to.equal(owner.address);
      expect(await nftMedia.tokenURI(i)).to.equal(`${BASE_URI}${i}${BASE_URI_SUFFIX}`);
    }
  });

  it("should supports changing base URI", async () => {
    const [owner, addr1] = await ethers.getSigners();
    await nftMedia.mintTo(owner.address, BID_SHARES);

    expect(await nftMedia.tokenURI(0)).to.equal(`${BASE_URI}0${BASE_URI_SUFFIX}`);

    const newBaseURI = "ipfs://";
    await nftMedia.updateBaseURI(newBaseURI);
    expect(await nftMedia.tokenURI(0)).to.equal(`${newBaseURI}0${BASE_URI_SUFFIX}`);
  });

  it("should fail getting tokenURI for a non-existent token", async () => {
    await expect(nftMedia.tokenURI(0)).to.be.rejectedWith(Error);
  });

  it("should supports changing or removing base URI suffix", async () => {
    const [owner, addr1] = await ethers.getSigners();
    await nftMedia.mintTo(owner.address, BID_SHARES);

    expect(await nftMedia.tokenURI(0)).to.equal(`${BASE_URI}0${BASE_URI_SUFFIX}`);

    const newBaseURISuffix = ".txt";
    await nftMedia.updateBaseURISuffix(newBaseURISuffix);
    expect(await nftMedia.tokenURI(0)).to.equal(`${BASE_URI}0${newBaseURISuffix}`);

    await nftMedia.updateBaseURISuffix("");
    expect(await nftMedia.tokenURI(0)).to.equal(`${BASE_URI}0`);
  });

  it ("should have a contract URI that can be updated", async() => {
    const [owner] = await ethers.getSigners();
    expect(await nftMedia.contractURI()).to.equal(CONTRACT_METADATA_URI);
    const newContractUri = "lah dee dah";
    await nftMedia.updateContractURI(newContractUri);
    expect(await nftMedia.contractURI()).to.equal(newContractUri);
  });

  it("should not let non-owner mint anything", async () => {
    const [owner, addr1] = await ethers.getSigners();
    await expect(nftMedia.connect(addr1).mintTo(addr1.address, BID_SHARES)).to.be.rejectedWith(Error);
  });
  it("should not let non-owner change base URI", async () => {
    const [owner, addr1] = await ethers.getSigners();
    await expect(nftMedia.connect(addr1).updateBaseURI("foo")).to.be.rejectedWith(Error);
  });
  it("should not let non-owner change contract URI", async () => {
    const [owner, addr1] = await ethers.getSigners();
    await expect(nftMedia.connect(addr1).updateContractURI("foo")).to.be.rejectedWith(Error);
  });

  it("should transfer tokens from one account to another", async() => {
    const [owner, receiver] = await ethers.getSigners();
    await nftMedia.mintTo(owner.address, BID_SHARES);
    expect(await nftMedia.ownerOf(0)).to.equal(owner.address);
    await nftMedia["safeTransferFrom(address,address,uint256)"](owner.address, receiver.address, 0);
    expect(await nftMedia.ownerOf(0)).to.equal(receiver.address);
  });

  it("should batch transfer tokens", async () => {
    const [owner, receiver] = await ethers.getSigners();
    await nftMedia.mintBatchTo(owner.address, 5, BID_SHARES);
    for (let i = 0; i < 5; i++) {
      expect(await nftMedia.ownerOf(i)).to.equal(owner.address);
    }

    await nftMedia.batchTransferFrom(owner.address, receiver.address, [...Array(5).keys()]);
    for (let i = 0; i < 5; i++) {
      expect(await nftMedia.ownerOf(i)).to.equal(receiver.address);
    }
  });
  it("should safe batch transfer tokens", async () => {
    const [owner, receiver] = await ethers.getSigners();
    await nftMedia.mintBatchTo(owner.address, 5, BID_SHARES);

    await nftMedia.safeBatchTransferFrom(owner.address, receiver.address, [...Array(5).keys()]);
    for (let i = 0; i < 5; i++) {
      expect(await nftMedia.ownerOf(i)).to.equal(receiver.address);
    }
  });
  it("shouldn't batch transfer tokens that aren't owned by transferrer", async () => {
    const [owner, receiver] = await ethers.getSigners();

    await nftMedia.mintBatchTo(owner.address, 5, BID_SHARES);
    for (let i = 0; i < 5; i++) {
      expect(await nftMedia.ownerOf(i)).to.equal(owner.address);
    }

    await nftMedia.mintBatchTo(receiver.address, 5, BID_SHARES);
    for (let i = 5; i < 10; i++) {
      expect(await nftMedia.ownerOf(i)).to.equal(receiver.address);
    }

    await expect(nftMedia.batchTransferFrom(
      owner.address,
      receiver.address,
      [...Array(10).keys()]
    )).to.be.rejectedWith(Error);
  });
});
