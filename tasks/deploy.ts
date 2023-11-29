import { task } from "hardhat/config";

task("deploy", "Deploys NFT Smart contract").setAction(
  async (_args, { ethers, run }) => {
    await run("compile");
    const [deployer] = await ethers.getSigners();

    const NFT = await ethers.getContractFactory("NftContract");
    const nft = await NFT.deploy();

    await nft.waitForDeployment();

    console.log("NFT Deployed to :", nft.target);
    return nft.target
  }
);