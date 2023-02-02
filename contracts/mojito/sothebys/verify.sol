// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;

import {MerkleProof} from "../../openzeppelin/utils/cryptography/MerkleProof.sol";

contract verify {
    bytes32 public root;
    bytes32 public answer;
    constructor(bytes32 _root) {
        root = _root;
        answer = bytes32(0);
    }

    function isApproved(bytes32[] memory proof, address addr)
        public
        view
        returns (bytes32 leaf, bool approval)
    {
        leaf = keccak256(abi.encodePacked(addr));
        approval = MerkleProof.verify(proof, root, leaf);
    }
}

// [
//   "0xc3ba22e81bd9cad4082d4c4099ebf6655d152879dfe443d99220828aca3dd9fe",
//   "0xb95052d39a5b66be0e1fbd934e0624c721c2a295399d1df8731127e05d4c6811",
//   "0x33f5caeec3dda45d2e67389cbfebd148e9fb01ec4a74db18921f5d56c812156d",
//   "0xef6fce56909723dfc485190cbc397c62e421e568dd69efce837d585810f34ac0"
// ]
