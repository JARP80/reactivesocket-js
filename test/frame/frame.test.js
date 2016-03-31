'use strict';

var _ = require('lodash');
var assert = require('chai').assert;

var compareFrames = require('../common/compareFrames');
var frame = require('../../lib/protocol/frame');

var CONSTANTS = require('../../lib/protocol/constants');
var FLAGS = CONSTANTS.FLAGS;

describe('header', function () {
    it('getFrameHeader should produce correct frame headers.', function () {
        var actual = frame.getFrameHeader({
            length: 256,
            type: 0xACAC,
            flags: 0xBDBD,
            streamId: 4
        });
        var expected = new Buffer(12);

        // length should be payloadLength + 12 (frameHeaderLength)
        // which should be 0x100 + 0x00C
        expected.writeUInt32BE(0x10c, 0);
        expected.writeUInt32BE(0xacacbdbd, 4);
        expected.writeUInt32BE(0x00000004, 8);

        compareFrames(expected, actual);
    });
    it('encode/parse', function () {
        var seedFrame = {
            length: 0, // 0 since we have no additional frame
            type: CONSTANTS.TYPES.REQUEST_RESPONSE,
            flags: CONSTANTS.FLAGS.METADATA,
            streamId: 4
        };

        var expectedParsedFrame = {
            header: {
                length: 12, // 12 becuase this is the length of the actual frame
                flags: seedFrame.flags,
                type: seedFrame.type,
                streamId: seedFrame.streamId
            }
        }

        var actualFrame = frame.parseFrame(frame.getFrameHeader(seedFrame));
        assert.deepEqual(expectedParsedFrame, actualFrame);
    });
});

describe('setup', function () {
    it('encode/decode with lease, strict, md and data', function () {
        var seedFrame = {
            flags: FLAGS.LEASE | FLAGS.STRICT,
            keepalive: getRandomInt(0, Math.pow(2, 32)),
            maxLifetime: getRandomInt(0, Math.pow(2, 32)),
            version: CONSTANTS.VERSION,
            metadataEncoding: 'utf-8',
            dataEncoding: 'ascii',
            metadata: 'We\'re just two lost souls swimming in a fish bowl',
            data: 'year after year'
        };
        var actualFrame = frame.parseFrame(frame.getSetupFrame(seedFrame));
        assert.isObject(actualFrame.header);
        assert.equal(actualFrame.header.streamId, 0,
                     'setup frame id must be 0');
        assert.equal(actualFrame.header.type, CONSTANTS.TYPES.SETUP);
        assert.equal(actualFrame.header.flags,
                     FLAGS.METADATA | seedFrame.flags);
        assert.equal(actualFrame.header.type, CONSTANTS.TYPES.SETUP);
        assert.deepEqual(actualFrame.setup, _.omit(seedFrame, 'data',
                                                   'metadata', 'flags'));
        assert.deepEqual(actualFrame.data.
                         toString(actualFrame.setup.dataEncoding),
                         seedFrame.data);
        assert.deepEqual(actualFrame.metadata.
                         toString(actualFrame.setup.metadataEncoding),
                         seedFrame.metadata);
    });
});

describe('error', function () {
    it('encode/decode', function () {
        var seedFrame = {
            streamId: getRandomInt(0, Math.pow(2, 32)),
            errorCode: getRandomInt(0, Math.pow(2, 16)),
            data: 'Running over the same old ground',
            metadata: 'What have we found'
        };

        var actualFrame = frame.parseFrame(frame.getErrorFrame(seedFrame));
        assert.isObject(actualFrame.header);
        assert.equal(actualFrame.header.streamId, seedFrame.streamId);
        assert.equal(actualFrame.header.type, CONSTANTS.TYPES.ERROR);
        assert.equal(actualFrame.header.flags, CONSTANTS.FLAGS.METADATA);
        assert.equal(actualFrame.errorCode, seedFrame.errorCode);
        assert.equal(actualFrame.metadata.toString(), seedFrame.metadata);
        assert.equal(actualFrame.data.toString(), seedFrame.data);
    });
});

describe('request response', function cb() {
    it('encode/decode', function () {
        var seedFrame = {
            streamId: getRandomInt(0, Math.pow(2, 32)),
            metadata: 'Big Suge in the lolo, bounce and turn',
            data: 'I hit the studio and drop a jewel, hoping it pay'
        };

        var actualFrame = frame.parseFrame(frame.getReqResFrame(seedFrame));
        assert.isObject(actualFrame.header);
        assert.equal(actualFrame.header.streamId, seedFrame.streamId);
        assert.equal(actualFrame.header.type, CONSTANTS.TYPES.REQUEST_RESPONSE);
        assert.equal(actualFrame.header.flags, CONSTANTS.FLAGS.METADATA);
        assert.equal(actualFrame.metadata.toString(), seedFrame.metadata);
        assert.equal(actualFrame.data.toString(), seedFrame.data);

    });
});

describe('response', function () {
    it('encode/decode w/ data, metadata, and complete', function () {
        var seedFrame = {
            streamId: getRandomInt(0, Math.pow(2, 32)),
            flags: CONSTANTS.FLAGS.COMPLETE,
            metadata: 'I bet you got it twisted you don\'t know who to trust',
            data: 'A five-double-oh - Benz flauntin flashy rings'
        }

        var actualFrame = frame.parseFrame(frame.getResponseFrame(seedFrame));
        assert.isObject(actualFrame.header);
        assert.equal(actualFrame.header.streamId, seedFrame.streamId);
        assert.equal(actualFrame.header.type, CONSTANTS.TYPES.RESPONSE);
        assert.equal(actualFrame.header.flags,
                     CONSTANTS.FLAGS.METADATA | CONSTANTS.FLAGS.COMPLETE);
        assert.equal(actualFrame.metadata.toString(), seedFrame.metadata);
        assert.equal(actualFrame.data.toString(), seedFrame.data);
    });
});

function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min)) + min;
}
