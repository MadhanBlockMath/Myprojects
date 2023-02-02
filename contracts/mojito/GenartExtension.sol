// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

/// @author: manifold.xyz

import "../manifold/libraries-solidity/access/AdminControl.sol";
import "../manifold/creator-core/core/IERC721CreatorCore.sol";

contract GenartExtension is AdminControl {
    address private _creatorContract;
    uint256 private _tokenId;

    // Boolean if contract is paused
    bool public paused;

    // Mapping from token id to keccak256 hash of its gene
    mapping(uint256 => Token) public tokens;

    struct Token {
        bytes32 gene; // random hash
        bytes32 data; // boost etc
    }

    constructor(address creatorContract) {
        _creatorContract = creatorContract;
    }

    /**
     * @notice Set sale status to true
     * @dev Can only be done by Admin
     */
    function unpauseContract() public adminRequired {
        require(!paused, "Contract is unpaused.");
        paused = true;
    }

    /**
     * @notice Set sale status to false
     * @dev Can only be done by Admin
     */
    function pauseContract() public adminRequired {
        require(paused, "Contract is paused.");
        paused = false;
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        virtual
        override(AdminControl)
        returns (bool)
    {
        return
            AdminControl.supportsInterface(interfaceId) ||
            super.supportsInterface(interfaceId);
    }

    function mint(address mintTo, bytes32 data)
        public
        adminRequired
        returns (uint256)
    {
        require(paused, "Contract is paused.");

        uint256 newTokenId = _tokenId + 1;

        // random hash as gene
        bytes32 playerGene = keccak256(
            abi.encodePacked(block.number, newTokenId)
        );

        tokens[newTokenId] = Token(playerGene, data);
        _tokenId = IERC721CreatorCore(_creatorContract).mintExtension(mintTo);

        return _tokenId;
    }
}
