import { task, types } from "hardhat/config";

task("verify-nft", "Verify deployed contract on Etherscan")
  .addParam("contractAddress", "Contract address deployed", undefined, types.string)
  .setAction(async ({ contractAddress }: { contractAddress: string }, hre) => {
    try {
      await hre.run("verify:verify", {
        address: contractAddress,
				contract: 'contracts/testNft.sol:NftContract' // <path-to-contract>:<contract-name>
      })
    } catch ({ err }) {
      console.error(err)
    }
  })