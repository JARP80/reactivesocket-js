
[![NPM Version](https://img.shields.io/npm/v/reactivesocket.svg)](https://npmjs.org/package/reactivesocket)
[![Build Status](https://travis-ci.org/ReactiveSocket/reactivesocket-js.svg?branch=master)](https://travis-ci.org/ReactiveSocket/reactivesocket-js)
[![Coverage Status](https://coveralls.io/repos/github/ReactiveSocket/reactivesocket-js/badge.svg?branch=master)](https://coveralls.io/github/ReactiveSocket/reactivesocket-js?branch=master)

# reactivesocket-js
ReactiveSocket Protocol for Client/Server for JS. Also comes with a [CLI](#CLI).
```bash
npm install -g reactivesocket
```
This library only supports the `request/response`, `setup` and `error`
interactions. More interactions are coming soon.

## Streams
The transport for this library is built entirely on top of the Node.js
[Stream](https://nodejs.org/api/stream.html) API.  As a result, it is agnostic
to the underlying transport mechanism. As long as you pass in a transport
stream that is a Node.js
[Duplex](https://nodejs.org/api/stream.html#stream_class_stream_duplex) stream,
this library will work.

Using streams means that this library natively supports backpressure regardless
of the transport implementation.

We currently target TCP via the [net](https://nodejs.org/api/net.html) module,
and WebSockets via the [yws-stream](https://github.com/yunong/ws-stream)
module. You are of course, free to inject other transports.

## Connection Quick Start
### TCP
```javascript
var net = require('net');

var bunyan = require('bunyan');
var reactiveSocket = require('reactivesocket');


// Create any transport stream that's a Node.js Duplex Stream.
var transportStream = net.connect(1337, 'localhost', function (err) {
    var rsConnection = reactiveSocket.createConnection({
        log: bunyan.createLogger({name: 'rsConnection'}),
        transport: {
            stream: transportStream,
            framed: true // TCP requires explicit framing
        },
        type: 'client',
        metadataEncoding: 'utf8',
        dataEncoding: 'utf8'
    });

    rsConnection.on('ready', function () {
        // returns a reactive socket stream
        var stream = rsConnection.request({
            metadata: 'You reached for the secret too soon, you cried for the moon',
            data: 'Shine on you crazy diamond.'
        });

        stream.on('response', function (res) {
            console.log('got response', res.getResponse());
        });

        stream.on('application-error', function (err) {
            console.error('got error', err);
        });
    });
});
```
### WebSocket
```javascript
var bunyan = require('bunyan');
var reactiveSocket = require('reactivesocket');

var Ws = require('ws');
var WSStream = require('yws-stream');


var websocket = new Ws('ws://localhost:1337');

// Create any transport stream that's a Node.js Duplex Stream
var transportStream = new WSStream({
    log: bunyan.createLogger({name: 'ws-stream'}),
    ws: websocket
});

// Wait for Websocket to establish connection, before we create an RS Connection
websocket.on('open', function() {

    var rsConnection = reactiveSocket.createConnection({
        log: bunyan.createLogger({name: 'rsConnection'}),
        transport: {
            stream: transportStream
        },
        type: 'client',
        metadataEncoding: 'utf8',
        dataEncoding: 'utf8'
    });

    rsConnection.on('ready', function () {
        // returns a reactive socket stream
        var stream = rsConnection.request({
            metadata: 'You reached for the secret too soon, you cried for the moon',
            data: 'Shine on you crazy diamond.'
        });

        stream.on('response', function (res) {
            console.log('got response', res.getResponse());
        });

        stream.on('application-error', function (err) {
            console.error('got error', err);
        });
    });
});
```

## CLI
This library comes with a CLI. You can use it by installing this module.
```bash
$ npm install -g reactivesocket
```

### RS Client
There are two versions of the client CLI. The simple CLI makes one request to a
server.
```bash
$ rs -o req tcp://localhost:1337 'if you didnt care what happened to me, And I didnt care for you'
```

There is also a benchmarking CLI in the vein of [Apache
Bench](https://httpd.apache.org/docs/2.4/programs/ab.html)
```bash
$ rb -c 10 -n 10000000 -s 1000 tcp://localhost:1337
{ 'elapsed time (s)': 10.529176232,
  'total reqs': 137133,
  RPS: 13024.095805636622,
  'median (ms)': 0.649035,
  'mean (ms)': 0.75758988656268,
  '0.1% (ms)': 0.457949,
  '1% (ms)': 0.498248,
  '5% (ms)': 0.544133,
  '10% (ms)': 0.565295,
  '20% (ms)': 0.596515,
  '30% (ms)': 0.616699,
  '40% (ms)': 0.633112,
  '50% (ms)': 0.649035,
  '60% (ms)': 0.671943,
  '70% (ms)': 0.708819,
  '80% (ms)': 0.772095,
  '90% (ms)': 0.905283,
  '99% (ms)': 4.441137,
  '99.9% (ms)': 6.004325,
  '99.99% (ms)': 32.613085,
  '99.999% (ms)': 101.189893 }
```

### Echo Servers
Simple echo servers are also available for both TCP and Websocket.

#### TCP
```bash
$ HOST=localhost PORT=1337 rs-tcp-server
```
#### WebSocket
```bash
$ HOST=localhost PORT=1337 rs-ws-server
```

## Contributions
Contributions welcome, please ensure `make check` runs clean.

## License
MIT

Copyright 2016 Yunong J Xiao
