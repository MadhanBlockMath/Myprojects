import MerkleTree from "merkletreejs";
import keccak256 from "keccak256";
async function main() {
let whitelistedaddresses = [
    "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
    "0x7D1AfA7B718fb893dB30A3aBc0Cfc608AaCfeBB0",
    "0x6b175474e89094c44da98b954eedeac495271d0f",
    "0x4Fabb145d64652a948d72533023f6E7A623C7C53",
    "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
    "0xdac17f958d2ee523a2206206994597c13d831ec7",
    "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419",
    "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419",
    "0x7bAC85A8a13A4BcD8abb3eB7d6b4d632c5a57676",
    "0xAed0c38402a5d19df6E4c03F4E2DceD6e29c1ee9",
    "0x833D8Eb16D306ed1FbB5D7A2E019e106B960965A",
    "0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6",
    "0x3E7d1eAB13ad0104d2750B8863b489D65364e32D",
]

var leafnodes = whitelistedaddresses.map(addr => keccak256(addr))

const merkletree = new MerkleTree(leafnodes,keccak256,{sortPairs: true});

const roothash = merkletree.getRoot()

console.log(merkletree.toString());

console.log(roothash);

const claimingAddr = leafnodes[2]
console.log(claimingAddr);


const getproof = merkletree.getHexProof(leafnodes[2]);

console.log(getproof);

console.log(merkletree.verify(getproof,claimingAddr, roothash));




}
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error.error);
    process.exit(1);
  });