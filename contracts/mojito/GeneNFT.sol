// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.0;

import "../openzeppelin/access/AccessControl.sol";
import "../openzeppelin/utils/Counters.sol";
import "../openzeppelin/token/ERC721/extensions/ERC721URIStorage.sol";

/**
 * @title An NFT Contract with genes for every token in it
 */
contract GeneNFT is ERC721URIStorage, AccessControl {
    using Counters for Counters.Counter;
    Counters.Counter private _tokenIdCounter;

    /* *******
     * Globals
     * *******
     */

    string baseURI;

    // Mapping from token id to keccak256 hash of its gene
    mapping(uint256 => bytes32) public gene;

    // Boolean if sale is active
    bool public saleIsActive = false;

    // keccak256("ADMIN_ROLE")
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    /* *********
     * Modifiers
     * *********
     */

    // Checks admin role
    modifier onlyAdmin() {
        require(hasRole(ADMIN_ROLE, msg.sender));
        _;
    }

    /**
     * @notice On deployment, set the placeholder metadata
     */
    constructor(
        string memory name,
        string memory symbol,
        string memory contractBaseURI
    ) ERC721(name, symbol) {
        _setupRole(ADMIN_ROLE, msg.sender);
        _setRoleAdmin(ADMIN_ROLE, ADMIN_ROLE);
        baseURI = contractBaseURI;
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        virtual
        override(ERC721, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    /**
     * @notice Add admin
     * @dev Can only be done by Admin
     */
    function addAdmin(address adminAddress) public onlyAdmin {
        grantRole(ADMIN_ROLE, adminAddress);
    }

    /**
     * @notice Remove admin
     * @dev Can only be done by Admin
     */
    function removeAdmin(address adminAddress) public onlyAdmin {
        revokeRole(ADMIN_ROLE, adminAddress);
    }

    /**
     * @notice Set sale status to true
     * @dev Can only be done by Admin
     */
    function saleStart() public onlyAdmin {
        require(!saleIsActive, "Sale is already active");
        saleIsActive = true;
    }

    /**
     * @notice Set sale status to false
     * @dev Can only be done by Admin
     */
    function saleStop() public onlyAdmin {
        require(saleIsActive, "Sale is not active");
        saleIsActive = false;
    }

    /**
     * @notice Mint token
     * @dev Can only be done by Admin
     * @dev returns token ID
     */
    function mintToken(address mintTo) public onlyAdmin returns (uint256) {
        require(saleIsActive, "Sale must be active to mint token");
        _tokenIdCounter.increment();

        uint256 tokenId = _tokenIdCounter.current();
        _safeMint(mintTo, tokenId);
        // gene[tokenId] = keccak256(abi.encodePacked(block.number, tokenId));
        return tokenId;
    }

    /**
     * @notice Update BaseURI
     */
    function setBaseURI(string memory baseURI_) external onlyAdmin {
        baseURI = baseURI_;
    }

    /**
     * @dev returns baseURI
     */
    function _baseURI() internal view override returns (string memory) {
        return baseURI;
    }
}
