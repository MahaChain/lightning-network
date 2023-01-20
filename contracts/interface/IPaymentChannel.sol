// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity ^0.8.9;

interface IPaymentChannel {
    struct PaymentChannelData {
        address owner;
        uint256 value;
        uint256 validUntil;
        bool valid;
    }

    event NewChannel(address indexed owner, bytes32 channel);
    event Deposit(address indexed owner, bytes32 indexed channel);
    event Claim(address indexed who, bytes32 indexed channel);
    event Reclaim(bytes32 indexed channel);

    // function createChannel() external payable;

    // // creates a hash using the recipient and value.
    // function getHash(
    //     bytes32 channel,
    //     address recipient,
    //     uint value
    // ) external pure returns (bytes32);

    // // verify a message (receipient || value) with the provided signature
    // function verify(
    //     bytes32 channel,
    //     address recipient,
    //     uint value,
    //     uint8 v,
    //     bytes32 r,
    //     bytes32 s
    // ) external view returns (bool);

    // // claim funds
    // function claim(
    //     bytes32 channel,
    //     address recipient,
    //     uint value,
    //     uint8 v,
    //     bytes32 r,
    //     bytes32 s
    // ) external;

    // function deposit(bytes32 channel) external payable;

    // // reclaim a channel
    // function reclaim(bytes32 channel) external;

    // function getChannelValue(bytes32 channel) external view returns (uint256);

    // function getChannelOwner(bytes32 channel) external view returns (address);

    // function getChannelValidUntil(bytes32 channel) external view returns (uint);

    // function isValidChannel(bytes32 channel) external view returns (bool);
}
