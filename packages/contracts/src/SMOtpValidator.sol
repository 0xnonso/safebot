// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

contract SMOtpValidator {
    address immutable verifier;
    uint256 immutable step;

    constructor(address _verifier, uint256 _step) {
        verifier  = _verifier;
        step = _step;
    }

    function verifyOtp(
        bytes memory proof,
        bytes32 root, 
        bytes32 otp,
        uint256 time
    ) external returns(bool){
        uint256 _step = block.timestamp / step;

    }

}