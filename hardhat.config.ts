import "dotenv/config";
import { HardhatUserConfig, task } from "hardhat/config";
import "@nomiclabs/hardhat-waffle";
import "@nomiclabs/hardhat-web3";
import "@nomiclabs/hardhat-etherscan";
import "hardhat-gas-reporter"

// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
task("accounts", "Prints the list of accounts", async (args, hre) => {
  const accounts = await hre.ethers.getSigners();

  for (const account of accounts) {
    console.log(await account.address);
  }
});

const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      {
        version: "0.8.17",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    ],
  },
  networks: {
    hardhat: {
      forking:{
        enabled: true,
        url:'https://eth-mainnet.alchemyapi.io/v2/ks0TX6jjbR_QXqSkO2rzkNaPxbRC1pND',
        // blockNumber:14390000
      },
      chainId: 1,
      allowUnlimitedContractSize: true,
      gasPrice: 5000000000000,
      gasMultiplier: 2,
    },
    mainnet: {
      chainId: 1,
      url: `https://eth-mainnet.alchemyapi.io/v2/ks0TX6jjbR_QXqSkO2rzkNaPxbRC1pND`,
      gas: 2100000,
      //gasPrice: 5000000000,
      //gasMultiplier: 3,
      allowUnlimitedContractSize: true,
      accounts:[`b4799a35f8e7b7ecd019419e631f437edd9188d52f3f94153078480bd0744024`,`db1192ffa217189f0cbb13901e41ace089ebc8101231de8ccc6870dbd5f36c53`,`d710ba52ca23317377abc4325b6d9c52ee216756636dbda78260e1b075111124`]

    },
    rinkeby: {
      chainId: 4,
      url: `https://eth-rinkeby.alchemyapi.io/v2/${process.env.ALCHEMY_API_KEY}`,
      //gas: 2100000,
      gasPrice: 5000000000,
      gasMultiplier: 3,
      allowUnlimitedContractSize: true,
    },
    goreli: {
      chainId: 5,
      url: `https://eth-goerli.g.alchemy.com/v2/w16kDVk2RE_AcqeWzp9A9__tTsfErMBt`,
      // gas: 50000000000,
      gasPrice: 50000000000,
      gasMultiplier: 3,
      accounts: [`0x${process.env.GORELI_PRIVATE_KEY_2}`,`0x${process.env.GORELI_PRIVATE_KEY_1}`],
      allowUnlimitedContractSize: true,
    },
    mumbai: {
      chainId: 80001,
      url: `https://polygon-mumbai.g.alchemy.com/v2/w16kDVk2RE_AcqeWzp9A9__tTsfErMBt`,
      // gasPrice: 15000000000,
      // gasMultiplier: 4,
      accounts: [`0x${process.env.MUMBAI_PRIVATE_KEY}`,`0x${process.env.GORELI_PRIVATE_KEY_1}`],
      allowUnlimitedContractSize: true,
    },
    polygon: {
      chainId: 137,
      url: `https://polygon-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`,
      accounts: [`0x${process.env.POLYGON_PRIVATE_KEY}`],
      allowUnlimitedContractSize: true,
    },
  },
  etherscan: {
    apiKey: "Q54HT9CI9BXTQUN5NNISDHC1BCWENJQ7V6",
  },
};


export default config;
