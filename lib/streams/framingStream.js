'use strict';

var stream = require('stream');
var util = require('util');

var assert = require('assert-plus');

var EMPTY_BUF = new Buffer(0);
var LOG = require('../logger');

/**
 * Frames a RS frame. For transport protocols such as TCP, which don't support
 * framing out of the box, you can insert this stream in front of the
 * ParseStream to ensure that buffers off the wire are properly framed by the
 * length of the frame before being sent to the PraseStream.
 *
 * @constructor
 * @param {Object} opts The options object
 * @param {Object} [log=bunyan]  The logger
 * @returns {Object}
 */
function FramingStream(opts) {
    assert.optionalObject(opts, 'opts');

    if (!opts) {
        opts = {};
    }
    assert.optionalObject(opts.log, 'opts,log');

    this._log = null;
    /**
     * Remaining length of the current frame, may span across multiple
     * invocations of _transform()
     */
    this._lengthLeft = 0;
    /**
     * The current frame buffer, may span across multiple inovcations of
     * _transform()
     */
    this._frame = EMPTY_BUF;

    if (opts.log) {
        this._log = opts.log.child({
            component: 'FramingStream'
        });
    } else {
        this._log = LOG;
    }

    stream.Transform.call(this);
}
util.inherits(FramingStream, stream.Transform);

module.exports = FramingStream;

FramingStream.prototype._transform = function _transform(chunk, enc, cb) {
    var self = this;
    self._log.debug({
        buffer: chunk, lengthLeft: self._lengthLeft, chunkLength: chunk.length
    }, 'FramingStream._transform: entering');

    // buffIndex represents the current unread byte in the buffer
    var bufIndex = 0;

    /*
     * all reactive socket frames begin with a header, which starts with a 31
     * bit int with the length of the frame. we need to parse the int, save the
     * buffer until we reach the length of the frame, then emit it.
     *
     * The chunk may encapsulate 1* complete frames, and at maximum 2
     * incomplete frames.
     * e.g. [incomplete frame][complete frames][incomplete frame]
     *
     * We check to see if we've finished parsing through the entire chunk.
     * If the current frame is complete, we reset state and continue parsing the
     * next frame. Otherwise, we attempt to parse the current frame.
     */
    while (bufIndex < chunk.length) {
        // parse the frame length. Note that the 4 byte length itself may span
        // the packet boundary. If it does, then we must cache those bytes
        // until the next packet.
        if (self._lengthLeft === 0 && (chunk.length - bufIndex > 4)) {
            var headerLengthLeft = 4 - self._frame.length;
            self._frame = Buffer.concat([self._frame,
                chunk.slice(bufIndex, bufIndex + headerLengthLeft)]);
            // self._frame now contains the frame length, subtract by 4 since
            // we've already read the length
            self._lengthLeft = self._frame.readUInt32BE(0) - 4;
            bufIndex += headerLengthLeft;
            self._log.debug({lengthLeft: self._lengthLeft},
                            'FramingStream._transform: resetting length');
        }

        // check that the buffer encapsulates the entire frame. only check if
        // lengthLeft has been set
        if (self._lengthLeft > 0 &&
            self._lengthLeft <= (chunk.length - bufIndex)) {
            // if the entire frame is in the buffer, we grab it, push, and reset
            // counters.
            var frame = chunk.slice(bufIndex, bufIndex + self._lengthLeft);
            self._frame = Buffer.concat([self._frame, frame]);
            self._log.debug({
                buffer: self._frame
            }, 'FramingStream._transform: Got entire frame');

            bufIndex += self._lengthLeft;
            self._lengthLeft = 0;
            self.push(self._frame);
            self._frame = EMPTY_BUF;
        } else {
            // frame doesn't fit in the entire chunk -- implies end of chunk
            // this is easy we just attach the rest of the chunk on to the
            // frame.
            self._frame = Buffer.concat([self._frame, chunk.slice(bufIndex)]);

            // if we've parsed the length header, then update the counter
            if (self._lengthLeft !== 0) {
                self._lengthLeft -= chunk.length - bufIndex;
            }

            // no more chunks, so we leave the loop
            self._log.debug({lengthLeft: self._lengthLeft},
                'FramingStream._transform: got partial frame, exiting');
            break;
        }
    }

    cb();
};
