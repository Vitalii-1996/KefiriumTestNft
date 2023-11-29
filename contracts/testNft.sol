// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/common/ERC2981.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "erc721a/contracts/extensions/ERC721AQueryable.sol";

contract NftContract is
    ERC721AQueryable,
    ERC2981,
    AccessControl,
    ReentrancyGuard,
    Pausable
{
    address public signer;
    uint256 public mintFee = 0.01 ether;
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    
    string private baseUri = "https://test.uri/";
    string private uriExtension = ".json";
    string public contractURI = "https://test.uri/contract.json";

    mapping (bytes32 => bool) private _isHexUsed;

    event MintPriceUpdated(uint256 newMintPrice);

    error InsufficientBnb(uint256 bnbProvided, uint256 mintFee);
    error SignatureVerificationFailed();
    error ProvidedHexUsed();
    error WrongArraysLength();
    error WrongEthAmount(uint256 provided, uint256 required);

    constructor() ERC721A("KefiriumNft", "KEF") {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
    }

    // PAYABLE MINT

    function mintNft() external payable whenNotPaused nonReentrant {
        if (msg.value != mintFee) revert WrongEthAmount(msg.value, mintFee);
        _safeMint(_msgSender(), 1);
    }

    // FREE MINT

    function freeMint(
        uint256 amount, 
        bytes32 randomHex, 
        bytes calldata signature
    ) 
        external 
        nonReentrant 
        whenNotPaused 
    {
        if (!verifySignature(_msgSender(), amount, randomHex, signature)) {
            revert SignatureVerificationFailed();
        }
        if (_isHexUsed[randomHex]) revert ProvidedHexUsed();
        _isHexUsed[randomHex] = true;
        _safeMint(_msgSender(), amount);
    }

    // ADMIN MINT

    function adminMint(
        address[] calldata users,
        uint256[] calldata amounts
    ) 
        external 
        whenNotPaused 
        onlyRole(ADMIN_ROLE) 
    {
        if (users.length != amounts.length) revert WrongArraysLength();
        for (uint i = 0; i < users.length;) {
            _safeMint(users[i], amounts[i]);
            unchecked {
                i++;
            }
        }
    }

    // CONTRACT SETTINGS

    function setSigner(address newSigner) external onlyRole(DEFAULT_ADMIN_ROLE) {
        signer = newSigner;
    }

    function changeBaseUri(string calldata newBaseUri) external onlyRole(DEFAULT_ADMIN_ROLE) {
        baseUri = newBaseUri;
    }

    function changeUriExtension(string calldata newUriExtension) external onlyRole(DEFAULT_ADMIN_ROLE) {
        uriExtension = newUriExtension;
    }

    function changeContractUri(string calldata newContractUri) external onlyRole(DEFAULT_ADMIN_ROLE) {
        contractURI = newContractUri;
    }

    function changeMintFee(uint256 newFeeInWei) external onlyRole(DEFAULT_ADMIN_ROLE) {
        mintFee = newFeeInWei;
        emit MintPriceUpdated(newFeeInWei);
    }

    // PAUSABLE SECTION

    function pause() external onlyRole(ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }
    
    // WITHDRAW SECTION

    function withdrawETH() external onlyRole(DEFAULT_ADMIN_ROLE) {
        Address.sendValue(payable(msg.sender), address(this).balance);
    }

    function withdrawERC20(address tokenAddress) external onlyRole(DEFAULT_ADMIN_ROLE) {
        uint256 amount = IERC20(tokenAddress).balanceOf(address(this));
        require(amount > 0, "no tokens on contract");
        IERC20(tokenAddress).transfer(_msgSender(), amount);
    }

    // ERC2981 SECTION

    function setDefaultRoyalty(
        address receiver, 
        uint96 feeNumerator
    ) 
        external 
        onlyRole(DEFAULT_ADMIN_ROLE) 
    {
        _setDefaultRoyalty(receiver, feeNumerator);
    }

    function deleteDefaultRoyalty() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _deleteDefaultRoyalty();
    }

    function setTokenRoyalty(
        uint256 tokenId, 
        address receiver, 
        uint96 feeNumerator
    ) 
        external
        onlyRole(DEFAULT_ADMIN_ROLE) 
    {
        _setTokenRoyalty(tokenId, receiver, feeNumerator);
    }

    function resetTokenRoyalty(uint256 tokenId) external onlyRole(DEFAULT_ADMIN_ROLE) {
       _resetTokenRoyalty(tokenId);
    }

    /**
     * @dev See {IERC721Metadata-tokenURI}.
     */
    function tokenURI(uint256 tokenId)
        public
        view
        override(ERC721A, IERC721A)
        returns (string memory)
    {
        if (!_exists(tokenId)) revert URIQueryForNonexistentToken();
        return
            bytes(baseUri).length != 0
                ? string(abi.encodePacked(baseUri, _toString(tokenId), uriExtension))
                : "";
    }

    // The following functions are overrides required by Solidity.

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721A, IERC721A, ERC2981, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    // ECDSA VETIFICATION

    function verifySignature(
        address _toAddress, 
        uint256 _amount, 
        bytes32 _randomHex, bytes calldata signature
    ) 
        internal 
        view 
        returns (bool) 
    {
        bytes32 hash = keccak256(abi.encodePacked(_toAddress, _amount, _randomHex));
        bytes32 message = MessageHashUtils.toEthSignedMessageHash(hash);
        address result = ECDSA.recover(message, signature);
        return (signer == result);
    }
}