'use strict';

var CONSTANTS = require('./../protocol/constants');
var Frame = require('./../protocol/frame');
var ReactiveServerStream = require('./ReactiveServerStream');

var TYPES = CONSTANTS.TYPES;

/**
 * @constructor
 * @param {Transport} transport - should emit an 'connection' event once
 * the connection is ready to use and a stream is passed into the connection
 * event.
 * @returns {ReactiveServer}
 */
function ReactiveServer(transport) {
    this._stream = {};
    this._frameMap = {};

    var self = this;

    // There should only ever be one connection.  When a close event happens
    // the previous stream should be closed down.
    transport.on('connection', function(stream, uniqueIdentifier) {
        var reactiveStream = new ReactiveServerStream(stream, uniqueIdentifier);
        self._stream[uniqueIdentifier] = reactiveStream;
        self._conEstablished(reactiveStream, uniqueIdentifier);
    });
}

/**
 * @private
 * @param {ReactiveServerStream} stream -
 * @param {String|Number} id -
 * @returns {undefined}
 */
ReactiveServer.prototype._conEstablished = function _conEstablished(stream,
                                                                    id) {
    // TODO: this has been greatly reduced in complexity for now.
    // TODO: Leasing
    var self = this;
    var dataStream = stream.stream;
    dataStream.on('data', function(data) {
        var frame = Frame.parseFrame(data);

        // if header type is setup, then we need to do something special.
        switch (frame.header.type) {
            case TYPES.SETUP:
                self._setup(stream, frame);
                self._notifyListeners(stream, frame);
                break;
            default:
                // If the stream has not been setup
                if (!stream.setup) {
                    // TODO: Become very angry and rage quit connection.
                    return;
                }

                self._notifyListeners(stream, frame);
                break;
        }
    });
};

/**
 * @param {ReactiveServerStream} stream -
 * @param {ReactiveFrame} frame -
 * @returns {undefined}
 */
ReactiveServer.prototype._setup = function _setup(stream, frame) {

    if (stream.setup) {
        // TODO: Should I rage quit?
        return;
    }

    stream.update(frame);
};

/**
 *
 * @param {Number} type - The type of reactive socket frame
 * @param {Function|Object} handlerOrHandlerObj - Either a function or object.
 * @returns {undefined}
 * @throws {InvalidTypeError}
 */
ReactiveServer.prototype.on = function onFrame(type, handlerOrHandlerObj) {
    if (Frame.isValidFrameType(type)) {
        throw Error('InvalidType');
    }

    var handlerList = this._frameMap[type];
    if (!handlerList) {
        handlerList = this._frameMap[type] = {
            handlers: [],
            objects: []
        };
    }

    // adds the listener to the list.
    var typeOfHandler = typeof handlerOrHandlerObj;
    var listToAddTo = typeOfHandler === 'function' && handlerList.handlers ||
                      handlerList.objects;
    listToAddTo.push(handlerOrHandlerObj);
};

/**
 * @private
 * @param {String} msg -
 * @param {Buffer} frame -
 * @param {Error} err -
 * @returns {undefined}
 */
ReactiveServer.prototype._logError = function logError(msg, frame, err) {
    this._log.error('Error on writing frame', {
        error: err,
        frame: frame,
        streamId: this._streamId
    });
};


/**
 * notifies all listeners when an event has occurred.
 * @private
 * @param {ReactiveServerStream} stream -
 * @param {ReactiveFrame} frame -
 * @returns {undefined}
 */
ReactiveServer.prototype._notifyListeners = function _notifyListeners(stream,
                                                                      frame) {

    var type = frame.header.type;
    var listeners = this._frameMap[type];

    // Nothing to do here
    if (!listeners) {
        return;
    }

    listeners.handlers.forEach(function callHandlers(handler) {
        handler(stream.stream, frame);
    });

    // Allows implementors to avoid closures.
    listeners.objects.forEach(function callHandlers(handler) {
        handler.onFrame(stream.stream, frame);
    });
};

module.exports = ReactiveServer;