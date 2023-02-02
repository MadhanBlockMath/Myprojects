// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

/// @author: manifold.xyz

import "../../../../openzeppelin/utils/introspection/ERC165Checker.sol";
import "../../../../openzeppelin/utils/structs/EnumerableSet.sol";

import "../../../creator-core/core/IERC1155CreatorCore.sol";
import "../../..//libraries-solidity/access/AdminControl.sol";

import "../../libraries/SingleCreatorExtension.sol";

import "../RedeemBase.sol";
import "./IERC1155RedeemBase.sol";

/**
 * @dev Burn NFT's to receive another lazy minted NFT
 */
abstract contract ERC1155RedeemBase is
    ERC1155SingleCreatorExtension,
    RedeemBase,
    IERC1155RedeemBase
{
    /**
     * @dev See {IERC165-supportsInterface}.
     */
    function supportsInterface(bytes4 interfaceId)
        public
        view
        virtual
        override(RedeemBase, IERC165)
        returns (bool)
    {
        return
            interfaceId == type(IERC1155RedeemBase).interfaceId ||
            RedeemBase.supportsInterface(interfaceId);
    }
}
