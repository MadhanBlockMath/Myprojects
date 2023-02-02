import { ethers } from "hardhat";


async function main() {
    // Rinkeby Addresses
    const PROXY_REGISTRY_ADDRESS = "0xff7Ca10aF37178BdD056628eF42fD7F799fAc77c";
    const WETH_ADDRESS = "0xA6FA4fB5f76172d178d61B04b0ecd319C5d1C0aa";

    const CONTRACT_METADATA_URI = "http://ipfs.io/ipfs/QmT5vJ53pbrZ3NhUk7o1fYLUfB6Qfui4nDhD1FBZFsy4sH";
    const BASE_URI = "https://arweave.net/oUbZMh4SJ-98Xot0kEhsKmyyf-wMOEbDNFgUpc_dJfI/";
    const BASE_URI_SUFFIX = ".json";

    // Deploying Zora NFT Marketplace
    const NFTMarket = await ethers.getContractFactory("ZoraNFTMarket");
    const nftMarket = await NFTMarket.deploy();
    await nftMarket.deployed();
    console.log(`NFTMarket deployed to: ${nftMarket.address}`)

    // Deploying Zora NFT
    const NFTMedia = await ethers.getContractFactory("StandardizedZoraNFT");
    const nftMedia = await NFTMedia.deploy("Copy NFT", "CFT", BASE_URI, BASE_URI_SUFFIX, CONTRACT_METADATA_URI, nftMarket.address, PROXY_REGISTRY_ADDRESS);
    await nftMedia.deployed()
    console.log(`NFT deployed to: ${nftMedia.address}`)

    // Configuring NFT media in Market Place
    await nftMarket.configure(nftMedia.address);

    // Deploying Auction House
    const AuctionHouse = await ethers.getContractFactory("AuctionHouse");
    const auctionHouse = await AuctionHouse.deploy(nftMedia.address, WETH_ADDRESS);
    await auctionHouse.deployed();
    console.log(`AuctionHouse deployed to: ${auctionHouse.address}`)
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });