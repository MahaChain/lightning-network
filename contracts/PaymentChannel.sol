// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity ^0.8.9;

import {VersionedInitializable} from './proxy/VersionedInitializable.sol';
import {IPaymentChannel} from './interface/IPaymentChannel.sol';

contract PaymentChannel is IPaymentChannel, VersionedInitializable {
    mapping(bytes32 => PaymentChannelData) public channels;
    uint256 public lastId;

    function initialize() external initializer {
        lastId = 0;
    }

    function getRevision() public pure virtual override returns (uint256) {
        return 0;
    }

    function createChannel() external payable {
        bytes32 channel = keccak256(abi.encode(lastId++));
        channels[channel] = PaymentChannelData(
            msg.sender,
            msg.value,
            block.timestamp + 1 days,
            true
        );

        emit NewChannel(msg.sender, channel);
    }

    // creates a hash using the recipient and value.
    function getHash(
        bytes32 channel,
        address recipient,
        uint value
    ) public pure returns (bytes32) {
        return keccak256(abi.encode(channel, recipient, value));
    }

    // verify a message (receipient || value) with the provided signature
    function verify(
        bytes32 channel,
        address recipient,
        uint value,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) public view returns (bool) {
        PaymentChannelData memory ch = channels[channel];
        return
            ch.valid &&
            ch.validUntil > block.timestamp &&
            ch.owner == ecrecover(getHash(channel, recipient, value), v, r, s);
    }

    // claim funds
    function claim(
        bytes32 channel,
        address recipient,
        uint value,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) public {
        if (!verify(channel, recipient, value, v, r, s)) return;

        PaymentChannelData memory ch = channels[channel];
        if (value > ch.value) {
            payable(recipient).transfer(ch.value);
            ch.value = 0;
        } else {
            payable(recipient).transfer(value);
            ch.value -= value;
        }

        // channel is no longer valid
        channels[channel].valid = false;

        emit Claim(recipient, channel);
    }

    function deposit(bytes32 channel) public payable {
        require(isValidChannel(channel));

        PaymentChannelData memory ch = channels[channel];
        ch.value += msg.value;

        emit Deposit(msg.sender, channel);
    }

    // reclaim a channel
    function reclaim(bytes32 channel) public {
        PaymentChannelData memory ch = channels[channel];
        if (ch.value > 0 && ch.validUntil < block.timestamp) {
            payable(ch.owner).transfer(ch.value);
            delete channels[channel];
        }
    }

    function getChannelValue(bytes32 channel) public view returns (uint256) {
        return channels[channel].value;
    }

    function getChannelOwner(bytes32 channel) public view returns (address) {
        return channels[channel].owner;
    }

    function getChannelValidUntil(bytes32 channel) public view returns (uint) {
        return channels[channel].validUntil;
    }

    function isValidChannel(bytes32 channel) public view returns (bool) {
        PaymentChannelData memory ch = channels[channel];
        return ch.valid && ch.validUntil >= block.timestamp;
    }
}
