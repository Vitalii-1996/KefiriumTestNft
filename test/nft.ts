import {
  loadFixture,
} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { expect } from "chai";
import { ethers } from "hardhat";
import keccak256 from "keccak256";
import { NftContract } from "../typechain-types";

describe("NFT", function () {
  // We define a fixture to reuse the same setup in every test.
  // We use loadFixture to run this setup once, snapshot that state,
  // and reset Hardhat Network to that snapshot in every test.
  async function deployment() {
    const [owner, addr1, addr2, addr3, addr4, signer] = await ethers.getSigners();

    const NFT = await ethers.getContractFactory("NftContract");
    const nft = await NFT.deploy();

    return { nft, owner, addr1, addr2, addr3, addr4, signer };
  }

  describe("Mint", function () {
    it("Should allow to mint", async function () {
      const { nft, addr1 } = await loadFixture(deployment);

      var tx = await nft.connect(addr1).mintNft({value: ethers.parseEther('0.01')})
      await tx.wait();

      // checking balances
      expect(await nft.balanceOf(addr1.address)).to.eq(1)
      expect(await nft.totalSupply()).to.eq(1)  
    });

    it("update mint fee & withdraw", async function () {
      const { nft, owner, addr1 } = await loadFixture(deployment);

      var tx = await nft.changeMintFee(ethers.parseEther("0.1"))
      await tx.wait()

      var tx = await nft.connect(addr1).mintNft({value: ethers.parseEther('0.1')})
      await tx.wait();

      // checking balances
      expect(await nft.balanceOf(addr1.address)).to.eq(1)
      expect(await nft.totalSupply()).to.eq(1)  
      expect(await ethers.provider.getBalance(nft.target)).to.eq(ethers.parseEther("0.1"))

      // withdraw and checking balance
      var tx = await nft.withdrawETH()
      expect(tx).to.changeEtherBalances(
        [nft.target, owner.address], 
        [-ethers.parseEther("0.1"), ethers.parseEther("0.1")]
      )
    });

    it("Should allow to free mint", async function () {
      const { nft, addr1, signer } = await loadFixture(deployment);

      var tx = await nft.setSigner(signer.address)
      await tx.wait()

      expect(await nft.signer()).to.eq(signer.address);

      // generating random hex
      var randomHex= [
        keccak256(Math.floor(Math.random() * 1000000000)),
        keccak256(Math.floor(Math.random() * 1000000000))
      ]

      //generating signature
      const hash = ethers.solidityPackedKeccak256(
        ["address", "uint256", "bytes32"],
        [addr1.address, 1, randomHex[0]]
      );
      const signature = await signer.signMessage(ethers.toBeArray(hash));

      var tx = await nft.connect(addr1).freeMint(1, randomHex[0], signature)
      await tx.wait();
      
      // checking balances
      expect(await nft.balanceOf(addr1.address)).to.eq(1)    
      expect(await nft.totalSupply()).to.eq(1)   
    });

    it("Admin mint", async function () {
      const { nft, addr1, addr2, addr3, addr4 } = await loadFixture(deployment);

      var adminRole = await nft.ADMIN_ROLE();

      var tx = await nft.grantRole(adminRole, addr1.address);
      await tx.wait()

      // Single admin mint
      var tx = await nft.connect(addr1).adminMint([addr2.address], [1])
      expect(await nft.balanceOf(addr2.address)).to.eq(1)  

      // Batch mint
      var tx = await nft.connect(addr1).adminMint([addr3.address, addr4.address], [2, 3])
      await tx.wait();

      // checking balances
      expect(await nft.balanceOf(addr3.address)).to.eq(2)      
      expect(await nft.balanceOf(addr4.address)).to.eq(3)  
      expect(await nft.totalSupply()).to.eq(6) 
    });
  });

  describe("Error test", function () {
    it("Public mint error", async function () {
      const { nft, addr1 } = await loadFixture(deployment);

      await expect(nft.connect(addr1).mintNft({value: ethers.parseEther('0.001')}))
        .to.be.revertedWithCustomError(nft, "WrongEthAmount")
        .withArgs(ethers.parseEther('0.001'), ethers.parseEther('0.01'))

      await expect(nft.connect(addr1).mintNft({value: ethers.parseEther('0.1')}))
        .to.be.revertedWithCustomError(nft, "WrongEthAmount")
        .withArgs(ethers.parseEther('0.1'), ethers.parseEther('0.01'))

      expect(await nft.balanceOf(addr1.address)).to.eq(0)   
      expect(await nft.totalSupply()).to.eq(0) 
      
      var tx = await nft.pause()
      await tx.wait()

      await expect(nft.connect(addr1).mintNft({value: ethers.parseEther('0.01')}))
        .to.be.revertedWithCustomError(nft, "EnforcedPause")

    });

    it("Free mint errors", async function () {
      const { nft, addr1, addr2, signer } = await loadFixture(deployment);

      // set signer
      var tx = await nft.setSigner(signer.address)
      await tx.wait()

      expect(await nft.signer()).to.eq(signer.address);

      // generating random hex
      var randomHex= [
        keccak256(Math.floor(Math.random() * 1000000000)),
        keccak256(Math.floor(Math.random() * 1000000000))
      ]

      // generating first signature
      var hash = ethers.solidityPackedKeccak256(
        ["address", "uint256", "bytes32"],
        [addr1.address, 1, randomHex[0]]
      );
      var signature = await signer.signMessage(ethers.toBeArray(hash));
      
      // wrong sender
      await expect(nft.connect(addr2).freeMint(1, randomHex[0], signature))
        .to.be.revertedWithCustomError(nft, "SignatureVerificationFailed")
      
      // wrong hex
      await expect(nft.connect(addr1).freeMint(1, randomHex[1], signature))
        .to.be.revertedWithCustomError(nft, "SignatureVerificationFailed")

      // wrong amount
      await expect(nft.connect(addr1).freeMint(2, randomHex[0], signature))
        .to.be.revertedWithCustomError(nft, "SignatureVerificationFailed")

      expect(await nft.balanceOf(addr1.address)).to.eq(0)  
      
      var tx = await nft.connect(addr1).freeMint(1, randomHex[0], signature)
      await tx.wait()
      
      // checking balances
      expect(await nft.balanceOf(addr1.address)).to.eq(1) 
      
      // second signature usage
      await expect(nft.connect(addr1).freeMint(1, randomHex[0], signature))
        .to.be.revertedWithCustomError(nft, "ProvidedHexUsed")

      var tx = await nft.pause()
      await tx.wait()

      // generating second signature - 2 nfts
      var hash = ethers.solidityPackedKeccak256(
        ["address", "uint256", "bytes32"],
        [addr2.address, 2, randomHex[1]]
      );
      var signature = await signer.signMessage(ethers.toBeArray(hash));

      // wrong sender
      await expect(nft.connect(addr2).freeMint(2, randomHex[1], signature))
        .to.be.revertedWithCustomError(nft, "EnforcedPause")

      var tx = await nft.unpause()
      await tx.wait()
      

      // free mint 2 nft
      await nft.connect(addr2).freeMint(2, randomHex[1], signature)
      
      // checking balances
      expect(await nft.balanceOf(addr2.address)).to.eq(2)
      expect(await nft.totalSupply()).to.eq(3)
    });

    it("Admin mint", async function () {
      const { nft, addr1, addr2 } = await loadFixture(deployment);

      var adminRole = await nft.ADMIN_ROLE();

      // Mint without admin role
      await expect(nft.connect(addr1).adminMint([addr2.address], [1]))
        .to.be.revertedWithCustomError(nft, "AccessControlUnauthorizedAccount")
        .withArgs(addr1.address, adminRole)

      var tx = await nft.grantRole(adminRole, addr1.address);
      await tx.wait()

      // wrong arrays length
      await expect(nft.connect(addr1).adminMint([addr2.address], [1, 2]))
        .to.be.revertedWithCustomError(nft, "WrongArraysLength")

      var tx = await nft.pause()

      // mint paused
      await expect(nft.connect(addr1).adminMint([addr2.address], [1]))
        .to.be.revertedWithCustomError(nft, "EnforcedPause")
 
      // checking balances 
      expect(await nft.totalSupply()).to.eq(0) 
    });
  });

  describe("Miscellaneous", function() {
    it("URI test", async function(){
      const { nft, addr1 } = await loadFixture(deployment);

      var tx = await nft.connect(addr1).mintNft({value: ethers.parseEther('0.01')})
      await tx.wait();

      // token uri
      expect(await nft.tokenURI(0)).to.eq("https://test.uri/0.json")
      
      var tx = await nft.changeUriExtension("")
      await tx.wait()

      expect(await nft.tokenURI(0)).to.eq("https://test.uri/0")

      var tx = await nft.changeBaseUri("https://some.uri/")
      await tx.wait()

      expect(await nft.tokenURI(0)).to.eq("https://some.uri/0")
      
      // contract uri
      expect(await nft.contractURI()).to.eq("https://test.uri/contract.json")

      var tx = await nft.changeContractUri("https://some.uri/contract.json")
      await tx.wait()

      expect(await nft.contractURI()).to.eq("https://some.uri/contract.json")
    })

    it("ERC2981", async function(){
      const { nft, owner, addr1 } = await loadFixture(deployment);
      var tx

      tx = await nft.connect(addr1).mintNft({value: ethers.parseEther('0.01')})
      await tx.wait();

      tx = await nft.setDefaultRoyalty(owner.address, 100)
      await tx.wait()

      expect(String(await nft.royaltyInfo(0, ethers.parseEther("1"))))
        .to.eq(String([owner.address, ethers.parseEther('0.01')]))

      await expect(nft.setDefaultRoyalty(owner.address, 100000))
        .to.be.revertedWithCustomError(nft, "ERC2981InvalidDefaultRoyalty")
        .withArgs(100000, 10000)

      await expect(nft.setDefaultRoyalty(ethers.ZeroAddress, 1000))
        .to.be.revertedWithCustomError(nft, "ERC2981InvalidDefaultRoyaltyReceiver")
        .withArgs(ethers.ZeroAddress)

      tx = await nft.setTokenRoyalty(0, addr1.address, 1000)
      await tx.wait()

      expect(String(await nft.royaltyInfo(0, ethers.parseEther("1"))))
        .to.eq(String([addr1.address, ethers.parseEther("0.1")]))

      tx = await nft.resetTokenRoyalty(0)
      await tx.wait()

      expect(String(await nft.royaltyInfo(0, ethers.parseEther("1"))))
        .to.eq(String([owner.address, ethers.parseEther('0.01')]))

      tx = await nft.deleteDefaultRoyalty()
      await tx.wait()

      expect(String(await nft.royaltyInfo(0, ethers.parseEther("1"))))
        .to.eq(String([ethers.ZeroAddress, 0]))
    })
  })
});
