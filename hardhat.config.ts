import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@nomicfoundation/hardhat-verify";
import 'dotenv/config'
import "./tasks/index.ts"

const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      {
        version: "0.8.23",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      }
    ],
  },
  networks:{
    testnet:{
      url: process.env.TEST_ENDPOINT,
      accounts: [
        process.env.PRIVATE_KEY_DEPLOYER as string,
      ]
    },
    main: {
      url: process.env.MAIN_ENDPOINT,
      accounts: [
        process.env.PRIVATE_KEY_DEPLOYER as string
      ]
    },
  },
  etherscan: {
    apiKey: process.env.ETHER_API as string
  },
  gasReporter: {
    enabled: true,
    currency: "USD",
    gasPrice: 21,
    coinmarketcap: process.env.COINMARKETCAP_API_KEY || "",
  },
};

export default config;
