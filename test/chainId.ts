import hre from 'hardhat'
const networkName = hre.network.name
const chainId = hre.network.config.chainId

console.log("networkName =",networkName );
console.log("networkChainId =",chainId );
