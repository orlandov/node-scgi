/*
    A Javascript SCGI application server for Node.js
    Orlando Vazquez, 2009

    http://www.python.ca/scgi/protocol.txt

    scgi = require('./lib/scgi');
    scgi.createServer(function (connection, env) {
        connection.send("Content-type: text/plain\r\n\r\n");
        connection.send("hello world");
        connection.close();
    });
*/
process.mixin(GLOBAL, require('sys'));

exports.createServer = function(requestListener) {
    var server = new process.tcp.Server();

    server.addListener('request', requestListener);
    server.addListener('connection', connectionListener);

    return server;
};

function connectionListener(connection) {
    // TODO what is the accepted way of dealing with failed assertions?
    debug('got new connection');

    var buffer = '';
    var state = 'READ_NETSTRING_LENGTH';

    var netstring_size;
    var headers = '';
    var env = {};

    connection.addListener('receive', function (packet) {
        debug("got a packet");

        // yay state machines
        while (state != 'DONE') {
            buffer += packet;
            switch(state) {
                case 'READ_NETSTRING_LENGTH':
                    var i;
                    while (i = buffer.indexOf(':')) {
                        // if ':' wasn't found, keep reading
                        if (i < 0) break;
                        netstring_size = Number(buffer.slice(0, i));

                        // assert netstring_size =~ /^\d+$/
                        buffer = buffer.slice(i + 1);
                        state = 'READ_NETSTRING';
                        break;
                    }
                    break;

                case 'READ_NETSTRING':
                    while (buffer.length >= netstring_size+1) {
                        // assert that buffer =~ /,$/
                        debug("end of netstring was " + buffer[netstring_size]);
                        headers = buffer.slice(0, netstring_size);
                        var items = headers.split("\000");

                        // assert items.length % 2 == 0
                        for (var i=0,l=items.length; i < l; i += 2) {
                            env[items[i]] = items[i+1];
                        }

                        state = 'DONE';

                        connection.server.emit('request', connection, env)
                        break;
                    }
                    break;

                // deal with additional reads if CONTENT_LENGTH > 0
            }
        }
        debug("all done!");
        return;
    });
}

exports.createServer(function (connection, env) {
    connection.send("Content-type: text/plain\r\n\r\n");
    connection.send(JSON.stringify(env));
    debug("Haw, got here"+ JSON.stringify(env));
    connection.close();
}).listen('8000');
